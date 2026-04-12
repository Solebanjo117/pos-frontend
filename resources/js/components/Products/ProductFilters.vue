<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { X, Layers, Tag, DollarSign, Search, Package, RotateCcw } from 'lucide-vue-next'

interface Category { id: number; name: string }
interface Brand { id: number; name: string }

export interface ProductFilterValues {
  sku?: string
  category_ids: number[]
  brand_ids: number[]
  min_price?: number | undefined
  max_price?: number | undefined
  in_stock: boolean
}

const props = withDefaults(defineProps<{
  modelValue: ProductFilterValues
  categories: Category[]
  brands: Brand[]
  collapsible?: boolean
}>(), {
  collapsible: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: ProductFilterValues): void
  (e: 'close'): void
}>()

// Local deep copy of filters (use JSON for safe deep-clone, unwrapping Vue proxies)
const local = ref<ProductFilterValues>(JSON.parse(JSON.stringify(props.modelValue)))

// Sync from parent when the full modelValue changes identity
watch(() => props.modelValue, (v) => {
  local.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

// Debounce timer for text/number inputs
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const emitDebounced = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit('update:modelValue', { ...local.value })
  }, 400)
}

const emitImmediate = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  emit('update:modelValue', { ...local.value })
}

// Category multi-select
const toggleCategory = (id: number) => {
  const idx = local.value.category_ids.indexOf(id)
  if (idx >= 0) {
    local.value.category_ids.splice(idx, 1)
  } else {
    local.value.category_ids.push(id)
  }
  emitImmediate()
}

// Brand multi-select
const toggleBrand = (id: number) => {
  const idx = local.value.brand_ids.indexOf(id)
  if (idx >= 0) {
    local.value.brand_ids.splice(idx, 1)
  } else {
    local.value.brand_ids.push(id)
  }
  emitImmediate()
}

const activeFilterCount = computed(() => {
  let count = 0
  if (local.value.sku) count++
  if (local.value.category_ids.length > 0) count++
  if (local.value.brand_ids.length > 0) count++
  if (local.value.min_price != null) count++
  if (local.value.max_price != null) count++
  if (local.value.in_stock) count++
  return count
})

const clearFilters = () => {
  local.value = {
    sku: '',
    category_ids: [],
    brand_ids: [],
    min_price: undefined,
    max_price: undefined,
    in_stock: false,
  }
  emitImmediate()
}

// Category search for long lists
const categorySearch = ref('')
const filteredCategories = computed(() => {
  const q = categorySearch.value.trim().toLowerCase()
  if (!q) return props.categories
  return props.categories.filter(c => c.name.toLowerCase().includes(q))
})

// Brand search for long lists
const brandSearch = ref('')
const filteredBrands = computed(() => {
  const q = brandSearch.value.trim().toLowerCase()
  if (!q) return props.brands
  return props.brands.filter(b => b.name.toLowerCase().includes(q))
})
</script>

<template>
  <aside class="w-60 shrink-0 flex flex-col bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border overflow-hidden h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-border">
      <h3 class="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
        <Layers class="w-4 h-4 text-indigo-500" />
        Filtros
        <span
          v-if="activeFilterCount > 0"
          class="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold"
        >
          {{ activeFilterCount }}
        </span>
      </h3>
      <div class="flex items-center gap-1">
        <button
          v-if="activeFilterCount > 0"
          @click="clearFilters"
          class="text-[10px] text-red-500 hover:text-red-700 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-0.5"
        >
          <RotateCcw class="w-3 h-3" />
          Limpiar
        </button>
        <button
          v-if="collapsible"
          @click="emit('close')"
          class="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-muted transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto p-3 space-y-5">

      <!-- SKU Filter -->
      <div>
        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Search class="w-3 h-3" />
          SKU
        </h4>
        <input
          v-model="local.sku"
          @input="emitDebounced"
          type="text"
          placeholder="Buscar por código..."
          class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-700 dark:text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow"
        />
      </div>

      <!-- Categories -->
      <div>
        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Layers class="w-3 h-3" />
          Categorías
          <span v-if="local.category_ids.length" class="text-indigo-500">({{ local.category_ids.length }})</span>
        </h4>
        <!-- Mini search for categories -->
        <input
          v-if="categories.length > 6"
          v-model="categorySearch"
          type="text"
          placeholder="Buscar categoría..."
          class="w-full px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-600 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-1.5"
        />
        <div class="space-y-0.5 max-h-44 overflow-y-auto pr-1">
          <label
            v-for="cat in filteredCategories"
            :key="cat.id"
            class="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer transition-all"
            :class="local.category_ids.includes(cat.id)
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'"
          >
            <input
              type="checkbox"
              :checked="local.category_ids.includes(cat.id)"
              @change="toggleCategory(cat.id)"
              class="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span class="truncate">{{ cat.name }}</span>
          </label>
          <p v-if="filteredCategories.length === 0" class="text-[11px] text-gray-400 italic px-2">
            {{ categorySearch ? 'Sin resultados' : 'Sin categorías' }}
          </p>
        </div>
      </div>

      <!-- Brands -->
      <div>
        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Tag class="w-3 h-3" />
          Marcas
          <span v-if="local.brand_ids.length" class="text-purple-500">({{ local.brand_ids.length }})</span>
        </h4>
        <!-- Mini search for brands -->
        <input
          v-if="brands.length > 6"
          v-model="brandSearch"
          type="text"
          placeholder="Buscar marca..."
          class="w-full px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-600 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 mb-1.5"
        />
        <div class="space-y-0.5 max-h-44 overflow-y-auto pr-1">
          <label
            v-for="brand in filteredBrands"
            :key="brand.id"
            class="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer transition-all"
            :class="local.brand_ids.includes(brand.id)
              ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-semibold'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'"
          >
            <input
              type="checkbox"
              :checked="local.brand_ids.includes(brand.id)"
              @change="toggleBrand(brand.id)"
              class="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <span class="truncate">{{ brand.name }}</span>
          </label>
          <p v-if="filteredBrands.length === 0" class="text-[11px] text-gray-400 italic px-2">
            {{ brandSearch ? 'Sin resultados' : 'Sin marcas' }}
          </p>
        </div>
      </div>

      <!-- Price Range -->
      <div>
        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <DollarSign class="w-3 h-3" />
          Precio
        </h4>
        <div class="flex gap-2">
          <input
            v-model.number="local.min_price"
            @input="emitDebounced"
            type="number"
            placeholder="Min"
            min="0"
            step="0.01"
            class="w-1/2 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-700 dark:text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <input
            v-model.number="local.max_price"
            @input="emitDebounced"
            type="number"
            placeholder="Max"
            min="0"
            step="0.01"
            class="w-1/2 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-700 dark:text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <!-- In Stock Toggle -->
      <label class="flex items-center gap-2 px-1 cursor-pointer group">
        <input
          type="checkbox"
          v-model="local.in_stock"
          @change="emitImmediate"
          class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
        />
        <div class="flex items-center gap-1">
          <Package class="w-3.5 h-3.5 text-emerald-500" />
          <span class="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Solo con stock</span>
        </div>
      </label>
    </div>

    <!-- Footer -->
    <div class="px-3 py-2 border-t border-gray-100 dark:border-border">
      <p class="text-[10px] text-gray-400 text-center">
        Los filtros se aplican automáticamente
      </p>
    </div>
  </aside>
</template>
