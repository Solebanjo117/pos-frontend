<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useSalesOrders } from '@/composables/useSalesOrders';
import {
    ArrowLeft,
    Edit,
    CheckCircle,
    XCircle,
    Package,
    User,
    Calendar,
    DollarSign,
    Printer,
    RotateCcw,
    Search,
    Plus,
    Minus,
    ChevronDown,
    ChevronUp,
    X,
    Calculator,
    Edit2,
    CircleDollarSign,
    AlertTriangle,
    ClipboardList,
} from 'lucide-vue-next';
import PrintTicketModal from '@/components/POS/PrintTicketModal.vue';
import CreateReturnModal from '@/components/POS/CreateReturnModal.vue';
import ProductVariantPickerModal from '@/components/Products/ProductVariantPickerModal.vue';
import { useUsers } from '@/composables/useUsers';
import apiClient from '@/services/api/client';
import type { Product, ProductVariant } from '@/types/product';
import type { ProductVariantSelection } from '@/types/product-variant-picker';

const props = defineProps<{
    id: number;
}>();

const {
    currentSalesOrder,
    loading,
    error,
    fetchSalesOrderById,
    confirmSalesOrder,
    completeSalesOrder,
    cancelSalesOrder,
    updateOrderItem,
} = useSalesOrders();

const showPrintModal = ref(false);
const showReturnModal = ref(false);
const returnLoading = ref(false);
const returnError = ref<string | null>(null);
const orderReturns = ref<any[]>([]);
const showAuditLogs = ref(false);
const showAddItemModal = ref(false);
const expandedItemId = ref<number | null>(null);
const savingItemIds = ref<Set<number>>(new Set());
const pickerProducts = ref<Product[]>([]);
const pickerTotal = ref(0);
const pickerCurrentPage = ref(1);
const pickerLastPage = ref(1);
const pickerLoading = ref(false);
const pickerLoadingMore = ref(false);
const productSearch = ref('');
const productFilterCategories = ref<Array<{ id: number; name: string }>>([]);
const productFilterBrands = ref<Array<{ id: number; name: string }>>([]);
const pickerFilters = ref<{
    query: string;
    category_ids?: number[];
    brand_ids?: number[];
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort?: string;
}>({ query: '' });

const { users, fetchUsers } = useUsers();

const paymentStatusLabels: Record<string, string> = {
    pending: 'Pendiente',
    partial: 'Parcial',
    paid: 'Pagado',
    refunded: 'Reembolsado',
};

const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
        pending:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        partial:
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        refunded:
            'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };

    return (
        colors[status] ||
        'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-300'
    );
};

const itemCount = computed(() => currentSalesOrder.value?.items?.length || 0);
const auditLogCount = computed(
    () => (currentSalesOrder.value as any)?.audit_logs?.length || 0,
);
const returnsTotal = computed(() =>
    orderReturns.value.reduce(
        (sum, ret) => sum + Number(ret.total_amount || 0),
        0,
    ),
);
const selectedWarehouseId = computed(() => {
    const catalogItem = currentSalesOrder.value?.items?.find(
        (item: any) => !item.is_custom_line && item.warehouse_id,
    );

    return Number(
        catalogItem?.warehouse_id ??
            (currentSalesOrder.value?.items?.[0] as any)?.warehouse_id ??
            1,
    );
});

const canEditPostSaleItem = (item: any): boolean =>
    Boolean(item.added_after_sale);

const toggleItemEditor = (item: any): void => {
    if (!canEditPostSaleItem(item)) return;
    expandedItemId.value = expandedItemId.value === item.id ? null : item.id;
};

const setItemSaving = (itemId: number, saving: boolean): void => {
    const next = new Set(savingItemIds.value);
    if (saving) {
        next.add(itemId);
    } else {
        next.delete(itemId);
    }
    savingItemIds.value = next;
};

const updatePostSaleItem = async (
    item: any,
    payload: Record<string, unknown>,
): Promise<void> => {
    if (!canEditPostSaleItem(item) || savingItemIds.value.has(item.id)) return;

    setItemSaving(item.id, true);
    try {
        await updateOrderItem(item.id, payload);
    } catch (err) {
        console.error('Error updating post-sale item:', err);
    } finally {
        setItemSaving(item.id, false);
    }
};

const updatePostSaleQuantity = (item: any, quantity: number): void => {
    updatePostSaleItem(item, {
        quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
    });
};

const updatePostSaleNumber = (
    item: any,
    key: 'unit_price' | 'discount_percent' | 'tax_percent',
    value: number,
): void => {
    const max = key === 'unit_price' ? Number.MAX_SAFE_INTEGER : 100;
    updatePostSaleItem(item, {
        [key]: Math.max(0, Math.min(max, Number(value) || 0)),
    });
};

const togglePostSaleTax = (item: any): void => {
    updatePostSaleItem(item, {
        tax_percent: Number(item.tax_percent || 0) > 0 ? 0 : 7,
    });
};

const scrollToSection = (sectionId: string) => {
    document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const auditActionIcon = (action: string) => {
    const icons: Record<string, any> = {
        search: Search,
        cart_add: Plus,
        cart_remove: X,
        qty_change: Calculator,
        price_override: Edit2,
        tax_override: CircleDollarSign,
        checkout_success: CheckCircle,
        checkout_error: AlertTriangle,
    };
    return icons[action] || ClipboardList;
};

const auditActionLabel = (action: string) => {
    const labels: Record<string, string> = {
        search: 'Búsqueda',
        cart_add: 'Añadido',
        cart_remove: 'Eliminado',
        qty_change: 'Cant. cambiada',
        price_override: 'Precio override',
        tax_override: 'Impuesto override',
        checkout_success: 'Checkout',
        checkout_error: 'Error checkout',
    };
    return labels[action] || action;
};

const formatLogTime = (timestamp: string) => {
    try {
        return new Date(timestamp).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return timestamp;
    }
};

const formatLogDetail = (log: any) => {
    const m = log.metadata || {};
    switch (log.action) {
        case 'search':
            return `"${m.query}"`;
        case 'cart_add':
            return `${m.name || `#${m.product_id}`} ×${m.quantity}`;
        case 'cart_remove':
            return `${m.name || `#${m.product_id}`}`;
        case 'qty_change':
            return `#${m.product_id}: ${m.old_qty} → ${m.new_qty}`;
        case 'price_override':
            return `$${m.old_price} → $${m.new_price}`;
        case 'tax_override':
            return `${m.old_tax}% → ${m.new_tax}%`;
        case 'checkout_success':
            return `Orden #${m.order_id} — $${m.total}`;
        default:
            return JSON.stringify(m);
    }
};

const handleConfirm = async () => {
    if (!confirm('¿Confirmar esta orden? Esto descontará el inventario.'))
        return;
    try {
        await confirmSalesOrder(props.id);
        await fetchSalesOrderById(props.id);
    } catch (err) {
        console.error('Error:', err);
    }
};

const handleComplete = async () => {
    if (!confirm('¿Marcar esta orden como completada?')) return;
    try {
        await completeSalesOrder(props.id);
        await fetchSalesOrderById(props.id);
    } catch (err) {
        console.error('Error:', err);
    }
};

const handleCancel = async () => {
    if (!confirm('¿Cancelar esta orden? El inventario será revertido.')) return;
    try {
        await cancelSalesOrder(props.id);
        await fetchSalesOrderById(props.id);
    } catch (err) {
        console.error('Error:', err);
    }
};

const fetchReturns = async () => {
    try {
        const { data } = await apiClient.get(
            `/sales-orders/${props.id}/returns`,
        );
        orderReturns.value = data;
    } catch (e) {
        console.error('Error fetching returns:', e);
    }
};

const fetchProductFilterOptions = async () => {
    try {
        const [categoriesResponse, brandsResponse] = await Promise.all([
            apiClient.get('/categories'),
            apiClient.get('/brands'),
        ]);

        productFilterCategories.value =
            categoriesResponse.data.data ?? categoriesResponse.data ?? [];
        productFilterBrands.value =
            brandsResponse.data.data ?? brandsResponse.data ?? [];
    } catch (e) {
        productFilterCategories.value = [];
        productFilterBrands.value = [];
    }
};

const fetchPickerProducts = async (append = false) => {
    if (append && pickerCurrentPage.value >= pickerLastPage.value) {
        return;
    }

    if (append) {
        pickerLoadingMore.value = true;
    } else {
        pickerLoading.value = true;
        pickerCurrentPage.value = 1;
    }

    try {
        const page = append ? pickerCurrentPage.value + 1 : 1;
        const filters = pickerFilters.value;
        const { data } = await apiClient.get('/products', {
            params: {
                search: filters.query || undefined,
                category_id: filters.category_ids,
                brand_id: filters.brand_ids,
                min_price: filters.min_price,
                max_price: filters.max_price,
                in_stock: filters.in_stock,
                sort: filters.sort,
                page,
                per_page: 20,
                with_variants: true,
            },
        });

        const rows = data.data || [];
        pickerProducts.value = append
            ? [...pickerProducts.value, ...rows]
            : rows;
        pickerCurrentPage.value = data.meta?.current_page ?? page;
        pickerLastPage.value = data.meta?.last_page ?? page;
        pickerTotal.value = data.meta?.total ?? rows.length;
    } finally {
        pickerLoading.value = false;
        pickerLoadingMore.value = false;
    }
};

const openProductPicker = async () => {
    showAddItemModal.value = true;
    pickerFilters.value = { query: productSearch.value };
    await fetchPickerProducts();
};

const handlePickerSearch = (filters: typeof pickerFilters.value) => {
    pickerFilters.value = filters;
    productSearch.value = filters.query;
    fetchPickerProducts();
};

const priceFor = (product: Product, variant: ProductVariant | null): number =>
    Number(
        variant?.pricing?.base_price ??
            product.pricing?.base_price ??
            product.default_variant?.pricing?.base_price ??
            0,
    );

const normalizeTaxPercent = (value: number): number =>
    Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const taxRateFor = (product: Product, variant: ProductVariant | null): number =>
    normalizeTaxPercent(
        Number(
            variant?.pricing?.sale_tax_rate ??
                variant?.pricing?.tax_rate ??
                product.pricing?.sale_tax_rate ??
                product.pricing?.tax_rate ??
                0,
        ),
    );

const addVariantSelections = async (
    selections: ProductVariantSelection[],
): Promise<void> => {
    if (!currentSalesOrder.value || selections.length === 0) {
        return;
    }

    try {
        for (const { product, variant, quantity } of selections) {
            await apiClient.post(
                `/sales-orders/${currentSalesOrder.value.id}/items`,
                {
                    product_id: product.id,
                    variant_id: variant?.id ?? null,
                    warehouse_id: selectedWarehouseId.value,
                    quantity,
                    unit_price: priceFor(product, variant),
                    tax_percent: taxRateFor(product, variant),
                    seller_id: (currentSalesOrder.value as any).user_id ?? null,
                },
            );
        }

        showAddItemModal.value = false;
        productSearch.value = '';
        pickerProducts.value = [];
        await fetchSalesOrderById(props.id);
    } catch (err) {
        console.error('Error adding sales order items:', err);
    }
};

const handleReturnSubmit = async (payload: {
    reason: string;
    refund_method: string;
    refund_notes: string;
    items: {
        sales_order_item_id: number;
        quantity: number;
        user_id: number | null;
    }[];
}) => {
    returnLoading.value = true;
    returnError.value = null;
    try {
        const { data } = await apiClient.post(
            `/sales-orders/${props.id}/returns`,
            payload,
        );
        const returnId = data.data?.id;
        // Auto-approve the return
        if (returnId) {
            await apiClient.post(`/sales-returns/${returnId}/approve`);
        }
        showReturnModal.value = false;
        await fetchSalesOrderById(props.id);
        await fetchReturns();
    } catch (err: any) {
        const errData = err.response?.data;
        if (Array.isArray(errData?.errors)) {
            returnError.value = errData.errors.join('\n');
        } else {
            returnError.value =
                errData?.message || 'Error al procesar la devolución';
        }
    } finally {
        returnLoading.value = false;
    }
};

const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-800 dark:bg-card dark:text-gray-300',
        pending:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed:
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        processing:
            'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        completed:
            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        cancelled:
            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status] || colors.draft;
};

onMounted(() => {
    fetchSalesOrderById(props.id);
    fetchReturns();
    fetchUsers();
    fetchProductFilterOptions();
});
</script>

<template>
    <Head :title="`Orden ${currentSalesOrder?.order_number || ''}`" />

    <AppLayout>
        <div v-if="loading" class="py-12 text-center">
            <p class="text-gray-600 dark:text-gray-400">Cargando orden...</p>
        </div>

        <div
            v-else-if="error"
            class="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
            {{ error }}
        </div>

        <div v-else-if="currentSalesOrder" class="space-y-6">
            <!-- Header -->
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
                >
                    <div class="flex items-center gap-4">
                        <button
                            @click="router.visit('/sales-orders')"
                            class="mt-1 rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                            title="Volver"
                        >
                            <ArrowLeft :size="22" />
                        </button>
                        <div>
                            <h1
                                class="text-2xl font-semibold text-gray-900 dark:text-white"
                            >
                                {{ currentSalesOrder.order_number }}
                            </h1>
                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                    :class="[
                                        'rounded-full px-2 py-1 text-xs font-semibold',
                                        getStatusColor(
                                            currentSalesOrder.status,
                                        ),
                                    ]"
                                >
                                    {{ currentSalesOrder.status_label }}
                                </span>
                                <span
                                    :class="[
                                        'rounded-full px-2 py-1 text-xs font-semibold',
                                        getPaymentStatusColor(
                                            currentSalesOrder.payment_status,
                                        ),
                                    ]"
                                >
                                    {{
                                        paymentStatusLabels[
                                            currentSalesOrder.payment_status
                                        ] || currentSalesOrder.payment_status
                                    }}
                                </span>
                                <span
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    {{
                                        currentSalesOrder.customer_name ||
                                        'Sin cliente'
                                    }}
                                </span>
                                <span
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    {{
                                        new Date(
                                            currentSalesOrder.date,
                                        ).toLocaleDateString('es-MX')
                                    }}
                                </span>
                                <span
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    {{ itemCount }} Artículos
                                </span>
                            </div>
                            <p
                                class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white"
                            >
                                {{ currentSalesOrder.formatted_total }}
                            </p>
                        </div>
                    </div>

                    <div
                        class="flex flex-wrap items-center justify-start gap-2 xl:justify-end"
                    >
                        <button
                            @click="showPrintModal = true"
                            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            <Printer :size="16" />
                            Imprimir
                        </button>
                        <button
                            v-if="
                                currentSalesOrder.status === 'draft' ||
                                currentSalesOrder.status === 'pending'
                            "
                            @click="
                                router.visit(`/sales-orders/${props.id}/edit`)
                            "
                            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            <Edit :size="16" />
                            Editar
                        </button>
                        <button
                            v-if="
                                currentSalesOrder.status === 'draft' ||
                                currentSalesOrder.status === 'pending'
                            "
                            @click="handleConfirm"
                            class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                            <CheckCircle :size="16" />
                            Confirmar
                        </button>
                        <button
                            v-if="
                                currentSalesOrder.status === 'confirmed' ||
                                currentSalesOrder.status === 'processing'
                            "
                            @click="handleComplete"
                            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            <CheckCircle :size="16" />
                            Completar
                        </button>
                        <button
                            v-if="
                                currentSalesOrder.status === 'confirmed' ||
                                currentSalesOrder.status === 'completed'
                            "
                            @click="router.visit(`/returns/${props.id}`)"
                            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            <RotateCcw :size="16" />
                            Devolver
                        </button>
                        <button
                            v-if="
                                currentSalesOrder.status === 'confirmed' ||
                                currentSalesOrder.status === 'completed'
                            "
                            @click="openProductPicker"
                            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            <Plus :size="16" />
                            Agregar Artículo
                        </button>
                        <button
                            v-if="
                                currentSalesOrder.status !== 'completed' &&
                                currentSalesOrder.status !== 'cancelled'
                            "
                            @click="handleCancel"
                            class="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                            <XCircle :size="16" />
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Section Navigation -->
            <div
                class="sticky top-0 z-10 flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-border dark:bg-card"
            >
                <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                    @click="scrollToSection('order-summary')"
                >
                    Resumen
                </button>
                <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                    @click="scrollToSection('order-items')"
                >
                    Artículos
                </button>
                <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                    @click="scrollToSection('order-returns')"
                >
                    Devoluciones
                    <span
                        class="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-muted"
                        >{{ orderReturns.length }}</span
                    >
                </button>
                <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                    @click="scrollToSection('order-audit')"
                >
                    Auditoría
                    <span
                        class="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-muted"
                        >{{ auditLogCount }}</span
                    >
                </button>
            </div>

            <!-- Order Info Cards -->
            <div
                id="order-summary"
                class="grid scroll-mt-20 grid-cols-1 gap-3 md:grid-cols-5"
            >
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30"
                        >
                            <User
                                class="text-blue-600 dark:text-blue-400 dark:text-primary"
                                :size="20"
                            />
                        </div>
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                Cliente
                            </p>
                            <p
                                class="font-medium text-gray-900 dark:text-white"
                            >
                                {{
                                    currentSalesOrder.customer_name ||
                                    'Sin cliente'
                                }}
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30"
                        >
                            <Calendar
                                class="text-purple-600 dark:text-purple-400"
                                :size="20"
                            />
                        </div>
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                Fecha
                            </p>
                            <p
                                class="font-medium text-gray-900 dark:text-white"
                            >
                                {{
                                    new Date(
                                        currentSalesOrder.date,
                                    ).toLocaleDateString('es-MX')
                                }}
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-green-100 p-2 dark:bg-green-900/30"
                        >
                            <DollarSign
                                class="text-green-600 dark:text-green-400"
                                :size="20"
                            />
                        </div>
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                Total
                            </p>
                            <p
                                class="font-medium text-gray-900 dark:text-white"
                            >
                                {{ currentSalesOrder.formatted_total }}
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30"
                        >
                            <Package
                                class="text-yellow-600 dark:text-yellow-400"
                                :size="20"
                            />
                        </div>
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                Estado
                            </p>
                            <span
                                :class="[
                                    'rounded-full px-2 py-1 text-xs font-semibold',
                                    getStatusColor(currentSalesOrder.status),
                                ]"
                            >
                                {{ currentSalesOrder.status_label }}
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30"
                        >
                            <CircleDollarSign
                                class="text-indigo-600 dark:text-indigo-400"
                                :size="20"
                            />
                        </div>
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                Pago
                            </p>
                            <span
                                :class="[
                                    'rounded-full px-2 py-1 text-xs font-semibold',
                                    getPaymentStatusColor(
                                        currentSalesOrder.payment_status,
                                    ),
                                ]"
                            >
                                {{
                                    paymentStatusLabels[
                                        currentSalesOrder.payment_status
                                    ] || currentSalesOrder.payment_status
                                }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div
                id="order-items"
                class="scroll-mt-20 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div
                    class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-border"
                >
                    <h2
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Artículos
                    </h2>
                    <span class="text-sm text-gray-500 dark:text-gray-400"
                        >{{ itemCount }} Líneas</span
                    >
                </div>

                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Almacén
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Vendedor
                                </th>
                                <th
                                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Cantidad
                                </th>
                                <th
                                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Precio Unit.
                                </th>
                                <th
                                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Desc.
                                </th>
                                <th
                                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    ITBM
                                </th>
                                <th
                                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                        >
                            <tr
                                v-for="item in currentSalesOrder.items"
                                :key="item.id"
                            >
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-2">
                                        <button
                                            v-if="
                                                !(item as any).is_custom_line &&
                                                item.product_id
                                            "
                                            type="button"
                                            class="text-left text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                                            @click="
                                                router.visit(
                                                    `/products/${item.product_id}`,
                                                )
                                            "
                                        >
                                            {{
                                                item.product_name || 'Producto'
                                            }}
                                        </button>
                                        <div
                                            v-else
                                            class="text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            {{
                                                (item as any)
                                                    .custom_description ||
                                                item.product_name
                                            }}
                                        </div>
                                        <span
                                            v-if="(item as any).is_custom_line"
                                            class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                        >
                                            Miscelaneo
                                        </span>
                                    </div>
                                    <div
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        {{
                                            item.product_sku ||
                                            ((item as any).is_custom_line
                                                ? 'MISC'
                                                : '')
                                        }}
                                    </div>
                                    <div
                                        v-if="item.notes"
                                        class="mt-1 rounded border border-gray-100 bg-gray-50 p-1.5 text-xs text-gray-500 italic dark:border-border dark:bg-muted dark:text-gray-400"
                                    >
                                        <span
                                            class="font-medium text-gray-700 not-italic dark:text-gray-300"
                                            >Nota:</span
                                        >
                                        {{ item.notes }}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 text-sm text-gray-900 dark:text-white"
                                >
                                    {{
                                        (item as any).is_custom_line
                                            ? 'N/A'
                                            : item.warehouse_name
                                    }}
                                </td>
                                <td
                                    class="px-4 py-3 text-sm text-gray-900 dark:text-white"
                                >
                                    <span
                                        v-if="item.seller_name"
                                        class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    >
                                        {{ item.seller_name }}
                                    </span>
                                    <span v-else class="text-xs text-gray-400"
                                        >—</span
                                    >
                                </td>
                                <td
                                    class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    {{ item.quantity }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    ${{ item.unit_price }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    <span
                                        v-if="
                                            Number(item.discount_amount || 0) >
                                            0
                                        "
                                        >-${{ item.discount_amount }}</span
                                    >
                                    <span v-else class="text-gray-400">-</span>
                                </td>
                                <td
                                    class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    ${{ item.tax_amount }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white"
                                >
                                    {{ item.formatted_total }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Totals -->
                <div
                    class="border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-border dark:bg-background"
                >
                    <div class="ml-auto max-w-md space-y-2">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600 dark:text-gray-400"
                                >Subtotal:</span
                            >
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                                >${{ currentSalesOrder.subtotal }}</span
                            >
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600 dark:text-gray-400"
                                >Impuestos:</span
                            >
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                                >${{ currentSalesOrder.tax_amount }}</span
                            >
                        </div>
                        <div
                            v-if="currentSalesOrder.discount_amount > 0"
                            class="flex justify-between text-sm"
                        >
                            <span class="text-gray-600 dark:text-gray-400"
                                >Descuento:</span
                            >
                            <span
                                class="font-medium text-red-600 dark:text-red-400"
                                >-${{ currentSalesOrder.discount_amount }}</span
                            >
                        </div>
                        <div
                            v-if="currentSalesOrder.shipping_cost > 0"
                            class="flex justify-between text-sm"
                        >
                            <span class="text-gray-600 dark:text-gray-400"
                                >Envío:</span
                            >
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                                >${{ currentSalesOrder.shipping_cost }}</span
                            >
                        </div>
                        <div
                            class="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold dark:border-border"
                        >
                            <span class="text-gray-900 dark:text-white"
                                >Total:</span
                            >
                            <span class="text-gray-900 dark:text-white">{{
                                currentSalesOrder.formatted_total
                            }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Notes -->
            <div
                v-if="currentSalesOrder.notes"
                class="rounded-lg border border-gray-200 bg-white p-6 dark:border-border dark:bg-card"
            >
                <h3
                    class="mb-2 text-lg font-semibold text-gray-900 dark:text-white"
                >
                    Notas
                </h3>
                <p class="text-gray-700 dark:text-gray-300">
                    {{ currentSalesOrder.notes }}
                </p>
            </div>
            <!-- Returns History -->
            <div
                id="order-returns"
                class="scroll-mt-20 rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <div class="mb-3 flex items-center justify-between">
                    <h3
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Devoluciones
                    </h3>
                    <span
                        class="text-sm font-medium text-red-600 dark:text-red-400"
                        >-${{ returnsTotal.toFixed(2) }}</span
                    >
                </div>
                <div v-if="orderReturns.length > 0" class="space-y-3">
                    <div
                        v-for="ret in orderReturns"
                        :key="ret.id"
                        class="rounded-lg border border-gray-200 p-4 dark:border-border"
                    >
                        <div class="mb-2 flex items-center justify-between">
                            <div>
                                <span
                                    class="font-semibold text-gray-900 dark:text-white"
                                    >{{ ret.return_number }}</span
                                >
                                <span
                                    class="ml-2 rounded-full px-2 py-0.5 text-xs font-medium"
                                    :class="
                                        ret.status === 'approved'
                                            ? 'bg-green-100 text-green-800'
                                            : ret.status === 'rejected'
                                              ? 'bg-red-100 text-red-800'
                                              : 'bg-yellow-100 text-yellow-800'
                                    "
                                >
                                    {{
                                        ret.status === 'approved'
                                            ? 'Aprobada'
                                            : ret.status === 'rejected'
                                              ? 'Rechazada'
                                              : 'Pendiente'
                                    }}
                                </span>
                            </div>
                            <span class="text-sm font-bold text-red-600"
                                >${{
                                    Number(ret.total_amount).toFixed(2)
                                }}</span
                            >
                        </div>
                        <p v-if="ret.reason" class="mb-2 text-xs text-gray-500">
                            Motivo: {{ ret.reason }}
                        </p>
                        <div class="space-y-1 text-xs text-gray-400">
                            <p v-for="item in ret.items" :key="item.id">
                                • {{ item.product?.name || 'Producto' }} ×
                                {{ item.quantity }} = ${{
                                    Number(item.subtotal).toFixed(2)
                                }}
                            </p>
                        </div>
                    </div>
                </div>
                <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                    Esta venta no tiene devoluciones registradas.
                </p>
            </div>

            <!-- Audit Logs Timeline -->
            <div
                v-if="currentSalesOrder"
                id="order-audit"
                class="scroll-mt-20 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <button
                    @click="showAuditLogs = !showAuditLogs"
                    class="dark:hover:bg-muted/50/50 flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50"
                >
                    <h3
                        class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        <ClipboardList class="h-5 w-5 text-gray-500" />
                        Auditoría de Caja
                        <span
                            class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500 dark:bg-muted"
                        >
                            {{
                                (currentSalesOrder as any).audit_logs?.length ||
                                0
                            }}
                            eventos
                        </span>
                    </h3>
                    <svg
                        class="h-5 w-5 text-gray-400 transition-transform"
                        :class="{ 'rotate-180': showAuditLogs }"
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
                <div
                    v-if="showAuditLogs"
                    class="border-t border-gray-100 px-6 pb-5 dark:border-border"
                >
                    <div
                        v-if="(currentSalesOrder as any).audit_logs?.length"
                        class="relative mt-4 pl-6"
                    >
                        <!-- Vertical line -->
                        <div
                            class="absolute top-1 bottom-1 left-2 w-0.5 bg-gray-200 dark:bg-gray-600"
                        ></div>
                        <div
                            v-for="(log, idx) in (currentSalesOrder as any)
                                .audit_logs"
                            :key="idx"
                            class="relative flex items-start gap-3 pb-3 last:pb-0"
                        >
                            <!-- Dot -->
                            <div
                                class="absolute top-1 -left-[16px] z-10 h-3 w-3 rounded-full border-2 border-white dark:border-border"
                                :class="
                                    log.action === 'checkout_success'
                                        ? 'bg-green-500'
                                        : log.action === 'checkout_error'
                                          ? 'bg-red-500'
                                          : 'bg-indigo-400'
                                "
                            ></div>
                            <!-- Content -->
                            <div class="flex flex-1 items-center gap-2 text-sm">
                                <span
                                    class="w-16 shrink-0 font-mono text-xs text-gray-400"
                                    >{{ formatLogTime(log.timestamp) }}</span
                                >
                                <component
                                    :is="auditActionIcon(log.action)"
                                    class="mt-0.5 h-4 w-4 shrink-0 text-gray-500"
                                />
                                <span
                                    class="font-medium text-gray-700 dark:text-gray-300"
                                    >{{ auditActionLabel(log.action) }}:</span
                                >
                                <span
                                    class="truncate text-gray-500 dark:text-gray-400"
                                    >{{ formatLogDetail(log) }}</span
                                >
                            </div>
                        </div>
                    </div>
                    <div
                        v-else
                        class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                        No hay registros de auditoría disponibles para esta
                        venta.
                    </div>
                </div>
            </div>
        </div>

        <!-- Print Ticket Modal -->
        <PrintTicketModal
            v-if="currentSalesOrder"
            :show="showPrintModal"
            :order-id="currentSalesOrder.id"
            :order-number="currentSalesOrder.order_number"
            @close="showPrintModal = false"
        />

        <!-- Return Modal -->
        <CreateReturnModal
            v-if="currentSalesOrder"
            :show="showReturnModal"
            :order-id="currentSalesOrder.id"
            :order-number="currentSalesOrder.order_number"
            :has-customer="!!currentSalesOrder.customer_id"
            :users="users"
            :current-user-id="(currentSalesOrder as any).user_id"
            :items="
                (currentSalesOrder.items || [])
                    .filter((i: any) => !i.is_custom_line)
                    .map((i: any) => ({
                        id: i.id,
                        product_id: i.product_id,
                        variant_id: i.variant_id,
                        product_name:
                            i.product_name || i.product?.name || 'Producto',
                        product_sku: i.product_sku || i.product?.sku_base || '',
                        quantity: i.quantity,
                        unit_price: Number(i.unit_price),
                        discount_percent: Number(i.discount_percent || 0),
                        tax_percent: Number(i.tax_percent || 0),
                        total: Number(i.total),
                        seller_name: i.seller_name || '',
                    }))
            "
            :loading="returnLoading"
            :error="returnError"
            @submit="handleReturnSubmit"
            @close="
                showReturnModal = false;
                returnError = null;
            "
        />

        <!-- Add Item Modal -->
        <ProductVariantPickerModal
            v-if="currentSalesOrder"
            :show="showAddItemModal"
            :products="pickerProducts"
            :search-query="productSearch"
            :total-count="pickerTotal"
            :has-more="pickerCurrentPage < pickerLastPage"
            :loading-more="pickerLoadingMore"
            :loading="pickerLoading"
            :categories="productFilterCategories"
            :brands="productFilterBrands"
            title="Seleccionar productos para venta"
            confirm-label="Agregar a venta"
            context="pos"
            @close="showAddItemModal = false"
            @confirm="addVariantSelections"
            @load-more="fetchPickerProducts(true)"
            @search="handlePickerSearch"
        />
    </AppLayout>
</template>
