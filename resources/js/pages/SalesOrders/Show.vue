<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    Banknote,
    Boxes,
    CheckCircle,
    DollarSign,
    Edit,
    ExternalLink,
    FileText,
    Package,
    Plus,
    Printer,
    RotateCcw,
    TrendingUp,
    User,
    XCircle,
} from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref } from 'vue';
import BusinessDatetimeEditor from '@/components/BusinessDatetimeEditor.vue';
import TransactionRelationsPanel from '@/components/Traceability/TransactionRelationsPanel.vue';
import TransactionTimeline from '@/components/Traceability/TransactionTimeline.vue';
import CreateReturnModal from '@/components/POS/CreateReturnModal.vue';
import PrintTicketModal from '@/components/POS/PrintTicketModal.vue';
import ProductVariantPickerModal from '@/components/Products/ProductVariantPickerModal.vue';
import { useSalesOrders } from '@/composables/useSalesOrders';
import { useUsers } from '@/composables/useUsers';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { paymentMethodsService } from '@/services/paymentMethods';
import { salesOrdersService } from '@/services/sales-orders';
import { SalesReturnsApiService } from '@/services/sales-returns';
import type { PaymentMethod as ConfiguredPaymentMethod } from '@/types/payment-method';
import type { Product, ProductVariant } from '@/types/product';
import type { ProductVariantSelection } from '@/types/product-variant-picker';
import type {
    SalesOrderOperationalDetail,
    SalesOrderOperationalItem,
} from '@/types/sales-order';

const props = defineProps<{ id: number }>();

type TabKey =
    | 'summary'
    | 'items'
    | 'payments'
    | 'returns'
    | 'inventory'
    | 'profit'
    | 'activity';

const tabs: Array<{ key: TabKey; label: string; icon: any }> = [
    { key: 'summary', label: 'Resumen', icon: FileText },
    { key: 'items', label: 'Items', icon: Package },
    { key: 'payments', label: 'Pagos/AR', icon: Banknote },
    { key: 'returns', label: 'Devoluciones', icon: RotateCcw },
    { key: 'inventory', label: 'Inventario', icon: Boxes },
    { key: 'profit', label: 'Rentabilidad', icon: TrendingUp },
    { key: 'activity', label: 'Actividad', icon: Activity },
];

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

const { users, fetchUsers } = useUsers();

const operationalDetail = ref<SalesOrderOperationalDetail | null>(null);
const operationalLoading = ref(false);
const operationalError = ref<string | null>(null);
const activeTab = ref<TabKey>('summary');
const showPrintModal = ref(false);
const showReturnModal = ref(false);
const showAddItemModal = ref(false);
const showCancellationModal = ref(false);
const cancellationLoading = ref(false);
const cancellationError = ref<string | null>(null);
const cancellationReason = ref('');
const cancellationNotes = ref('');
const cancellationMethod = ref<string>('');
const cancellationMethods = ref<ConfiguredPaymentMethod[]>([]);
const cancellationFinancialAccountId = ref<number | null>(null);
const cancellationFinancialAccounts = ref<
    Array<{ endpoint_id: number; name: string; masked_number?: string | null }>
>([]);
const cancellationAccountsError = ref<string | null>(null);
const cancellationReasonInput = ref<HTMLTextAreaElement | null>(null);
const returnLoading = ref(false);
const returnError = ref<string | null>(null);
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

const order = computed(() => operationalDetail.value?.order ?? null);
const items = computed(() => operationalDetail.value?.items ?? []);
const payments = computed(() => operationalDetail.value?.payments ?? []);
const returns = computed(() => operationalDetail.value?.returns ?? []);
const movements = computed(
    () => operationalDetail.value?.inventory_context.movements ?? [],
);
const audit = computed(() => operationalDetail.value?.audit ?? []);

const paymentStatusLabels: Record<string, string> = {
    pending: 'Pendiente',
    partial: 'Parcial',
    paid: 'Pagado',
    refunded: 'Reembolsado',
    refund_pending: 'Reembolso pendiente',
    voided_unpaid: 'Sin cobro',
};

const statusLabels: Record<string, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    processing: 'En proceso',
    completed: 'Completada',
    cancelled: 'Cancelada',
};

const itemCount = computed(() => items.value.length);
const returnsTotal = computed(() =>
    returns.value.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
);
const paidTotal = computed(
    () => operationalDetail.value?.ar_context.amount_paid ?? 0,
);
const amountDue = computed(
    () => operationalDetail.value?.ar_context.amount_due ?? 0,
);
const cancellationRequiresSettlement = computed(() =>
    ['confirmed', 'processing', 'completed'].includes(
        order.value?.status || '',
    ),
);
const cancellationOptions = computed(() => {
    const options: Array<{ code: string; name: string }> = [];
    if (customer.value && amountDue.value > 0) {
        options.push({ code: 'receivable', name: 'Reducir CxC' });
    }
    options.push(
        ...cancellationMethods.value
            .filter(
                (method) =>
                    method.is_active &&
                    !['credit', 'store_credit', 'supplier_credit'].includes(
                        method.code,
                    ),
            )
            .map((method) => ({ code: method.code, name: method.name })),
    );
    if (customer.value) {
        options.push({ code: 'store_credit', name: 'Saldo a favor' });
    }
    return options.filter(
        (option, index, rows) =>
            rows.findIndex((row) => row.code === option.code) === index,
    );
});
const cancellationIsBank = computed(
    () =>
        cancellationMethods.value.find(
            (method) => method.code === cancellationMethod.value,
        )?.liquidity_bucket === 'bank',
);
const customer = computed(() => order.value?.customer ?? null);

const selectedWarehouseId = computed(() => {
    const catalogItem = items.value.find(
        (item) => !item.is_custom_line && item.warehouse_id,
    );
    return Number(
        catalogItem?.warehouse_id ?? items.value[0]?.warehouse_id ?? 1,
    );
});

const canEditBaseOrder = computed(
    () =>
        currentSalesOrder.value?.status === 'draft' ||
        currentSalesOrder.value?.status === 'pending',
);

const canActOnConfirmedOrder = computed(
    () =>
        currentSalesOrder.value?.status === 'confirmed' ||
        currentSalesOrder.value?.status === 'processing' ||
        currentSalesOrder.value?.status === 'completed',
);

const loadOperationalDetail = async (): Promise<void> => {
    operationalLoading.value = true;
    operationalError.value = null;
    try {
        operationalDetail.value = await salesOrdersService.getOperationalDetail(
            props.id,
        );
    } catch (err: any) {
        operationalError.value =
            err.response?.data?.message ||
            'No se pudo cargar la ficha operativa.';
    } finally {
        operationalLoading.value = false;
    }
};

const refreshOrder = async (): Promise<void> => {
    await Promise.all([fetchSalesOrderById(props.id), loadOperationalDetail()]);
};

const updateOrderBusinessDatetime = (value: string | null): void => {
    if (operationalDetail.value?.order) {
        operationalDetail.value.order.business_datetime = value;
    }
};

const updatePaymentBusinessDatetime = (
    paymentId: number,
    value: string | null,
): void => {
    const payment = payments.value.find((row) => row.id === paymentId);
    if (payment) {
        payment.business_datetime = value;
    }
};

const updateMovementBusinessDatetime = (
    movementId: number,
    value: string | null,
): void => {
    const movement = movements.value.find((row) => row.id === movementId);
    if (movement) {
        movement.business_datetime = value;
    }
};

const formatCurrency = (value?: number | string | null): string =>
    Number(value ?? 0).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
    });

const formatDate = (value?: string | null): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('es-PA');
};

const formatDateTime = (value?: string | null): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('es-PA', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

const statusClass = (status?: string): string => {
    const classes: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-200',
        pending:
            'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        confirmed:
            'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
        processing:
            'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
        completed:
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
        cancelled:
            'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
    };
    return classes[status || 'draft'] ?? classes.draft;
};

const paymentClass = (status?: string): string => {
    const classes: Record<string, string> = {
        pending:
            'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        partial:
            'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
        paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
        refunded:
            'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200',
    };
    return classes[status || 'pending'] ?? classes.pending;
};

const handleConfirm = async (): Promise<void> => {
    if (!confirm('¿Confirmar esta orden? Esto descontará el inventario.'))
        return;
    await confirmSalesOrder(props.id);
    await refreshOrder();
};

const handleComplete = async (): Promise<void> => {
    if (!confirm('¿Marcar esta orden como completada?')) return;
    await completeSalesOrder(props.id);
    await refreshOrder();
};

const openCancellationModal = async (): Promise<void> => {
    cancellationReason.value = '';
    cancellationNotes.value = '';
    cancellationError.value = null;
    cancellationAccountsError.value = null;
    cancellationFinancialAccountId.value = null;
    try {
        cancellationMethods.value = await paymentMethodsService.getActive(
            'returns',
            true,
        );
    } catch {
        cancellationMethods.value = [];
    }
    try {
        const accountsResponse = await apiClient.get(
            '/money-accounts/options',
            {
                params: { type: 'bank', purpose: 'settlement' },
            },
        );
        cancellationFinancialAccounts.value = accountsResponse.data?.data ?? [];
    } catch {
        cancellationFinancialAccounts.value = [];
        cancellationAccountsError.value =
            'No se pudieron cargar las cuentas bancarias.';
    }
    cancellationMethod.value =
        customer.value && amountDue.value > 0
            ? 'receivable'
            : cancellationOptions.value[0]?.code || '';
    showCancellationModal.value = true;
    await nextTick();
    cancellationReasonInput.value?.focus();
};

const handleCancel = async (): Promise<void> => {
    if (cancellationReason.value.trim().length < 3) {
        cancellationError.value = 'Explique el motivo de la anulación.';
        return;
    }
    if (cancellationRequiresSettlement.value && !cancellationMethod.value) {
        cancellationError.value = 'Seleccione cómo se resolverá la anulación.';
        return;
    }
    if (cancellationIsBank.value && !cancellationFinancialAccountId.value) {
        cancellationError.value =
            'Seleccione una cuenta bancaria para el reembolso.';
        return;
    }

    cancellationLoading.value = true;
    cancellationError.value = null;
    try {
        await cancelSalesOrder(props.id, {
            reason: cancellationReason.value.trim(),
            refund_method: cancellationMethod.value || null,
            financial_account_id: cancellationIsBank.value
                ? cancellationFinancialAccountId.value
                : null,
            notes: cancellationNotes.value.trim() || null,
        });
        showCancellationModal.value = false;
        await refreshOrder();
    } catch (err: any) {
        cancellationError.value =
            err.response?.data?.message ||
            err.message ||
            'No se pudo anular la factura.';
    } finally {
        cancellationLoading.value = false;
    }
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
    item: SalesOrderOperationalItem,
    payload: Record<string, unknown>,
): Promise<void> => {
    if (!item.added_after_sale || savingItemIds.value.has(item.id)) return;
    setItemSaving(item.id, true);
    try {
        await updateOrderItem(item.id, payload);
        await refreshOrder();
    } finally {
        setItemSaving(item.id, false);
    }
};

const handleReturnSubmit = async (payload: {
    idempotency_key: string;
    reason: string;
    refund_method: string;
    refund_notes: string;
    items: {
        sales_order_item_id: number;
        quantity: number;
        user_id: number | null;
    }[];
}): Promise<void> => {
    returnLoading.value = true;
    returnError.value = null;
    try {
        await SalesReturnsApiService.createForOrder(props.id, {
            ...payload,
            approve_immediately: true,
        });
        showReturnModal.value = false;
        await refreshOrder();
    } catch (err: any) {
        const errData = err.response?.data;
        returnError.value = Array.isArray(errData?.errors)
            ? errData.errors.join('\n')
            : errData?.message || 'Error al procesar la devolución';
    } finally {
        returnLoading.value = false;
    }
};

const fetchProductFilterOptions = async (): Promise<void> => {
    try {
        const [categoriesResponse, brandsResponse] = await Promise.all([
            apiClient.get('/categories'),
            apiClient.get('/brands'),
        ]);
        productFilterCategories.value =
            categoriesResponse.data.data ?? categoriesResponse.data ?? [];
        productFilterBrands.value =
            brandsResponse.data.data ?? brandsResponse.data ?? [];
    } catch {
        productFilterCategories.value = [];
        productFilterBrands.value = [];
    }
};

const fetchPickerProducts = async (append = false): Promise<void> => {
    if (append && pickerCurrentPage.value >= pickerLastPage.value) return;
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

const openProductPicker = async (): Promise<void> => {
    showAddItemModal.value = true;
    pickerFilters.value = { query: productSearch.value };
    await fetchPickerProducts();
};

const handlePickerSearch = (filters: typeof pickerFilters.value): void => {
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

const taxRateFor = (product: Product, variant: ProductVariant | null): number =>
    Math.max(
        0,
        Math.min(
            100,
            Math.round(
                Number(
                    variant?.pricing?.sale_tax_rate ??
                        variant?.pricing?.tax_rate ??
                        product.pricing?.sale_tax_rate ??
                        product.pricing?.tax_rate ??
                        0,
                ),
            ),
        ),
    );

const addVariantSelections = async (
    selections: ProductVariantSelection[],
): Promise<void> => {
    if (!currentSalesOrder.value || selections.length === 0) return;
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
                seller_id: currentSalesOrder.value.user_id ?? null,
            },
        );
    }
    showAddItemModal.value = false;
    productSearch.value = '';
    pickerProducts.value = [];
    await refreshOrder();
};

onMounted(async () => {
    await Promise.all([
        refreshOrder(),
        fetchUsers(),
        fetchProductFilterOptions(),
    ]);
    if (
        new URLSearchParams(window.location.search).get('action') ===
            'cancel' &&
        currentSalesOrder.value?.status !== 'cancelled'
    ) {
        await openCancellationModal();
    }
});
</script>

<template>
    <Head :title="`Factura ${order?.order_number || ''}`" />

    <AppLayout>
        <div
            v-if="loading || operationalLoading"
            class="p-8 text-sm text-gray-500"
        >
            Cargando ficha operativa...
        </div>

        <div
            v-else-if="error || operationalError"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
        >
            {{ error || operationalError }}
        </div>

        <div v-else-if="order && operationalDetail" class="space-y-4">
            <section
                class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div
                    class="flex flex-col gap-4 border-b border-gray-200 p-4 xl:flex-row xl:items-start xl:justify-between dark:border-border"
                >
                    <div class="min-w-0">
                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                class="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted"
                                title="Volver"
                                @click="router.visit('/sales-orders')"
                            >
                                <ArrowLeft :size="20" />
                            </button>
                            <div>
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Orden de venta / factura
                                </p>
                                <h1
                                    class="font-mono text-2xl font-bold text-gray-900 dark:text-white"
                                >
                                    {{ order.order_number }}
                                </h1>
                            </div>
                        </div>
                        <div class="mt-3 flex flex-wrap items-center gap-2">
                            <span
                                class="rounded-full px-2 py-1 text-xs font-semibold"
                                :class="statusClass(order.status)"
                            >
                                {{ statusLabels[order.status] || order.status }}
                            </span>
                            <span
                                class="rounded-full px-2 py-1 text-xs font-semibold"
                                :class="paymentClass(order.payment_status)"
                            >
                                {{
                                    paymentStatusLabels[
                                        order.payment_display_status ||
                                            order.payment_status
                                    ] ||
                                    order.payment_display_status ||
                                    order.payment_status
                                }}
                            </span>
                            <button
                                v-if="customer"
                                type="button"
                                class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                @click="
                                    router.visit(`/customers/${customer.id}`)
                                "
                            >
                                <User :size="14" />
                                {{ customer.name }}
                            </button>
                            <span v-else class="text-sm text-gray-500">
                                Sin cliente
                            </span>
                            <span class="text-sm text-gray-500">
                                {{ formatDate(order.date) }}
                            </span>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                            @click="showPrintModal = true"
                        >
                            <Printer :size="16" />
                            Imprimir
                        </button>
                        <button
                            v-if="canEditBaseOrder"
                            type="button"
                            class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                            @click="
                                router.visit(`/sales-orders/${props.id}/edit`)
                            "
                        >
                            <Edit :size="16" />
                            Editar
                        </button>
                        <button
                            v-if="canEditBaseOrder"
                            type="button"
                            class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                            @click="handleConfirm"
                        >
                            <CheckCircle :size="16" />
                            Confirmar
                        </button>
                        <button
                            v-if="
                                currentSalesOrder?.status === 'confirmed' ||
                                currentSalesOrder?.status === 'processing'
                            "
                            type="button"
                            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                            @click="handleComplete"
                        >
                            <CheckCircle :size="16" />
                            Completar
                        </button>
                        <button
                            v-if="canActOnConfirmedOrder"
                            type="button"
                            class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                            @click="showReturnModal = true"
                        >
                            <RotateCcw :size="16" />
                            Devolver
                        </button>
                        <button
                            v-if="canActOnConfirmedOrder"
                            type="button"
                            class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                            @click="openProductPicker"
                        >
                            <Plus :size="16" />
                            Agregar item
                        </button>
                        <button
                            v-if="currentSalesOrder?.status !== 'cancelled'"
                            type="button"
                            class="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                            @click="openCancellationModal"
                        >
                            <XCircle :size="16" />
                            Cancelar
                        </button>
                    </div>
                </div>

                <div class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
                    <div class="rounded-md bg-gray-50 p-3 dark:bg-muted/40">
                        <p class="text-xs text-gray-500">Total</p>
                        <p
                            class="mt-1 text-xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ formatCurrency(order.total) }}
                        </p>
                    </div>
                    <div class="rounded-md bg-gray-50 p-3 dark:bg-muted/40">
                        <p class="text-xs text-gray-500">Cobrado real</p>
                        <p class="mt-1 text-xl font-bold text-emerald-600">
                            {{ formatCurrency(paidTotal) }}
                        </p>
                    </div>
                    <div class="rounded-md bg-gray-50 p-3 dark:bg-muted/40">
                        <p class="text-xs text-gray-500">Saldo</p>
                        <p class="mt-1 text-xl font-bold text-amber-600">
                            {{ formatCurrency(amountDue) }}
                        </p>
                    </div>
                    <div class="rounded-md bg-gray-50 p-3 dark:bg-muted/40">
                        <p class="text-xs text-gray-500">Devuelto</p>
                        <p class="mt-1 text-xl font-bold text-red-600">
                            {{ formatCurrency(returnsTotal) }}
                        </p>
                    </div>
                    <div class="rounded-md bg-gray-50 p-3 dark:bg-muted/40">
                        <p class="text-xs text-gray-500">Items</p>
                        <p
                            class="mt-1 text-xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ itemCount }}
                        </p>
                    </div>
                    <div class="rounded-md bg-gray-50 p-3 dark:bg-muted/40">
                        <p class="text-xs text-gray-500">Margen bruto</p>
                        <p
                            class="mt-1 text-xl font-bold text-gray-900 dark:text-white"
                        >
                            {{
                                operationalDetail.profit_summary
                                    .gross_margin_percent ?? 0
                            }}%
                        </p>
                    </div>
                </div>
            </section>

            <nav
                class="sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-border dark:bg-card"
            >
                <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    type="button"
                    class="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold"
                    :class="
                        activeTab === tab.key
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted'
                    "
                    @click="activeTab = tab.key"
                >
                    <component :is="tab.icon" :size="15" />
                    {{ tab.label }}
                </button>
            </nav>

            <section
                v-if="activeTab === 'summary'"
                class="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"
            >
                <div
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 px-4 py-3 dark:border-border"
                    >
                        <h2
                            class="text-sm font-bold text-gray-900 dark:text-white"
                        >
                            Datos generales
                        </h2>
                    </div>
                    <div class="grid gap-3 p-4 md:grid-cols-2">
                        <div>
                            <p class="text-xs text-gray-500">Cliente</p>
                            <p
                                class="font-semibold text-gray-900 dark:text-white"
                            >
                                {{ customer?.name || 'Sin cliente' }}
                            </p>
                            <p class="text-xs text-gray-500">
                                {{ customer?.code || 'Sin código' }}
                            </p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Vendedor</p>
                            <p
                                class="font-semibold text-gray-900 dark:text-white"
                            >
                                {{ order.user?.name || 'Sistema' }}
                            </p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Caja</p>
                            <button
                                v-if="order.pos_session"
                                type="button"
                                class="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
                                @click="router.visit('/pos-sessions')"
                            >
                                Sesión #{{ order.pos_session.id }}
                                <ExternalLink :size="13" />
                            </button>
                            <p
                                v-else
                                class="font-semibold text-gray-900 dark:text-white"
                            >
                                Sin sesión
                            </p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Bodega</p>
                            <p
                                class="font-semibold text-gray-900 dark:text-white"
                            >
                                {{
                                    order.pos_session?.warehouse_name ||
                                    items[0]?.warehouse_name ||
                                    'N/A'
                                }}
                            </p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Carro</p>
                            <p
                                class="font-semibold text-gray-900 dark:text-white"
                            >
                                {{
                                    order.customer_vehicle
                                        ? [
                                              order.customer_vehicle.make,
                                              order.customer_vehicle.model,
                                              order.customer_vehicle.year,
                                          ]
                                              .filter(Boolean)
                                              .join(' ')
                                        : 'Sin carro'
                                }}
                            </p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Preparación</p>
                            <p
                                class="font-semibold text-gray-900 dark:text-white"
                            >
                                {{
                                    order.prepared_at
                                        ? `Preparada ${formatDateTime(order.prepared_at)}`
                                        : order.sent_to_warehouse_at
                                          ? 'Enviada a bodega'
                                          : 'Sin envío a bodega'
                                }}
                            </p>
                        </div>
                    </div>
                    <div
                        class="border-t border-gray-200 p-4 dark:border-border"
                    >
                        <BusinessDatetimeEditor
                            record-type="sales_order"
                            :record-id="order.id"
                            :created-at="order.created_at"
                            :business-datetime="order.business_datetime"
                            @updated="updateOrderBusinessDatetime"
                        />
                    </div>
                    <div
                        v-if="order.notes || order.internal_notes"
                        class="border-t border-gray-200 p-4 text-sm dark:border-border"
                    >
                        <p
                            v-if="order.notes"
                            class="text-gray-700 dark:text-gray-300"
                        >
                            {{ order.notes }}
                        </p>
                        <p
                            v-if="order.internal_notes"
                            class="mt-2 text-amber-700 dark:text-amber-200"
                        >
                            {{ order.internal_notes }}
                        </p>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 px-4 py-3 dark:border-border"
                    >
                        <h2
                            class="text-sm font-bold text-gray-900 dark:text-white"
                        >
                            Accesos
                        </h2>
                    </div>
                    <div class="space-y-2 p-4">
                        <button
                            v-if="customer"
                            type="button"
                            class="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-border dark:hover:bg-muted"
                            @click="router.visit(`/customers/${customer.id}`)"
                        >
                            Ficha cliente
                            <ExternalLink :size="14" />
                        </button>
                        <button
                            v-if="customer"
                            type="button"
                            class="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-border dark:hover:bg-muted"
                            @click="
                                router.visit(`/ar?customer_id=${customer.id}`)
                            "
                        >
                            Cobros AR
                            <ExternalLink :size="14" />
                        </button>
                        <button
                            type="button"
                            class="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-border dark:hover:bg-muted"
                            @click="activeTab = 'inventory'"
                        >
                            Trazabilidad inventario
                            <ExternalLink :size="14" />
                        </button>
                    </div>
                </div>
            </section>

            <section
                v-if="activeTab === 'items'"
                class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead
                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                        >
                            <tr>
                                <th class="px-3 py-2 text-left">Item</th>
                                <th class="px-3 py-2 text-left">Bodega</th>
                                <th class="px-3 py-2 text-right">Cant.</th>
                                <th class="px-3 py-2 text-right">Precio</th>
                                <th class="px-3 py-2 text-right">ITBM</th>
                                <th class="px-3 py-2 text-right">Total</th>
                                <th class="px-3 py-2 text-right">Costo</th>
                                <th class="px-3 py-2 text-right">Utilidad</th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <tr v-for="item in items" :key="item.id">
                                <td class="px-3 py-3">
                                    <button
                                        v-if="
                                            !item.is_custom_line &&
                                            item.product_id
                                        "
                                        type="button"
                                        class="text-left font-semibold text-indigo-600 hover:underline"
                                        @click="
                                            router.visit(
                                                `/products/${item.product_id}`,
                                            )
                                        "
                                    >
                                        {{ item.product_name }}
                                    </button>
                                    <p
                                        v-else
                                        class="font-semibold text-gray-900 dark:text-white"
                                    >
                                        {{
                                            item.custom_description ||
                                            item.product_name
                                        }}
                                    </p>
                                    <p class="font-mono text-xs text-gray-500">
                                        {{
                                            item.variant_sku ||
                                            item.product_sku ||
                                            (item.is_custom_line ? 'MISC' : '')
                                        }}
                                    </p>
                                    <div class="mt-1 flex flex-wrap gap-1">
                                        <span
                                            v-if="item.brand_name"
                                            class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                                        >
                                            {{ item.brand_name }}
                                        </span>
                                        <span
                                            v-if="item.added_after_sale"
                                            class="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700"
                                        >
                                            Post-venta
                                        </span>
                                        <span
                                            v-if="item.is_custom_line"
                                            class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                                        >
                                            Misceláneo
                                        </span>
                                    </div>
                                </td>
                                <td
                                    class="px-3 py-3 text-gray-700 dark:text-gray-300"
                                >
                                    {{ item.warehouse_name || 'N/A' }}
                                    <p
                                        v-if="item.seller_name"
                                        class="text-xs text-gray-500"
                                    >
                                        {{ item.seller_name }}
                                    </p>
                                </td>
                                <td class="px-3 py-3 text-right">
                                    <input
                                        v-if="item.added_after_sale"
                                        :value="item.quantity"
                                        type="number"
                                        min="1"
                                        class="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm dark:border-border dark:bg-muted"
                                        :disabled="savingItemIds.has(item.id)"
                                        @change="
                                            updatePostSaleItem(item, {
                                                quantity: Math.max(
                                                    1,
                                                    Number(
                                                        (
                                                            $event.target as HTMLInputElement
                                                        ).value,
                                                    ) || 1,
                                                ),
                                            })
                                        "
                                    />
                                    <span v-else>{{ item.quantity }}</span>
                                </td>
                                <td class="px-3 py-3 text-right">
                                    <input
                                        v-if="item.added_after_sale"
                                        :value="item.unit_price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        class="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm dark:border-border dark:bg-muted"
                                        :disabled="savingItemIds.has(item.id)"
                                        @change="
                                            updatePostSaleItem(item, {
                                                unit_price:
                                                    Number(
                                                        (
                                                            $event.target as HTMLInputElement
                                                        ).value,
                                                    ) || 0,
                                            })
                                        "
                                    />
                                    <span v-else>{{
                                        formatCurrency(item.unit_price)
                                    }}</span>
                                </td>
                                <td class="px-3 py-3 text-right">
                                    {{ formatCurrency(item.tax_amount) }}
                                </td>
                                <td class="px-3 py-3 text-right font-semibold">
                                    {{ formatCurrency(item.total) }}
                                </td>
                                <td class="px-3 py-3 text-right">
                                    {{ formatCurrency(item.total_cost) }}
                                </td>
                                <td
                                    class="px-3 py-3 text-right font-semibold"
                                    :class="
                                        item.gross_profit >= 0
                                            ? 'text-emerald-600'
                                            : 'text-red-600'
                                    "
                                >
                                    {{ formatCurrency(item.gross_profit) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section
                v-if="activeTab === 'payments'"
                class="grid gap-4 xl:grid-cols-[1fr_22rem]"
            >
                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <table class="min-w-full text-sm">
                        <thead
                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                        >
                            <tr>
                                <th class="px-3 py-2 text-left">Método</th>
                                <th class="px-3 py-2 text-left">Fecha</th>
                                <th class="px-3 py-2 text-left">Usuario</th>
                                <th class="px-3 py-2 text-left">Notas</th>
                                <th class="px-3 py-2 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <tr v-if="payments.length === 0">
                                <td
                                    colspan="5"
                                    class="px-3 py-8 text-center text-gray-500"
                                >
                                    Sin pagos registrados.
                                </td>
                            </tr>
                            <tr v-for="payment in payments" :key="payment.id">
                                <td class="px-3 py-2 font-semibold">
                                    {{ payment.method_label }}
                                    <span
                                        v-if="payment.is_refund"
                                        class="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-700"
                                    >
                                        Reembolso
                                    </span>
                                </td>
                                <td class="px-3 py-2">
                                    <div class="mb-2">
                                        {{ formatDateTime(payment.paid_at) }}
                                    </div>
                                    <BusinessDatetimeEditor
                                        compact
                                        record-type="sales_order_payment"
                                        :record-id="payment.id"
                                        :created-at="payment.paid_at"
                                        :business-datetime="
                                            payment.business_datetime
                                        "
                                        @updated="
                                            (value) =>
                                                updatePaymentBusinessDatetime(
                                                    payment.id,
                                                    value,
                                                )
                                        "
                                    />
                                </td>
                                <td class="px-3 py-2">
                                    {{ payment.creator_name || 'Sistema' }}
                                </td>
                                <td class="max-w-sm px-3 py-2 text-gray-600">
                                    {{ payment.notes || '-' }}
                                </td>
                                <td
                                    class="px-3 py-2 text-right font-mono font-semibold"
                                    :class="
                                        payment.amount < 0
                                            ? 'text-red-600'
                                            : 'text-emerald-600'
                                    "
                                >
                                    {{ formatCurrency(payment.amount) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <aside
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <h2 class="text-sm font-bold text-gray-900 dark:text-white">
                        Estado AR
                    </h2>
                    <div class="mt-3 space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Total</span>
                            <span class="font-mono">{{
                                formatCurrency(order.total)
                            }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">Cobrado real</span>
                            <span class="font-mono text-emerald-600">
                                {{ formatCurrency(paidTotal) }}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">Devuelto</span>
                            <span class="font-mono text-red-600">
                                {{ formatCurrency(returnsTotal) }}
                            </span>
                        </div>
                        <div
                            class="flex justify-between border-t pt-2 dark:border-border"
                        >
                            <span class="font-semibold">Saldo</span>
                            <span class="font-mono font-bold text-amber-600">
                                {{ formatCurrency(amountDue) }}
                            </span>
                        </div>
                    </div>
                    <button
                        v-if="customer"
                        type="button"
                        class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        @click="router.visit(`/ar?customer_id=${customer.id}`)"
                    >
                        <DollarSign :size="15" />
                        Ir a cobros
                    </button>
                </aside>
            </section>

            <section
                v-if="activeTab === 'returns'"
                class="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <div
                    v-if="returns.length === 0"
                    class="py-8 text-center text-sm text-gray-500"
                >
                    Esta factura no tiene devoluciones.
                </div>
                <div
                    v-for="ret in returns"
                    :key="ret.id"
                    class="rounded-md border border-gray-200 p-3 dark:border-border"
                >
                    <div
                        class="flex flex-wrap items-start justify-between gap-3"
                    >
                        <div>
                            <p
                                class="font-mono font-bold text-gray-900 dark:text-white"
                            >
                                <button
                                    type="button"
                                    class="text-cyan-700 hover:underline"
                                    @click="router.visit(`/returns/${ret.id}`)"
                                >
                                    {{ ret.return_number }}
                                </button>
                            </p>
                            <p class="text-xs text-gray-500">
                                {{ ret.processed_by_name || 'Sistema' }} ·
                                {{ formatDateTime(ret.created_at) }}
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="font-mono font-bold text-red-600">
                                {{ formatCurrency(ret.total_amount) }}
                            </p>
                            <p class="text-xs text-gray-500">
                                {{ ret.refund_method || 'N/A' }}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="mt-3 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:border-border dark:hover:bg-muted/40"
                        @click="router.visit(`/returns/${ret.id}`)"
                    >
                        <ExternalLink :size="13" />
                        Ver ficha completa
                    </button>
                    <p v-if="ret.reason" class="mt-2 text-sm text-gray-600">
                        {{ ret.reason }}
                    </p>
                    <div class="mt-3 overflow-x-auto">
                        <table class="min-w-full text-xs">
                            <tbody>
                                <tr v-for="item in ret.items" :key="item.id">
                                    <td class="py-1 pr-3">
                                        {{ item.product_name || 'Producto' }}
                                    </td>
                                    <td class="py-1 text-right">
                                        x{{ item.quantity }}
                                    </td>
                                    <td class="py-1 pl-3 text-right font-mono">
                                        {{ formatCurrency(item.subtotal) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section
                v-if="activeTab === 'inventory'"
                class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <table class="min-w-full text-sm">
                    <thead
                        class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                    >
                        <tr>
                            <th class="px-3 py-2 text-left">Movimiento</th>
                            <th class="px-3 py-2 text-left">Item</th>
                            <th class="px-3 py-2 text-left">Bodega</th>
                            <th class="px-3 py-2 text-right">Cantidad</th>
                            <th class="px-3 py-2 text-left">Lotes</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-border">
                        <tr v-if="movements.length === 0">
                            <td
                                colspan="5"
                                class="px-3 py-8 text-center text-gray-500"
                            >
                                Sin movimientos relacionados.
                            </td>
                        </tr>
                        <tr v-for="movement in movements" :key="movement.id">
                            <td class="px-3 py-3">
                                <button
                                    type="button"
                                    class="font-mono font-semibold text-indigo-600 hover:underline"
                                    @click="
                                        router.visit(
                                            `/inventory-movements/${movement.id}`,
                                        )
                                    "
                                >
                                    #{{ movement.id }}
                                </button>
                                <p class="text-xs text-gray-500">
                                    {{ movement.reference_type }} ·
                                    {{ formatDateTime(movement.created_at) }}
                                </p>
                                <div class="mt-2">
                                    <BusinessDatetimeEditor
                                        compact
                                        record-type="inventory_movement"
                                        :record-id="movement.id"
                                        :created-at="movement.created_at"
                                        :business-datetime="
                                            movement.business_datetime
                                        "
                                        @updated="
                                            (value) =>
                                                updateMovementBusinessDatetime(
                                                    movement.id,
                                                    value,
                                                )
                                        "
                                    />
                                </div>
                            </td>
                            <td class="px-3 py-3">
                                {{ movement.product_name || 'Producto' }}
                                <p class="font-mono text-xs text-gray-500">
                                    {{
                                        movement.variant_sku ||
                                        movement.product_sku ||
                                        ''
                                    }}
                                </p>
                            </td>
                            <td class="px-3 py-3">
                                {{ movement.warehouse_name || 'N/A' }}
                            </td>
                            <td class="px-3 py-3 text-right font-mono">
                                {{ movement.quantity }}
                            </td>
                            <td class="px-3 py-3">
                                <div
                                    v-if="movement.lot_allocations.length"
                                    class="space-y-1"
                                >
                                    <p
                                        v-for="allocation in movement.lot_allocations"
                                        :key="allocation.id"
                                        class="text-xs text-gray-600"
                                    >
                                        {{
                                            allocation.batch_number ||
                                            `Lote #${allocation.inventory_lot_id}`
                                        }}
                                        · x{{ allocation.quantity }} ·
                                        {{
                                            formatCurrency(
                                                allocation.total_cost,
                                            )
                                        }}
                                    </p>
                                </div>
                                <span v-else class="text-xs text-gray-400">
                                    Sin lotes
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section
                v-if="activeTab === 'profit'"
                class="grid gap-4 lg:grid-cols-4"
            >
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs text-gray-500">Subtotal base</p>
                    <p class="mt-1 text-xl font-bold">
                        {{
                            formatCurrency(
                                operationalDetail.profit_summary.subtotal,
                            )
                        }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs text-gray-500">Costo vendido</p>
                    <p class="mt-1 text-xl font-bold">
                        {{
                            formatCurrency(
                                operationalDetail.profit_summary.total_cost,
                            )
                        }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs text-gray-500">Utilidad bruta</p>
                    <p class="mt-1 text-xl font-bold text-emerald-600">
                        {{
                            formatCurrency(
                                operationalDetail.profit_summary.gross_profit,
                            )
                        }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs text-gray-500">Margen</p>
                    <p class="mt-1 text-xl font-bold">
                        {{
                            operationalDetail.profit_summary
                                .gross_margin_percent ?? 0
                        }}%
                    </p>
                </div>
                <div
                    v-if="operationalDetail.profit_summary.has_missing_costs"
                    class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 lg:col-span-4"
                >
                    <AlertTriangle class="mr-1 inline h-4 w-4" />
                    Hay líneas sin costo histórico disponible.
                </div>
            </section>

            <section
                v-if="activeTab === 'activity'"
                class="grid gap-4 xl:grid-cols-2"
            >
                <TransactionRelationsPanel
                    :nodes="operationalDetail.trace.relationships"
                />
                <TransactionTimeline
                    :events="operationalDetail.trace.timeline"
                />
                <div
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 px-4 py-3 dark:border-border"
                    >
                        <h2 class="text-sm font-bold">Auditoría POS</h2>
                    </div>
                    <div class="divide-y divide-gray-100 dark:divide-border">
                        <div
                            v-if="audit.length === 0"
                            class="p-6 text-sm text-gray-500"
                        >
                            Sin eventos de auditoría.
                        </div>
                        <div
                            v-for="(row, idx) in audit"
                            :key="idx"
                            class="p-3 text-sm"
                        >
                            <p class="font-semibold">{{ row.action }}</p>
                            <p class="font-mono text-xs text-gray-500">
                                {{ row.timestamp || 'Sin fecha' }}
                            </p>
                            <pre
                                v-if="row.metadata"
                                class="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs dark:bg-muted"
                                >{{ row.metadata }}</pre
                            >
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 px-4 py-3 dark:border-border"
                    >
                        <h2 class="text-sm font-bold">Movimientos contables</h2>
                    </div>
                    <div class="divide-y divide-gray-100 dark:divide-border">
                        <div
                            v-if="
                                operationalDetail.ar_context
                                    .customer_transactions.length === 0 &&
                                operationalDetail.ar_context.ledger_entries
                                    .length === 0
                            "
                            class="p-6 text-sm text-gray-500"
                        >
                            Sin movimientos AR relacionados.
                        </div>
                        <div
                            v-for="row in operationalDetail.ar_context
                                .customer_transactions"
                            :key="`tx-${row.id}`"
                            class="p-3 text-sm"
                        >
                            <p class="font-semibold">{{ row.type_label }}</p>
                            <p class="text-gray-600">{{ row.description }}</p>
                            <p class="font-mono text-xs text-gray-500">
                                {{ formatDateTime(row.transaction_date) }} ·
                                {{ formatCurrency(row.amount) }}
                            </p>
                        </div>
                        <div
                            v-for="row in operationalDetail.ar_context
                                .ledger_entries"
                            :key="`ledger-${row.id}`"
                            class="p-3 text-sm"
                        >
                            <p class="font-semibold">{{ row.movement_type }}</p>
                            <p class="text-gray-600">
                                {{
                                    row.document_number ||
                                    row.batch_number ||
                                    row.reference_number
                                }}
                            </p>
                            <p class="font-mono text-xs text-gray-500">
                                D {{ formatCurrency(row.debit) }} · C
                                {{ formatCurrency(row.credit) }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <PrintTicketModal
            v-if="currentSalesOrder"
            :show="showPrintModal"
            :order-id="currentSalesOrder.id"
            :order-number="currentSalesOrder.order_number"
            @close="showPrintModal = false"
        />

        <div
            v-if="showCancellationModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            @keydown.esc="showCancellationModal = false"
        >
            <form
                class="w-full max-w-md rounded-md border bg-white shadow-xl dark:border-border dark:bg-card"
                @submit.prevent="handleCancel"
            >
                <div class="border-b p-4 dark:border-border">
                    <h2 class="font-semibold">
                        Anular factura {{ order?.order_number }}
                    </h2>
                    <p class="mt-1 text-sm text-gray-500">
                        La factura original se conserva. Inventario y dinero se
                        corrigen con movimientos auditados.
                    </p>
                </div>
                <div class="space-y-3 p-4">
                    <label class="block text-sm font-medium">
                        Motivo
                        <textarea
                            ref="cancellationReasonInput"
                            v-model="cancellationReason"
                            rows="3"
                            required
                            minlength="3"
                            class="mt-1 w-full rounded-md border bg-background px-3 py-2"
                        />
                    </label>
                    <label
                        v-if="cancellationRequiresSettlement"
                        class="block text-sm font-medium"
                    >
                        Resolución financiera
                        <select
                            v-model="cancellationMethod"
                            required
                            class="mt-1 w-full rounded-md border bg-background px-3 py-2"
                        >
                            <option value="" disabled>Seleccionar</option>
                            <option
                                v-for="method in cancellationOptions"
                                :key="method.code"
                                :value="method.code"
                            >
                                {{ method.name }}
                            </option>
                        </select>
                    </label>
                    <label
                        v-if="cancellationIsBank"
                        class="block text-sm font-medium"
                    >
                        Cuenta bancaria
                        <select
                            v-model.number="cancellationFinancialAccountId"
                            required
                            class="mt-1 w-full rounded-md border bg-background px-3 py-2"
                        >
                            <option :value="null">Seleccionar</option>
                            <option
                                v-for="account in cancellationFinancialAccounts"
                                :key="account.endpoint_id"
                                :value="account.endpoint_id"
                            >
                                {{ account.name
                                }}{{
                                    account.masked_number
                                        ? ` · ${account.masked_number}`
                                        : ''
                                }}
                            </option>
                        </select>
                        <span
                            v-if="cancellationAccountsError"
                            class="mt-1 block text-xs text-red-600"
                        >
                            {{ cancellationAccountsError }}
                        </span>
                    </label>
                    <label class="block text-sm font-medium">
                        Nota opcional
                        <textarea
                            v-model="cancellationNotes"
                            rows="2"
                            class="mt-1 w-full rounded-md border bg-background px-3 py-2"
                        />
                    </label>
                    <p v-if="cancellationError" class="text-sm text-red-600">
                        {{ cancellationError }}
                    </p>
                </div>
                <div
                    class="flex justify-end gap-2 border-t p-4 dark:border-border"
                >
                    <button
                        type="button"
                        class="rounded-md border px-3 py-2 text-sm"
                        @click="showCancellationModal = false"
                    >
                        Volver
                    </button>
                    <button
                        type="submit"
                        class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        :disabled="cancellationLoading"
                    >
                        {{
                            cancellationLoading
                                ? 'Anulando...'
                                : 'Confirmar anulación'
                        }}
                    </button>
                </div>
            </form>
        </div>

        <CreateReturnModal
            v-if="currentSalesOrder"
            :show="showReturnModal"
            :order-id="currentSalesOrder.id"
            :order-number="currentSalesOrder.order_number"
            :has-customer="!!currentSalesOrder.customer_id"
            :users="users"
            :current-user-id="currentSalesOrder.user_id"
            :items="
                items
                    .filter((item) => !item.is_custom_line && item.product_id)
                    .map((item) => ({
                        id: item.id,
                        product_id: item.product_id as number,
                        variant_id: item.variant_id ?? undefined,
                        product_name: item.product_name || 'Producto',
                        product_sku: item.product_sku || '',
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        discount_percent: item.discount_percent,
                        tax_percent: item.tax_percent,
                        total: item.total,
                        seller_name: item.seller_name || '',
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
