<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Package, Search } from 'lucide-vue-next'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import type { Product } from '@/types/product'

const props = withDefaults(defineProps<{
  show: boolean
  products: Product[]
  searchQuery: string
  clientMode?: boolean
}>(), {
  clientMode: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'add-products', ids: Set<number>): void
}>()

// --- Internal selection state ---
const selectedIds = ref<Set<number>>(new Set())
const modalRef = ref<HTMLDivElement | null>(null)

// Reset selections when modal opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    selectedIds.value = new Set()
    nextTick(() => modalRef.value?.focus())
  }
})

// Keyboard: Esc to close
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// --- Helpers ---
const getPrice = (p: Product): number =>
  p.pricing?.base_price ?? p.default_variant?.pricing?.base_price ?? 0

const getTaxRate = (p: Product): number =>
  p.pricing?.tax_rate ?? p.default_variant?.pricing?.tax_rate ?? 0

const getStock = (p: Product): number =>
  p.total_stock ?? p.default_variant?.total_stock ?? 0

const getSKU = (p: Product): string => {
  if (props.clientMode) return `#${p.id}`
  return p.sku_base ?? p.default_variant?.sku ?? '—'
}

const stockClass = (stock: number) => {
  if (stock > 5) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (stock > 0) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

// --- Selection logic ---
const toggleProduct = (id: number) => {
  const next = new Set(selectedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedIds.value = next
}

const isSelected = (id: number) => selectedIds.value.has(id)

const selectedCount = computed(() => selectedIds.value.size)

const allSelected = computed(() =>
  props.products.length > 0 && selectedIds.value.size === props.products.length,
)

const toggleAll = () => {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(props.products.map(p => p.id))
  }
}

const submitSelection = () => {
  emit('add-products', new Set(selectedIds.value))
}
</script>

<template>
  <!-- Backdrop -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <!-- Panel -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="show"
          ref="modalRef"
          tabindex="-1"
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden outline-none ring-1 ring-gray-200 dark:ring-gray-700"
        >
          <!-- ═══════════ HEADER (sticky) ═══════════ -->
          <div class="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
            <div>
              <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Search class="w-5 h-5 text-indigo-500" />
                Seleccionar Productos
              </h2>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ products.length }} resultado{{ products.length !== 1 ? 's' : '' }} para
                <span class="font-medium text-gray-700 dark:text-gray-300">"{{ searchQuery }}"</span>
              </p>
            </div>
            <button
              @click="emit('close')"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- ═══════════ TABLE BODY (scrollable) ═══════════ -->
          <div class="flex-1 overflow-y-auto min-h-0">
            <!-- Empty state -->
            <div v-if="products.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
              <Package class="w-12 h-12 text-gray-300 mb-3" />
              <p class="text-sm font-medium text-gray-500">No se encontraron productos</p>
              <p class="text-xs text-gray-400 mt-1">Intenta con otro término de búsqueda</p>
            </div>

            <table v-else class="w-full text-left">
              <!-- Table Header -->
              <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th class="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      :checked="allSelected"
                      :indeterminate="selectedCount > 0 && !allSelected"
                      @change="toggleAll"
                      class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th class="w-14 px-2 py-3"></th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Stock</th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Precio</th>
                </tr>
              </thead>

              <!-- Table Body -->
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
                <tr
                  v-for="product in products"
                  :key="product.id"
                  @click="toggleProduct(product.id)"
                  class="group cursor-pointer transition-colors"
                  :class="isSelected(product.id)
                    ? 'bg-indigo-50/70 dark:bg-indigo-900/15 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/25'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'"
                >
                  <!-- Checkbox -->
                  <td class="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      :checked="isSelected(product.id)"
                      @click.stop
                      @change="toggleProduct(product.id)"
                      class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  <!-- Image Thumbnail -->
                  <td class="px-2 py-3">
                    <div class="h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        v-if="product.image_url"
                        :src="product.image_url"
                        :alt="product.name"
                        class="h-full w-full object-contain p-0.5"
                      />
                      <div v-else class="h-full w-full flex items-center justify-center">
                        <Package class="h-5 w-5 text-gray-300" />
                      </div>
                    </div>
                  </td>

                  <!-- Product Name + Category/Brand -->
                  <td class="px-3 py-3 max-w-[250px]">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ product.name }}</p>
                    <p v-if="product.category?.name || product.brand?.name" class="text-[11px] text-gray-400 truncate mt-0.5">
                      <span v-if="product.category?.name">{{ product.category.name }}</span>
                      <span v-if="product.category?.name && product.brand?.name"> · </span>
                      <span v-if="product.brand?.name">{{ product.brand.name }}</span>
                    </p>
                  </td>

                  <!-- SKU -->
                  <td class="px-3 py-3">
                    <span class="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {{ getSKU(product) }}
                    </span>
                  </td>

                  <!-- Stock Badge -->
                  <td class="px-3 py-3 text-center">
                    <span
                      class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
                      :class="stockClass(getStock(product))"
                    >
                      {{ getStock(product) }}
                    </span>
                  </td>

                  <!-- Price -->
                  <td class="px-3 py-3 text-right">
                    <PriceDisplay
                      :base-price="getPrice(product)"
                      :tax-rate="getTaxRate(product)"
                      size="sm"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- ═══════════ FOOTER (sticky) ═══════════ -->
          <div class="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
            <span class="text-sm text-gray-500">
              <span class="font-semibold text-indigo-600">{{ selectedCount }}</span>
              seleccionado{{ selectedCount !== 1 ? 's' : '' }}
            </span>
            <div class="flex gap-3">
              <button
                @click="emit('close')"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="submitSelection"
                :disabled="selectedCount === 0"
                class="px-6 py-2 text-sm font-bold text-white rounded-xl transition-all"
                :class="selectedCount > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md'
                  : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-50'"
              >
                Agregar ({{ selectedCount }})
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
