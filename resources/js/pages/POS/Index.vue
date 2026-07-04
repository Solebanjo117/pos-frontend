<script setup lang="ts">
import { Head, usePage } from '@inertiajs/vue3';
import { router } from '@inertiajs/vue3';
import {
    Search,
    Trash2,
    Save,
    Banknote,
    CreditCard,
    Landmark,
    AlertTriangle,
    Keyboard,
    LogOut,
    Car,
    Gift,
    FileText,
    SlidersHorizontal,
    ArrowUpDown,
    Filter,
} from 'lucide-vue-next';
import {
    ref,
    reactive,
    computed,
    onMounted,
    onUnmounted,
    watch,
    nextTick,
} from 'vue';
import ActionButtons from '@/components/POS/ActionButtons.vue';
import AddCustomLineModal from '@/components/POS/AddCustomLineModal.vue';
import AddPaymentModal from '@/components/POS/AddPaymentModal.vue';
import CashMovementModal from '@/components/POS/CashMovementModal.vue';
import CashRegisterStatus from '@/components/POS/CashRegisterStatus.vue';
import OpenSessionModal from '@/components/POS/OpenSessionModal.vue';
import type POSControls from '@/components/POS/POSControls.vue';
import POSInlineSearch from '@/components/POS/POSInlineSearch.vue';
import PrintTicketModal from '@/components/POS/PrintTicketModal.vue';
import ProductSearchModal from '@/components/POS/ProductSearchModal.vue';
import ProductTable from '@/components/POS/ProductTable.vue';
import QuickCustomerModal from '@/components/POS/QuickCustomerModal.vue';
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue';
import SummarySection from '@/components/POS/SummarySection.vue';
import UnifiedPaymentPanel from '@/components/POS/UnifiedPaymentPanel.vue';
import VariantSelectModal from '@/components/POS/VariantSelectModal.vue';
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue';
import PriceDisplay from '@/components/ui/PriceDisplay.vue';
import { useCustomers } from '@/composables/useCustomers';
import { usePOS } from '@/composables/usePOS';
import { usePosSession } from '@/composables/usePosSession';
import { usePosSettings } from '@/composables/usePosSettings';
import { useProducts } from '@/composables/useProducts';
import { useStoreSettings } from '@/composables/useStoreSettings';
import { useWarehouses } from '@/composables/useWarehouses';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
// POSFilterSidebar removed — filtering now handled inside ProductSearchModal via ProductFilters

import { SalesOrderPaymentApiService } from '@/services/payments';
import { SalesReturnsApiService } from '@/services/sales-returns';
import type { ProductVariantSelection } from '@/types/product-variant-picker';

defineOptions({ layout: AppLayout });

const props = withDefaults(
    defineProps<{
        quoteMode?: boolean;
        quoteId?: number;
        returnMode?: boolean;
        editMode?: boolean;
        orderId?: number;
    }>(),
    {
        quoteMode: false,
        quoteId: undefined,
        returnMode: false,
        editMode: false,
        orderId: undefined,
    },
);

const page = usePage();
const currentRole = computed(() => (page.props.auth?.user as any)?.role);
const isStrictCashier = computed(() => currentRole.value === 'cashier');
const canEditSeller = computed(() => !isStrictCashier.value);
const canUseProductSearch = computed(() => !isStrictCashier.value);
const canClearCurrentCart = computed(
    () =>
        !isStrictCashier.value &&
        !activeSession.value?.source_quote_id &&
        !props.editMode,
);

const { defaultTaxRate } = useStoreSettings();

const {
    cart,
    customer_id,
    notes,
    loading,
    error,
    paymentMethod,
    amountReceived,
    cartSubtotal,
    cartTax,
    cartTotal,
    cartItemCount,
    change,
    addToCart,
    addCustomLine,
    updateQuantity,
    updateDiscount,
    removeItem,
    updateItemTax,
    toggleItemTaxExempt,
    updateItemSeller,
    updateItemNotes,
    updateItemPrice,
    reorderCart,
    clearCart,
    validateCartStock,
    getStockWarnings,
    processSale,
    saveDraft,
    shippingCost,
    shippingMethod,
    logAction,
    // Multi-cart
    allSessions,
    activeSessionId,
    activeSession,
    createNewCart,
    switchCart,
    removeCart,
    renameCart,
    loadQuoteAsSession,
} = usePOS();

const {
    currentWarehouseId,
    setWarehouse,
    initWarehouse,
    settings,
    isClientMode,
} = usePosSettings();

const {
    products,
    fetchProducts,
    fetchMoreProducts,
    total: totalProducts,
    hasNextPage,
    loading: productsLoading,
} = useProducts();
const { customers, fetchCustomers } = useCustomers();
const { warehouses, fetchWarehouses } = useWarehouses();

const {
    isChecking: isCheckingSession,
    isOpen: isSessionOpen,
    error: sessionError,
    checkCurrentSession,
    openSession,
    addCashMovement,
} = usePosSession();

// UI State
const searchQuery = ref('');
const posControlsRef = ref<InstanceType<typeof POSControls> | null>(null);
const inlineSearchRef = ref<InstanceType<typeof POSInlineSearch> | null>(null);
const selectedCategoryId = ref<number | undefined>(undefined);
const selectedBrandId = ref<number | undefined>(undefined);
const quantity = ref(1);
const showPaymentModal = ref(false);
const showShortcutsHelp = ref(false);
const showProductsModal = ref(false);
const isSearching = ref(false);
const showCashMovementModal = ref(false);
const showQuickCustomerModal = ref(false);
const showCustomLineModal = ref(false);
const forceShowOpenSessionModal = ref(false);
const sessionActionLoading = ref(false);

// R45: Filter sidebar state
const showFilterSidebar = ref(false);

// R44: Cart search and sort state
const cartSearchQuery = ref('');
const cartSortBy = ref<'default' | 'name' | 'sku' | 'qty' | 'price'>('default');
const cartSortDir = ref<'asc' | 'desc'>('asc');

const filteredAndSortedCart = computed(() => {
    let items = [...cart.value];
    // Filter by search query
    const q = cartSearchQuery.value.trim().toLowerCase();
    if (q) {
        items = items.filter(
            (item: any) =>
                (item.product_name || '').toLowerCase().includes(q) ||
                (item.product_sku || '').toLowerCase().includes(q) ||
                (item.variant_sku || '').toLowerCase().includes(q) ||
                (item.variant_name || '').toLowerCase().includes(q),
        );
    }
    // Sort
    if (cartSortBy.value !== 'default') {
        items.sort((a: any, b: any) => {
            let va: any, vb: any;
            switch (cartSortBy.value) {
                case 'name':
                    va = (a.product_name || '').toLowerCase();
                    vb = (b.product_name || '').toLowerCase();
                    break;
                case 'sku':
                    va = (a.product_sku || '').toLowerCase();
                    vb = (b.product_sku || '').toLowerCase();
                    break;
                case 'qty':
                    va = a.quantity;
                    vb = b.quantity;
                    break;
                case 'price':
                    va = a.product_price;
                    vb = b.product_price;
                    break;
                default:
                    return 0;
            }
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return cartSortDir.value === 'asc' ? cmp : -cmp;
        });
    }
    return items;
});

const toggleCartSort = (field: 'name' | 'sku' | 'qty' | 'price') => {
    if (cartSortBy.value === field) {
        cartSortDir.value = cartSortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        cartSortBy.value = field;
        cartSortDir.value = 'asc';
    }
};

const cartSortOptions: {
    key: 'name' | 'sku' | 'qty' | 'price';
    label: string;
}[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'sku', label: 'SKU' },
    { key: 'qty', label: 'Cant.' },
    { key: 'price', label: 'Precio' },
];
const seller_id = ref<number | undefined>((page.props.auth?.user as any)?.id);

const handleClearCurrentCart = () => {
    if (!canClearCurrentCart.value) {
        return;
    }

    clearCart();
};

// Variant selection modal state — queue-based to support multiple products needing variant selection
const showVariantModal = ref(false);
const variantQueue = ref<any[]>([]); // FIFO queue of products awaiting variant selection
const pendingProduct = computed(() => variantQueue.value[0] ?? null); // always the first in queue

// Credit / partial-payment modal state
const showAddPaymentModal = ref(false);
const addPaymentLoading = ref(false);
const addPaymentError = ref<string | null>(null);
const pendingOrderId = ref<number | null>(null);

// Product Detail Modal (from right-click in cart)
const selectedProductForModal = ref<any>(null);
const openProductDetail = async (productId: number) => {
    try {
        const { data } = await apiClient.get(`/products/${productId}`);
        selectedProductForModal.value = data.data ?? data;
    } catch {
        /* silent */
    }
};

type PendingQuickRestock = {
    product: any;
    variant: any | null;
    requestedQty: number;
    warehouseId?: number;
};

const showAutoQuickPurchaseModal = ref(false);
const autoQuickPurchaseProduct = ref<any | null>(null);
const autoQuickPurchaseVariantId = ref<number | null>(null);
const pendingQuickRestock = ref<PendingQuickRestock | null>(null);

const getNumericStock = (product: any, variant: any | null): number | null => {
    const raw = Number(variant?.total_stock ?? product?.total_stock);
    if (!Number.isFinite(raw)) return null;
    return Math.max(0, Math.floor(raw));
};

const closeAutoQuickPurchaseModal = () => {
    showAutoQuickPurchaseModal.value = false;
    autoQuickPurchaseProduct.value = null;
    autoQuickPurchaseVariantId.value = null;
    pendingQuickRestock.value = null;
};

const openAutoQuickPurchaseForNoStock = (
    product: any,
    variant: any | null,
    requestedQty: number,
    warehouseId?: number,
) => {
    pendingQuickRestock.value = {
        product,
        variant,
        requestedQty: Math.max(1, requestedQty || 1),
        warehouseId,
    };
    autoQuickPurchaseProduct.value = product;
    autoQuickPurchaseVariantId.value = variant?.id ?? null;
    showAutoQuickPurchaseModal.value = true;
};

const attemptAddToCartWithStockFallback = (
    product: any,
    variant: any | null,
    requestedQty: number = 1,
    warehouseId?: number,
) => {
    const qty = Math.max(1, requestedQty || 1);
    const added = addToCart(product, variant, qty, warehouseId);
    if (added) return true;

    const stock = getNumericStock(product, variant);
    if (stock !== null && stock <= 0) {
        openAutoQuickPurchaseForNoStock(product, variant, qty, warehouseId);
    }

    return false;
};

const handleAutoQuickPurchaseSuccess = (result: {
    productId: number;
    variantId: number | null;
    quantityAdded: number;
    addedToSupplyList?: boolean;
}) => {
    const ctx = pendingQuickRestock.value;
    if (!ctx) {
        closeAutoQuickPurchaseModal();
        return;
    }

    const fromSupplyList = !!result.addedToSupplyList;

    const qtyAdded = Math.max(0, Number(result.quantityAdded) || 0);

    // Keep stock references in sync before re-trying addToCart.
    if (ctx.variant) {
        const currentVariantStock = Number(ctx.variant.total_stock);
        const safeVariantStock = Number.isFinite(currentVariantStock)
            ? Math.max(0, currentVariantStock)
            : 0;
        ctx.variant.total_stock = safeVariantStock + qtyAdded;
    }

    const currentProductStock = Number(ctx.product?.total_stock);
    const safeProductStock = Number.isFinite(currentProductStock)
        ? Math.max(0, currentProductStock)
        : 0;
    if (ctx.product) {
        ctx.product.total_stock = safeProductStock + qtyAdded;
    }

    const productInResults = products.value.find(
        (p: any) => p.id === result.productId,
    );
    if (productInResults) {
        const existingTotalStock = Number(productInResults.total_stock);
        const safeExistingStock = Number.isFinite(existingTotalStock)
            ? Math.max(0, existingTotalStock)
            : 0;
        productInResults.total_stock = safeExistingStock + qtyAdded;

        if (result.variantId && Array.isArray(productInResults.variants)) {
            const variantInResults = productInResults.variants.find(
                (v: any) => v.id === result.variantId,
            );
            if (variantInResults) {
                const existingVariantStock = Number(
                    variantInResults.total_stock,
                );
                const safeExistingVariantStock = Number.isFinite(
                    existingVariantStock,
                )
                    ? Math.max(0, existingVariantStock)
                    : 0;
                variantInResults.total_stock =
                    safeExistingVariantStock + qtyAdded;
            }
        }
    }

    const qtyToAdd = Math.max(
        1,
        Math.min(ctx.requestedQty, qtyAdded || ctx.requestedQty),
    );
    attemptAddToCartWithStockFallback(
        ctx.product,
        ctx.variant,
        qtyToAdd,
        ctx.warehouseId,
    );

    if (fromSupplyList) {
        error.value = null;
    }

    closeAutoQuickPurchaseModal();
    nextTick(() => searchInput.value?.focus());
};

const handleAddCustomLine = (payload: {
    custom_description: string;
    product_sku?: string;
    quantity: number;
    unit_price: number;
    tax_percent: number;
    discount_percent: number;
    notes?: string;
}) => {
    addCustomLine({
        description: payload.custom_description,
        sku: payload.product_sku,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        tax_percent: payload.tax_percent,
        discount_percent: payload.discount_percent,
        seller_id: seller_id.value,
        warehouse_id: currentWarehouseId.value || undefined,
        notes: payload.notes,
    });
    showCustomLineModal.value = false;
};

// Quick Customer Modal handler
const handleCustomerCreated = async (newCustomer: any) => {
    await fetchCustomers();
    customer_id.value = newCustomer.id;
};

// Handle reorder success from ProductTable QuickPurchaseModal
const handleReorderSuccess = (result: {
    productId: number;
    variantId: number | null;
    quantityAdded: number;
}) => {
    const item = cart.value.find(
        (i: any) =>
            i.product_id === result.productId &&
            (result.variantId ? i.variant_id === result.variantId : true),
    );
    if (item && item.available_stock !== undefined) {
        item.available_stock += result.quantityAdded;
    }
};
const pendingOrderTotal = ref(0);
const pendingOrderAmountPaid = ref(0);
// Electronic Payments for Multi-Tender Flow
const electronicPayments = reactive<Record<string, number>>({});
// Store credit (saldo a favor) to apply to this sale
const storeCreditToApply = ref(0);
const handlePaymentChange = (id: string, value: number) => {
    electronicPayments[id] = value;
};

const totalElectronicPayments = computed(() => {
    return Object.values(electronicPayments).reduce((sum, val) => sum + val, 0);
});

// Total dinero realmente recibido (efectivo, tarjeta, transferencia, saldo a favor)
// NO incluye crédito porque el crédito es deuda, no dinero recibido
const totalReceived = computed(() => {
    return (
        amountReceived.value +
        totalElectronicPayments.value +
        storeCreditToApply.value
    );
});

// Monto pendiente (lo que falta por cobrar o se cargará a crédito)
const pendingAmount = computed(() => {
    return Math.max(0, amountToCharge.value - totalReceived.value);
});

// Total de descuento en el carrito
const cartDiscount = computed(() => {
    return cart.value.reduce(
        (sum, item: any) => sum + (Number(item.discount_amount) || 0),
        0,
    );
});

// Vuelto a entregar (solo si se recibió más de lo debido)
const localChange = computed(() => {
    return Math.max(0, totalReceived.value - cartTotal.value);
});

// Available credit for the selected customer
const creditAvailable = computed(() => {
    if (!selectedCustomer.value) return 0;
    return Math.max(
        0,
        (selectedCustomer.value.credit_limit ?? 0) -
            Math.max(0, selectedCustomer.value.current_balance ?? 0),
    );
});

// El crédito a cargar se calcula automáticamente: es el mínimo entre lo pendiente y el crédito disponible
// Solo aplica si hay cliente seleccionado
const creditToCharge = computed(() => {
    if (!selectedCustomer.value || pendingAmount.value <= 0) return 0;
    return Math.min(pendingAmount.value, creditAvailable.value);
});

// Monto que queda sin cubrir (ni pagado ni cubierto por crédito)
const uncoveredAmount = computed(() => {
    return Math.max(0, pendingAmount.value - creditToCharge.value);
});

// Para compatibilidad con el template existente
const totalPaid = computed(() => {
    return totalReceived.value + creditToCharge.value;
});

const totalRemaining = computed(() => {
    return uncoveredAmount.value;
});

// Remaining to pay after cash and electronic payments (alias para compatibilidad)
const remainingToPay = computed(() => {
    return pendingAmount.value;
});

// Return mode state
const returnOrderData = ref<any>(null);
const returnLoading = ref(false);
const returnError = ref<string | null>(null);

// Edit mode state
const editOrderData = ref<any>(null);
const editLoading = ref(false);
const editError = ref<string | null>(null);
interface OriginalItemSnapshot {
    qty: number;
    price: number;
    order_item_id: number;
}
const originalItems = ref<Record<string, OriginalItemSnapshot>>({});
const nowTick = ref(Date.now());
let elapsedTimer: ReturnType<typeof setInterval> | null = null;

const getOriginalItemKey = (payload: {
    product_id?: number | null;
    variant_id?: number | null;
    warehouse_id?: number | null;
    is_custom_line?: boolean;
    custom_description?: string | null;
}) => {
    if (payload.is_custom_line) {
        const label = (payload.custom_description || '').trim().toLowerCase();
        return `custom:${label}:${payload.warehouse_id ?? 'none'}`;
    }

    return `${payload.product_id ?? 'none'}:${payload.variant_id ?? 'none'}:${payload.warehouse_id ?? 'none'}`;
};

// Load order for edit (add/modify items on an existing confirmed order)
async function loadOrderForReturn(orderId: number) {
    try {
        const res = await apiClient.get(`/sales-orders/${orderId}`);
        const order = res.data.data ?? res.data;
        returnOrderData.value = order;

        // Set customer
        if (order.customer_id) {
            if (
                order.customer &&
                !customers.value.some((c: any) => c.id === order.customer_id)
            ) {
                customers.value.push(order.customer);
            }
            customer_id.value = order.customer_id;
        }

        // DO NOT call clearCart() because we are in an isolated session
        for (const item of order.items ?? []) {
            if (item.is_custom_line) {
                // Misc/custom lines are not returnable by design.
                continue;
            }

            const quantity = -Math.abs(item.quantity); // Negative for returns
            const unitPrice = Number(item.unit_price);
            const discountPercent = Number(item.discount_percent ?? 0);
            const taxPercent = normalizeTaxPercent(item.tax_percent);

            // Use the actual values from the original order to avoid discrepancies
            // Negate them for returns
            const subtotal = -Math.abs(Number(item.subtotal ?? 0));
            const taxAmount = -Math.abs(Number(item.tax_amount ?? 0));
            const total = -Math.abs(Number(item.total ?? 0));

            cart.value.push({
                id: `return-${item.id}`,
                product_id: item.product_id,
                variant_id: item.variant_id ?? undefined,
                product_name:
                    item.product_name || item.product?.name || 'Producto',
                product_sku: item.product_sku || item.product?.sku_base || '',
                product_price: unitPrice,
                quantity,
                discount_percent: discountPercent,
                tax_percent: taxPercent,
                default_tax_percent: taxPercent,
                is_tax_overridden: false,
                warehouse_id: item.warehouse_id,
                order_item_id: item.id, // Keep reference to original order item
                seller_id: item.seller_id, // Inject original seller
                subtotal,
                tax_amount: taxAmount,
                total,
            });
        }
    } catch (e: any) {
        console.error('Error loading order for return:', e);
        returnError.value =
            e.response?.data?.message ||
            'Error al cargar la orden para devolución';
    }
}

// Confirm return
async function confirmReturn() {
    if (!props.orderId || cart.value.length === 0) return;

    returnLoading.value = true;
    returnError.value = null;

    try {
        // Build return items from cart
        const items = cart.value.map((item: any) => ({
            sales_order_item_id: item.order_item_id,
            quantity: Math.abs(item.quantity),
            seller_id: item.seller_id,
        }));

        // Create the return
        const returnRes = await SalesReturnsApiService.createForOrder(
            props.orderId,
            {
                refund_method: 'balance', // Always use balance for store credit
                reason: 'Devolución desde POS',
                items,
            },
        );

        const returnId = returnRes.data?.id;
        if (returnId) {
            // Approve immediately
            await SalesReturnsApiService.approve(returnId);
        }

        // Redirect to the original order
        router.visit(`/sales-orders/${props.orderId}`);
    } catch (e: any) {
        console.error('Error processing return:', e);
        const errData = e.response?.data;
        if (Array.isArray(errData?.errors)) {
            returnError.value = errData.errors.join('\n');
        } else {
            returnError.value =
                errData?.message || 'Error al procesar la devolución';
        }
    } finally {
        returnLoading.value = false;
    }
}

// Load order for edit (add items / increase quantities)
async function loadOrderForEdit(orderId: number) {
    try {
        const res = await apiClient.get(`/sales-orders/${orderId}`);
        const order = res.data.data ?? res.data;
        editOrderData.value = order;

        // Set customer
        if (order.customer_id) {
            if (
                order.customer &&
                !customers.value.some((c: any) => c.id === order.customer_id)
            ) {
                customers.value.push(order.customer);
            }
            customer_id.value = order.customer_id;
        }

        // Load existing items with POSITIVE quantities and snapshot original state
        for (const item of order.items ?? []) {
            const quantity = Math.abs(item.quantity);
            const unitPrice = Number(item.unit_price);
            const discountPercent = Number(item.discount_percent ?? 0);
            const taxPercent = normalizeTaxPercent(item.tax_percent);
            const subtotal = Number(item.subtotal ?? 0);
            const taxAmount = Number(item.tax_amount ?? 0);
            const total = Number(item.total ?? 0);

            const originalKey = getOriginalItemKey({
                product_id: item.product_id,
                variant_id: item.variant_id ?? null,
                warehouse_id: item.warehouse_id ?? null,
                is_custom_line: item.is_custom_line,
                custom_description: item.custom_description,
            });

            // Snapshot original state
            originalItems.value[originalKey] = {
                qty: quantity,
                price: unitPrice,
                order_item_id: item.id,
            };

            cart.value.push({
                id: `edit-${item.id}`,
                product_id: item.product_id ?? null,
                variant_id: item.variant_id ?? undefined,
                product_name:
                    item.product_name || item.product?.name || 'Producto',
                product_sku:
                    item.product_sku ||
                    item.product?.sku_base ||
                    (item.is_custom_line ? 'MISC' : ''),
                is_custom_line: !!item.is_custom_line,
                custom_description: item.custom_description ?? undefined,
                product_price: unitPrice,
                quantity,
                discount_percent: discountPercent,
                tax_percent: taxPercent,
                default_tax_percent: taxPercent,
                is_tax_overridden: false,
                warehouse_id: item.warehouse_id,
                order_item_id: item.id,
                seller_id: item.seller_id,
                subtotal,
                tax_amount: taxAmount,
                total,
            });
        }
    } catch (e: any) {
        console.error('Error loading order for edit:', e);
        editError.value =
            e.response?.data?.message || 'Error al cargar la orden para editar';
    }
}

// Computed: calculate difference between current cart and original order
const orderDiff = computed(() => {
    if (!props.editMode) return { items: [], total: 0 };

    const diffItems: Array<{
        product_id: number | null;
        variant_id?: number;
        warehouse_id: number;
        qty: number;
        qty_diff: number;
        price: number;
        tax_percent: number;
        seller_id?: number;
        is_custom_line?: boolean;
        custom_description?: string;
        is_new: boolean;
        order_item_id?: number;
    }> = [];

    let diffTotal = 0;

    for (const item of cart.value) {
        const originalKey = getOriginalItemKey({
            product_id: item.product_id,
            variant_id: item.variant_id ?? null,
            warehouse_id: item.warehouse_id ?? null,
            is_custom_line: item.is_custom_line,
            custom_description: item.custom_description,
        });
        const original = originalItems.value[originalKey];

        if (!original) {
            // New product (not in original order)
            const itemSubtotal = item.quantity * item.product_price;
            const safeTaxPercent = normalizeTaxPercent(item.tax_percent);
            const itemTax = itemSubtotal * (safeTaxPercent / 100);
            diffTotal += itemSubtotal + itemTax;

            diffItems.push({
                product_id: item.product_id,
                variant_id: item.variant_id,
                warehouse_id: Number(
                    item.warehouse_id ?? currentWarehouseId.value ?? 0,
                ),
                qty: item.quantity,
                qty_diff: item.quantity,
                price: item.product_price,
                tax_percent: safeTaxPercent,
                seller_id: item.seller_id,
                is_custom_line: !!item.is_custom_line,
                custom_description: item.custom_description,
                is_new: true,
            });
        } else if (item.quantity > original.qty) {
            // Quantity increased
            const qtyDiff = item.quantity - original.qty;
            const itemSubtotal = qtyDiff * item.product_price;
            const safeTaxPercent = normalizeTaxPercent(item.tax_percent);
            const itemTax = itemSubtotal * (safeTaxPercent / 100);
            diffTotal += itemSubtotal + itemTax;

            diffItems.push({
                product_id: item.product_id,
                variant_id: item.variant_id,
                warehouse_id: Number(
                    item.warehouse_id ?? currentWarehouseId.value ?? 0,
                ),
                qty: item.quantity,
                qty_diff: qtyDiff,
                price: item.product_price,
                tax_percent: safeTaxPercent,
                seller_id: item.seller_id,
                is_custom_line: !!item.is_custom_line,
                custom_description: item.custom_description,
                is_new: false,
                order_item_id: original.order_item_id,
            });
        }
        // If quantity <= original, no diff (we don't allow reducing in edit mode)
    }

    return { items: diffItems, total: Number(diffTotal.toFixed(2)) };
});

// Format elapsed time since order creation
const editOrderElapsedTime = computed(() => {
    if (!editOrderData.value?.created_at) return '';
    nowTick.value;
    const created = new Date(editOrderData.value.created_at);
    const now = new Date(nowTick.value);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0)
        return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffMins > 0)
        return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    return 'hace unos segundos';
});

const amountToCharge = computed(() => {
    if (props.editMode) {
        return Math.max(0, orderDiff.value.total);
    }
    return cartTotal.value;
});

const handleUpdateQuantity = (index: number, qty: number) => {
    const item = cart.value[index];
    if (!item) return;

    if (props.editMode) {
        const originalKey = getOriginalItemKey({
            product_id: item.product_id,
            variant_id: item.variant_id ?? null,
            warehouse_id: item.warehouse_id ?? null,
            is_custom_line: item.is_custom_line,
            custom_description: item.custom_description,
        });
        const original = originalItems.value[originalKey];
        if (original && qty < original.qty) {
            editError.value =
                'No se permite reducir cantidades en modo edición. Para reducciones usa devoluciones.';
            return;
        }
    }

    editError.value = null;
    updateQuantity(item.id, qty);
};

// Confirm edit order (add items / charge difference)
async function confirmEditOrder() {
    if (!props.orderId || orderDiff.value.items.length === 0) return;

    editLoading.value = true;
    editError.value = null;

    try {
        // Build items payload
        const items = orderDiff.value.items.map((item) => ({
            product_id: item.is_custom_line ? null : item.product_id,
            variant_id: item.variant_id ?? null,
            warehouse_id:
                Number(item.warehouse_id) ||
                Number(currentWarehouseId.value) ||
                1,
            qty: item.qty,
            price: item.price,
            tax_percent: normalizeTaxPercent(item.tax_percent),
            seller_id: item.seller_id ?? null,
            is_custom_line: !!item.is_custom_line,
            custom_description: item.is_custom_line
                ? item.custom_description
                : null,
        }));

        // Build payments array from current modal state
        const paymentsArray: Array<{
            method: string;
            amount: number;
            notes?: string;
        }> = [];

        if (amountReceived.value > 0) {
            const cashEffectiveAmount =
                localChange.value > 0
                    ? amountReceived.value - localChange.value
                    : amountReceived.value;
            if (cashEffectiveAmount > 0) {
                paymentsArray.push({
                    method: 'cash',
                    amount: cashEffectiveAmount,
                });
            }
        }

        for (const [methodId, amount] of Object.entries(electronicPayments)) {
            if (amount > 0) {
                paymentsArray.push({ method: methodId, amount: amount });
            }
        }

        if (storeCreditToApply.value > 0) {
            paymentsArray.push({
                method: 'store_credit',
                amount: storeCreditToApply.value,
                notes: 'Aplicado de saldo a favor del cliente',
            });
        }

        if (creditToCharge.value > 0 && selectedCustomer.value) {
            paymentsArray.push({
                method: 'credit',
                amount: creditToCharge.value,
                notes: 'Cobrado a crédito del cliente',
            });
        }

        // Call backend endpoint
        await apiClient.patch(`/sales-orders/${props.orderId}/add-items`, {
            items,
            payment: paymentsArray,
        });

        // Redirect to the order detail
        router.visit(`/sales-orders/${props.orderId}`);
    } catch (e: any) {
        console.error('Error processing edit order:', e);
        const errData = e.response?.data;
        if (Array.isArray(errData?.errors)) {
            editError.value = errData.errors.join('\n');
        } else {
            editError.value =
                errData?.message || 'Error al procesar la edición';
        }
    } finally {
        editLoading.value = false;
    }
}

// Print ticket modal state
const showPrintTicketModal = ref(false);
const lastOrderId = ref<number | null>(null);
const lastOrderNumber = ref<string>('');

// Product selection modal state
const selectedProductIds = ref<Set<number>>(new Set());

// Categories and brands for filters
interface Category {
    id: number;
    name: string;
}
interface Brand {
    id: number;
    name: string;
}
const categories = ref<Category[]>([]);
const brands = ref<Brand[]>([]);
const users = ref<{ id: number; name: string }[]>([]);

// Refs (searchInput kept for backward compat, posControlsRef is primary)
const searchInput = ref<HTMLInputElement>();
const quantityInput = ref<HTMLInputElement>();

// Format currency
const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);

const normalizeTaxPercent = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const extractApiErrorMessage = (err: any, fallback: string): string => {
    const errData = err?.response?.data;
    if (Array.isArray(errData?.errors)) {
        return errData.errors.join('\n');
    }

    if (errData?.errors && typeof errData.errors === 'object') {
        const nested = Object.values(errData.errors)
            .flatMap((v: any) => (Array.isArray(v) ? v : [String(v)]))
            .filter(Boolean);
        if (nested.length > 0) {
            return nested.join('\n');
        }
    }

    return errData?.message || fallback;
};

// Get helpers
const getProductPrice = (product: any): number =>
    product.pricing?.base_price ??
    product.default_variant?.pricing?.base_price ??
    0;

const getProductTaxRate = (product: any): number =>
    normalizeTaxPercent(
        product.pricing?.sale_tax_rate ??
            product.pricing?.tax_rate ??
            product.default_variant?.pricing?.sale_tax_rate ??
            product.default_variant?.pricing?.tax_rate ??
            0,
    );

const getProductStock = (product: any): number =>
    product.total_stock ?? product.default_variant?.total_stock ?? 0;

const getProductSKU = (product: any): string => {
    if (isClientMode()) return `#${product.id}`;
    return (
        product.sku_base ?? product.sku ?? product.default_variant?.sku ?? ''
    );
};

// Advanced filter state from ProductSearchModal
const modalMinPrice = ref<number | undefined>(undefined);
const modalMaxPrice = ref<number | undefined>(undefined);
const modalInStock = ref<boolean | undefined>(undefined);
const modalSort = ref<string | undefined>(undefined);
const modalCategoryIds = ref<number[] | undefined>(undefined);
const modalBrandIds = ref<number[] | undefined>(undefined);

// Build filters
const buildFilters = () => ({
    search: searchQuery.value || undefined,
    category_id: modalCategoryIds.value?.length
        ? modalCategoryIds.value
        : selectedCategoryId.value
          ? [selectedCategoryId.value]
          : undefined,
    brand_id: modalBrandIds.value?.length
        ? modalBrandIds.value
        : selectedBrandId.value
          ? [selectedBrandId.value]
          : undefined,
    warehouse_id: currentWarehouseId.value || undefined,
    min_price: modalMinPrice.value,
    max_price: modalMaxPrice.value,
    in_stock: modalInStock.value || undefined,
    sort: modalSort.value || undefined,
    per_page: 20,
});

// Current customer computed property
const selectedCustomer = computed(() => {
    if (!customer_id.value) return null;
    return customers.value.find((c) => c.id === customer_id.value);
});

const canCheckout = computed(() => cart.value.length > 0 && !loading.value);

// Smart Search: siempre mostrar modal para permitir selección (R42)
// showModal=false allows the initial onMounted load to pre-fetch without popping the modal
const performSearch = async (
    overrideQuery?: string,
    overrideQty?: number,
    showModal = true,
) => {
    const finalQuery = overrideQuery ?? searchQuery.value;
    // Permitir búsqueda vacía para listar productos (BUG-001 fix)
    const trimmedQuery = finalQuery?.trim() || '';

    isSearching.value = true;
    logAction('search', { query: trimmedQuery || '(todos)' });
    try {
        const filters = {
            ...buildFilters(),
            search: trimmedQuery || undefined,
        };
        await fetchProducts(filters);

        if (showModal && products.value.length > 0) {
            // R42: Siempre mostrar modal, incluso con 1 resultado
            selectedProductIds.value = new Set();
            // Pre-seleccionar si solo hay 1 resultado para facilitar agregar rápido
            if (products.value.length === 1) {
                selectedProductIds.value = new Set([products.value[0].id]);
            }
            showProductsModal.value = true;
        } else if (!showModal) {
            // Silent initial load — products are fetched but modal stays closed
        } else {
            // No results
            console.warn(
                'No products found for',
                trimmedQuery || '(búsqueda vacía)',
            );
        }
    } catch (err) {
        console.error('POS search error:', err);
    } finally {
        isSearching.value = false;
    }
};

const loadMoreProducts = async () => {
    if (!hasNextPage.value || productsLoading.value) return;

    logAction('search_load_more', { query: searchQuery.value });
    try {
        const filters = {
            ...buildFilters(),
            search: searchQuery.value || undefined,
        };
        await fetchMoreProducts(filters);
    } catch (err) {
        console.error('POS load more error:', err);
    }
};

const handleControlsSearch = (data: {
    query: string;
    quantity: number;
    category_id?: number;
    brand_id?: number;
}) => {
    searchQuery.value = data.query;
    quantity.value = data.quantity;
    if (data.category_id !== undefined)
        selectedCategoryId.value = data.category_id;
    if (data.brand_id !== undefined) selectedBrandId.value = data.brand_id;
    performSearch(data.query, data.quantity);
};

// R43: Handle search-in-modal — re-run product fetch without closing modal (with advanced filters)
const handleModalSearch = (filters: {
    query: string;
    category_ids?: number[];
    brand_ids?: number[];
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort?: string;
}) => {
    searchQuery.value = filters.query;
    modalCategoryIds.value = filters.category_ids;
    modalBrandIds.value = filters.brand_ids;
    modalMinPrice.value = filters.min_price;
    modalMaxPrice.value = filters.max_price;
    modalInStock.value = filters.in_stock;
    modalSort.value = filters.sort;
    performSearch(filters.query);
};

// Add a product to cart — opens VariantSelectModal if multiple variants exist
// Products with multiple variants are enqueued — they are processed one by one via variantQueue
const addProductToCart = (product: any, overrideQty?: number) => {
    const variants = product.variants ?? [];
    const qtyToUse = overrideQty ?? quantity.value;

    if (variants.length === 1) {
        // Single variant: add directly
        attemptAddToCartWithStockFallback(
            product,
            variants[0],
            qtyToUse,
            currentWarehouseId.value || undefined,
        );
        searchQuery.value = '';
        nextTick(() => searchInput.value?.focus());
    } else if (variants.length > 1) {
        // Multiple variants: enqueue product for variant selection
        variantQueue.value.push(product);
        showProductsModal.value = false;
        // Open modal if it's the only/first item in queue
        if (variantQueue.value.length === 1) {
            showVariantModal.value = true;
        }
    } else {
        // Fallback: use default_variant if variants array not loaded
        const fallback = product.default_variant ?? null;
        attemptAddToCartWithStockFallback(
            product,
            fallback,
            qtyToUse,
            currentWarehouseId.value || undefined,
        );
        searchQuery.value = '';
        nextTick(() => searchInput.value?.focus());
    }
};

// Handler when cashier confirms multi-selected variants for the current product in queue
const onVariantsSelected = (
    selections: Array<{ variant: any; quantity: number }>,
) => {
    const product = variantQueue.value[0];
    if (product) {
        selections.forEach(({ variant, quantity: qty }) => {
            attemptAddToCartWithStockFallback(
                product,
                variant,
                qty,
                currentWarehouseId.value || undefined,
            );
        });
    }
    // Dequeue the current product
    variantQueue.value.shift();
    if (variantQueue.value.length > 0) {
        // There are more products in queue — keep modal open with next product
        // (pendingProduct computed will auto-update to queue[0])
    } else {
        // Queue exhausted — close modal
        showVariantModal.value = false;
        searchQuery.value = '';
        nextTick(() => searchInput.value?.focus());
    }
};

// Close variant modal and clear queue
const closeVariantModal = () => {
    showVariantModal.value = false;
    variantQueue.value = [];
};

// Add selected products from modal — products with multiple variants are enqueued
const addSelectedProducts = (ids: Set<number>) => {
    const selected = products.value.filter((p) => ids.has(p.id));
    showProductsModal.value = false;
    searchQuery.value = '';
    quantity.value = 1;
    // Separate single-variant products (add directly) from multi-variant (enqueue)
    selected.forEach((p) => addProductToCart(p));
    // If any multi-variant products were enqueued, open the modal
    if (variantQueue.value.length > 0) {
        showVariantModal.value = true;
    } else {
        searchInput.value?.focus();
    }
};

const addSelectedVariants = (selections: ProductVariantSelection[]) => {
    showProductsModal.value = false;
    searchQuery.value = '';
    quantity.value = 1;

    selections.forEach(({ product, variant, quantity: selectedQuantity }) => {
        attemptAddToCartWithStockFallback(
            product,
            variant,
            selectedQuantity,
            currentWarehouseId.value || undefined,
        );
    });

    nextTick(() => searchInput.value?.focus());
};

// ── Inline Search Handlers ─────────────────────────────────────────────────
const handleInlineSelect = (product: any) => {
    // Product with single variant (or default variant) — add directly
    const variants = product.variants ?? [];
    const variant =
        variants.length === 1 ? variants[0] : (product.default_variant ?? null);
    attemptAddToCartWithStockFallback(
        product,
        variant,
        1,
        currentWarehouseId.value || undefined,
    );
};

const handleInlineVariantNeeded = (product: any) => {
    // Product with multiple variants — enqueue for variant selection modal
    variantQueue.value.push(product);
    if (variantQueue.value.length === 1) {
        showVariantModal.value = true;
    }
};

const handleOpenFullSearch = (filters?: {
    query?: string;
    category_id?: number;
    brand_id?: number;
}) => {
    searchQuery.value = filters?.query ?? '';
    selectedCategoryId.value = filters?.category_id;
    selectedBrandId.value = filters?.brand_id;
    performSearch(searchQuery.value, quantity.value);
};

// Fetch categories and brands
const fetchCategories = async () => {
    try {
        const res = await apiClient.get('/categories');
        categories.value = res.data.data ?? res.data ?? [];
    } catch (e) {
        console.error('Error loading categories', e);
    }
};

const fetchBrands = async () => {
    try {
        const res = await apiClient.get('/brands');
        brands.value = res.data.data ?? res.data ?? [];
    } catch (e) {
        console.error('Error loading brands', e);
    }
};

const fetchUsers = async () => {
    try {
        const res = await apiClient.get('/users');
        users.value = res.data.data ?? res.data ?? [];
    } catch (e) {
        console.error('Error loading users', e);
    }
};

// Keyboard shortcuts
const handleKeyboard = (e: KeyboardEvent) => {
    if (
        showPaymentModal.value ||
        showProductsModal.value ||
        showVariantModal.value
    )
        return;

    switch (e.key) {
        case 'F1':
            e.preventDefault();
            if (canUseProductSearch.value) {
                inlineSearchRef.value?.focusSearch();
            }
            break;
        case 'F2':
            e.preventDefault();
            quantityInput.value?.focus();
            break;
        case 'F4':
            e.preventDefault();
            handleClearCurrentCart();
            break;
        case 'F10':
            e.preventDefault();
            if (
                !props.quoteMode &&
                isSessionOpen.value &&
                cart.value.length > 0
            )
                openPaymentModal('cash');
            break;
        case 'F12':
            e.preventDefault();
            showShortcutsHelp.value = !showShortcutsHelp.value;
            break;
    }
};

// Payment (Cash/Card/Transfer/Multiple) - Now unified
const openPaymentModal = (method: 'cash' | 'card' | 'transfer' = 'cash') => {
    if (cart.value.length > 0) {
        // Reset all amounts and clear previous errors
        error.value = null;
        showPaymentModal.value = true;
    }
};

// Handle unified payment panel finish
const handleUnifiedPaymentFinish = async (
    payments: Array<{
        method: string;
        amount: number;
        reference_number?: string | null;
        notes?: string | null;
    }>,
) => {
    if (props.editMode) {
        // For edit mode, use the existing confirmEditOrder with the payments array
        // Build payments for edit mode
        const paymentsArray = payments.map((p) => ({
            method: p.method,
            amount: p.amount,
            reference_number: p.reference_number ?? undefined,
            notes:
                p.notes ??
                (p.method === 'store_credit'
                    ? 'Aplicado de saldo a favor del cliente'
                    : p.method === 'credit'
                      ? 'Cobrado a crédito del cliente'
                      : undefined),
        }));

        // Temporarily store payments for confirmEditOrder
        amountReceived.value = 0;
        Object.keys(electronicPayments).forEach(
            (k) => delete electronicPayments[k],
        );
        storeCreditToApply.value = 0;

        for (const p of payments) {
            if (p.method === 'cash') {
                amountReceived.value = p.amount;
            } else if (p.method === 'store_credit') {
                storeCreditToApply.value = p.amount;
            } else if (p.method !== 'credit') {
                electronicPayments[p.method] = p.amount;
            }
        }

        await confirmEditOrder();
        if (!editError.value) {
            closePaymentModal();
        }
        return;
    }

    // Clear any previous payment errors before attempting new payment
    error.value = null;

    if (!validateCartStock('sale')) {
        alert(error.value || 'Stock insuficiente para completar la venta.');
        return;
    }

    // Validate standard items have valid product_id (custom lines are allowed to be null)
    const invalidItems = cart.value.filter(
        (item: any) =>
            !item.is_custom_line && (!item.product_id || item.product_id <= 0),
    );
    if (invalidItems.length > 0) {
        console.error('Invalid items detected:', invalidItems);
        error.value = `⚠️ Carrito inválido: ${invalidItems.length} producto(s) con ID inválido. Revisa tu carrito y vuelve a agregar los productos.`;
        return;
    }

    // Log items being sent to backend for debugging
    console.log(
        'Payment attempt - Cart items to be processed:',
        cart.value.map((item: any) => ({
            product_id: item.product_id,
            is_custom_line: !!item.is_custom_line,
            custom_description: item.custom_description,
            product_name: item.product_name,
            quantity: item.quantity,
        })),
    );

    // Convert payments from unified panel to backend format
    const paymentsArray = payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference_number: p.reference_number ?? undefined,
        notes:
            p.notes ??
            (p.method === 'store_credit'
                ? 'Aplicado de saldo a favor del cliente'
                : p.method === 'credit'
                  ? 'Cobrado a crédito del cliente'
                  : undefined),
    }));

    const result = await processSale(paymentsArray);
    if (result) {
        closePaymentModal();
        lastOrderId.value = result.id ?? null;
        lastOrderNumber.value = result.order_number ?? '';
        showPrintTicketModal.value = true;
        searchInput.value?.focus();
    }
};

// Payment (Credit) — Uses the new AddPaymentModal for partial payments
const openCreditSale = () => {
    if (cart.value.length > 0 && selectedCustomer.value) {
        pendingOrderTotal.value = cartTotal.value;
        pendingOrderAmountPaid.value = 0;
        error.value = null;
        showAddPaymentModal.value = true;
    }
};

const closePaymentModal = () => {
    showPaymentModal.value = false;
    error.value = null;
};

// Detect if the active session was loaded from a SalesQuote
const isQuoteSession = computed(() => !!activeSession.value?.source_quote_id);

// Save changes back to the originating SalesQuote (update it in place)
const saveQuoteChangesLoading = ref(false);

const handleSaveQuoteChanges = async () => {
    const quoteId = activeSession.value?.source_quote_id;
    if (!quoteId) return;
    if (cart.value.length === 0) {
        alert('El carrito está vacío, agrega productos antes de guardar.');
        return;
    }
    // Collect stock warnings but do NOT block — show as advisory
    const stockIssues = getStockWarnings('quote');
    if (stockIssues.length > 0) {
        const proceed = confirm(
            `Advertencia de stock:\n- ${stockIssues.join('\n- ')}\n\n¿Deseas continuar?`,
        );
        if (!proceed) return;
    }
    saveQuoteChangesLoading.value = true;
    try {
        const items = cart.value.map((item: any) => ({
            product_id: item.is_custom_line ? null : item.product_id,
            variant_id: item.variant_id ?? null,
            warehouse_id: item.warehouse_id ?? currentWarehouseId.value,
            quantity: item.quantity,
            unit_price: item.product_price,
            discount_percent: item.discount_percent ?? 0,
            tax_percent: normalizeTaxPercent(item.tax_percent),
            is_custom_line: !!item.is_custom_line,
            custom_description: item.is_custom_line
                ? item.custom_description || item.product_name
                : null,
        }));

        const res = await apiClient.put(`/sales-quotes/${quoteId}`, {
            customer_id: customer_id.value ?? null,
            warehouse_id: currentWarehouseId.value ?? null,
            items,
        });

        const apiWarnings = res.data?.warnings;
        if (
            apiWarnings &&
            Array.isArray(apiWarnings) &&
            apiWarnings.length > 0
        ) {
            const warningMsgs = apiWarnings
                .map((w: any) => w.message || JSON.stringify(w))
                .join('\n- ');
            alert(
                `Cotización actualizada correctamente.\n\nAdvertencias de stock:\n- ${warningMsgs}`,
            );
        } else {
            alert('Cotización actualizada correctamente.');
        }
        searchInput.value?.focus();
    } catch (e: any) {
        alert(extractApiErrorMessage(e, 'Error al actualizar la cotización'));
    } finally {
        saveQuoteChangesLoading.value = false;
    }
};

// Save current cart as a Sales Quote (draft)
const saveQuoteLoading = ref(false);

const handleSaveQuote = async () => {
    if (cart.value.length === 0) {
        alert('Agrega productos al carrito antes de guardar una cotización.');
        return;
    }
    // Collect stock warnings but do NOT block — show as advisory
    const stockIssues = getStockWarnings('quote');
    if (stockIssues.length > 0) {
        const proceed = confirm(
            `Advertencia de stock:\n- ${stockIssues.join('\n- ')}\n\n¿Deseas continuar?`,
        );
        if (!proceed) return;
    }
    saveQuoteLoading.value = true;
    try {
        const items = cart.value.map((item: any) => ({
            product_id: item.is_custom_line ? null : item.product_id,
            variant_id: item.variant_id ?? null,
            warehouse_id: item.warehouse_id ?? currentWarehouseId.value,
            quantity: item.quantity,
            unit_price: item.product_price,
            discount_percent: item.discount_percent ?? 0,
            tax_percent: normalizeTaxPercent(item.tax_percent),
            is_custom_line: !!item.is_custom_line,
            custom_description: item.is_custom_line
                ? item.custom_description || item.product_name
                : null,
        }));

        const res = await apiClient.post('/sales-quotes/from-pos', {
            customer_id: customer_id.value ?? null,
            warehouse_id: currentWarehouseId.value ?? null,
            items,
        });

        const quoteNumber = res.data?.data?.quote_number ?? '';
        const apiWarnings = res.data?.warnings || res.data?.data?.warnings;

        clearCart();

        let alertMsg = `Cotización ${quoteNumber} guardada correctamente.`;
        if (
            apiWarnings &&
            Array.isArray(apiWarnings) &&
            apiWarnings.length > 0
        ) {
            const warningMsgs = apiWarnings
                .map((w: any) => w.message || JSON.stringify(w))
                .join('\n- ');
            alertMsg += `\n\nAdvertencias de stock:\n- ${warningMsgs}`;
        }

        const shouldNavigate = confirm(
            `${alertMsg}\n\n¿Deseas ir al listado de cotizaciones?`,
        );
        if (shouldNavigate) {
            window.location.href = '/sales-quotes';
        }
    } catch (e: any) {
        alert(extractApiErrorMessage(e, 'Error al guardar la cotización'));
    } finally {
        saveQuoteLoading.value = false;
    }
};

// Handle credit/partial payment submission
const handleCreditPaymentSubmit = async (payload: {
    amount: number;
    method: string;
    notes?: string;
}) => {
    addPaymentLoading.value = true;
    addPaymentError.value = null;

    try {
        paymentMethod.value = payload.method as any;
        amountReceived.value = payload.amount;
        notes.value = payload.notes || '';

        // Create the sale
        const success = await processSale();

        if (success) {
            showAddPaymentModal.value = false;
            lastOrderId.value = success.id ?? null;
            lastOrderNumber.value = success.order_number ?? '';
            showPrintTicketModal.value = true;
            searchInput.value?.focus();
        } else {
            addPaymentError.value = error.value || 'Error al procesar la venta';
        }
    } catch (e: any) {
        addPaymentError.value = e.response?.data?.message || 'Error inesperado';
    } finally {
        addPaymentLoading.value = false;
    }
};

// Session Handlers
const handleOpenSession = async (amount: number) => {
    sessionActionLoading.value = true;
    const success = await openSession(
        amount,
        currentWarehouseId.value ?? undefined,
    );
    sessionActionLoading.value = false;
    if (success) {
        forceShowOpenSessionModal.value = false;
        error.value = null;
        searchInput.value?.focus();
    }
};

const cashMovementLoading = ref(false);
const cashMovementError = ref<string | null>(null);

const handleCashMovement = async (payload: {
    type: 'in' | 'out';
    amount: number;
    reason: string;
    notes: string;
}) => {
    cashMovementLoading.value = true;
    cashMovementError.value = null;
    const success = await addCashMovement(payload);
    cashMovementLoading.value = false;
    if (success) {
        showCashMovementModal.value = false;
        // Refresh session summary to update expected cash
        await checkCurrentSession(currentWarehouseId.value ?? undefined);
    } else {
        cashMovementError.value = sessionError.value;
    }
};

let returnSessionId: string | null = null;
let editSessionId: string | null = null;

onMounted(async () => {
    window.addEventListener('keydown', handleKeyboard);

    // UX-001: Prevent accidental tab close or refresh when cart has items
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (cart.value.length > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // UX-001: Intercept Inertia navigation when cart has items
    const removeInertiaListener = router.on('before', (event) => {
        if (cart.value.length > 0) {
            // Allow navigation when explicitly approved (e.g. after sale completes)
            const target = (event as any)?.detail?.visit?.url?.pathname || '';
            // Allow visits to the same POS page or order pages after sale
            if (target.includes('/sales-orders/') || target === '/pos')
                return true;
            if (
                !window.confirm(
                    'Tienes productos en el carrito. ¿Seguro que deseas salir? Los cambios no guardados se perderán.',
                )
            ) {
                return false;
            }
        }
        return true;
    });

    // Store cleanup functions
    (window as any).__posCleanup = {
        handleBeforeUnload,
        removeInertiaListener,
    };

    // Clear any previous errors from past sessions
    error.value = null;

    await initWarehouse();

    // Skip session check in quote mode, return mode, and edit mode — no cash register needed
    if (!props.quoteMode && !props.returnMode && !props.editMode) {
        // Session source of truth comes from backend before showing open-session flow
        await checkCurrentSession(currentWarehouseId.value ?? undefined);
    }

    await Promise.all([
        fetchCategories(),
        fetchBrands(),
        fetchCustomers({ per_page: 50 } as any),
        fetchUsers(),
        fetchWarehouses({} as any),
    ]);

    // Initial product load with warehouse context
    if (!currentWarehouseId.value) {
        // If no warehouse selected/persisted, default to first available or wait for user
        if (settings.value?.default_warehouse_id) {
            setWarehouse(settings.value.default_warehouse_id);
        }
    } else if (!props.returnMode && !props.editMode) {
        performSearch(undefined, undefined, false);
    }

    // In return mode, load the order for return
    if (props.returnMode && props.orderId) {
        sessionStorage.setItem('pos_previous_session', activeSessionId.value);

        // Clean up any stale return sessions
        allSessions.value = allSessions.value.filter(
            (s: any) => !s.name.includes('Devolución en Curso'),
        );

        createNewCart('Devolución en Curso');
        returnSessionId = activeSessionId.value;

        await loadOrderForReturn(props.orderId);
    }

    // In edit mode, load the order for editing
    if (props.editMode && props.orderId) {
        sessionStorage.setItem('pos_previous_session', activeSessionId.value);

        // Clean up any stale edit sessions
        allSessions.value = allSessions.value.filter(
            (s: any) => !s.name.includes('Editando Orden'),
        );

        createNewCart(`Editando Orden #${props.orderId}`);
        editSessionId = activeSessionId.value;

        await loadOrderForEdit(props.orderId);
    }

    // In quote mode with an existing quote, auto-load it into the cart
    if (props.quoteMode && props.quoteId) {
        try {
            const res = await apiClient.get(`/sales-quotes/${props.quoteId}`);
            const q = res.data;
            loadQuoteAsSession({
                id: q.id,
                quote_number: q.quote_number,
                customer_id: q.customer?.id ?? null,
                items: (q.items ?? []).map((item: any) => ({
                    product_id: item.product_id ?? null,
                    product_name: item.product_name,
                    product_sku: item.product_sku,
                    variant_id: item.variant_id ?? null,
                    warehouse_id: item.warehouse_id ?? null,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount_percent: item.discount_percent,
                    tax_percent: normalizeTaxPercent(item.tax_percent),
                    subtotal: item.subtotal,
                    tax_amount: item.tax_amount,
                    total: item.total,
                    is_custom_line: !!item.is_custom_line,
                    custom_description: item.custom_description ?? null,
                    variant: item.variant ?? null,
                })),
            });
        } catch (e: any) {
            console.error('Error loading quote:', e);
            error.value =
                e.response?.data?.message || 'Error al cargar la cotización';
        }
    }

    elapsedTimer = setInterval(() => {
        nowTick.value = Date.now();
    }, 60000);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyboard);

    // UX-001: Cleanup beforeunload and Inertia listener
    const cleanup = (window as any).__posCleanup;
    if (cleanup) {
        window.removeEventListener('beforeunload', cleanup.handleBeforeUnload);
        if (typeof cleanup.removeInertiaListener === 'function')
            cleanup.removeInertiaListener();
        delete (window as any).__posCleanup;
    }

    if (elapsedTimer) {
        clearInterval(elapsedTimer);
        elapsedTimer = null;
    }

    if (props.returnMode && returnSessionId) {
        // Silently remove the return session
        allSessions.value = allSessions.value.filter(
            (s: any) => s.id !== returnSessionId,
        );

        // Restore the previous session
        const prevId = sessionStorage.getItem('pos_previous_session');
        if (prevId) {
            const exists = allSessions.value.some((s: any) => s.id === prevId);
            if (exists) {
                activeSessionId.value = prevId;
            } else if (allSessions.value.length > 0) {
                activeSessionId.value = allSessions.value[0].id;
            }
            sessionStorage.removeItem('pos_previous_session');
        }
    }

    if (props.editMode && editSessionId) {
        // Silently remove the edit session
        allSessions.value = allSessions.value.filter(
            (s: any) => s.id !== editSessionId,
        );

        // Restore the previous session
        const prevId = sessionStorage.getItem('pos_previous_session');
        if (prevId) {
            const exists = allSessions.value.some((s: any) => s.id === prevId);
            if (exists) {
                activeSessionId.value = prevId;
            } else if (allSessions.value.length > 0) {
                activeSessionId.value = allSessions.value[0].id;
            }
            sessionStorage.removeItem('pos_previous_session');
        }
    }
});
</script>

<template>
    <Head
        :title="props.quoteMode ? 'Editor de Cotización' : 'Punto de Venta'"
    />

    <div
        class="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[#F8F9FB] text-gray-900 dark:bg-background dark:text-foreground"
        style="font-family: 'Inter', sans-serif"
    >
        <!-- Return Mode Header -->
        <div
            v-if="props.returnMode"
            class="z-20 shrink-0 bg-orange-500 px-6 py-4 text-white shadow-sm"
        >
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button
                        @click="router.visit(`/sales-orders/${props.orderId}`)"
                        class="rounded-lg p-2 transition hover:bg-orange-600"
                    >
                        <svg
                            class="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                    <div>
                        <h1 class="text-xl font-bold">Devolución</h1>
                        <p class="text-sm text-orange-100">
                            Orden #{{
                                returnOrderData?.order_number || props.orderId
                            }}
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm text-orange-100">Total a devolver</p>
                    <p class="text-2xl font-bold">
                        {{ formatCurrency(Math.abs(cartTotal)) }}
                    </p>
                </div>
            </div>
        </div>

        <!-- Edit Mode Header -->
        <div
            v-if="props.editMode"
            class="z-20 shrink-0 bg-blue-600 px-6 py-4 text-white shadow-sm"
        >
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button
                        @click="router.visit(`/sales-orders/${props.orderId}`)"
                        class="rounded-lg p-2 transition hover:bg-blue-700"
                    >
                        <svg
                            class="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                    <div>
                        <h1 class="text-xl font-bold">Editando Orden</h1>
                        <p class="text-sm text-blue-100">
                            #{{ editOrderData?.order_number || props.orderId }}
                            <span class="ml-2 opacity-75">{{
                                editOrderElapsedTime
                            }}</span>
                            <span
                                v-if="editOrderData?.created_at"
                                class="ml-1 text-xs opacity-60"
                            >
                                ({{
                                    new Date(
                                        editOrderData.created_at,
                                    ).toLocaleDateString('es-MX', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })
                                }})
                            </span>
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <p class="text-xs text-blue-200">Cliente</p>
                        <p class="text-sm font-medium">
                            {{ editOrderData?.customer_name || 'Sin cliente' }}
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-blue-200">Total original</p>
                        <p class="text-sm font-medium">
                            {{ formatCurrency(editOrderData?.total || 0) }}
                        </p>
                    </div>
                    <div class="border-l border-blue-500 pl-6 text-right">
                        <p class="text-xs text-blue-200">Diferencia a cobrar</p>
                        <p class="text-2xl font-bold">
                            {{ formatCurrency(orderDiff.total) }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- R41: Quote Mode Header -->
        <div
            v-if="props.quoteMode"
            class="z-20 shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white shadow-sm"
        >
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button
                        @click="router.visit('/sales-quotes')"
                        class="rounded-lg p-2 transition hover:bg-purple-700"
                    >
                        <svg
                            class="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                    <div class="flex items-center gap-2">
                        <FileText class="h-6 w-6 text-purple-200" />
                        <div>
                            <h1 class="text-xl font-bold">
                                Editor de Cotización
                            </h1>
                            <p class="text-sm text-purple-200">
                                <template
                                    v-if="
                                        (activeSession as any)?.source_quote_id
                                    "
                                >
                                    Cotización #{{
                                        (activeSession as any)?.quote_number ||
                                        (activeSession as any)?.source_quote_id
                                    }}
                                </template>
                                <template v-else> NUEVA COTIZACIÓN </template>
                            </p>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <p class="text-xs text-purple-200">Productos</p>
                        <p class="text-lg font-bold">{{ cartItemCount }}</p>
                    </div>
                    <div class="border-l border-purple-400/40 pl-6 text-right">
                        <p class="text-xs text-purple-200">Total Cotización</p>
                        <p class="text-2xl font-bold">
                            {{ formatCurrency(cartTotal) }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Header - Fixed Height (hidden in quoteMode, returnMode, and editMode — no cash register needed) -->
        <div
            v-if="!props.quoteMode && !props.returnMode && !props.editMode"
            class="relative z-20 shrink-0 shadow-sm"
        >
            <CashRegisterStatus
                :hasOpenSession="isSessionOpen"
                @request-open="forceShowOpenSessionModal = true"
            />
            <!-- We use the existing modal OpenSessionModal to actually process the opening -->
            <OpenSessionModal
                :show="
                    (!isCheckingSession && !isSessionOpen) ||
                    forceShowOpenSessionModal
                "
                :loading="sessionActionLoading"
                :error="sessionError"
                @submit="handleOpenSession"
                @close="forceShowOpenSessionModal = false"
            />
        </div>

        <!-- Main Content - Flex to fill remaining height -->
        <main
            class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6 xl:flex-row"
        >
            <!-- R45: Filter sidebar now lives inside ProductSearchModal -->

            <!-- Left Column: Controls & Product List (Grows to fill space) -->
            <div
                class="flex h-full min-w-0 flex-[3] flex-col gap-4 overflow-hidden"
            >
                <!-- Hide search controls in return mode -->
                <div
                    v-if="!props.returnMode && canUseProductSearch"
                    class="shrink-0"
                >
                    <POSInlineSearch
                        ref="inlineSearchRef"
                        :categories="categories"
                        :brands="brands"
                        :warehouse-id="currentWarehouseId"
                        @product-selected="handleInlineSelect"
                        @product-needs-variant="handleInlineVariantNeeded"
                        @open-full-search="handleOpenFullSearch"
                    />
                    <div class="mt-2 flex justify-end">
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                            @click="showCustomLineModal = true"
                        >
                            <FileText class="h-3.5 w-3.5" />
                            Linea miscelanea
                        </button>
                    </div>
                </div>

                <!-- Multi-Cart Tabs (hide in return mode and edit mode) -->
                <div
                    v-if="
                        allSessions.length > 0 &&
                        !props.returnMode &&
                        !props.editMode
                    "
                    class="flex shrink-0 items-center gap-1.5 overflow-x-auto rounded-xl bg-gray-100 px-1 py-1.5 dark:bg-muted/50"
                >
                    <button
                        v-for="s in allSessions"
                        :key="s.id"
                        @click="switchCart(s.id)"
                        class="group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all"
                        :class="
                            s.id === activeSessionId
                                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200 dark:bg-card dark:text-indigo-400 dark:ring-indigo-900'
                                : 'text-gray-500 hover:bg-white/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-card dark:hover:text-gray-200'
                        "
                    >
                        <span
                            class="h-2 w-2 shrink-0 rounded-full"
                            :class="
                                s.cart.length > 0
                                    ? 'bg-indigo-500'
                                    : 'bg-gray-300'
                            "
                        ></span>
                        {{ s.name }}
                        <span
                            v-if="s.cart.length"
                            class="text-[10px] tabular-nums opacity-60"
                            >({{ s.cart.length }})</span
                        >
                        <!-- Close tab -->
                        <span
                            v-if="allSessions.length > 1"
                            @click.stop="removeCart(s.id)"
                            class="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                            >&times;</span
                        >
                    </button>
                    <!-- New cart button -->
                    <button
                        @click="createNewCart()"
                        class="flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-gray-400 transition-all hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:text-primary"
                        title="Nueva venta"
                    >
                        +
                    </button>
                </div>

                <!-- R44: Cart search and sort toolbar -->
                <div
                    v-if="cart.length > 2"
                    class="flex shrink-0 items-center gap-2 px-1"
                >
                    <div class="relative flex-1">
                        <Search
                            class="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            v-model="cartSearchQuery"
                            type="text"
                            placeholder="Buscar en carrito…"
                            class="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-3 pl-8 text-xs text-gray-700 transition-shadow placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none dark:border-border dark:bg-muted dark:text-foreground"
                        />
                    </div>
                    <div class="flex items-center gap-1">
                        <button
                            v-for="opt in cartSortOptions"
                            :key="opt.key"
                            @click="toggleCartSort(opt.key)"
                            class="flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                            :class="
                                cartSortBy === opt.key
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-muted'
                            "
                        >
                            {{ opt.label }}
                            <ArrowUpDown
                                v-if="cartSortBy !== opt.key"
                                class="h-3 w-3 opacity-40"
                            />
                            <svg
                                v-else-if="cartSortDir === 'asc'"
                                class="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M5 15l7-7 7 7"
                                />
                            </svg>
                            <svg
                                v-else
                                class="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                        <button
                            v-if="cartSortBy !== 'default' || cartSearchQuery"
                            @click="
                                cartSortBy = 'default';
                                cartSortDir = 'asc';
                                cartSearchQuery = '';
                            "
                            class="rounded-md px-2 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>

                <div class="relative min-h-0 flex-1">
                    <ProductTable
                        :items="
                            cartSearchQuery || cartSortBy !== 'default'
                                ? filteredAndSortedCart
                                : cart
                        "
                        :users="users"
                        :products="products"
                        :client-mode="isClientMode()"
                        :warehouse-id="currentWarehouseId"
                        :return-mode="returnMode"
                        :can-edit-seller="canEditSeller"
                        @update-quantity="
                            (idx, qty) => handleUpdateQuantity(idx, qty)
                        "
                        @remove="(idx) => removeItem(cart[idx].id)"
                        @update-item-tax="(id, tax) => updateItemTax(id, tax)"
                        @toggle-item-tax-exempt="
                            (id) => toggleItemTaxExempt(id)
                        "
                        @update-item-seller="
                            (id, sellerId) => updateItemSeller(id, sellerId)
                        "
                        @update-item-notes="
                            (id, noteText) => updateItemNotes(id, noteText)
                        "
                        @update-item-price="
                            (id, price) => updateItemPrice(id, price)
                        "
                        @update-item-discount="
                            (id, discount) => updateDiscount(id, discount)
                        "
                        @view-details="
                            (productId) => openProductDetail(productId)
                        "
                        @reorder="reorderCart"
                        @reorder-success="handleReorderSuccess"
                    />
                </div>
            </div>

            <!-- Right Column: Summary & Actions -->
            <div
                class="flex h-full max-w-sm min-w-[300px] flex-1 shrink-0 flex-col overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="mb-4 shrink-0">
                    <SummarySection
                        :subtotal="cartSubtotal"
                        :taxAmount="cartTax"
                        :total="cartTotal"
                        :discountAmount="cartDiscount"
                        :customerId="customer_id"
                        :sellerId="seller_id"
                        :customers="customers"
                        :users="users"
                        :can-edit-seller="canEditSeller"
                        @update:customerId="(v) => (customer_id = v)"
                        @update:sellerId="(v) => (seller_id = v)"
                        @open-quick-customer="showQuickCustomerModal = true"
                    />
                </div>
                <div
                    v-if="error && !props.returnMode && !props.editMode"
                    class="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm whitespace-pre-line text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                >
                    <div class="flex items-start gap-2">
                        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{{ error }}</span>
                    </div>
                </div>
                <div class="mt-auto shrink-0 pt-4">
                    <!-- Return Mode: Show Confirm Return button -->
                    <div v-if="props.returnMode" class="space-y-3">
                        <div
                            v-if="returnError"
                            class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                        >
                            {{ returnError }}
                        </div>
                        <button
                            @click="confirmReturn"
                            :disabled="returnLoading || cart.length === 0"
                            class="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-orange-500 text-lg font-bold text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md active:scale-[0.98] disabled:bg-gray-300 dark:disabled:bg-muted"
                        >
                            <svg
                                v-if="returnLoading"
                                class="h-5 w-5 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                ></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            <span v-else>Confirmar Devolución</span>
                        </button>
                        <button
                            @click="
                                router.visit(`/sales-orders/${props.orderId}`)
                            "
                            class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-border dark:text-gray-400 dark:hover:bg-muted"
                        >
                            Cancelar
                        </button>
                    </div>

                    <!-- Edit Mode: Show Confirm Edit button or Payment Modal -->
                    <div v-else-if="props.editMode" class="space-y-3">
                        <div
                            v-if="editError"
                            class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                        >
                            {{ editError }}
                        </div>

                        <!-- Show diff summary -->
                        <div
                            v-if="orderDiff.items.length > 0"
                            class="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20"
                        >
                            <p
                                class="mb-2 text-sm font-medium text-blue-700 dark:text-blue-300"
                            >
                                Cambios a aplicar:
                            </p>
                            <ul
                                class="space-y-1 text-xs text-blue-600 dark:text-blue-400"
                            >
                                <li
                                    v-for="(item, idx) in orderDiff.items"
                                    :key="idx"
                                >
                                    {{ item.is_new ? '+' : '↑' }}
                                    {{ item.qty_diff }}x ${{
                                        item.price.toFixed(2)
                                    }}
                                    <span v-if="!item.is_new" class="opacity-60"
                                        >(qty aumentada)</span
                                    >
                                </li>
                            </ul>
                            <div
                                class="mt-3 flex items-center justify-between border-t border-blue-200 pt-3 dark:border-blue-700"
                            >
                                <span
                                    class="text-sm font-semibold text-blue-700 dark:text-blue-300"
                                    >Total diferencia:</span
                                >
                                <span
                                    class="text-xl font-bold text-blue-600 dark:text-blue-400"
                                    >{{ formatCurrency(orderDiff.total) }}</span
                                >
                            </div>
                        </div>

                        <!-- No changes message -->
                        <div
                            v-else
                            class="rounded-xl bg-gray-50 p-4 text-center dark:bg-muted"
                        >
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                No se han realizado cambios a la orden.
                            </p>
                        </div>

                        <!-- Action buttons -->
                        <button
                            v-if="orderDiff.total > 0"
                            @click="openPaymentModal('cash')"
                            :disabled="editLoading"
                            class="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:bg-gray-300 dark:disabled:bg-muted"
                        >
                            <svg
                                v-if="editLoading"
                                class="h-5 w-5 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                ></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            <span v-else
                                >Cobrar Diferencia
                                {{ formatCurrency(orderDiff.total) }}</span
                            >
                        </button>

                        <button
                            v-else-if="orderDiff.items.length > 0"
                            @click="confirmEditOrder"
                            :disabled="editLoading"
                            class="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:bg-gray-300 dark:disabled:bg-muted"
                        >
                            <svg
                                v-if="editLoading"
                                class="h-5 w-5 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                ></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            <span v-else>Guardar cambios</span>
                        </button>

                        <button
                            v-else-if="orderDiff.items.length === 0"
                            disabled
                            class="flex h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-gray-300 text-lg font-bold text-gray-500 dark:bg-muted"
                        >
                            Sin cambios
                        </button>

                        <button
                            @click="
                                router.visit(`/sales-orders/${props.orderId}`)
                            "
                            class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-border dark:text-gray-400 dark:hover:bg-muted"
                        >
                            Cancelar
                        </button>
                    </div>

                    <!-- Normal Mode: ActionButtons -->
                    <ActionButtons
                        v-else
                        :hasOpenSession="isSessionOpen"
                        :canPay="canCheckout"
                        :isQuoteSession="isQuoteSession"
                        :quoteMode="props.quoteMode"
                        :can-clear="canClearCurrentCart"
                        @clear="handleClearCurrentCart"
                        @save-quote="handleSaveQuote"
                        @save-quote-changes="handleSaveQuoteChanges"
                        @open-cash-register="forceShowOpenSessionModal = true"
                        @open-payment-modal="openPaymentModal('cash')"
                    />
                </div>
            </div>
        </main>

        <!-- ========== PRODUCT SELECTION MODAL (multiple results) ========== -->
        <ProductSearchModal
            :show="showProductsModal && canUseProductSearch"
            :products="products"
            :search-query="searchQuery"
            :client-mode="isClientMode()"
            :total-count="totalProducts"
            :has-more="hasNextPage"
            :loading-more="productsLoading"
            :categories="categories"
            :brands="brands"
            @close="showProductsModal = false"
            @add-products="addSelectedProducts"
            @add-variants="addSelectedVariants"
            @load-more="loadMoreProducts"
            @search-in-modal="handleModalSearch"
        />

        <!-- ========== Unified Payment Panel (hidden in quoteMode) ========== -->
        <UnifiedPaymentPanel
            v-if="!props.quoteMode"
            :show="showPaymentModal"
            :amount-to-charge="amountToCharge"
            :customer="selectedCustomer"
            :shipping-cost="shippingCost"
            :edit-mode="props.editMode"
            :subtotal="cartSubtotal"
            :tax-amount="cartTax"
            :discount-amount="
                cart.reduce(
                    (sum: number, item: any) =>
                        sum + (item.discount || 0) * item.quantity,
                    0,
                )
            "
            @finish="handleUnifiedPaymentFinish"
            @cancel="closePaymentModal"
        />

        <!-- ========== Keyboard Shortcuts Modal ========== -->
        <div
            v-if="showShortcutsHelp"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            @click.self="showShortcutsHelp = false"
        >
            <div
                class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-card"
            >
                <h3
                    class="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"
                >
                    <Keyboard class="h-5 w-5" /> Atajos de Teclado
                </h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400"
                            >Buscar producto</span
                        ><kbd
                            class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-muted"
                            >F1</kbd
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400"
                            >Cantidad</span
                        ><kbd
                            class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-muted"
                            >F2</kbd
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400"
                            >Limpiar carrito</span
                        ><kbd
                            class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-muted"
                            >F4</kbd
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400"
                            >Guardar borrador</span
                        ><kbd
                            class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-muted"
                            >F5</kbd
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400"
                            >Cobrar</span
                        ><kbd
                            class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-muted"
                            >F10</kbd
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400"
                            >Esta ayuda</span
                        ><kbd
                            class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-muted"
                            >F12</kbd
                        >
                    </div>
                </div>
                <button
                    @click="showShortcutsHelp = false"
                    class="mt-4 w-full rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    Cerrar
                </button>
            </div>
        </div>

        <!-- ========== Variant Select Modal ========== -->
        <VariantSelectModal
            :show="showVariantModal && pendingProduct !== null"
            :product="pendingProduct"
            @select-multiple="onVariantsSelected"
            @close="closeVariantModal"
        />

        <QuickPurchaseModal
            v-if="autoQuickPurchaseProduct"
            :is-open="showAutoQuickPurchaseModal"
            :product="autoQuickPurchaseProduct"
            :initial-variant-id="autoQuickPurchaseVariantId"
            @close="closeAutoQuickPurchaseModal"
            @success="handleAutoQuickPurchaseSuccess"
        />

        <!-- ========== Credit / Partial Payment Modal ========== -->
        <AddPaymentModal
            :show="showAddPaymentModal"
            :order-id="null"
            :order-total="pendingOrderTotal"
            :amount-paid="0"
            :customer-name="selectedCustomer?.name"
            :credit-available="
                (selectedCustomer?.credit_limit ?? 0) -
                (selectedCustomer?.current_balance ?? 0)
            "
            :loading="addPaymentLoading"
            :error="addPaymentError"
            @submit="handleCreditPaymentSubmit"
            @close="showAddPaymentModal = false"
        />

        <!-- ========== Print Ticket Modal ========== -->
        <PrintTicketModal
            :show="showPrintTicketModal"
            :order-id="lastOrderId"
            :order-number="lastOrderNumber"
            @close="showPrintTicketModal = false"
        />

        <!-- ========== Cash Movement Modal ========== -->
        <CashMovementModal
            :show="showCashMovementModal"
            :loading="cashMovementLoading"
            :error="cashMovementError"
            @submit="handleCashMovement"
            @close="
                showCashMovementModal = false;
                cashMovementError = null;
            "
        />

        <!-- ========== Product Detail Modal (right-click on cart item) ========== -->
        <ProductDetailModal
            v-if="selectedProductForModal"
            :product="selectedProductForModal"
            @close="selectedProductForModal = null"
            @view-alternative="(p: any) => (selectedProductForModal = p)"
        />

        <!-- ========== Custom Line Modal ========== -->
        <AddCustomLineModal
            :show="showCustomLineModal"
            :default-tax-rate="defaultTaxRate()"
            @close="showCustomLineModal = false"
            @submit="handleAddCustomLine"
        />

        <!-- ========== Quick Customer Modal ========== -->
        <QuickCustomerModal
            :show="showQuickCustomerModal"
            @update:show="showQuickCustomerModal = $event"
            @created="handleCustomerCreated"
        />
    </div>
</template>
