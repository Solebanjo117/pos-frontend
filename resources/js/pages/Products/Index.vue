<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import { usePOS } from '@/composables/usePOS'
import type { Product, ProductFilters } from '@/types/product'
import ProductCatalogView from '@/components/Products/ProductCatalogView.vue'
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue'
import ProductFiltersComponent from '@/components/Products/ProductFilters.vue'
import type { ProductFilterValues } from '@/components/Products/ProductFilters.vue'
import ProductSort from '@/components/Products/ProductSort.vue'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import { ShoppingCart, Check, Info, Filter, Upload, Download, FileSpreadsheet } from 'lucide-vue-next'
import { usePosSettings } from '@/composables/usePosSettings'
import { useCategories } from '@/composables/useCategories'
import { useBrands } from '@/composables/useBrands'
import { productsApi } from '@/services/api/products'

import { useWarehouses } from '@/composables/useWarehouses'

const { currentWarehouseId, initWarehouse } = usePosSettings()
const { warehouses } = useWarehouses()
const { categories, fetchCategories } = useCategories()
const { brands, fetchBrands: fetchBrandsList } = useBrands()

const showSidebarFilters = ref(true)
const sidebarSortValue = ref('newest')

// Sidebar filter values
const sidebarFilterValues = ref<ProductFilterValues>({
  sku: '',
  category_ids: [],
  brand_ids: [],
  min_price: undefined,
  max_price: undefined,
  in_stock: false,
})

const handleSidebarFilterChange = async (newFilters: ProductFilterValues) => {
  sidebarFilterValues.value = newFilters
  // Map sidebar filter values to the main filters object
  filters.value.category_id = newFilters.category_ids.length > 0 ? newFilters.category_ids : undefined
  filters.value.brand_id = newFilters.brand_ids.length > 0 ? newFilters.brand_ids : undefined
    filters.value.search = newFilters.sku || undefined
  filters.value.min_price = newFilters.min_price
  filters.value.max_price = newFilters.max_price
  filters.value.in_stock = newFilters.in_stock || undefined
  await applyFilters()
}

const handleSortChange = async (sortVal: string) => {
  sidebarSortValue.value = sortVal
  // Use unified sort instead of legacy sortField/sortDirection
  filters.value.sort = sortVal
  await applyFilters()
}

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

// ========== IMPORT STATE ==========
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importPreviewRows = ref<any[]>([])
const importPreviewCount = ref(0)
const importResult = ref<any | null>(null)
const importError = ref<string | null>(null)
const importPreviewLoading = ref(false)
const importRunning = ref(false)

const openImportModal = () => {
    showImportModal.value = true
    importError.value = null
    importResult.value = null
    importPreviewRows.value = []
    importPreviewCount.value = 0
}

const closeImportModal = () => {
    showImportModal.value = false
    importFile.value = null
    importPreviewRows.value = []
    importPreviewCount.value = 0
    importResult.value = null
    importError.value = null
}

const handleImportFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    importFile.value = input.files?.[0] ?? null
    importPreviewRows.value = []
    importPreviewCount.value = 0
    importResult.value = null
    importError.value = null
}

const downloadImportTemplate = async () => {
    importError.value = null
    try {
        const blob = await productsApi.downloadImportTemplate()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'plantilla_productos.xlsx'
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
    } catch (e: any) {
        importError.value = e.response?.data?.message || 'No se pudo descargar la plantilla.'
    }
}

const previewImportFile = async () => {
    importError.value = null
    importResult.value = null

    if (!importFile.value) {
        importError.value = 'Selecciona un archivo antes de previsualizar.'
        return
    }

    importPreviewLoading.value = true
    try {
        const response = await productsApi.previewImport(importFile.value)
        importPreviewRows.value = response.data?.rows ?? []
        importPreviewCount.value = response.data?.count ?? importPreviewRows.value.length
    } catch (e: any) {
        importError.value = e.response?.data?.message || 'No se pudo generar la previsualizacion.'
        importPreviewRows.value = []
        importPreviewCount.value = 0
    } finally {
        importPreviewLoading.value = false
    }
}

const runImport = async () => {
    importError.value = null

    if (!importFile.value) {
        importError.value = 'Selecciona un archivo antes de importar.'
        return
    }

    importRunning.value = true
    try {
        const response = await productsApi.importFromFile(importFile.value)
        importResult.value = response.data ?? null
        await applyFilters()
    } catch (e: any) {
        importError.value = e.response?.data?.message || 'Error al importar productos.'
    } finally {
        importRunning.value = false
    }
}

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

type ProductsTableColumn = 'expander' | 'image' | 'sku' | 'product' | 'variants' | 'stock' | 'actions'

const PRODUCTS_TABLE_WIDTH_STORAGE_KEY = 'products_index_table_column_widths_v1'
const tableColumns: ProductsTableColumn[] = ['expander', 'image', 'sku', 'product', 'variants', 'stock', 'actions']
const defaultColumnWidths: Record<ProductsTableColumn, number> = {
    expander: 56,
    image: 72,
    sku: 170,
    product: 360,
    variants: 140,
    stock: 120,
    actions: 220,
}
const minColumnWidths: Record<ProductsTableColumn, number> = {
    expander: 44,
    image: 64,
    sku: 130,
    product: 240,
    variants: 110,
    stock: 96,
    actions: 170,
}
const columnWidths = ref<Record<ProductsTableColumn, number>>({ ...defaultColumnWidths })
const tableMinWidth = computed(() => tableColumns.reduce((total, column) => total + columnWidths.value[column], 0))

let resizingColumn: ProductsTableColumn | null = null
let resizeStartX = 0
let resizeStartWidth = 0
let suppressSortClickUntil = 0

const getColumnStyle = (column: ProductsTableColumn) => {
    const width = columnWidths.value[column]
    return {
        width: `${width}px`,
        minWidth: `${width}px`,
    }
}

const persistColumnWidths = () => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PRODUCTS_TABLE_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths.value))
}

const loadColumnWidths = () => {
    if (typeof window === 'undefined') return

    const raw = window.localStorage.getItem(PRODUCTS_TABLE_WIDTH_STORAGE_KEY)
    if (!raw) return

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const loaded: Record<ProductsTableColumn, number> = { ...defaultColumnWidths }

        for (const column of tableColumns) {
            const value = parsed[column]
            if (typeof value === 'number' && Number.isFinite(value)) {
                loaded[column] = Math.max(minColumnWidths[column], Math.round(value))
            }
        }

        columnWidths.value = loaded
    } catch {
        // Ignore invalid persisted values.
    }
}

const handleColumnResizeMouseMove = (event: MouseEvent) => {
    if (!resizingColumn) return

    const deltaX = event.clientX - resizeStartX
    const nextWidth = Math.round(resizeStartWidth + deltaX)
    columnWidths.value[resizingColumn] = Math.max(minColumnWidths[resizingColumn], nextWidth)
}

const stopColumnResize = () => {
    if (!resizingColumn) return

    resizingColumn = null
    suppressSortClickUntil = Date.now() + 150
    window.removeEventListener('mousemove', handleColumnResizeMouseMove)
    window.removeEventListener('mouseup', stopColumnResize)
    persistColumnWidths()
}

const startColumnResize = (event: MouseEvent, column: ProductsTableColumn) => {
    event.preventDefault()
    event.stopPropagation()
    suppressSortClickUntil = Date.now() + 400

    resizingColumn = column
    resizeStartX = event.clientX
    resizeStartWidth = columnWidths.value[column]

    window.addEventListener('mousemove', handleColumnResizeMouseMove)
    window.addEventListener('mouseup', stopColumnResize)
}

const toggleSort = async (field: string) => {
    if (Date.now() < suppressSortClickUntil) return

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

// Fetch products on mount — read any URL query params for deep linking
onMounted(async () => {
    await initWarehouse()
    await Promise.all([fetchCategories(), fetchBrandsList()])
    loadColumnWidths()
    const params = new URLSearchParams(window.location.search)
    if (params.has('search'))          filters.value.search            = params.get('search') ?? ''
    if (params.has('brand_id'))        filters.value.brand_id          = Number(params.get('brand_id')) || undefined
    if (params.has('category_id'))     filters.value.category_id       = Number(params.get('category_id')) || undefined
    if (params.has('product_line_id')) filters.value.product_line_id   = Number(params.get('product_line_id')) || undefined
    filters.value.warehouse_id = currentWarehouseId.value || undefined
    await fetchProducts(filters.value)
})

onUnmounted(() => {
    stopColumnResize()
})

watch(
    () => filters.value.search,
    (newSearch) => {
        const normalized = newSearch ?? ''
        if ((sidebarFilterValues.value.sku ?? '') !== normalized) {
            sidebarFilterValues.value = {
                ...sidebarFilterValues.value,
                sku: normalized,
            }
        }
    },
    { immediate: true },
)

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

// Helper to get a safe array of variants for a product
const getVariants = (product: any) => {
    if (product.variants?.length) return product.variants
    if (product.default_variant) return [product.default_variant]
    return []
}

const getTechnicalSpecsPreview = (product: any): string => {
    const variants = getVariants(product);
    if (!variants.length) return '';
    
    // Recopilar todos los atributos únicos de todas las variantes
    const allAttrNames = new Set<string>();
    const attributesHtml: string[] = [];

    variants.forEach((v: any) => {
        v.attributes?.forEach((attr: any) => {
            if (!allAttrNames.has(attr.name)) {
                allAttrNames.add(attr.name);
                attributesHtml.push(`${attr.name}: ${attr.value}${attr.unit ? attr.unit : ''}`);
            }
        });
    });

    return attributesHtml.slice(0, 3).join(' • ') + (attributesHtml.length > 3 ? '...' : '');
}

// Helper to get variant attributes, falling back to any sibling variant's attrs
// (Henry: all variants share the same "base-level" specs)
const getVariantAttrs = (variant: any, product: any): any[] => {
    if (variant.attributes?.length) return variant.attributes
    const variants = getVariants(product)
    const sibling = variants.find((v: any) => v.id !== variant.id && v.attributes?.length > 0)
    return sibling ? sibling.attributes : []
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
                    <div class="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-border dark:bg-muted">
                        <button @click="viewMode = 'table'" :class="[
                            viewMode === 'table'
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-card dark:text-white'
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
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-card dark:text-white'
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

                    <button
                        @click="openImportModal"
                        class="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    >
                        <Upload class="h-4 w-4" />
                        Importar Excel
                    </button>

                    <!-- New Product Button -->
                    <a href="/products/create"
                        class="inline-flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-primary/90 transition-colors">
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
                <div class="mb-4 flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-border dark:bg-card w-fit">
                    <button @click="switchArchiveTab('active')"
                        :class="[
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                            archiveTab === 'active'
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-muted dark:text-white'
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
                <!-- Compact Search & Controls Bar -->
                <div class="mb-4 rounded-lg bg-white p-4 shadow dark:bg-card dark:shadow-gray-900/50">
                    <div class="flex flex-wrap items-end gap-3">
                        <div class="flex-1 min-w-[200px]">
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Buscar
                            </label>
                            <input v-model="filters.search" type="text" placeholder="SKU o nombre..."
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white dark:placeholder-gray-400"
                                @keyup.enter="applyFilters" />
                        </div>

                        <div class="w-36">
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Estado
                            </label>
                            <select v-model="filters.status"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white">
                                <option :value="undefined">Todos</option>
                                <option value="active">Activo</option>
                                <option value="discontinued">Discontinuado</option>
                                <option value="pending">Pendiente</option>
                            </select>
                        </div>

                         <!-- Warehouse Filter -->
                         <div class="w-40">
                            <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Almacén
                            </label>
                            <select v-model="filters.warehouse_id"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white">
                                <option :value="undefined">Todos</option>
                                <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                            </select>
                        </div>

                        <div class="flex items-center gap-2">
                            <ProductSort :model-value="sidebarSortValue" @update:model-value="handleSortChange" />
                        </div>

                        <div class="flex items-end gap-2">
                            <button @click="applyFilters"
                                class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-white transition-colors hover:bg-blue-700 dark:hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                                Filtrar
                            </button>
                            <button @click="clearFilters"
                                class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-muted dark:text-gray-100 dark:hover:bg-muted/80 dark:focus:ring-offset-gray-800">
                                Limpiar
                            </button>
                            <!-- Mobile sidebar toggle -->
                            <button @click="showSidebarFilters = !showSidebarFilters"
                                class="md:hidden rounded-lg px-3 py-2 border transition-colors text-sm"
                                :class="showSidebarFilters
                                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400'
                                  : 'bg-white dark:bg-card border-gray-200 dark:border-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-muted'"
                            >
                                <Filter class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Loading State -->
                <div v-if="loading" class="text-center py-12">
                    <div
                        class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent">
                    </div>
                    <p class="mt-2 text-gray-800 dark:text-gray-200">Cargando productos...</p>
                </div>

                <!-- Error State -->
                <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800">
                    <p>{{ error }}</p>
                </div>

                <!-- ========== SIDEBAR + TABLE LAYOUT ========== -->
                <div v-else-if="products.length > 0" class="flex gap-4 min-h-0">
                    <!-- Sidebar Filters -->
                    <div :class="showSidebarFilters ? 'block' : 'hidden md:block'" class="shrink-0">
                        <ProductFiltersComponent
                            :model-value="sidebarFilterValues"
                            @update:model-value="handleSidebarFilterChange"
                            :categories="categories"
                            :brands="brands"
                            :collapsible="false"
                        />
                    </div>

                    <!-- Products Table -->
                    <div class="flex-1 min-w-0 rounded-lg bg-white shadow dark:bg-card">
                    <div class="overflow-x-auto">
                    <table class="table-fixed divide-y divide-gray-200 dark:divide-border" :style="{ minWidth: `${tableMinWidth}px` }">
                        <thead class="bg-gray-50 dark:bg-muted">
                            <tr>
                                <th
                                    :style="getColumnStyle('expander')"
                                    class="relative px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    <span class="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none" @mousedown.stop.prevent="startColumnResize($event, 'expander')" @click.stop.prevent></span>
                                </th>
                                <th
                                    :style="getColumnStyle('image')"
                                    class="relative px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Foto
                                    <span class="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none" @mousedown.stop.prevent="startColumnResize($event, 'image')" @click.stop.prevent></span>
                                </th>
                                <th @click="toggleSort('sku')"
                                    :style="getColumnStyle('sku')"
                                    class="relative px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors select-none">
                                    <span class="inline-flex items-center gap-1">
                                        SKU
                                        <svg v-if="sortField === 'sku'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path v-if="sortDirection === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <svg v-else class="h-3 w-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                    </span>
                                    <span class="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none" @mousedown.stop.prevent="startColumnResize($event, 'sku')" @click.stop.prevent></span>
                                </th>
                                <th @click="toggleSort('name')"
                                    :style="getColumnStyle('product')"
                                    class="relative px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors select-none">
                                    <span class="inline-flex items-center gap-1">
                                        Producto
                                        <svg v-if="sortField === 'name'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path v-if="sortDirection === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <svg v-else class="h-3 w-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                    </span>
                                    <span class="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none" @mousedown.stop.prevent="startColumnResize($event, 'product')" @click.stop.prevent></span>
                                </th>
                                <th
                                    :style="getColumnStyle('variants')"
                                    class="relative px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Variantes
                                    <span class="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none" @mousedown.stop.prevent="startColumnResize($event, 'variants')" @click.stop.prevent></span>
                                </th>
                                <th
                                    :style="getColumnStyle('stock')"
                                    class="relative px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Stock
                                    <span class="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none" @mousedown.stop.prevent="startColumnResize($event, 'stock')" @click.stop.prevent></span>
                                </th>
                                <th
                                    :style="getColumnStyle('actions')"
                                    class="relative px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
                                    Acciones
                                    <span class="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none" @mousedown.stop.prevent="startColumnResize($event, 'actions')" @click.stop.prevent></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                            <template v-for="product in products" :key="product.id">
                                <!-- Parent Row -->
                                <tr class="hover:bg-gray-50 dark:hover:bg-muted/50 cursor-pointer"
                                    @click="toggleRow(product.id)">
                                    <td :style="getColumnStyle('expander')" class="px-6 py-4 text-sm">
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
                                    <td :style="getColumnStyle('image')" class="px-3 py-2">
                                        <div class="h-10 w-10 rounded-md overflow-hidden bg-gray-100 dark:bg-muted flex-shrink-0 flex items-center justify-center">
                                            <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="h-full w-full object-cover" />
                                            <svg v-else class="h-5 w-5 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                    </td>
                                    <td
                                        :style="getColumnStyle('sku')"
                                        class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                        {{ product.sku_base || product.default_variant?.sku }}
                                    </td>
                                    <td :style="getColumnStyle('product')" class="px-6 py-4">
                                        <div class="flex items-center gap-2">
                                            <div class="text-sm font-medium text-gray-900 dark:text-white">
                                                {{ product.name }}
                                            </div>
                                            <span v-if="product.is_universal" class="flex-shrink-0 inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 ring-1 ring-inset ring-blue-500/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30" title="Universal">
                                                🌐 Universal
                                            </span>
                                        </div>
                                        <div v-if="product.product_line"
                                            class="text-sm text-gray-500 dark:text-gray-400">
                                            {{ product.product_line.name }}
                                        </div>
                                        <div v-if="getTechnicalSpecsPreview(product)" class="text-[11px] text-gray-400 dark:text-gray-500 mt-1" :title="getTechnicalSpecsPreview(product)">
                                            📋 {{ getTechnicalSpecsPreview(product) }}
                                        </div>
                                    </td>
                                    <td
                                        :style="getColumnStyle('variants')"
                                        class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        <span
                                            class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            {{ product.variants_count || '1' }} marca{{ (product.variants_count
                                                || 1) > 1 ? 's' : '' }}
                                        </span>
                                    </td>
                                    <td
                                        :style="getColumnStyle('stock')"
                                        class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {{ product.total_stock ?? 'N/A' }}
                                    </td>
                                    <td :style="getColumnStyle('actions')" class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium"
                                        @click.stop>
                                        <template v-if="archiveTab === 'active'">
                                            <button @click="openDetail(product)"
                                                class="text-blue-600 dark:text-primary hover:text-blue-900 mr-3 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                                                Ver Detalle
                                            </button>
                                            <a :href="`/products/${product.id}/edit`"
                                                class="text-indigo-600 dark:text-primary hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3">
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
                                    class="bg-gray-50 dark:bg-muted">
                                    <td colspan="7" class="px-6 py-4">
                                        <div class="ml-12">
                                            <h4
                                                class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Variantes por Marca:</h4>
                                            <div
                                                class="overflow-hidden rounded-lg border border-gray-200 dark:border-border">
                                                <table
                                                    class="min-w-full divide-y divide-gray-200 dark:divide-border">
                                                    <thead class="bg-gray-100 dark:bg-card">
                                                        <tr>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                SKU Variante</th>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                Atributos</th>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
                                                                Marca</th>
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
                                                        class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                                                        <tr v-for="variant in getVariants(product)"
                                                            :key="variant.id"
                                                            class="hover:bg-gray-50 dark:hover:bg-muted/50">
                                                            <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                                                                {{ variant.sku || product.sku_base || '—' }}
                                                            </td>
                                                            <td class="px-4 py-3">
                                                                <div v-if="getVariantAttrs(variant, product).length > 0" class="flex flex-wrap gap-1">
                                                                    <span v-for="attr in getVariantAttrs(variant, product)" :key="attr.id ?? attr.name"
                                                                        class="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300"
                                                                        :class="!variant.attributes?.length ? 'opacity-60 italic' : ''">
                                                                        {{ attr.name }}: {{ attr.value }}{{ attr.unit ? ` ${attr.unit}` : '' }}
                                                                    </span>
                                                                </div>
                                                                <span v-else class="text-gray-400 text-xs">—</span>
                                                            </td>
                                                            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                                {{ variant.brand?.name || '—' }}
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
                                                                <button
                                                                    @click="openDetail(product)"
                                                                    class="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-primary hover:bg-indigo-50 dark:hover:bg-muted transition-colors mr-1"
                                                                    title="Ver detalles del producto"
                                                                >
                                                                    <Info class="w-3.5 h-3.5" />
                                                                </button>
                                                                <a :href="`/products/${product.id}/edit?variant=${variant.id}`"
                                                                    class="text-indigo-600 dark:text-primary hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
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
                    </div>

                    <!-- Pagination -->
                    <div
                        class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-border dark:bg-card">
                        <div class="flex flex-1 justify-between sm:hidden">
                            <button @click="prevPage(filters)" :disabled="currentPage === 1"
                                class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80">
                                Anterior
                            </button>
                            <button @click="nextPage(filters)" :disabled="currentPage === lastPage"
                                class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80">
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
                                    class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80">
                                    Anterior
                                </button>
                                <span class="flex items-center px-4 text-sm text-gray-900 dark:text-white">
                                    Página {{ currentPage }} de {{ lastPage }}
                                </span>
                                <button @click="nextPage(filters)" :disabled="currentPage === lastPage"
                                    class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80">
                                    Siguiente
                                </button>
                            </div>
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
                            class="inline-flex items-center rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90">
                            Nuevo Producto
                        </a>
                    </div>
                </div>
            </template>

            <!-- Universal Product Detail Modal (accessible from both Table and Catalog views) -->
            <ProductDetailModal v-if="selectedProduct" :product="selectedProduct" @close="closeDetail" @view-alternative="(p: any) => selectedProduct = p" />

            <!-- Product Import Modal -->
            <Teleport to="body">
                <div
                    v-if="showImportModal"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    @click.self="closeImportModal"
                >
                    <div class="w-full max-w-5xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-border dark:bg-card">
                        <div class="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <FileSpreadsheet class="h-5 w-5 text-emerald-600" />
                                    Importacion de productos
                                </h3>
                                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Descarga la plantilla, sube tu archivo y valida filas antes de importar.
                                </p>
                            </div>
                            <button
                                class="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-muted"
                                @click="closeImportModal"
                            >
                                Cerrar
                            </button>
                        </div>

                        <div class="grid grid-cols-1 gap-4 border-b border-gray-200 pb-4 dark:border-border md:grid-cols-[1fr_auto_auto_auto]">
                            <label class="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 dark:border-border dark:text-gray-300">
                                <Upload class="h-4 w-4" />
                                <span class="truncate">{{ importFile?.name || 'Selecciona archivo .xlsx, .xls o .csv' }}</span>
                                <input type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="handleImportFileChange" />
                            </label>

                            <button
                                type="button"
                                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                                @click="downloadImportTemplate"
                            >
                                <Download class="mr-1 inline h-4 w-4" /> Plantilla
                            </button>

                            <button
                                type="button"
                                class="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-700/40 dark:bg-indigo-900/20 dark:text-indigo-300"
                                :disabled="!importFile || importPreviewLoading || importRunning"
                                @click="previewImportFile"
                            >
                                {{ importPreviewLoading ? 'Previsualizando...' : 'Previsualizar' }}
                            </button>

                            <button
                                type="button"
                                class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                :disabled="!importFile || importRunning || importPreviewLoading"
                                @click="runImport"
                            >
                                {{ importRunning ? 'Importando...' : 'Importar' }}
                            </button>
                        </div>

                        <div v-if="importError" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                            {{ importError }}
                        </div>

                        <div v-if="importResult" class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                            Importados: {{ importResult.success_count ?? 0 }} · Errores: {{ importResult.error_count ?? 0 }}
                        </div>

                        <div v-if="importResult?.errors?.length" class="mt-4 max-h-40 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                            <p class="mb-2 font-semibold">Filas con error:</p>
                            <p v-for="row in importResult.errors" :key="`err-${row.row}`" class="mb-1">
                                Fila {{ row.row }}: {{ row.error }}
                            </p>
                        </div>

                        <div v-if="importPreviewRows.length" class="mt-4">
                            <div class="mb-2 flex items-center justify-between">
                                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Previsualizacion ({{ importPreviewCount }} filas)</h4>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Muestra primeras filas del archivo</p>
                            </div>

                            <div class="max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-border">
                                <table class="min-w-full divide-y divide-gray-200 dark:divide-border text-xs">
                                    <thead class="bg-gray-50 dark:bg-background">
                                        <tr>
                                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Fila</th>
                                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Nombre</th>
                                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">SKU</th>
                                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Marca</th>
                                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Categoria</th>
                                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100 dark:divide-border">
                                        <tr v-for="row in importPreviewRows" :key="`preview-${row.row}`">
                                            <td class="px-3 py-2">{{ row.row }}</td>
                                            <td class="px-3 py-2">{{ row.nombre }}</td>
                                            <td class="px-3 py-2">{{ row.sku }}</td>
                                            <td class="px-3 py-2">{{ row.marca }}</td>
                                            <td class="px-3 py-2">{{ row.categoria }}</td>
                                            <td class="px-3 py-2">
                                                <span v-if="row.is_valid" class="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                    OK
                                                </span>
                                                <span v-else class="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                    Error
                                                </span>
                                                <p v-if="row.errors?.length" class="mt-1 text-[11px] text-red-600 dark:text-red-300">
                                                    {{ row.errors.join(' ') }}
                                                </p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </Teleport>
        </div>
    </AppLayout>
</template>
