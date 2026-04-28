<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { useProducts } from '@/composables/useProducts';
import { usePOS } from '@/composables/usePOS';
import type { Product, ProductFilters } from '@/types/product';
import ProductCatalogView from '@/components/Products/ProductCatalogView.vue';
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue';
import ProductFiltersComponent from '@/components/Products/ProductFilters.vue';
import type { ProductFilterValues } from '@/components/Products/ProductFilters.vue';
import ProductSort from '@/components/Products/ProductSort.vue';
import PriceDisplay from '@/components/ui/PriceDisplay.vue';
import { ShoppingCart, Check, Info, Filter } from 'lucide-vue-next';
import { usePosSettings } from '@/composables/usePosSettings';
import { useCategories } from '@/composables/useCategories';
import { useBrands } from '@/composables/useBrands';
import { productsApi } from '@/services/api/products';

import { useWarehouses } from '@/composables/useWarehouses';

const { currentWarehouseId, initWarehouse } = usePosSettings();
const { warehouses } = useWarehouses();
const { categories, fetchCategories } = useCategories();
const { brands, fetchBrands: fetchBrandsList } = useBrands();

const showSidebarFilters = ref(true);
const sidebarSortValue = ref('newest');

// Sidebar filter values
const sidebarFilterValues = ref<ProductFilterValues>({
    category_ids: [],
    brand_ids: [],
    min_price: undefined,
    max_price: undefined,
    in_stock: false,
});

const handleSidebarFilterChange = async (newFilters: ProductFilterValues) => {
    sidebarFilterValues.value = newFilters;
    // Map sidebar filter values to the main filters object
    filters.value.category_id =
        newFilters.category_ids.length > 0
            ? newFilters.category_ids
            : undefined;
    filters.value.brand_id =
        newFilters.brand_ids.length > 0 ? newFilters.brand_ids : undefined;
    filters.value.min_price = newFilters.min_price;
    filters.value.max_price = newFilters.max_price;
    filters.value.in_stock = newFilters.in_stock || undefined;
    await applyFilters();
};

const handleSortChange = async (sortVal: string) => {
    sidebarSortValue.value = sortVal;
    // Use unified sort instead of legacy sortField/sortDirection
    filters.value.sort = sortVal;
    await applyFilters();
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
];

const {
    products,
    loading,
    error,
    currentPage,
    lastPage,
    total,
    perPage,
    fetchProducts,
    restoreProduct,
    nextPage,
    prevPage,
} = useProducts();

const { addToCart, cartItemCount } = usePOS();

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
    };
    addToCart(cartProduct as any, cartProduct.default_variant as any, 1);
    addedFeedback.value = variant.id;
    setTimeout(() => {
        addedFeedback.value = null;
    }, 1200);
};

const addedFeedback = ref<number | null>(null);

// ========== VIEW MODE TOGGLE ==========
const viewMode = ref<'table' | 'catalog'>('table');

// ========== TABLE VIEW STATE ==========
const filters = ref<ProductFilters>({
    search: '',
    status: undefined,
    brand_id: undefined,
    oem_code: undefined,
    warehouse_id: currentWarehouseId.value || undefined,
    has_stock: false,
});

// ========== ARCHIVE TAB ==========
const archiveTab = ref<'active' | 'archived'>('active');

const buildFetchFilters = (): ProductFilters => ({
    ...filters.value,
    archived: archiveTab.value === 'archived' ? 'true' : 'false',
    sortField: sortField.value,
    sortDirection: sortDirection.value,
});

const switchArchiveTab = async (tab: 'active' | 'archived') => {
    archiveTab.value = tab;
    currentPage.value = 1;
    await fetchProducts(buildFetchFilters());
};

// ========== SORTING STATE ==========
const sortField = ref<string>('created_at');
const sortDirection = ref<'asc' | 'desc'>('desc');

type ProductsTableColumn =
    | 'expander'
    | 'image'
    | 'sku'
    | 'product'
    | 'attributes'
    | 'stock'
    | 'actions';

const PRODUCTS_TABLE_WIDTH_STORAGE_KEY =
    'products_index_table_column_widths_v2';
const tableColumns: ProductsTableColumn[] = [
    'expander',
    'image',
    'sku',
    'product',
    'attributes',
    'stock',
    'actions',
];
const defaultColumnWidths: Record<ProductsTableColumn, number> = {
    expander: 56,
    image: 72,
    sku: 170,
    product: 360,
    attributes: 280,
    stock: 120,
    actions: 150,
};
const minColumnWidths: Record<ProductsTableColumn, number> = {
    expander: 44,
    image: 64,
    sku: 130,
    product: 240,
    attributes: 180,
    stock: 96,
    actions: 120,
};
const tableContainerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const preferredWidths = ref<Record<ProductsTableColumn, number>>({
    ...defaultColumnWidths,
});

const effectiveColumnWidths = computed(() => {
    const available = containerWidth.value;
    const totalPreferred = tableColumns.reduce(
        (sum, col) => sum + preferredWidths.value[col],
        0,
    );

    if (available <= 0 || available >= totalPreferred) {
        return { ...preferredWidths.value };
    }

    const totalMin = tableColumns.reduce(
        (sum, col) => sum + minColumnWidths[col],
        0,
    );

    if (available <= totalMin) {
        return { ...minColumnWidths };
    }

    const scale = (available - totalMin) / (totalPreferred - totalMin);
    const result = {} as Record<ProductsTableColumn, number>;
    for (const col of tableColumns) {
        result[col] = Math.round(
            minColumnWidths[col] +
                scale * (preferredWidths.value[col] - minColumnWidths[col]),
        );
    }

    return result;
});

const isCompact = computed(() => {
    if (containerWidth.value <= 0) return false;
    const totalPreferred = tableColumns.reduce(
        (sum, col) => sum + preferredWidths.value[col],
        0,
    );
    return containerWidth.value < totalPreferred * 0.85;
});

let resizingColumn: ProductsTableColumn | null = null;
let resizeStartX = 0;
let resizeStartWidth = 0;
let suppressSortClickUntil = 0;
let resizeObserver: ResizeObserver | null = null;

const getColumnStyle = (column: ProductsTableColumn) => {
    const width = effectiveColumnWidths.value[column];
    return {
        width: `${width}px`,
    };
};

const persistColumnWidths = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
        PRODUCTS_TABLE_WIDTH_STORAGE_KEY,
        JSON.stringify(preferredWidths.value),
    );
};

const loadColumnWidths = () => {
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(PRODUCTS_TABLE_WIDTH_STORAGE_KEY);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const loaded: Record<ProductsTableColumn, number> = {
            ...defaultColumnWidths,
        };

        for (const column of tableColumns) {
            const value = parsed[column];
            if (typeof value === 'number' && Number.isFinite(value)) {
                loaded[column] = Math.max(
                    minColumnWidths[column],
                    Math.round(value),
                );
            }
        }

        preferredWidths.value = loaded;
    } catch {
        // Ignore invalid persisted values.
    }
};

const handleColumnResizeMouseMove = (event: MouseEvent) => {
    if (!resizingColumn) return;

    const deltaX = event.clientX - resizeStartX;
    const nextWidth = Math.round(resizeStartWidth + deltaX);
    preferredWidths.value[resizingColumn] = Math.max(
        minColumnWidths[resizingColumn],
        nextWidth,
    );
};

const stopColumnResize = () => {
    if (!resizingColumn) return;

    resizingColumn = null;
    suppressSortClickUntil = Date.now() + 150;
    window.removeEventListener('mousemove', handleColumnResizeMouseMove);
    window.removeEventListener('mouseup', stopColumnResize);
    persistColumnWidths();
};

const startColumnResize = (event: MouseEvent, column: ProductsTableColumn) => {
    event.preventDefault();
    event.stopPropagation();
    suppressSortClickUntil = Date.now() + 400;

    resizingColumn = column;
    resizeStartX = event.clientX;
    resizeStartWidth = preferredWidths.value[column];

    window.addEventListener('mousemove', handleColumnResizeMouseMove);
    window.addEventListener('mouseup', stopColumnResize);
};

const toggleSort = async (field: string) => {
    if (Date.now() < suppressSortClickUntil) return;

    if (sortField.value === field) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortField.value = field;
        sortDirection.value = 'asc';
    }
    currentPage.value = 1;
    await fetchProducts(buildFetchFilters());
};

const handlePrevPage = async () => {
    await prevPage(buildFetchFilters());
};

const handleNextPage = async () => {
    await nextPage(buildFetchFilters());
};

// ========== RESTORE ACTIONS ==========
const handleRestore = async (product: Product) => {
    if (
        !confirm(
            `¿Desea restaurar "${product.name}"? Volverá a estar disponible en el sistema.`,
        )
    )
        return;
    try {
        await restoreProduct(product.id);
    } catch (e) {}
};

const expandedRows = ref<Set<number>>(new Set());
const selectedProduct = ref<Product | null>(null);

const openDetail = (product: Product) => {
    selectedProduct.value = product;
};
const closeDetail = () => {
    selectedProduct.value = null;
};

const toggleRow = (productId: number) => {
    if (expandedRows.value.has(productId)) {
        expandedRows.value.delete(productId);
    } else {
        expandedRows.value.add(productId);
    }
};

// Fetch products on mount — read any URL query params for deep linking
onMounted(async () => {
    await initWarehouse();
    await Promise.all([fetchCategories(), fetchBrandsList()]);
    loadColumnWidths();
    const params = new URLSearchParams(window.location.search);
    if (params.has('search')) filters.value.search = params.get('search') ?? '';
    if (params.has('brand_id'))
        filters.value.brand_id = Number(params.get('brand_id')) || undefined;
    if (params.has('category_id'))
        filters.value.category_id =
            Number(params.get('category_id')) || undefined;
    if (params.has('product_line_id'))
        filters.value.product_line_id =
            Number(params.get('product_line_id')) || undefined;
    if (params.has('oem_code'))
        filters.value.oem_code = params.get('oem_code') ?? undefined;
    filters.value.warehouse_id = currentWarehouseId.value || undefined;
    await fetchProducts(buildFetchFilters());
});

onUnmounted(() => {
    stopColumnResize();
    resizeObserver?.disconnect();
});

// Watch warehouse changes
watch(currentWarehouseId, (newId) => {
    if (filters.value.warehouse_id !== newId) {
        filters.value.warehouse_id = newId || undefined;
        fetchProducts(buildFetchFilters());
    }
});

watch(tableContainerRef, (newEl) => {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    if (newEl) {
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                containerWidth.value = entry.contentRect.width;
            }
        });
        resizeObserver.observe(newEl);
    } else {
        containerWidth.value = 0;
    }
});

const applyFilters = async () => {
    currentPage.value = 1;
    await fetchProducts(buildFetchFilters());
};

const clearSidebarFilters = () => {
    sidebarFilterValues.value = {
        category_ids: [],
        brand_ids: [],
        min_price: undefined,
        max_price: undefined,
        in_stock: false,
    };
};

const clearFilters = () => {
    clearSidebarFilters();
    filters.value = {
        search: '',
        status: undefined,
        brand_id: undefined,
        category_id: undefined,
        oem_code: undefined,
        warehouse_id: currentWarehouseId.value || undefined,
        has_stock: false,
        min_price: undefined,
        max_price: undefined,
        in_stock: undefined,
        sort: undefined,
    };
    sidebarSortValue.value = 'newest';
    sortField.value = 'created_at';
    sortDirection.value = 'desc';
    applyFilters();
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
};

// Helper to get a safe array of variants for a product
const getVariants = (product: any) => {
    if (product.variants?.length) return product.variants;
    if (product.default_variant) return [product.default_variant];
    return [];
};

const collectTechnicalSpecs = (
    product: any,
): Array<{ name: string; value: string; unit?: string }> => {
    const attributeCandidates: any[] = [];

    if (
        Array.isArray(product?.key_attributes) &&
        product.key_attributes.length > 0
    ) {
        attributeCandidates.push(...product.key_attributes);
    }

    if (Array.isArray(product?.attributes) && product.attributes.length > 0) {
        attributeCandidates.push(
            ...product.attributes.filter((attr: any) => attr),
        );
    }

    const seenNames = new Set<string>();
    const normalizedAttributes: Array<{
        name: string;
        value: string;
        unit?: string;
    }> = [];

    attributeCandidates.forEach((attr: any) => {
        const name = String(attr?.name ?? '').trim();
        const value = String(attr?.value ?? '').trim();
        if (!name || !value || seenNames.has(name)) {
            return;
        }

        seenNames.add(name);
        const unit = String(attr?.unit ?? '').trim();
        normalizedAttributes.push({
            name,
            value,
            unit: unit || undefined,
        });
    });

    return normalizedAttributes;
};

const getTechnicalSpecsPreview = (product: any): string => {
    const attributes = collectTechnicalSpecs(product);
    const valuePreview = attributes.map(
        (attr) => `${attr.value}${attr.unit ? attr.unit : ''}`,
    );
    return (
        valuePreview.slice(0, 3).join(' • ') +
        (valuePreview.length > 3 ? '...' : '')
    );
};

const getTechnicalSpecsTooltip = (product: any): string => {
    const attributes = collectTechnicalSpecs(product);
    return attributes
        .map(
            (attr) =>
                `${attr.name}: ${attr.value}${attr.unit ? attr.unit : ''}`,
        )
        .join(' • ');
};
</script>

<template>
    <Head title="Productos" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- ========== PAGE HEADER with View Toggle ========== -->
            <div class="mb-6 flex items-center justify-between">
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Productos
                    </h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {{
                            viewMode === 'table'
                                ? 'Gestiona el catálogo de productos del sistema'
                                : 'Explora el catálogo de productos'
                        }}
                    </p>
                </div>

                <div class="flex items-center gap-4">
                    <!-- View Toggle Switch -->
                    <div
                        class="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-border dark:bg-muted"
                    >
                        <button
                            @click="viewMode = 'table'"
                            :class="[
                                viewMode === 'table'
                                    ? 'bg-white text-gray-900 shadow-sm dark:bg-card dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                            ]"
                            class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200"
                        >
                            <svg
                                class="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M3 10h18M3 14h18M3 18h18M3 6h18"
                                />
                            </svg>
                            Tabla
                        </button>
                        <button
                            @click="viewMode = 'catalog'"
                            :class="[
                                viewMode === 'catalog'
                                    ? 'bg-white text-gray-900 shadow-sm dark:bg-card dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                            ]"
                            class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200"
                        >
                            <svg
                                class="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                                />
                            </svg>
                            Catálogo
                        </button>
                    </div>

                    <!-- Cart Indicator -->
                    <a
                        v-if="cartItemCount > 0"
                        href="/pos"
                        class="relative inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
                    >
                        <ShoppingCart class="mr-1 h-4 w-4" /> Carrito
                        <span
                            class="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-green-700"
                            >{{ cartItemCount }}</span
                        >
                    </a>

                    <a
                        href="/products/import"
                        class="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    >
                        <Upload class="h-4 w-4" />
                        Importar
                    </a>

                    <!-- New Product Button -->
                    <a
                        href="/products/create"
                        class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        <svg
                            class="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Nuevo Producto
                    </a>
                </div>
            </div>

            <!-- ========== CATALOG VIEW ========== -->
            <ProductCatalogView
                v-if="viewMode === 'catalog'"
                :products="products"
                :loading="loading"
                :categories="categories"
                :brands="brands"
                :current-page="currentPage"
                :last-page="lastPage"
                :total="total"
                :page-size="perPage"
                @prev-page="handlePrevPage"
                @next-page="handleNextPage"
            />

            <!-- ========== TABLE VIEW ========== -->
            <template v-else>
                <!-- Archive Tabs -->
                <div
                    class="mb-4 flex w-fit items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-border dark:bg-card"
                >
                    <button
                        @click="switchArchiveTab('active')"
                        :class="[
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                            archiveTab === 'active'
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-muted dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                        ]"
                    >
                        <svg
                            class="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        Catálogo
                    </button>
                    <button
                        @click="switchArchiveTab('archived')"
                        :class="[
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                            archiveTab === 'archived'
                                ? 'bg-amber-50 text-amber-800 shadow-sm dark:bg-amber-900/30 dark:text-amber-300'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                        ]"
                    >
                        <svg
                            class="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"
                            />
                        </svg>
                        Archivados
                    </button>
                </div>

                <!-- Archived Banner -->
                <div
                    v-if="archiveTab === 'archived'"
                    class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
                >
                    <p
                        class="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300"
                    >
                        <svg
                            class="h-4 w-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        Estás viendo productos archivados. Estos productos no
                        aparecen en el Punto de Venta pero las facturas
                        históricas los conservan.
                    </p>
                </div>
                <!-- Compact Search & Controls Bar -->
                <div
                    class="mb-4 rounded-lg bg-white p-4 shadow dark:bg-card dark:shadow-gray-900/50"
                >
                    <div class="flex flex-wrap items-end gap-3">
                        <div class="min-w-[200px] flex-1">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
                            >
                                Buscar
                            </label>
                            <input
                                v-model="filters.search"
                                type="text"
                                placeholder="Nombre, SKU, VIN, OEM, categoría, marca, atributo..."
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white dark:placeholder-gray-400"
                                @keyup.enter="applyFilters"
                            />
                        </div>

                        <div class="w-36">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
                            >
                                Estado
                            </label>
                            <select
                                v-model="filters.status"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option :value="undefined">Todos</option>
                                <option value="active">Activo</option>
                                <option value="discontinued">
                                    Discontinuado
                                </option>
                                <option value="pending">Pendiente</option>
                            </select>
                        </div>

                        <!-- Warehouse Filter -->
                        <div class="w-40">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
                            >
                                Almacén
                            </label>
                            <select
                                v-model="filters.warehouse_id"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option :value="undefined">Todos</option>
                                <option
                                    v-for="w in warehouses"
                                    :key="w.id"
                                    :value="w.id"
                                >
                                    {{ w.name }}
                                </option>
                            </select>
                        </div>

                        <div class="flex items-center gap-2">
                            <ProductSort
                                :model-value="sidebarSortValue"
                                @update:model-value="handleSortChange"
                            />
                        </div>

                        <div class="flex items-end gap-2">
                            <button
                                @click="applyFilters"
                                class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 dark:focus:ring-offset-gray-800"
                            >
                                Filtrar
                            </button>
                            <button
                                @click="clearFilters"
                                class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none dark:bg-muted dark:text-gray-100 dark:hover:bg-muted/80 dark:focus:ring-offset-gray-800"
                            >
                                Limpiar
                            </button>
                            <!-- Mobile sidebar toggle -->
                            <button
                                @click="
                                    showSidebarFilters = !showSidebarFilters
                                "
                                class="rounded-lg border px-3 py-2 text-sm transition-colors md:hidden"
                                :class="
                                    showSidebarFilters
                                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-400 dark:hover:bg-muted'
                                "
                            >
                                <Filter class="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Loading State -->
                <div v-if="loading" class="py-12 text-center">
                    <div
                        class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent dark:border-primary"
                    ></div>
                    <p class="mt-2 text-gray-800 dark:text-gray-200">
                        Cargando productos...
                    </p>
                </div>

                <!-- Error State -->
                <div
                    v-else-if="error"
                    class="rounded-lg bg-red-50 p-4 text-red-800"
                >
                    <p>{{ error }}</p>
                </div>

                <!-- ========== SIDEBAR + TABLE LAYOUT ========== -->
                <div v-else-if="products.length > 0" class="flex min-h-0 gap-4">
                    <!-- Sidebar Filters -->
                    <div
                        :class="
                            showSidebarFilters ? 'block' : 'hidden md:block'
                        "
                        class="shrink-0"
                    >
                        <ProductFiltersComponent
                            :model-value="sidebarFilterValues"
                            @update:model-value="handleSidebarFilterChange"
                            :categories="categories"
                            :brands="brands"
                            :collapsible="false"
                        />
                    </div>

                    <!-- Products Table -->
                    <div
                        ref="tableContainerRef"
                        class="min-w-0 flex-1 rounded-lg bg-white shadow dark:bg-card"
                    >
                        <div>
                            <table
                                class="w-full table-fixed divide-y divide-gray-200 dark:divide-border"
                                :class="{ 'table-compact': isCompact }"
                            >
                                <thead class="bg-gray-50 dark:bg-muted">
                                    <tr>
                                        <th
                                            :style="getColumnStyle('expander')"
                                            class="relative px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                        >
                                            <span
                                                class="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                                @mousedown.stop.prevent="
                                                    startColumnResize(
                                                        $event,
                                                        'expander',
                                                    )
                                                "
                                                @click.stop.prevent
                                            ></span>
                                        </th>
                                        <th
                                            :style="getColumnStyle('image')"
                                            class="relative px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                        >
                                            Foto
                                            <span
                                                class="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                                @mousedown.stop.prevent="
                                                    startColumnResize(
                                                        $event,
                                                        'image',
                                                    )
                                                "
                                                @click.stop.prevent
                                            ></span>
                                        </th>
                                        <th
                                            @click="toggleSort('sku')"
                                            :style="getColumnStyle('sku')"
                                            class="relative cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase transition-colors select-none hover:bg-gray-100 dark:text-white dark:hover:bg-muted/50"
                                        >
                                            <span
                                                class="inline-flex items-center gap-1"
                                            >
                                                SKU
                                                <svg
                                                    v-if="sortField === 'sku'"
                                                    class="h-3 w-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        v-if="
                                                            sortDirection ===
                                                            'asc'
                                                        "
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M5 15l7-7 7 7"
                                                    />
                                                    <path
                                                        v-else
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M19 9l-7 7-7-7"
                                                    />
                                                </svg>
                                                <svg
                                                    v-else
                                                    class="h-3 w-3 opacity-30"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                                    />
                                                </svg>
                                            </span>
                                            <span
                                                class="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                                @mousedown.stop.prevent="
                                                    startColumnResize(
                                                        $event,
                                                        'sku',
                                                    )
                                                "
                                                @click.stop.prevent
                                            ></span>
                                        </th>
                                        <th
                                            @click="toggleSort('name')"
                                            :style="getColumnStyle('product')"
                                            class="relative cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase transition-colors select-none hover:bg-gray-100 dark:text-white dark:hover:bg-muted/50"
                                        >
                                            <span
                                                class="inline-flex items-center gap-1"
                                            >
                                                Producto
                                                <svg
                                                    v-if="sortField === 'name'"
                                                    class="h-3 w-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        v-if="
                                                            sortDirection ===
                                                            'asc'
                                                        "
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M5 15l7-7 7 7"
                                                    />
                                                    <path
                                                        v-else
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M19 9l-7 7-7-7"
                                                    />
                                                </svg>
                                                <svg
                                                    v-else
                                                    class="h-3 w-3 opacity-30"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                                    />
                                                </svg>
                                            </span>
                                            <span
                                                class="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                                @mousedown.stop.prevent="
                                                    startColumnResize(
                                                        $event,
                                                        'product',
                                                    )
                                                "
                                                @click.stop.prevent
                                            ></span>
                                        </th>
                                        <th
                                            :style="
                                                getColumnStyle('attributes')
                                            "
                                            class="relative px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                        >
                                            Atributos
                                            <span
                                                class="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                                @mousedown.stop.prevent="
                                                    startColumnResize(
                                                        $event,
                                                        'attributes',
                                                    )
                                                "
                                                @click.stop.prevent
                                            ></span>
                                        </th>
                                        <th
                                            :style="getColumnStyle('stock')"
                                            class="relative px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                        >
                                            Stock
                                            <span
                                                class="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                                @mousedown.stop.prevent="
                                                    startColumnResize(
                                                        $event,
                                                        'stock',
                                                    )
                                                "
                                                @click.stop.prevent
                                            ></span>
                                        </th>
                                        <th
                                            :style="getColumnStyle('actions')"
                                            class="relative px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                        >
                                            Acciones
                                            <span
                                                class="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                                @mousedown.stop.prevent="
                                                    startColumnResize(
                                                        $event,
                                                        'actions',
                                                    )
                                                "
                                                @click.stop.prevent
                                            ></span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                                >
                                    <template
                                        v-for="product in products"
                                        :key="product.id"
                                    >
                                        <!-- Parent Row -->
                                        <tr
                                            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/50"
                                            @click="toggleRow(product.id)"
                                        >
                                            <td
                                                :style="
                                                    getColumnStyle('expander')
                                                "
                                                class="px-6 py-4 text-sm"
                                            >
                                                <button
                                                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                >
                                                    <svg
                                                        v-if="
                                                            !expandedRows.has(
                                                                product.id,
                                                            )
                                                        "
                                                        class="h-5 w-5"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M9 5l7 7-7 7"
                                                        />
                                                    </svg>
                                                    <svg
                                                        v-else
                                                        class="h-5 w-5"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M19 9l-7 7-7-7"
                                                        />
                                                    </svg>
                                                </button>
                                            </td>
                                            <td
                                                :style="getColumnStyle('image')"
                                                class="px-3 py-2"
                                            >
                                                <div
                                                    class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-muted"
                                                >
                                                    <img
                                                        v-if="product.image_url"
                                                        :src="product.image_url"
                                                        :alt="product.name"
                                                        class="h-full w-full object-cover"
                                                    />
                                                    <svg
                                                        v-else
                                                        class="h-5 w-5 text-gray-300 dark:text-gray-500"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="1.5"
                                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                </div>
                                            </td>
                                            <td
                                                :style="getColumnStyle('sku')"
                                                class="overflow-hidden px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
                                            >
                                                <div class="truncate">
                                                    {{
                                                        product.sku_base ||
                                                        product.default_variant
                                                            ?.sku
                                                    }}
                                                </div>
                                                <div
                                                    v-if="
                                                        product.search_match_type &&
                                                        product.search_match_system_id
                                                    "
                                                    class="mt-1 text-[10px] font-normal text-indigo-600 dark:text-indigo-300"
                                                >
                                                    {{
                                                        product.search_match_type ===
                                                        'product'
                                                            ? 'ID producto'
                                                            : 'ID variante'
                                                    }}:
                                                    {{
                                                        product.search_match_system_id
                                                    }}
                                                </div>
                                            </td>
                                            <td
                                                :style="
                                                    getColumnStyle('product')
                                                "
                                                class="px-6 py-4 align-top"
                                            >
                                                <div
                                                    class="flex min-w-0 items-start gap-2"
                                                >
                                                    <div
                                                        class="min-w-0 text-sm leading-snug font-medium break-words whitespace-normal text-gray-900 dark:text-white"
                                                    >
                                                        {{ product.name }}
                                                    </div>
                                                    <span
                                                        v-if="
                                                            product.is_universal
                                                        "
                                                        class="inline-flex flex-shrink-0 items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 ring-1 ring-blue-500/10 ring-inset dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30"
                                                        title="Universal"
                                                    >
                                                        🌐 Universal
                                                    </span>
                                                </div>
                                                <div
                                                    v-if="product.product_line"
                                                    class="mt-1 min-w-0 text-sm leading-snug break-words whitespace-normal text-gray-500 dark:text-gray-400"
                                                >
                                                    {{
                                                        product.product_line
                                                            .name
                                                    }}
                                                </div>
                                            </td>
                                            <td
                                                :style="
                                                    getColumnStyle('attributes')
                                                "
                                                class="px-6 py-4"
                                            >
                                                <div
                                                    v-if="
                                                        collectTechnicalSpecs(
                                                            product,
                                                        ).length
                                                    "
                                                    class="flex flex-wrap gap-1"
                                                >
                                                    <span
                                                        v-for="attr in collectTechnicalSpecs(
                                                            product,
                                                        ).slice(0, 4)"
                                                        :key="
                                                            attr.name +
                                                            attr.value
                                                        "
                                                        :title="`${attr.name}: ${attr.value}${attr.unit ? ' ' + attr.unit : ''}`"
                                                        class="inline-flex rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                                    >
                                                        {{ attr.value
                                                        }}<span
                                                            v-if="attr.unit"
                                                            class="ml-0.5 text-green-600 dark:text-green-400"
                                                            >{{
                                                                attr.unit
                                                            }}</span
                                                        >
                                                    </span>
                                                </div>
                                                <span
                                                    v-else
                                                    class="text-xs text-gray-400"
                                                    >—</span
                                                >
                                            </td>
                                            <td
                                                :style="getColumnStyle('stock')"
                                                class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                                            >
                                                {{
                                                    product.total_stock ?? 'N/A'
                                                }}
                                            </td>
                                            <td
                                                :style="
                                                    getColumnStyle('actions')
                                                "
                                                class="px-6 py-4 text-right text-sm font-medium"
                                                @click.stop
                                            >
                                                <template
                                                    v-if="
                                                        archiveTab === 'active'
                                                    "
                                                >
                                                    <button
                                                        @click="
                                                            openDetail(product)
                                                        "
                                                        class="mr-3 font-medium text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:text-primary dark:hover:text-blue-300"
                                                    >
                                                        Ver Detalle
                                                    </button>
                                                    <a
                                                        :href="`/products/${product.id}/edit`"
                                                        class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:text-primary dark:hover:text-indigo-300"
                                                    >
                                                        Editar
                                                    </a>
                                                </template>
                                                <template v-else>
                                                    <button
                                                        @click="
                                                            handleRestore(
                                                                product,
                                                            )
                                                        "
                                                        class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
                                                    >
                                                        <svg
                                                            class="h-3.5 w-3.5"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                stroke-width="2"
                                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                            />
                                                        </svg>
                                                        Restaurar
                                                    </button>
                                                </template>
                                            </td>
                                        </tr>

                                        <!-- Expanded Variants Row -->
                                        <tr
                                            v-if="expandedRows.has(product.id)"
                                            class="bg-gray-50 dark:bg-muted"
                                        >
                                            <td colspan="7" class="px-6 py-4">
                                                <div class="ml-12">
                                                    <h4
                                                        class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300"
                                                    >
                                                        Variantes por Marca:
                                                    </h4>
                                                    <div
                                                        class="overflow-hidden rounded-lg border border-gray-200 dark:border-border"
                                                    >
                                                        <table
                                                            class="min-w-full divide-y divide-gray-200 dark:divide-border"
                                                        >
                                                            <thead
                                                                class="bg-gray-100 dark:bg-card"
                                                            >
                                                                <tr>
                                                                    <th
                                                                        class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                                    >
                                                                        Marca
                                                                    </th>
                                                                    <th
                                                                        class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                                    >
                                                                        Precio
                                                                    </th>
                                                                    <th
                                                                        class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                                    >
                                                                        Stock
                                                                    </th>
                                                                    <th
                                                                        class="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                                    >
                                                                        Acciones
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody
                                                                class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                                                            >
                                                                <tr
                                                                    v-for="variant in getVariants(
                                                                        product,
                                                                    )"
                                                                    :key="
                                                                        variant.id
                                                                    "
                                                                    class="hover:bg-gray-50 dark:hover:bg-muted/50"
                                                                >
                                                                    <td
                                                                        class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white"
                                                                    >
                                                                        {{
                                                                            variant
                                                                                .brand
                                                                                ?.name ||
                                                                            '—'
                                                                        }}
                                                                    </td>
                                                                    <td
                                                                        class="px-4 py-3 text-sm text-gray-900 dark:text-white"
                                                                    >
                                                                        <PriceDisplay
                                                                            v-if="
                                                                                variant.pricing
                                                                            "
                                                                            :base-price="
                                                                                Number(
                                                                                    variant
                                                                                        .pricing
                                                                                        .base_price,
                                                                                )
                                                                            "
                                                                            :tax-rate="
                                                                                Number(
                                                                                    variant
                                                                                        .pricing
                                                                                        .sale_tax_rate ??
                                                                                        variant
                                                                                            .pricing
                                                                                            .tax_rate ??
                                                                                        product
                                                                                            .pricing
                                                                                            ?.sale_tax_rate ??
                                                                                        product
                                                                                            .pricing
                                                                                            ?.tax_rate ??
                                                                                        0,
                                                                                )
                                                                            "
                                                                            size="sm"
                                                                        />
                                                                        <PriceDisplay
                                                                            v-else-if="
                                                                                product.pricing
                                                                            "
                                                                            :base-price="
                                                                                Number(
                                                                                    product
                                                                                        .pricing
                                                                                        .base_price,
                                                                                )
                                                                            "
                                                                            :tax-rate="
                                                                                Number(
                                                                                    product
                                                                                        .pricing
                                                                                        .sale_tax_rate ??
                                                                                        product
                                                                                            .pricing
                                                                                            .tax_rate ??
                                                                                        0,
                                                                                )
                                                                            "
                                                                            size="sm"
                                                                        />
                                                                        <div
                                                                            v-else
                                                                            class="text-gray-400"
                                                                        >
                                                                            —
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        class="px-4 py-3 text-sm text-gray-900 dark:text-white"
                                                                    >
                                                                        {{
                                                                            variant.total_stock ??
                                                                            'N/A'
                                                                        }}
                                                                    </td>
                                                                    <td
                                                                        class="px-4 py-3 text-right text-sm font-medium"
                                                                    >
                                                                        <button
                                                                            @click="
                                                                                addVariantToCart(
                                                                                    product,
                                                                                    variant,
                                                                                )
                                                                            "
                                                                            class="mr-2 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all"
                                                                            :class="
                                                                                addedFeedback ===
                                                                                variant.id
                                                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                                            "
                                                                        >
                                                                            <template
                                                                                v-if="
                                                                                    addedFeedback ===
                                                                                    variant.id
                                                                                "
                                                                            >
                                                                                <Check
                                                                                    class="h-3 w-3"
                                                                                />
                                                                                Agregado
                                                                            </template>
                                                                            <template
                                                                                v-else
                                                                            >
                                                                                <ShoppingCart
                                                                                    class="h-3 w-3"
                                                                                />
                                                                                Agregar
                                                                            </template>
                                                                        </button>
                                                                        <button
                                                                            @click="
                                                                                openDetail(
                                                                                    product,
                                                                                )
                                                                            "
                                                                            class="mr-1 inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-muted dark:hover:text-primary"
                                                                            title="Ver detalles del producto"
                                                                        >
                                                                            <Info
                                                                                class="h-3.5 w-3.5"
                                                                            />
                                                                        </button>
                                                                        <a
                                                                            :href="`/products/${product.id}/edit?variant=${variant.id}`"
                                                                            class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:text-primary dark:hover:text-indigo-300"
                                                                        >
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
                            class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-border dark:bg-card"
                        >
                            <div class="flex flex-1 justify-between sm:hidden">
                                <button
                                    @click="handlePrevPage"
                                    :disabled="currentPage === 1"
                                    class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                                >
                                    Anterior
                                </button>
                                <button
                                    @click="handleNextPage"
                                    :disabled="currentPage === lastPage"
                                    class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                                >
                                    Siguiente
                                </button>
                            </div>
                            <div
                                class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between"
                            >
                                <div>
                                    <p
                                        class="text-sm text-gray-900 dark:text-white"
                                    >
                                        Mostrando
                                        <span class="font-medium">{{
                                            (currentPage - 1) * perPage + 1
                                        }}</span>
                                        a
                                        <span class="font-medium">{{
                                            Math.min(
                                                currentPage * perPage,
                                                total,
                                            )
                                        }}</span>
                                        de
                                        <span class="font-medium">{{
                                            total
                                        }}</span>
                                        productos
                                    </p>
                                </div>
                                <div class="flex gap-2">
                                    <button
                                        @click="handlePrevPage"
                                        :disabled="currentPage === 1"
                                        class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                                    >
                                        Anterior
                                    </button>
                                    <span
                                        class="flex items-center px-4 text-sm text-gray-900 dark:text-white"
                                    >
                                        Página {{ currentPage }} de
                                        {{ lastPage }}
                                    </span>
                                    <button
                                        @click="handleNextPage"
                                        :disabled="currentPage === lastPage"
                                        class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty State -->
                <div
                    v-else
                    class="rounded-lg bg-white py-12 text-center shadow"
                >
                    <svg
                        class="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">
                        No hay productos
                    </h3>
                    <p class="mt-1 text-sm text-gray-500">
                        Comienza creando un nuevo producto.
                    </p>
                    <div class="mt-6">
                        <a
                            href="/products/create"
                            class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            Nuevo Producto
                        </a>
                    </div>
                </div>
            </template>

            <!-- Universal Product Detail Modal (accessible from both Table and Catalog views) -->
            <ProductDetailModal
                v-if="selectedProduct"
                :product="selectedProduct"
                @close="closeDetail"
                @view-alternative="(p: any) => (selectedProduct = p)"
            />
        </div>
    </AppLayout>
</template>

<style scoped>
.table-compact > thead > tr > th {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
}
.table-compact > tbody > tr > td {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
}
</style>
