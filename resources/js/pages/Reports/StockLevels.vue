<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import { BarChart3, AlertCircle, TrendingUp, Package, Download } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useReports } from '@/composables/useReports'
import { useWarehouses } from '@/composables/useWarehouses'
import { usePosSettings } from '@/composables/usePosSettings'
import { useBrands } from '@/composables/useBrands'
import { useCategories } from '@/composables/useCategories'
import StockStatusChart from '@/components/charts/StockStatusChart.vue'
import WarehouseDistributionChart from '@/components/charts/WarehouseDistributionChart.vue'
import TopProductsChart from '@/components/charts/TopProductsChart.vue'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/stock-levels' },
    { title: 'Niveles de Stock', href: '/reports/stock-levels' },
]

const { stockLevelsReport, loading, error, fetchStockLevels, exportReport } = useReports()
const { warehouses, fetchWarehouses } = useWarehouses()
const { brands, fetchBrands } = useBrands()
const { categories, fetchCategories } = useCategories()
const { currentWarehouseId, initWarehouse } = usePosSettings()

const filters = ref({
    warehouse_id: null as number | null,
    brand_id: null as number | null,
    category_id: null as number | null,
    status: null as 'critical' | 'low' | 'normal' | 'optimal' | null,
})

watch(currentWarehouseId, (val) => {
    filters.value.warehouse_id = val
    applyFilters()
})

const exporting = ref(false)

onMounted(async () => {
    await Promise.all([
        initWarehouse(),
        fetchWarehouses(),
        fetchBrands(),
        fetchCategories(),
    ])
    filters.value.warehouse_id = currentWarehouseId.value
    await fetchStockLevels(filters.value.warehouse_id ? { warehouse_id: filters.value.warehouse_id } : {})
})

const applyFilters = async () => {
    const filterParams: any = {}
    if (filters.value.warehouse_id) filterParams.warehouse_id = filters.value.warehouse_id
    if (filters.value.brand_id) filterParams.brand_id = filters.value.brand_id
    if (filters.value.category_id) filterParams.category_id = filters.value.category_id
    if (filters.value.status) filterParams.status = filters.value.status
    
    await fetchStockLevels(filterParams)
}

const clearFilters = async () => {
    filters.value = {
        warehouse_id: null,
        brand_id: null,
        category_id: null,
        status: null,
    }
    await fetchStockLevels()
}

const handleExport = async (format: 'pdf' | 'excel') => {
    exporting.value = true
    try {
        await exportReport('stock-levels', format, filters.value)
    } catch (err) {
        console.error('Export error:', err)
    } finally {
        exporting.value = false
    }
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'critical': return 'text-red-600 bg-red-50 dark:bg-red-900/20'
        case 'low': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
        case 'normal': return 'text-blue-600 dark:text-primary bg-blue-50 dark:bg-blue-900/20'
        case 'optimal': return 'text-green-600 bg-green-50 dark:bg-green-900/20'
        default: return 'text-gray-600 bg-gray-50 dark:bg-background/20'
    }
}

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'critical': return 'Crítico'
        case 'low': return 'Bajo'
        case 'normal': return 'Normal'
        case 'optimal': return 'Óptimo'
        default: return status
    }
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(value)
}
</script>

<template>
    <Head title="Reporte de Niveles de Stock" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4 space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
                        <BarChart3 :size="32" />
                        Reporte de Niveles de Stock
                    </h1>
                    <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        Análisis del estado actual del inventario
                    </p>
                </div>
                
                <div class="flex gap-2">
                    <button
                        @click="handleExport('pdf')"
                        :disabled="exporting || loading"
                        class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        <Download :size="18" />
                        PDF
                    </button>
                    <button
                        @click="handleExport('excel')"
                        :disabled="exporting || loading"
                        class="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        <Download :size="18" />
                        Excel
                    </button>
                </div>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                <AlertCircle :size="20" />
                {{ error }}
            </div>

            <!-- Summary Cards -->
            <div v-if="stockLevelsReport" class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Total Productos</p>
                            <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                {{ stockLevelsReport.summary.total_products }}
                            </p>
                        </div>
                        <Package :size="32" class="text-blue-600 dark:text-primary" />
                    </div>
                </div>

                <div class="rounded-lg bg-red-50 p-6 shadow dark:bg-red-900/20">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-red-700 dark:text-red-300">Stock Crítico</p>
                            <p class="mt-2 text-3xl font-bold text-red-900 dark:text-red-200">
                                {{ stockLevelsReport.summary.critical_stock }}
                            </p>
                        </div>
                        <AlertCircle :size="32" class="text-red-600" />
                    </div>
                </div>

                <div class="rounded-lg bg-yellow-50 p-6 shadow dark:bg-yellow-900/20">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-yellow-700 dark:text-yellow-300">Stock Bajo</p>
                            <p class="mt-2 text-3xl font-bold text-yellow-900 dark:text-yellow-200">
                                {{ stockLevelsReport.summary.low_stock }}
                            </p>
                        </div>
                        <TrendingUp :size="32" class="text-yellow-600" />
                    </div>
                </div>

                <div class="rounded-lg bg-blue-50 p-6 shadow dark:bg-blue-900/20">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-blue-700 dark:text-blue-300">Stock Normal</p>
                            <p class="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-200">
                                {{ stockLevelsReport.summary.normal_stock }}
                            </p>
                        </div>
                        <BarChart3 :size="32" class="text-blue-600 dark:text-primary" />
                    </div>
                </div>

                <div class="rounded-lg bg-green-50 p-6 shadow dark:bg-green-900/20">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-green-700 dark:text-green-300">Stock Óptimo</p>
                            <p class="mt-2 text-3xl font-bold text-green-900 dark:text-green-200">
                                {{ stockLevelsReport.summary.optimal_stock }}
                            </p>
                        </div>
                        <Package :size="32" class="text-green-600" />
                    </div>
                </div>
            </div>

            <!-- Charts Section -->
            <div v-if="stockLevelsReport" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card md:col-span-2 lg:col-span-1">
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
                <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Filtros</h2>
                <div class="grid gap-4 md:grid-cols-4 lg:grid-cols-5 items-end">
                    <!-- Warehouse -->
                    <div>
                        <label class="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Almacén</label>
                        <select
                            v-model="filters.warehouse_id"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="null">Todos los almacenes</option>
                            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                                {{ warehouse.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Brand -->
                    <div>
                        <label class="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Marca</label>
                        <select
                            v-model="filters.brand_id"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="null">Todas las marcas</option>
                            <option v-for="brand in brands" :key="brand.id" :value="brand.id">
                                {{ brand.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Category -->
                    <div>
                        <label class="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Categoría</label>
                        <select
                            v-model="filters.category_id"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="null">Todas las categorías</option>
                            <option v-for="category in categories" :key="category.id" :value="category.id">
                                {{ category.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Status -->
                    <div>
                        <label class="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Estado</label>
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
                            class="flex-1 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-white hover:bg-blue-700 dark:hover:bg-primary/90"
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
            <div v-if="stockLevelsReport" class="rounded-lg bg-white shadow dark:bg-card">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-muted">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700 dark:text-gray-300">SKU</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700 dark:text-gray-300">Producto</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700 dark:text-gray-300">Marca</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700 dark:text-gray-300">Almacén</th>
                                <th class="px-6 py-3 text-right text-xs font-medium uppercase text-gray-700 dark:text-gray-300">Stock</th>
                                <th class="px-6 py-3 text-right text-xs font-medium uppercase text-gray-700 dark:text-gray-300">Reorden</th>
                                <th class="px-6 py-3 text-center text-xs font-medium uppercase text-gray-700 dark:text-gray-300">Estado</th>
                                <th class="px-6 py-3 text-right text-xs font-medium uppercase text-gray-700 dark:text-gray-300">Valor</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-border">
                            <tr v-for="product in stockLevelsReport.products" :key="`${product.id}-${product.warehouse_id}`" class="hover:bg-gray-50 dark:hover:bg-muted/50">
                                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{{ product.sku }}</td>
                                <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{{ product.name }}</td>
                                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{{ product.brand || '-' }}</td>
                                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{{ product.warehouse }}</td>
                                <td class="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">{{ product.current_stock }}</td>
                                <td class="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300">{{ product.reorder_point }}</td>
                                <td class="px-6 py-4 text-center">
                                    <span :class="getStatusColor(product.status)" class="inline-flex rounded-full px-3 py-1 text-xs font-semibold">
                                        {{ getStatusLabel(product.status) }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                    {{ formatCurrency(product.stock_value) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Loading State -->
            <div v-else-if="loading" class="flex items-center justify-center py-12">
                <div class="text-gray-700 dark:text-gray-300">Cargando reporte...</div>
            </div>
        </div>
    </AppLayout>
</template>
