<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Product } from '@/types/product'
import ProductCard from './ProductCard.vue'
import ProductFiltersComponent from './ProductFilters.vue'
import type { ProductFilterValues } from './ProductFilters.vue'
import ProductDetailModal from './ProductDetailModal.vue'

interface FilterOption {
    id: number
    name: string
}

interface Props {
    products: Product[]
    loading: boolean
    categories?: FilterOption[]
    brands?: FilterOption[]
    currentPage?: number
    lastPage?: number
    total?: number
    pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
    categories: () => [],
    brands: () => [],
    currentPage: 1,
    lastPage: 1,
    total: 0,
    pageSize: 20,
})

const emit = defineEmits<{
    (e: 'prev-page'): void
    (e: 'next-page'): void
}>()

// Local state
const catalogViewMode = ref<'grid' | 'list'>('list')
const selectedProduct = ref<Product | null>(null)
const searchQuery = ref('')
const sidebarFilterValues = ref<ProductFilterValues>({
    sku: '',
    category_ids: [],
    brand_ids: [],
    min_price: undefined,
    max_price: undefined,
    in_stock: false,
})

const handleSidebarFilterChange = (newFilters: ProductFilterValues) => {
    sidebarFilterValues.value = newFilters
}

// Extract unique categories and brands from products
const availableCategories = computed(() => {
    if (props.categories.length > 0) return props.categories

    const cats = new Map<number, string>()
    props.products.forEach(p => {
        if (p.category) cats.set(p.category.id, p.category.name)
    })
    return Array.from(cats, ([id, name]) => ({ id, name }))
})

const availableBrands = computed(() => {
    if (props.brands.length > 0) return props.brands

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

const normalizeQuery = (value?: string) => (value ?? '').trim().toLowerCase()

const searchMatchesProduct = (product: Product, query: string) => {
    const matchesName = product.name.toLowerCase().includes(query)
    const matchesSku = product.sku_base?.toLowerCase().includes(query)
    const matchesAlternateCode = product.alternate_code?.toLowerCase().includes(query)
    const matchesVariantSku = product.variants?.some(v => v.sku?.toLowerCase().includes(query))
    const matchesBrand = product.variants?.some(v => v.brand?.name?.toLowerCase().includes(query))
        || product.default_variant?.brand?.name?.toLowerCase().includes(query)
    const matchesCategory = product.category?.name?.toLowerCase().includes(query)
    const matchesSpecs = product.key_attributes?.some(a =>
        `${a.name} ${a.value} ${a.unit ?? ''}`.toLowerCase().includes(query)
    ) ?? false

    return matchesName || matchesSku || matchesAlternateCode || matchesVariantSku || matchesBrand || matchesCategory || matchesSpecs
}

const getComparablePrice = (product: Product): number | null => {
    const prices = [
        product.pricing?.base_price,
        product.default_variant?.pricing?.base_price,
        ...(product.variants?.map(v => v.pricing?.base_price) ?? []),
    ]
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value >= 0)

    if (prices.length === 0) return null
    return Math.min(...prices)
}

// Filter products locally
const filteredProducts = computed(() => {
    const searchTerms = [
        normalizeQuery(searchQuery.value),
        normalizeQuery(sidebarFilterValues.value.sku),
    ].filter(Boolean)

    return props.products.filter(product => {
        // Text search (header + sidebar search terms must match)
        if (searchTerms.length > 0) {
            const matchesAllTerms = searchTerms.every(query => searchMatchesProduct(product, query))
            if (!matchesAllTerms) return false
        }

        // Category filter
        if (sidebarFilterValues.value.category_ids.length > 0) {
            if (!product.category || !sidebarFilterValues.value.category_ids.includes(product.category.id)) return false
        }

        // Stock filter
        const stock = product.total_stock ?? 0
        if (sidebarFilterValues.value.in_stock && stock <= 0) return false

        // Brand filter
        if (sidebarFilterValues.value.brand_ids.length > 0) {
            const productBrandIds = new Set<number>()
            product.variants?.forEach(v => {
                if (v.brand?.id) productBrandIds.add(v.brand.id)
            })
            if (product.default_variant?.brand?.id) {
                productBrandIds.add(product.default_variant.brand.id)
            }
            const hasMatch = sidebarFilterValues.value.brand_ids.some(id => productBrandIds.has(id))
            if (!hasMatch) return false
        }

        // Price range filter
        const productPrice = getComparablePrice(product)
        if (sidebarFilterValues.value.min_price != null) {
            if (productPrice == null || productPrice < sidebarFilterValues.value.min_price) return false
        }
        if (sidebarFilterValues.value.max_price != null) {
            if (productPrice == null || productPrice > sidebarFilterValues.value.max_price) return false
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

const canGoPrev = computed(() => props.currentPage > 1)
const canGoNext = computed(() => props.currentPage < props.lastPage)
const rangeStart = computed(() => {
    if (props.total <= 0) return 0
    return (props.currentPage - 1) * props.pageSize + 1
})
const rangeEnd = computed(() => {
    if (props.total <= 0) return 0
    return Math.min(props.currentPage * props.pageSize, props.total)
})

const requestPrevPage = () => {
    if (!props.loading && canGoPrev.value) emit('prev-page')
}

const requestNextPage = () => {
    if (!props.loading && canGoNext.value) emit('next-page')
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
                <ProductFiltersComponent
                    :model-value="sidebarFilterValues"
                    @update:model-value="handleSidebarFilterChange"
                    :categories="availableCategories"
                    :brands="availableBrands"
                    :collapsible="false"
                />
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

                <!-- Pagination -->
                <div
                    v-if="!loading && props.total > 0"
                    class="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-border dark:bg-card"
                >
                    <div class="flex flex-1 justify-between sm:hidden">
                        <button
                            @click="requestPrevPage"
                            :disabled="!canGoPrev"
                            class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                        >
                            Anterior
                        </button>
                        <button
                            @click="requestNextPage"
                            :disabled="!canGoNext"
                            class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                        >
                            Siguiente
                        </button>
                    </div>

                    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p class="text-sm text-gray-900 dark:text-white">
                                Mostrando
                                <span class="font-medium">{{ rangeStart }}</span>
                                a
                                <span class="font-medium">{{ rangeEnd }}</span>
                                de
                                <span class="font-medium">{{ props.total }}</span>
                                productos
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <button
                                @click="requestPrevPage"
                                :disabled="!canGoPrev"
                                class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                            >
                                Anterior
                            </button>
                            <span class="flex items-center px-4 text-sm text-gray-900 dark:text-white">
                                Página {{ props.currentPage }} de {{ props.lastPage }}
                            </span>
                            <button
                                @click="requestNextPage"
                                :disabled="!canGoNext"
                                class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- Product Detail Modal -->
        <ProductDetailModal v-if="selectedProduct" :product="selectedProduct" @close="closeDetail" @view-alternative="(p: any) => selectedProduct = p" />
    </div>
</template>
