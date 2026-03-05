<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSalesOrders } from '@/composables/useSalesOrders'
import { usePosSettings } from '@/composables/usePosSettings'
import type { SalesOrderStatus } from '@/types/sales-order'
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  ShoppingCart,
  DollarSign,
} from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

const {
  salesOrders,
  statistics,
  loading,
  error,
  total,
  currentPage,
  perPage,
  totalPages,
  fetchSalesOrders,
  fetchStatistics,
  confirmSalesOrder,
  cancelSalesOrder,
  deleteSalesOrder,
} = useSalesOrders()

const { currentWarehouseId, initWarehouse } = usePosSettings()

// Filters
const filters = ref({
  search: '',
  status: '' as SalesOrderStatus | '',
  customer_id: undefined as number | undefined,
  date_from: '',
  date_to: '',
  sort_by: 'created_at',
  sort_direction: 'desc' as 'asc' | 'desc',
  per_page: 15,
})

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'processing', label: 'En Proceso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
]

// Status badge color mapping
const getStatusColor = (status: SalesOrderStatus) => {
  const colors = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-card dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return colors[status] || colors.draft
}

// Load data
const loadSalesOrders = async () => {
  const filterParams = {
    ...filters.value,
    status: filters.value.status || undefined,
    warehouse_id: currentWarehouseId.value || undefined,
  }
  await fetchSalesOrders(filterParams as any)
}

// Handle actions
const handleConfirm = async (id: number) => {
  if (!confirm('¿Confirmar esta orden? Esto descontará el inventario.')) return
  
  try {
    await confirmSalesOrder(id)
    await loadSalesOrders()
  } catch (err) {
    console.error('Error al confirmar orden:', err)
  }
}

const handleCancel = async (id: number) => {
  if (!confirm('¿Cancelar esta orden? El inventario será revertido si fue confirmada.')) return
  
  try {
    await cancelSalesOrder(id)
    await loadSalesOrders()
  } catch (err) {
    console.error('Error al cancelar orden:', err)
  }
}

const handleDelete = async (id: number) => {
  if (!confirm('¿Eliminar esta orden? Esta acción no se puede deshacer.')) return
  
  try {
    await deleteSalesOrder(id)
    await loadSalesOrders()
  } catch (err) {
    console.error('Error al eliminar orden:', err)
  }
}

// Initialize
onMounted(async () => {
  await initWarehouse()
  await loadSalesOrders()
  await fetchStatistics({ warehouse_id: currentWarehouseId.value || undefined })
})

watch(currentWarehouseId, async () => {
  await loadSalesOrders()
  await fetchStatistics({ warehouse_id: currentWarehouseId.value || undefined })
})
</script>

<template>
  <Head title="Órdenes de Venta" />

  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Órdenes de Venta
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Gestiona las órdenes de venta y pedidos de clientes
        </p>
      </div>
      <Link
        href="/sales-orders/create"
        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition"
      >
        <Plus :size="20" />
        Nueva Orden
      </Link>
    </div>

    <!-- Statistics Cards -->
    <div v-if="statistics" class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Órdenes</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {{ statistics.total_orders }}
            </p>
          </div>
          <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <ShoppingCart class="text-blue-600 dark:text-primary dark:text-blue-400" :size="24" />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Ventas Totales</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              ${{ statistics.total_sales.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
            </p>
          </div>
          <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <DollarSign class="text-green-600 dark:text-green-400" :size="24" />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Pendientes</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {{ statistics.pending_orders }}
            </p>
          </div>
          <div class="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <Clock class="text-yellow-600 dark:text-yellow-400" :size="24" />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Completadas</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {{ statistics.completed_orders }}
            </p>
          </div>
          <div class="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <CheckCircle class="text-indigo-600 dark:text-primary dark:text-indigo-400" :size="24" />
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Buscar
          </label>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" :size="20" />
            <input
              v-model="filters.search"
              type="text"
              placeholder="Número de orden o cliente..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
              @input="loadSalesOrders"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Estado
          </label>
          <select
            v-model="filters.status"
            class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
            @change="loadSalesOrders"
          >
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fecha Desde
          </label>
          <input
            v-model="filters.date_from"
            type="date"
            class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
            @change="loadSalesOrders"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fecha Hasta
          </label>
          <input
            v-model="filters.date_to"
            type="date"
            class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
            @change="loadSalesOrders"
          />
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
          <thead class="bg-gray-50 dark:bg-background">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                N Orden
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cliente
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Fecha
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Estado
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pago
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
            <tr v-if="loading">
              <td colspan="7" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                Cargando órdenes...
              </td>
            </tr>
            <tr v-else-if="!loading && salesOrders.length === 0">
              <td colspan="7" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                No se encontraron órdenes
              </td>
            </tr>
            <tr v-else v-for="order in salesOrders" :key="order.id" class="hover:bg-gray-50 dark:hover:bg-muted/50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ order.order_number }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-white">
                  {{ order.customer_name || 'Sin cliente' }}
                </div>
                <div v-if="order.customer_code" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ order.customer_code }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                {{ new Date(order.date).toLocaleDateString('es-MX') }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ order.formatted_total }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                  getStatusColor(order.status)
                ]">
                  {{ order.status_label }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900 dark:text-white capitalize">
                  {{ order.payment_status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <Link
                    :href="`/sales-orders/${order.id}`"
                    class="text-indigo-600 dark:text-primary dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                    title="Ver"
                  >
                    <Eye :size="18" />
                  </Link>
                  <Link
                    v-if="order.status === 'draft' || order.status === 'pending'"
                    :href="`/sales-orders/${order.id}/edit`"
                    class="text-blue-600 dark:text-primary dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    title="Editar"
                  >
                    <Edit :size="18" />
                  </Link>
                  <button
                    v-if="order.status === 'draft' || order.status === 'pending'"
                    @click="handleConfirm(order.id)"
                    class="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                    title="Confirmar"
                  >
                    <CheckCircle :size="18" />
                  </button>
                  <button
                    v-if="order.status !== 'completed' && order.status !== 'cancelled'"
                    @click="handleCancel(order.id)"
                    class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    title="Cancelar"
                  >
                    <XCircle :size="18" />
                  </button>
                  <button
                    v-if="order.status === 'draft' || order.status === 'cancelled'"
                    @click="handleDelete(order.id)"
                    class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                    title="Eliminar"
                  >
                    <Trash2 :size="18" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-6 py-4 border-t border-gray-200 dark:border-border">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Mostrando {{ (currentPage - 1) * perPage + 1 }} a {{ Math.min(currentPage * perPage, total) }} de {{ total }} resultados
          </div>
          <div class="flex gap-2">
            <button
              v-for="page in totalPages"
              :key="page"
              @click="() => { filters.per_page = perPage; currentPage = page; loadSalesOrders(); }"
              :class="[
                'px-3 py-1 rounded',
                page === currentPage
                  ? 'bg-indigo-600 dark:bg-primary dark:text-primary-foreground text-white'
                  : 'bg-gray-200 dark:bg-muted text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-muted'
              ]"
            >
              {{ page }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
