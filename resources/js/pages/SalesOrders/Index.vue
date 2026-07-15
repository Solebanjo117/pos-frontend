<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import {
    Search,
    Filter,
    Eye,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Clock,
    ShoppingCart,
    DollarSign,
} from 'lucide-vue-next';
import { ref, onMounted, computed, watch } from 'vue';
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useSalesOrders } from '@/composables/useSalesOrders';
import AppLayout from '@/layouts/AppLayout.vue';
import type { SalesOrderStatus } from '@/types/sales-order';

defineOptions({ layout: AppLayout });

const {
    salesOrders,
    statistics,
    loading,
    total,
    currentPage,
    perPage,
    totalPages,
    fetchSalesOrders,
    fetchStatistics,
    confirmSalesOrder,
    deleteSalesOrder,
} = useSalesOrders();

const { currentWarehouseId, initWarehouse } = usePosSettings();

// Filters
const filters = ref({
    search: '',
    status: '' as SalesOrderStatus | '',
    customer_id: undefined as number | undefined,
    payment_status: '' as string,
    date_from: '',
    date_to: '',
    sort_by: 'created_at',
    sort_direction: 'desc' as 'asc' | 'desc',
    per_page: 15,
});

const statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'draft', label: 'Borrador' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'processing', label: 'En Proceso' },
    { value: 'completed', label: 'Completada' },
    { value: 'cancelled', label: 'Cancelada' },
];

const quickStatusOptions = statusOptions.filter((option) => option.value);

const paymentStatusOptions = [
    { value: '', label: 'Todos los pagos' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'partial', label: 'Parcial' },
    { value: 'paid', label: 'Pagado' },
    { value: 'refunded', label: 'Reembolsado' },
];

const quickPaymentStatusOptions = paymentStatusOptions.filter(
    (option) => option.value,
);

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

// Status badge color mapping
const getStatusColor = (status: SalesOrderStatus) => {
    const colors = {
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

const filterByStatus = (status: SalesOrderStatus) => {
    filters.value.status = status;
    currentPage.value = 1;
    loadSalesOrders();
};

const filterByPaymentStatus = (paymentStatus: string) => {
    filters.value.payment_status = paymentStatus;
    currentPage.value = 1;
    loadSalesOrders();
};

const filterByCustomer = (customerId?: number) => {
    if (!customerId) return;

    filters.value.customer_id = customerId;
    currentPage.value = 1;
    loadSalesOrders();
};

const clearFilter = (
    key:
        | 'search'
        | 'status'
        | 'customer_id'
        | 'payment_status'
        | 'date_from'
        | 'date_to',
) => {
    if (key === 'customer_id') {
        filters.value.customer_id = undefined;
    } else {
        filters.value[key] = '';
    }

    currentPage.value = 1;
    loadSalesOrders();
};

const clearAllFilters = () => {
    filters.value.search = '';
    filters.value.status = '';
    filters.value.customer_id = undefined;
    filters.value.payment_status = '';
    filters.value.date_from = '';
    filters.value.date_to = '';
    currentPage.value = 1;
    loadSalesOrders();
};

const activeFilters = computed(() => {
    const active = [];

    if (filters.value.search) {
        active.push({
            key: 'search' as const,
            label: `Buscar: ${filters.value.search}`,
        });
    }

    if (filters.value.status) {
        active.push({
            key: 'status' as const,
            label:
                statusOptions.find(
                    (option) => option.value === filters.value.status,
                )?.label || filters.value.status,
        });
    }

    if (filters.value.customer_id) {
        active.push({
            key: 'customer_id' as const,
            label: `Cliente #${filters.value.customer_id}`,
        });
    }

    if (filters.value.payment_status) {
        active.push({
            key: 'payment_status' as const,
            label:
                paymentStatusLabels[filters.value.payment_status] ||
                filters.value.payment_status,
        });
    }

    if (filters.value.date_from) {
        active.push({
            key: 'date_from' as const,
            label: `Desde ${filters.value.date_from}`,
        });
    }

    if (filters.value.date_to) {
        active.push({
            key: 'date_to' as const,
            label: `Hasta ${filters.value.date_to}`,
        });
    }

    return active;
});

const paginationSummary = computed(() => {
    if (!total.value) return 'Sin resultados';

    const first = (currentPage.value - 1) * perPage.value + 1;
    const last = Math.min(currentPage.value * perPage.value, total.value);

    return `Mostrando ${first} a ${last} de ${total.value} resultados`;
});

const changePage = (page: number) => {
    if (page < 1 || page > totalPages.value || page === currentPage.value)
        return;

    currentPage.value = page;
    filters.value.per_page = perPage.value;
    loadSalesOrders();
};

const hasDestructiveActions = (status: SalesOrderStatus) =>
    status !== 'completed';

// Load data
const loadSalesOrders = async () => {
    const filterParams = {
        ...filters.value,
        page: currentPage.value,
        status: filters.value.status || undefined,
        payment_status: filters.value.payment_status || undefined,
        customer_id: filters.value.customer_id || undefined,
        date_from: filters.value.date_from || undefined,
        date_to: filters.value.date_to || undefined,
        search: filters.value.search || undefined,
        warehouse_id: currentWarehouseId.value || undefined,
    };
    await fetchSalesOrders(filterParams as any);
};

// Handle actions
const handleConfirm = async (id: number) => {
    if (!confirm('¿Confirmar esta orden? Esto descontará el inventario.'))
        return;

    try {
        await confirmSalesOrder(id);
        await loadSalesOrders();
    } catch (err) {
        console.error('Error al confirmar orden:', err);
    }
};

const handleCancel = async (id: number) => {
    router.visit(`/sales-orders/${id}?action=cancel`);
};

const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta orden? Esta acción no se puede deshacer.'))
        return;

    try {
        await deleteSalesOrder(id);
        await loadSalesOrders();
    } catch (err) {
        console.error('Error al eliminar orden:', err);
    }
};

// Initialize
onMounted(async () => {
    await initWarehouse();
    await loadSalesOrders();
    await fetchStatistics({
        warehouse_id: currentWarehouseId.value || undefined,
    });
});

watch(currentWarehouseId, async () => {
    await loadSalesOrders();
    await fetchStatistics({
        warehouse_id: currentWarehouseId.value || undefined,
    });
});
</script>

<template>
    <Head title="Órdenes de Venta" />

    <div class="space-y-5">
        <!-- Header -->
        <div
            class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
        >
            <div>
                <h1
                    class="text-2xl font-semibold text-gray-900 dark:text-white"
                >
                    Órdenes de Venta
                </h1>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Gestiona las órdenes de venta y pedidos de clientes
                </p>
            </div>
            <div
                class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm dark:border-border dark:bg-card dark:text-gray-300"
            >
                <Filter :size="16" />
                <span>{{ paginationSummary }}</span>
            </div>
        </div>

        <!-- Statistics Cards -->
        <div v-if="statistics" class="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="flex items-center justify-between">
                    <div>
                        <p
                            class="text-sm font-medium text-gray-600 dark:text-gray-400"
                        >
                            Total Órdenes
                        </p>
                        <p
                            class="mt-1 text-xl font-semibold text-gray-900 dark:text-white"
                        >
                            {{ statistics.total_orders }}
                        </p>
                    </div>
                    <div class="rounded-md bg-blue-100 p-2 dark:bg-blue-900/30">
                        <ShoppingCart
                            class="text-blue-600 dark:text-blue-400"
                            :size="20"
                        />
                    </div>
                </div>
            </div>

            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="flex items-center justify-between">
                    <div>
                        <p
                            class="text-sm font-medium text-gray-600 dark:text-gray-400"
                        >
                            Ventas Totales
                        </p>
                        <p
                            class="mt-1 text-xl font-semibold text-gray-900 dark:text-white"
                        >
                            ${{
                                statistics.total_sales.toLocaleString('es-MX', {
                                    minimumFractionDigits: 2,
                                })
                            }}
                        </p>
                    </div>
                    <div
                        class="rounded-md bg-green-100 p-2 dark:bg-green-900/30"
                    >
                        <DollarSign
                            class="text-green-600 dark:text-green-400"
                            :size="20"
                        />
                    </div>
                </div>
            </div>

            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="flex items-center justify-between">
                    <div>
                        <p
                            class="text-sm font-medium text-gray-600 dark:text-gray-400"
                        >
                            Pendientes
                        </p>
                        <p
                            class="mt-1 text-xl font-semibold text-gray-900 dark:text-white"
                        >
                            {{ statistics.pending_orders }}
                        </p>
                    </div>
                    <div
                        class="rounded-md bg-yellow-100 p-2 dark:bg-yellow-900/30"
                    >
                        <Clock
                            class="text-yellow-600 dark:text-yellow-400"
                            :size="20"
                        />
                    </div>
                </div>
            </div>

            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="flex items-center justify-between">
                    <div>
                        <p
                            class="text-sm font-medium text-gray-600 dark:text-gray-400"
                        >
                            Completadas
                        </p>
                        <p
                            class="mt-1 text-xl font-semibold text-gray-900 dark:text-white"
                        >
                            {{ statistics.completed_orders }}
                        </p>
                    </div>
                    <div
                        class="rounded-md bg-indigo-100 p-2 dark:bg-indigo-900/30"
                    >
                        <CheckCircle
                            class="text-indigo-600 dark:text-indigo-400"
                            :size="20"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div
            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
        >
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Buscar
                    </label>
                    <div class="relative">
                        <Search
                            class="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400"
                            :size="20"
                        />
                        <input
                            v-model="filters.search"
                            type="text"
                            placeholder="Número de orden o cliente..."
                            class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            @input="
                                currentPage = 1;
                                loadSalesOrders();
                            "
                        />
                    </div>
                </div>

                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Estado
                    </label>
                    <select
                        v-model="filters.status"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        @change="
                            currentPage = 1;
                            loadSalesOrders();
                        "
                    >
                        <option
                            v-for="option in statusOptions"
                            :key="option.value"
                            :value="option.value"
                        >
                            {{ option.label }}
                        </option>
                    </select>
                </div>

                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Pago
                    </label>
                    <select
                        v-model="filters.payment_status"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        @change="
                            currentPage = 1;
                            loadSalesOrders();
                        "
                    >
                        <option
                            v-for="option in paymentStatusOptions"
                            :key="option.value"
                            :value="option.value"
                        >
                            {{ option.label }}
                        </option>
                    </select>
                </div>

                <DateRangeInput
                    v-model:from="filters.date_from"
                    v-model:to="filters.date_to"
                    label="Rango de fechas"
                    @change="
                        currentPage = 1;
                        loadSalesOrders();
                    "
                />
            </div>

            <div
                class="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-border"
            >
                <div class="flex flex-wrap items-center gap-2">
                    <span
                        class="text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                        >Estado</span
                    >
                    <button
                        v-for="option in quickStatusOptions"
                        :key="option.value"
                        type="button"
                        :class="[
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            filters.status === option.value
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-primary dark:bg-primary/10 dark:text-primary'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50',
                        ]"
                        @click="
                            filterByStatus(option.value as SalesOrderStatus)
                        "
                    >
                        {{ option.label }}
                    </button>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <span
                        class="text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                        >Pago</span
                    >
                    <button
                        v-for="option in quickPaymentStatusOptions"
                        :key="option.value"
                        type="button"
                        :class="[
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            filters.payment_status === option.value
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-primary dark:bg-primary/10 dark:text-primary'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50',
                        ]"
                        @click="filterByPaymentStatus(option.value)"
                    >
                        {{ option.label }}
                    </button>
                </div>

                <div
                    v-if="activeFilters.length"
                    class="flex flex-wrap items-center gap-2"
                >
                    <span
                        class="text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                        >Activos</span
                    >
                    <button
                        v-for="filter in activeFilters"
                        :key="filter.key"
                        type="button"
                        class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted/70"
                        @click="clearFilter(filter.key)"
                    >
                        {{ filter.label }} Ã—
                    </button>
                    <button
                        type="button"
                        class="text-xs font-medium text-indigo-600 hover:underline dark:text-primary"
                        @click="clearAllFilters"
                    >
                        Limpiar todo
                    </button>
                </div>
            </div>
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
                                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                N Orden
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                Cliente
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                Fecha
                            </th>
                            <th
                                class="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                Total
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                Estado
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                Pago
                            </th>
                            <th
                                class="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody
                        class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                    >
                        <tr v-if="loading">
                            <td
                                colspan="7"
                                class="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                            >
                                Cargando órdenes...
                            </td>
                        </tr>
                        <tr v-else-if="!loading && salesOrders.length === 0">
                            <td
                                colspan="7"
                                class="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                            >
                                No se encontraron órdenes
                            </td>
                        </tr>
                        <tr
                            v-else
                            v-for="order in salesOrders"
                            :key="order.id"
                            class="hover:bg-gray-50 dark:hover:bg-muted/50"
                        >
                            <td class="px-4 py-3 whitespace-nowrap">
                                <Link
                                    :href="`/sales-orders/${order.id}`"
                                    class="text-sm font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-primary"
                                    title="Ver venta"
                                >
                                    {{ order.order_number }}
                                </Link>
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                <button
                                    v-if="order.customer_id"
                                    type="button"
                                    class="text-left text-sm text-gray-900 underline-offset-2 hover:text-indigo-600 hover:underline dark:text-white dark:hover:text-primary"
                                    title="Filtrar por cliente"
                                    @click="filterByCustomer(order.customer_id)"
                                >
                                    {{ order.customer_name || 'Sin cliente' }}
                                </button>
                                <div
                                    v-else
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    Sin cliente
                                </div>
                                <div
                                    v-if="order.customer_code"
                                    class="text-xs text-gray-500 dark:text-gray-400"
                                >
                                    {{ order.customer_code }}
                                </div>
                            </td>
                            <td
                                class="px-4 py-3 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                            >
                                {{
                                    new Date(order.date).toLocaleDateString(
                                        'es-MX',
                                    )
                                }}
                            </td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <div
                                    class="text-sm font-semibold text-gray-900 dark:text-white"
                                >
                                    {{ order.formatted_total }}
                                </div>
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                <button
                                    type="button"
                                    :class="[
                                        'inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold',
                                        getStatusColor(order.status),
                                    ]"
                                    title="Filtrar por estado"
                                    @click="filterByStatus(order.status)"
                                >
                                    {{ order.status_label }}
                                </button>
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                <button
                                    type="button"
                                    :class="[
                                        'inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold',
                                        getPaymentStatusColor(
                                            order.payment_status,
                                        ),
                                    ]"
                                    title="Filtrar por estado de pago"
                                    @click="
                                        filterByPaymentStatus(
                                            order.payment_status,
                                        )
                                    "
                                >
                                    {{
                                        paymentStatusLabels[
                                            order.payment_status
                                        ] || order.payment_status
                                    }}
                                </button>
                            </td>
                            <td
                                class="px-4 py-3 text-right text-sm font-medium whitespace-nowrap"
                            >
                                <div
                                    class="flex items-center justify-end gap-2"
                                >
                                    <Link
                                        :href="`/sales-orders/${order.id}`"
                                        class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:text-primary dark:hover:text-indigo-300"
                                        title="Ver"
                                    >
                                        <Eye :size="18" />
                                    </Link>
                                    <Link
                                        v-if="
                                            order.status === 'draft' ||
                                            order.status === 'pending'
                                        "
                                        :href="`/sales-orders/${order.id}/edit`"
                                        class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:text-primary dark:hover:text-blue-300"
                                        title="Editar"
                                    >
                                        <Edit :size="18" />
                                    </Link>
                                    <button
                                        v-if="
                                            order.status === 'draft' ||
                                            order.status === 'pending'
                                        "
                                        @click="handleConfirm(order.id)"
                                        class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                        title="Confirmar"
                                    >
                                        <CheckCircle :size="18" />
                                    </button>
                                    <span
                                        v-if="
                                            hasDestructiveActions(order.status)
                                        "
                                        class="mx-1 h-5 border-l border-gray-200 dark:border-border"
                                    ></span>
                                    <button
                                        v-if="order.status !== 'cancelled'"
                                        @click="handleCancel(order.id)"
                                        class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                        title="Abrir anulacion auditada"
                                    >
                                        <XCircle :size="18" />
                                    </button>
                                    <button
                                        v-if="
                                            order.status === 'draft' ||
                                            order.status === 'cancelled'
                                        "
                                        @click="handleDelete(order.id)"
                                        class="text-gray-500 hover:text-red-700 dark:text-gray-400 dark:hover:text-red-300"
                                        title="Eliminar"
                                    >
                                        <Trash2 :size="18" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div
                v-if="totalPages > 1"
                class="border-t border-gray-200 px-4 py-3 dark:border-border"
            >
                <div
                    class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div class="text-sm text-gray-700 dark:text-gray-300">
                        {{ paginationSummary }}
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            :disabled="currentPage <= 1"
                            class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                            @click="changePage(currentPage - 1)"
                        >
                            Anterior
                        </button>
                        <span
                            class="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-muted dark:text-gray-300"
                        >
                            {{ currentPage }} / {{ totalPages }}
                        </span>
                        <button
                            type="button"
                            :disabled="currentPage >= totalPages"
                            class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                            @click="changePage(currentPage + 1)"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
