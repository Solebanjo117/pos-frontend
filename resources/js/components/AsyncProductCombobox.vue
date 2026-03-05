<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Search, X, Loader2, Package } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import apiClient from '@/services/api/client'
import type { Product } from '@/types/product'

interface Props {
    modelValue?: number | null
    placeholder?: string
    warehouseId?: number | null
    disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Buscar producto por SKU o nombre...',
    disabled: false,
})

const emit = defineEmits<{
    (e: 'update:modelValue', value: number | null): void
    (e: 'select', product: Product): void
}>()

const searchQuery = ref('')
const isLoading = ref(false)
const isOpen = ref(false)
const products = ref<Product[]>([])
const selectedProduct = ref<Product | null>(null)
const inputRef = ref<HTMLInputElement>()

// Debounced search function
const searchProducts = useDebounceFn(async (query: string) => {
    if (!query || query.length < 2) {
        products.value = []
        return
    }

    isLoading.value = true
    try {
        const params: any = {
            search: query,
            per_page: 10,
        }
        
        if (props.warehouseId) {
            params.warehouse_id = props.warehouseId
        }

        const { data } = await apiClient.get('/products', { params })
        products.value = data.data || []
        isOpen.value = true
    } catch (error) {
        console.error('Error searching products:', error)
        products.value = []
    } finally {
        isLoading.value = false
    }
}, 300)

// Watch search query
watch(searchQuery, (newValue) => {
    if (newValue) {
        searchProducts(newValue)
    } else {
        products.value = []
        isOpen.value = false
    }
})

// Handle product selection
function selectProduct(product: Product) {
    selectedProduct.value = product
    searchQuery.value = `${product.sku_base} - ${product.name}`
    isOpen.value = false
    emit('update:modelValue', product.id)
    emit('select', product)
}

// Clear selection
function clearSelection() {
    selectedProduct.value = null
    searchQuery.value = ''
    products.value = []
    emit('update:modelValue', null)
    inputRef.value?.focus()
}

// Load selected product if modelValue is provided
async function loadSelectedProduct(productId: number) {
    try {
        const { data } = await apiClient.get(`/products/${productId}`)
        const product = data.data
        selectedProduct.value = product
        searchQuery.value = `${product.sku_base} - ${product.name}`
    } catch (error) {
        console.error('Error loading product:', error)
    }
}

// Watch for external modelValue changes
watch(() => props.modelValue, (newValue) => {
    if (newValue && !selectedProduct.value) {
        loadSelectedProduct(newValue)
    } else if (!newValue) {
        clearSelection()
    }
}, { immediate: true })

// Click outside to close
function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (!target.closest('.async-product-combobox')) {
        isOpen.value = false
    }
}

// Keyboard navigation
const highlightedIndex = ref(-1)

function handleKeydown(event: KeyboardEvent) {
    if (!isOpen.value || products.value.length === 0) return

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault()
            highlightedIndex.value = Math.min(highlightedIndex.value + 1, products.value.length - 1)
            break
        case 'ArrowUp':
            event.preventDefault()
            highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
            break
        case 'Enter':
            event.preventDefault()
            if (highlightedIndex.value >= 0) {
                selectProduct(products.value[highlightedIndex.value])
            }
            break
        case 'Escape':
            event.preventDefault()
            isOpen.value = false
            break
    }
}

// Reset highlighted index when search changes
watch(products, () => {
    highlightedIndex.value = -1
})

// Mount/unmount click outside listener
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
    <div class="async-product-combobox relative">
        <div class="relative">
            <Search class="absolute left-3 top-2.5 text-gray-400 pointer-events-none" :size="18" />
            <input
                ref="inputRef"
                v-model="searchQuery"
                type="text"
                :placeholder="placeholder"
                :disabled="disabled"
                class="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                @keydown="handleKeydown"
                @focus="() => { if (searchQuery && products.length > 0) isOpen = true }"
            />
            
            <!-- Loading spinner or clear button -->
            <div class="absolute right-3 top-2.5">
                <Loader2 v-if="isLoading" class="animate-spin text-gray-400" :size="18" />
                <button
                    v-else-if="searchQuery"
                    type="button"
                    @click="clearSelection"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                    <X :size="18" />
                </button>
            </div>
        </div>

        <!-- Dropdown Results -->
        <div
            v-if="isOpen && products.length > 0"
            class="absolute z-50 w-full mt-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
            <button
                v-for="(product, index) in products"
                :key="product.id"
                type="button"
                @click="selectProduct(product)"
                @mouseenter="highlightedIndex = index"
                class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-muted/50 transition flex items-start gap-3 border-b border-gray-100 dark:border-border last:border-0"
                :class="{
                    'bg-indigo-50 dark:bg-indigo-900/20': highlightedIndex === index
                }"
            >
                <Package class="mt-1 text-gray-400 flex-shrink-0" :size="18" />
                <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                        <span class="font-medium text-gray-900 dark:text-white">{{ product.sku_base }}</span>
                        <span class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ product.name }}</span>
                    </div>
                    <div class="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span v-if="product.category">{{ product.category.name }}</span>
                        <span v-if="product.product_line">{{ product.product_line.name }}</span>
                    </div>
                </div>
            </button>
        </div>

        <!-- No Results -->
        <div
            v-if="isOpen && !isLoading && searchQuery && products.length === 0"
            class="absolute z-50 w-full mt-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400"
        >
            No se encontraron productos
        </div>
    </div>
</template>
