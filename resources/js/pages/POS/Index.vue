<script setup lang="ts">
import { Head, usePage } from '@inertiajs/vue3';
import { router } from '@inertiajs/vue3';
import {
    Search,
    AlertTriangle,
    Keyboard,
    FileText,
    ArrowUpDown,
} from 'lucide-vue-next';
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import ActionButtons from '@/components/POS/ActionButtons.vue';
import AddCustomLineModal from '@/components/POS/AddCustomLineModal.vue';
import AddPaymentModal from '@/components/POS/AddPaymentModal.vue';
import CashMovementModal from '@/components/POS/CashMovementModal.vue';
import CashRegisterStatus from '@/components/POS/CashRegisterStatus.vue';
import OpenSessionModal from '@/components/POS/OpenSessionModal.vue';
import POSInlineSearch from '@/components/POS/POSInlineSearch.vue';
import PrintTicketModal from '@/components/POS/PrintTicketModal.vue';
import ProductSearchModal from '@/components/POS/ProductSearchModal.vue';
import ProductTable from '@/components/POS/ProductTable.vue';
import QuickCustomerModal from '@/components/POS/QuickCustomerModal.vue';
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue';
import SummarySection from '@/components/POS/SummarySection.vue';
import UnifiedPaymentPanel from '@/components/POS/UnifiedPaymentPanel.vue';
import VariantSelectModal from '@/components/POS/VariantSelectModal.vue';
import VehicleContextHeader from '@/components/POS/VehicleContextHeader.vue';
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue';
import { useCustomers } from '@/composables/useCustomers';
import { usePOS } from '@/composables/usePOS';
import { usePosSession } from '@/composables/usePosSession';
import { usePosSettings } from '@/composables/usePosSettings';
import { useProducts } from '@/composables/useProducts';
import { useSalesQuoteDraft } from '@/composables/useSalesQuoteDraft';
import type { QuoteDraftPayload } from '@/composables/useSalesQuoteDraft';
import { useStoreSettings } from '@/composables/useStoreSettings';
import { useToast } from '@/composables/useToast';
import { useVehicleContext } from '@/composables/useVehicleContext';
import { useWarehouses } from '@/composables/useWarehouses';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
// POSFilterSidebar removed — filtering now handled inside ProductSearchModal via ProductFilters

import { SalesQuotesApiService } from '@/services/sales-quotes';
import { SalesReturnsApiService } from '@/services/sales-returns';
import type { ProductVariantSelection } from '@/types/product-variant-picker';
import { formatDuration, formatReportDateTime } from '@/utils/formatters';
import { createIdempotencyKey } from '@/utils/idempotency';
import {
    createSalesOrderAmendmentKeyResolver,
    previewSalesOrderAmendment,
} from '@/utils/posAmendment';
import type { AmendmentPayment } from '@/utils/posAmendment';

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
const canManagePurchases = computed(
    () => currentRole.value === 'admin' || currentRole.value === 'manager',
);
const canClearCurrentCart = computed(
    () =>
        !isStrictCashier.value &&
        !props.quoteMode &&
        !activeSession.value?.source_quote_id &&
        !props.editMode,
);

const { defaultTaxRate } = useStoreSettings();
const toast = useToast();
const { vehicle: catalogVehicle, setVehicle: setCatalogVehicle } =
    useVehicleContext();

const {
    cart,
    customer_id,
    customer_vehicle_id,
    notes,
    internal_notes,
    loading,
    error,
    paymentMethod,
    amountReceived,
    cartSubtotal,
    cartTax,
    cartTotal,
    cartItemCount,
    addToCart,
    addCustomLine,
    updateQuantity,
    updateDiscountAmount,
    removeItem,
    toggleItemTaxExempt,
    updateItemSeller,
    updateItemNotes,
    updateItemPrice,
    reorderCart,
    clearCart,
    processSale,
    shippingCost,
    logAction,
    // Multi-cart
    allSessions,
    activeSessionId,
    activeSession,
    createNewCart,
    createQuoteEditorSession,
    closeQuoteEditorSession,
    switchCart,
    removeCart,
    loadQuoteAsSession,
} = usePOS();

const quoteEditorSession = props.quoteMode ? createQuoteEditorSession() : null;

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
const { customers, fetchCustomers, perPage: customerPerPage } = useCustomers();
const { fetchWarehouses } = useWarehouses();

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

const inlineSearchRef = ref<InstanceType<typeof POSInlineSearch> | null>(null);
const selectedCategoryId = ref<number | undefined>(undefined);
const selectedBrandId = ref<number | undefined>(undefined);
const quantity = ref(1);
const showPaymentModal = ref(false);
const showShortcutsHelp = ref(false);
const showProductsModal = ref(false);
const isSearching = ref(false);
const showCashMovementModal = ref(false);
const cashMovementInitialType = ref<'in' | 'out'>('out');
const pendingCashAction = ref<'in' | 'out' | null>(null);
const showQuickCustomerModal = ref(false);
const showCustomLineModal = ref(false);
const forceShowOpenSessionModal = ref(false);
const sessionActionLoading = ref(false);

// R45: Filter sidebar state

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

watch(
    () => activeSession.value?.seller_id,
    (sessionSellerId) => {
        if (sessionSellerId) {
            seller_id.value = sessionSellerId;
        }
    },
    { immediate: true },
);

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
        if (canManagePurchases.value) {
            openAutoQuickPurchaseForNoStock(product, variant, qty, warehouseId);
        } else {
            error.value =
                'Sin existencias. Solicita abastecimiento a un administrador o gerente.';
        }
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
    discount_amount?: number;
    notes?: string;
}) => {
    addCustomLine({
        description: payload.custom_description,
        sku: payload.product_sku,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        tax_percent: payload.tax_percent,
        discount_percent: payload.discount_percent,
        ...(payload.discount_amount !== undefined
            ? { discount_amount: payload.discount_amount }
            : {}),
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

// Electronic Payments for Multi-Tender Flow
// Store credit (saldo a favor) to apply to this sale

// Total dinero realmente recibido (efectivo, tarjeta, transferencia, saldo a favor)
// NO incluye crédito porque el crédito es deuda, no dinero recibido

// Monto pendiente (lo que falta por cobrar o se cargará a crédito)

// Total de descuento en el carrito
const cartDiscount = computed(() => {
    return cart.value.reduce(
        (sum, item: any) => sum + (Number(item.discount_amount) || 0),
        0,
    );
});

// Available credit for the selected customer

// Return mode state
const returnOrderData = ref<any>(null);
const returnLoading = ref(false);
const returnError = ref<string | null>(null);
const returnIdempotencyKey = ref(createIdempotencyKey());

// Edit mode state
const editOrderData = ref<any>(null);
const editLoading = ref(false);
const editError = ref<string | null>(null);
const resolveAmendmentPayload = createSalesOrderAmendmentKeyResolver();
const nowTick = ref(Date.now());
let elapsedTimer: ReturnType<typeof setInterval> | null = null;

// Load order for edit (add/modify items on an existing confirmed order)
async function loadOrderForReturn(orderId: number) {
    returnIdempotencyKey.value = createIdempotencyKey();
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
            const discountAmount = Number(item.discount_amount ?? 0);
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
                discount_amount: discountAmount,
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
    if (!props.orderId || cart.value.length === 0 || returnLoading.value)
        return;

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
        await SalesReturnsApiService.createForOrder(props.orderId, {
            idempotency_key: returnIdempotencyKey.value,
            approve_immediately: true,
            refund_method: 'balance', // Always use balance for store credit
            reason: 'Devolución desde POS',
            items,
        });

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
        if (order.status === 'pending' && order.source_quote?.id) {
            editError.value =
                'Esta transacción se edita desde su cotización. Abre la cotización para continuar.';
            return;
        }

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

        // Load existing items with their original line IDs.
        for (const item of order.items ?? []) {
            const quantity = Math.abs(item.quantity);
            const unitPrice = Number(item.unit_price);
            const discountPercent = Number(item.discount_percent ?? 0);
            const discountAmount = Number(item.discount_amount ?? 0);
            const taxPercent = normalizeTaxPercent(item.tax_percent);
            const subtotal = Number(item.subtotal ?? 0);
            const taxAmount = Number(item.tax_amount ?? 0);
            const total = Number(item.total ?? 0);

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
                discount_amount: discountAmount,
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

const isPostSaleAmendment = computed(() =>
    ['confirmed', 'processing', 'completed'].includes(
        editOrderData.value?.status,
    ),
);
const isEditableDraftOrder = computed(
    () =>
        ['draft', 'pending'].includes(editOrderData.value?.status) &&
        !editOrderData.value?.source_quote?.id,
);

const amendmentPreview = computed(() => {
    if (!props.editMode || !isPostSaleAmendment.value || !editOrderData.value) {
        return { preview: null, error: null };
    }
    try {
        return {
            preview: previewSalesOrderAmendment(
                editOrderData.value,
                cart.value,
                Number(currentWarehouseId.value),
            ),
            error: null,
        };
    } catch (exception) {
        return {
            preview: null,
            error:
                exception instanceof Error
                    ? exception.message
                    : 'Revisa los cambios de la transacción.',
        };
    }
});

// Show the same delta that will be submitted to the server.
const orderDiff = computed(() => {
    const preview = amendmentPreview.value.preview;
    if (!preview) return { items: [], total: 0 };
    const originalById = new Map<number, any>(
        (editOrderData.value?.items ?? []).map((item: any) => [item.id, item]),
    );
    return {
        items: preview.items.map((item) => ({
            ...item,
            qty_diff:
                item.qty -
                Number(
                    originalById.get(item.order_item_id ?? 0)?.quantity ?? 0,
                ),
            is_new: !item.order_item_id,
        })),
        total: preview.difference,
    };
});

// Format elapsed time since order creation
const editOrderElapsedTime = computed(() => {
    if (!editOrderData.value?.created_at) return '';

    return formatDuration(
        editOrderData.value.created_at,
        new Date(nowTick.value),
    );
});

const amountToCharge = computed(() => {
    if (props.editMode) {
        return Math.max(0, orderDiff.value.total);
    }
    return cartTotal.value;
});

const handleUpdateQuantity = (index: number, qty: number) => {
    if (isStrictCashier.value) return;
    const item = cart.value[index];
    if (!item) return;

    if (props.editMode && isPostSaleAmendment.value && item.order_item_id) {
        const original = editOrderData.value?.items?.find(
            (entry: any) => entry.id === item.order_item_id,
        );
        if (original && qty < Number(original.quantity)) {
            editError.value =
                'No se permite reducir cantidades en modo edición. Para reducciones usa devoluciones.';
            return;
        }
    }

    editError.value = null;
    updateQuantity(item.id, qty);
};

async function saveEditableOrder() {
    if (!props.orderId || !isEditableDraftOrder.value || editLoading.value)
        return;
    if (!currentWarehouseId.value || cart.value.length === 0) {
        editError.value =
            'Selecciona una sucursal y agrega al menos un artículo.';
        return;
    }

    editLoading.value = true;
    editError.value = null;
    try {
        await apiClient.put(`/sales-orders/${props.orderId}`, {
            customer_id: customer_id.value ?? null,
            customer_vehicle_id: customer_vehicle_id.value ?? null,
            notes: notes.value ?? null,
            items: cart.value.map((item) => ({
                product_id: item.is_custom_line ? null : item.product_id,
                variant_id: item.is_custom_line
                    ? null
                    : (item.variant_id ?? null),
                warehouse_id: item.warehouse_id ?? currentWarehouseId.value,
                quantity: item.quantity,
                unit_price: item.product_price,
                discount_percent: item.discount_percent ?? 0,
                discount_amount: item.discount_amount ?? 0,
                tax_percent: normalizeTaxPercent(item.tax_percent),
                seller_id: item.seller_id ?? null,
                is_custom_line: !!item.is_custom_line,
                custom_description: item.is_custom_line
                    ? (item.custom_description ?? item.product_name)
                    : null,
            })),
        });
        router.visit(`/sales-orders/${props.orderId}`);
    } catch (exception: any) {
        editError.value =
            exception.response?.data?.error ||
            exception.response?.data?.message ||
            'No se pudieron guardar los cambios.';
    } finally {
        editLoading.value = false;
    }
}

// Confirm a post-sale amendment using the payment panel's complete payment data.
async function confirmEditOrder(payments: AmendmentPayment[]) {
    if (!props.orderId || !isPostSaleAmendment.value || editLoading.value)
        return;

    editLoading.value = true;
    editError.value = null;

    try {
        const preview = previewSalesOrderAmendment(
            editOrderData.value,
            cart.value,
            Number(currentWarehouseId.value),
        );
        const payload = resolveAmendmentPayload(preview, payments);
        await apiClient.patch(
            `/sales-orders/${props.orderId}/add-items`,
            payload,
        );

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

// Search input reference
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
    vehicle_engine_id: selectedCustomerVehicle.value?.vehicle_engine_id,
    vehicle_chassis_id:
        selectedCustomerVehicle.value?.vehicle_chassis_id ?? undefined,
    sort: modalSort.value || undefined,
    per_page: 20,
});

// Current customer computed property
const selectedCustomer = computed(() => {
    if (!customer_id.value) return null;
    return customers.value.find((c) => c.id === customer_id.value);
});

const customerVehicles = computed(() =>
    (selectedCustomer.value?.vehicles ?? []).filter(
        (vehicle) => vehicle.status === 'active',
    ),
);

const selectedCustomerVehicle = computed(() =>
    customerVehicles.value.find(
        (vehicle) => vehicle.id === customer_vehicle_id.value,
    ),
);

watch(customer_id, () => {
    if (
        customer_vehicle_id.value &&
        !customerVehicles.value.some(
            (vehicle) => vehicle.id === customer_vehicle_id.value,
        )
    ) {
        customer_vehicle_id.value = undefined;
    }
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
                openPaymentModal();
            break;
        case 'F12':
            e.preventDefault();
            showShortcutsHelp.value = !showShortcutsHelp.value;
            break;
    }
};

// Payment (Cash/Card/Transfer/Multiple) - Now unified
const openPaymentModal = () => {
    if (cart.value.length > 0) {
        if (
            props.editMode &&
            isPostSaleAmendment.value &&
            !isSessionOpen.value
        ) {
            editError.value =
                'Abre Caja en la sucursal de esta venta antes de cobrar la diferencia.';
            forceShowOpenSessionModal.value = true;
            return;
        }
        // Reset all amounts and clear previous errors
        error.value = null;
        editError.value = null;
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
        financial_account_id?: number | null;
    }>,
) => {
    if (props.editMode) {
        await confirmEditOrder(payments);
        if (!editError.value) {
            closePaymentModal();
        }
        return;
    }

    // Clear any previous payment errors before attempting new payment
    error.value = null;

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
        financial_account_id: p.financial_account_id ?? undefined,
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

const closePaymentModal = () => {
    showPaymentModal.value = false;
    error.value = null;
};

// Detect if the active session was loaded from a SalesQuote
const isQuoteSession = computed(() => !!activeSession.value?.source_quote_id);
const quoteStatusLabels: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    sent_to_deposit: 'En Depósito',
    sent_to_cashier: 'En Caja',
    accepted: 'Aceptada',
    collected: 'Cobrada',
    rejected: 'Rechazada',
    expired: 'Vencida',
    converted: 'Convertida',
};

/** Datos de cabecera de la cotización que se está cobrando (banner del POS). */
const quoteSessionInfo = computed(() => {
    const session = activeSession.value;

    return {
        number: session?.quote_number || session?.source_quote_id || '',
        customerName:
            session?.quote_customer_name ||
            selectedCustomer.value?.name ||
            'Público general',
        sellerName: session?.quote_seller_name || '',
        createdAt: session?.quote_created_at || '',
        notes: session?.quote_notes || '',
        status:
            quoteStatusLabels[session?.quote_status ?? ''] ||
            session?.quote_status ||
            'Borrador',
        confirmedTotal: session?.quote_total,
    };
});
const quoteTotalHasChanged = computed(
    () =>
        quoteSessionInfo.value.confirmedTotal !== undefined &&
        Math.abs(
            Number(quoteSessionInfo.value.confirmedTotal) - cartTotal.value,
        ) >= 0.01,
);


const returnToCashierQueue = () => {
    if (isStrictCashier.value) {
        activeSession.value.cart = [];
        activeSession.value.customer_id = undefined;
        activeSession.value.source_quote_id = undefined;
    }
    router.visit('/pos/cashier');
};

const handleTicketClose = () => {
    showPrintTicketModal.value = false;
    if (isStrictCashier.value) router.visit('/pos/cashier');
};

// Save changes back to the originating SalesQuote (update it in place)
const saveQuoteChangesLoading = ref(false);
const quoteDestinationLoading = ref<
    'send-to-deposit' | 'send-to-cashier' | null
>(null);
const quoteDraftIdempotencyKey = ref(createIdempotencyKey());

const buildQuoteItems = () =>
    cart.value.map((item: any) => ({
        product_id: item.is_custom_line ? null : item.product_id,
        variant_id: item.variant_id ?? null,
        warehouse_id: item.warehouse_id ?? currentWarehouseId.value,
        quantity: item.quantity,
        unit_price: item.product_price,
        discount_percent: item.discount_percent ?? 0,
        ...(item.discount_amount !== undefined
            ? { discount_amount: item.discount_amount }
            : {}),
        tax_percent: normalizeTaxPercent(item.tax_percent),
        notes: item.notes ?? null,
        is_custom_line: !!item.is_custom_line,
        custom_description: item.is_custom_line
            ? item.custom_description || item.product_name
            : null,
    }));

const buildDraftPayload = (): QuoteDraftPayload => ({
    seller_id: seller_id.value ?? null,
    vehicle_context: catalogVehicle.value,
    customer_id: customer_id.value ?? null,
    customer_vehicle_id: customer_vehicle_id.value ?? null,
    warehouse_id: Number(currentWarehouseId.value || 0),
    notes: notes.value || null,
    internal_notes: internal_notes.value || null,
    items: buildQuoteItems(),
});

const quoteDraft = useSalesQuoteDraft(
    () => ({
        payload: buildDraftPayload(),
        cart: cart.value,
        vehicleContext: catalogVehicle.value,
    }),
    (savedQuote) => {
        activeSession.value.source_quote_id = savedQuote.id;
        activeSession.value.quote_number = savedQuote.quote_number;
        activeSession.value.quote_customer_name =
            savedQuote.customer?.name ??
            activeSession.value.quote_customer_name;
        activeSession.value.quote_seller_name =
            savedQuote.user?.name ??
            users.value.find((user) => user.id === savedQuote.user_id)?.name ??
            activeSession.value.quote_seller_name;
        activeSession.value.quote_created_at =
            savedQuote.created_at ?? activeSession.value.quote_created_at;
        activeSession.value.quote_notes = savedQuote.notes ?? undefined;
        activeSession.value.quote_status = savedQuote.status;
        if (savedQuote.total !== undefined) {
            activeSession.value.quote_total = Number(savedQuote.total);
        }
    },
);
let restoringQuoteDraft = false;
let allowSavedQuoteNavigation = false;
let clearDraftOnUnmount = false;

watch(
    [
        cart,
        customer_id,
        customer_vehicle_id,
        seller_id,
        notes,
        internal_notes,
        catalogVehicle,
    ],
    () => {
        if (props.quoteMode && !restoringQuoteDraft && quoteDraft.ready.value) {
            quoteDraft.recordChange();
        }
    },
    { deep: true, flush: 'sync' },
);

const handleSaveQuoteChanges = async () => {
    if (props.quoteMode) {
        const saved = await quoteDraft.flush();
        if (saved) toast.success('Cotización guardada.');
        else
            toast.error(
                quoteDraft.error.value || 'No se pudo guardar la cotización.',
                6000,
            );
        return;
    }
    if (saveQuoteChangesLoading.value) return;
    if (isStrictCashier.value) return;
    const quoteId = activeSession.value?.source_quote_id;
    if (!quoteId) return;
    if (cart.value.length === 0) {
        toast.error(
            'El carrito está vacío, agrega productos antes de guardar.',
        );
        return;
    }
    saveQuoteChangesLoading.value = true;
    try {
        const items = buildQuoteItems();

        await apiClient.put(`/sales-quotes/${quoteId}`, {
            customer_id: customer_id.value ?? null,
            customer_vehicle_id: customer_vehicle_id.value ?? null,
            warehouse_id: currentWarehouseId.value ?? null,
            items,
        });

        toast.success('Cotización actualizada correctamente.');
        searchInput.value?.focus();
    } catch (e: any) {
        toast.error(
            extractApiErrorMessage(e, 'Error al actualizar la cotización'),
            6000,
        );
    } finally {
        saveQuoteChangesLoading.value = false;
    }
};

// Save current cart as a Sales Quote (draft)
const saveQuoteLoading = ref(false);

const handleSaveQuote = async () => {
    if (props.quoteMode) {
        if (
            cart.value.length > 0 &&
            !quoteDraft.dirty.value &&
            !quoteDraft.quoteId.value
        )
            quoteDraft.recordChange();
        const saved = await quoteDraft.flush();
        if (saved && quoteDraft.quoteId.value)
            toast.success('Cotización guardada.');
        else
            toast.error(
                quoteDraft.error.value || 'No se pudo guardar la cotización.',
                6000,
            );
        return;
    }
    if (saveQuoteLoading.value) return;
    if (cart.value.length === 0) {
        toast.error(
            'Agrega productos al carrito antes de guardar una cotización.',
        );
        return;
    }
    saveQuoteLoading.value = true;
    try {
        const items = buildQuoteItems();

        const res = await apiClient.post('/sales-quotes/from-pos', {
            idempotency_key: createIdempotencyKey(),
            customer_id: customer_id.value ?? null,
            customer_vehicle_id: customer_vehicle_id.value ?? null,
            warehouse_id: currentWarehouseId.value ?? null,
            items,
        });

        const quoteNumber = res.data?.data?.quote_number ?? '';

        clearCart();

        toast.success(`Cotización ${quoteNumber} guardada correctamente.`);

        // Navegar descarta la pantalla actual: sigue siendo una decisión del usuario.
        const shouldNavigate = confirm(
            `Cotización ${quoteNumber} guardada.\n\n¿Deseas ir al listado de cotizaciones?`,
        );
        if (shouldNavigate) {
            window.location.href = '/sales-quotes';
        }
    } catch (e: any) {
        toast.error(
            extractApiErrorMessage(e, 'Error al guardar la cotización'),
            6000,
        );
    } finally {
        saveQuoteLoading.value = false;
    }
};

const persistQuoteForDestination = async (): Promise<{
    id: number;
    quote_number: string;
}> => {
    if (props.quoteMode) {
        if (
            cart.value.length > 0 &&
            !quoteDraft.dirty.value &&
            !quoteDraft.quoteId.value
        )
            quoteDraft.recordChange();
        if (!(await quoteDraft.flush()) || !quoteDraft.quoteId.value) {
            throw new Error(
                quoteDraft.error.value || 'No se pudo guardar la cotización.',
            );
        }
        return {
            id: quoteDraft.quoteId.value,
            quote_number: String(activeSession.value.quote_number || ''),
        };
    }
    const payload = {
        customer_id: customer_id.value ?? null,
        customer_vehicle_id: customer_vehicle_id.value ?? null,
        warehouse_id: currentWarehouseId.value ?? null,
        items: buildQuoteItems(),
    };
    const existingQuoteId = activeSession.value?.source_quote_id;
    const response = existingQuoteId
        ? await apiClient.put(`/sales-quotes/${existingQuoteId}`, payload)
        : await apiClient.post('/sales-quotes/from-pos', {
              ...payload,
              idempotency_key: quoteDraftIdempotencyKey.value,
          });
    const savedQuote = response.data?.data;

    if (!savedQuote?.id) {
        throw new Error('La API no devolvió la cotización guardada.');
    }

    activeSession.value.source_quote_id = Number(savedQuote.id);
    activeSession.value.quote_number = String(savedQuote.quote_number ?? '');

    return {
        id: Number(savedQuote.id),
        quote_number: String(savedQuote.quote_number ?? ''),
    };
};

const handleQuoteDestination = async (
    destination: 'send-to-deposit' | 'send-to-cashier',
) => {
    if (quoteDestinationLoading.value || cart.value.length === 0) {
        if (cart.value.length === 0) {
            toast.error('Agrega productos antes de enviar la cotización.');
        }
        return;
    }

    const destinationMessage =
        destination === 'send-to-deposit'
            ? 'Se guardará la cotización y se creará una orden pendiente para bodega.'
            : 'Se guardará la cotización y se agregará a la cola de Caja.';

    // Enviar la cotización tiene consecuencias: la confirmación sigue siendo explícita.
    if (!confirm(`${destinationMessage}\n\n¿Deseas continuar?`)) {
        return;
    }

    quoteDestinationLoading.value = destination;
    let savedQuoteId: number | undefined;

    try {
        const savedQuote = await persistQuoteForDestination();
        savedQuoteId = savedQuote.id;
        await SalesQuotesApiService.transition(savedQuote.id, destination);
        if (props.quoteMode) clearDraftOnUnmount = true;
        toast.success(
            destination === 'send-to-deposit'
                ? `Cotización ${savedQuote.quote_number} enviada a Depósito.`
                : `Cotización ${savedQuote.quote_number} enviada a Caja.`,
        );
        router.visit(`/sales-quotes/${savedQuote.id}`);
    } catch (exception: any) {
        const message = extractApiErrorMessage(
            exception,
            'No se pudo completar el envío de la cotización.',
        );
        toast.error(
            savedQuoteId
                ? `La cotización quedó guardada, pero no fue enviada. ${message}`
                : message,
            6000,
        );
    } finally {
        quoteDestinationLoading.value = null;
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

type CashAction = 'in' | 'out';
const cashMovementLoading = ref(false);
const cashMovementError = ref<string | null>(null);

const requestedCashAction = (): CashAction | null => {
    const action = new URL(window.location.href).searchParams.get(
        'cash_action',
    );
    return action === 'in' || action === 'out' ? action : null;
};

const clearCashActionQuery = (): void => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('cash_action')) return;

    url.searchParams.delete('cash_action');
    window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
    );
};

const openRequestedCashMovement = (action: CashAction): void => {
    router.visit(`/cash/movements?type=${action}`, { replace: true });
};

const closeOpenSessionModal = (): void => {
    forceShowOpenSessionModal.value = false;
    if (pendingCashAction.value) {
        pendingCashAction.value = null;
        clearCashActionQuery();
        if (isStrictCashier.value) router.visit('/pos/cashier');
    }
};

const closeCashMovement = (): void => {
    showCashMovementModal.value = false;
    pendingCashAction.value = null;
    cashMovementError.value = null;
    clearCashActionQuery();
    if (isStrictCashier.value) router.visit('/pos/cashier');
};

// Session Handlers
const handleOpenSession = async (amount: number) => {
    if (sessionActionLoading.value) return;

    sessionActionLoading.value = true;
    const success = await openSession(
        amount,
        currentWarehouseId.value ?? undefined,
    );
    sessionActionLoading.value = false;
    if (success) {
        forceShowOpenSessionModal.value = false;
        error.value = null;
        if (pendingCashAction.value) {
            const action = pendingCashAction.value;
            pendingCashAction.value = null;
            cashMovementInitialType.value = action;
            await nextTick();
            showCashMovementModal.value = true;
        } else {
            searchInput.value?.focus();
        }
    }
};

const handleCashMovement = async (payload: {
    type: 'in' | 'out';
    subtype:
        | 'cash_in'
        | 'cash_out'
        | 'deposit'
        | 'withdrawal'
        | 'adjustment_positive'
        | 'adjustment_negative';
    amount: number;
    reason: string;
    reference_number: string;
    notes: string;
    idempotency_key: string;
}) => {
    if (cashMovementLoading.value) return;

    cashMovementLoading.value = true;
    cashMovementError.value = null;
    const success = await addCashMovement(
        payload,
        currentWarehouseId.value ?? undefined,
    );
    cashMovementLoading.value = false;
    if (success) {
        showCashMovementModal.value = false;
        clearCashActionQuery();
        // Refresh session summary to update expected cash
        await checkCurrentSession(currentWarehouseId.value ?? undefined);
        if (isStrictCashier.value) router.visit('/pos/cashier');
    } else {
        cashMovementError.value = sessionError.value;
    }
};

let returnSessionId: string | null = null;
let editSessionId: string | null = null;

const loadQuoteForEditor = (quote: any) => {
    setCatalogVehicle(quote.vehicle_context ?? {});
    loadQuoteAsSession(
        {
            id: quote.id,
            quote_number: quote.quote_number,
            status: quote.status,
            total: quote.total,
            customer_id: quote.customer?.id ?? quote.customer_id ?? null,
            customer_vehicle_id: quote.customer_vehicle_id ?? null,
            seller_id: quote.user?.id ?? quote.user_id ?? null,
            customer_name: quote.customer?.name ?? null,
            seller_name: quote.user?.name ?? null,
            created_at: quote.created_at ?? null,
            notes: quote.notes ?? null,
            internal_notes: quote.internal_notes ?? null,
            items: (quote.items ?? []).map((item: any) => ({
                id: item.id,
                product_id: item.product_id ?? null,
                product_name: item.product_name,
                product_sku: item.product_sku,
                variant_id: item.variant_id ?? null,
                warehouse_id: item.warehouse_id ?? null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_percent: item.discount_percent,
                discount_amount: item.discount_amount,
                tax_percent: normalizeTaxPercent(item.tax_percent),
                subtotal: item.subtotal,
                tax_amount: item.tax_amount,
                total: item.total,
                notes: item.notes ?? null,
                is_custom_line: !!item.is_custom_line,
                custom_description: item.custom_description ?? null,
                variant: item.variant ?? null,
            })),
        },
        true,
    );
};

onMounted(async () => {
    if (
        isStrictCashier.value &&
        !activeSession.value?.source_quote_id &&
        !requestedCashAction()
    ) {
        router.visit('/pos/cashier', { replace: true });
        return;
    }

    window.addEventListener('keydown', handleKeyboard);

    // A local quote snapshot survives refresh; warn only while the server has not acknowledged it.
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (props.quoteMode ? quoteDraft.dirty.value : cart.value.length > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // UX-001: Intercept Inertia navigation when cart has items
    const removeInertiaListener = router.on('before', (event) => {
        if (props.quoteMode) {
            if (allowSavedQuoteNavigation) {
                allowSavedQuoteNavigation = false;
                return true;
            }
            if (!quoteDraft.dirty.value) {
                clearDraftOnUnmount = !!quoteDraft.quoteId.value;
                return true;
            }
            const originalVisit = (event as any)?.detail?.visit;
            const target = originalVisit?.url;
            const targetUrl =
                typeof target === 'string' ? target : target?.toString();
            void quoteDraft.flush().then((saved) => {
                if (saved && targetUrl) {
                    clearDraftOnUnmount = !!quoteDraft.quoteId.value;
                    allowSavedQuoteNavigation = true;
                    router.visit(targetUrl, {
                        method: originalVisit.method,
                        data: originalVisit.data,
                        headers: originalVisit.headers,
                        replace: originalVisit.replace,
                        preserveState: originalVisit.preserveState,
                        preserveScroll: originalVisit.preserveScroll,
                        only: originalVisit.only,
                        except: originalVisit.except,
                        errorBag: originalVisit.errorBag,
                        forceFormData: originalVisit.forceFormData,
                        queryStringArrayFormat:
                            originalVisit.queryStringArrayFormat,
                    });
                } else if (!saved) {
                    toast.error(
                        quoteDraft.error.value ||
                            'No se pudo guardar la cotización.',
                        6000,
                    );
                }
            });
            return false;
        }
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

    // Amending a paid order needs an active cash session; drafts do not.
    if (!props.quoteMode && !props.returnMode && !props.editMode) {
        // Session source of truth comes from backend before showing open-session flow
        await checkCurrentSession(currentWarehouseId.value ?? undefined);

        const cashAction = requestedCashAction();
        if (cashAction) {
            openRequestedCashMovement(cashAction);
        }
    }

    customerPerPage.value = 50;
    await Promise.all([
        fetchCategories(),
        fetchBrands(),
        fetchCustomers(1),
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
        if (isPostSaleAmendment.value) {
            await checkCurrentSession(currentWarehouseId.value ?? undefined);
        }
    }

    if (props.quoteMode) {
        restoringQuoteDraft = true;
        try {
            let serverQuote: any = null;
            if (props.quoteId) {
                const response = await apiClient.get(
                    `/sales-quotes/${props.quoteId}`,
                );
                serverQuote = response.data;
                loadQuoteForEditor(serverQuote);
            }
            const warehouseId = Number(
                currentWarehouseId.value || serverQuote?.warehouse_id || 0,
            );
            if (!warehouseId) {
                throw new Error(
                    'Selecciona una sucursal antes de crear la cotización.',
                );
            }
            const userId = Number((page.props.auth?.user as any)?.id || 0);
            const local = quoteDraft.start(
                userId,
                warehouseId,
                props.quoteId,
                Number(serverQuote?.draft_revision || 0),
                serverQuote?.idempotency_key,
            );
            if (!serverQuote && quoteDraft.quoteId.value) {
                const response = await apiClient.get(
                    `/sales-quotes/${quoteDraft.quoteId.value}`,
                );
                serverQuote = response.data;
                quoteDraft.reconcileServer(serverQuote);
                if (!local?.dirty) loadQuoteForEditor(serverQuote);
            }
            if (local?.dirty) {
                cart.value = local.cart as typeof cart.value;
                customer_id.value = local.payload.customer_id ?? undefined;
                customer_vehicle_id.value =
                    local.payload.customer_vehicle_id ?? undefined;
                seller_id.value = local.payload.seller_id ?? seller_id.value;
                notes.value = local.payload.notes ?? '';
                internal_notes.value = local.payload.internal_notes ?? '';
                activeSession.value.source_quote_id =
                    local.quoteId ?? undefined;
                if (local.vehicleContext)
                    setCatalogVehicle(local.vehicleContext);
            }
            if (
                serverQuote &&
                (!['draft', 'sent'].includes(serverQuote.status) ||
                    serverQuote.converted_order_id)
            ) {
                quoteDraft.conflict.value = true;
                quoteDraft.error.value =
                    'Esta cotización ya fue enviada o tiene una orden vinculada. Abre su detalle para continuar.';
            }
        } catch (e: any) {
            error.value =
                e.response?.data?.message ||
                e.message ||
                'Error al cargar la cotización';
        } finally {
            restoringQuoteDraft = false;
        }
    }

    elapsedTimer = setInterval(() => {
        nowTick.value = Date.now();
    }, 60000);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyboard);
    if (props.quoteMode && quoteEditorSession) {
        if (clearDraftOnUnmount) quoteDraft.clearAfterLeave();
        quoteDraft.dispose();
        closeQuoteEditorSession(
            quoteEditorSession.sessionId,
            quoteEditorSession.previousSessionId,
        );
    }

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
                    <div
                        v-if="isPostSaleAmendment"
                        class="border-l border-blue-500 pl-6 text-right"
                    >
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
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <button
                        @click="router.visit('/sales-quotes')"
                        aria-label="Volver a Transacciones"
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
                                    COTIZACIÓN #{{
                                        (activeSession as any)?.quote_number ||
                                        (activeSession as any)?.source_quote_id
                                    }}
                                </template>
                                <template v-else> NUEVA COTIZACIÓN </template>
                            </p>
                            <p
                                data-test="quote-autosave-status"
                                class="mt-1 text-xs text-purple-100"
                            >
                                {{
                                    quoteDraft.conflict.value
                                        ? 'Requiere revisión'
                                        : quoteDraft.saving.value
                                          ? 'Guardando…'
                                          : quoteDraft.dirty.value
                                            ? 'Cambios pendientes'
                                            : quoteDraft.quoteId.value
                                              ? 'Guardada'
                                              : 'Se guardará al agregar productos'
                                }}
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
            <div
                v-if="isQuoteSession"
                class="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-purple-300/30 pt-3 text-sm"
            >
                <span
                    ><span class="text-purple-200">Cliente:</span>
                    {{ quoteSessionInfo.customerName }}</span
                >
                <span
                    ><span class="text-purple-200">Vendedor:</span>
                    {{ quoteSessionInfo.sellerName || 'Sin vendedor' }}</span
                >
                <span
                    ><span class="text-purple-200">Creada:</span>
                    {{
                        quoteSessionInfo.createdAt
                            ? formatReportDateTime(quoteSessionInfo.createdAt)
                            : 'Sin fecha'
                    }}</span
                >
                <span
                    ><span class="text-purple-200">Estado:</span>
                    {{ quoteSessionInfo.status }}</span
                >
                <span v-if="quoteSessionInfo.confirmedTotal !== undefined"
                    ><span class="text-purple-200">Total guardado:</span>
                    {{ formatCurrency(quoteSessionInfo.confirmedTotal) }}</span
                >
            </div>
            <p
                v-if="isQuoteSession && quoteSessionInfo.notes"
                class="mt-2 text-sm text-purple-100"
            >
                <span class="font-semibold">Notas:</span>
                {{ quoteSessionInfo.notes }}
            </p>
            <p
                v-if="isQuoteSession && quoteTotalHasChanged"
                class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
            >
                El total actual difiere del último total guardado. Guarda la
                cotización para actualizarlo.
            </p>
        </div>

        <!-- Cotización en curso (cobro desde la Cola de Caja) -->
        <div
            v-if="
                isQuoteSession &&
                !props.quoteMode &&
                !props.returnMode &&
                !props.editMode
            "
            data-test="quote-session-banner"
            class="z-20 shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-white shadow-sm"
        >
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                    <FileText class="h-6 w-6 shrink-0 text-emerald-200" />
                    <div>
                        <h2 class="text-lg font-bold">
                            COTIZACIÓN #{{ quoteSessionInfo.number }}
                        </h2>
                        <p class="text-sm text-emerald-100">
                            Estado: {{ quoteSessionInfo.status }} · Cobrando una
                            cotización enviada a Caja
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-6">
                    <div>
                        <p class="text-xs text-emerald-200">Cliente</p>
                        <p
                            data-test="quote-session-customer"
                            class="text-sm font-medium"
                        >
                            {{ quoteSessionInfo.customerName }}
                        </p>
                    </div>
                    <div>
                        <p class="text-xs text-emerald-200">Vendedor</p>
                        <p
                            data-test="quote-session-seller"
                            class="text-sm font-medium"
                        >
                            {{ quoteSessionInfo.sellerName || 'Sin vendedor' }}
                        </p>
                    </div>
                    <div>
                        <p class="text-xs text-emerald-200">Creada</p>
                        <p
                            data-test="quote-session-created-at"
                            class="text-sm font-medium"
                        >
                            {{
                                formatReportDateTime(quoteSessionInfo.createdAt)
                            }}
                        </p>
                    </div>
                    <div class="border-l border-emerald-400/40 pl-6 text-right">
                        <p class="text-xs text-emerald-200">Total a cobrar</p>
                        <p class="text-2xl font-bold">
                            {{ formatCurrency(cartTotal) }}
                        </p>
                    </div>
                </div>
            </div>
            <p
                v-if="quoteSessionInfo.notes"
                data-test="quote-session-notes"
                class="mt-2 border-t border-emerald-400/30 pt-2 text-sm text-emerald-100"
            >
                <span class="font-semibold">Notas:</span>
                {{ quoteSessionInfo.notes }}
            </p>
            <p
                v-if="quoteTotalHasChanged"
                class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
            >
                El total actual {{ formatCurrency(cartTotal) }} difiere del
                total guardado
                {{ formatCurrency(quoteSessionInfo.confirmedTotal || 0) }}.
                Revisa la cotización antes de cobrar.
            </p>
        </div>

        <!-- Cash register is also available while charging a post-sale amendment. -->
        <div
            v-if="
                !props.quoteMode &&
                !props.returnMode &&
                (!props.editMode || isPostSaleAmendment)
            "
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
                @close="closeOpenSessionModal"
            />
        </div>

        <VehicleContextHeader
            v-if="!props.returnMode && !props.editMode && canUseProductSearch"
        />

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
                        :warehouse-id="currentWarehouseId"
                        @product-selected="handleInlineSelect"
                        @product-needs-variant="handleInlineVariantNeeded"
                        @open-full-search="handleOpenFullSearch"
                        @add-custom-line="showCustomLineModal = true"
                    />
                </div>

                <!-- Multi-Cart Tabs (hide in return mode and edit mode) -->
                <div
                    v-if="
                        allSessions.length > 0 &&
                        !isStrictCashier &&
                        !props.quoteMode &&
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
                    v-if="cart.length > 2 && !isStrictCashier"
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
                        :can-edit-commercial="!isStrictCashier"
                        :can-manage-purchases="canManagePurchases"
                        :quote-mode="props.quoteMode"
                        @update-quantity="
                            (idx, qty) => handleUpdateQuantity(idx, qty)
                        "
                        @remove="
                            (idx) =>
                                !isStrictCashier && removeItem(cart[idx].id)
                        "
                        @toggle-item-tax-exempt="
                            (id) => toggleItemTaxExempt(id)
                        "
                        @update-item-seller="
                            (id, sellerId) =>
                                !isStrictCashier &&
                                updateItemSeller(id, sellerId)
                        "
                        @update-item-notes="
                            (id, noteText) =>
                                !isStrictCashier &&
                                updateItemNotes(id, noteText)
                        "
                        @update-item-price="
                            (id, price) =>
                                !isStrictCashier && updateItemPrice(id, price)
                        "
                        @update-item-discount-amount="
                            (id, discount) =>
                                !isStrictCashier &&
                                updateDiscountAmount(id, discount)
                        "
                        @view-details="
                            (productId) => openProductDetail(productId)
                        "
                        @reorder="
                            (items) => !isStrictCashier && reorderCart(items)
                        "
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
                    <div
                        v-if="selectedCustomer && customerVehicles.length > 0"
                        class="mt-3 space-y-1.5"
                    >
                        <label
                            for="customer-vehicle"
                            class="text-xs font-medium text-muted-foreground"
                        >
                            Vehículo del cliente
                        </label>
                        <select
                            id="customer-vehicle"
                            v-model.number="customer_vehicle_id"
                            class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        >
                            <option :value="undefined">
                                Sin vehículo relacionado
                            </option>
                            <option
                                v-for="vehicle in customerVehicles"
                                :key="vehicle.id"
                                :value="vehicle.id"
                            >
                                {{ vehicle.display_name }}
                                {{
                                    vehicle.plate_number
                                        ? `· ${vehicle.plate_number}`
                                        : ''
                                }}
                            </option>
                        </select>
                        <p class="text-xs text-muted-foreground">
                            La búsqueda de repuestos usará el motor y chasis de
                            este vehículo.
                        </p>
                    </div>
                    <div v-if="props.quoteMode" class="mt-3 space-y-2">
                        <label
                            for="quote-notes"
                            class="text-xs font-medium text-muted-foreground"
                            >Notas de la cotización</label
                        >
                        <textarea
                            id="quote-notes"
                            v-model="notes"
                            rows="2"
                            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
                            placeholder="Indicaciones para el cliente"
                        ></textarea>
                        <label
                            for="quote-internal-notes"
                            class="text-xs font-medium text-muted-foreground"
                            >Notas internas</label
                        >
                        <textarea
                            id="quote-internal-notes"
                            v-model="internal_notes"
                            rows="2"
                            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
                            placeholder="Información para el equipo"
                        ></textarea>
                    </div>
                </div>
                <div
                    v-if="props.quoteMode && quoteDraft.error.value"
                    class="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                    data-test="quote-draft-error"
                >
                    {{ quoteDraft.error.value }}
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

                        <div
                            v-if="
                                editOrderData?.source_quote?.id &&
                                !isPostSaleAmendment
                            "
                            class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
                        >
                            Esta transacción se modifica desde su cotización.
                            <button
                                type="button"
                                class="mt-2 block font-semibold underline"
                                @click="
                                    router.visit(
                                        `/sales-quotes/${editOrderData.source_quote.id}`,
                                    )
                                "
                            >
                                Abrir cotización
                            </button>
                        </div>

                        <p
                            v-if="isEditableDraftOrder"
                            class="rounded-xl bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        >
                            Guarda los cambios de esta orden pendiente sin
                            realizar un cobro.
                        </p>

                        <div
                            v-if="
                                isPostSaleAmendment &&
                                amendmentPreview.error &&
                                cart.length > 0
                            "
                            class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                        >
                            {{ amendmentPreview.error }}
                        </div>

                        <!-- Show diff summary -->
                        <div
                            v-if="
                                isPostSaleAmendment &&
                                orderDiff.items.length > 0
                            "
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
                            v-else-if="
                                isPostSaleAmendment && !amendmentPreview.error
                            "
                            class="rounded-xl bg-gray-50 p-4 text-center dark:bg-muted"
                        >
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                No se han realizado cambios a la orden.
                            </p>
                        </div>

                        <!-- Action buttons -->
                        <button
                            v-if="isPostSaleAmendment && orderDiff.total > 0"
                            @click="openPaymentModal()"
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
                            v-else-if="isEditableDraftOrder"
                            @click="saveEditableOrder"
                            :disabled="editLoading || cart.length === 0"
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
                            v-else-if="
                                isPostSaleAmendment &&
                                orderDiff.items.length === 0
                            "
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
                        :cashier-mode="isStrictCashier"
                        :saving-quote="
                            saveQuoteLoading || saveQuoteChangesLoading
                        "
                        :quote-destination-loading="quoteDestinationLoading"
                        @clear="handleClearCurrentCart"
                        @save-quote="handleSaveQuote"
                        @save-quote-changes="handleSaveQuoteChanges"
                        @send-quote-to-deposit="
                            handleQuoteDestination('send-to-deposit')
                        "
                        @send-quote-to-cashier="
                            handleQuoteDestination('send-to-cashier')
                        "
                        @open-cash-register="forceShowOpenSessionModal = true"
                        @open-payment-modal="openPaymentModal()"
                    />
                    <button
                        v-if="isStrictCashier && isQuoteSession"
                        type="button"
                        class="mt-3 w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                        @click="returnToCashierQueue"
                    >
                        Volver a la cola
                    </button>
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
            :discount-amount="cartDiscount"
            :loading="props.editMode ? editLoading : loading"
            :error="props.editMode ? editError : error"
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
            :can-manage-purchases="canManagePurchases"
            @select-multiple="onVariantsSelected"
            @close="closeVariantModal"
        />

        <QuickPurchaseModal
            v-if="canManagePurchases && autoQuickPurchaseProduct"
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
            @close="handleTicketClose"
        />

        <!-- ========== Cash Movement Modal ========== -->
        <CashMovementModal
            :show="showCashMovementModal"
            :loading="cashMovementLoading"
            :error="cashMovementError"
            :initial-type="cashMovementInitialType"
            @submit="handleCashMovement"
            @close="closeCashMovement"
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
