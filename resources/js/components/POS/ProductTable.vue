<script setup lang="ts">
import { ref } from 'vue'
import { Trash2, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/formatters'
import ProductContextMenu from './ProductContextMenu.vue'

const props = defineProps<{
  items: any[]
  users: { id: number; name: string }[]
  products?: any[] // Full product catalog for context menu details
  clientMode?: boolean // Code protection: show DB IDs instead of SKUs
  warehouseId?: number | null
}>()

const emit = defineEmits([
  'update-quantity',
  'remove',
  'update-item-tax',
  'toggle-item-tax-exempt',
  'update-item-seller',
  'update-item-notes',
])

// Track which row is expanded (only one at a time)
const expandedItemId = ref<string | null>(null)

const toggleExpand = (itemId: string) => {
  expandedItemId.value = expandedItemId.value === itemId ? null : itemId
}

// ====== Context Menu State ======
const ctxMenuVisible = ref(false)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)
const ctxMenuItem = ref<any>(null)
const ctxMenuProduct = ref<any>(null)
let longPressTimer: ReturnType<typeof setTimeout> | null = null

const getProductForItem = (item: any) => {
  if (!props.products) return null
  return props.products.find(p => p.id === item.product_id) || null
}

const showContextMenu = (e: MouseEvent, item: any) => {
  ctxMenuX.value = e.clientX
  ctxMenuY.value = e.clientY
  ctxMenuItem.value = item
  ctxMenuProduct.value = getProductForItem(item)
  ctxMenuVisible.value = true
}

const startLongPress = (item: any, e: TouchEvent) => {
  const touch = e.touches[0]
  longPressTimer = setTimeout(() => {
    ctxMenuX.value = touch.clientX
    ctxMenuY.value = touch.clientY
    ctxMenuItem.value = item
    ctxMenuProduct.value = getProductForItem(item)
    ctxMenuVisible.value = true
  }, 500)
}

const cancelLongPress = () => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
}

const displaySku = (item: any) => {
  if (props.clientMode) return `#${item.product_id}`
  return item.variant_sku || item.product_sku || item.variant_name || 'General'
}
</script>

<template>
  <div class="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-100 dark:border-border flex flex-col h-full overflow-hidden">
    <div class="flex-1 overflow-auto relative">
      <table class="w-full text-left border-collapse min-w-[500px]">
        <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-muted shadow-sm">
          <tr class="border-b border-gray-100 dark:border-border text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wider">
            <th class="px-2 py-3 text-center w-10 bg-gray-50 dark:bg-muted">#</th>
            <th class="px-4 py-3 bg-gray-50 dark:bg-muted">Producto</th>
            <th class="px-4 py-3 text-right bg-gray-50 dark:bg-muted">Precio</th>
            <th class="px-4 py-3 text-center bg-gray-50 dark:bg-muted w-32">Cant.</th>
            <th class="px-4 py-3 text-right bg-gray-50 dark:bg-muted">Total</th>
            <th class="px-2 py-3 text-center w-12 bg-gray-50 dark:bg-muted"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-if="items.length === 0">
            <td colspan="6" class="px-4 py-12 text-center text-gray-400">
              El carrito está vacío
            </td>
          </tr>
          
          <template v-for="(item, index) in items" :key="item.id">
            <!-- Main row -->
            <tr
              class="hover:bg-gray-50/50 dark:hover:bg-muted/30 transition-colors group cursor-pointer border-b border-gray-50 dark:border-border/40"
              :class="{ 'bg-indigo-50/40 dark:bg-indigo-900/20': expandedItemId === item.id }"
              @click="toggleExpand(item.id)"
              @contextmenu.prevent="showContextMenu($event, item)"
              @touchstart="startLongPress(item, $event)"
              @touchend="cancelLongPress"
              @touchmove="cancelLongPress"
            >
              <td class="text-center px-2 py-3 text-xs text-gray-400 font-mono">
                {{ index + 1 }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <component
                    :is="expandedItemId === item.id ? ChevronUp : ChevronDown"
                    class="w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform"
                  />
                  <div class="flex flex-col">
                    <span class="font-medium text-gray-900 dark:text-white text-sm">{{ item.product_name }}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ displaySku(item) }}
                    </span>
                    <div class="flex flex-wrap gap-1 mt-0.5">
                      <span v-if="item.discount_percent > 0" class="text-xs text-green-600 bg-green-100 px-1 py-0.5 rounded inline-block w-max">
                        -{{ item.discount_percent }}% OFF
                      </span>
                      <span v-if="item.tax_percent === 0" class="text-xs text-orange-600 bg-orange-100 px-1 py-0.5 rounded inline-block w-max">
                        Exento
                      </span>
                      <span v-if="item.seller_id" class="text-xs text-blue-600 dark:text-primary bg-blue-100 px-1 py-0.5 rounded inline-block w-max">
                        {{ users.find(u => u.id === item.seller_id)?.name || 'Vendedor' }}
                      </span>
                      <span v-if="item.notes" class="text-xs text-purple-600 bg-purple-100 px-1 py-0.5 rounded inline-block w-max" title="Tiene nota interna">
                        📋 Nota
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              
              <td class="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300 text-sm" @click.stop>
                <div>{{ formatCurrency(item.product_price) }}</div>
                <div v-if="item.tax_percent > 0" class="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                  +{{ item.tax_percent }}% ITBMS
                </div>
                <div v-else class="text-[10px] text-orange-500 leading-tight">Exento</div>
              </td>
              
              <td class="px-4 py-3" @click.stop>
                <div class="flex items-center justify-center gap-2">
                  <button 
                    @click="emit('update-quantity', index, item.quantity - 1)"
                    class="p-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-muted/50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <Minus class="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="number"
                    min="1"
                    :value="item.quantity"
                    @change="emit('update-quantity', index, parseInt(($event.target as HTMLInputElement).value))"
                    class="font-semibold text-gray-900 dark:text-white w-12 text-center text-sm bg-transparent border-0 focus:ring-0 p-0"
                  />
                  <button 
                    @click="emit('update-quantity', index, item.quantity + 1)"
                    class="p-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-muted/50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
              
              <td class="px-4 py-3 text-right font-bold text-gray-900 dark:text-white bg-blue-50/30 dark:bg-blue-900/10 text-sm">
                {{ formatCurrency(item.total) }}
              </td>
              
              <td class="px-2 py-3 text-center" @click.stop>
                <button 
                  @click="emit('remove', index)"
                  class="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>

            <!-- Expandable options row -->
            <tr v-if="expandedItemId === item.id">
              <td colspan="6" class="px-0 py-0">
                <div class="bg-gradient-to-b from-indigo-50/60 dark:from-indigo-900/20 to-white dark:to-card border-t border-indigo-100 dark:border-indigo-900/50 px-6 py-4 animate-slide-down">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

                    <!-- Tax exempt toggle -->
                    <div class="space-y-2">
                      <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">Impuesto</label>
                      <div class="flex items-center gap-3">
                        <button
                          @click.stop="emit('toggle-item-tax-exempt', item.id)"
                          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                          :class="item.tax_percent > 0 ? 'bg-indigo-500' : 'bg-gray-300'"
                        >
                          <span
                            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
                            :class="item.tax_percent > 0 ? 'translate-x-6' : 'translate-x-1'"
                          />
                        </button>
                        <span class="text-sm text-gray-700">
                          {{ item.tax_percent > 0 ? 'Con impuesto' : 'Exento' }}
                        </span>
                      </div>
                      <!-- Editable tax percent -->
                      <div v-if="item.tax_percent > 0" class="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          :value="item.tax_percent"
                          @change.stop="emit('update-item-tax', item.id, parseFloat(($event.target as HTMLInputElement).value))"
                          class="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-card text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span class="text-xs text-gray-500">%</span>
                      </div>
                      <div class="text-xs text-gray-400 mt-1">
                        Monto: <span class="font-medium text-gray-600 dark:text-gray-300">{{ formatCurrency(item.tax_amount) }}</span>
                      </div>
                    </div>

                    <!-- Seller selector -->
                    <div class="space-y-2">
                      <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">Vendedor</label>
                      <select
                        :value="item.seller_id ?? ''"
                        @change.stop="emit('update-item-seller', item.id, ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-card text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Sin vendedor asignado</option>
                        <option v-for="user in users" :key="user.id" :value="user.id">
                          {{ user.name }}
                        </option>
                      </select>
                      <p class="text-xs text-gray-400">Asigna quién vendió este producto</p>
                    </div>

                    <!-- Internal Notes -->
                    <div class="space-y-2">
                      <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">Nota Interna</label>
                      <textarea
                        :value="item.notes || ''"
                        @change.stop="emit('update-item-notes', item.id, ($event.target as HTMLTextAreaElement).value)"
                        placeholder="Nota interna (no se imprime en ticket)…"
                        rows="2"
                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-card text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                      <p class="text-xs text-gray-400">Solo visible internamente</p>
                    </div>

                    <!-- Summary mini-card -->
                    <div class="space-y-2">
                      <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">Resumen</label>
                      <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-3 space-y-1.5">
                        <div class="flex justify-between text-xs">
                          <span class="text-gray-500">Subtotal</span>
                          <span class="font-medium text-gray-700 dark:text-gray-300">{{ formatCurrency(item.subtotal) }}</span>
                        </div>
                        <div class="flex justify-between text-xs">
                          <span class="text-gray-500">Impuesto ({{ item.tax_percent }}%)</span>
                          <span class="font-medium text-gray-700 dark:text-gray-300">{{ formatCurrency(item.tax_amount) }}</span>
                        </div>
                        <div class="flex justify-between text-sm font-bold border-t border-gray-100 dark:border-border pt-1.5">
                          <span class="text-gray-900 dark:text-white">Total</span>
                          <span class="text-indigo-600 dark:text-primary dark:text-indigo-400">{{ formatCurrency(item.total) }}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    
    <div class="bg-gray-50 dark:bg-muted px-4 py-2 border-t border-gray-100 dark:border-border text-xs text-gray-400 text-center uppercase tracking-widest shrink-0">
      {{ items.length }} {{ items.length === 1 ? 'producto' : 'productos' }} en lista
    </div>

    <!-- Context Menu -->
    <ProductContextMenu
      :show="ctxMenuVisible"
      :x="ctxMenuX"
      :y="ctxMenuY"
      :item="ctxMenuItem"
      :product-details="ctxMenuProduct"
      :warehouse-id="warehouseId ?? null"
      @close="ctxMenuVisible = false"
    />
  </div>
</template>

<style scoped>
.animate-slide-down {
  animation: slideDown 0.15s ease-out;
}
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 300px;
  }
}
</style>
