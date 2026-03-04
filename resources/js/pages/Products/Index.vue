<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import { usePOS } from '@/composables/usePOS'
import type { Product, ProductFilters } from '@/types/product'
import ProductCatalogView from '@/components/Products/ProductCatalogView.vue'
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import { ShoppingCart, Check, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { usePosSettings } from '@/composables/usePosSettings'
import { useCategories } from '@/composables/useCategories'

import { useWarehouses } from '@/composables/useWarehouses'

const { currentWarehouseId, initWarehouse } = usePosSettings()
const { warehouses } = useWarehouses()
const { categories, fetchCategories } = useCategories()

const showAdvancedFilters = ref(false)

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
]

const {
    products,
    loading,
    error,
    currentPage,
    lastPage,
    total,
    fetchProducts,
    deleteProduct,
    restoreProduct,
    nextPage,
    prevPage,
} = useProducts()

const { addToCart, cartItemCount } = usePOS()

// Add variant to cart (builds a product-like object from the variant data)
const addVariantToCart = (product: any, variant: any) => {
    const cartProduct = {
        id: product.id,
        name: `${product.name} - ${variant.brand?.name || ''}`,
        sku_base: variant.sku || product.sku_base,
        pricing: product.pricing,
        default_variant: {
            id: variant.id,
            sku: variant.sku,
            brand: variant.brand,
            pricing: variant.pricing,
        },
    }
    addToCart(cartProduct as any, cartProduct.default_variant as any, 1)
    addedFeedback.value = variant.id
    setTimeout(() => { addedFeedback.value = null }, 1200)
}

const addedFeedback = ref<number | null>(null)

// ========== VIEW MODE TOGGLE ==========
const viewMode = ref<'table' | 'catalog'>('table')

// ========== TABLE VIEW STATE ==========
const filters = ref<ProductFilters>({
    search: '',
    status: undefined,
    brand_id: undefined,
    warehouse_id: currentWarehouseId.value || undefined,
    has_stock: false,
})

// ========== ARCHIVE TAB ==========
const archiveTab = ref<'active' | 'archived'>('active')

const switchArchiveTab = async (tab: 'active' | 'archived') => {
    archiveTab.value = tab
    currentPage.value = 1
    await fetchProducts({ ...filters.value, archived: tab === 'archived' ? 'true' : 'false' })
}

// ========== SORTING STATE ==========
const sortField = ref<string>('created_at')
const sortDirection = ref<'asc' | 'desc'>('desc')

const toggleSort = async (field: string) => {
    if (sortField.value === field) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
        sortField.value = field
        sortDirection.value = 'asc'
    }
    currentPage.value = 1
    await fetchProducts({
        ...filters.value,
        archived: archiveTab.value === 'archived' ? 'true' : 'false',
        sortField: sortField.value,
        sortDirection: sortDirection.value,
    })
}

// ========== ARCHIVE / RESTORE ACTIONS ==========
const archiveProduct = async (product: Product) => {
    if (!confirm(`¿Desea archivar "${product.name}"? Desaparecerá del Punto de Venta, pero las facturas históricas lo conservarán.`)) return
    try {
        await deleteProduct(product.id)
    } catch (e) {}
}

const handleRestore = async (product: Product) => {
    if (!confirm(`¿Desea restaurar "${product.name}"? Volverá a estar disponible en el sistema.`)) return
    try {
        await restoreProduct(product.id)
    } catch (e) {}
}

const expandedRows = ref<Set<number>>(new Set())
const selectedProduct = ref<Product | null>(null)

const openDetail = (product: Product) => {
    selectedProduct.value = product
}
const closeDetail = () => {
    selectedProduct.value = null
}

const toggleRow = (productId: number) => {
    if (expandedRows.value.has(productId)) {
        expandedRows.value.delete(productId)
    } else {
        expandedRows.value.add(productId)
    }
}

// ── Active deep-link filter badge (for UI banner display) ────────────────────
const activeDeepLinkFilters = computed(() => {
    const tags: { label: string; key: keyof typeof filters.value }[] = []
    if (filters.value.vin)             tags.push({ label: `VIN: ${filters.value.vin}`, key: 'vin' })
    if (filters.value.oem_code)        tags.push({ label: `OEM: ${filters.value.oem_code}`, key: 'oem_code' })
    if (filters.value.attribute_value) tags.push({ label: `Especificación: ${filters.value.attribute_value.replace(':', ' = ')}`, key: 'attribute_value' })
    if (filters.value.category_id)     tags.push({ label: `Categoría #${filters.value.category_id}`, key: 'category_id' })
    if (filters.value.brand_id)        tags.push({ label: `Marca #${filters.value.brand_id}`, key: 'brand_id' })
    if (filters.value.product_line_id) tags.push({ label: `Línea #${filters.value.product_line_id}`, key: 'product_line_id' })
    return tags
})

const removeDeepLinkFilter = async (key: keyof typeof filters.value) => {
    (filters.value as any)[key] = undefined
    await fetchProducts(filters.value)
}

// Fetch products on mount — read any URL query params for deep linking
onMounted(async () => {
    await initWarehouse()
    await fetchCategories()
    const params = new URLSearchParams(window.location.search)
    if (params.has('search'))          filters.value.search            = params.get('search') ?? ''
    if (params.has('attribute_value')) filters.value.attribute_value   = params.get('attribute_value') ?? undefined
    if (params.has('oem_code'))        filters.value.oem_code          = params.get('oem_code') ?? undefined
    if (params.has('vin'))             filters.value.vin               = params.get('vin') ?? undefined
    if (params.has('brand_id'))        filters.value.brand_id          = Number(params.get('brand_id')) || undefined
    if (params.has('category_id'))     filters.value.category_id       = Number(params.get('category_id')) || undefined
    if (params.has('product_line_id')) filters.value.product_line_id   = Number(params.get('product_line_id')) || undefined
    filters.value.warehouse_id = currentWarehouseId.value || undefined
    await fetchProducts(filters.value)
})

// Watch warehouse changes
watch(currentWarehouseId, (newId) => {
    if (filters.value.warehouse_id !== newId) {
        filters.value.warehouse_id = newId || undefined
        fetchProducts(filters.value)
    }
})

const applyFilters = async () => {
    currentPage.value = 1
    await fetchProducts({
        ...filters.value,
        archived: archiveTab.value === 'archived' ? 'true' : 'false',
        sortField: sortField.value,
        sortDirection: sortDirection.value,
    })
}

const clearFilters = () => {
    filters.value = {
        search: '',
        status: undefined,
        brand_id: undefined,
        warehouse_id: currentWarehouseId.value || undefined,
        has_stock: false,
    }
    sortField.value = 'created_at'
    sortDirection.value = 'desc'
    applyFilters()
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value)
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'active':
            return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'
        case 'discontinued':
            return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
        case 'pending':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400'
        default:
            return 'bg-gray-100 text-gray-800'
    }
}

// Helper to get a safe array of variants for a product
const getVariants = (product: any) => {
    if (product.variants?.length) return product.variants
    if (product.default_variant) return [product.default_variant]
    return []
}
</script>

<template>
    <Head title="Productos" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- ========== PAGE HEADER with View Toggle ========== -->
            <div class="mb-6 flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Productos</h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {{ viewMode === 'table' ? 'Gestiona el catálogo de productos del sistema' : 'Explora el catálogo de productos' }}
                    </p>
                </div>

                <div class="flex items-center gap-4">
                    <!-- View Toggle Switch -->
                    <div class="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
                        <button @click="viewMode = 'table'" :class="[
                            viewMode === 'table'
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        ]" class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200">
                            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M3 10h18M3 14h18M3 18h18M3 6h18" />
                            </svg>
                            Tabla
                        </button>
                        <button @click="viewMode = 'catalog'" :class="[
                            viewMode === 'catalog'
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        ]" class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200">
                            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Catálogo
                        </button>
                    </div>

                    <!-- Cart Indicator -->
                    <a v-if="cartItemCount > 0" href="/pos"
                        class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition-colors relative">
                        <ShoppingCart class="w-4 h-4 mr-1" /> Carrito
                        <span class="bg-white text-green-700 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{{ cartItemCount }}</span>
                    </a>

                    <!-- New Product Button -->
                    <a href="/products/create"
                        class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 4v16m8-8H4" />
                        </svg>
                        Nuevo Producto
                    </a>
                </div>
            </div>

            <!-- ========== CATALOG VIEW ========== -->
            <ProductCatalogView v-if="viewMode === 'catalog'" :products="products" :loading="loading" />

            <!-- ========== TABLE VIEW ========== -->
            <template v-else>
                <!-- Archive Tabs -->
                <div class="mb-4 flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800 w-fit">
                    <button @click="switchArchiveTab('active')"
                        :class="[
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                            archiveTab === 'active'
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        ]">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                        Activos
                    </button>
                    <button @click="switchArchiveTab('archived')"
                        :class="[
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                            archiveTab === 'archived'
                                ? 'bg-amber-50 text-amber-800 shadow-sm dark:bg-amber-900/30 dark:text-amber-300'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        ]">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
                        Archivados
                    </button>
                </div>

                <!-- Archived Banner -->
                <div v-if="archiveTab === 'archived'" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <p class="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Estás viendo productos archivados. Estos productos no aparecen en el Punto de Venta pero las facturas históricas los conservan.
                    </p>
                </div>
                <!-- Filters -->
                <div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 dark:shadow-gray-900/50">
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div>
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Buscar
                            </label>
                            <input v-model="filters.search" type="text" placeholder="SKU o nombre..."
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                @keyup.enter="applyFilters" />
                        </div>

                        <div>
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Estado
                            </label>
                            <select v-model="filters.status"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                                <option :value="undefined">Todos</option>
                                <option value="active">Activo</option>
                                <option value="discontinued">Discontinuado</option>
                                <option value="pending">Pendiente</option>
                            </select>
                        </div>

                         <!-- Warehouse Filter -->
                         <div>
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Almacén
                            </label>
                            <select v-model="filters.warehouse_id"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                                <option :value="undefined">Todos</option>
                                <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                            </select>
                        </div>

                        <div class="flex items-end">
                            <label class="flex items-center">
                                <input v-model="filters.has_stock" type="checkbox"
                                    class="mr-2 rounded border-gray-300 dark:border-gray-600" />
                                <span class="text-sm text-gray-900 dark:text-gray-100">Solo con stock</span>
                            </label>
                        </div>

                        <div class="flex items-end gap-2">
                            <button @click="applyFilters"
                                class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                                Filtrar
                            </button>
                            <button @click="clearFilters"
                                class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-offset-gray-800">
                                Limpiar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Advanced Filters Toggle & Panel -->
                <div class="mb-6">
                    <button @click="showAdvancedFilters = !showAdvancedFilters"
                        class="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                        <component :is="showAdvancedFilters ? ChevronUp : ChevronDown" class="h-4 w-4" />
                        {{ showAdvancedFilters ? 'Ocultar' : 'Mostrar' }} Filtros Avanzados
                    </button>

                    <transition name="slide">
                        <div v-if="showAdvancedFilters"
                            class="mt-3 rounded-lg bg-white p-4 shadow border border-blue-100 dark:bg-gray-800 dark:border-blue-800/30 dark:shadow-gray-900/50">
                            <h3 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Filtros Avanzados</h3>
                            <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                                <!-- VIN -->
                                <div>
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">VIN</label>
                                    <input v-model="filters.vin" type="text" placeholder="Ej: 1HGBH41JXMN109186" maxlength="40"
                                        class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                        @keyup.enter="applyFilters" />
                                </div>

                                <!-- OEM Code -->
                                <div>
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">Código OEM</label>
                                    <input v-model="filters.oem_code" type="text" placeholder="Ej: 0986JR1520"
                                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                        @keyup.enter="applyFilters" />
                                </div>

                                <!-- Category -->
                                <div>
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">Categoría</label>
                                    <select v-model="filters.category_id"
                                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                                        <option :value="undefined">Todas</option>
                                        <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                                    </select>
                                </div>

                                <!-- Attribute Value -->
                                <div>
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">Especificación (valor)</label>
                                    <input v-model="filters.attribute_value" type="text" placeholder="Ej: 17 o Rojo"
                                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                        @keyup.enter="applyFilters" />
                                </div>
                            </div>

                            <div class="mt-3 flex items-center gap-2">
                                <button @click="applyFilters"
                                    class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700">
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    </transition>
                </div>

                <!-- Active Deep-Link Filter Banner -->
                <div v-if="activeDeepLinkFilters.length > 0" class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 dark:border-blue-800/40 dark:bg-blue-900/20">
                    <span class="text-xs font-semibold text-blue-700 dark:text-blue-400">Filtro activo:</span>
                    <span v-for="tag in activeDeepLinkFilters" :key="tag.key"
                        class="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-800 shadow-sm dark:bg-gray-800 dark:text-blue-300">
                        {{ tag.label }}
                        <button @click="removeDeepLinkFilter(tag.key)" class="ml-0.5 rounded-full p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/50 transition-colors" title="Quitar filtro">
                            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                        </button>
                    </span>
                </div>

                <!-- Loading State -->
                <div v-if="loading" class="text-center py-12">
                    <div
                        class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent">
                    </div>
                    <p class="mt-2 text-gray-800 dark:text-gray-200">Cargando productos...</p>
                </div>

                <!-- Error State -->
                <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800">
                    <p>{{ error }}</p>
                </div>

                <!-- Products Table -->
                <div v-else-if="products.length > 0"
                    class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th
                                    class="px-6 py-3 w-12 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                </th>
                                <th
                                    class="px-3 py-3 w-14 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Foto
                                </th>
                                <th @click="toggleSort('sku')"
                                    class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none">
                                    <span class="inline-flex items-center gap-1">
                                        SKU
                                        <svg v-if="sortField === 'sku'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path v-if="sortDirection === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <svg v-else class="h-3 w-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                    </span>
                                </th>
                                <th @click="toggleSort('name')"
                                    class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none">
                                    <span class="inline-flex items-center gap-1">
                                        Producto
                                        <svg v-if="sortField === 'name'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path v-if="sortDirection === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <svg v-else class="h-3 w-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                    </span>
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Variantes
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Stock
                                </th>
                                <th @click="toggleSort('status')"
                                    class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none">
                                    <span class="inline-flex items-center gap-1">
                                        Estado
                                        <svg v-if="sortField === 'status'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path v-if="sortDirection === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <svg v-else class="h-3 w-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                    </span>
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                            <template v-for="product in products" :key="product.id">
                                <!-- Parent Row -->
                                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                    @click="toggleRow(product.id)">
                                    <td class="px-6 py-4 text-sm">
                                        <button
                                            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                            <svg v-if="!expandedRows.has(product.id)" class="h-5 w-5" fill="none"
                                                stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M9 5l7 7-7 7" />
                                            </svg>
                                            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor"
                                                viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </td>
                                    <td class="px-3 py-2">
                                        <div class="h-10 w-10 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
                                            <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="h-full w-full object-cover" />
                                            <svg v-else class="h-5 w-5 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                    </td>
                                    <td
                                        class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                        {{ product.sku_base || product.default_variant?.sku }}
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                                            {{ product.name }}
                                        </div>
                                        <div v-if="product.product_line"
                                            class="text-sm text-gray-500 dark:text-gray-400">
                                            {{ product.product_line.name }}
                                        </div>
                                    </td>
                                    <td
                                        class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        <span
                                            class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            {{ product.variants_count || '1' }} marca{{ (product.variants_count
                                                || 1) > 1 ? 's' : '' }}
                                        </span>
                                    </td>
                                    <td
                                        class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {{ product.total_stock ?? 'N/A' }}
                                    </td>
                                    <td class="whitespace-nowrap px-6 py-4">
                                        <span :class="getStatusColor(product.status)"
                                            class="inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5">
                                            {{ product.status }}
                                        </span>
                                    </td>
                                    <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium"
                                        @click.stop>
                                        <template v-if="archiveTab === 'active'">
                                            <button @click="openDetail(product)"
                                                class="text-blue-600 hover:text-blue-900 mr-3 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                                                Ver Detalle
                                            </button>
                                            <a :href="`/products/${product.id}/edit`"
                                                class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3">
                                                Editar
                                            </a>
                                            <button @click="archiveProduct(product)"
                                                class="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                                                title="Archivar producto">
                                                <svg class="h-4 w-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
                                                Archivar
                                            </button>
                                        </template>
                                        <template v-else>
                                            <button @click="handleRestore(product)"
                                                class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors">
                                                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                Restaurar
                                            </button>
                                        </template>
                                    </td>
                                </tr>

                                <!-- Expanded Variants Row -->
                                <tr v-if="expandedRows.has(product.id)"
                                    class="bg-gray-50 dark:bg-gray-900">
                                    <td colspan="8" class="px-6 py-4">
                                        <div class="ml-12">
                                            <h4
                                                class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Variantes por Marca:</h4>
                                            <div
                                                class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                                                <table
                                                    class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                    <thead class="bg-gray-100 dark:bg-gray-800">
                                                        <tr>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                Marca</th>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                SKU</th>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                Custom SKU</th>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                Precio</th>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                Stock</th>
                                                            <th
                                                                class="px-4 py-2 text-right text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody
                                                        class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                                                        <tr v-for="variant in getVariants(product)"
                                                            :key="variant.id"
                                                            class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                            <td class="px-4 py-3">
                                                                <div class="flex items-center">
                                                                    <div
                                                                        class="text-sm font-medium text-gray-900 dark:text-white">
                                                                        {{ variant.brand?.name }}
                                                                    </div>
                                                                    <span v-if="variant.is_default"
                                                                        class="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                                                                        Default
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td
                                                                class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                                <code
                                                                    class="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">{{
                                                                        variant.sku }}</code>
                                                            </td>
                                                            <td
                                                                class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                                                {{ variant.upc || 'N/A' }}
                                                            </td>
                                                            <td
                                                                class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                                <PriceDisplay v-if="variant.pricing"
                                                                    :base-price="Number(variant.pricing.base_price)"
                                                                    :tax-rate="Number(variant.pricing.tax_rate ?? product.pricing?.tax_rate ?? 0)"
                                                                    size="sm" />
                                                                <PriceDisplay v-else-if="product.pricing"
                                                                    :base-price="Number(product.pricing.base_price)"
                                                                    :tax-rate="Number(product.pricing.tax_rate ?? 0)"
                                                                    size="sm" />
                                                                <div v-else class="text-gray-400">—</div>
                                                            </td>
                                                            <td
                                                                class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                                {{ variant.total_stock ?? 'N/A' }}
                                                            </td>
                                                            <td
                                                                class="px-4 py-3 text-right text-sm font-medium">
                                                                <button
                                                                    @click="addVariantToCart(product, variant)"
                                                                    class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all mr-2"
                                                                    :class="addedFeedback === variant.id
                                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                        : 'bg-green-600 text-white hover:bg-green-700'"
                                                                >
                                                                    <template v-if="addedFeedback === variant.id">
                                                                        <Check class="w-3 h-3" /> Agregado
                                                                    </template>
                                                                    <template v-else>
                                                                        <ShoppingCart class="w-3 h-3" /> Agregar
                                                                    </template>
                                                                </button>
                                                                <a :href="`/products/${product.id}/edit?variant=${variant.id}`"
                                                                    class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                                                                    Editar
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>

                    <!-- Pagination -->
                    <div
                        class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-700 dark:bg-gray-800">
                        <div class="flex flex-1 justify-between sm:hidden">
                            <button @click="prevPage(filters)" :disabled="currentPage === 1"
                                class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                                Anterior
                            </button>
                            <button @click="nextPage(filters)" :disabled="currentPage === lastPage"
                                class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                                Siguiente
                            </button>
                        </div>
                        <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p class="text-sm text-gray-900 dark:text-white">
                                    Mostrando
                                    <span class="font-medium">{{ (currentPage - 1) * 20 + 1 }}</span>
                                    a
                                    <span class="font-medium">{{ Math.min(currentPage * 20, total) }}</span>
                                    de
                                    <span class="font-medium">{{ total }}</span>
                                    productos
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <button @click="prevPage(filters)" :disabled="currentPage === 1"
                                    class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                                    Anterior
                                </button>
                                <span class="flex items-center px-4 text-sm text-gray-900 dark:text-white">
                                    Página {{ currentPage }} de {{ lastPage }}
                                </span>
                                <button @click="nextPage(filters)" :disabled="currentPage === lastPage"
                                    class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-else class="text-center py-12 bg-white rounded-lg shadow">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">No hay productos</h3>
                    <p class="mt-1 text-sm text-gray-500">Comienza creando un nuevo producto.</p>
                    <div class="mt-6">
                        <a href="/products/create"
                            class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            Nuevo Producto
                        </a>
                    </div>
                </div>
            </template>

            <!-- Universal Product Detail Modal (accessible from both Table and Catalog views) -->
            <ProductDetailModal v-if="selectedProduct" :product="selectedProduct" @close="closeDetail" @view-alternative="(p: any) => selectedProduct = p" />
        </div>
    </AppLayout>
</template>
