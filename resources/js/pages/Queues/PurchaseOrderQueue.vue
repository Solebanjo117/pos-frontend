<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePurchaseOrderQueue, type PendingReceiptOrder } from '@/composables/usePurchaseOrderQueue'
import { ArrowRight, CalendarDays, ClipboardCheck, Factory } from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

const { orders, count, loading, error, startPolling, stopPolling } = usePurchaseOrderQueue()

onMounted(() => {
    startPolling(30000)
})

onUnmounted(() => {
    stopPolling()
})

const formatDate = (value?: string | null): string => {
    if (!value) return 'Sin fecha'
    return new Date(value).toLocaleDateString('es-PA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    })
}

const pendingQty = (order: PendingReceiptOrder): number => {
    return order.items.reduce((sum, item) => {
        const pending = (item.quantity_ordered ?? 0) - (item.quantity_received ?? 0)
        return sum + Math.max(0, pending)
    }, 0)
}

const goToReceive = (id: number) => {
    router.visit(`/purchase-orders/${id}/receive`)
}
</script>

<template>
    <Head title="Cola Pedidos" />

    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <ClipboardCheck class="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    Cola Pedidos
                    <span
                        v-if="count > 0"
                        class="inline-flex items-center justify-center px-2.5 py-0.5 text-sm font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                        {{ count }}
                    </span>
                </h1>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Ordenes de compra enviadas o parciales, pendientes de recepcion</p>
            </div>
        </div>

        <div v-if="loading && orders.length === 0" class="text-center py-16 text-gray-500">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-3"></div>
            Cargando pedidos pendientes...
        </div>

        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-center">
            <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            <button @click="startPolling(30000)" class="mt-3 text-sm text-red-700 dark:text-red-300 underline">Reintentar</button>
        </div>

        <div v-else-if="orders.length === 0" class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-16 text-center">
            <ClipboardCheck class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Sin pedidos pendientes</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">No hay ordenes de compra por recibir en este momento.</p>
        </div>

        <div v-else class="space-y-3">
            <div
                v-for="order in orders"
                :key="order.id"
                class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase">{{ order.po_number }}</span>
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-300">{{ order.status }}</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <span class="inline-flex items-center gap-1.5">
                            <Factory :size="15" class="text-gray-400" />
                            {{ order.supplier?.name || 'Proveedor sin nombre' }}
                        </span>
                        <span class="inline-flex items-center gap-1.5">
                            <CalendarDays :size="15" class="text-gray-400" />
                            Esperada: {{ formatDate(order.expected_date) }}
                        </span>
                        <span class="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Pendiente: {{ pendingQty(order) }}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
                    @click="goToReceive(order.id)"
                >
                    Ir a Recepcion
                    <ArrowRight :size="16" />
                </button>
            </div>
        </div>
    </div>
</template>
