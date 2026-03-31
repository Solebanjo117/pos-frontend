<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import apiClient from '@/services/api/client'
import { usePOS } from '@/composables/usePOS'
import { useCashierQueue, type PendingQuote } from '@/composables/useCashierQueue'
import { Inbox, Clock, ShoppingCart, User, Package, X } from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

const { quotes, count, loading, error, timeAgo, startPolling, stopPolling, removeFromQueue } = useCashierQueue()
const { loadQuoteAsSession } = usePOS()

// Reactive clock: ticks every second so timeAgo re-renders
const now = ref(Date.now())
let clockInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  startPolling(15000) // page polling: 15 seconds
  clockInterval = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  stopPolling()
  if (clockInterval) {
    clearInterval(clockInterval)
    clockInterval = null
  }
})

// Process payment: use exactly the same pattern as openQuoteInPOS in SalesQuotes/Index.vue
const processingId = ref<number | null>(null)

const processPayment = async (quote: PendingQuote) => {
  processingId.value = quote.id
  try {
    const res = await apiClient.get(`/sales-quotes/${quote.id}`)
    const q = res.data
    loadQuoteAsSession({
      id: q.id,
      quote_number: q.quote_number,
      customer_id: q.customer?.id ?? null,
      items: (q.items ?? []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        variant_id: item.variant_id ?? null,
        warehouse_id: item.warehouse_id ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        tax_percent: item.tax_percent,
        subtotal: item.subtotal,
        tax_amount: item.tax_amount,
        total: item.total,
        variant: item.variant ?? null,
      }))
    })
    router.visit('/pos')
  } catch (e: any) {
    alert(e.response?.data?.message || 'Error al cargar la cotización en POS')
  } finally {
    processingId.value = null
  }
}

const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const removingId = ref<number | null>(null)

const handleRemoveFromQueue = async (quote: PendingQuote) => {
  const confirmed = confirm(`¿Remover "${quote.quote_number}" de la cola de caja?\n\nLa cotización NO se eliminará, solo saldrá de la cola.`)
  if (!confirmed) return

  removingId.value = quote.id
  try {
    const success = await removeFromQueue(quote.id)
    if (!success) alert('Error al remover la cotización de la cola')
  } catch (e: any) {
    alert(e.response?.data?.message || 'Error al remover de la cola')
  } finally {
    removingId.value = null
  }
}

const summarizedProducts = (items: PendingQuote['items']) => {
  const maxShow = 3
  const shown = items.slice(0, maxShow)
  const extra = items.length - maxShow
  return { shown, extra: extra > 0 ? extra : 0 }
}
</script>

<template>
  <Head title="Cola de Caja" />

  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Inbox class="w-8 h-8 text-sky-600 dark:text-sky-400" />
          Cotizaciones en Caja
          <span
            v-if="count > 0"
            class="inline-flex items-center justify-center px-2.5 py-0.5 text-sm font-bold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
          >
            {{ count }}
          </span>
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Cotizaciones enviadas por vendedores listas para cobrar
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && quotes.length === 0" class="text-center py-16 text-gray-500">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent mx-auto mb-3"></div>
      Cargando cotizaciones pendientes...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-center">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="startPolling(15000)" class="mt-3 text-sm text-red-700 dark:text-red-300 underline">Reintentar</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="count === 0" class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-16 text-center">
      <Inbox class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
      <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No hay cotizaciones pendientes</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Las cotizaciones enviadas a caja aparecerán aquí automáticamente.
      </p>
    </div>

    <!-- Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="quote in quotes"
        :key="quote.id"
        class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col h-[420px]"
      >
        <!-- Card Header -->
        <div class="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between">
          <div>
            <span class="text-sm font-bold text-sky-700 dark:text-sky-400 uppercase">{{ quote.quote_number }}</span>
            <div class="flex items-center gap-1.5 mt-0.5">
              <User :size="12" class="text-gray-400" />
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ quote.user?.name ?? 'Sin vendedor' }}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <div class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock :size="14" />
                <span class="text-sm font-semibold tabular-nums">{{ timeAgo(quote.sent_to_cashier_at, now) }}</span>
              </div>
            </div>
            <!-- Remove button -->
            <button
              @click.stop="handleRemoveFromQueue(quote)"
              :disabled="removingId === quote.id"
              class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              title="Remover de cola"
            >
              <X :size="18" />
            </button>
          </div>
        </div>

        <!-- Card Body -->
        <div class="px-5 py-4 space-y-3 flex-1 overflow-y-auto">
          <!-- Customer -->
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente:</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ quote.customer?.name || 'Público General' }}
            </span>

          </div>

          <!-- Products summary -->
          <div class="space-y-1.5">
            <div
              v-for="item in summarizedProducts(quote.items).shown"
              :key="item.product_id"
              class="flex items-center gap-2 text-sm"
            >
              <Package :size="14" class="text-gray-400 shrink-0" />
              <span class="text-gray-700 dark:text-gray-300 truncate flex-1">
                {{ item.product?.name || 'Producto' }}
              </span>
              <span class="text-gray-500 dark:text-gray-400 font-medium shrink-0">
                x{{ item.quantity }}
              </span>
            </div>
            <p
              v-if="summarizedProducts(quote.items).extra > 0"
              class="text-xs text-gray-400 dark:text-gray-500 pl-6"
            >
              +{{ summarizedProducts(quote.items).extra }} producto{{ summarizedProducts(quote.items).extra > 1 ? 's' : '' }} más
            </p>
          </div>

          <!-- Total -->
          <div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-border">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</span>
            <span class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(quote.total) }}</span>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="px-5 py-3 bg-gray-50 dark:bg-background">
          <button
            @click="processPayment(quote)"
            :disabled="processingId === quote.id"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold text-sm shadow-sm"
          >
            <div v-if="processingId === quote.id" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            <ShoppingCart v-else :size="18" />
            {{ processingId === quote.id ? 'Cargando...' : 'Procesar Pago' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
