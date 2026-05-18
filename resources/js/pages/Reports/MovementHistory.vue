<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { Head } from '@inertiajs/vue3';
import {
    Clock,
    AlertCircle,
    TrendingUp,
    Download,
    Calendar,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { useReports } from '@/composables/useReports';
import { useWarehouses } from '@/composables/useWarehouses';
import { usePosSettings } from '@/composables/usePosSettings';
import { useUsers } from '@/composables/useUsers';
import { useProducts } from '@/composables/useProducts';
import MovementTrendChart from '@/components/charts/MovementTrendChart.vue';
import MovementTypeChart from '@/components/charts/MovementTypeChart.vue';
import ProductCombobox from '@/components/ProductCombobox.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/stock-levels' },
    { title: 'Histórico de Movimientos', href: '/reports/movement-history' },
];

const {
    movementHistoryReport,
    loading,
    error,
    fetchMovementHistory,
    exportReport,
} = useReports();
const { warehouses, fetchWarehouses } = useWarehouses();
const { users, fetchUsers } = useUsers();
const { products, fetchProducts } = useProducts();
const { currentWarehouseId, initWarehouse } = usePosSettings();

// Calculate default date range (last 30 days)
const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

const filters = ref({
    date_from: thirtyDaysAgo.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    product_id: null as number | null,
    warehouse_id: null as number | null,
    user_id: null as number | null,
    movement_type: null as 'in' | 'out' | 'transfer' | null,
    group_by: 'day' as 'day' | 'week' | 'month',
});

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos los almacenes' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const userOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...users.value.map((user) => ({
        value: user.id,
        label: user.name,
    })),
]);

const exporting = ref(false);

onMounted(async () => {
    await Promise.all([
        initWarehouse(),
        fetchWarehouses(),
        fetchUsers(),
        fetchProducts(),
    ]);
    filters.value.warehouse_id = currentWarehouseId.value;
    await fetchMovementHistory(filters.value);
});

watch(currentWarehouseId, (val) => {
    filters.value.warehouse_id = val;
    applyFilters();
});

const applyFilters = async () => {
    if (!filters.value.date_from || !filters.value.date_to) {
        return;
    }

    const filterParams: any = {
        date_from: filters.value.date_from,
        date_to: filters.value.date_to,
        group_by: filters.value.group_by,
    };

    if (filters.value.product_id)
        filterParams.product_id = filters.value.product_id;
    if (filters.value.warehouse_id)
        filterParams.warehouse_id = filters.value.warehouse_id;
    if (filters.value.user_id) filterParams.user_id = filters.value.user_id;
    if (filters.value.movement_type)
        filterParams.movement_type = filters.value.movement_type;

    await fetchMovementHistory(filterParams);
};

const clearFilters = async () => {
    filters.value = {
        date_from: thirtyDaysAgo.toISOString().split('T')[0],
        date_to: today.toISOString().split('T')[0],
        product_id: null,
        warehouse_id: null,
        user_id: null,
        movement_type: null,
        group_by: 'day',
    };
    await fetchMovementHistory(filters.value);
};

const handleExport = async (format: 'pdf' | 'excel') => {
    exporting.value = true;
    try {
        await exportReport('movement-history', format, filters.value);
    } catch (err) {
        console.error('Export error:', err);
    } finally {
        exporting.value = false;
    }
};

const getTypeColor = (type: string) => {
    switch (type) {
        case 'in':
            return 'text-green-600 bg-green-50 dark:bg-green-900/20';
        case 'out':
            return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        case 'transfer':
            return 'text-blue-600 dark:text-primary bg-blue-50 dark:bg-blue-900/20';
        default:
            return 'text-gray-600 bg-gray-50 dark:bg-background/20';
    }
};

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'in':
            return 'Entrada';
        case 'out':
            return 'Salida';
        case 'transfer':
            return 'Transferencia';
        default:
            return type;
    }
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
</script>

<template>
    <Head title="Histórico de Movimientos" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-6 p-4">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1
                        class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        <Clock :size="32" />
                        Histórico de Movimientos
                    </h1>
                    <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        Análisis de movimientos de inventario
                    </p>
                </div>

                <div class="flex gap-2">
                    <button
                        @click="handleExport('pdf')"
                        :disabled="
                            exporting || loading || !movementHistoryReport
                        "
                        class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        <Download :size="18" />
                        PDF
                    </button>
                    <button
                        @click="handleExport('excel')"
                        :disabled="
                            exporting || loading || !movementHistoryReport
                        "
                        class="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        <Download :size="18" />
                        Excel
                    </button>
                </div>
            </div>

            <!-- Error Message -->
            <div
                v-if="error"
                class="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200"
            >
                <AlertCircle :size="20" />
                {{ error }}
            </div>

            <!-- Filters -->
            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <h2
                    class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                >
                    <Calendar :size="20" />
                    Filtros
                </h2>
                <div
                    class="grid items-end gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
                >
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Fecha Desde</label
                        >
                        <input
                            v-model="filters.date_from"
                            type="date"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Fecha Hasta</label
                        >
                        <input
                            v-model="filters.date_to"
                            type="date"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Almacén</label
                        >
                        <SearchableSelect
                            v-model="filters.warehouse_id"
                            :options="warehouseOptions"
                            placeholder="Todos los almacenes"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Usuario / Responsable</label
                        >
                        <SearchableSelect
                            v-model="filters.user_id"
                            :options="userOptions"
                            placeholder="Todos"
                        />
                    </div>

                    <div class="md:col-span-2">
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Producto</label
                        >
                        <ProductCombobox
                            v-model="filters.product_id"
                            :products="products"
                            placeholder="Buscar producto por SKU o nombre..."
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Tipo</label
                        >
                        <select
                            v-model="filters.movement_type"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="null">Todos los tipos</option>
                            <option value="in">Entradas</option>
                            <option value="out">Salidas</option>
                            <option value="transfer">Transferencias</option>
                        </select>
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Agrupar por</label
                        >
                        <select
                            v-model="filters.group_by"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option value="day">Día</option>
                            <option value="week">Semana</option>
                            <option value="month">Mes</option>
                        </select>
                    </div>

                    <div
                        class="flex items-end gap-2 md:col-span-3 lg:col-span-1"
                    >
                        <button
                            @click="applyFilters"
                            class="h-[42px] flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            Aplicar
                        </button>
                        <button
                            @click="clearFilters"
                            class="h-[42px] flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-100"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div
                v-if="movementHistoryReport"
                class="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            >
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Total Movimientos
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    movementHistoryReport.summary
                                        .total_movements
                                }}
                            </p>
                        </div>
                        <TrendingUp
                            :size="32"
                            class="text-blue-600 dark:text-primary"
                        />
                    </div>
                </div>

                <div
                    class="rounded-lg bg-green-50 p-6 shadow dark:bg-green-900/20"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-green-700 dark:text-green-300"
                            >
                                Entradas
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-green-900 dark:text-green-200"
                            >
                                {{
                                    movementHistoryReport.summary.total_inbound
                                }}
                            </p>
                            <p
                                class="text-xs text-green-700 dark:text-green-300"
                            >
                                {{
                                    movementHistoryReport.summary
                                        .total_quantity_in
                                }}
                                unidades
                            </p>
                        </div>
                    </div>
                </div>

                <div class="rounded-lg bg-red-50 p-6 shadow dark:bg-red-900/20">
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-red-700 dark:text-red-300"
                            >
                                Salidas
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-red-900 dark:text-red-200"
                            >
                                {{
                                    movementHistoryReport.summary.total_outbound
                                }}
                            </p>
                            <p class="text-xs text-red-700 dark:text-red-300">
                                {{
                                    movementHistoryReport.summary
                                        .total_quantity_out
                                }}
                                unidades
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-lg bg-blue-50 p-6 shadow dark:bg-blue-900/20"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-blue-700 dark:text-blue-300"
                            >
                                Cambio Neto
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold"
                                :class="
                                    movementHistoryReport.summary.net_change >=
                                    0
                                        ? 'text-green-900 dark:text-green-200'
                                        : 'text-red-900 dark:text-red-200'
                                "
                            >
                                {{
                                    movementHistoryReport.summary.net_change >=
                                    0
                                        ? '+'
                                        : ''
                                }}{{ movementHistoryReport.summary.net_change }}
                            </p>
                            <p class="text-xs text-blue-700 dark:text-blue-300">
                                unidades
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Section -->
            <div v-if="movementHistoryReport" class="grid gap-6 md:grid-cols-2">
                <!-- Trend Chart -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="h-80">
                        <MovementTrendChart
                            :data="movementHistoryReport.timeline"
                        />
                    </div>
                </div>

                <!-- Type Chart -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="h-80">
                        <MovementTypeChart
                            :data="movementHistoryReport.timeline"
                        />
                    </div>
                </div>
            </div>

            <!-- Top Products Table -->
            <div
                v-if="
                    movementHistoryReport &&
                    movementHistoryReport.by_product.length > 0
                "
                class="rounded-lg bg-white p-6 shadow dark:bg-card"
            >
                <h3
                    class="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
                >
                    Top 10 Productos con Más Movimientos
                </h3>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-muted">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    SKU
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Total
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Entradas
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Salidas
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Transferencias
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 dark:divide-border"
                        >
                            <tr
                                v-for="product in movementHistoryReport.by_product"
                                :key="product.product_id"
                                class="hover:bg-gray-50 dark:hover:bg-muted/50"
                            >
                                <td
                                    class="px-6 py-4 text-sm text-gray-900 dark:text-white"
                                >
                                    {{ product.product_sku }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{ product.product_name }}
                                </td>
                                <td
                                    class="px-6 py-4 text-center text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    {{ product.total_movements }}
                                </td>
                                <td
                                    class="px-6 py-4 text-center text-sm text-green-600"
                                >
                                    {{ product.inbound }}
                                </td>
                                <td
                                    class="px-6 py-4 text-center text-sm text-red-600"
                                >
                                    {{ product.outbound }}
                                </td>
                                <td
                                    class="px-6 py-4 text-center text-sm text-blue-600 dark:text-primary"
                                >
                                    {{ product.transfers }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Movements Table -->
            <div
                v-if="movementHistoryReport"
                class="rounded-lg bg-white shadow dark:bg-card"
            >
                <div class="border-b border-gray-200 p-6 dark:border-border">
                    <h3
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Detalle de Movimientos
                    </h3>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Mostrando los últimos 100 movimientos
                    </p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-muted">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Fecha
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    SKU
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Almacén
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Destino
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Tipo
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Cantidad
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Usuario
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 dark:divide-border"
                        >
                            <tr
                                v-for="movement in movementHistoryReport.movements"
                                :key="movement.id"
                                class="hover:bg-gray-50 dark:hover:bg-muted/50"
                            >
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ formatDate(movement.date) }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-900 dark:text-white"
                                >
                                    {{ movement.product_sku }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{ movement.product_name }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ movement.warehouse }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ movement.destination_warehouse || '-' }}
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span
                                        :class="
                                            getTypeColor(movement.movement_type)
                                        "
                                        class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                    >
                                        {{
                                            getTypeLabel(movement.movement_type)
                                        }}
                                    </span>
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    {{ movement.quantity }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ movement.user || '-' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Loading State -->
            <div
                v-else-if="loading"
                class="flex items-center justify-center py-12"
            >
                <div class="text-gray-700 dark:text-gray-300">
                    Cargando reporte...
                </div>
            </div>
        </div>
    </AppLayout>
</template>
