<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Product } from '@/types/product'
import ProductCard from './ProductCard.vue'
import CatalogFilters from './CatalogFilters.vue'
import ProductDetailModal from './ProductDetailModal.vue'

interface CatalogFilterState {
    categories: string[]
    priceRange: [number, number]
    availability: 'all' | 'in-stock' | 'out-of-stock'
    brands: string[]
}

interface Props {
    products: Product[]
    loading: boolean
}

const props = defineProps<Props>()

// Local state
const catalogViewMode = ref<'grid' | 'list'>('grid')
const selectedProduct = ref<Product | null>(null)
const searchQuery = ref('')
const catalogFilters = ref<CatalogFilterState>({
    categories: [],
    priceRange: [0, 50000],
    availability: 'all',
    brands: [],
})

// Extract unique categories and brands from products
const availableCategories = computed(() => {
    const cats = new Map<number, string>()
    props.products.forEach(p => {
        if (p.category) cats.set(p.category.id, p.category.name)
    })
    return Array.from(cats, ([id, name]) => ({ id, name }))
})

const availableBrands = computed(() => {
    const brandMap = new Map<number, string>()
    props.products.forEach(p => {
        p.variants?.forEach(v => {
            if (v.brand) brandMap.set(v.brand.id, v.brand.name)
        })
        if (p.default_variant?.brand) {
            brandMap.set(p.default_variant.brand.id, p.default_variant.brand.name)
        }
    })
    return Array.from(brandMap, ([id, name]) => ({ id, name }))
})

// Filter products locally
const filteredProducts = computed(() => {
    return props.products.filter(product => {
        // Text search
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase()
            const matchesName = product.name.toLowerCase().includes(q)
            const matchesSku = product.sku_base?.toLowerCase().includes(q)
            const matchesVariantSku = product.variants?.some(v => v.sku?.toLowerCase().includes(q))
            const matchesSpecs = product.key_attributes?.some(a =>
                `${a.name} ${a.value} ${a.unit ?? ''}`.toLowerCase().includes(q)
            ) ?? false
            if (!matchesName && !matchesSku && !matchesVariantSku && !matchesSpecs) return false
        }

        // Category filter
        if (catalogFilters.value.categories.length > 0) {
            if (!product.category || !catalogFilters.value.categories.includes(product.category.name)) return false
        }

        // Availability filter
        const stock = product.total_stock ?? 0
        if (catalogFilters.value.availability === 'in-stock' && stock <= 0) return false
        if (catalogFilters.value.availability === 'out-of-stock' && stock > 0) return false

        // Brand filter
        if (catalogFilters.value.brands.length > 0) {
            const productBrands = product.variants?.map(v => v.brand?.name).filter(Boolean) ?? []
            if (product.default_variant?.brand) productBrands.push(product.default_variant.brand.name)
            const hasMatch = catalogFilters.value.brands.some(b => productBrands.includes(b))
            if (!hasMatch) return false
        }

        return true
    })
})

const selectProduct = (product: Product) => {
    selectedProduct.value = product
}

const closeDetail = () => {
    selectedProduct.value = null
}
</script>

<template>
    <div>
        <!-- Catalog Header: Search + View Toggle -->
        <div class="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
            <div class="flex items-center gap-4">
                <!-- Search -->
                <div class="flex-1 relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input v-model="searchQuery" type="text"
                        placeholder="Buscar por código, nombre o SKU..."
                        class="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white dark:placeholder-gray-400" />
                </div>

                <!-- Grid/List toggle -->
                <div class="flex rounded-lg border border-gray-200 dark:border-border overflow-hidden">
                    <button @click="catalogViewMode = 'grid'" :class="[
                        catalogViewMode === 'grid'
                            ? 'bg-blue-600 dark:bg-primary dark:text-primary-foreground text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-card dark:text-gray-400 dark:hover:bg-muted/50'
                    ]" class="p-2.5 transition-colors">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                    </button>
                    <button @click="catalogViewMode = 'list'" :class="[
                        catalogViewMode === 'list'
                            ? 'bg-blue-600 dark:bg-primary dark:text-primary-foreground text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-card dark:text-gray-400 dark:hover:bg-muted/50'
                    ]" class="p-2.5 transition-colors border-l border-gray-200 dark:border-border">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Results count -->
            <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {{ filteredProducts.length }} producto{{ filteredProducts.length !== 1 ? 's' : '' }}
                encontrado{{ filteredProducts.length !== 1 ? 's' : '' }}
            </p>
        </div>

        <!-- Main Content: Sidebar + Grid -->
        <div class="flex gap-6">
            <!-- Sidebar Filters -->
            <aside class="w-64 flex-shrink-0 hidden lg:block">
                <CatalogFilters :filters="catalogFilters" :available-categories="availableCategories"
                    :available-brands="availableBrands" @update:filters="catalogFilters = $event" />
            </aside>

            <!-- Product Grid/List -->
            <main class="flex-1">
                <!-- Loading -->
                <div v-if="loading" class="text-center py-16">
                    <div
                        class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent">
                    </div>
                    <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Cargando catálogo...</p>
                </div>

                <!-- Empty State -->
                <div v-else-if="filteredProducts.length === 0" class="text-center py-16">
                    <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p class="mt-3 text-gray-500 dark:text-gray-400">No se encontraron productos con los filtros
                        seleccionados</p>
                </div>

                <!-- Products -->
                <div v-else :class="[
                    catalogViewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
                        : 'flex flex-col gap-4'
                ]">
                    <ProductCard v-for="product in filteredProducts" :key="product.id" :product="product"
                        :view-mode="catalogViewMode" @select="selectProduct" />
                </div>
            </main>
        </div>

        <!-- Product Detail Modal -->
        <ProductDetailModal v-if="selectedProduct" :product="selectedProduct" @close="closeDetail" @view-alternative="(p: any) => selectedProduct = p" />
    </div>
</template>
