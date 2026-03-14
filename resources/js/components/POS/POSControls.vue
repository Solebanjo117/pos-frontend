<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { Search } from 'lucide-vue-next'

interface Category { id: number; name: string }
interface Brand { id: number; name: string }

const props = defineProps<{
  categories?: Category[]
  brands?: Brand[]
}>()

const emit = defineEmits([
  'search',
  'filter-category',
  'filter-brand',
])

const query = ref('')
const quantity = ref(1)
const selectedCategory = ref<number | ''>('')
const selectedBrand = ref<number | ''>('')

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

  emit('search', {
    query: trimmed,
    quantity: quantity.value,
    category_id: selectedCategory.value || undefined,
    brand_id: selectedBrand.value || undefined,
  })
}

const handleCategoryChange = () => {
  emit('filter-category', selectedCategory.value || undefined)
}

const handleBrandChange = () => {
  emit('filter-brand', selectedBrand.value || undefined)
}

// Expose focus method so parent can call it after adding items
const focus = () => {
  nextTick(() => searchInputRef.value?.focus())
}

defineExpose({ focus })
</script>

<template>
  <div class="bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-gray-100 dark:border-border">
    <!-- Single Row: Search Bar + Category/Brand Dropdowns + Qty + Buscar -->
    <div class="flex flex-col md:flex-row items-stretch gap-3">
      <!-- Search Bar -->
      <div class="relative flex-1 w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref="searchInputRef"
          v-model="query"
          @keyup.enter="handleSearch"
          type="text"
          placeholder="SKU, nombre, vehículo, motor… (Enter para buscar)"
          class="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-shadow h-10"
        />
      </div>

      <!-- Category / Brand Dropdowns -->
      <div class="flex gap-2 w-full md:w-auto">
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

      <!-- Quantity Input + Buscar Button -->
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
  </div>
</template>
