import { router, usePage } from '@inertiajs/vue3';
import { ref, computed, onMounted, watch } from 'vue';
import { salesOrdersService } from '@/services/sales-orders';
import type { Product } from '@/types/product';
import type { CreateSalesOrderData } from '@/types/sales-order';
import { roundMoney } from '@/utils/formatters';
import { createIdempotencyKey } from '@/utils/idempotency';
import { usePosSettings } from './usePosSettings';
import { useStoreSettings } from './useStoreSettings';

interface CartItem {
    id: string; // temporal ID for cart
    product_id: number | null;
    variant_id?: number; // Track which variant/brand was added
    variant_brand?: string; // Brand name for display in cart
    product_name: string;
    product_sku: string;
    is_custom_line?: boolean;
    custom_description?: string;
    product_price: number;
    quantity: number;
    available_stock?: number;
    discount_percent: number;
    tax_percent: number;
    default_tax_percent: number; // original tax so we can restore it
    is_tax_overridden: boolean; // Phase 1: tracks if vendor manually changed ITBM
    seller_id?: number;
    warehouse_id?: number;
    notes?: string; // Phase 2: per-line internal notes
    order_item_id?: number; // Reference to original order item (for returns)
    source_quote_item_id?: number;
    subtotal: number;
    tax_amount: number;
    total: number;
}

interface AddCustomLinePayload {
    description: string;
    sku?: string;
    quantity: number;
    unit_price: number;
    tax_percent?: number;
    discount_percent?: number;
    seller_id?: number;
    warehouse_id?: number;
    notes?: string;
}

type StockValidationContext = 'sale' | 'quote';

// ============================================
// MULTI-CART SESSION TYPES
// ============================================
interface PosCartSession {
    id: string;
    name: string;
    cart: CartItem[];
    customer_id?: number;
    customer_vehicle_id?: number;
    seller_id?: number; // set when session was loaded from a SalesQuote with an assigned seller
    notes: string;
    source_quote_id?: number; // set when session was loaded from a SalesQuote
    sessionLogs: {
        action: string;
        metadata: Record<string, any>;
        timestamp: string;
    }[];
    createdAt: string;
}

// ============================================
// MODULE-LEVEL STATE — shared across all usePOS() calls
// Persists across Inertia navigations (SPA)
// ============================================

function getUserId(): number {
    try {
        const page = (window as any).__page || {};
        return page?.props?.auth?.user?.id || 0;
    } catch {
        return 0;
    }
}

function sessionsKey(): string {
    return `pos_sessions_user_${getUserId()}`;
}

function activeSessionKey(): string {
    return `pos_active_session_user_${getUserId()}`;
}

function generateSessionId(): string {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function createEmptySession(name?: string): PosCartSession {
    return {
        id: generateSessionId(),
        name: name || 'Venta 1',
        cart: [],
        customer_id: undefined,
        notes: '',
        sessionLogs: [],
        createdAt: new Date().toISOString(),
    };
}

function loadSessionsFromStorage(): PosCartSession[] {
    try {
        const stored = localStorage.getItem(sessionsKey());
        const parsed = stored ? JSON.parse(stored) : null;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    // Default: one empty session
    return [createEmptySession()];
}

function loadActiveSessionId(): string {
    try {
        return localStorage.getItem(activeSessionKey()) || '';
    } catch {
        return '';
    }
}

function persistSessions(sessions: PosCartSession[], activeId: string) {
    try {
        localStorage.setItem(sessionsKey(), JSON.stringify(sessions));
        localStorage.setItem(activeSessionKey(), activeId);
    } catch {}
}

// --- Legacy migration: convert old single-cart localStorage to new format ---
function migrateLegacyCart(): PosCartSession[] | null {
    try {
        const oldCart = localStorage.getItem('pos_cart');
        if (!oldCart) return null;
        const cartItems = JSON.parse(oldCart);
        if (!Array.isArray(cartItems) || cartItems.length === 0) return null;

        const oldCustomer = localStorage.getItem('pos_customer_id');
        const oldNotes = localStorage.getItem('pos_notes');

        const session = createEmptySession();
        session.cart = cartItems;
        session.customer_id = oldCustomer ? Number(oldCustomer) : undefined;
        session.notes = oldNotes || '';

        // Cleanup legacy keys
        localStorage.removeItem('pos_cart');
        localStorage.removeItem('pos_customer_id');
        localStorage.removeItem('pos_notes');
        localStorage.removeItem('pos_shipping');

        return [session];
    } catch {
        return null;
    }
}

// ============================================
// SHARED REACTIVE STATE
// ============================================

// Try migrate legacy first
const migratedSessions = migrateLegacyCart();
const allSessions = ref<PosCartSession[]>(
    migratedSessions || loadSessionsFromStorage(),
);

// Make sure we have at least one session
if (allSessions.value.length === 0) {
    allSessions.value = [createEmptySession()];
}

const activeSessionId = ref<string>(
    loadActiveSessionId() || allSessions.value[0].id,
);

// Ensure active ID points to a real session
if (!allSessions.value.find((s) => s.id === activeSessionId.value)) {
    activeSessionId.value = allSessions.value[0].id;
}

// Derived reactive refs that point to the active session's data
const activeSession = computed(() => {
    return (
        allSessions.value.find((s) => s.id === activeSessionId.value) ||
        allSessions.value[0]
    );
});

const cart = computed({
    get: () => activeSession.value.cart,
    set: (val) => {
        activeSession.value.cart = val;
    },
});

const customer_id = computed({
    get: () => activeSession.value.customer_id,
    set: (val) => {
        activeSession.value.customer_id = val;
    },
});

const customer_vehicle_id = computed({
    get: () => activeSession.value.customer_vehicle_id,
    set: (val) => {
        activeSession.value.customer_vehicle_id = val;
    },
});

const notes = computed({
    get: () => activeSession.value.notes,
    set: (val) => {
        activeSession.value.notes = val;
    },
});

const sessionLogs = computed({
    get: () => activeSession.value.sessionLogs,
    set: (val) => {
        activeSession.value.sessionLogs = val;
    },
});

// Persist to localStorage on ANY change to sessions
watch(
    allSessions,
    () => {
        persistSessions(allSessions.value, activeSessionId.value);
    },
    { deep: true },
);

// ============================================
// COMPOSABLE FUNCTION
// ============================================
export function usePOS() {
    // Non-session state — initialized fresh for each composable call
    // These reset when the component mounts/remounts
    const paymentMethod = ref<'cash' | 'card' | 'transfer' | 'multiple'>(
        'cash',
    );
    const amountReceived = ref(0);
    const shippingCost = ref(0);
    const shippingMethod = ref<'pickup' | 'delivery'>('pickup');
    const loading = ref(false);
    const error = ref<string | null>(null);
    const connectionStatus = ref<'online' | 'offline' | 'error'>('online');

    // Watch activeSessionId to clear errors when switching sessions
    watch(activeSessionId, (val) => {
        persistSessions(allSessions.value, val);
        // Clear any previous errors when switching sessions
        error.value = null;
        loading.value = false;
    });
    // Get authenticated user from Inertia
    const page = usePage();

    // POS settings
    const {
        fetchSettings,
        isSingleWarehouseMode,
        getDefaultWarehouse,
        getDefaultWarehouseId,
        currentWarehouseId,
    } = usePosSettings();
    const {
        fetchSettings: fetchStoreSettings,
        resolveTaxRate: resolveDefaultTaxRate,
    } = useStoreSettings();

    // ====== Audit Logging ======
    const logAction = (action: string, metadata: Record<string, any> = {}) => {
        activeSession.value.sessionLogs.push({
            action,
            metadata,
            timestamp: new Date().toISOString(),
        });
    };

    // Load settings on initialization
    onMounted(async () => {
        try {
            await Promise.all([fetchSettings(), fetchStoreSettings()]);
        } catch (err) {
            console.error('Error loading POS settings:', err);
        }
    });

    // Recalculate item totals
    const recalculateItem = (item: CartItem) => {
        const baseAmount = item.quantity * item.product_price;
        const discountAmount = baseAmount * (item.discount_percent / 100);
        item.subtotal = baseAmount - discountAmount;
        item.tax_amount = item.subtotal * (item.tax_percent / 100);
        item.total = item.subtotal + item.tax_amount;
    };

    const normalizeTaxPercent = (value: unknown): number => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(0, Math.min(100, Math.round(parsed)));
    };

    const resolveSaleTaxRate = (pricing: any): number | null => {
        const candidate = pricing?.sale_tax_rate ?? pricing?.tax_rate;
        if (candidate === null || candidate === undefined || candidate === '') {
            return null;
        }

        return normalizeTaxPercent(candidate);
    };

    const getAvailableStock = (item: CartItem): number | null => {
        if (item.is_custom_line) return null;
        const rawStock = Number(item.available_stock);
        if (!Number.isFinite(rawStock)) return null;
        return Math.max(0, Math.floor(rawStock));
    };

    const formatStockIssue = (
        item: CartItem,
        available: number,
        requested: number,
    ): string => {
        const sku = item.product_sku ? ` (${item.product_sku})` : '';
        if (available <= 0) {
            return `${item.product_name}${sku}: sin stock disponible.`;
        }
        return `${item.product_name}${sku}: disponible ${available}, solicitado ${requested}.`;
    };

    const getStockWarnings = (
        context: StockValidationContext = 'sale',
    ): string[] => {
        const issues: string[] = [];

        for (const item of cart.value) {
            if (item.is_custom_line) continue;

            const available = getAvailableStock(item);
            if (available === null) continue;

            const requested = Number(item.quantity) || 0;
            if (available <= 0 || requested > available) {
                issues.push(formatStockIssue(item, available, requested));
            }
        }

        return issues;
    };

    const validateCartStock = (
        context: StockValidationContext = 'sale',
    ): boolean => {
        const issues = getStockWarnings(context);

        if (issues.length > 0) {
            // No longer blocking — just set a non-blocking warning message
            const actionLabel = context === 'quote' ? 'cotizar' : 'cobrar';
            error.value = `Advertencia de stock antes de ${actionLabel}:\n- ${issues.join('\n- ')}\n\nSe procederá de todas formas.`;
        }

        return true;
    };

    const activeInventoryForVariant = (variant: any, warehouseId?: number) => {
        const inventory = variant?.inventory ?? [];

        return (
            inventory.find(
                (item: any) =>
                    warehouseId &&
                    Number(item.warehouse?.id ?? item.warehouse_id) ===
                        Number(warehouseId),
            ) ??
            inventory.find(
                (item: any) =>
                    Number(
                        item.current_sale_price ??
                            item.fifo_sale_price_current ??
                            0,
                    ) > 0,
            ) ??
            null
        );
    };

    // Add product to cart (always requires an explicit variant)
    const addToCart = (
        product: Product,
        variant: any,
        quantity: number = 1,
        warehouse_id?: number,
    ) => {
        // Auto-assign default warehouse if in single warehouse mode
        if (isSingleWarehouseMode() && !warehouse_id) {
            warehouse_id = getDefaultWarehouseId() ?? undefined;
        }

        const availableStockRaw = variant?.total_stock ?? product.total_stock;
        const parsedAvailableStock = Number(availableStockRaw);
        const availableStock = Number.isFinite(parsedAvailableStock)
            ? Math.max(0, Math.floor(parsedAvailableStock))
            : undefined;

        const existingItem = cart.value.find(
            (item) =>
                item.product_id === product.id &&
                item.variant_id === variant?.id &&
                item.warehouse_id === warehouse_id,
        );

        if (existingItem) {
            if (typeof availableStock === 'number') {
                existingItem.available_stock = availableStock;
                const targetQty = existingItem.quantity + quantity;
                if (availableStock <= 0 || targetQty > availableStock) {
                    // Warn but do NOT block — allow adding with stock warning
                    const msg = formatStockIssue(
                        existingItem,
                        availableStock,
                        targetQty,
                    );
                    console.warn(`[POS] Stock warning: ${msg}`);
                }
            }

            existingItem.quantity += quantity;
            recalculateItem(existingItem);
        } else {
            // Resolve price: active lot first, then variant/product pricing.
            const variantPricing = variant?.pricing;
            const productPricing = product.pricing;
            const activeInventory = activeInventoryForVariant(
                variant,
                warehouse_id,
            );
            const resolvedPrice =
                activeInventory?.current_sale_price ??
                activeInventory?.fifo_sale_price_current ??
                variantPricing?.calculated_price ??
                variantPricing?.base_price ??
                productPricing?.calculated_price ??
                productPricing?.base_price ??
                0;
            const resolvedTaxRate = resolveDefaultTaxRate(
                resolveSaleTaxRate(variantPricing) ??
                    resolveSaleTaxRate(productPricing) ??
                    null,
            );

            const newItem: CartItem = {
                id: `${product.id}-${variant?.id ?? 'nv'}-${Date.now()}`,
                product_id: product.id,
                variant_id: variant?.id,
                variant_brand: variant?.brand?.name ?? undefined,
                product_name: product.name,
                product_sku: variant?.sku || (product as any).sku_base || '',
                product_price: resolvedPrice,
                quantity,
                available_stock: availableStock,
                discount_percent: 0,
                tax_percent: resolvedTaxRate,
                default_tax_percent: resolvedTaxRate,
                is_tax_overridden: false,
                seller_id: (page.props.auth?.user as any)?.id,
                warehouse_id,
                notes: undefined,
                subtotal: 0,
                tax_amount: 0,
                total: 0,
            };

            const newItemStock = getAvailableStock(newItem);
            if (
                newItemStock !== null &&
                (newItemStock <= 0 || quantity > newItemStock)
            ) {
                // Warn but do NOT block — allow adding with stock warning
                console.warn(
                    `[POS] Stock warning: ${formatStockIssue(newItem, newItemStock, quantity)}`,
                );
            }

            recalculateItem(newItem);
            cart.value.push(newItem);
        }

        error.value = null;
        logAction('cart_add', {
            product_id: product.id,
            variant_id: variant?.id,
            quantity,
            name: product.name,
        });
        return true;
    };

    // Add a custom/misc line (no product inventory movement)
    const addCustomLine = (payload: AddCustomLinePayload) => {
        if (!payload.description?.trim()) {
            return;
        }

        if (payload.quantity <= 0) {
            return;
        }

        const resolvedTax = resolveDefaultTaxRate(payload.tax_percent ?? null);
        const resolvedWarehouseId =
            payload.warehouse_id ??
            (isSingleWarehouseMode()
                ? (getDefaultWarehouseId() ?? undefined)
                : (currentWarehouseId.value ?? undefined));

        const newItem: CartItem = {
            id: `misc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            product_id: null,
            variant_id: undefined,
            variant_brand: undefined,
            product_name: payload.description.trim(),
            product_sku: payload.sku?.trim() || 'MISC',
            is_custom_line: true,
            custom_description: payload.description.trim(),
            product_price: Math.max(0, Number(payload.unit_price) || 0),
            quantity: Math.max(1, Number(payload.quantity) || 1),
            available_stock: undefined,
            discount_percent: Math.max(
                0,
                Math.min(100, Number(payload.discount_percent ?? 0)),
            ),
            tax_percent: resolvedTax,
            default_tax_percent: resolvedTax,
            is_tax_overridden: false,
            seller_id: payload.seller_id ?? (page.props.auth?.user as any)?.id,
            warehouse_id: resolvedWarehouseId,
            notes: payload.notes || undefined,
            subtotal: 0,
            tax_amount: 0,
            total: 0,
        };

        recalculateItem(newItem);
        cart.value.push(newItem);
        logAction('cart_add_custom_line', {
            description: newItem.custom_description,
            quantity: newItem.quantity,
            price: newItem.product_price,
        });
    };

    // Update item quantity
    const updateQuantity = (itemId: string, quantity: number) => {
        const item = cart.value.find((i) => i.id === itemId);
        if (item && quantity > 0) {
            const available = getAvailableStock(item);
            if (
                available !== null &&
                (available <= 0 || quantity > available)
            ) {
                // Warn but do NOT block
                console.warn(
                    `[POS] Stock warning: ${formatStockIssue(item, available, quantity)}`,
                );
            }

            const oldQty = item.quantity;
            item.quantity = quantity;
            recalculateItem(item);
            error.value = null;
            logAction('qty_change', {
                product_id: item.product_id,
                old_qty: oldQty,
                new_qty: quantity,
            });
            return true;
        }

        return false;
    };

    // Update item discount
    const updateDiscount = (itemId: string, discountPercent: number) => {
        const item = cart.value.find((i) => i.id === itemId);
        if (item) {
            item.discount_percent = Math.max(0, Math.min(100, discountPercent));
            recalculateItem(item);
        }
    };

    // Remove item from cart
    const removeItem = (itemId: string) => {
        const removed = cart.value.find((i) => i.id === itemId);
        if (removed) {
            logAction('cart_remove', {
                product_id: removed.product_id,
                variant_id: removed.variant_id,
                name: removed.product_name,
            });
        }
        activeSession.value.cart = cart.value.filter((i) => i.id !== itemId);
    };

    // Update item tax percent (manual override by vendor)
    const updateItemTax = (itemId: string, taxPercent: number) => {
        const item = cart.value.find((i) => i.id === itemId);
        if (item) {
            const oldTax = item.tax_percent;
            const safeTax = normalizeTaxPercent(taxPercent);
            item.tax_percent = safeTax;
            item.is_tax_overridden = true;
            // NOTE: default_tax_percent is intentionally NOT updated here.
            // It always holds the original tax from the product so the toggle
            // can always restore the correct original value.
            recalculateItem(item);
            logAction('tax_override', {
                product_id: item.product_id,
                old_tax: oldTax,
                new_tax: safeTax,
            });
        }
    };

    // Phase 1: Update item price manually (vendor override)
    const updateItemPrice = (itemId: string, newPrice: number) => {
        const item = cart.value.find((i) => i.id === itemId);
        if (item) {
            const oldPrice = item.product_price;
            item.product_price = Math.max(0, newPrice);
            // Auto-reset: deactivate tax override when price is manually changed
            if (item.is_tax_overridden) {
                item.tax_percent = resolveDefaultTaxRate(
                    item.default_tax_percent ?? null,
                );
                item.is_tax_overridden = false;
            }
            recalculateItem(item);
            logAction('price_override', {
                product_id: item.product_id,
                old_price: oldPrice,
                new_price: newPrice,
            });
        }
    };

    // Toggle item tax exempt (true toggle: 0% ↔ original tax rate)
    const toggleItemTaxExempt = (itemId: string) => {
        const item = cart.value.find((i) => i.id === itemId);
        if (item) {
            if (item.tax_percent > 0) {
                // Going exempt: zero out the tax. default_tax_percent is untouched — it always
                // holds the original product tax so we can restore it on the next click.
                item.tax_percent = 0;
            } else {
                // Restoring: always use the stored original (fallback to store tax rate for
                // legacy localStorage items that predate this field)
                item.tax_percent = resolveDefaultTaxRate(
                    item.default_tax_percent ?? null,
                );
            }
            recalculateItem(item);
        }
    };

    // Update item seller
    const updateItemSeller = (itemId: string, sellerId: number | undefined) => {
        const item = cart.value.find((i) => i.id === itemId);
        if (item) {
            item.seller_id = sellerId;
        }
    };

    // Update item notes (Phase 2: per-line internal notes)
    const updateItemNotes = (itemId: string, noteText: string) => {
        const item = cart.value.find((i) => i.id === itemId);
        if (item) {
            item.notes = noteText || undefined;
            logAction('item_note', {
                product_id: item.product_id,
                has_note: !!noteText,
            });
        }
    };

    // Reorder cart items (e.g. from Drag and Drop)
    const reorderCart = (newCartArray: CartItem[]) => {
        activeSession.value.cart = [...newCartArray];
    };

    // Clear entire cart (clears the ACTIVE session only)
    const clearCart = () => {
        if (cart.value.length > 0) {
            if (confirm('¿Limpiar todo el carrito?')) {
                activeSession.value.cart = [];
                activeSession.value.customer_id = undefined;
                activeSession.value.customer_vehicle_id = undefined;
                activeSession.value.notes = '';
                paymentMethod.value = 'cash';
                amountReceived.value = 0;
                shippingCost.value = 0;
                shippingMethod.value = 'pickup';
            }
        }
    };

    // ============================================
    // MULTI-CART METHODS
    // ============================================

    /** Create a new empty cart tab and switch to it */
    const createNewCart = (name?: string) => {
        const nextNum = allSessions.value.length + 1;
        const session = createEmptySession(name || `Venta ${nextNum}`);
        allSessions.value.push(session);
        activeSessionId.value = session.id;
        // Reset non-session state
        paymentMethod.value = 'cash';
        amountReceived.value = 0;
        shippingCost.value = 0;
        shippingMethod.value = 'pickup';
    };

    /** Switch to an existing cart tab */
    const switchCart = (sessionId: string) => {
        if (allSessions.value.find((s) => s.id === sessionId)) {
            activeSessionId.value = sessionId;
            // Reset payment state when switching
            paymentMethod.value = 'cash';
            amountReceived.value = 0;
            shippingCost.value = 0;
            shippingMethod.value = 'pickup';
        }
    };

    /** Remove a cart tab (with confirmation if it has items) */
    const removeCart = (sessionId: string) => {
        const session = allSessions.value.find((s) => s.id === sessionId);
        if (!session) return;

        if (session.cart.length > 0) {
            if (
                !confirm(
                    `¿Eliminar "${session.name}" con ${session.cart.length} producto(s)?`,
                )
            )
                return;
        }

        allSessions.value = allSessions.value.filter((s) => s.id !== sessionId);

        // If we removed the active session, switch to another
        if (activeSessionId.value === sessionId) {
            if (allSessions.value.length === 0) {
                // Create a fresh one
                const fresh = createEmptySession();
                allSessions.value = [fresh];
                activeSessionId.value = fresh.id;
            } else {
                activeSessionId.value = allSessions.value[0].id;
            }
        }
    };

    /** Rename a cart tab */
    const renameCart = (sessionId: string, newName: string) => {
        const session = allSessions.value.find((s) => s.id === sessionId);
        if (session) {
            session.name = newName;
        }
    };

    // Computed totals
    const cartSubtotal = computed(() => {
        return cart.value.reduce((sum, item) => sum + item.subtotal, 0);
    });

    const cartTax = computed(() => {
        return cart.value.reduce((sum, item) => sum + item.tax_amount, 0);
    });

    const cartTotal = computed(() => {
        return cartSubtotal.value + cartTax.value + shippingCost.value;
    });

    const cartItemCount = computed(() => {
        return cart.value.reduce((sum, item) => sum + item.quantity, 0);
    });

    const change = computed(() => {
        return Math.max(0, amountReceived.value - cartTotal.value);
    });

    // Process sale
    const processSale = async (
        paymentsArray?: Array<{
            method: string;
            amount: number;
            reference_number?: string | null;
            notes?: string | null;
        }>,
    ) => {
        if (loading.value) return false;
        if (cart.value.length === 0) {
            error.value = 'El carrito está vacío';
            return false;
        }

        if (!validateCartStock('sale')) {
            return false;
        }

        // Validate payments vs total
        if (!paymentsArray || paymentsArray.length === 0) {
            // Legacy check
            if (
                paymentMethod.value === 'cash' &&
                amountReceived.value < cartTotal.value &&
                !customer_id.value
            ) {
                error.value =
                    'Monto recibido insuficiente (se requiere cliente para pagos parciales/crédito)';
                return false;
            }
        } else {
            // Multi-tender check
            const totalPaid = roundMoney(
                paymentsArray.reduce(
                    (acc, p) =>
                        acc + roundMoney(Math.max(0, Number(p.amount) || 0)),
                    0,
                ),
            );
            if (totalPaid < cartTotal.value && !customer_id.value) {
                error.value =
                    'Monto total insuficiente (se requiere cliente para pagos parciales)';
                return false;
            }
        }

        loading.value = true;
        error.value = null;

        try {
            logAction('checkout_success', { total: cartTotal.value });

            const currentUser = page.props.auth?.user as any;
            const orderData: CreateSalesOrderData = {
                idempotency_key: createIdempotencyKey(),
                user_id: currentUser?.id, // Pass user_id from Inertia auth dynamically
                customer_id: customer_id.value,
                customer_vehicle_id: customer_vehicle_id.value,
                date: new Date().toISOString().split('T')[0],
                status: 'confirmed', // POS sales must be confirmed immediately so they appear in session summary
                warehouse_id: currentWarehouseId.value || 1,
                notes: notes.value,

                // Dynamic payment format
                ...(paymentsArray && paymentsArray.length > 0
                    ? {
                          payments: paymentsArray,
                          payment_method: 'multiple' as any,
                      }
                    : {
                          payment_method: paymentMethod.value,
                          initial_payment: amountReceived.value,
                      }),

                discount_amount: 0,
                shipping_cost: shippingCost.value,
                source_quote_id: activeSession.value.source_quote_id,
                audit_logs:
                    sessionLogs.value.length > 0
                        ? sessionLogs.value
                        : undefined,
                items: cart.value.map((item) => ({
                    source_quote_item_id: item.source_quote_item_id,
                    product_id: item.is_custom_line ? null : item.product_id,
                    variant_id: item.variant_id, // Send variant ID to backend
                    warehouse_id:
                        item.warehouse_id || currentWarehouseId.value || 1, // Use backend context as fallback
                    quantity: item.quantity,
                    unit_price: item.product_price,
                    discount_percent: item.discount_percent,
                    tax_percent: normalizeTaxPercent(item.tax_percent),
                    seller_id: item.seller_id,
                    notes: item.notes || undefined,
                    is_custom_line: !!item.is_custom_line,
                    custom_description: item.is_custom_line
                        ? item.custom_description || item.product_name
                        : undefined,
                })),
            };

            const createdOrderResult =
                await salesOrdersService.create(orderData);

            // Show stock warnings from API as visible alert
            const apiWarnings = createdOrderResult?.warnings;
            if (
                apiWarnings &&
                Array.isArray(apiWarnings) &&
                apiWarnings.length > 0
            ) {
                const warningMsgs = apiWarnings
                    .map((w: any) => w.message || JSON.stringify(w))
                    .join('\n- ');
                alert(
                    `Venta procesada con advertencias de stock:\n\n- ${warningMsgs}`,
                );
            }

            const createdOrder = createdOrderResult?.data || createdOrderResult;

            // After successful sale: remove the completed session and switch
            const completedId = activeSessionId.value;
            allSessions.value = allSessions.value.filter(
                (s) => s.id !== completedId,
            );

            if (allSessions.value.length === 0) {
                // Create a fresh session
                const fresh = createEmptySession();
                allSessions.value = [fresh];
                activeSessionId.value = fresh.id;
            } else {
                // Switch to the first remaining session
                activeSessionId.value = allSessions.value[0].id;
            }

            // Reset payment state
            amountReceived.value = 0;
            shippingCost.value = 0;
            shippingMethod.value = 'pickup';

            // Return the created order so callers can use the ID (e.g. for printing tickets)
            return createdOrder;
        } catch (err: any) {
            console.error('Sales order creation error:', err.response?.data);

            if (!err.response) {
                // Network error — no response from server
                connectionStatus.value = 'offline';
                error.value = 'Sin conexión con el servidor — intenta de nuevo';
            } else if (err.response.status === 401) {
                connectionStatus.value = 'error';
                error.value = 'Sesión expirada. Recarga la página.';
            } else if (err.response.status && err.response.status >= 500) {
                connectionStatus.value = 'error';
                error.value =
                    err.response.data?.message || 'Error interno del servidor';
            } else {
                // 422 or other — stock/validation errors
                connectionStatus.value = 'online';
                const stockErrors = err.response.data?.errors;
                if (Array.isArray(stockErrors)) {
                    error.value = stockErrors.join('\n');
                } else {
                    error.value =
                        err.response.data?.message ||
                        'Error al procesar la venta';
                }
            }

            return false;
        } finally {
            loading.value = false;
        }
    };

    // Save as draft
    const saveDraft = async () => {
        if (loading.value) return false;
        if (cart.value.length === 0) {
            error.value = 'El carrito está vacío';
            return false;
        }

        if (!validateCartStock('sale')) {
            return false;
        }

        loading.value = true;
        error.value = null;

        try {
            const currentUser = page.props.auth?.user as any;
            const orderData: CreateSalesOrderData = {
                user_id: currentUser?.id, // Pass user_id from Inertia auth
                customer_id: customer_id.value,
                customer_vehicle_id: customer_vehicle_id.value,
                date: new Date().toISOString().split('T')[0],
                notes: notes.value,
                payment_method: undefined,
                payment_status: 'pending',
                warehouse_id: currentWarehouseId.value || 1,
                discount_amount: 0,
                shipping_cost: shippingCost.value,
                items: cart.value.map((item) => ({
                    product_id: item.is_custom_line ? null : item.product_id,
                    warehouse_id:
                        item.warehouse_id || currentWarehouseId.value || 1,
                    quantity: item.quantity,
                    unit_price: item.product_price,
                    discount_percent: item.discount_percent,
                    tax_percent: normalizeTaxPercent(item.tax_percent),
                    seller_id: item.seller_id,
                    notes: item.notes || undefined,
                    is_custom_line: !!item.is_custom_line,
                    custom_description: item.is_custom_line
                        ? item.custom_description || item.product_name
                        : undefined,
                })),
            };

            await salesOrdersService.create(orderData);

            // Remove the completed session
            const completedId = activeSessionId.value;
            allSessions.value = allSessions.value.filter(
                (s) => s.id !== completedId,
            );

            if (allSessions.value.length === 0) {
                const fresh = createEmptySession();
                allSessions.value = [fresh];
                activeSessionId.value = fresh.id;
            } else {
                activeSessionId.value = allSessions.value[0].id;
            }

            return true;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al guardar borrador';
            return false;
        } finally {
            loading.value = false;
        }
    };

    // ============================================
    // LOAD QUOTE AS A NEW POS SESSION
    // ============================================

    /**
     * Opens a SalesQuote as a new cart tab in the POS.
     * Items, prices, discounts and taxes are taken directly from the quote.
     */
    const loadQuoteAsSession = (quote: {
        id: number;
        quote_number: string;
        customer_id?: number | null;
        customer_vehicle_id?: number | null;
        seller_id?: number | null;
        notes?: string | null;
        items: Array<{
            id: number;
            product_id: number | null;
            product_name: string;
            product_sku: string;
            variant_id?: number | null;
            warehouse_id?: number | null;
            quantity: number;
            unit_price: number;
            discount_percent: number;
            tax_percent: number;
            subtotal: number;
            tax_amount: number;
            total: number;
            is_custom_line?: boolean;
            custom_description?: string | null;
            variant?: {
                id: number;
                sku: string;
                brand?: { name: string } | null;
            } | null;
        }>;
    }): string => {
        createNewCart(`COT-${quote.quote_number}`);

        const newSession = activeSession.value;
        newSession.customer_id = quote.customer_id ?? undefined;
        newSession.customer_vehicle_id = quote.customer_vehicle_id ?? undefined;
        newSession.seller_id = quote.seller_id ?? undefined;
        newSession.notes = quote.notes ?? '';
        newSession.source_quote_id = quote.id; // ← persisted so POS can update it later

        newSession.cart = quote.items.map((item, idx): CartItem => {
            const cartItem: CartItem = {
                id: `q${quote.id}-${item.product_id}-${item.variant_id ?? 'nv'}-${idx}`,
                source_quote_item_id: item.id,
                product_id: item.product_id ?? null,
                variant_id: item.variant_id ?? undefined,
                variant_brand: item.variant?.brand?.name ?? undefined,
                product_name: item.product_name,
                product_sku:
                    item.variant?.sku ||
                    item.product_sku ||
                    (item.is_custom_line ? 'MISC' : ''),
                is_custom_line: !!item.is_custom_line,
                custom_description: item.custom_description ?? undefined,
                product_price: Number(item.unit_price) || 0,
                quantity: Number(item.quantity) || 1,
                discount_percent: Number(item.discount_percent) || 0,
                tax_percent: normalizeTaxPercent(item.tax_percent),
                default_tax_percent: normalizeTaxPercent(item.tax_percent),
                is_tax_overridden: false,
                seller_id: quote.seller_id ?? undefined,
                warehouse_id: item.warehouse_id ?? undefined,
                subtotal: 0,
                tax_amount: 0,
                total: 0,
            };
            // Let the POS recalculate so its own computed totals are always correct
            recalculateItem(cartItem);
            return cartItem;
        });

        logAction('quote_loaded', {
            quote_id: quote.id,
            quote_number: quote.quote_number,
            items: quote.items.length,
        });

        return newSession.id;
    };

    return {
        // State
        cart,
        customer_id,
        customer_vehicle_id,
        notes,
        loading,
        error,
        connectionStatus,
        paymentMethod,
        amountReceived,
        shippingCost,
        shippingMethod,

        // Computed
        cartSubtotal,
        cartTax,
        cartTotal,
        cartItemCount,
        change,

        // Methods
        addToCart,
        addCustomLine,
        updateQuantity,
        updateDiscount,
        updateItemPrice,
        removeItem,
        updateItemTax,
        toggleItemTaxExempt,
        updateItemSeller,
        updateItemNotes,
        reorderCart,
        clearCart,
        validateCartStock,
        getStockWarnings,
        processSale,
        saveDraft,
        loadQuoteAsSession,

        // Multi-cart
        allSessions,
        activeSessionId,
        activeSession,
        createNewCart,
        switchCart,
        removeCart,
        renameCart,

        // Audit
        sessionLogs,
        logAction,

        // POS Settings
        isSingleWarehouseMode,
        getDefaultWarehouse,
        getDefaultWarehouseId,
    };
}
