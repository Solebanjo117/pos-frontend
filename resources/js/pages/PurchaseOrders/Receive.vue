<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { ArrowLeft, PackageCheck } from 'lucide-vue-next'
import type { ReceiveItemsData } from '@/types/purchase-order'

const props = defineProps<{ purchaseOrderId: number }>()
const { purchaseOrder, loading, error, fetchPurchaseOrderById, receiveItems } = usePurchaseOrders()

const receiveData = ref<{ item_id: number; quantity_received: number; batch_number: string }[]>([])

const hasPreAppliedStock = computed(() =>
    !!purchaseOrder.value?.items?.some(i => Number((i.pre_applied_quantity ?? i.pre_stock_applied_qty) || 0) > 0)
)

const preAppliedPackages = computed(() =>
    purchaseOrder.value?.items?.reduce((sum, i) => {
        return sum + Number((i.pre_applied_quantity ?? i.pre_stock_applied_qty) || 0)
    }, 0) ?? 0
)

onMounted(async () => {
    await fetchPurchaseOrderById(props.purchaseOrderId)
    if (purchaseOrder.value) {
        receiveData.value = purchaseOrder.value.items
            .filter(i => !i.is_fully_received)
            .map(i => ({
                item_id: i.id,
                quantity_received: i.pending_quantity,
                batch_number: '',
            }))
    }
})

async function handleSubmit() {
    const itemsToReceive = receiveData.value.filter(i => i.quantity_received > 0)
    if (itemsToReceive.length === 0) { alert('Ingresa cantidades a recibir'); return }
    try {
        await receiveItems(props.purchaseOrderId, { items: itemsToReceive })
        router.visit(`/purchase-orders/${props.purchaseOrderId}`)
    } catch (e) {}
}
</script>

<template>
    <Head title="Recibir Mercancía" />
    <AppLayout>
        <div class="max-w-4xl mx-auto space-y-6">
            <div class="flex items-center gap-4">
                <Link :href="`/purchase-orders/${purchaseOrderId}`" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"><ArrowLeft :size="24" /></Link>
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Recibir Mercancía</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ purchaseOrder?.po_number }} — {{ purchaseOrder?.supplier?.name }}</p>
                </div>
            </div>
            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4"><p class="text-red-600 dark:text-red-400">{{ error }}</p></div>
            <div
                v-if="purchaseOrder && hasPreAppliedStock"
                class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-4"
            >
                <p class="text-sm text-amber-700 dark:text-amber-300 font-medium">
                    Esta OC viene desde POS con stock ya preaplicado.
                    No volvera a sumar inventario por esa base ({{ preAppliedPackages }} paq.).
                    Si aumentas cantidades en la OC, en esta pantalla solo se recibira y sumara la diferencia.
                </p>
            </div>
            <form v-if="purchaseOrder && receiveData.length" @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                    <thead class="bg-gray-50 dark:bg-background"><tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paq. Pedidos</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Und/Paq</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Und.</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pend. Paq.</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recibir (Paq)</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lote</th>
                    </tr></thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-for="(rd, idx) in receiveData" :key="rd.item_id">
                            <td class="px-6 py-3">
                                <template v-if="purchaseOrder.items.find(i => i.id === rd.item_id)?.product">
                                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ purchaseOrder.items.find(i => i.id === rd.item_id)?.product?.name }}</p>
                                    <p class="text-xs text-gray-500 font-mono">{{ purchaseOrder.items.find(i => i.id === rd.item_id)?.product?.sku_base }}</p>
                                    <p v-if="(purchaseOrder.items.find(i => i.id === rd.item_id)?.pre_applied_quantity ?? purchaseOrder.items.find(i => i.id === rd.item_id)?.pre_stock_applied_qty ?? 0) > 0" class="text-[11px] text-amber-600 dark:text-amber-300 mt-1">
                                        Base POS preaplicada: {{ purchaseOrder.items.find(i => i.id === rd.item_id)?.pre_applied_quantity ?? purchaseOrder.items.find(i => i.id === rd.item_id)?.pre_stock_applied_qty }} paq.
                                    </p>
                                </template>
                            </td>
                            <td class="px-6 py-3 text-right text-sm">{{ purchaseOrder.items.find(i => i.id === rd.item_id)?.quantity_ordered }}</td>
                            <td class="px-6 py-3 text-right text-sm text-gray-500">
                                × {{ purchaseOrder.items.find(i => i.id === rd.item_id)?.units_per_package ?? 1 }}
                            </td>
                            <td class="px-6 py-3 text-right text-sm font-medium">
                                {{ purchaseOrder.items.find(i => i.id === rd.item_id)?.total_units_ordered }}
                            </td>
                            <td class="px-6 py-3 text-right text-sm font-semibold text-orange-600">{{ purchaseOrder.items.find(i => i.id === rd.item_id)?.pending_quantity }}</td>
                            <td class="px-6 py-3"><input v-model.number="rd.quantity_received" type="number" min="0" :max="purchaseOrder.items.find(i => i.id === rd.item_id)?.pending_quantity" class="w-20 text-right px-2 py-1 border border-gray-300 dark:border-border rounded bg-white dark:bg-muted text-gray-900 dark:text-white" /></td>
                            <td class="px-6 py-3"><input v-model="rd.batch_number" type="text" placeholder="Opcional" class="w-28 px-2 py-1 border border-gray-300 dark:border-border rounded bg-white dark:bg-muted text-gray-900 dark:text-white text-sm" /></td>
                        </tr>
                    </tbody>
                </table>
                <div class="px-6 py-4 border-t border-gray-200 dark:border-border flex justify-end gap-3">
                    <Link :href="`/purchase-orders/${purchaseOrderId}`" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted/50 rounded-lg transition">Cancelar</Link>
                    <button type="submit" :disabled="loading" class="inline-flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition">
                        <PackageCheck :size="18" />
                        {{ loading ? 'Procesando...' : 'Confirmar Recepción' }}
                    </button>
                </div>
            </form>
            <div v-else-if="purchaseOrder && !receiveData.length" class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-12 text-center">
                <PackageCheck class="mx-auto mb-3 text-green-500" :size="48" />
                <p class="text-gray-600 dark:text-gray-400">Todos los items ya han sido recibidos</p>
            </div>
        </div>
    </AppLayout>
</template>
