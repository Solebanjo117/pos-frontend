<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    Clock,
    AlertCircle,
    TrendingUp,
    Download,
    Calendar,
    ArrowDown,
    ArrowUp,
    DollarSign,
    FileSpreadsheet,
    PackageSearch,
    X,
} from 'lucide-vue-next';
import { ref, onMounted, computed, watch } from 'vue';
import MovementTrendChart from '@/components/charts/MovementTrendChart.vue';
import MovementTypeChart from '@/components/charts/MovementTypeChart.vue';
import Pagination from '@/components/Pagination.vue';
import ProductCombobox from '@/components/ProductCombobox.vue';
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useProducts } from '@/composables/useProducts';
import { useReports } from '@/composables/useReports';
import { useUsers } from '@/composables/useUsers';
import { useWarehouses } from '@/composables/useWarehouses';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { formatCurrency } from '@/utils/formatters';

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
const currentPage = ref(1);

const readInitialFilters = () => {
    const params = new URLSearchParams(window.location.search);
    const warehouseId = Number(params.get('warehouse_id'));
    const productId = Number(params.get('product_id'));

    if (params.get('date_from')) {
        filters.value.date_from = params.get('date_from') as string;
    }

    if (params.get('date_to')) {
        filters.value.date_to = params.get('date_to') as string;
    }

    if (warehouseId > 0) {
        filters.value.warehouse_id = warehouseId;
    }

    if (productId > 0) {
        filters.value.product_id = productId;
    }
};

onMounted(async () => {
    await Promise.all([
        initWarehouse(),
        fetchWarehouses(),
        fetchUsers(),
        fetchProducts(),
    ]);
    readInitialFilters();

    if (!filters.value.warehouse_id) {
        filters.value.warehouse_id = currentWarehouseId.value;
    }

    await fetchMovementHistory(buildFilterParams(currentPage.value)!);
});

watch(currentWarehouseId, (val) => {
    filters.value.warehouse_id = val;
    applyFilters();
});

const buildFilterParams = (page = 1) => {
    if (!filters.value.date_from || !filters.value.date_to) {
        return null;
    }

    const filterParams: any = {
        date_from: filters.value.date_from,
        date_to: filters.value.date_to,
        group_by: filters.value.group_by,
        page,
    };

    if (filters.value.product_id)
        filterParams.product_id = filters.value.product_id;
    if (filters.value.warehouse_id)
        filterParams.warehouse_id = filters.value.warehouse_id;
    if (filters.value.user_id) filterParams.user_id = filters.value.user_id;
    if (filters.value.movement_type)
        filterParams.movement_type = filters.value.movement_type;

    return filterParams;
};

const applyFilters = async () => {
    currentPage.value = 1;
    const filterParams = buildFilterParams(currentPage.value);

    if (!filterParams) {
        return;
    }

    await fetchMovementHistory(filterParams);
};

const clearFilters = async () => {
    currentPage.value = 1;
    filters.value = {
        date_from: thirtyDaysAgo.toISOString().split('T')[0],
        date_to: today.toISOString().split('T')[0],
        product_id: null,
        warehouse_id: null,
        user_id: null,
        movement_type: null,
        group_by: 'day',
    };
    await fetchMovementHistory(buildFilterParams(currentPage.value)!);
};

const handlePageChange = async (page: number) => {
    currentPage.value = page;
    const filterParams = buildFilterParams(page);

    if (!filterParams) {
        return;
    }

    await fetchMovementHistory(filterParams);
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

const activeWarehouseName = computed(() => {
    if (!filters.value.warehouse_id) {
        return 'Todos los almacenes';
    }

    return (
        warehouses.value.find(
            (warehouse) => warehouse.id === filters.value.warehouse_id,
        )?.name ?? 'Almacén seleccionado'
    );
});

const reportTotal = computed(
    () => movementHistoryReport.value?.pagination?.total ?? 0,
);

const activeFilterChips = computed(() => {
    const chips: Array<{
        key: 'warehouse_id' | 'user_id' | 'product_id' | 'movement_type';
        label: string;
    }> = [];

    if (filters.value.warehouse_id) {
        chips.push({ key: 'warehouse_id', label: activeWarehouseName.value });
    }

    if (filters.value.user_id) {
        chips.push({
            key: 'user_id',
            label:
                users.value.find((user) => user.id === filters.value.user_id)
                    ?.name ?? 'Responsable seleccionado',
        });
    }

    if (filters.value.product_id) {
        chips.push({ key: 'product_id', label: 'Producto seleccionado' });
    }

    if (filters.value.movement_type) {
        chips.push({
            key: 'movement_type',
            label: getTypeLabel(filters.value.movement_type),
        });
    }

    return chips;
});

const removeFilter = async (
    key: 'warehouse_id' | 'user_id' | 'product_id' | 'movement_type',
) => {
    filters.value[key] = null;
    await applyFilters();
};

const movementLotAllocations = (movement: {
    lot_allocations?: Array<{
        lot_id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
    }>;
    fifo_allocations?: Array<{
        lot_id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
    }>;
}) => movement.lot_allocations || movement.fifo_allocations || [];

const movementAssignedCost = (movement: {
    lot_total_cost?: number;
    fifo_total_cost?: number;
}) => movement.lot_total_cost ?? movement.fifo_total_cost;

const inventoryProductHref = (productId: number, variantId?: number | null) => {
    const params = new URLSearchParams();

    if (filters.value.warehouse_id) {
        params.set('warehouse_id', String(filters.value.warehouse_id));
    }

    if (variantId) {
        params.set('variant_id', String(variantId));
    }

    const query = params.toString();

    return `/inventory/products/${productId}${query ? `?${query}` : ''}`;
};

const sourceHref = (movement: {
    id: number;
    reference_type?: string | null;
    reference_id?: string | number | null;
}) => {
    const type = String(movement.reference_type || '').toLowerCase();
    const id = movement.reference_id;

    if (!id) {
        return `/inventory-movements/${movement.id}`;
    }

    if (type.includes('purchase')) {
        return `/purchase-orders/${id}`;
    }

    if (type.includes('sales') || type.includes('sale')) {
        return `/sales-orders/${id}`;
    }

    if (type.includes('transfer')) {
        return `/inventory-transfers/${id}`;
    }

    return `/inventory-movements/${movement.id}`;
};

const sourceLabel = (movement: {
    reference_type?: string | null;
    reference_id?: string | number | null;
}) => {
    const type = String(movement.reference_type || '').toLowerCase();
    const id = movement.reference_id;

    if (!id) {
        return 'Movimiento manual';
    }

    if (type.includes('purchase')) {
        return `OC #${id}`;
    }

    if (type.includes('sales') || type.includes('sale')) {
        return `Venta #${id}`;
    }

    if (type.includes('transfer')) {
        return `Transferencia #${id}`;
    }

    return `${movement.reference_type || 'Origen'} #${id}`;
};
</script>

<template>
    <Head title="Histórico de Movimientos" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-6 p-4">
            <!-- Header -->
            <div
                class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between dark:border-border dark:bg-card"
            >
                <div>
                    <h1
                        class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                        <Clock :size="24" />
                        Histórico de movimientos
                    </h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {{ activeWarehouseName }} ·
                        {{ reportTotal }} movimientos ·
                        {{ filters.date_from }} a
                        {{ filters.date_to }}
                    </p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button
                        @click="handleExport('pdf')"
                        :disabled="
                            exporting || loading || !movementHistoryReport
                        "
                        class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                    >
                        <Download :size="18" />
                        PDF
                    </button>
                    <button
                        @click="handleExport('excel')"
                        :disabled="
                            exporting || loading || !movementHistoryReport
                        "
                        class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <FileSpreadsheet :size="18" />
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
                    v-if="activeFilterChips.length"
                    class="mb-4 flex flex-wrap gap-2"
                >
                    <button
                        v-for="chip in activeFilterChips"
                        :key="chip.key"
                        @click="removeFilter(chip.key)"
                        class="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-border dark:bg-muted dark:text-gray-200"
                    >
                        {{ chip.label }}
                        <X :size="12" />
                    </button>
                </div>
                <div
                    class="grid items-end gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
                >
                    <DateRangeInput
                        v-model:from="filters.date_from"
                        v-model:to="filters.date_to"
                        label="Rango"
                        class="md:col-span-2"
                    />

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
                class="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
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
                        <ArrowUp :size="32" class="text-green-600" />
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
                        <ArrowDown :size="32" class="text-red-600" />
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
                        <PackageSearch
                            :size="32"
                            class="text-blue-600 dark:text-primary"
                        />
                    </div>
                </div>

                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Costo asignado
                            </p>
                            <p
                                class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        movementHistoryReport.summary
                                            .total_assigned_cost || 0,
                                    )
                                }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Según lotes consumidos
                            </p>
                        </div>
                        <DollarSign :size="32" class="text-emerald-600" />
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
                    Productos con más movimientos
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
                                    <Link
                                        :href="
                                            inventoryProductHref(
                                                product.product_id,
                                            )
                                        "
                                        class="font-mono text-blue-700 hover:underline dark:text-blue-300"
                                    >
                                        {{ product.product_sku }}
                                    </Link>
                                </td>
                                <td
                                    class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    <Link
                                        :href="
                                            inventoryProductHref(
                                                product.product_id,
                                            )
                                        "
                                        class="text-blue-700 hover:underline dark:text-blue-300"
                                    >
                                        {{ product.product_name }}
                                    </Link>
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
                        Mostrando 25 movimientos por página
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
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Origen
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Costo asignado
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Lotes
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
                                    <Link
                                        :href="
                                            inventoryProductHref(
                                                movement.product_id,
                                                movement.variant_id,
                                            )
                                        "
                                        class="font-mono text-blue-700 hover:underline dark:text-blue-300"
                                    >
                                        {{
                                            movement.variant_sku ||
                                            movement.product_sku
                                        }}
                                    </Link>
                                </td>
                                <td
                                    class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    <Link
                                        :href="
                                            inventoryProductHref(
                                                movement.product_id,
                                                movement.variant_id,
                                            )
                                        "
                                        class="text-blue-700 hover:underline dark:text-blue-300"
                                    >
                                        {{ movement.product_name }}
                                    </Link>
                                    <p
                                        v-if="movement.variant_sku"
                                        class="mt-1 font-mono text-xs font-normal text-gray-500"
                                    >
                                        Variante {{ movement.variant_sku }}
                                    </p>
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
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    <Link
                                        :href="sourceHref(movement)"
                                        class="text-blue-700 hover:underline dark:text-blue-300"
                                    >
                                        {{ sourceLabel(movement) }}
                                    </Link>
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{
                                        movementAssignedCost(movement)
                                            ? formatCurrency(
                                                  movementAssignedCost(
                                                      movement,
                                                  ),
                                              )
                                            : '-'
                                    }}
                                </td>
                                <td
                                    class="px-6 py-4 text-xs text-gray-600 dark:text-gray-300"
                                >
                                    <div
                                        v-if="
                                            movementLotAllocations(movement)
                                                .length
                                        "
                                        class="space-y-1"
                                    >
                                        <div
                                            v-for="allocation in movementLotAllocations(
                                                movement,
                                            )"
                                            :key="`${movement.id}-${allocation.lot_id}`"
                                        >
                                            Lote #{{ allocation.lot_id }} ·
                                            {{ allocation.quantity }} @
                                            {{
                                                formatCurrency(
                                                    allocation.unit_cost,
                                                )
                                            }}
                                        </div>
                                    </div>
                                    <span v-else>-</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <Pagination
                    v-if="movementHistoryReport.pagination"
                    :pagination="movementHistoryReport.pagination"
                    :loading="loading"
                    @page-change="handlePageChange"
                />
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
