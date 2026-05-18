<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { useSuppliers } from '@/composables/useSuppliers';
import {
    Search,
    Plus,
    Eye,
    Send,
    XCircle,
    Trash2,
    DollarSign,
    Package,
    Clock,
    CheckCircle2,
    TrendingDown,
    AlertCircle,
} from 'lucide-vue-next';
import type {
    PurchaseOrderFilters,
    PurchaseOrderStatus,
} from '@/types/purchase-order';
import { useAuth } from '@/composables/useAuth';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

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
const filters = ref<PurchaseOrderFilters & { payment_status?: string }>({
    search: '',
    status: undefined,
    supplier_id: undefined,
    payment_status: undefined,
    date_from: '',
    date_to: '',
    per_page: 15,
});

function getPaymentStatusColor(ps: string) {
    if (ps === 'paid')
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (ps === 'partial')
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

function getPaymentStatusLabel(ps: string) {
    if (ps === 'paid') return 'Pagado';
    if (ps === 'partial') return 'Parcial';
    return 'Pendiente';
}

function formatAmount(val: number | string | null | undefined): string {
    return (
        '$' +
        Number(val ?? 0).toLocaleString('es', { minimumFractionDigits: 2 })
    );
}

const statusOptions: { value: string; label: string; color: string }[] = [
    { value: '', label: 'Todos', color: '' },
    {
        value: 'draft',
        label: 'Borrador',
        color: 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-300',
    },
    {
        value: 'open',
        label: 'Abierta (Diaria)',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    },
    {
        value: 'sent',
        label: 'Enviado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
        value: 'partial',
        label: 'Parcial',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    {
        value: 'received',
        label: 'Recibido',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    {
        value: 'cancelled',
        label: 'Cancelado',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
];

const supplierFilterOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...suppliers.value.map((s) => ({ value: s.id, label: s.name })),
]);

const supplierFilterModel = computed<number | null>({
    get: () => filters.value.supplier_id ?? null,
    set: (value) => {
        filters.value.supplier_id = value === null ? undefined : Number(value);
    },
});

function initializeFiltersFromQuery() {
    const params = new URLSearchParams(window.location.search);

    filters.value.search = params.get('search') || '';
    filters.value.status =
        (params.get('status') as PurchaseOrderStatus | null) || undefined;
    filters.value.supplier_id = params.has('supplier_id')
        ? Number(params.get('supplier_id'))
        : undefined;
    filters.value.payment_status = params.get('payment_status') || undefined;
    filters.value.date_from = params.get('date_from') || '';
    filters.value.date_to = params.get('date_to') || '';
    filters.value.per_page = params.has('per_page')
        ? Number(params.get('per_page'))
        : 15;
}

function syncFiltersToUrl() {
    const params = new URLSearchParams();

    Object.entries(filters.value).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    });

    const query = params.toString();
    const nextUrl = query
        ? `${window.location.pathname}?${query}`
        : window.location.pathname;

    window.history.replaceState({}, '', nextUrl);
}

function getStatusColor(status: string) {
    return statusOptions.find((s) => s.value === status)?.color || '';
}

function getStatusLabel(status: string) {
    return statusOptions.find((s) => s.value === status)?.label || status;
}

function filterByStatus(status: PurchaseOrderStatus) {
    filters.value.status = status;
    loadOrders();
}

function filterByPaymentStatus(paymentStatus: string) {
    filters.value.payment_status = paymentStatus;
    loadOrders();
}

function getDisplayName(po: any): string {
    // Daily global PO: no supplier in header
    if (!po.supplier) {
        const date = new Date(po.order_date);
        return `OC del ${date.toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return po.supplier.name;
}

function isDailyPO(po: any): boolean {
    return !po.supplier;
}

async function loadOrders() {
    const cleanFilters: any = { ...filters.value };
    Object.keys(cleanFilters).forEach((k) => {
        if (!cleanFilters[k]) delete cleanFilters[k];
    });
    syncFiltersToUrl();
    await fetchPurchaseOrders(cleanFilters);
}

async function handleSend(id: number) {
    if (!confirm('¿Enviar esta orden al proveedor?')) return;
    try {
        await sendPurchaseOrder(id);
        await loadOrders();
        await fetchStatistics();
    } catch (e) {}
}

async function handleCancel(id: number) {
    if (!confirm('¿Cancelar esta orden de compra?')) return;
    try {
        await cancelPurchaseOrder(id);
        await loadOrders();
        await fetchStatistics();
    } catch (e) {}
}

async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta orden de compra?')) return;
    try {
        await deletePurchaseOrder(id);
        await loadOrders();
        await fetchStatistics();
    } catch (e) {}
}

onMounted(async () => {
    initializeFiltersFromQuery();
    suppliers.value = await fetchActiveSuppliers();
    await fetchStatistics();
    await loadOrders();
});
</script>

<template>
    <Head title="Órdenes de Compra" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Órdenes de Compra
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gestiona pedidos a proveedores y recepción de mercancía
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <Link
                        v-if="
                            hasRole(['admin', 'manager', 'buyer', 'assistant'])
                        "
                        href="/supply-list"
                        class="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        <TrendingDown :size="20" />
                        OC Diaria
                    </Link>
                    <Link
                        v-if="
                            hasRole(['admin', 'manager', 'buyer', 'assistant'])
                        "
                        href="/purchase-orders/create"
                        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        <Plus :size="20" />
                        Nueva OC
                    </Link>
                </div>
            </div>

            <!-- Stats -->
            <div
                v-if="statistics"
                class="grid grid-cols-2 gap-4 md:grid-cols-4"
            >
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div class="rounded-lg bg-gray-100 p-2 dark:bg-muted">
                            <Package
                                :size="20"
                                class="text-gray-600 dark:text-gray-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ statistics.total_orders }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Total Órdenes
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
                                :size="20"
                                class="text-green-600 dark:text-green-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                ${{
                                    Number(
                                        statistics.total_spent,
                                    ).toLocaleString('es', {
                                        minimumFractionDigits: 2,
                                    })
                                }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Total Invertido
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30"
                        >
                            <Clock
                                :size="20"
                                class="text-blue-600 dark:text-blue-400 dark:text-primary"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    statistics.sent_orders +
                                    statistics.partial_orders
                                }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Pendientes
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30"
                        >
                            <CheckCircle2
                                :size="20"
                                class="text-emerald-600 dark:text-emerald-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ statistics.received_orders }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Recibidas
                            </p>
                        </div>
                    </div>
                </div>
                <!-- Por Pagar KPI -->
                <div
                    class="col-span-2 rounded-lg border border-red-200 bg-white p-4 md:col-span-1 dark:border-red-900/40 dark:bg-card"
                    @click="
                        filters.payment_status = filters.payment_status
                            ? undefined
                            : 'pending';
                        loadOrders();
                    "
                    role="button"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-red-100 p-2 dark:bg-red-900/30"
                        >
                            <AlertCircle
                                :size="20"
                                class="text-red-600 dark:text-red-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-red-600 dark:text-red-400"
                            >
                                {{ formatAmount(statistics.total_unpaid) }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Por Pagar ({{
                                    statistics.pending_payment_orders ?? 0
                                }}
                                órdenes)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Buscar</label
                        >
                        <div class="relative">
                            <Search
                                class="absolute top-2.5 left-3 text-gray-400"
                                :size="18"
                            />
                            <input
                                v-model="filters.search"
                                type="text"
                                placeholder="Nº de orden, proveedor..."
                                class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                @input="loadOrders"
                            />
                        </div>
                    </div>
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Estado</label
                        >
                        <select
                            v-model="filters.status"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            @change="loadOrders"
                        >
                            <option
                                v-for="opt in statusOptions"
                                :key="opt.value"
                                :value="opt.value || undefined"
                            >
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Proveedor</label
                        >
                        <SearchableSelect
                            v-model="supplierFilterModel"
                            :options="supplierFilterOptions"
                            placeholder="Todos"
                            @update:model-value="loadOrders"
                        />
                    </div>
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Desde</label
                        >
                        <input
                            v-model="filters.date_from"
                            type="date"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            @change="loadOrders"
                        />
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
            >
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Table -->
            <div
                class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Nº Orden
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Proveedor
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Fecha
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Items
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Total
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Estado
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Pago
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 dark:divide-border"
                        >
                            <tr v-if="loading">
                                <td
                                    colspan="8"
                                    class="px-6 py-12 text-center text-gray-500"
                                >
                                    <div
                                        class="flex items-center justify-center gap-2"
                                    >
                                        <div
                                            class="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
                                        ></div>
                                        Cargando...
                                    </div>
                                </td>
                            </tr>
                            <tr v-else-if="purchaseOrders.length === 0">
                                <td
                                    colspan="8"
                                    class="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                                >
                                    <Package
                                        class="mx-auto mb-3 text-gray-300"
                                        :size="48"
                                    />
                                    <p>No se encontraron órdenes de compra</p>
                                </td>
                            </tr>
                            <tr
                                v-for="po in purchaseOrders"
                                :key="po.id"
                                class="dark:hover:bg-muted/50/50 transition hover:bg-gray-50"
                            >
                                <td class="px-6 py-4">
                                    <Link
                                        :href="`/purchase-orders/${po.id}`"
                                        class="font-mono font-medium text-indigo-600 hover:underline dark:text-indigo-400 dark:text-primary"
                                    >
                                        {{ po.po_number }}
                                    </Link>
                                    <p
                                        v-if="po.supplier_invoice_number"
                                        class="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Factura:
                                        {{ po.supplier_invoice_number }}
                                    </p>
                                </td>
                                <td class="px-6 py-4">
                                    <template v-if="isDailyPO(po)">
                                        <span
                                            class="text-sm font-medium text-purple-600 dark:text-purple-400"
                                        >
                                            {{ getDisplayName(po) }}
                                        </span>
                                        <span
                                            class="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                        >
                                            Global
                                        </span>
                                    </template>
                                    <Link
                                        v-else-if="po.supplier"
                                        :href="`/suppliers/${po.supplier.id}`"
                                        class="text-sm text-indigo-600 hover:underline dark:text-indigo-400 dark:text-primary"
                                    >
                                        {{ po.supplier.name }}
                                    </Link>
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400"
                                >
                                    {{
                                        new Date(
                                            po.order_date,
                                        ).toLocaleDateString('es-PA')
                                    }}
                                </td>
                                <td
                                    class="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400"
                                >
                                    {{
                                        po.items_count || po.items?.length || 0
                                    }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white"
                                >
                                    {{ po.formatted_total }}
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <button
                                        type="button"
                                        :class="[
                                            'rounded-full px-2 py-1 text-xs font-semibold',
                                            getStatusColor(po.status),
                                        ]"
                                        title="Filtrar por estado"
                                        @click="filterByStatus(po.status)"
                                    >
                                        {{ getStatusLabel(po.status) }}
                                    </button>
                                </td>
                                <!-- Payment Status Cell -->
                                <td class="px-6 py-4 text-center">
                                    <div
                                        class="flex flex-col items-center gap-1"
                                    >
                                        <button
                                            type="button"
                                            :class="[
                                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                                getPaymentStatusColor(
                                                    po.payment_status ??
                                                        'pending',
                                                ),
                                            ]"
                                            title="Filtrar por estado de pago"
                                            @click="
                                                filterByPaymentStatus(
                                                    po.payment_status ??
                                                        'pending',
                                                )
                                            "
                                        >
                                            {{
                                                getPaymentStatusLabel(
                                                    po.payment_status ??
                                                        'pending',
                                                )
                                            }}
                                        </button>
                                        <!-- Show pending amount if not fully paid -->
                                        <span
                                            v-if="
                                                po.payment_status !== 'paid' &&
                                                po.status !== 'cancelled'
                                            "
                                            class="text-xs font-medium text-red-500 dark:text-red-400"
                                        >
                                            {{ formatAmount(po.amount_due) }}
                                            por pagar
                                        </span>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div
                                        class="flex items-center justify-end gap-1"
                                    >
                                        <Link
                                            :href="`/purchase-orders/${po.id}`"
                                            class="p-2 text-gray-400 transition hover:text-indigo-600 dark:text-primary"
                                            title="Ver detalle"
                                        >
                                            <Eye :size="16" />
                                        </Link>
                                        <template
                                            v-if="
                                                hasRole([
                                                    'admin',
                                                    'manager',
                                                    'buyer',
                                                    'assistant',
                                                ])
                                            "
                                        >
                                            <button
                                                v-if="po.status === 'draft'"
                                                @click="handleSend(po.id)"
                                                class="p-2 text-gray-400 transition hover:text-blue-600 dark:text-primary"
                                                title="Enviar al proveedor"
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
                                                @click="handleCancel(po.id)"
                                                class="p-2 text-gray-400 transition hover:text-orange-600"
                                                title="Cancelar"
                                            >
                                                <XCircle :size="16" />
                                            </button>
                                            <button
                                                v-if="po.status === 'draft'"
                                                @click="handleDelete(po.id)"
                                                class="p-2 text-gray-400 transition hover:text-red-600"
                                                title="Eliminar"
                                            >
                                                <Trash2 :size="16" />
                                            </button>
                                        </template>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div
                    v-if="pagination && pagination.last_page > 1"
                    class="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-border"
                >
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        Mostrando {{ purchaseOrders.length }} de
                        {{ pagination.total }} órdenes
                    </p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
