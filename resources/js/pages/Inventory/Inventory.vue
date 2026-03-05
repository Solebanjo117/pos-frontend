<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { PackagePlus, PackageMinus, ArrowLeftRight, ChevronDown, ChevronRight, Package, TrendingUp, AlertCircle, Calendar } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { usePosSettings } from '@/composables/usePosSettings'
import { useAuth } from '@/composables/useAuth'
import apiClient from '@/services/api/client'

const { hasRole } = useAuth()
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
]

const { isSingleWarehouseMode, fetchSettings, currentWarehouseId, initWarehouse } = usePosSettings()

// View Mode
type ViewMode = 'batches' | 'movements'
const viewMode = ref<ViewMode>('batches')

// Interfaces
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

interface BatchItem {
    batch_number: string
    expiry_date: string | null
    manufacturing_date: string | null
    cost: number
    notes: string | null
    total_quantity: number
    product_count: number
    products: Product[]
}

interface Movement {
    id: number
    movement_type: 'in' | 'out' | 'transfer'
    product: {
        id: number
        name: string
        sku: string
    }
    product_batch?: {
        batch_number: string
        expiry_date: string | null
    }
    warehouse: {
        id: number
        name: string
    }
    destination_warehouse?: {
        id: number
        name: string
    } | null
    quantity: number
    created_at: string
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
    date_from: string
    date_to: string
    movement_type: string | undefined
    expiry_status: string | undefined
}

// State
const batches = ref<BatchItem[]>([])
const movements = ref<Movement[]>([])
const warehouses = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const expandedBatches = ref<Set<string>>(new Set())
const expandedHistory = ref<Set<string>>(new Set())

const pagination = ref<Pagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
})

const filters = ref<Filters>({
    search: '',
    warehouse_id: currentWarehouseId.value || undefined,
    date_from: '',
    date_to: '',
    movement_type: undefined,
    expiry_status: undefined,
})

// Metrics
const metrics = ref({
    total_batches: 0,
    total_stock: 0,
    expiring_soon: 0,
    movements_today: 0,
})

// Lifecycle
onMounted(async () => {
    await initWarehouse()
    await Promise.all([
        fetchData(),
        fetchWarehouses(),
        fetchSettings(),
        fetchMetrics()
    ])
})

// Watch view mode changes
watch(viewMode, () => {
    fetchData()
})

// Watch warehouse changes
watch(currentWarehouseId, (newId) => {
    filters.value.warehouse_id = newId || undefined
    fetchData()
})

// Methods
const fetchData = async (page = 1) => {
    if (viewMode.value === 'batches') {
        await fetchBatches(page)
    } else {
        await fetchMovements(page)
    }
}

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

const savingNotes = ref<Set<string>>(new Set())

const updateBatchNote = async (batch: BatchItem) => {
    if (savingNotes.value.has(batch.batch_number)) return
    
    savingNotes.value.add(batch.batch_number)
    try {
        await apiClient.put(`/inventory/batches/${batch.batch_number}/notes`, { notes: batch.notes })
    } catch (err: any) {
        console.error('Error saving batch notes:', err)
        alert('Hubo un error al guardar la nota del lote.')
    } finally {
        savingNotes.value.delete(batch.batch_number)
    }
}

const fetchMovements = async (page = 1) => {
    loading.value = true
    error.value = null
    try {
        const params = {
            page,
            per_page: pagination.value.per_page,
            search: filters.value.search,
            warehouse_id: filters.value.warehouse_id,
            date_from: filters.value.date_from,
            date_to: filters.value.date_to,
            movement_type: filters.value.movement_type,
        }
        const response = await apiClient.get('/inventory-movements', { params })
        movements.value = response.data.data
        pagination.value = response.data.meta
    } catch (err: any) {
        error.value = 'Error al cargar los movimientos.'
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

const fetchMetrics = async () => {
    try {
        const [batchesRes, movementsRes] = await Promise.all([
            apiClient.get('/inventory/batches', { params: { per_page: 1 } }),
            apiClient.get('/inventory-movements', { params: { per_page: 1, date_from: new Date().toISOString().split('T')[0] } })
        ])
        
        metrics.value.total_batches = batchesRes.data.meta.total
        metrics.value.movements_today = movementsRes.data.meta.total
        
        // Fetch expiring soon
        const expiringRes = await apiClient.get('/inventory/batches', { 
            params: { per_page: 1, expiry_status: 'expiring_soon' } 
        })
        metrics.value.expiring_soon = expiringRes.data.meta.total
        
        // Calculate total stock
        const allBatchesRes = await apiClient.get('/inventory/batches', { params: { per_page: 1000 } })
        metrics.value.total_stock = allBatchesRes.data.data.reduce((sum: number, batch: BatchItem) => sum + batch.total_quantity, 0)
    } catch (err) {
        console.error('Error fetching metrics:', err)
    }
}

const applyFilters = () => {
    fetchData(1)
}

const clearFilters = () => {
    filters.value = {
        search: '',
        warehouse_id: undefined,
        date_from: '',
        date_to: '',
        movement_type: undefined,
        expiry_status: undefined,
    }
    fetchData(1)
}

const setDatePreset = (preset: string) => {
    const today = new Date()
    const from = new Date()
    
    switch (preset) {
        case 'today':
            filters.value.date_from = today.toISOString().split('T')[0]
            filters.value.date_to = today.toISOString().split('T')[0]
            break
        case 'week':
            from.setDate(today.getDate() - 7)
            filters.value.date_from = from.toISOString().split('T')[0]
            filters.value.date_to = today.toISOString().split('T')[0]
            break
        case 'month':
            from.setMonth(today.getMonth() - 1)
            filters.value.date_from = from.toISOString().split('T')[0]
            filters.value.date_to = today.toISOString().split('T')[0]
            break
        case '30days':
            from.setDate(today.getDate() - 30)
            filters.value.date_from = from.toISOString().split('T')[0]
            filters.value.date_to = today.toISOString().split('T')[0]
            break
    }
    applyFilters()
}

const goToPage = (page: number) => {
    fetchData(page)
}

const toggleBatch = (batchNumber: string) => {
    if (expandedBatches.value.has(batchNumber)) {
        expandedBatches.value.delete(batchNumber)
    } else {
        expandedBatches.value.add(batchNumber)
    }
}

const toggleBatchHistory = (batchNumber: string) => {
    if (expandedHistory.value.has(batchNumber)) {
        expandedHistory.value.delete(batchNumber)
    } else {
        expandedHistory.value.add(batchNumber)
    }
}

const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: viewMode.value === 'movements' ? '2-digit' : undefined,
        minute: viewMode.value === 'movements' ? '2-digit' : undefined,
    }).format(date)
}

const getExpiryColor = (dateString: string | null) => {
    if (!dateString) return 'text-gray-900 dark:text-white'
    const expiry = new Date(dateString)
    const now = new Date()
    const daysDiff = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24)

    if (daysDiff < 0) return 'text-red-600 font-bold'
    if (daysDiff < 30) return 'text-yellow-600 font-semibold'
    return 'text-green-600'
}

const getMovementTypeLabel = (type: string) => {
    const labels = {
        in: 'Entrada',
        out: 'Salida',
        transfer: 'Transferencia',
    }
    return labels[type as keyof typeof labels] || type
}

const getMovementTypeColor = (type: string) => {
    const colors = {
        in: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        out: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        transfer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

const viewMovement = (id: number) => {
    router.visit(`/inventory-movements/${id}`)
}
</script>

<template>
    <Head title="Inventario" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-8 flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Inventario</h1>
                    <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        Gestión completa de lotes y movimientos
                    </p>
                </div>
                <div class="flex gap-2" v-if="hasRole(['admin', 'manager', 'buyer', 'assistant'])">
                    <a
                        href="/inventory-movements/inbound/create"
                        class="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                        <PackagePlus :size="18" />
                        Nueva Entrada
                    </a>
                    <a
                        href="/inventory-movements/outbound/create"
                        v-if="hasRole(['admin', 'manager'])"
                        class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                        <PackageMinus :size="18" />
                        Nueva Salida
                    </a>
                    <a
                        href="/inventory-movements/transfer/create"
                        v-if="hasRole(['admin', 'manager'])"
                        class="flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-white hover:bg-blue-700 dark:hover:bg-primary/90"
                    >
                        <ArrowLeftRight :size="18" />
                        Nueva Transferencia
                    </a>
                </div>
            </div>

            <!-- Metrics Cards -->
            <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div class="rounded-lg bg-white p-4 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Lotes Activos</p>
                            <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ metrics.total_batches }}</p>
                        </div>
                        <Package class="h-8 w-8 text-blue-600 dark:text-primary" />
                    </div>
                </div>
                <div class="rounded-lg bg-white p-4 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Stock Total</p>
                            <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ metrics.total_stock }}</p>
                        </div>
                        <TrendingUp class="h-8 w-8 text-green-600" />
                    </div>
                </div>
                <div class="rounded-lg bg-white p-4 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Por Vencer (30d)</p>
                            <p class="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">{{ metrics.expiring_soon }}</p>
                        </div>
                        <AlertCircle class="h-8 w-8 text-yellow-600" />
                    </div>
                </div>
                <div class="rounded-lg bg-white p-4 shadow dark:bg-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Movimientos Hoy</p>
                            <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ metrics.movements_today }}</p>
                        </div>
                        <Calendar class="h-8 w-8 text-purple-600" />
                    </div>
                </div>
            </div>

            <!-- View Toggle -->
            <div class="mb-6 flex items-center justify-center gap-2 rounded-lg bg-white p-2 shadow dark:bg-card">
                <button
                    @click="viewMode = 'batches'"
                    :class="[
                        'flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-all',
                        viewMode === 'batches'
                            ? 'bg-blue-600 dark:bg-primary dark:text-primary-foreground text-white shadow-lg'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50'
                    ]"
                >
                    <Package :size="20" />
                    Vista por Lote
                </button>
                <button
                    @click="viewMode = 'movements'"
                    :class="[
                        'flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-all',
                        viewMode === 'movements'
                            ? 'bg-blue-600 dark:bg-primary dark:text-primary-foreground text-white shadow-lg'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50'
                    ]"
                >
                    <Calendar :size="20" />
                    Vista Cronológica
                </button>
            </div>

            <!-- Filters -->
            <div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-card">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-6">
                    <!-- Search -->
                    <div class="md:col-span-2">
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Buscar
                        </label>
                        <input
                            v-model="filters.search"
                            type="text"
                            :placeholder="viewMode === 'batches' ? 'Lote, Producto o SKU...' : 'Producto o SKU...'"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white dark:placeholder-gray-400"
                            @keyup.enter="applyFilters"
                        />
                    </div>

                    <!-- Warehouse Filter -->
                    <div>
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Almacén
                        </label>
                        <select
                            v-model="filters.warehouse_id"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="undefined">Todos</option>
                            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                        </select>
                    </div>

                    <!-- Date Filters (Movements only) -->
                    <template v-if="viewMode === 'movements'">
                        <div>
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Desde
                            </label>
                            <input
                                v-model="filters.date_from"
                                type="date"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                        <div>
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Hasta
                            </label>
                            <input
                                v-model="filters.date_to"
                                type="date"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                        <div>
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Tipo
                            </label>
                            <select
                                v-model="filters.movement_type"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option :value="undefined">Todos</option>
                                <option value="in">Entradas</option>
                                <option value="out">Salidas</option>
                                <option value="transfer">Transferencias</option>
                            </select>
                        </div>
                    </template>

                    <!-- Expiry Filter (Batches only) -->
                    <div v-if="viewMode === 'batches'">
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Caducidad
                        </label>
                        <select
                            v-model="filters.expiry_status"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
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
                            class="flex-1 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-white hover:bg-blue-700 dark:hover:bg-primary/90"
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

                <!-- Date Presets (Movements only) -->
                <div v-if="viewMode === 'movements'" class="mt-4 flex flex-wrap gap-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Rápido:</span>
                    <button
                        @click="setDatePreset('today')"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted"
                    >
                        Hoy
                    </button>
                    <button
                        @click="setDatePreset('week')"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted"
                    >
                        Esta semana
                    </button>
                    <button
                        @click="setDatePreset('month')"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted"
                    >
                        Este mes
                    </button>
                    <button
                        @click="setDatePreset('30days')"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted"
                    >
                        Últimos 30 días
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center py-12">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent"></div>
                <p class="mt-2 text-gray-800 dark:text-gray-200">Cargando...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                <p>{{ error }}</p>
            </div>

            <!-- Batches View -->
            <div v-else-if="viewMode === 'batches' && batches.length > 0" class="overflow-hidden rounded-lg bg-white shadow dark:bg-card">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                    <thead class="bg-gray-50 dark:bg-muted">
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
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Notas
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Cantidad Total
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                        <template v-for="batch in batches" :key="batch.batch_number">
                            <!-- Main Batch Row -->
                            <tr 
                                class="hover:bg-gray-50 dark:hover:bg-muted/50 cursor-pointer"
                                @click="toggleBatch(batch.batch_number)"
                            >
                                <td class="px-6 py-4">
                                    <ChevronRight v-if="!expandedBatches.has(batch.batch_number)" class="h-4 w-4 text-gray-500" />
                                    <ChevronDown v-else class="h-4 w-4 text-gray-500" />
                                </td>
                                <td class="px-6 py-4 text-sm text-blue-600 dark:text-primary font-medium dark:text-blue-400">
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
                                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white" @click.stop>
                                    <div class="relative flex items-center min-w-[150px]">
                                        <input 
                                            v-model="batch.notes" 
                                            @blur="updateBatchNote(batch)"
                                            @keyup.enter="($event.target as HTMLInputElement).blur()"
                                            type="text" 
                                            placeholder="Añadir nota..."
                                            class="w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 text-sm py-1 px-1 transition-colors dark:text-white"
                                            :disabled="savingNotes.has(batch.batch_number)"
                                        />
                                        <div v-if="savingNotes.has(batch.batch_number)" class="absolute right-1 top-1/2 -translate-y-1/2">
                                            <div class="h-3 w-3 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">
                                    {{ batch.total_quantity }}
                                </td>
                            </tr>
                            
                            <!-- Expanded Products Detail -->
                            <tr v-if="expandedBatches.has(batch.batch_number)">
                                <td colspan="6" class="px-6 py-4 bg-gray-50 dark:bg-background">
                                    <div class="pl-8">
                                        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Productos en este lote:</h4>
                                        <div class="space-y-2">
                                            <div 
                                                v-for="product in batch.products" 
                                                :key="product.product_id"
                                                class="flex items-center justify-between bg-white dark:bg-card rounded-lg p-3 border border-gray-200 dark:border-border"
                                            >
                                                <div class="flex-1">
                                                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ product.product_name }}</p>
                                                    <p class="text-xs text-gray-500">SKU: {{ product.product_sku }}</p>
                                                    <div v-if="product.warehouses.length > 0" class="mt-1">
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
                <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-border dark:bg-card">
                    <div>
                        <p class="text-sm text-gray-900 dark:text-white">
                            Mostrando {{ (pagination.current_page - 1) * pagination.per_page + 1 }} a {{ Math.min(pagination.current_page * pagination.per_page, pagination.total) }} de {{ pagination.total }} {{ viewMode === 'batches' ? 'lotes' : 'movimientos' }}
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            @click="goToPage(pagination.current_page - 1)"
                            :disabled="pagination.current_page === 1"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Anterior
                        </button>
                        <button
                            @click="goToPage(pagination.current_page + 1)"
                            :disabled="pagination.current_page === pagination.last_page"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>

            <!-- Movements View -->
            <div v-else-if="viewMode === 'movements' && movements.length > 0" class="overflow-hidden rounded-lg bg-white shadow dark:bg-card">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                    <thead class="bg-gray-50 dark:bg-muted">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Fecha
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Tipo
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Lote / Item
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Almacén Origen
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Almacén Destino
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Cantidad
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                        <tr v-for="movement in movements" :key="movement.id" class="hover:bg-gray-50 dark:hover:bg-muted/50">
                            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {{ formatDate(movement.created_at) }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4">
                                <span :class="getMovementTypeColor(movement.movement_type)" class="inline-flex rounded-full px-2 py-1 text-xs font-semibold">
                                    {{ getMovementTypeLabel(movement.movement_type) }}
                                </span>
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                <div v-if="movement.product_batch">
                                    <span class="font-medium text-blue-600 dark:text-primary dark:text-blue-400">{{ movement.product_batch.batch_number }}</span>
                                    <div v-if="movement.product_batch.expiry_date" class="text-xs text-gray-500">
                                        Vence: {{ formatDate(movement.product_batch.expiry_date).split(',')[0] }}
                                    </div>
                                </div>
                                <div v-else>
                                    <span class="font-medium">{{ movement.product.name }}</span>
                                    <div class="text-xs text-gray-500">SKU: {{ movement.product.sku }}</div>
                                </div>
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {{ movement.warehouse.name }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {{ movement.destination_warehouse?.name || '-' }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                {{ movement.quantity }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                <button
                                    @click="viewMovement(movement.id)"
                                    class="text-blue-600 dark:text-primary hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    Ver detalle
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Pagination -->
                <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-border dark:bg-card">
                    <div>
                        <p class="text-sm text-gray-900 dark:text-white">
                            Mostrando {{ (pagination.current_page - 1) * pagination.per_page + 1 }} a {{ Math.min(pagination.current_page * pagination.per_page, pagination.total) }} de {{ pagination.total }} movimientos
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            @click="goToPage(pagination.current_page - 1)"
                            :disabled="pagination.current_page === 1"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Anterior
                        </button>
                        <button
                            @click="goToPage(pagination.current_page + 1)"
                            :disabled="pagination.current_page === pagination.last_page"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="rounded-lg bg-white p-12 text-center shadow dark:bg-card">
                <p class="text-gray-700 dark:text-gray-300">
                    {{ viewMode === 'batches' ? 'No se encontraron lotes activos.' : 'No hay movimientos registrados.' }}
                </p>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {{ viewMode === 'batches' ? 'Ajusta los filtros o registra una nueva entrada de inventario.' : 'Registra tu primer movimiento usando los botones de arriba.' }}
                </p>
            </div>
        </div>
    </AppLayout>
</template>
