<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { ArrowLeft, Send, PackageCheck, XCircle, Pencil, Building2, Calendar, Package, FileText, DollarSign, Plus, Trash2 } from 'lucide-vue-next'
import apiClient from '@/services/api/client'

const props = defineProps<{ purchaseOrderId: number }>()
const { purchaseOrder, loading, error, fetchPurchaseOrderById, sendPurchaseOrder, cancelPurchaseOrder } = usePurchaseOrders()

// --- Payments state ---
const payments = ref<any[]>([])
const paymentStatus = ref<string>('pending')
const amountPaid = ref<number>(0)
const amountDue = ref<number>(0)
const showPaymentModal = ref(false)
const paymentForm = ref({ amount: 0, method: 'cash', reference_number: '', notes: '' })
const paymentLoading = ref(false)
const paymentError = ref<string | null>(null)

async function loadPayments() {
    const res = await apiClient.get(`/purchase-orders/${props.purchaseOrderId}/payments`)
    payments.value = res.data.data
    amountPaid.value = res.data.amount_paid
    amountDue.value = res.data.amount_due
    paymentStatus.value = res.data.payment_status
}

async function addPayment() {
    paymentLoading.value = true
    paymentError.value = null
    try {
        await apiClient.post(`/purchase-orders/${props.purchaseOrderId}/payments`, paymentForm.value)
        showPaymentModal.value = false
        paymentForm.value = { amount: 0, method: 'cash', reference_number: '', notes: '' }
        await loadPayments()
    } catch (e: any) {
        paymentError.value = e.response?.data?.message || 'Error al registrar el pago.'
    } finally {
        paymentLoading.value = false
    }
}

async function deletePayment(id: number) {
    if (!confirm('¿Eliminar este pago?')) return
    await apiClient.delete(`/purchase-orders/${props.purchaseOrderId}/payments/${id}`)
    await loadPayments()
}

function openPdf(mode: 'standard' | 'worksheet' = 'worksheet') {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
    const url = `${baseUrl}/purchase-orders/${props.purchaseOrderId}/pdf?mode=${mode}`
    window.open(url, '_blank')
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const paymentStatusColors: Record<string, string> = {
    pending: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

const paymentStatusLabels: Record<string, string> = {
    pending: 'Sin pagar',
    partial: 'Pago Parcial',
    paid: 'Pagado',
}

const methodLabels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    other: 'Otro',
}

async function handleSend() {
    if (!confirm('¿Enviar esta orden al proveedor?')) return
    await sendPurchaseOrder(props.purchaseOrderId)
    await fetchPurchaseOrderById(props.purchaseOrderId)
}

async function handleCancel() {
    if (!confirm('¿Cancelar esta orden?')) return
    await cancelPurchaseOrder(props.purchaseOrderId)
    await fetchPurchaseOrderById(props.purchaseOrderId)
}

onMounted(async () => {
    await fetchPurchaseOrderById(props.purchaseOrderId)
    await loadPayments()
})
</script>

<template>
    <Head :title="purchaseOrder?.po_number || 'Orden de Compra'" />
    <AppLayout>
        <div class="max-w-4xl mx-auto space-y-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <Link href="/purchase-orders" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"><ArrowLeft :size="24" /></Link>
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 dark:text-white font-mono">{{ purchaseOrder?.po_number }}</h1>
                        <div class="flex gap-2 mt-1">
                            <span v-if="purchaseOrder" :class="['inline-block px-3 py-1 text-xs font-semibold rounded-full', statusColors[purchaseOrder.status]]">{{ purchaseOrder.status_label }}</span>
                            <span :class="['inline-block px-3 py-1 text-xs font-semibold rounded-full', paymentStatusColors[paymentStatus]]">{{ paymentStatusLabels[paymentStatus] || paymentStatus }}</span>
                        </div>
                    </div>
                </div>
                <div v-if="purchaseOrder" class="flex items-center gap-2">
                    <div class="relative group">
                        <button @click="openPdf('worksheet')" class="inline-flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-600 dark:text-primary hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20 rounded-lg transition">
                            <FileText :size="16" /> Hoja de Pedido
                        </button>
                        <div class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <button @click="openPdf('worksheet')" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-muted/50 rounded-t-lg">📋 Hoja de Trabajo</button>
                            <button @click="openPdf('standard')" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-muted/50 rounded-b-lg">📄 Formato Estándar</button>
                        </div>
                    </div>
                    <Link v-if="purchaseOrder.status === 'draft'" :href="`/purchase-orders/${purchaseOrder.id}/edit`" class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted/50 rounded-lg transition"><Pencil :size="16" /> Editar</Link>
                    <button v-if="purchaseOrder.status === 'draft'" @click="handleSend" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-primary dark:text-primary-foreground hover:bg-blue-700 dark:hover:bg-primary/90 text-white rounded-lg transition"><Send :size="16" /> Enviar</button>
                    <Link v-if="['sent', 'partial'].includes(purchaseOrder.status)" :href="`/purchase-orders/${purchaseOrder.id}/receive`" class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"><PackageCheck :size="16" /> Recibir</Link>
                    <button v-if="!['received','cancelled'].includes(purchaseOrder.status)" @click="handleCancel" class="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 rounded-lg transition"><XCircle :size="16" /> Cancelar</button>
                </div>
            </div>

            <div v-if="loading" class="flex justify-center py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-primary"></div></div>

            <template v-else-if="purchaseOrder">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información</h2>
                        <dl class="space-y-3">
                            <div class="flex gap-3"><Building2 :size="16" class="text-gray-400 shrink-0 mt-0.5" /><dt class="text-sm text-gray-500 w-24">Proveedor:</dt><dd><Link v-if="purchaseOrder.supplier" :href="`/suppliers/${purchaseOrder.supplier.id}`" class="text-sm text-indigo-600 dark:text-primary dark:text-indigo-400 hover:underline">{{ purchaseOrder.supplier.name }}</Link></dd></div>
                            <div class="flex gap-3"><Calendar :size="16" class="text-gray-400 shrink-0 mt-0.5" /><dt class="text-sm text-gray-500 w-24">Fecha:</dt><dd class="text-sm text-gray-900 dark:text-white">{{ new Date(purchaseOrder.order_date).toLocaleDateString('es-PA') }}</dd></div>
                            <div v-if="purchaseOrder.expected_date" class="flex gap-3"><Calendar :size="16" class="text-gray-400 shrink-0 mt-0.5" /><dt class="text-sm text-gray-500 w-24">Esperada:</dt><dd class="text-sm text-gray-900 dark:text-white">{{ new Date(purchaseOrder.expected_date).toLocaleDateString('es-PA') }}</dd></div>
                            <div class="flex gap-3"><dt class="text-sm text-gray-500 ml-7 w-24">Almacén:</dt><dd class="text-sm text-gray-900 dark:text-white">{{ purchaseOrder.warehouse?.name }}</dd></div>
                        </dl>
                    </div>
                    <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resumen Financiero</h2>
                        <dl class="space-y-2">
                            <div class="flex justify-between"><dt class="text-sm text-gray-500">Subtotal:</dt><dd class="text-sm">${{ Number(purchaseOrder.subtotal).toFixed(2) }}</dd></div>
                            <div class="flex justify-between"><dt class="text-sm text-gray-500">Impuestos:</dt><dd class="text-sm">${{ Number(purchaseOrder.tax_amount).toFixed(2) }}</dd></div>
                            <div class="flex justify-between"><dt class="text-sm text-gray-500">Envío:</dt><dd class="text-sm">${{ Number(purchaseOrder.shipping_cost).toFixed(2) }}</dd></div>
                            <div class="flex justify-between pt-3 border-t border-gray-200 dark:border-border"><dt class="font-bold">Total:</dt><dd class="font-bold">{{ purchaseOrder.formatted_total }}</dd></div>
                            <div class="flex justify-between"><dt class="text-sm text-green-600 dark:text-green-400">Pagado:</dt><dd class="text-sm text-green-600 dark:text-green-400 font-medium">${{ amountPaid.toFixed(2) }}</dd></div>
                            <div class="flex justify-between pt-2 border-t border-gray-200 dark:border-border">
                                <dt class="font-bold" :class="amountDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">Saldo Pendiente:</dt>
                                <dd class="font-bold" :class="amountDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">${{ amountDue.toFixed(2) }}</dd>
                            </div>
                        </dl>
                        <p v-if="purchaseOrder.notes" class="mt-4 pt-4 border-t border-gray-200 dark:border-border text-sm text-gray-500">{{ purchaseOrder.notes }}</p>
                    </div>
                </div>

                <!-- Items -->
                <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-200 dark:border-border flex items-center gap-2"><Package :size="20" class="text-indigo-500" /><h2 class="text-lg font-semibold text-gray-900 dark:text-white">Items ({{ purchaseOrder.items.length }})</h2></div>
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                        <thead class="bg-gray-50 dark:bg-background"><tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pedido</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recibido</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                        </tr></thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-border">
                            <tr v-for="item in purchaseOrder.items" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-muted/50/50">
                                <td class="px-6 py-3"><Link v-if="item.product" :href="`/products/${item.product.id}`" class="text-sm text-indigo-600 dark:text-primary dark:text-indigo-400 hover:underline">{{ item.product.name }}</Link><p v-if="item.product" class="text-xs text-gray-500 font-mono">{{ item.product.sku_base }}</p></td>
                                <td class="px-6 py-3 text-right text-sm">{{ item.quantity_ordered }}</td>
                                <td class="px-6 py-3 text-right text-sm" :class="item.is_fully_received ? 'text-green-600 font-semibold' : ''">{{ item.quantity_received }}</td>
                                <td class="px-6 py-3 text-right text-sm text-gray-500">${{ Number(item.unit_cost).toFixed(2) }}</td>
                                <td class="px-6 py-3 text-right text-sm font-medium">${{ Number(item.subtotal).toFixed(2) }}</td>
                                <td class="px-6 py-3 text-center">
                                    <span v-if="item.is_fully_received" class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Completo</span>
                                    <span v-else-if="item.quantity_received > 0" class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Parcial</span>
                                    <span v-else class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-muted dark:text-gray-400">Pendiente</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Payments Section -->
                <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-200 dark:border-border flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <DollarSign :size="20" class="text-green-500" />
                            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Historial de Pagos</h2>
                        </div>
                        <button
                            v-if="amountDue > 0"
                            @click="showPaymentModal = true; paymentForm.amount = amountDue"
                            class="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition"
                        >
                            <Plus :size="16" /> Registrar Pago
                        </button>
                        <span v-else class="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold rounded-full">✅ Totalmente Pagado</span>
                    </div>
                    <div class="p-6">
                        <p v-if="payments.length === 0" class="text-sm text-gray-500 text-center py-4">No hay pagos registrados aún.</p>
                        <table v-else class="min-w-full">
                            <thead><tr class="text-xs text-gray-500 uppercase border-b border-gray-200 dark:border-border">
                                <th class="pb-2 text-left">Fecha</th>
                                <th class="pb-2 text-left">Método</th>
                                <th class="pb-2 text-left">Referencia</th>
                                <th class="pb-2 text-right">Monto</th>
                                <th class="pb-2"></th>
                            </tr></thead>
                            <tbody class="divide-y divide-gray-100 dark:divide-border">
                                <tr v-for="p in payments" :key="p.id" class="text-sm">
                                    <td class="py-3 text-gray-600 dark:text-gray-400">{{ new Date(p.paid_at).toLocaleDateString('es-PA') }}</td>
                                    <td class="py-3 text-gray-900 dark:text-white">{{ methodLabels[p.method] || p.method }}</td>
                                    <td class="py-3 text-gray-500 font-mono">{{ p.reference_number || '—' }}</td>
                                    <td class="py-3 text-right font-semibold text-gray-900 dark:text-white">{{ p.formatted_amount }}</td>
                                    <td class="py-3 text-right">
                                        <button @click="deletePayment(p.id)" class="p-1 text-gray-400 hover:text-red-500 transition"><Trash2 :size="14" /></button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </template>
        </div>

        <!-- Payment Modal -->
        <div v-if="showPaymentModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-white dark:bg-card rounded-xl w-full max-w-md p-6 shadow-2xl">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Registrar Pago</h3>
                <div v-if="paymentError" class="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">{{ paymentError }}</div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto *</label>
                        <input v-model.number="paymentForm.amount" type="number" min="0.01" :max="amountDue" step="0.01" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" />
                        <p class="text-xs text-gray-500 mt-1">Saldo pendiente: ${{ amountDue.toFixed(2) }}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método *</label>
                        <select v-model="paymentForm.method" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white">
                            <option value="cash">Efectivo</option>
                            <option value="card">Tarjeta</option>
                            <option value="transfer">Transferencia</option>
                            <option value="other">Otro</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referencia / Folio</label>
                        <input v-model="paymentForm.reference_number" type="text" placeholder="Ej: TRF-001234" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                        <textarea v-model="paymentForm.notes" rows="2" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white resize-none"></textarea>
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    <button @click="showPaymentModal = false; paymentError = null" class="px-4 py-2 border border-gray-300 dark:border-border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted/50 transition">Cancelar</button>
                    <button @click="addPayment" :disabled="paymentLoading || paymentForm.amount <= 0" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50">
                        {{ paymentLoading ? 'Guardando...' : 'Guardar Pago' }}
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
