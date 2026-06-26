<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    BarChart3,
    AlertCircle,
    TrendingUp,
    Package,
    Download,
    DollarSign,
    Warehouse,
    FileSpreadsheet,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    X,
} from 'lucide-vue-next';
import { ref, onMounted, computed, watch } from 'vue';
import StockStatusChart from '@/components/charts/StockStatusChart.vue';
import TopProductsChart from '@/components/charts/TopProductsChart.vue';
import WarehouseDistributionChart from '@/components/charts/WarehouseDistributionChart.vue';
import Pagination from '@/components/Pagination.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useBrands } from '@/composables/useBrands';
import { useCategories } from '@/composables/useCategories';
import { usePosSettings } from '@/composables/usePosSettings';
import { useReports } from '@/composables/useReports';
import { useWarehouses } from '@/composables/useWarehouses';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import type { StockLevelsFilters } from '@/types/report';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/stock-levels' },
    { title: 'Niveles de Stock', href: '/reports/stock-levels' },
];

const { stockLevelsReport, loading, error, fetchStockLevels, exportReport } =
    useReports();
const { warehouses, fetchWarehouses } = useWarehouses();
const { brands, fetchBrands } = useBrands();
const { categories, fetchCategories } = useCategories();
const { currentWarehouseId, initWarehouse } = usePosSettings();

const filters = ref({
    warehouse_id: null as number | null,
    brand_id: null as number | null,
    category_id: null as number | null,
    status: null as 'critical' | 'low' | 'normal' | 'optimal' | null,
});

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos los almacenes' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const brandOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas las marcas' },
    ...brands.value.map((brand) => ({
        value: brand.id,
        label: brand.name,
    })),
]);

const categoryOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas las categorías' },
    ...categories.value.map((category) => ({
        value: category.id,
        label: category.name,
    })),
]);

watch(currentWarehouseId, (val) => {
    filters.value.warehouse_id = val;
    applyFilters();
});

const exporting = ref(false);
const currentPage = ref(1);
const sortBy = ref<NonNullable<StockLevelsFilters['sort_by']>>('name');
const sortDirection =
    ref<NonNullable<StockLevelsFilters['sort_direction']>>('asc');

onMounted(async () => {
    await Promise.all([
        initWarehouse(),
        fetchWarehouses(),
        fetchBrands(),
        fetchCategories(),
    ]);
    filters.value.warehouse_id = currentWarehouseId.value;
    await fetchStockLevels(buildFilterParams(currentPage.value));
});

const buildFilterParams = (page = 1) => {
    const filterParams: StockLevelsFilters = {
        page,
        sort_by: sortBy.value,
        sort_direction: sortDirection.value,
    };

    if (filters.value.warehouse_id)
        filterParams.warehouse_id = filters.value.warehouse_id;
    if (filters.value.brand_id) filterParams.brand_id = filters.value.brand_id;
    if (filters.value.category_id)
        filterParams.category_id = filters.value.category_id;
    if (filters.value.status) filterParams.status = filters.value.status;

    return filterParams;
};

const applyFilters = async () => {
    currentPage.value = 1;
    const filterParams = buildFilterParams(currentPage.value);

    await fetchStockLevels(filterParams);
};

const clearFilters = async () => {
    currentPage.value = 1;
    filters.value = {
        warehouse_id: null,
        brand_id: null,
        category_id: null,
        status: null,
    };
    await fetchStockLevels(buildFilterParams(currentPage.value));
};

const handlePageChange = async (page: number) => {
    currentPage.value = page;

    await fetchStockLevels(buildFilterParams(page));
};

const handleSort = async (key: NonNullable<StockLevelsFilters['sort_by']>) => {
    if (sortBy.value === key) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortBy.value = key;
        sortDirection.value = 'asc';
    }

    currentPage.value = 1;
    await fetchStockLevels(buildFilterParams(currentPage.value));
};

const sortHeaderClass = (
    key: NonNullable<StockLevelsFilters['sort_by']>,
    align: 'left' | 'right' | 'center' = 'left',
) => [
    'inline-flex w-full items-center gap-1 text-xs font-medium uppercase text-gray-700 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white',
    align === 'right'
        ? 'justify-end'
        : align === 'center'
          ? 'justify-center'
          : 'justify-start',
    sortBy.value === key ? 'text-gray-950 dark:text-white' : '',
];

const handleExport = async (format: 'pdf' | 'excel') => {
    exporting.value = true;
    try {
        await exportReport('stock-levels', format, filters.value);
    } catch (err) {
        console.error('Export error:', err);
    } finally {
        exporting.value = false;
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'critical':
            return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        case 'low':
            return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
        case 'normal':
            return 'text-blue-600 dark:text-primary bg-blue-50 dark:bg-blue-900/20';
        case 'optimal':
            return 'text-green-600 bg-green-50 dark:bg-green-900/20';
        default:
            return 'text-gray-600 bg-gray-50 dark:bg-background/20';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'critical':
            return 'Crítico';
        case 'low':
            return 'Bajo';
        case 'normal':
            return 'Normal';
        case 'optimal':
            return 'Óptimo';
        default:
            return status;
    }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
};

const reportTotal = computed(
    () => stockLevelsReport.value?.pagination?.total ?? 0,
);

const atRiskCount = computed(() => {
    const summary = stockLevelsReport.value?.summary;

    return (summary?.critical_stock ?? 0) + (summary?.low_stock ?? 0);
});

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

const activeFilterChips = computed(() => {
    const chips: Array<{ key: keyof typeof filters.value; label: string }> = [];

    if (filters.value.warehouse_id) {
        chips.push({ key: 'warehouse_id', label: activeWarehouseName.value });
    }

    if (filters.value.brand_id) {
        chips.push({
            key: 'brand_id',
            label:
                brands.value.find(
                    (brand) => brand.id === filters.value.brand_id,
                )?.name ?? 'Marca seleccionada',
        });
    }

    if (filters.value.category_id) {
        chips.push({
            key: 'category_id',
            label:
                categories.value.find(
                    (category) => category.id === filters.value.category_id,
                )?.name ?? 'Categoría seleccionada',
        });
    }

    if (filters.value.status) {
        chips.push({
            key: 'status',
            label: getStatusLabel(filters.value.status),
        });
    }

    return chips;
});

const removeFilter = async (key: keyof typeof filters.value) => {
    filters.value[key] = null;
    await applyFilters();
};

const inventoryProductHref = (product: {
    id: number;
    warehouse_id?: number | null;
    variant_id?: number | null;
}) => {
    const params = new URLSearchParams();

    if (product.warehouse_id) {
        params.set('warehouse_id', String(product.warehouse_id));
    }

    if (product.variant_id) {
        params.set('variant_id', String(product.variant_id));
    }

    const query = params.toString();

    return `/inventory/products/${product.id}${query ? `?${query}` : ''}`;
};
</script>

<template>
    <Head title="Reporte de Niveles de Stock" />

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
                        <BarChart3 :size="24" />
                        Niveles de stock
                    </h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {{ activeWarehouseName }} · {{ reportTotal }} registros
                        · {{ atRiskCount }} en atención
                    </p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button
                        @click="handleExport('pdf')"
                        :disabled="exporting || loading"
                        class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                    >
                        <Download :size="18" />
                        PDF
                    </button>
                    <button
                        @click="handleExport('excel')"
                        :disabled="exporting || loading"
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

            <!-- Summary Cards -->
            <div
                v-if="stockLevelsReport"
                class="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
            >
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Total Productos
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ stockLevelsReport.summary.total_products }}
                            </p>
                        </div>
                        <Package
                            :size="32"
                            class="text-blue-600 dark:text-primary"
                        />
                    </div>
                </div>

                <div class="rounded-lg bg-red-50 p-6 shadow dark:bg-red-900/20">
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-red-700 dark:text-red-300"
                            >
                                Stock Crítico
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-red-900 dark:text-red-200"
                            >
                                {{ stockLevelsReport.summary.critical_stock }}
                            </p>
                            <p class="text-xs text-red-700 dark:text-red-300">
                                {{
                                    formatCurrency(
                                        stockLevelsReport.summary
                                            .critical_value || 0,
                                    )
                                }}
                            </p>
                        </div>
                        <AlertCircle :size="32" class="text-red-600" />
                    </div>
                </div>

                <div
                    class="rounded-lg bg-yellow-50 p-6 shadow dark:bg-yellow-900/20"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-yellow-700 dark:text-yellow-300"
                            >
                                Stock Bajo
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-yellow-900 dark:text-yellow-200"
                            >
                                {{ stockLevelsReport.summary.low_stock }}
                            </p>
                            <p
                                class="text-xs text-yellow-700 dark:text-yellow-300"
                            >
                                {{
                                    formatCurrency(
                                        stockLevelsReport.summary.low_value ||
                                            0,
                                    )
                                }}
                            </p>
                        </div>
                        <TrendingUp :size="32" class="text-yellow-600" />
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
                                Stock Normal
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-200"
                            >
                                {{ stockLevelsReport.summary.normal_stock }}
                            </p>
                        </div>
                        <BarChart3
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
                                Stock Óptimo
                            </p>
                            <p
                                class="mt-2 text-3xl font-bold text-green-900 dark:text-green-200"
                            >
                                {{ stockLevelsReport.summary.optimal_stock }}
                            </p>
                        </div>
                        <Package :size="32" class="text-green-600" />
                    </div>
                </div>

                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Valor inventario
                            </p>
                            <p
                                class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        stockLevelsReport.summary.total_value,
                                    )
                                }}
                            </p>
                            <p
                                class="text-xs text-amber-700 dark:text-amber-300"
                            >
                                Riesgo:
                                {{
                                    formatCurrency(
                                        stockLevelsReport.summary
                                            .at_risk_value || 0,
                                    )
                                }}
                            </p>
                        </div>
                        <DollarSign :size="32" class="text-emerald-600" />
                    </div>
                </div>
            </div>

            <!-- Charts Section -->
            <div
                v-if="stockLevelsReport"
                class="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
                <!-- Stock Status Chart -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="h-80">
                        <StockStatusChart
                            :critical="stockLevelsReport.summary.critical_stock"
                            :low="stockLevelsReport.summary.low_stock"
                            :normal="stockLevelsReport.summary.normal_stock"
                            :optimal="stockLevelsReport.summary.optimal_stock"
                        />
                    </div>
                </div>

                <!-- Warehouse Distribution Chart -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="h-80">
                        <WarehouseDistributionChart
                            :data="stockLevelsReport.by_warehouse"
                        />
                    </div>
                </div>

                <!-- Top Products Chart -->
                <div
                    class="rounded-lg bg-white p-6 shadow md:col-span-2 lg:col-span-1 dark:bg-card"
                >
                    <div class="h-80">
                        <TopProductsChart
                            :products="stockLevelsReport.products"
                            :limit="10"
                        />
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <h2
                    class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                >
                    <Warehouse :size="18" />
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
                <div class="grid items-end gap-4 md:grid-cols-4 lg:grid-cols-5">
                    <!-- Warehouse -->
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

                    <!-- Brand -->
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Marca</label
                        >
                        <SearchableSelect
                            v-model="filters.brand_id"
                            :options="brandOptions"
                            placeholder="Todas las marcas"
                        />
                    </div>

                    <!-- Category -->
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Categoría</label
                        >
                        <SearchableSelect
                            v-model="filters.category_id"
                            :options="categoryOptions"
                            placeholder="Todas las categorías"
                        />
                    </div>

                    <!-- Status -->
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                            >Estado</label
                        >
                        <select
                            v-model="filters.status"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="null">Todos los estados</option>
                            <option value="critical">Crítico</option>
                            <option value="low">Bajo</option>
                            <option value="normal">Normal</option>
                            <option value="optimal">Óptimo</option>
                        </select>
                    </div>

                    <div class="flex items-end gap-2">
                        <button
                            @click="applyFilters"
                            class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            Aplicar
                        </button>
                        <button
                            @click="clearFilters"
                            class="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-100"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Products Table -->
            <div
                v-if="stockLevelsReport"
                class="rounded-lg bg-white shadow dark:bg-card"
            >
                <div class="border-b border-gray-200 p-6 dark:border-border">
                    <h3
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Productos en inventario
                    </h3>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Mostrando 25 productos por página
                    </p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-muted">
                            <tr>
                                <th class="px-6 py-3 text-left">
                                    <button
                                        type="button"
                                        :class="sortHeaderClass('sku')"
                                        @click="handleSort('sku')"
                                    >
                                        SKU
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'sku' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="sortBy === 'sku'"
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-left">
                                    <button
                                        type="button"
                                        :class="sortHeaderClass('name')"
                                        @click="handleSort('name')"
                                    >
                                        Producto
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'name' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="sortBy === 'name'"
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-left">
                                    <button
                                        type="button"
                                        :class="sortHeaderClass('brand')"
                                        @click="handleSort('brand')"
                                    >
                                        Marca
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'brand' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="sortBy === 'brand'"
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-left">
                                    <button
                                        type="button"
                                        :class="sortHeaderClass('warehouse')"
                                        @click="handleSort('warehouse')"
                                    >
                                        Almacén
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'warehouse' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="sortBy === 'warehouse'"
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-right">
                                    <button
                                        type="button"
                                        :class="
                                            sortHeaderClass(
                                                'current_stock',
                                                'right',
                                            )
                                        "
                                        @click="handleSort('current_stock')"
                                    >
                                        Stock
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'current_stock' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="
                                                sortBy === 'current_stock'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-right">
                                    <button
                                        type="button"
                                        :class="
                                            sortHeaderClass(
                                                'reorder_point',
                                                'right',
                                            )
                                        "
                                        @click="handleSort('reorder_point')"
                                    >
                                        Reorden
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'reorder_point' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="
                                                sortBy === 'reorder_point'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-right">
                                    <button
                                        type="button"
                                        :class="
                                            sortHeaderClass(
                                                'target_level',
                                                'right',
                                            )
                                        "
                                        @click="handleSort('target_level')"
                                    >
                                        Objetivo
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'target_level' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="
                                                sortBy === 'target_level'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-center">
                                    <button
                                        type="button"
                                        :class="
                                            sortHeaderClass('status', 'center')
                                        "
                                        @click="handleSort('status')"
                                    >
                                        Estado
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'status' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="sortBy === 'status'"
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-right">
                                    <button
                                        type="button"
                                        :class="
                                            sortHeaderClass(
                                                'current_cost',
                                                'right',
                                            )
                                        "
                                        @click="handleSort('current_cost')"
                                    >
                                        Costo actual
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'current_cost' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="
                                                sortBy === 'current_cost'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                                <th class="px-6 py-3 text-right">
                                    <button
                                        type="button"
                                        :class="
                                            sortHeaderClass(
                                                'stock_value',
                                                'right',
                                            )
                                        "
                                        @click="handleSort('stock_value')"
                                    >
                                        Valor
                                        <ChevronUp
                                            v-if="
                                                sortBy === 'stock_value' &&
                                                sortDirection === 'asc'
                                            "
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronDown
                                            v-else-if="sortBy === 'stock_value'"
                                            class="h-3.5 w-3.5"
                                        />
                                        <ChevronsUpDown
                                            v-else
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 dark:divide-border"
                        >
                            <tr
                                v-for="product in stockLevelsReport.products"
                                :key="`${product.id}-${product.variant_id || 'base'}-${product.warehouse_id}`"
                                class="hover:bg-gray-50 dark:hover:bg-muted/50"
                            >
                                <td
                                    class="px-6 py-4 text-sm text-gray-900 dark:text-white"
                                >
                                    <Link
                                        :href="inventoryProductHref(product)"
                                        class="font-mono text-blue-700 hover:underline dark:text-blue-300"
                                    >
                                        {{ product.variant_sku || product.sku }}
                                    </Link>
                                </td>
                                <td
                                    class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    <Link
                                        :href="inventoryProductHref(product)"
                                        class="text-blue-700 hover:underline dark:text-blue-300"
                                    >
                                        {{ product.name }}
                                    </Link>
                                    <p
                                        v-if="product.variant_sku"
                                        class="mt-1 font-mono text-xs font-normal text-gray-500"
                                    >
                                        Variante {{ product.variant_sku }}
                                    </p>
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ product.brand || '-' }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ product.warehouse }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    {{ product.current_stock }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ product.reorder_point }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ product.target_level }}
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span
                                        :class="getStatusColor(product.status)"
                                        class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                    >
                                        {{ getStatusLabel(product.status) }}
                                    </span>
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{
                                        formatCurrency(
                                            product.current_cost ||
                                                product.fifo_cost_current ||
                                                0,
                                        )
                                    }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{ formatCurrency(product.stock_value) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <Pagination
                    v-if="stockLevelsReport.pagination"
                    :pagination="stockLevelsReport.pagination"
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
