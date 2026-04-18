<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Package, Search, Truck, Eye, ListPlus, Filter } from 'lucide-vue-next'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue'
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue'
import ProductFilters from '@/components/Products/ProductFilters.vue'
import type { ProductFilterValues } from '@/components/Products/ProductFilters.vue'
import ProductSort from '@/components/Products/ProductSort.vue'
import apiClient from '@/services/api/client'
import { displayFormat } from '@/utils/formatters'
import type { Product } from '@/types/product'

interface CategoryOption { id: number; name: string }
interface BrandOption { id: number; name: string }

const props = withDefaults(defineProps<{
  show: boolean
  products: Product[]
  searchQuery: string
  clientMode?: boolean
  totalCount?: number
  hasMore?: boolean
  loadingMore?: boolean
  // Context mode: 'pos' = add to cart with checkboxes, 'supply-list' = single-click to add
  context?: 'pos' | 'supply-list'
  // Whether to show quick purchase action (backorder button)
  showQuickPurchaseAction?: boolean
  // Filter options
  categories?: CategoryOption[]
  brands?: BrandOption[]
}>(), {
  clientMode: false,
  totalCount: 0,
  hasMore: false,
  loadingMore: false,
  context: 'pos',
  showQuickPurchaseAction: true,
  categories: () => [],
  brands: () => [],
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'add-products', ids: Set<number>): void
  (e: 'load-more'): void
  (e: 'product-selected', product: Product): void
  (e: 'search-in-modal', filters: {
    query: string
    category_ids?: number[]
    brand_ids?: number[]
    sku?: string
    min_price?: number
    max_price?: number
    in_stock?: boolean
    sort?: string
  }): void
}>()

// --- Internal selection state ---
const selectedIds = ref<Set<number>>(new Set())
const modalRef = ref<HTMLDivElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// R43: Internal search state
const internalSearchQuery = ref('')
const isSearching = ref(false)

// --- Advanced filter state ---
const showMobileFilters = ref(false)
const sortValue = ref('name_asc')

const filterValues = ref<ProductFilterValues>({
  sku: '',
  category_ids: [],
  brand_ids: [],
  min_price: undefined,
  max_price: undefined,
  in_stock: false,
})

const defaultFilters = (): ProductFilterValues => ({
  sku: '',
  category_ids: [],
  brand_ids: [],
  min_price: undefined,
  max_price: undefined,
  in_stock: false,
})

// Reset selections and search query when modal opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    selectedIds.value = new Set()
    internalSearchQuery.value = props.searchQuery || ''
    filterValues.value = defaultFilters()
    filterValues.value.sku = internalSearchQuery.value
    sortValue.value = 'name_asc'
    showMobileFilters.value = false
    nextTick(() => searchInputRef.value?.focus())
  }
})

watch(internalSearchQuery, (value) => {
  if (filterValues.value.sku !== value) {
    filterValues.value = {
      ...filterValues.value,
      sku: value,
    }
  }
})

// Emit all filters+sort+query to parent for refetch
const emitFilters = () => {
  const f = filterValues.value
  const query = (internalSearchQuery.value || f.sku || '').trim()
  emit('search-in-modal', {
    query,
    category_ids: f.category_ids.length > 0 ? f.category_ids : undefined,
    brand_ids: f.brand_ids.length > 0 ? f.brand_ids : undefined,
    min_price: f.min_price ?? undefined,
    max_price: f.max_price ?? undefined,
    in_stock: f.in_stock || undefined,
    sort: sortValue.value,
  })
}

// When filters change, auto-search
const handleFilterChange = (newFilters: ProductFilterValues) => {
  filterValues.value = newFilters
  if ((newFilters.sku ?? '') !== internalSearchQuery.value) {
    internalSearchQuery.value = newFilters.sku ?? ''
  }
  emitFilters()
}

// When sort changes, auto-search
watch(sortValue, () => {
  emitFilters()
})

// R43: Handle internal search (text search)
const handleInternalSearch = () => {
  if (isSearching.value) return
  isSearching.value = true
  emitFilters()
  setTimeout(() => {
    isSearching.value = false
  }, 500)
}

// Quick Purchase state
const showQuickPurchase = ref(false)
const productForPurchase = ref<Product | null>(null)

// Product Detail Modal state
const selectedProductForDetail = ref<any>(null)
const loadingProductDetail = ref(false)

const openProductDetail = async (product: Product, event: Event) => {
  event.stopPropagation()
  loadingProductDetail.value = true
  try {
    const { data } = await apiClient.get(`/products/${product.id}`)
    selectedProductForDetail.value = data.data ?? data
  } catch {
    // Silent fail - product modal won't open
  } finally {
    loadingProductDetail.value = false
  }
}

// Context menu state
const contextMenu = ref<{ show: boolean; x: number; y: number; product: Product | null }>({
  show: false,
  x: 0,
  y: 0,
  product: null,
})

const openContextMenu = (event: MouseEvent, product: Product) => {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    product,
  }
}

const closeContextMenu = () => {
  contextMenu.value.show = false
}

const handleContextMenuAction = async (action: string) => {
  const product = contextMenu.value.product
  closeContextMenu()
  
  if (!product) return
  
  if (action === 'view-details') {
    loadingProductDetail.value = true
    try {
      const { data } = await apiClient.get(`/products/${product.id}`)
      selectedProductForDetail.value = data.data ?? data
    } catch {
      // Silent fail
    } finally {
      loadingProductDetail.value = false
    }
  } else if (action === 'quick-purchase') {
    productForPurchase.value = product
    showQuickPurchase.value = true
  } else if (action === 'add-to-supply-list') {
    // Open QuickPurchaseModal for adding to supply list
    productForPurchase.value = product
    showQuickPurchase.value = true
  }
}

const openQuickPurchase = (product: Product, event: Event) => {
  event.stopPropagation()
  productForPurchase.value = product
  showQuickPurchase.value = true
}

const onQuickPurchaseSuccess = ({ productId, variantId, quantityAdded }: { productId: number, variantId?: number | '', quantityAdded: number }) => {
  showQuickPurchase.value = false
  // Optimistically update stock
  const product = props.products.find(p => p.id === productId)
  if (product) {
      // Update overall total stock
      if (product.total_stock !== undefined) {
          product.total_stock += quantityAdded
      }
      
      // Update specific variant stock
      if (variantId && product.variants?.length) {
          const variant = product.variants.find((v: any) => v.id === variantId)
          if (variant) {
              variant.total_stock = (variant.total_stock || 0) + quantityAdded
          }
      } else if (product.default_variant) {
          // Fallback to default variant if no variant explicitly selected
          product.default_variant.total_stock = (product.default_variant.total_stock || 0) + quantityAdded
      }
  }
}

// Keyboard: Esc to close
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show) {
    if (contextMenu.value.show) {
      closeContextMenu()
    } else {
      emit('close')
    }
  }
}

// Close context menu on click outside
const handleClickOutside = () => {
  if (contextMenu.value.show) {
    closeContextMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('click', handleClickOutside)
})

// --- Helpers ---
const getPrice = (p: Product): number =>
  p.pricing?.base_price ?? p.default_variant?.pricing?.base_price ?? 0

const getTaxRate = (p: Product): number =>
  p.pricing?.sale_tax_rate
  ?? p.pricing?.tax_rate
  ?? p.default_variant?.pricing?.sale_tax_rate
  ?? p.default_variant?.pricing?.tax_rate
  ?? 0

const getStock = (p: Product): number =>
  p.total_stock ?? p.default_variant?.total_stock ?? 0

const getSKU = (p: Product): string => {
  if (props.clientMode) return `#${p.id}`
  return displayFormat(p.sku_base ?? p.default_variant?.sku) || '—'
}

const getSpecs = (p: any): { name: string; value: string; unit?: string }[] => {
  return p.key_attributes ?? []
}

const stockClass = (stock: number) => {
  if (stock > 5) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (stock > 0) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

// --- Selection logic (for POS context) ---
const toggleProduct = (id: number) => {
  const next = new Set(selectedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedIds.value = next
}

// Handle product click based on context
const handleProductClick = (product: Product) => {
  if (props.context === 'supply-list') {
    // In supply-list context, emit product for direct handling
    emit('product-selected', product)
  } else {
    // In POS context, toggle selection
    toggleProduct(product.id)
  }
}

const isSelected = (id: number) => selectedIds.value.has(id)

const selectedCount = computed(() => selectedIds.value.size)

// Check if we're in selection mode (POS)
const isSelectionMode = computed(() => props.context === 'pos')

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
          class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden outline-none ring-1 ring-gray-200 dark:ring-gray-700"
        >
          <!-- ═══════════ HEADER (sticky) ═══════════ -->
          <div class="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-border bg-white dark:bg-card">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Search class="w-5 h-5 text-indigo-500" />
                  Seleccionar Productos
                </h2>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ products.length }}<span v-if="totalCount > products.length"> de {{ totalCount }}</span> resultado{{ totalCount !== 1 ? 's' : '' }}
                </p>
              </div>
              <button
                @click="emit('close')"
                class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
            
            <!-- R43: Editable Search Bar inside Modal -->
            <div class="flex gap-2">
              <div class="relative flex-1">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref="searchInputRef"
                  v-model="internalSearchQuery"
                  @keyup.enter="handleInternalSearch"
                  type="text"
                  placeholder="Buscar por nombre, SKU, VIN, OEM, categoria..."
                  class="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-700 dark:text-foreground placeholder:text-gray-400 transition-shadow"
                />
              </div>
              <ProductSort v-model="sortValue" />
              <!-- Mobile filter toggle -->
              <button
                @click="showMobileFilters = !showMobileFilters"
                class="md:hidden px-3 py-2 border border-gray-200 dark:border-border rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted transition-colors flex items-center gap-1.5 text-sm"
                :class="showMobileFilters ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : ''"
              >
                <Filter class="w-4 h-4" />
                Filtros
              </button>
              <button
                @click="handleInternalSearch"
                :disabled="isSearching"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <Search class="w-4 h-4" />
                {{ isSearching ? 'Buscando...' : 'Buscar' }}
              </button>
            </div>
          </div>

          <!-- ═══════════ BODY: Sidebar + Table (scrollable) ═══════════ -->
          <div class="flex-1 flex min-h-0 overflow-hidden">
            <!-- Filter Sidebar (desktop always, mobile toggle) -->
            <div
              class="shrink-0 overflow-y-auto border-r border-gray-100 dark:border-border"
              :class="showMobileFilters ? 'block' : 'hidden md:block'"
            >
              <ProductFilters
                :model-value="filterValues"
                @update:model-value="handleFilterChange"
                :categories="categories"
                :brands="brands"
                :collapsible="false"
              />
            </div>

            <!-- Results area -->
            <div class="flex-1 overflow-y-auto min-h-0">
            <!-- Empty state -->
            <div v-if="products.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
              <Package class="w-12 h-12 text-gray-300 mb-3" />
              <p class="text-sm font-medium text-gray-500">No se encontraron productos</p>
              <p class="text-xs text-gray-400 mt-1">Intenta con otro término de búsqueda</p>
            </div>

            <table v-else class="w-full text-left">
              <!-- Table Header -->
              <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-border">
                <tr>
                  <th v-if="isSelectionMode" class="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      :checked="allSelected"
                      :indeterminate="selectedCount > 0 && !allSelected"
                      @change="toggleAll"
                      class="h-4 w-4 rounded border-gray-300 text-indigo-600 dark:text-primary focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th class="w-14 px-2 py-3"></th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Specs</th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Stock</th>
                  <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Precio</th>
                  <th class="w-16 px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Acciones</th>
                </tr>
              </thead>

              <!-- Table Body -->
              <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                <tr
                  v-for="product in products"
                  :key="product.id"
                  @click="handleProductClick(product)"
                  @contextmenu="(e) => openContextMenu(e, product)"
                  class="group cursor-pointer transition-colors"
                  :class="isSelectionMode && isSelected(product.id)
                    ? 'bg-indigo-50/70 dark:bg-indigo-900/15 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/25'
                    : 'hover:bg-gray-50 dark:hover:bg-muted/50/30'"
                >
                  <!-- Checkbox (only in selection mode) -->
                  <td v-if="isSelectionMode" class="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      :checked="isSelected(product.id)"
                      @click.stop
                      @change="toggleProduct(product.id)"
                      class="h-4 w-4 rounded border-gray-300 text-indigo-600 dark:text-primary focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  <!-- Image Thumbnail -->
                  <td class="px-2 py-3">
                    <div class="h-10 w-10 bg-gray-100 dark:bg-muted rounded-lg overflow-hidden flex-shrink-0">
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
                    <div class="flex items-center gap-2">
                        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ product.name }}</p>
                        <span v-if="product.is_universal" class="flex-shrink-0 inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-600 ring-1 ring-inset ring-blue-500/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30" title="Universal">
                            🌐 Univ
                        </span>
                    </div>
                    <p v-if="product.category?.name || product.brand?.name" class="text-[11px] text-gray-400 truncate mt-0.5">
                      <span v-if="product.category?.name">{{ product.category.name }}</span>
                      <span v-if="product.category?.name && product.brand?.name"> · </span>
                      <span v-if="product.brand?.name">{{ product.brand.name }}</span>
                    </p>
                  </td>

                  <!-- SKU -->
                  <td class="px-3 py-3">
                    <div class="space-y-1">
                      <span class="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-muted px-1.5 py-0.5 rounded">
                        {{ getSKU(product) }}
                      </span>
                      <div v-if="product.search_match_type && product.search_match_system_id" class="text-[10px] text-indigo-600 dark:text-indigo-300">
                        {{ product.search_match_type === 'product' ? 'ID producto' : 'ID variante' }}: {{ product.search_match_system_id }}
                      </div>
                    </div>
                  </td>

                  <!-- Specs -->
                  <td class="px-3 py-3">
                    <div v-if="getSpecs(product).length" class="flex flex-wrap gap-1 max-w-[180px]">
                      <span
                        v-for="attr in getSpecs(product)"
                        :key="attr.name"
                        class="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-muted text-gray-600 dark:text-gray-400 whitespace-nowrap"
                        :title="attr.name"
                      >
                        {{ attr.value }}{{ attr.unit ? ' ' + attr.unit : '' }}
                      </span>
                    </div>
                    <span v-else class="text-[10px] text-gray-300">—</span>
                  </td>

                  <!-- Stock Badge -->
                  <td class="px-3 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <span
                          class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                          :class="stockClass(getStock(product))"
                        >
                          {{ getStock(product) }}
                        </span>
                        
                        <!-- Quick backorder button (only in POS context with prop enabled) -->
                        <button
                          v-if="showQuickPurchaseAction && getStock(product) <= 0"
                          @click="(e) => openQuickPurchase(product, e)"
                          class="p-1 rounded text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30 transition-colors"
                          title="Abastecer Rápido (Backorder)"
                        >
                          <Truck class="w-4 h-4" />
                        </button>
                    </div>
                  </td>

                  <!-- Price -->
                  <td class="px-3 py-3 text-right">
                    <PriceDisplay
                      :base-price="getPrice(product)"
                      :tax-rate="getTaxRate(product)"
                      size="sm"
                    />
                  </td>

                  <!-- Actions -->
                  <td class="px-3 py-3 text-center">
                    <button
                      @click="(e) => openProductDetail(product, e)"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
                      title="Ver detalle del producto"
                      :disabled="loadingProductDetail"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Load More Button -->
            <div v-if="hasMore" class="flex justify-center py-4 border-t border-gray-100 dark:border-border/50">
              <button
                @click="emit('load-more')"
                :disabled="loadingMore"
                class="px-6 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800/50 disabled:opacity-50"
              >
                <span v-if="loadingMore">Cargando...</span>
                <span v-else>Cargar más resultados</span>
              </button>
            </div>
            </div>
          </div>

          <!-- ═══════════ FOOTER (sticky, only in POS selection mode) ═══════════ -->
          <div v-if="isSelectionMode" class="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-border flex items-center justify-between bg-white dark:bg-card">
            <span class="text-sm text-gray-500">
              <span class="font-semibold text-indigo-600 dark:text-primary">{{ selectedCount }}</span>
              seleccionado{{ selectedCount !== 1 ? 's' : '' }}
            </span>
            <div class="flex gap-3">
              <button
                @click="emit('close')"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-border rounded-xl hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="submitSelection"
                :disabled="selectedCount === 0"
                class="px-6 py-2 text-sm font-bold text-white rounded-xl transition-all"
                :class="selectedCount > 0
                  ? 'bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 shadow-sm hover:shadow-md'
                  : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-50'"
              >
                Agregar ({{ selectedCount }})
              </button>
            </div>
          </div>
          <!-- Footer for supply-list mode: just a close button -->
          <div v-else class="shrink-0 px-6 py-3 border-t border-gray-200 dark:border-border flex items-center justify-between bg-gray-50 dark:bg-muted/20">
            <span class="text-xs text-gray-500">
              Haz clic en un producto para agregarlo a la lista
            </span>
            <button
              @click="emit('close')"
              class="px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- Quick Purchase Modal (Backorder) -->
  <QuickPurchaseModal
    :is-open="showQuickPurchase"
    :product="productForPurchase"
    @close="showQuickPurchase = false"
    @success="onQuickPurchaseSuccess"
  />

  <!-- Product Detail Modal -->
  <ProductDetailModal
    v-if="selectedProductForDetail"
    :product="selectedProductForDetail"
    @close="selectedProductForDetail = null"
  />

  <!-- Context Menu -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="contextMenu.show"
        class="fixed z-[100] bg-white dark:bg-card rounded-lg shadow-xl border border-gray-200 dark:border-border py-1 min-w-[180px]"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <button
          @click="handleContextMenuAction('view-details')"
          class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted flex items-center gap-2"
        >
          <Eye class="w-4 h-4 text-indigo-500" />
          Ver detalle
        </button>
        <!-- Add to Supply List option (only in POS context) -->
        <button
          v-if="context === 'pos' && contextMenu.product"
          @click="handleContextMenuAction('add-to-supply-list')"
          class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted flex items-center gap-2"
        >
          <ListPlus class="w-4 h-4 text-emerald-500" />
          Agregar a Lista de Abastecimiento
        </button>
        <button
          v-if="showQuickPurchaseAction && contextMenu.product && getStock(contextMenu.product) <= 0"
          @click="handleContextMenuAction('quick-purchase')"
          class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted flex items-center gap-2"
        >
          <Truck class="w-4 h-4 text-orange-500" />
          Abastecer rápido
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
