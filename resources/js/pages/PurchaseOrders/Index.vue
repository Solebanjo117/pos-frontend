<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Eye,
    Package,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Trash2,
    TrendingDown,
    Warehouse,
    XCircle,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
import { useAuth } from '@/composables/useAuth';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { useSuppliers } from '@/composables/useSuppliers';
import AppLayout from '@/layouts/AppLayout.vue';
import type {
    PurchaseOrder,
    PurchaseOrderFilters,
    PurchaseOrderPaymentStatus,
    PurchaseOrderStatus,
} from '@/types/purchase-order';
import { formatCurrency } from '@/utils/formatters';

const { hasRole } = useAuth();
const {
    purchaseOrders,
    statistics,
    loading,
    error,
    pagination,
    fetchPurchaseOrders,
    fetchStatistics,
    sendPurchaseOrder,
    cancelPurchaseOrder,
    deletePurchaseOrder,
} = usePurchaseOrders();
const { fetchActiveSuppliers } = useSuppliers();

const suppliers = ref<any[]>([]);
const filters = ref<PurchaseOrderFilters>({
    search: '',
    status: undefined,
    supplier_id: undefined,
    payment_status: undefined,
    date_from: '',
    date_to: '',
    per_page: 15,
});

const canManagePurchases = computed(() =>
    hasRole(['admin', 'manager', 'buyer', 'assistant']),
);

const statusOptions: Array<{
    value: PurchaseOrderStatus | '';
    label: string;
    className: string;
}> = [
    { value: '', label: 'Todos', className: '' },
    {
        value: 'draft',
        label: 'Borrador',
        className:
            'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border',
    },
    {
        value: 'open',
        label: 'Abierta diaria',
        className:
            'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:ring-violet-800',
    },
    {
        value: 'sent',
        label: 'Enviada',
        className:
            'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800',
    },
    {
        value: 'partial',
        label: 'Parcial',
        className:
            'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800',
    },
    {
        value: 'received',
        label: 'Recibida',
        className:
            'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800',
    },
    {
        value: 'cancelled',
        label: 'Cancelada',
        className:
            'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800',
    },
];

const paymentStatusOptions: Array<{
    value: PurchaseOrderPaymentStatus | '';
    label: string;
}> = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'partial', label: 'Parcial' },
    { value: 'paid', label: 'Pagado' },
];

const supplierFilterOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...suppliers.value.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
    })),
]);

const supplierFilterModel = computed<number | null>({
    get: () => filters.value.supplier_id ?? null,
    set: (value) => {
        filters.value.supplier_id = value === null ? undefined : Number(value);
    },
});

const activeFilterChips = computed(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];

    if (filters.value.search) {
        chips.push({
            key: 'search',
            label: `Buscar: ${filters.value.search}`,
            clear: () => (filters.value.search = ''),
        });
    }

    if (filters.value.status) {
        chips.push({
            key: 'status',
            label: `Estado: ${getStatusLabel(filters.value.status)}`,
            clear: () => (filters.value.status = undefined),
        });
    }

    if (filters.value.payment_status) {
        chips.push({
            key: 'payment_status',
            label: `Pago: ${getPaymentStatusLabel(filters.value.payment_status)}`,
            clear: () => (filters.value.payment_status = undefined),
        });
    }

    if (filters.value.supplier_id) {
        const supplier = suppliers.value.find(
            (item) => Number(item.id) === Number(filters.value.supplier_id),
        );
        chips.push({
            key: 'supplier_id',
            label: `Proveedor: ${supplier?.name ?? filters.value.supplier_id}`,
            clear: () => (filters.value.supplier_id = undefined),
        });
    }

    if (filters.value.date_from || filters.value.date_to) {
        chips.push({
            key: 'dates',
            label: `${filters.value.date_from || 'Inicio'} - ${filters.value.date_to || 'Hoy'}`,
            clear: () => {
                filters.value.date_from = '';
                filters.value.date_to = '';
            },
        });
    }

    return chips;
});

function initializeFiltersFromQuery(): void {
    const params = new URLSearchParams(window.location.search);

    filters.value.search = params.get('search') || '';
    filters.value.status =
        (params.get('status') as PurchaseOrderStatus | null) || undefined;
    filters.value.supplier_id = params.has('supplier_id')
        ? Number(params.get('supplier_id'))
        : undefined;
    filters.value.payment_status =
        (params.get('payment_status') as PurchaseOrderPaymentStatus | null) ||
        undefined;
    filters.value.date_from = params.get('date_from') || '';
    filters.value.date_to = params.get('date_to') || '';
    filters.value.per_page = params.has('per_page')
        ? Number(params.get('per_page'))
        : 15;
}

function syncFiltersToUrl(): void {
    const params = new URLSearchParams();

    Object.entries(filters.value).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    });

    const query = params.toString();
    window.history.replaceState(
        {},
        '',
        query
            ? `${window.location.pathname}?${query}`
            : window.location.pathname,
    );
}

function cleanFilters(): PurchaseOrderFilters {
    const clean: Record<string, unknown> = { ...filters.value };

    Object.keys(clean).forEach((key) => {
        if (
            clean[key] === undefined ||
            clean[key] === null ||
            clean[key] === ''
        ) {
            delete clean[key];
        }
    });

    return clean as PurchaseOrderFilters;
}

async function loadOrders(): Promise<void> {
    syncFiltersToUrl();
    await fetchPurchaseOrders(cleanFilters());
}

async function refreshOrders(): Promise<void> {
    await Promise.all([fetchStatistics(), loadOrders()]);
}

async function clearFilters(): Promise<void> {
    filters.value = {
        search: '',
        status: undefined,
        supplier_id: undefined,
        payment_status: undefined,
        date_from: '',
        date_to: '',
        per_page: filters.value.per_page ?? 15,
    };
    await loadOrders();
}

async function clearChip(chip: { clear: () => void }): Promise<void> {
    chip.clear();
    await loadOrders();
}

function getStatusLabel(status: string): string {
    return (
        statusOptions.find((option) => option.value === status)?.label || status
    );
}

function getStatusClass(status: string): string {
    return (
        statusOptions.find((option) => option.value === status)?.className ||
        'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border'
    );
}

function getPaymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        paid: 'Pagado',
        partial: 'Parcial',
        pending: 'Pendiente',
    };

    return labels[status] || status;
}

function getPaymentStatusClass(status: string): string {
    if (status === 'paid') {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800';
    }

    if (status === 'partial') {
        return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800';
    }

    return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800';
}

function formatDate(value?: string | null): string {
    if (!value) return '-';

    return new Date(value).toLocaleDateString('es-PA');
}

function displaySupplier(po: PurchaseOrder): string {
    if (po.supplier?.name) return po.supplier.name;

    return `OC diaria ${formatDate(po.order_date)}`;
}

function itemsCount(po: PurchaseOrder): number {
    return po.items_count || po.items?.length || 0;
}

function filterByStatus(status: PurchaseOrderStatus): void {
    filters.value.status = status;
    loadOrders();
}

function filterByPaymentStatus(status: PurchaseOrderPaymentStatus): void {
    filters.value.payment_status = status;
    loadOrders();
}

async function handleSend(id: number): Promise<void> {
    if (!confirm('¿Enviar esta orden al proveedor?')) return;

    try {
        await sendPurchaseOrder(id);
        await refreshOrders();
    } catch (e) {}
}

async function handleCancel(id: number): Promise<void> {
    if (!confirm('¿Cancelar esta orden de compra?')) return;

    try {
        await cancelPurchaseOrder(id);
        await refreshOrders();
    } catch (e) {}
}

async function handleDelete(id: number): Promise<void> {
    if (!confirm('¿Eliminar esta orden de compra?')) return;

    try {
        await deletePurchaseOrder(id);
        await refreshOrders();
    } catch (e) {}
}

onMounted(async () => {
    initializeFiltersFromQuery();
    suppliers.value = await fetchActiveSuppliers();
    await refreshOrders();
});
</script>

<template>
    <Head title="Órdenes de Compra" />

    <AppLayout>
        <div class="space-y-5 p-4">
            <header
                class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    >
                        <Package :size="20" />
                    </div>
                    <div>
                        <h1
                            class="text-2xl font-bold text-slate-950 dark:text-white"
                        >
                            Órdenes de Compra
                        </h1>
                        <p class="text-sm text-slate-500 dark:text-slate-400">
                            Compras, recepción, pagos y deuda a proveedores
                        </p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <Link
                        v-if="canManagePurchases"
                        href="/purchase-orders/create"
                        class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                    >
                        <Plus :size="16" />
                        Nueva OC
                    </Link>
                    <Link
                        v-if="canManagePurchases"
                        href="/supply-list"
                        class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                    >
                        <TrendingDown :size="16" />
                        OC diaria
                    </Link>
                    <button
                        type="button"
                        :disabled="loading"
                        class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                        @click="refreshOrders"
                    >
                        <RefreshCw
                            :size="16"
                            :class="{ 'animate-spin': loading }"
                        />
                        Refrescar
                    </button>
                </div>
            </header>

            <section
                v-if="statistics"
                class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            >
                <button
                    type="button"
                    class="rounded-lg border border-red-200 bg-white p-4 text-left shadow-sm transition hover:bg-red-50/60 dark:border-red-900/40 dark:bg-card dark:hover:bg-red-900/10"
                    @click="filterByPaymentStatus('pending')"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Por pagar
                        </p>
                        <DollarSign :size="16" class="text-red-500" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-red-700 tabular-nums dark:text-red-300"
                    >
                        {{ formatCurrency(statistics.total_unpaid) }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ statistics.pending_payment_orders }} OC abiertas
                    </p>
                </button>

                <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50 dark:border-border dark:bg-card dark:hover:bg-muted/40"
                    @click="filterByStatus('sent')"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Pendientes de recibir
                        </p>
                        <Clock :size="16" class="text-blue-500" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ statistics.sent_orders }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Enviadas a proveedor
                    </p>
                </button>

                <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50 dark:border-border dark:bg-card dark:hover:bg-muted/40"
                    @click="filterByStatus('partial')"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Parciales
                        </p>
                        <AlertCircle :size="16" class="text-amber-500" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ statistics.partial_orders }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Recepción o pago incompleto
                    </p>
                </button>

                <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50 dark:border-border dark:bg-card dark:hover:bg-muted/40"
                    @click="filterByStatus('received')"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Recibidas
                        </p>
                        <CheckCircle2 :size="16" class="text-emerald-500" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ statistics.received_orders }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Mercancía ingresada
                    </p>
                </button>

                <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50 dark:border-border dark:bg-card dark:hover:bg-muted/40"
                    @click="filterByStatus('cancelled')"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Canceladas
                        </p>
                        <XCircle :size="16" class="text-slate-400" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ statistics.cancelled_orders }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Fuera del flujo activo
                    </p>
                </button>
            </section>

            <section
                class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    class="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_170px_220px_150px_150px_auto]"
                >
                    <div>
                        <label
                            class="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            <Search :size="13" />
                            Buscar
                        </label>
                        <input
                            v-model="filters.search"
                            type="text"
                            placeholder="Nº orden, factura, proveedor"
                            class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 transition outline-none focus:border-slate-500 dark:border-border dark:bg-muted dark:text-white"
                            @keyup.enter="loadOrders"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1.5 block text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Estado
                        </label>
                        <select
                            v-model="filters.status"
                            class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 transition outline-none focus:border-slate-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option
                                v-for="option in statusOptions"
                                :key="option.value"
                                :value="option.value || undefined"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                    </div>

                    <div>
                        <label
                            class="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            <CreditCard :size="13" />
                            Pago
                        </label>
                        <select
                            v-model="filters.payment_status"
                            class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 transition outline-none focus:border-slate-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option
                                v-for="option in paymentStatusOptions"
                                :key="option.value"
                                :value="option.value || undefined"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                    </div>

                    <div>
                        <label
                            class="mb-1.5 block text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Proveedor
                        </label>
                        <SearchableSelect
                            v-model="supplierFilterModel"
                            :options="supplierFilterOptions"
                            placeholder="Todos"
                        />
                    </div>

                    <DateRangeInput
                        v-model:from="filters.date_from"
                        v-model:to="filters.date_to"
                        label="Rango de fechas"
                    />

                    <div class="flex flex-wrap items-end gap-2">
                        <button
                            type="button"
                            class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                            @click="loadOrders"
                        >
                            <Search :size="16" />
                            Buscar
                        </button>
                        <button
                            type="button"
                            class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                            @click="clearFilters"
                        >
                            <RotateCcw :size="15" />
                            Limpiar
                        </button>
                    </div>
                </div>

                <div
                    v-if="activeFilterChips.length"
                    class="mt-3 flex flex-wrap gap-2"
                >
                    <button
                        v-for="chip in activeFilterChips"
                        :key="chip.key"
                        type="button"
                        class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-muted dark:text-slate-200 dark:ring-border"
                        @click="clearChip(chip)"
                    >
                        {{ chip.label }}
                        <XCircle :size="12" />
                    </button>
                </div>
            </section>

            <div
                v-if="error"
                class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            >
                <AlertCircle :size="18" />
                {{ error }}
            </div>

            <section
                class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    v-if="loading"
                    class="flex items-center justify-center py-16 text-sm text-slate-500 dark:text-slate-400"
                >
                    <RefreshCw :size="20" class="mr-2 animate-spin" />
                    Cargando órdenes de compra...
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr
                                class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase dark:border-border dark:bg-muted/50 dark:text-slate-400"
                            >
                                <th class="px-4 py-3 text-left font-bold">
                                    OC
                                </th>
                                <th class="px-4 py-3 text-left font-bold">
                                    Proveedor / almacén
                                </th>
                                <th class="px-4 py-3 text-left font-bold">
                                    Fecha
                                </th>
                                <th class="px-4 py-3 text-center font-bold">
                                    Items
                                </th>
                                <th class="px-4 py-3 text-right font-bold">
                                    Total
                                </th>
                                <th class="px-4 py-3 text-right font-bold">
                                    Pagado / saldo
                                </th>
                                <th class="px-4 py-3 text-center font-bold">
                                    Estado
                                </th>
                                <th class="px-4 py-3 text-right font-bold">
                                    Acción
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-slate-100 dark:divide-border/60"
                        >
                            <tr
                                v-for="po in purchaseOrders"
                                :key="po.id"
                                class="transition hover:bg-slate-50 dark:hover:bg-muted/40"
                            >
                                <td class="px-4 py-3">
                                    <Link
                                        :href="`/purchase-orders/${po.id}`"
                                        class="font-mono font-bold text-indigo-600 underline-offset-2 transition hover:underline dark:text-indigo-300"
                                    >
                                        {{ po.po_number }}
                                    </Link>
                                    <p
                                        v-if="po.supplier_invoice_number"
                                        class="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400"
                                    >
                                        Factura
                                        {{ po.supplier_invoice_number }}
                                    </p>
                                </td>

                                <td class="px-4 py-3">
                                    <Link
                                        v-if="po.supplier"
                                        :href="`/suppliers/${po.supplier.id}`"
                                        class="font-semibold text-slate-950 underline-offset-2 transition hover:text-indigo-600 hover:underline dark:text-white dark:hover:text-indigo-300"
                                    >
                                        {{ po.supplier.name }}
                                    </Link>
                                    <span
                                        v-else
                                        class="font-semibold text-violet-700 dark:text-violet-300"
                                    >
                                        {{ displaySupplier(po) }}
                                    </span>
                                    <div
                                        class="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
                                    >
                                        <Warehouse :size="12" />
                                        {{ po.warehouse?.name || 'General' }}
                                    </div>
                                </td>

                                <td
                                    class="px-4 py-3 text-slate-600 dark:text-slate-300"
                                >
                                    {{ formatDate(po.order_date) }}
                                </td>

                                <td
                                    class="px-4 py-3 text-center font-semibold text-slate-700 tabular-nums dark:text-slate-200"
                                >
                                    {{ itemsCount(po) }}
                                </td>

                                <td
                                    class="px-4 py-3 text-right font-bold text-slate-950 tabular-nums dark:text-white"
                                >
                                    {{
                                        po.formatted_total ||
                                        formatCurrency(po.total)
                                    }}
                                </td>

                                <td class="px-4 py-3 text-right">
                                    <p
                                        class="font-semibold text-slate-700 tabular-nums dark:text-slate-200"
                                    >
                                        {{ formatCurrency(po.amount_paid) }}
                                    </p>
                                    <button
                                        v-if="
                                            po.payment_status !== 'paid' &&
                                            po.status !== 'cancelled'
                                        "
                                        type="button"
                                        class="mt-1 text-xs font-bold text-red-700 underline-offset-2 hover:underline dark:text-red-300"
                                        @click="
                                            filterByPaymentStatus(
                                                po.payment_status,
                                            )
                                        "
                                    >
                                        {{ formatCurrency(po.amount_due) }}
                                        por pagar
                                    </button>
                                    <p
                                        v-else
                                        class="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                                    >
                                        Sin saldo
                                    </p>
                                </td>

                                <td class="px-4 py-3 text-center">
                                    <div
                                        class="flex flex-col items-center gap-1"
                                    >
                                        <button
                                            type="button"
                                            class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1"
                                            :class="getStatusClass(po.status)"
                                            title="Filtrar por estado"
                                            @click="filterByStatus(po.status)"
                                        >
                                            {{ getStatusLabel(po.status) }}
                                        </button>
                                        <button
                                            type="button"
                                            class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1"
                                            :class="
                                                getPaymentStatusClass(
                                                    po.payment_status,
                                                )
                                            "
                                            title="Filtrar por estado de pago"
                                            @click="
                                                filterByPaymentStatus(
                                                    po.payment_status,
                                                )
                                            "
                                        >
                                            {{
                                                getPaymentStatusLabel(
                                                    po.payment_status,
                                                )
                                            }}
                                        </button>
                                    </div>
                                </td>

                                <td class="px-4 py-3 text-right">
                                    <div
                                        class="flex items-center justify-end gap-1"
                                    >
                                        <Link
                                            :href="`/purchase-orders/${po.id}`"
                                            class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-muted dark:hover:text-indigo-300"
                                            title="Ver detalle"
                                        >
                                            <Eye :size="16" />
                                        </Link>

                                        <template v-if="canManagePurchases">
                                            <button
                                                v-if="po.status === 'draft'"
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
                                                title="Enviar al proveedor"
                                                @click="handleSend(po.id)"
                                            >
                                                <Send :size="16" />
                                            </button>
                                            <button
                                                v-if="
                                                    ![
                                                        'received',
                                                        'cancelled',
                                                    ].includes(po.status)
                                                "
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20"
                                                title="Cancelar"
                                                @click="handleCancel(po.id)"
                                            >
                                                <XCircle :size="16" />
                                            </button>
                                            <button
                                                v-if="po.status === 'draft'"
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                                                title="Eliminar"
                                                @click="handleDelete(po.id)"
                                            >
                                                <Trash2 :size="16" />
                                            </button>
                                        </template>
                                    </div>
                                </td>
                            </tr>

                            <tr v-if="purchaseOrders.length === 0">
                                <td
                                    colspan="8"
                                    class="px-4 py-14 text-center text-sm text-slate-500 dark:text-slate-400"
                                >
                                    No se encontraron órdenes de compra con los
                                    filtros seleccionados.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div
                    v-if="!loading && pagination"
                    class="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-border"
                >
                    <span class="text-slate-500 dark:text-slate-400">
                        Mostrando {{ purchaseOrders.length }} de
                        {{ pagination.total }} órdenes
                    </span>
                </div>
            </section>
        </div>
    </AppLayout>
</template>
