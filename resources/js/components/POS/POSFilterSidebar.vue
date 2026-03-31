<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Tag, Layers } from 'lucide-vue-next'

interface Category { id: number; name: string }
interface Brand { id: number; name: string }

const props = defineProps<{
  categories: Category[]
  brands: Brand[]
  selectedCategoryId?: number
  selectedBrandId?: number
}>()

const emit = defineEmits<{
  (e: 'filter', filters: { category_id?: number; brand_id?: number }): void
  (e: 'close'): void
}>()

const localCategoryId = ref<number | undefined>(props.selectedCategoryId)
const localBrandId = ref<number | undefined>(props.selectedBrandId)

// Sync from parent
watch(() => props.selectedCategoryId, (v) => { localCategoryId.value = v })
watch(() => props.selectedBrandId, (v) => { localBrandId.value = v })

const selectCategory = (id: number | undefined) => {
  localCategoryId.value = localCategoryId.value === id ? undefined : id
  emitFilter()
}

const selectBrand = (id: number | undefined) => {
  localBrandId.value = localBrandId.value === id ? undefined : id
  emitFilter()
}

const emitFilter = () => {
  emit('filter', {
    category_id: localCategoryId.value,
    brand_id: localBrandId.value,
  })
}

const clearAll = () => {
  localCategoryId.value = undefined
  localBrandId.value = undefined
  emitFilter()
}

const hasActiveFilters = () => localCategoryId.value || localBrandId.value
</script>

<template>
  <aside class="w-56 shrink-0 flex flex-col bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border overflow-hidden h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-border">
      <h3 class="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
        <Layers class="w-4 h-4 text-indigo-500" />
        Filtros
      </h3>
      <div class="flex items-center gap-1">
        <button
          v-if="hasActiveFilters()"
          @click="clearAll"
          class="text-[10px] text-red-500 hover:text-red-700 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          Limpiar
        </button>
        <button
          @click="emit('close')"
          class="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-muted transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto p-3 space-y-5">
      <!-- Categories -->
      <div>
        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Layers class="w-3 h-3" />
          Categorías
        </h4>
        <div class="space-y-0.5 max-h-52 overflow-y-auto pr-1">
          <button
            v-for="cat in categories"
            :key="cat.id"
            @click="selectCategory(cat.id)"
            class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-all flex items-center gap-2"
            :class="localCategoryId === cat.id
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0 transition-colors"
              :class="localCategoryId === cat.id ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'"
            ></span>
            <span class="truncate">{{ cat.name }}</span>
          </button>
          <p v-if="categories.length === 0" class="text-[11px] text-gray-400 italic px-2">
            Sin categorías
          </p>
        </div>
      </div>

      <!-- Brands -->
      <div>
        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Tag class="w-3 h-3" />
          Marcas
        </h4>
        <div class="space-y-0.5 max-h-52 overflow-y-auto pr-1">
          <button
            v-for="brand in brands"
            :key="brand.id"
            @click="selectBrand(brand.id)"
            class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-all flex items-center gap-2"
            :class="localBrandId === brand.id
              ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-semibold ring-1 ring-purple-200 dark:ring-purple-800'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0 transition-colors"
              :class="localBrandId === brand.id ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'"
            ></span>
            <span class="truncate">{{ brand.name }}</span>
          </button>
          <p v-if="brands.length === 0" class="text-[11px] text-gray-400 italic px-2">
            Sin marcas
          </p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-3 py-2 border-t border-gray-100 dark:border-border">
      <p class="text-[10px] text-gray-400 text-center">
        Selecciona para filtrar la búsqueda
      </p>
    </div>
  </aside>
</template>
