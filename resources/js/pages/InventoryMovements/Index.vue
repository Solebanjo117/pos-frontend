<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { PackagePlus, PackageMinus, ArrowLeftRight } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useInventoryMovements } from '@/composables/useInventoryMovements'
import { usePosSettings } from '@/composables/usePosSettings'
import type { InventoryMovementFilters } from '@/types/inventory-movement'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Movimientos', href: '/inventory-movements' },
]

const { movements, fetchMovements, loading, error, currentPage, lastPage, total } = useInventoryMovements()
const { isSingleWarehouseMode, fetchSettings, currentWarehouseId, initWarehouse } = usePosSettings()

// Load settings and movements on mount
onMounted(async () => {
    await Promise.all([
        initWarehouse(),
        fetchSettings()
    ])
    // Preselect warehouse from backend context
    if (currentWarehouseId.value) {
        filters.value.warehouse_id = currentWarehouseId.value
    }
    await fetchMovements(filters.value)
})

// Filters
const filters = ref<InventoryMovementFilters>({
    search: '',
    movement_type: undefined,
    warehouse_id: undefined,
    date_from: '',
    date_to: '',
})

// Load movements on mount
// Moved to onMounted above

// Apply filters
const applyFilters = () => {
    fetchMovements(filters.value, 1)
}

// Clear filters
const clearFilters = () => {
    filters.value = {
        search: '',
        movement_type: undefined,
        warehouse_id: undefined,
        date_from: '',
        date_to: '',
    }
    fetchMovements(filters.value, 1)
}

// Pagination
const goToPage = (page: number) => {
    fetchMovements(filters.value, page)
}

// View movement detail
const viewMovement = (id: number) => {
    router.visit(`/inventory-movements/${id}`)
}

// Get movement detail (reason / reference)
const getReferenceTypeLabel = (refType: string | null | undefined): string => {
    const labels: Record<string, string> = {
        purchase: 'Compra',
        adjustment: 'Ajuste',
        return: 'Devolución',
        waste: 'Merma',
        transfer: 'Transferencia',
        sale: 'Venta',
    }
    return refType ? (labels[refType] ?? refType) : ''
}

const getMovementDetail = (movement: any): { primary: string; secondary: string } => {
    // Waste movements: show the specific reason (Dañado, Caducado, etc.)
    if (movement.reference_type === 'waste' && movement.reason) {
        return {
            primary: `Merma: ${movement.reason}`,
            secondary: movement.notes ?? '',
        }
    }
    // Other movements: show reference type + optional ID
    const label = getReferenceTypeLabel(movement.reference_type)
    const refId = movement.reference_id ? ` #${movement.reference_id}` : ''
    return {
        primary: label ? `${label}${refId}` : '',
        secondary: movement.notes ?? '',
    }
}

// Get movement type label and color
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

// Format date
const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}
</script>

<template>
    <Head title="Movimientos de Inventario" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-8 flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Movimientos de Inventario</h1>
                    <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        Historial completo de entradas, salidas y transferencias
                    </p>
                </div>
                <div class="flex gap-2">
                    <a
                        href="/inventory-movements/inbound/create"
                        class="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                        <PackagePlus :size="18" />
                        Nueva Entrada
                    </a>
                    <a
                        href="/inventory-movements/outbound/create"
                        class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                        <PackageMinus :size="18" />
                        Nueva Salida
                    </a>
                    <a
                        v-if="!isSingleWarehouseMode()"
                        href="/inventory-movements/transfer/create"
                        class="flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-white hover:bg-blue-700 dark:hover:bg-primary/90"
                    >
                        <ArrowLeftRight :size="18" />
                        Nueva Transferencia
                    </a>
                </div>
            </div>

            <!-- Filters -->
            <div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-card">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-5">
                    <div>
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Buscar producto
                        </label>
                        <input
                            v-model="filters.search"
                            type="text"
                            placeholder="SKU o nombre..."
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white dark:placeholder-gray-400"
                            @keyup.enter="applyFilters"
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
                            <option value="in">Entrada</option>
                            <option value="out">Salida</option>
                            <option v-if="!isSingleWarehouseMode()" value="transfer">Transferencia</option>
                        </select>
                    </div>

                    <div>
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Fecha desde
                        </label>
                        <input
                            v-model="filters.date_from"
                            type="date"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Fecha hasta
                        </label>
                        <input
                            v-model="filters.date_to"
                            type="date"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

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
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center py-12">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent"></div>
                <p class="mt-2 text-gray-800 dark:text-gray-200">Cargando movimientos...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                <p>{{ error }}</p>
            </div>

            <!-- Movements Table -->
            <div v-else-if="movements.length > 0" class="overflow-hidden rounded-lg bg-white shadow dark:bg-card">
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
                            <th v-if="!isSingleWarehouseMode()" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Almacén Origen
                            </th>
                            <th v-if="!isSingleWarehouseMode()" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Almacén Destino
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Cantidad
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                Detalle / Referencia
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
                                <div>
                                    <span class="font-medium">{{ movement.product.name }}</span>
                                    <div v-if="movement.variant" class="text-xs text-gray-500">
                                        Var: {{ movement.variant.sku }}
                                    </div>
                                    <div v-else class="text-xs text-gray-500">
                                        SKU: {{ movement.product.sku }}
                                    </div>
                                    
                                    <div v-if="movement.product_batch" class="mt-1">
                                        <span class="font-medium text-blue-600 dark:text-primary dark:text-blue-400">{{ movement.product_batch.batch_number }}</span>
                                        <div v-if="movement.product_batch.expiry_date" class="text-xs text-gray-500">
                                            Vence: {{ formatDate(movement.product_batch.expiry_date).split(',')[0] }}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td v-if="!isSingleWarehouseMode()" class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {{ movement.warehouse.name }}
                            </td>
                            <td v-if="!isSingleWarehouseMode()" class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {{ movement.destination_warehouse?.name || '-' }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                {{ movement.quantity }}
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-[220px]">
                                <template v-if="getMovementDetail(movement).primary">
                                    <span class="font-medium">{{ getMovementDetail(movement).primary }}</span>
                                </template>
                                <div
                                    v-if="getMovementDetail(movement).secondary"
                                    class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate"
                                    :title="getMovementDetail(movement).secondary"
                                >
                                    {{ getMovementDetail(movement).secondary }}
                                </div>
                                <span v-if="!getMovementDetail(movement).primary && !getMovementDetail(movement).secondary" class="text-gray-400 dark:text-gray-500">—</span>
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
                            Mostrando {{ (currentPage - 1) * 20 + 1 }} a {{ Math.min(currentPage * 20, total) }} de {{ total }} movimientos
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            @click="goToPage(currentPage - 1)"
                            :disabled="currentPage === 1"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Anterior
                        </button>
                        <button
                            @click="goToPage(currentPage + 1)"
                            :disabled="currentPage === lastPage"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="rounded-lg bg-white p-12 text-center shadow dark:bg-card">
                <p class="text-gray-700 dark:text-gray-300">No hay movimientos registrados.</p>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Registra tu primer movimiento usando los botones de arriba.
                </p>
            </div>
        </div>
    </AppLayout>
</template>
