<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { Search, Car, Package, Filter } from 'lucide-vue-next'

interface Category { id: number; name: string }
interface Brand { id: number; name: string }

const props = defineProps<{
  categories?: Category[]
  brands?: Brand[]
}>()

const emit = defineEmits([
  'search',
  'search-vehicle',
  'filter-category',
  'filter-brand',
])

// Search mode: 'product' or 'vehicle'
const searchMode = ref<'product' | 'vehicle'>('product')
const query = ref('')
const quantity = ref(1)
const selectedCategory = ref<number | ''>('')
const selectedBrand = ref<number | ''>('')

// Quick filter categories (pre-defined common categories the client wants one-click access to)
const quickFilters = [
  { label: 'Filtro de aire', search: 'filtro de aire' },
  { label: 'Filtro de cabina', search: 'filtro de cabina' },
  { label: 'Filtro de transmisión', search: 'filtro de transmision' },
]

// Ref for the search input element — used for persistent auto-focus
const searchInputRef = ref<HTMLInputElement>()

// Enforce minimum quantity of 1
watch(quantity, (val) => {
  if (val < 1 || !val) {
    quantity.value = 1
  }
})

// Auto-focus on mount
onMounted(() => {
  nextTick(() => searchInputRef.value?.focus())
})

const handleSearch = () => {
  const trimmed = query.value.trim()
  if (!trimmed) return

  if (searchMode.value === 'vehicle') {
    emit('search-vehicle', {
      query: trimmed,
      quantity: quantity.value,
    })
  } else {
    emit('search', {
      query: trimmed,
      quantity: quantity.value,
      category_id: selectedCategory.value || undefined,
      brand_id: selectedBrand.value || undefined,
    })
  }
}

const handleQuickFilter = (filterSearch: string) => {
  query.value = filterSearch
  emit('search', {
    query: filterSearch,
    quantity: quantity.value,
  })
  // Return focus after quick filter
  nextTick(() => searchInputRef.value?.focus())
}

const handleCategoryChange = () => {
  emit('filter-category', selectedCategory.value || undefined)
}

const handleBrandChange = () => {
  emit('filter-brand', selectedBrand.value || undefined)
}

const toggleSearchMode = () => {
  searchMode.value = searchMode.value === 'product' ? 'vehicle' : 'product'
  query.value = ''
  nextTick(() => searchInputRef.value?.focus())
}

// Expose focus method so parent can call it after adding items
const focus = () => {
  nextTick(() => searchInputRef.value?.focus())
}

defineExpose({ focus })
</script>

<template>
  <div class="bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-gray-100 dark:border-border space-y-3">
    <!-- Row 1: Search Mode Toggle + Search Bar + Qty + Button -->
    <div class="flex flex-col md:flex-row items-stretch gap-3">
      <!-- Mode Toggle Button -->
      <button
        @click="toggleSearchMode"
        class="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all h-10"
        :class="searchMode === 'vehicle'
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
          : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700/50 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'"
        :title="searchMode === 'vehicle' ? 'Cambiar a búsqueda por artículo' : 'Cambiar a búsqueda por vehículo'"
      >
        <component :is="searchMode === 'vehicle' ? Car : Package" class="w-4 h-4" />
        <span class="hidden sm:inline">{{ searchMode === 'vehicle' ? 'Vehículo' : 'Artículo' }}</span>
      </button>

      <!-- Search Bar -->
      <div class="relative flex-1 w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref="searchInputRef"
          v-model="query"
          @keyup.enter="handleSearch"
          type="text"
          :placeholder="searchMode === 'vehicle'
            ? 'VIN, marca o modelo del vehículo… (Enter para buscar)'
            : 'SKU, nombre o código de barras… (Enter para buscar/agregar)'"
          class="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-shadow h-10"
        />
      </div>

      <!-- Category / Brand Dropdowns (Only in Article mode) -->
      <div v-if="searchMode === 'product'" class="flex gap-2 w-full md:w-auto">
        <select
          v-model="selectedCategory"
          @change="handleCategoryChange"
          class="flex-1 px-3 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-xs text-gray-600 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-10"
        >
          <option value="">Todas las Categorías</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
        <select
          v-model="selectedBrand"
          @change="handleBrandChange"
          class="flex-1 px-3 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-xs text-gray-600 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-10"
        >
          <option value="">Todas las Marcas</option>
          <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>

      <!-- Quantity Input -->
      <div class="flex items-end gap-2 shrink-0">
        <div class="w-16">
          <input
            v-model.number="quantity"
            type="number"
            min="1"
            class="w-full px-2 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 h-10 text-sm dark:text-foreground"
            placeholder="Qty"
          />
        </div>
        <button
          @click="handleSearch"
          class="h-10 px-4 bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:hover:bg-muted/80 text-gray-700 dark:text-foreground font-medium rounded-lg transition-colors border border-gray-200 dark:border-border text-sm whitespace-nowrap"
        >
          Buscar
        </button>
      </div>
    </div>

    <!-- Row 2: Quick Filters (only in Article mode) -->
    <div v-if="searchMode === 'product'" class="flex items-center gap-2 flex-wrap">
      <Filter class="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span class="text-xs text-gray-400 font-medium shrink-0">Rápido:</span>
      <button
        v-for="qf in quickFilters"
        :key="qf.search"
        @click="handleQuickFilter(qf.search)"
        class="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-muted hover:bg-indigo-100 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-400 text-gray-600 dark:text-gray-300 rounded-full border border-gray-200 dark:border-border hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-all"
      >
        {{ qf.label }}
      </button>
    </div>
  </div>
</template>
