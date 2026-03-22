<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSalesOrders } from '@/composables/useSalesOrders'
import { ArrowLeft, Edit, CheckCircle, XCircle, Package, User, Calendar, DollarSign, Printer, RotateCcw, Search, Plus, X, Calculator, Edit2, CircleDollarSign, AlertTriangle, ClipboardList } from 'lucide-vue-next'
import PrintTicketModal from '@/components/POS/PrintTicketModal.vue'
import CreateReturnModal from '@/components/POS/CreateReturnModal.vue'
import AddItemModal from '@/components/POS/AddItemModal.vue'
import { useUsers } from '@/composables/useUsers'
import apiClient from '@/services/api/client'

const props = defineProps<{
  id: number
}>()

const {
  currentSalesOrder,
  loading,
  error,
  fetchSalesOrderById,
  confirmSalesOrder,
  completeSalesOrder,
  cancelSalesOrder,
} = useSalesOrders()

const showPrintModal = ref(false)
const showReturnModal = ref(false)
const returnLoading = ref(false)
const returnError = ref<string | null>(null)
const orderReturns = ref<any[]>([])
const showAuditLogs = ref(false)
const showAddItemModal = ref(false)

const { users, fetchUsers } = useUsers()

const auditActionIcon = (action: string) => {
  const icons: Record<string, any> = {
    search: Search, cart_add: Plus, cart_remove: X,
    qty_change: Calculator, price_override: Edit2, tax_override: CircleDollarSign,
    checkout_success: CheckCircle, checkout_error: AlertTriangle
  }
  return icons[action] || ClipboardList
}

const auditActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    search: 'Búsqueda', cart_add: 'Añadido', cart_remove: 'Eliminado',
    qty_change: 'Cant. cambiada', price_override: 'Precio override',
    tax_override: 'Impuesto override', checkout_success: 'Checkout',
    checkout_error: 'Error checkout'
  }
  return labels[action] || action
}

const formatLogTime = (timestamp: string) => {
  try { return new Date(timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return timestamp }
}

const formatLogDetail = (log: any) => {
  const m = log.metadata || {}
  switch (log.action) {
    case 'search': return `"${m.query}"`
    case 'cart_add': return `${m.name || `#${m.product_id}`} ×${m.quantity}`
    case 'cart_remove': return `${m.name || `#${m.product_id}`}`
    case 'qty_change': return `#${m.product_id}: ${m.old_qty} → ${m.new_qty}`
    case 'price_override': return `$${m.old_price} → $${m.new_price}`
    case 'tax_override': return `${m.old_tax}% → ${m.new_tax}%`
    case 'checkout_success': return `Orden #${m.order_id} — $${m.total}`
    default: return JSON.stringify(m)
  }
}

const handleConfirm = async () => {
  if (!confirm('¿Confirmar esta orden? Esto descontará el inventario.')) return
  try {
    await confirmSalesOrder(props.id)
    await fetchSalesOrderById(props.id)
  } catch (err) {
    console.error('Error:', err)
  }
}

const handleComplete = async () => {
  if (!confirm('¿Marcar esta orden como completada?')) return
  try {
    await completeSalesOrder(props.id)
    await fetchSalesOrderById(props.id)
  } catch (err) {
    console.error('Error:', err)
  }
}

const handleCancel = async () => {
  if (!confirm('¿Cancelar esta orden? El inventario será revertido.')) return
  try {
    await cancelSalesOrder(props.id)
    await fetchSalesOrderById(props.id)
  } catch (err) {
    console.error('Error:', err)
  }
}

const fetchReturns = async () => {
  try {
    const { data } = await apiClient.get(`/sales-orders/${props.id}/returns`)
    orderReturns.value = data
  } catch (e) {
    console.error('Error fetching returns:', e)
  }
}

const handleReturnSubmit = async (payload: { reason: string; refund_method: string; refund_notes: string; items: { sales_order_item_id: number; quantity: number; user_id: number | null }[] }) => {
  returnLoading.value = true
  returnError.value = null
  try {
    const { data } = await apiClient.post(`/sales-orders/${props.id}/returns`, payload)
    const returnId = data.data?.id
    // Auto-approve the return
    if (returnId) {
      await apiClient.post(`/sales-returns/${returnId}/approve`)
    }
    showReturnModal.value = false
    await fetchSalesOrderById(props.id)
    await fetchReturns()
  } catch (err: any) {
    const errData = err.response?.data
    if (Array.isArray(errData?.errors)) {
      returnError.value = errData.errors.join('\n')
    } else {
      returnError.value = errData?.message || 'Error al procesar la devolución'
    }
  } finally {
    returnLoading.value = false
  }
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-card dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return colors[status] || colors.draft
}

onMounted(() => {
  fetchSalesOrderById(props.id)
  fetchReturns()
  fetchUsers()
})
</script>

<template>
  <Head :title="`Orden ${currentSalesOrder?.order_number || ''}`" />

  <AppLayout>
    <div v-if="loading" class="text-center py-12">
      <p class="text-gray-600 dark:text-gray-400">Cargando orden...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
      {{ error }}
    </div>

    <div v-else-if="currentSalesOrder" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            @click="router.visit('/sales-orders')"
            class="p-2 hover:bg-gray-100 dark:hover:bg-muted/50 rounded-lg"
          >
            <ArrowLeft :size="24" />
          </button>
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              {{ currentSalesOrder.order_number }}
            </h1>
            <p class="text-gray-600 dark:text-gray-400 mt-1">
              Detalle de orden de venta
            </p>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="showPrintModal = true"
            class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-card hover:bg-gray-200 dark:hover:bg-muted/50 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            <Printer :size="18" />
            Imprimir
          </button>
          <button
            v-if="currentSalesOrder.status === 'draft' || currentSalesOrder.status === 'pending'"
            @click="router.visit(`/sales-orders/${props.id}/edit`)"
            class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-primary dark:text-primary-foreground hover:bg-blue-700 dark:hover:bg-primary/90 text-white rounded-lg"
          >
            <Edit :size="18" />
            Editar
          </button>
          <button
            v-if="currentSalesOrder.status === 'draft' || currentSalesOrder.status === 'pending'"
            @click="handleConfirm"
            class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <CheckCircle :size="18" />
            Confirmar
          </button>
          <button
            v-if="currentSalesOrder.status === 'confirmed' || currentSalesOrder.status === 'processing'"
            @click="handleComplete"
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg"
          >
            <CheckCircle :size="18" />
            Completar
          </button>
          <button
            v-if="currentSalesOrder.status === 'confirmed' || currentSalesOrder.status === 'completed'"
            @click="router.visit(`/returns/${props.id}`)"
            class="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg"
          >
            <RotateCcw :size="18" />
            Devolver
          </button>
          <button
            v-if="currentSalesOrder.status === 'confirmed' || currentSalesOrder.status === 'completed'"
            @click="showAddItemModal = true"
            class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <Plus :size="18" />
            Agregar Artículo
          </button>
          <button
            v-if="currentSalesOrder.status !== 'completed' && currentSalesOrder.status !== 'cancelled'"
            @click="handleCancel"
            class="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            <XCircle :size="18" />
            Cancelar
          </button>
        </div>
      </div>

      <!-- Order Info Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <User class="text-blue-600 dark:text-primary dark:text-blue-400" :size="20" />
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Cliente</p>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ currentSalesOrder.customer_name || 'Sin cliente' }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Calendar class="text-purple-600 dark:text-purple-400" :size="20" />
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Fecha</p>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ new Date(currentSalesOrder.date).toLocaleDateString('es-MX') }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign class="text-green-600 dark:text-green-400" :size="20" />
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ currentSalesOrder.formatted_total }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Package class="text-yellow-600 dark:text-yellow-400" :size="20" />
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Estado</p>
              <span :class="['px-2 py-1 text-xs font-semibold rounded-full', getStatusColor(currentSalesOrder.status)]">
                {{ currentSalesOrder.status_label }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-border">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Productos</h2>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
            <thead class="bg-gray-50 dark:bg-background">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Almacén</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vendedor</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cantidad</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Precio Unit.</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Descuento</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Impuestos</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
              <tr v-for="item in currentSalesOrder.items" :key="item.id">
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">{{ item.product_name }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ item.product_sku }}</div>
                  <div v-if="item.notes" class="mt-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-muted p-1.5 rounded border border-gray-100 dark:border-border italic">
                    <span class="font-medium not-italic text-gray-700 dark:text-gray-300">Nota:</span> {{ item.notes }}
                  </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{{ item.warehouse_name }}</td>
                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                  <span v-if="item.seller_name" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                    {{ item.seller_name }}
                  </span>
                  <span v-else class="text-gray-400 text-xs">—</span>
                </td>
                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">{{ item.quantity }}</td>
                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">${{ item.unit_price }}</td>
                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">${{ item.discount_amount }}</td>
                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                  <div>${{ item.tax_amount }}</div>
                  <div class="text-xs text-gray-400">({{ item.tax_percent }}%)</div>
                </td>
                <td class="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-white">{{ item.formatted_total }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="border-t border-gray-200 dark:border-border px-6 py-4 bg-gray-50 dark:bg-background">
          <div class="max-w-md ml-auto space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Subtotal:</span>
              <span class="text-gray-900 dark:text-white font-medium">${{ currentSalesOrder.subtotal }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Impuestos:</span>
              <span class="text-gray-900 dark:text-white font-medium">${{ currentSalesOrder.tax_amount }}</span>
            </div>
            <div v-if="currentSalesOrder.discount_amount > 0" class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Descuento:</span>
              <span class="text-red-600 dark:text-red-400 font-medium">-${{ currentSalesOrder.discount_amount }}</span>
            </div>
            <div v-if="currentSalesOrder.shipping_cost > 0" class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Envío:</span>
              <span class="text-gray-900 dark:text-white font-medium">${{ currentSalesOrder.shipping_cost }}</span>
            </div>
            <div class="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-border pt-2">
              <span class="text-gray-900 dark:text-white">Total:</span>
              <span class="text-gray-900 dark:text-white">{{ currentSalesOrder.formatted_total }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="currentSalesOrder.notes" class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Notas</h3>
        <p class="text-gray-700 dark:text-gray-300">{{ currentSalesOrder.notes }}</p>
      </div>
      <!-- Returns History -->
      <div v-if="orderReturns.length > 0" class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Devoluciones</h3>
        <div class="space-y-3">
          <div
            v-for="ret in orderReturns"
            :key="ret.id"
            class="border border-gray-200 dark:border-border rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <span class="font-semibold text-gray-900 dark:text-white">{{ ret.return_number }}</span>
                <span
                  class="ml-2 px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="ret.status === 'approved' ? 'bg-green-100 text-green-800' : ret.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'"
                >
                  {{ ret.status === 'approved' ? 'Aprobada' : ret.status === 'rejected' ? 'Rechazada' : 'Pendiente' }}
                </span>
              </div>
              <span class="text-sm font-bold text-red-600">${{ Number(ret.total_amount).toFixed(2) }}</span>
            </div>
            <p v-if="ret.reason" class="text-xs text-gray-500 mb-2">Motivo: {{ ret.reason }}</p>
            <div class="text-xs text-gray-400 space-y-1">
              <p v-for="item in ret.items" :key="item.id">
                • {{ item.product?.name || 'Producto' }} × {{ item.quantity }} = ${{ Number(item.subtotal).toFixed(2) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Audit Logs Timeline -->
      <div v-if="currentSalesOrder" class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border overflow-hidden">
        <button
          @click="showAuditLogs = !showAuditLogs"
          class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-muted/50/50 transition-colors"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList class="w-5 h-5 text-gray-500" /> Auditoría de Caja
            <span class="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-muted px-2 py-0.5 rounded-full">
              {{ (currentSalesOrder as any).audit_logs?.length || 0 }} eventos
            </span>
          </h3>
          <svg
            class="w-5 h-5 text-gray-400 transition-transform"
            :class="{ 'rotate-180': showAuditLogs }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="showAuditLogs" class="px-6 pb-5 border-t border-gray-100 dark:border-border">
          <div v-if="(currentSalesOrder as any).audit_logs?.length" class="relative pl-6 mt-4">
            <!-- Vertical line -->
            <div class="absolute left-2 top-1 bottom-1 w-0.5 bg-gray-200 dark:bg-gray-600"></div>
            <div
              v-for="(log, idx) in (currentSalesOrder as any).audit_logs"
              :key="idx"
              class="relative flex items-start gap-3 pb-3 last:pb-0"
            >
              <!-- Dot -->
              <div class="absolute -left-[16px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-border z-10"
                :class="log.action === 'checkout_success' ? 'bg-green-500' : log.action === 'checkout_error' ? 'bg-red-500' : 'bg-indigo-400'"
              ></div>
              <!-- Content -->
              <div class="flex-1 flex items-center gap-2 text-sm">
                <span class="text-xs font-mono text-gray-400 w-16 shrink-0">{{ formatLogTime(log.timestamp) }}</span>
                <component :is="auditActionIcon(log.action)" class="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <span class="font-medium text-gray-700 dark:text-gray-300">{{ auditActionLabel(log.action) }}:</span>
                <span class="text-gray-500 dark:text-gray-400 truncate">{{ formatLogDetail(log) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            No hay registros de auditoría disponibles para esta venta.
          </div>
        </div>
      </div>
    </div>

    <!-- Print Ticket Modal -->
    <PrintTicketModal
      v-if="currentSalesOrder"
      :show="showPrintModal"
      :order-id="currentSalesOrder.id"
      :order-number="currentSalesOrder.order_number"
      @close="showPrintModal = false"
    />

    <!-- Return Modal -->
    <CreateReturnModal
      v-if="currentSalesOrder"
      :show="showReturnModal"
      :order-id="currentSalesOrder.id"
      :order-number="currentSalesOrder.order_number"
      :has-customer="!!currentSalesOrder.customer_id"
      :users="users"
      :current-user-id="(currentSalesOrder as any).user_id"
      :items="(currentSalesOrder.items || []).map((i: any) => ({
        id: i.id,
        product_id: i.product_id,
        variant_id: i.variant_id,
        product_name: i.product_name || i.product?.name || 'Producto',
        product_sku: i.product_sku || i.product?.sku_base || '',
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        discount_percent: Number(i.discount_percent || 0),
        total: Number(i.total),
        seller_name: i.seller_name || '',
      }))"
      :loading="returnLoading"
      :error="returnError"
      @submit="handleReturnSubmit"
      @close="showReturnModal = false; returnError = null"
    />

    <!-- Add Item Modal -->
    <AddItemModal
      v-if="currentSalesOrder"
      :show="showAddItemModal"
      :order-id="currentSalesOrder.id"
      :warehouse-id="(currentSalesOrder.items?.[0] as any)?.warehouse_id ?? 1"
      :users="users"
      :current-user-id="(currentSalesOrder as any).user_id"
      @close="showAddItemModal = false"
      @added="fetchSalesOrderById(props.id)"
    />
  </AppLayout>
</template>
