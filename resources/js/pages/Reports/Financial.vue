<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import { DollarSign, AlertCircle, TrendingUp, TrendingDown, Calendar, Tag, Box, Warehouse as WarehouseIcon, RefreshCw } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useReports } from '@/composables/useReports'
import { usePosSettings } from '@/composables/usePosSettings'
import { InventoryApiService } from '@/services/inventory'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/financial' },
    { title: 'Finanzas y Rentabilidad', href: '/reports/financial' },
]

const {
    financialReport,
    brandProfitabilityReport,
    categoryProfitabilityReport,
    loading,
    error,
    fetchFinancialReport,
    fetchBrandProfitability,
    fetchCategoryProfitability,
} = useReports()

const { currentWarehouseId, initWarehouse } = usePosSettings()

// Warehouses list
const warehouses = ref<any[]>([])

const loadWarehouses = async () => {
    try {
        const data = await InventoryApiService.getWarehouses()
        warehouses.value = data
    } catch (e) {
        console.error('Failed to load warehouses', e)
    }
}

// Date presets
type DatePreset = 'today' | 'week' | 'month' | 'custom'
const activePreset = ref<DatePreset>('month')

const today = new Date()
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
const monday = new Date(today)
monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

const filters = ref({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    warehouse_id: null as number | null,
})

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
])

const setPreset = (preset: DatePreset) => {
    activePreset.value = preset
    const now = new Date()
    switch (preset) {
        case 'today':
            filters.value.date_from = now.toISOString().split('T')[0]
            filters.value.date_to = now.toISOString().split('T')[0]
            break
        case 'week': {
            const mon = new Date(now)
            mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
            filters.value.date_from = mon.toISOString().split('T')[0]
            filters.value.date_to = now.toISOString().split('T')[0]
            break
        }
        case 'month': {
            const first = new Date(now.getFullYear(), now.getMonth(), 1)
            filters.value.date_from = first.toISOString().split('T')[0]
            filters.value.date_to = now.toISOString().split('T')[0]
            break
        }
        case 'custom':
            // Keep current dates, user edits manually
            break
    }
    applyFilters()
}

onMounted(async () => {
    await Promise.all([initWarehouse(), loadWarehouses()])
    filters.value.warehouse_id = currentWarehouseId.value
    await applyFilters()
})

watch(currentWarehouseId, (val) => {
    if (val && val !== filters.value.warehouse_id) {
        filters.value.warehouse_id = val
        applyFilters()
    }
})

const applyFilters = async () => {
    if (!filters.value.date_from || !filters.value.date_to) return

    await Promise.all([
        fetchFinancialReport(filters.value),
        fetchBrandProfitability(filters.value),
        fetchCategoryProfitability(filters.value),
    ])
}

const onWarehouseChange = () => {
    applyFilters()
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}

const formatPercent = (value: number) => {
    return (value || 0).toFixed(2) + '%'
}

// Chart colors
const chartColors = [
    '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b',
]

// Brand Doughnut Chart
const brandChartData = computed(() => {
    const brands = (brandProfitabilityReport.value || []).slice(0, 5)
    return {
        labels: brands.map((b: any) => b.brand_name),
        datasets: [{
            data: brands.map((b: any) => b.profit),
            backgroundColor: chartColors.slice(0, brands.length),
            borderWidth: 0,
            hoverOffset: 8,
        }],
    }
})

// Category Doughnut Chart
const categoryChartData = computed(() => {
    const cats = (categoryProfitabilityReport.value || []).slice(0, 5)
    return {
        labels: cats.map((c: any) => c.category_name),
        datasets: [{
            data: cats.map((c: any) => c.profit),
            backgroundColor: chartColors.slice(0, cats.length),
            borderWidth: 0,
            hoverOffset: 8,
        }],
    }
})

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom' as const,
            labels: {
                color: '#94a3b8',
                padding: 16,
                usePointStyle: true,
                pointStyleWidth: 10,
                font: { size: 12 },
            },
        },
        tooltip: {
            callbacks: {
                label: (ctx: any) => {
                    const label = ctx.label || ''
                    const val = formatCurrency(ctx.raw)
                    return ` ${label}: ${val}`
                },
            },
        },
    },
    cutout: '65%',
}

// Net profit color
const netProfitColor = computed(() => {
    const profit = financialReport.value?.summary?.net_profit ?? 0
    return profit >= 0 ? 'green' : 'red'
})
</script>

<template>
    <Head title="Reporte Financiero" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4 space-y-6">
            <!-- Header -->
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
                        <DollarSign :size="32" class="text-indigo-500" />
                        Finanzas y Rentabilidad
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Estado de Resultados Simplificado · Análisis por Marca y Categoría
                    </p>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-800">
                <AlertCircle :size="20" />
                {{ error }}
            </div>

            <!-- Filters -->
            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700">
                <div class="flex flex-col lg:flex-row lg:items-end gap-4">
                    <!-- Date Presets -->
                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Período
                        </label>
                        <div class="flex gap-1">
                            <button
                                v-for="p in [
                                    { key: 'today', label: 'Hoy' },
                                    { key: 'week', label: 'Semana' },
                                    { key: 'month', label: 'Mes' },
                                    { key: 'custom', label: 'Personalizado' },
                                ]"
                                :key="p.key"
                                @click="setPreset(p.key as DatePreset)"
                                class="px-3 py-2 text-sm rounded-lg font-medium transition-all"
                                :class="activePreset === p.key
                                    ? 'bg-indigo-600 dark:bg-primary dark:text-primary-foreground text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted'"
                            >
                                {{ p.label }}
                            </button>
                        </div>
                    </div>

                    <!-- Dates -->
                    <div class="flex gap-3 items-end">
                        <div>
                            <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Desde</label>
                            <input
                                v-model="filters.date_from"
                                type="date"
                                @change="activePreset = 'custom'"
                                class="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Hasta</label>
                            <input
                                v-model="filters.date_to"
                                type="date"
                                @change="activePreset = 'custom'"
                                class="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <!-- Warehouse -->
                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            <WarehouseIcon :size="12" class="inline mr-1" />
                            Sucursal
                        </label>
                        <SearchableSelect
                            v-model="filters.warehouse_id"
                            :options="warehouseOptions"
                            placeholder="Todas"
                            class="w-48"
                            @update:model-value="onWarehouseChange"
                        />
                    </div>

                    <!-- Apply (custom) -->
                    <button
                        v-if="activePreset === 'custom'"
                        @click="applyFilters"
                        class="flex items-center gap-2 rounded-lg bg-indigo-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <RefreshCw :size="16" />
                        Aplicar
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-16">
                <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <RefreshCw :size="20" class="animate-spin" />
                    Cargando datos financieros...
                </div>
            </div>

            <template v-else>
                <!-- =================== P&L CARDS =================== -->
                <div v-if="financialReport?.summary" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <!-- Ingresos -->
                    <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700 border-l-4 border-blue-500">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Ingresos</p>
                            <div class="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/30">
                                <DollarSign :size="18" class="text-blue-500" />
                            </div>
                        </div>
                        <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                            {{ formatCurrency(financialReport.summary.total_revenue) }}
                        </p>
                        <p class="mt-1 text-xs text-gray-400">{{ financialReport.summary.orders_count }} órdenes</p>
                    </div>

                    <!-- Devoluciones -->
                    <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700 border-l-4 border-orange-500">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Devoluciones</p>
                            <div class="rounded-lg bg-orange-50 p-2 dark:bg-orange-900/30">
                                <TrendingDown :size="18" class="text-orange-500" />
                            </div>
                        </div>
                        <p class="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {{ formatCurrency(financialReport.summary.total_refunds) }}
                        </p>
                        <p class="mt-1 text-xs text-gray-400">Aprobadas en período</p>
                    </div>

                    <!-- COGS -->
                    <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700 border-l-4 border-red-500">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Costo de Mercancía</p>
                            <div class="rounded-lg bg-red-50 p-2 dark:bg-red-900/30">
                                <Box :size="18" class="text-red-500" />
                            </div>
                        </div>
                        <p class="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
                            {{ formatCurrency(financialReport.summary.total_cogs) }}
                        </p>
                        <p class="mt-1 text-xs text-gray-400">COGS (unit_cost × qty)</p>
                    </div>

                    <!-- Utilidad Neta -->
                    <div
                        class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700 border-l-4"
                        :class="netProfitColor === 'green' ? 'border-emerald-500' : 'border-red-500'"
                    >
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Utilidad Neta</p>
                            <div
                                class="rounded-lg p-2"
                                :class="netProfitColor === 'green' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30'"
                            >
                                <TrendingUp
                                    :size="18"
                                    :class="netProfitColor === 'green' ? 'text-emerald-500' : 'text-red-500'"
                                />
                            </div>
                        </div>
                        <p
                            class="mt-2 text-2xl font-bold"
                            :class="netProfitColor === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
                        >
                            {{ formatCurrency(financialReport.summary.net_profit) }}
                        </p>
                        <p class="mt-1 text-xs text-gray-400">
                            Margen: {{ formatPercent(financialReport.summary.margin_percentage) }}
                        </p>
                    </div>
                </div>

                <!-- =================== PROFITABILITY SECTION =================== -->
                <div class="grid gap-6 lg:grid-cols-2">
                    <!-- Brand Profitability -->
                    <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700">
                        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Tag :size="20" class="text-indigo-500" />
                            Top Marcas por Rentabilidad
                        </h3>

                        <div v-if="brandProfitabilityReport && brandProfitabilityReport.length > 0">
                            <!-- Chart -->
                            <div class="h-56 mb-4">
                                <Doughnut :data="brandChartData" :options="doughnutOptions" />
                            </div>
                            <!-- Table -->
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b border-gray-200 dark:border-border">
                                            <th class="pb-2 text-left font-semibold text-gray-500 dark:text-gray-400">Marca</th>
                                            <th class="pb-2 text-right font-semibold text-gray-500 dark:text-gray-400">Ganancia</th>
                                            <th class="pb-2 text-right font-semibold text-gray-500 dark:text-gray-400">Margen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="(brand, i) in (brandProfitabilityReport || []).slice(0, 5)"
                                            :key="brand.brand_id || 'u-' + i"
                                            class="border-b border-gray-100 dark:border-border/50"
                                        >
                                            <td class="py-2 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                                                <span class="inline-block w-3 h-3 rounded-full" :style="{ background: chartColors[i] }"></span>
                                                {{ brand.brand_name }}
                                            </td>
                                            <td class="py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                {{ formatCurrency(brand.profit) }}
                                            </td>
                                            <td class="py-2 text-right">
                                                <span
                                                    class="px-2 py-0.5 rounded-full text-xs font-semibold"
                                                    :class="brand.margin > 20 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'"
                                                >
                                                    {{ formatPercent(brand.margin) }}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div v-else class="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                            Sin datos de marcas para este período
                        </div>
                    </div>

                    <!-- Category Profitability -->
                    <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700">
                        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Box :size="20" class="text-violet-500" />
                            Top Categorías por Rentabilidad
                        </h3>

                        <div v-if="categoryProfitabilityReport && categoryProfitabilityReport.length > 0">
                            <!-- Chart -->
                            <div class="h-56 mb-4">
                                <Doughnut :data="categoryChartData" :options="doughnutOptions" />
                            </div>
                            <!-- Table -->
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b border-gray-200 dark:border-border">
                                            <th class="pb-2 text-left font-semibold text-gray-500 dark:text-gray-400">Categoría</th>
                                            <th class="pb-2 text-right font-semibold text-gray-500 dark:text-gray-400">Ganancia</th>
                                            <th class="pb-2 text-right font-semibold text-gray-500 dark:text-gray-400">Margen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="(cat, i) in (categoryProfitabilityReport || []).slice(0, 5)"
                                            :key="cat.category_id || 'u-' + i"
                                            class="border-b border-gray-100 dark:border-border/50"
                                        >
                                            <td class="py-2 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                                                <span class="inline-block w-3 h-3 rounded-full" :style="{ background: chartColors[i] }"></span>
                                                {{ cat.category_name }}
                                            </td>
                                            <td class="py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                {{ formatCurrency(cat.profit) }}
                                            </td>
                                            <td class="py-2 text-right">
                                                <span
                                                    class="px-2 py-0.5 rounded-full text-xs font-semibold"
                                                    :class="cat.margin > 20 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'"
                                                >
                                                    {{ formatPercent(cat.margin) }}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div v-else class="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                            Sin datos de categorías para este período
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
