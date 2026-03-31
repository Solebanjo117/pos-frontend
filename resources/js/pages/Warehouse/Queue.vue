<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useWarehouseQueue, type WarehouseOrder } from '@/composables/useWarehouseQueue'
import { PackageSearch, Clock, Package, User, CheckCircle } from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

const { orders, count, loading, error, timeAgo, startPolling, stopPolling, markAsPrepared } = useWarehouseQueue()

// Reactive clock: ticks every second so timeAgo re-renders
const now = ref(Date.now())
let clockInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  startPolling(15000) // polling every 15s
  clockInterval = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  stopPolling()
  if (clockInterval) {
    clearInterval(clockInterval)
    clockInterval = null
  }
})

const processingId = ref<number | null>(null)

const handlePrepare = async (order: WarehouseOrder) => {
  const confirmed = confirm(`¿Marcar la orden ${order.order_number} como PREPARADA?`)
  if (!confirmed) return

  processingId.value = order.id
  try {
    const success = await markAsPrepared(order.id)
    if (!success) {
      alert('Error al marcar la orden como preparada.')
    }
  } finally {
    processingId.value = null
  }
}

const summarizedProducts = (items: WarehouseOrder['items']) => {
  const maxShow = 4
  const shown = items.slice(0, maxShow)
  const extra = items.length - maxShow
  return { shown, extra: extra > 0 ? extra : 0 }
}
</script>

<template>
  <Head title="Preparación en Bodega" />

  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <PackageSearch class="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          Preparación en Bodega
          <span
            v-if="count > 0"
            class="inline-flex items-center justify-center px-2.5 py-0.5 text-sm font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
          >
            {{ count }}
          </span>
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Órdenes pendientes de agrupar y preparar para su entrega
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && orders.length === 0" class="text-center py-16 text-gray-500">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-3"></div>
      Cargando órdenes pendientes...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-center">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="startPolling(15000)" class="mt-3 text-sm text-red-700 dark:text-red-300 underline">Reintentar</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="count === 0" class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-16 text-center">
      <PackageSearch class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
      <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Bodega al día</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        No hay órdenes pendientes de preparación en este momento.
      </p>
    </div>

    <!-- Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="order in orders"
        :key="order.id"
        class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col h-[420px]"
      >
        <!-- Card Header -->
        <div class="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between">
          <div>
            <span class="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase cursor-pointer hover:underline" @click="router.visit(`/sales-orders/${order.id}`)">{{ order.order_number }}</span>
            <div class="flex items-center gap-1.5 mt-0.5">
              <User :size="12" class="text-gray-400" />
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ order.user?.name ?? 'Sist.' }}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock :size="14" />
              <span class="text-sm font-semibold tabular-nums">{{ timeAgo(order.sent_to_warehouse_at, now) }}</span>
            </div>
          </div>
        </div>

        <!-- Card Body -->
        <div class="px-5 py-4 space-y-3 flex-1 overflow-y-auto">
          <!-- Customer -->
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente:</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ order.customer?.name || 'Público General' }}
            </span>
          </div>

          <!-- Products summary -->
          <div class="space-y-1.5 mt-2">
            <div
              v-for="item in summarizedProducts(order.items).shown"
              :key="item.id"
              class="flex items-center justify-between gap-2 text-sm bg-gray-50 dark:bg-muted/30 px-2 py-1.5 rounded"
            >
              <div class="flex items-center gap-2 overflow-hidden">
                <Package :size="14" class="text-gray-400 shrink-0" />
                <span class="text-gray-700 dark:text-gray-300 truncate font-medium">
                  {{ item.product?.name || 'Producto' }}
                </span>
              </div>
              <span class="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded text-xs">
                x{{ item.quantity }}
              </span>
            </div>
            <p
              v-if="summarizedProducts(order.items).extra > 0"
              class="text-xs text-gray-400 dark:text-gray-500 text-center pt-2"
            >
              + {{ summarizedProducts(order.items).extra }} producto(s) adicional(es)
            </p>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="px-5 py-3 bg-gray-50 dark:bg-background border-t border-gray-100 dark:border-border">
          <button
            @click="handlePrepare(order)"
            :disabled="processingId === order.id"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold text-sm shadow-sm"
          >
            <div v-if="processingId === order.id" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            <CheckCircle v-else :size="18" />
            {{ processingId === order.id ? 'Marcando...' : 'Marcar como Preparado' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
