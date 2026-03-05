<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useInventoryMovements } from '@/composables/useInventoryMovements'
import { usePosSettings } from '@/composables/usePosSettings'
import { type InventoryMovement } from '@/types/inventory-movement'

const props = defineProps<{
    id: string
}>()

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Movimientos', href: '/inventory-movements' },
    { title: 'Detalle', href: `/inventory-movements/${props.id}` },
]

const { currentMovement, fetchMovement, fetchRelatedMovements, loading, error } = useInventoryMovements()
const { isSingleWarehouseMode, fetchSettings } = usePosSettings()

const relatedMovements = ref<InventoryMovement[]>([])
const loadingRelated = ref(false)

const showWarehouseInfo = computed(() => {
    return !isSingleWarehouseMode()
})

const allItems = computed(() => {
    if (!currentMovement.value) return []
    return [currentMovement.value, ...relatedMovements.value]
})

onMounted(async () => {
    await fetchSettings()
    await fetchMovement(parseInt(props.id))
    if (currentMovement.value) {
        loadingRelated.value = true
        relatedMovements.value = await fetchRelatedMovements(currentMovement.value.id)
        loadingRelated.value = false
    }
})

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

const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

const goBack = () => {
    router.visit('/inventory-movements')
}
</script>

<template>
    <Head title="Detalle de Movimiento" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <div class="mx-auto max-w-4xl">
                <!-- Loading State -->
                <div v-if="loading" class="text-center py-12">
                    <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent"></div>
                    <p class="mt-2 text-gray-800 dark:text-gray-200">Cargando movimiento...</p>
                </div>

                <!-- Error State -->
                <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                    <p>{{ error }}</p>
                </div>

                <!-- Movement Detail -->
                <div v-else-if="currentMovement" class="space-y-6">
                    <!-- Header -->
                    <div class="flex items-start justify-between">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                                Detalle de Movimiento #{{ currentMovement.id }}
                            </h1>
                            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                                {{ formatDate(currentMovement.created_at) }}
                            </p>
                        </div>
                        <button
                            @click="goBack"
                            class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500"
                        >
                            ← Volver
                        </button>
                    </div>

                    <!-- Movement Type Badge -->
                    <div>
                        <span :class="getMovementTypeColor(currentMovement.movement_type)" class="inline-flex rounded-full px-4 py-2 text-sm font-semibold">
                            {{ getMovementTypeLabel(currentMovement.movement_type) }}
                        </span>
                    </div>

                    <!-- Main Info Card (Transaction Level) -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Información General</h2>
                        <dl class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <dt class="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Movimiento</dt>
                                <dd class="mt-1">
                                    <span :class="getMovementTypeColor(currentMovement.movement_type)" class="inline-flex rounded-full px-4 py-2 text-sm font-semibold">
                                        {{ getMovementTypeLabel(currentMovement.movement_type) }}
                                    </span>
                                </dd>
                            </div>

                            <div>
                                <dt class="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha</dt>
                                <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                    {{ formatDate(currentMovement.created_at) }}
                                </dd>
                            </div>

                            <div v-if="showWarehouseInfo">
                                <dt class="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {{ currentMovement.movement_type === 'transfer' ? 'Almacén Origen' : 'Almacén' }}
                                </dt>
                                <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                    {{ currentMovement.warehouse.name }}
                                </dd>
                                <dd class="text-sm text-gray-700 dark:text-gray-300">
                                    Código: {{ currentMovement.warehouse.code }}
                                </dd>
                            </div>

                            <div v-if="currentMovement.destination_warehouse">
                                <dt class="text-sm font-medium text-gray-700 dark:text-gray-300">Almacén Destino</dt>
                                <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                    {{ currentMovement.destination_warehouse.name }}
                                </dd>
                                <dd class="text-sm text-gray-700 dark:text-gray-300">
                                    Código: {{ currentMovement.destination_warehouse.code }}
                                </dd>
                            </div>

                            <div v-if="currentMovement.user">
                                <dt class="text-sm font-medium text-gray-700 dark:text-gray-300">Registrado Por</dt>
                                <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                    {{ currentMovement.user.name }}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <!-- Products List (All items in this transaction) -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                         <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Productos</h2>
                         <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                                <thead class="bg-gray-50 dark:bg-muted">
                                    <tr>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Producto</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Cantidad</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Lote</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Vencimiento</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                                    <tr v-for="item in allItems" :key="item.id">
                                        <td class="whitespace-nowrap px-6 py-4">
                                            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ item.product.name }}</div>
                                            <div v-if="item.variant" class="text-sm text-gray-500 dark:text-gray-400">
                                                Var: {{ item.variant.sku }}
                                            </div>
                                            <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                                                SKU: {{ item.product.sku }}
                                            </div>
                                        </td>
                                        <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {{ item.quantity }}
                                        </td>
                                        <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {{ item.product_batch?.batch_number || '-' }}
                                        </td>
                                        <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {{ item.product_batch?.expiry_date ? formatDate(item.product_batch.expiry_date) : '-' }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                         </div>
                    </div>

                    <!-- Reference Info (if exists) -->
                    <div v-if="currentMovement.reference_type" class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Referencia</h2>
                        <dl class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <dt class="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</dt>
                                <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-white capitalize">
                                    {{ currentMovement.reference_type }}
                                </dd>
                            </div>
                            <div v-if="currentMovement.reference_id">
                                <dt class="text-sm font-medium text-gray-700 dark:text-gray-300">ID de Referencia</dt>
                                <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                    #{{ currentMovement.reference_id }}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <!-- Notes -->
                    <div v-if="currentMovement.notes" class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Notas</h2>
                        <p class="text-gray-900 dark:text-white">{{ currentMovement.notes }}</p>
                    </div>

                    <!-- User Info (if exists) -->
                    <div v-if="currentMovement.user" class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Usuario</h2>
                        <p class="text-gray-900 dark:text-white">{{ currentMovement.user.name }}</p>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
