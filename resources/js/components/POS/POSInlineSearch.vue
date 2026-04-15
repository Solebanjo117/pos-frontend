<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import apiClient from '@/services/api/client'
import { formatCurrency } from '@/utils/formatters'
import { Search } from 'lucide-vue-next'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'

interface Category { id: number; name: string }
interface Brand { id: number; name: string }
interface Product {
  id: number
  name: string
  sku_base?: string
  image_url?: string
  category?: { name: string }
  brand?: { name: string }
  pricing?: { base_price: number; calculated_price?: number }
  variants?: any[]
  default_variant?: any
  total_stock?: number
}

const props = defineProps<{
  categories?: Category[]
  brands?: Brand[]
  warehouseId?: number | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'product-selected': [product: Product]
  'product-needs-variant': [product: Product]
  'open-full-search': []
}>()

// State
const searchQuery = ref('')
const selectedCategoryId = ref<number | null>(null)
const selectedBrandId = ref<number | null>(null)
const searchResults = ref<Product[]>([])
const isSearching = ref(false)
const showDropdown = ref(false)
const focusedIndex = ref(-1)
const searchInput = ref<HTMLInputElement | null>(null)

const categoryOptions = computed<SelectOption[]>(() => [
  { value: null, label: 'Todas las categorías' },
  ...((props.categories ?? []).map(cat => ({ value: cat.id, label: cat.name })))
])

const brandOptions = computed<SelectOption[]>(() => [
  { value: null, label: 'Todas las marcas' },
  ...((props.brands ?? []).map(brand => ({ value: brand.id, label: brand.name })))
])

// Search function
const performSearch = async () => {
  const query = searchQuery.value.trim()

  if (query.length < 2) {
    searchResults.value = []
    showDropdown.value = false
    return
  }

  isSearching.value = true
  try {
    const params: any = {
      search: query,
      per_page: 10,
      with: 'variants,pricing,brand,category,default_variant'
    }

    if (selectedCategoryId.value) params.category_id = selectedCategoryId.value
    if (selectedBrandId.value) params.brand_id = selectedBrandId.value
    if (props.warehouseId) params.warehouse_id = props.warehouseId

    const res = await apiClient.get('/products', { params })
    searchResults.value = res.data.data ?? []
    showDropdown.value = searchResults.value.length > 0
    focusedIndex.value = -1
  } catch (e) {
    console.error('Search error:', e)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const debouncedSearch = useDebounceFn(performSearch, 300)

// Watchers
watch(searchQuery, () => {
  debouncedSearch()
})

watch([selectedCategoryId, selectedBrandId], () => {
  if (searchQuery.value.trim().length >= 2) {
    debouncedSearch()
  }
})

// Product selection
const selectProduct = (product: Product) => {
  const variants = product.variants ?? []
  const hasMultipleVariants = variants.length > 1

  if (hasMultipleVariants) {
    emit('product-needs-variant', product)
  } else {
    emit('product-selected', product)
  }

  // Clear and refocus
  searchQuery.value = ''
  searchResults.value = []
  showDropdown.value = false
  focusedIndex.value = -1
  nextTick(() => searchInput.value?.focus())
}

// Keyboard navigation
const onKeyDown = (e: KeyboardEvent) => {
  if (!showDropdown.value || searchResults.value.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, searchResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, -1)
  } else if (e.key === 'Enter' && focusedIndex.value >= 0) {
    e.preventDefault()
    selectProduct(searchResults.value[focusedIndex.value])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    showDropdown.value = false
    focusedIndex.value = -1
  }
}

// Helpers
const getProductPrice = (product: Product): string => {
  const price = product.pricing?.calculated_price ?? product.pricing?.base_price ?? 0
  return formatCurrency(Number(price))
}

const getStockBadge = (product: Product): { text: string; color: string } => {
  const stock = product.total_stock ?? 0
  if (stock > 10) return { text: `${stock} disponibles`, color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' }
  if (stock > 0) return { text: `${stock} disponibles`, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
  return { text: 'Sin stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
}

// Close dropdown when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.inline-search-container')) {
    showDropdown.value = false
    focusedIndex.value = -1
  }
}

// Focus helper
const focusSearch = () => {
  nextTick(() => searchInput.value?.focus())
}

// Expose focus method
defineExpose({ focusSearch })
</script>

<template>
  <div class="inline-search-container relative" @click.outside="handleClickOutside">
    <div class="grid grid-cols-12 gap-3">
      <!-- Search Input (col-6) -->
      <div class="col-span-6 relative">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Buscar productos (F1)..."
            :disabled="disabled"
            @keydown="onKeyDown"
            class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-card text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div v-if="isSearching" class="absolute right-3 top-1/2 -translate-y-1/2">
            <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>

        <!-- Dropdown Results -->
        <div
          v-if="showDropdown && searchResults.length > 0"
          class="absolute z-50 w-full mt-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-xl max-h-96 overflow-y-auto"
        >
          <div
            v-for="(product, idx) in searchResults"
            :key="product.id"
            @click="selectProduct(product)"
            @mouseenter="focusedIndex = idx"
            :class="[
              'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
              focusedIndex === idx
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-muted/30'
            ]"
          >
            <!-- Image -->
            <div class="w-12 h-12 flex-shrink-0 bg-gray-100 dark:bg-muted rounded overflow-hidden">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 dark:text-white truncate">{{ product.name }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                <span v-if="product.category?.name">{{ product.category.name }}</span>
                <span v-if="product.brand?.name || product.default_variant?.brand?.name" class="text-blue-600 dark:text-blue-400">
                  • {{ product.brand?.name || product.default_variant?.brand?.name }}
                </span>
              </div>
            </div>

            <!-- Price & Stock -->
            <div class="flex flex-col items-end gap-1">
              <div class="text-lg font-bold text-green-600 dark:text-green-400">
                {{ getProductPrice(product) }}
              </div>
              <span
                :class="['text-xs px-2 py-0.5 rounded-full font-medium', getStockBadge(product).color]"
              >
                {{ getStockBadge(product).text }}
              </span>
            </div>
          </div>

          <!-- "Search all" link -->
          <div
            @click="emit('open-full-search')"
            class="border-t border-gray-200 dark:border-border px-4 py-3 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer font-medium"
          >
            🔍 Buscar todos los productos
          </div>
        </div>
      </div>

      <!-- Category Filter (col-3) -->
      <div class="col-span-3">
        <SearchableSelect
          v-model="selectedCategoryId"
          :options="categoryOptions"
          :disabled="disabled"
          placeholder="Todas las categorías"
        />
      </div>

      <!-- Brand Filter (col-3) -->
      <div class="col-span-3">
        <SearchableSelect
          v-model="selectedBrandId"
          :options="brandOptions"
          :disabled="disabled"
          placeholder="Todas las marcas"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for dropdown */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: rgb(203 213 225) transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgb(203 213 225);
  border-radius: 3px;
}
</style>
