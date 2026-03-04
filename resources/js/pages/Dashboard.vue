<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import SalesChart from '@/components/dashboard/SalesChart.vue'
import CategorySalesChart from '@/components/dashboard/CategorySalesChart.vue'
import TopCashiers from '@/components/dashboard/TopCashiers.vue'
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed.vue'
import { dashboard } from '@/routes'
import { type BreadcrumbItem } from '@/types'
import { useDashboard } from '@/composables/useDashboard'
import { usePosSettings } from '@/composables/usePosSettings'

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
]

const { 
    stats, topProducts, lowStockProducts, chartData, profitByBrand, 
    salesByCategory, topCashiers, recentActivity,
    loading, error, fetchDashboardData 
} = useDashboard()
const { currentWarehouseId, initWarehouse } = usePosSettings()

const selectedPeriod = ref<string>('7d')

const periodOptions = [
    { value: '7d', label: 'Últimos 7 Días' },
    { value: '30d', label: 'Últimos 30 Días' },
    { value: '90d', label: 'Últimos 90 Días' },
]

// Load dashboard data on mount — init warehouse first so currentWarehouseId is populated
onMounted(async () => {
    await initWarehouse()
    await fetchDashboardData(currentWarehouseId.value, selectedPeriod.value)
})

// Watch warehouse changes and refetch data
watch(currentWarehouseId, async (newWarehouseId) => {
    await fetchDashboardData(newWarehouseId, selectedPeriod.value)
})

// Watch period changes and refetch data
watch(selectedPeriod, async (newPeriod) => {
    await fetchDashboardData(currentWarehouseId.value, newPeriod)
})


const navigateTo = (path: string) => {
    router.visit(path)
}
</script>


<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Loading State -->
            <div v-if="loading" class="flex items-center justify-center py-12">
                <div class="text-center">
                    <div class="text-gray-600 dark:text-gray-400">Cargando datos del dashboard...</div>
                </div>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                {{ error }}
            </div>

            <!-- Dashboard Content -->
            <div v-else>
                <!-- Stats Cards -->
                <div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                    <!-- Ventas del Día -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Ventas del Día</p>
                                <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                    ${{ stats.today_sales.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
                                </p>
                            </div>
                            <div class="rounded-full bg-green-100 p-3 dark:bg-green-900">
                                <svg class="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <!-- Utilidad del Día -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Utilidad del Día</p>
                                <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                    ${{ stats.today_profit.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
                                </p>
                                <p class="text-xs mt-1" :class="stats.today_sales > 0 ? 'text-emerald-600' : 'text-gray-400'">
                                    {{ stats.today_sales > 0 ? ((stats.today_profit / stats.today_sales) * 100).toFixed(1) + '% margen' : '—' }}
                                </p>
                            </div>
                            <div class="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900">
                                <svg class="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <!-- Órdenes Pendientes -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Órdenes Pendientes</p>
                                <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ stats.pending_orders }}</p>
                            </div>
                            <div class="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
                                <svg class="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <!-- Stock Bajo -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Stock Bajo</p>
                                <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ stats.low_stock_items }}</p>
                            </div>
                            <div class="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900">
                                <svg class="h-8 w-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <!-- Alertas -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Alertas Activas</p>
                                <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ stats.active_alerts }}</p>
                            </div>
                            <div class="rounded-full bg-red-100 p-3 dark:bg-red-900">
                                <svg class="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <!-- Inventario Valorado -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Valor Inventario</p>
                                <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                    ${{ (stats.total_inventory_value || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
                                </p>
                            </div>
                            <div class="rounded-full bg-indigo-100 p-3 dark:bg-indigo-900">
                                <svg class="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sales Chart Section -->
                <div class="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <div class="mb-4 flex items-center justify-between">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Tendencia de Ventas</h2>
                        <div class="flex gap-2">
                            <button
                                v-for="option in periodOptions"
                                :key="option.value"
                                @click="selectedPeriod = option.value"
                                :class="[
                                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                                    selectedPeriod === option.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                ]"
                            >
                                {{ option.label }}
                            </button>
                        </div>
                    </div>
                    <div class="h-80">
                        <SalesChart :data="chartData" :period="selectedPeriod" />
                    </div>
                </div>

                <!-- Secondary Charts Grid -->
                <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <!-- Categorías Doughnut -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Ventas por Categoría</h2>
                        <div class="h-64">
                            <CategorySalesChart :data="salesByCategory || []" />
                        </div>
                    </div>
                    
                    <!-- Mejores Cajeros -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Desempeño del Personal</h2>
                        <TopCashiers :cashiers="topCashiers || []" />
                    </div>
                </div>

                <!-- Content Grid -->
                <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <!-- Productos Más Vendidos -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Productos Más Vendidos</h2>
                        <div class="space-y-3">
                            <div v-for="(product, index) in topProducts" :key="index" class="flex items-center justify-between">
                                <span class="text-sm text-gray-900 dark:text-white">{{ product.name }}</span>
                                <span class="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                                    {{ product.sales }} vendidos
                                </span>
                            </div>
                            <div v-if="topProducts.length === 0" class="text-sm text-center text-gray-500 py-4">
                                No hay datos de ventas.
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actividad Reciente -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Actividad Reciente</h2>
                        <RecentActivityFeed :activities="recentActivity || []" />
                    </div>

                    <div class="flex flex-col gap-6">
                        <!-- Stock Bajo -->
                        <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                            <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Stock Bajo</h2>
                            <div class="space-y-3">
                                <div v-for="(product, index) in lowStockProducts" :key="index" class="flex items-center justify-between">
                                    <span class="text-sm text-gray-900 dark:text-white">{{ product.name }}</span>
                                    <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
                                        {{ product.stock }} uds
                                    </span>
                                </div>
                                <div v-if="lowStockProducts.length === 0" class="text-sm text-center text-gray-500 py-4">
                                    Inventario saludable.
                                </div>
                            </div>
                            <button @click="navigateTo('/inventory')" class="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                                Ver Inventario
                            </button>
                        </div>
    
                        <!-- Accesos Rápidos -->
                        <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                            <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Accesos Rápidos</h2>
                            <div class="grid grid-cols-2 gap-3">
                                <button @click="navigateTo('/products/create')" class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-700">
                                    <svg class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-900 dark:text-white">Nuevo</span>
                                </button>
    
                                <button @click="navigateTo('/products')" class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-700">
                                    <svg class="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-900 dark:text-white">Buscar</span>
                                </button>
    
                                <button @click="navigateTo('/inventory')" class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-700">
                                    <svg class="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-900 dark:text-white">Stock</span>
                                </button>
    
                                <button class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 opacity-50 cursor-not-allowed dark:border-gray-700">
                                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-400">POS</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                    <!-- Rentabilidad por Marca -->
                    <div v-if="profitByBrand.length > 0" class="lg:col-span-3 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Rentabilidad por Marca</h2>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b border-gray-200 dark:border-gray-700">
                                        <th class="py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Marca</th>
                                        <th class="py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Ingresos</th>
                                        <th class="py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Costo</th>
                                        <th class="py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Utilidad</th>
                                        <th class="py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Margen</th>
                                        <th class="py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Uds.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(brand, idx) in profitByBrand" :key="idx" class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td class="py-3 font-medium text-gray-900 dark:text-white">{{ brand.brand }}</td>
                                        <td class="py-3 text-right text-gray-700 dark:text-gray-300">${{ brand.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
                                        <td class="py-3 text-right text-gray-500 dark:text-gray-400">${{ brand.cost.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
                                        <td class="py-3 text-right font-semibold" :class="brand.profit >= 0 ? 'text-emerald-600' : 'text-red-600'">${{ brand.profit.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
                                        <td class="py-3 text-right">
                                            <span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="brand.margin >= 20 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' : brand.margin >= 10 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'">
                                                {{ brand.margin }}%
                                            </span>
                                        </td>
                                        <td class="py-3 text-right text-gray-600 dark:text-gray-400">{{ brand.units_sold }}</td>
                                    </tr>
                                </tbody>
                            </table>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
