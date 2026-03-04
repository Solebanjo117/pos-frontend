<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head } from '@inertiajs/vue3'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { usePosSettings } from '@/composables/usePosSettings'
import apiClient from '@/services/api/client'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario de Lotes', href: '/inventory/batches' },
]

const { isSingleWarehouseMode, fetchSettings, currentWarehouseId, initWarehouse } = usePosSettings()

// Types
interface Product {
    product_id: number
    product_name: string
    product_sku: string
    total_quantity: number
    warehouses: Array<{
        warehouse_id: number
        warehouse_name: string
        quantity: number
    }>
}

interface BatchInventoryItem {
    batch_number: string
    expiry_date: string | null
    manufacturing_date: string | null
    cost: number
    total_quantity: number
    product_count: number
    products: Product[]
}

interface Pagination {
    current_page: number
    last_page: number
    per_page: number
    total: number
}

interface Filters {
    search: string
    warehouse_id: number | undefined
    expiry_status: string | undefined
    sort_order: 'asc' | 'desc'
}

// State
const batches = ref<BatchInventoryItem[]>([])
const warehouses = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const expandedBatches = ref<Set<string>>(new Set())
const pagination = ref<Pagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
})

const filters = ref<Filters>({
    search: '',
    warehouse_id: undefined,
    expiry_status: undefined,
    sort_order: 'desc',
})

// Lifecycle
onMounted(async () => {
    await Promise.all([
        initWarehouse(),
        fetchWarehouses(),
        fetchSettings()
    ])
    // Preselect warehouse from backend context
    if (currentWarehouseId.value) {
        filters.value.warehouse_id = currentWarehouseId.value
    }
    await fetchBatches()
})

// Methods
const fetchBatches = async (page = 1) => {
    loading.value = true
    error.value = null
    try {
        const params = {
            page,
            per_page: pagination.value.per_page,
            search: filters.value.search,
            warehouse_id: filters.value.warehouse_id,
            expiry_status: filters.value.expiry_status,
            sort_order: filters.value.sort_order,
        }
        const response = await apiClient.get('/inventory/batches', { params })
        batches.value = response.data.data
        pagination.value = response.data.meta
    } catch (err: any) {
        error.value = 'Error al cargar el inventario de lotes.'
        console.error(err)
    } finally {
        loading.value = false
    }
}

const fetchWarehouses = async () => {
    try {
        const response = await apiClient.get('/warehouses')
        warehouses.value = response.data.data
    } catch (err) {
        console.error('Error fetching warehouses:', err)
    }
}

const applyFilters = () => {
    fetchBatches(1)
}

const clearFilters = () => {
    filters.value = {
        search: '',
        warehouse_id: undefined,
        expiry_status: undefined,
        sort_order: 'desc',
    }
    fetchBatches(1)
}

const goToPage = (page: number) => {
    fetchBatches(page)
}

const toggleBatch = (batchNumber: string) => {
    if (expandedBatches.value.has(batchNumber)) {
        expandedBatches.value.delete(batchNumber)
    } else {
        expandedBatches.value.add(batchNumber)
    }
}

const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date)
}

const getExpiryColor = (dateString: string | null) => {
    if (!dateString) return 'text-gray-900 dark:text-white'
    const expiry = new Date(dateString)
    const now = new Date()
    const daysDiff = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24)

    if (daysDiff < 0) return 'text-red-600 font-bold' // Expired
    if (daysDiff < 30) return 'text-yellow-600 font-semibold' // Expiring soon
    return 'text-green-600' // OK
}
</script>

<template>
    <Head title="Inventario de Lotes" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Inventario por Lotes</h1>
                <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    Vista detallada de existencias agrupadas por número de lote.
                </p>
                <div class="mt-4 flex gap-2">
                    <a href="/inventory-movements" class="text-blue-600 hover:underline text-sm">
                        &larr; Ver Historial de Movimientos (Bitácora)
                    </a>
                </div>
            </div>

            <!-- Filters -->
            <div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <!-- Search -->
                    <div class="md:col-span-1">
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Buscar
                        </label>
                        <input
                            v-model="filters.search"
                            type="text"
                            placeholder="Lote, Producto o SKU..."
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                            @keyup.enter="applyFilters"
                        />
                    </div>

                    <!-- Warehouse Filter -->
                    <div v-if="!isSingleWarehouseMode()">
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Almacén
                        </label>
                        <select
                            v-model="filters.warehouse_id"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                            <option :value="undefined">Todos</option>
                            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                        </select>
                    </div>

                    <!-- Expiry Filter -->
                    <div>
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Estado de Caducidad
                        </label>
                        <select
                            v-model="filters.expiry_status"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                            <option :value="undefined">Todos</option>
                            <option value="expiring_soon">Por Vencer (30 días)</option>
                            <option value="expired">Vencidos</option>
                        </select>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-end gap-2">
                        <button
                            @click="applyFilters"
                            class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        >
                            Filtrar
                        </button>
                        <button
                            @click="clearFilters"
                            class="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center py-12">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p class="mt-2 text-gray-800 dark:text-gray-200">Cargando inventario...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                <p>{{ error }}</p>
            </div>

            <!-- Table -->
            <div v-else-if="batches.length > 0" class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="w-12 px-6 py-3"></th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Lote (Batch)
                            </th>
                             <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Vencimiento
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Productos
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Cantidad Total
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        <template v-for="batch in batches" :key="batch.batch_number">
                            <!-- Main Batch Row -->
                            <tr 
                                class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                @click="toggleBatch(batch.batch_number)"
                            >
                                <td class="px-6 py-4">
                                    <ChevronRight v-if="!expandedBatches.has(batch.batch_number)" class="h-4 w-4 text-gray-500" />
                                    <ChevronDown v-else class="h-4 w-4 text-gray-500" />
                                </td>
                                <td class="px-6 py-4 text-sm text-blue-600 font-medium dark:text-blue-400">
                                    {{ batch.batch_number }}
                                </td>
                                <td class="px-6 py-4 text-sm">
                                    <span :class="getExpiryColor(batch.expiry_date)">
                                        {{ formatDate(batch.expiry_date) }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                    {{ batch.product_count }} producto(s)
                                </td>
                                <td class="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">
                                    {{ batch.total_quantity }}
                                </td>
                            </tr>
                            
                            <!-- Expanded Products Detail -->
                            <tr v-if="expandedBatches.has(batch.batch_number)">
                                <td colspan="5" class="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                                    <div class="pl-8">
                                        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Productos en este lote:</h4>
                                        <div class="space-y-2">
                                            <div 
                                                v-for="product in batch.products" 
                                                :key="product.product_id"
                                                class="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                            >
                                                <div class="flex-1">
                                                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ product.product_name }}</p>
                                                    <p class="text-xs text-gray-500">SKU: {{ product.product_sku }}</p>
                                                    <div v-if="!isSingleWarehouseMode() && product.warehouses.length > 0" class="mt-1">
                                                        <span class="text-xs text-gray-600 dark:text-gray-400">
                                                            Almacenes: 
                                                            <span v-for="(wh, idx) in product.warehouses" :key="wh.warehouse_id">
                                                                {{ wh.warehouse_name }} ({{ wh.quantity }})<template v-if="idx < product.warehouses.length - 1">, </template>
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <p class="text-sm font-bold text-gray-900 dark:text-white">{{ product.total_quantity }} unid.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>

                <!-- Pagination -->
                <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                    <div>
                        <p class="text-sm text-gray-900 dark:text-white">
                            Mostrando {{ (pagination.current_page - 1) * pagination.per_page + 1 }} a {{ Math.min(pagination.current_page * pagination.per_page, pagination.total) }} de {{ pagination.total }} lotes
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            @click="goToPage(pagination.current_page - 1)"
                            :disabled="pagination.current_page === 1"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                        >
                            Anterior
                        </button>
                        <button
                            @click="goToPage(pagination.current_page + 1)"
                            :disabled="pagination.current_page === pagination.last_page"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800">
                <p class="text-gray-700 dark:text-gray-300">No se encontraron lotes activos.</p>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Ajusta los filtros o registra una nueva entrada de inventario.
                </p>
            </div>
        </div>
    </AppLayout>
</template>
