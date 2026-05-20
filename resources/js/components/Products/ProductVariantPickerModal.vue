<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
    ChevronDown,
    ChevronRight,
    Eye,
    Filter,
    Package,
    Search,
    X,
} from 'lucide-vue-next';
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue';
import ProductFilters from '@/components/Products/ProductFilters.vue';
import type { ProductFilterValues } from '@/components/Products/ProductFilters.vue';
import ProductSort from '@/components/Products/ProductSort.vue';
import PriceDisplay from '@/components/ui/PriceDisplay.vue';
import apiClient from '@/services/api/client';
import { usePosSettings } from '@/composables/usePosSettings';
import type { Product, ProductVariant } from '@/types/product';
import type { ProductVariantSelection } from '@/types/product-variant-picker';

interface CategoryOption {
    id: number;
    name: string;
}

interface BrandOption {
    id: number;
    name: string;
}

interface SupplierProductLink {
    product_id: number;
    variant_id?: number | null;
    supplier_cost?: number | string | null;
    lead_time_days?: number | null;
    minimum_order_quantity?: number | null;
    is_preferred?: boolean;
}

const props = withDefaults(
    defineProps<{
        show: boolean;
        products: Product[];
        searchQuery?: string;
        totalCount?: number;
        hasMore?: boolean;
        loadingMore?: boolean;
        loading?: boolean;
        categories?: CategoryOption[];
        brands?: BrandOption[];
        title?: string;
        confirmLabel?: string;
        context?: 'pos' | 'purchase' | 'inventory' | 'supplier';
        selectedSupplierId?: number | null;
        selectedSupplierBrandIds?: number[];
        selectedSupplierProductLinks?: SupplierProductLink[];
        autoExpandMatches?: boolean;
    }>(),
    {
        searchQuery: '',
        totalCount: 0,
        hasMore: false,
        loadingMore: false,
        loading: false,
        categories: () => [],
        brands: () => [],
        title: 'Seleccionar Productos',
        confirmLabel: 'Agregar',
        context: 'pos',
        selectedSupplierId: null,
        selectedSupplierBrandIds: () => [],
        selectedSupplierProductLinks: () => [],
        autoExpandMatches: true,
    },
);

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'confirm', selections: ProductVariantSelection[]): void;
    (e: 'load-more'): void;
    (
        e: 'search',
        filters: {
            query: string;
            category_ids?: number[];
            brand_ids?: number[];
            min_price?: number;
            max_price?: number;
            in_stock?: boolean;
            sort?: string;
        },
    ): void;
}>();

const searchInputRef = ref<HTMLInputElement | null>(null);
const internalSearchQuery = ref('');
const showMobileFilters = ref(false);
const showOnlySupplied = ref(false);
const sortValue = ref('name_asc');
const expandedRows = ref<Set<number>>(new Set());
const selectedQuantities = ref<Record<string, number>>({});
const selectedSnapshots = ref<
    Record<string, { product: Product; variant: ProductVariant | null }>
>({});
const selectedProductForDetail = ref<Product | null>(null);
const loadingProductDetail = ref(false);
const { currentWarehouseId } = usePosSettings();

const defaultFilters = (): ProductFilterValues => ({
    sku: '',
    category_ids: [],
    brand_ids: [],
    min_price: undefined,
    max_price: undefined,
    in_stock: false,
});

const filterValues = ref<ProductFilterValues>(defaultFilters());

const rowKey = (product: Product, variant: ProductVariant | null): string =>
    `${product.id}:${variant?.id ?? 'default'}`;

const variantsFor = (product: Product): Array<ProductVariant | null> => {
    if (product.variants?.length) return product.variants;
    if (product.default_variant) return [product.default_variant];
    return [null];
};

const activeInventoryForVariant = (variant: ProductVariant | null) => {
    const inventory = variant?.inventory ?? [];
    const warehouseId = currentWarehouseId.value
        ? Number(currentWarehouseId.value)
        : null;

    return (
        inventory.find(
            (item) =>
                warehouseId &&
                Number(item.warehouse?.id ?? item.warehouse_id) === warehouseId,
        ) ??
        inventory.find(
            (item) =>
                Number(
                    item.current_sale_price ?? item.fifo_sale_price_current,
                ) > 0 ||
                Number(item.current_cost ?? item.fifo_cost_current) > 0,
        ) ??
        null
    );
};

const priceFor = (product: Product, variant: ProductVariant | null): number =>
    Number(
        activeInventoryForVariant(variant)?.current_sale_price ??
            activeInventoryForVariant(variant)?.fifo_sale_price_current ??
            variant?.pricing?.base_price ??
            product.pricing?.base_price ??
            product.default_variant?.pricing?.base_price ??
            0,
    );

const taxRateFor = (product: Product, variant: ProductVariant | null): number =>
    Number(
        variant?.pricing?.sale_tax_rate ??
            variant?.pricing?.tax_rate ??
            product.pricing?.sale_tax_rate ??
            product.pricing?.tax_rate ??
            0,
    );

const costFor = (product: Product, variant: ProductVariant | null): number => {
    const relation = supplierRelationFor(product, variant);

    return Number(
        relation?.supplier_cost ??
            activeInventoryForVariant(variant)?.current_cost ??
            activeInventoryForVariant(variant)?.fifo_cost_current ??
            variant?.pricing?.cost_base ??
            product.pricing?.cost_base ??
            variant?.pricing?.cost ??
            product.pricing?.cost ??
            priceFor(product, variant),
    );
};

const miscCostFor = (
    product: Product,
    variant: ProductVariant | null,
): number => {
    return Number(
        variant?.pricing?.cost_miscellaneous ??
            product.pricing?.cost_miscellaneous ??
            0,
    );
};

const stockFor = (product: Product, variant: ProductVariant | null): number =>
    Number(variant?.total_stock ?? product.total_stock ?? 0);

const supplierProductLinkFor = (
    product: Product,
    variant: ProductVariant | null,
): SupplierProductLink | null => {
    if (!props.selectedSupplierId) {
        return null;
    }

    const variantId = variant?.id ? Number(variant.id) : null;

    const directVariantLink = props.selectedSupplierProductLinks.find(
        (link) =>
            variantId !== null &&
            Number(link.variant_id) === variantId &&
            Number(link.product_id) === Number(product.id),
    );

    if (directVariantLink) {
        return directVariantLink;
    }

    return (
        props.selectedSupplierProductLinks.find(
            (link) =>
                Number(link.product_id) === Number(product.id) &&
                (link.variant_id === null || link.variant_id === undefined),
        ) ?? null
    );
};

const supplierBrandMatches = (
    product: Product,
    variant: ProductVariant | null,
): boolean => {
    if (!props.selectedSupplierId || !props.selectedSupplierBrandIds.length) {
        return false;
    }

    const brandId =
        variant?.brand_id ?? variant?.brand?.id ?? product.brand?.id ?? null;

    return brandId !== null
        ? props.selectedSupplierBrandIds.some((id) => Number(id) === brandId)
        : false;
};

const supplierRelationFor = (
    product: Product,
    variant: ProductVariant | null,
): any => {
    if (!props.selectedSupplierId) {
        return null;
    }

    if (variant && Array.isArray((variant as any).suppliers)) {
        const directRelation = (variant as any).suppliers.find(
            (supplier: any) =>
                Number(supplier.id) === Number(props.selectedSupplierId),
        );

        if (directRelation) {
            return directRelation;
        }
    }

    const productLink = supplierProductLinkFor(product, variant);
    if (productLink) {
        return productLink;
    }

    if (supplierBrandMatches(product, variant)) {
        return {
            id: props.selectedSupplierId,
            supplier_cost: null,
            lead_time_days: null,
            minimum_order_quantity: null,
            is_brand_match: true,
        };
    }

    return null;
};

const minimumQuantityFor = (
    product: Product,
    variant: ProductVariant | null,
): number => {
    if (props.context !== 'purchase') return 1;

    const relation = supplierRelationFor(product, variant);
    return Math.max(1, Number(relation?.minimum_order_quantity ?? 1) || 1);
};

const isSelected = (
    product: Product,
    variant: ProductVariant | null,
): boolean => (selectedQuantities.value[rowKey(product, variant)] ?? 0) > 0;

const selectedCount = computed(
    () => Object.keys(selectedQuantities.value).length,
);

const visibleProducts = computed(() => {
    if (!showOnlySupplied.value || !props.selectedSupplierId) {
        return props.products;
    }

    return props.products.filter((product) =>
        variantsFor(product).some((variant) =>
            Boolean(supplierRelationFor(product, variant)),
        ),
    );
});

const selectedSelections = computed<ProductVariantSelection[]>(() =>
    Object.entries(selectedSnapshots.value).reduce<ProductVariantSelection[]>(
        (selections, [key, snapshot]) => {
            const quantity = selectedQuantities.value[key];

            if (!quantity) return selections;

            const relation = supplierRelationFor(
                snapshot.product,
                snapshot.variant,
            );

            selections.push({
                product: snapshot.product,
                variant: snapshot.variant,
                quantity,
                unitCost: costFor(snapshot.product, snapshot.variant),
                miscCost: miscCostFor(snapshot.product, snapshot.variant),
                supplierMatch: props.selectedSupplierId
                    ? !!relation
                    : undefined,
                minimumOrderQuantity: relation?.minimum_order_quantity ?? null,
                leadTimeDays: relation?.lead_time_days ?? null,
            });

            return selections;
        },
        [],
    ),
);

const toggleProduct = (productId: number): void => {
    const next = new Set(expandedRows.value);

    if (next.has(productId)) {
        next.delete(productId);
    } else {
        next.add(productId);
    }

    expandedRows.value = next;
};

const toggleVariant = (
    product: Product,
    variant: ProductVariant | null,
): void => {
    const key = rowKey(product, variant);
    const next = { ...selectedQuantities.value };

    if (next[key]) {
        delete next[key];
        const nextSnapshots = { ...selectedSnapshots.value };
        delete nextSnapshots[key];
        selectedSnapshots.value = nextSnapshots;
    } else {
        next[key] = minimumQuantityFor(product, variant);
        selectedSnapshots.value = {
            ...selectedSnapshots.value,
            [key]: { product, variant },
        };
        expandedRows.value = new Set([...expandedRows.value, product.id]);
    }

    selectedQuantities.value = next;
};

const setQuantity = (
    product: Product,
    variant: ProductVariant | null,
    value: number,
): void => {
    const key = rowKey(product, variant);
    const quantity = Math.max(1, Number(value) || 1);

    if (!selectedQuantities.value[key]) return;

    selectedQuantities.value = {
        ...selectedQuantities.value,
        [key]: quantity,
    };
};

const emitFilters = (): void => {
    const filters = filterValues.value;
    const query = (internalSearchQuery.value || filters.sku || '').trim();

    emit('search', {
        query,
        category_ids: filters.category_ids.length
            ? filters.category_ids
            : undefined,
        brand_ids: filters.brand_ids.length ? filters.brand_ids : undefined,
        min_price: filters.min_price ?? undefined,
        max_price: filters.max_price ?? undefined,
        in_stock: filters.in_stock || undefined,
        sort: sortValue.value,
    });
};

const handleFilterChange = (newFilters: ProductFilterValues): void => {
    filterValues.value = newFilters;
    if ((newFilters.sku ?? '') !== internalSearchQuery.value) {
        internalSearchQuery.value = newFilters.sku ?? '';
    }
    emitFilters();
};

const openProductDetail = async (
    product: Product,
    event: Event,
): Promise<void> => {
    event.stopPropagation();
    loadingProductDetail.value = true;

    try {
        const { data } = await apiClient.get(`/products/${product.id}`);
        selectedProductForDetail.value = data.data ?? data;
    } finally {
        loadingProductDetail.value = false;
    }
};

const submit = (): void => {
    if (!selectedSelections.value.length) return;
    emit('confirm', selectedSelections.value);
};

const handleBackdropClick = (): void => {
    if (
        confirm(
            'Vas a salir del selector de productos. Se perdera la seleccion actual. Deseas cerrar el modal?',
        )
    ) {
        emit('close');
    }
};

watch(
    () => props.show,
    (isOpen) => {
        if (!isOpen) return;

        selectedQuantities.value = {};
        selectedSnapshots.value = {};
        internalSearchQuery.value = props.searchQuery;
        filterValues.value = defaultFilters();
        filterValues.value.sku = props.searchQuery;
        sortValue.value = 'name_asc';
        showOnlySupplied.value = false;
        showMobileFilters.value = false;
        expandedRows.value = new Set();
        nextTick(() => searchInputRef.value?.focus());
    },
);

watch(internalSearchQuery, (value) => {
    if (filterValues.value.sku !== value) {
        filterValues.value = {
            ...filterValues.value,
            sku: value,
        };
    }
});

watch(sortValue, emitFilters);

watch(
    () => props.selectedSupplierId,
    (supplierId) => {
        if (!supplierId) {
            showOnlySupplied.value = false;
        }
    },
);

watch(
    () => props.products,
    (products) => {
        const nextSnapshots = { ...selectedSnapshots.value };

        products.forEach((product) => {
            variantsFor(product).forEach((variant) => {
                const key = rowKey(product, variant);

                if (selectedQuantities.value[key]) {
                    nextSnapshots[key] = { product, variant };
                }
            });
        });

        selectedSnapshots.value = nextSnapshots;

        if (
            !props.show ||
            !props.autoExpandMatches ||
            !internalSearchQuery.value.trim()
        )
            return;

        expandedRows.value = new Set(products.map((product) => product.id));
    },
);
</script>

<template>
    <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
    >
        <div
            v-if="show"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            @click.self="handleBackdropClick"
        >
            <div
                class="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 outline-none dark:bg-card dark:ring-gray-700"
            >
                <div
                    class="shrink-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-border dark:bg-card"
                >
                    <div class="mb-3 flex items-start justify-between gap-4">
                        <div>
                            <h2
                                class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"
                            >
                                <Search class="h-5 w-5 text-indigo-500" />
                                {{ title }}
                            </h2>
                            <p class="mt-0.5 text-xs text-gray-500">
                                {{ visibleProducts.length
                                }}<span
                                    v-if="totalCount > visibleProducts.length"
                                >
                                    de {{ totalCount }}</span
                                >
                                resultado{{ totalCount !== 1 ? 's' : '' }}
                            </p>
                        </div>
                        <button
                            type="button"
                            class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted/50"
                            @click="emit('close')"
                        >
                            <X class="h-5 w-5" />
                        </button>
                    </div>

                    <div class="flex gap-2">
                        <div class="relative flex-1">
                            <Search
                                class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                ref="searchInputRef"
                                v-model="internalSearchQuery"
                                type="text"
                                placeholder="Buscar por nombre, SKU, VIN, OEM, categoria..."
                                class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-3 pl-10 text-sm text-gray-700 transition-shadow focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-foreground dark:placeholder:text-gray-400"
                                @keyup.enter="emitFilters"
                            />
                        </div>
                        <ProductSort v-model="sortValue" />
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 md:hidden dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                            :class="
                                showMobileFilters
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
                                    : ''
                            "
                            @click="showMobileFilters = !showMobileFilters"
                        >
                            <Filter class="h-4 w-4" />
                            Filtros
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                            @click="emitFilters"
                        >
                            <Search class="h-4 w-4" />
                            Buscar
                        </button>
                    </div>
                </div>

                <div class="flex min-h-0 flex-1 overflow-hidden">
                    <div
                        class="shrink-0 overflow-y-auto border-r border-gray-100 dark:border-border"
                        :class="showMobileFilters ? 'block' : 'hidden md:block'"
                    >
                        <div
                            v-if="selectedSupplierId"
                            class="border-b border-gray-100 px-4 py-4 dark:border-border"
                        >
                            <div
                                class="mb-3 flex items-center justify-between gap-3"
                            >
                                <div>
                                    <p
                                        class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Proveedor
                                    </p>
                                    <p
                                        class="mt-1 text-xs text-gray-400 dark:text-gray-500"
                                    >
                                        Filtrar variantes vinculadas
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    :aria-checked="showOnlySupplied"
                                    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-card"
                                    :class="
                                        showOnlySupplied
                                            ? 'bg-indigo-600'
                                            : 'bg-gray-200 dark:bg-muted'
                                    "
                                    @click="
                                        showOnlySupplied = !showOnlySupplied
                                    "
                                >
                                    <span
                                        class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                                        :class="
                                            showOnlySupplied
                                                ? 'translate-x-5'
                                                : 'translate-x-0.5'
                                        "
                                    ></span>
                                </button>
                            </div>
                            <p class="text-sm text-gray-700 dark:text-gray-200">
                                {{
                                    showOnlySupplied
                                        ? 'Solo suministrados'
                                        : 'Todos'
                                }}
                            </p>
                        </div>
                        <ProductFilters
                            :model-value="filterValues"
                            :categories="categories"
                            :brands="brands"
                            :collapsible="false"
                            @update:model-value="handleFilterChange"
                        />
                    </div>

                    <div class="min-h-0 flex-1 overflow-y-auto">
                        <div
                            v-if="loading"
                            class="flex flex-col items-center justify-center px-6 py-16 text-center"
                        >
                            <div
                                class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent"
                            ></div>
                            <p class="mt-3 text-sm text-gray-500">
                                Buscando productos...
                            </p>
                        </div>

                        <div
                            v-else-if="visibleProducts.length === 0"
                            class="flex flex-col items-center justify-center px-6 py-16 text-center"
                        >
                            <Package class="mb-3 h-12 w-12 text-gray-300" />
                            <p class="text-sm font-medium text-gray-500">
                                No se encontraron productos
                            </p>
                            <p class="mt-1 text-xs text-gray-400">
                                Intenta con otro termino de busqueda
                            </p>
                        </div>

                        <table v-else class="w-full text-left">
                            <thead
                                class="dark:bg-gray-750 sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-border"
                            >
                                <tr>
                                    <th class="w-12 px-4 py-3"></th>
                                    <th class="w-14 px-2 py-3"></th>
                                    <th
                                        class="px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Producto
                                    </th>
                                    <th
                                        class="px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        SKU
                                    </th>
                                    <th
                                        class="px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Specs
                                    </th>
                                    <th
                                        class="px-3 py-3 text-center text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Stock
                                    </th>
                                    <th
                                        class="px-3 py-3 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Precio
                                    </th>
                                    <th
                                        class="w-16 px-3 py-3 text-center text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-gray-100 dark:divide-border/50"
                            >
                                <template
                                    v-for="product in visibleProducts"
                                    :key="product.id"
                                >
                                    <tr
                                        class="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-muted/30"
                                        @click="toggleProduct(product.id)"
                                    >
                                        <td class="px-4 py-3 text-center">
                                            <button
                                                type="button"
                                                class="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-muted"
                                            >
                                                <ChevronDown
                                                    v-if="
                                                        expandedRows.has(
                                                            product.id,
                                                        )
                                                    "
                                                    class="h-4 w-4"
                                                />
                                                <ChevronRight
                                                    v-else
                                                    class="h-4 w-4"
                                                />
                                            </button>
                                        </td>
                                        <td class="px-2 py-3">
                                            <div
                                                class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-muted"
                                            >
                                                <img
                                                    v-if="product.image_url"
                                                    :src="product.image_url"
                                                    :alt="product.name"
                                                    class="h-full w-full object-contain p-0.5"
                                                />
                                                <Package
                                                    v-else
                                                    class="h-5 w-5 text-gray-300"
                                                />
                                            </div>
                                        </td>
                                        <td class="max-w-[280px] px-3 py-3">
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <p
                                                    class="truncate text-sm font-medium text-gray-900 dark:text-white"
                                                >
                                                    {{ product.name }}
                                                </p>
                                                <span
                                                    v-if="product.is_universal"
                                                    class="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 ring-1 ring-blue-500/10 ring-inset dark:bg-blue-900/30 dark:text-blue-400"
                                                    >Universal</span
                                                >
                                            </div>
                                            <p
                                                v-if="
                                                    product.category?.name ||
                                                    product.brand?.name
                                                "
                                                class="mt-0.5 truncate text-[11px] text-gray-400"
                                            >
                                                <span
                                                    v-if="
                                                        product.category?.name
                                                    "
                                                    >{{
                                                        product.category.name
                                                    }}</span
                                                >
                                                <span
                                                    v-if="
                                                        product.category
                                                            ?.name &&
                                                        product.brand?.name
                                                    "
                                                >
                                                    ·
                                                </span>
                                                <span
                                                    v-if="product.brand?.name"
                                                    >{{
                                                        product.brand.name
                                                    }}</span
                                                >
                                            </p>
                                        </td>
                                        <td class="px-3 py-3">
                                            <span
                                                class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-muted dark:text-gray-400"
                                            >
                                                {{
                                                    product.sku_base ||
                                                    product.default_variant
                                                        ?.sku ||
                                                    'N/A'
                                                }}
                                            </span>
                                        </td>
                                        <td class="px-3 py-3">
                                            <div
                                                v-if="
                                                    product.key_attributes
                                                        ?.length
                                                "
                                                class="flex max-w-[180px] flex-wrap gap-1"
                                            >
                                                <span
                                                    v-for="attr in product.key_attributes.slice(
                                                        0,
                                                        4,
                                                    )"
                                                    :key="`${attr.name}-${attr.value}`"
                                                    :title="attr.name"
                                                    class="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-gray-600 dark:bg-muted dark:text-gray-400"
                                                >
                                                    {{ attr.value
                                                    }}{{
                                                        attr.unit
                                                            ? ' ' + attr.unit
                                                            : ''
                                                    }}
                                                </span>
                                            </div>
                                            <span
                                                v-else
                                                class="text-[10px] text-gray-300"
                                                >N/A</span
                                            >
                                        </td>
                                        <td class="px-3 py-3 text-center">
                                            <span
                                                class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                                                :class="
                                                    stockFor(product, null) > 5
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : stockFor(
                                                                product,
                                                                null,
                                                            ) > 0
                                                          ? 'bg-amber-100 text-amber-700'
                                                          : 'bg-red-100 text-red-700'
                                                "
                                            >
                                                {{ stockFor(product, null) }}
                                            </span>
                                        </td>
                                        <td class="px-3 py-3 text-right">
                                            <PriceDisplay
                                                :base-price="
                                                    priceFor(
                                                        product,
                                                        product.default_variant ??
                                                            null,
                                                    )
                                                "
                                                :tax-rate="
                                                    taxRateFor(
                                                        product,
                                                        product.default_variant ??
                                                            null,
                                                    )
                                                "
                                                size="sm"
                                            />
                                        </td>
                                        <td
                                            class="px-3 py-3 text-center"
                                            @click.stop
                                        >
                                            <button
                                                type="button"
                                                class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                                                title="Ver detalle del producto"
                                                :disabled="loadingProductDetail"
                                                @click="
                                                    openProductDetail(
                                                        product,
                                                        $event,
                                                    )
                                                "
                                            >
                                                <Eye class="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>

                                    <tr
                                        v-if="expandedRows.has(product.id)"
                                        class="bg-gray-50 dark:bg-muted/40"
                                    >
                                        <td colspan="8" class="px-6 py-4">
                                            <div
                                                class="ml-8 overflow-hidden rounded-lg border border-gray-200 dark:border-border"
                                            >
                                                <table class="w-full">
                                                    <thead
                                                        class="bg-gray-100 dark:bg-card"
                                                    >
                                                        <tr>
                                                            <th
                                                                class="w-12 px-4 py-2"
                                                            ></th>
                                                            <th
                                                                class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                            >
                                                                Marca
                                                            </th>
                                                            <th
                                                                class="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                            >
                                                                SKU
                                                            </th>
                                                            <th
                                                                class="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                            >
                                                                Stock
                                                            </th>
                                                            <th
                                                                class="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                            >
                                                                {{
                                                                    context ===
                                                                    'purchase'
                                                                        ? 'Costo'
                                                                        : 'Precio'
                                                                }}
                                                            </th>
                                                            <th
                                                                class="w-28 px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase dark:text-gray-400"
                                                            >
                                                                Cantidad
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody
                                                        class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                                                    >
                                                        <tr
                                                            v-for="variant in variantsFor(
                                                                product,
                                                            )"
                                                            :key="
                                                                rowKey(
                                                                    product,
                                                                    variant,
                                                                )
                                                            "
                                                            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/50"
                                                            :class="
                                                                isSelected(
                                                                    product,
                                                                    variant,
                                                                )
                                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                                                    : ''
                                                            "
                                                            @click="
                                                                toggleVariant(
                                                                    product,
                                                                    variant,
                                                                )
                                                            "
                                                        >
                                                            <td
                                                                class="px-4 py-3 text-center"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                                    :checked="
                                                                        isSelected(
                                                                            product,
                                                                            variant,
                                                                        )
                                                                    "
                                                                    @click.stop
                                                                    @change="
                                                                        toggleVariant(
                                                                            product,
                                                                            variant,
                                                                        )
                                                                    "
                                                                />
                                                            </td>
                                                            <td
                                                                class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white"
                                                            >
                                                                <div
                                                                    class="flex items-center gap-2"
                                                                >
                                                                    <span>{{
                                                                        variant
                                                                            ?.brand
                                                                            ?.name ||
                                                                        product
                                                                            .brand
                                                                            ?.name ||
                                                                        'Generico'
                                                                    }}</span>
                                                                    <span
                                                                        v-if="
                                                                            selectedSupplierId &&
                                                                            supplierRelationFor(
                                                                                product,
                                                                                variant,
                                                                            )
                                                                        "
                                                                        class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                                                                        >Suministrado</span
                                                                    >
                                                                    <span
                                                                        v-else-if="
                                                                            selectedSupplierId
                                                                        "
                                                                        class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                                                                        >No
                                                                        vinculado</span
                                                                    >
                                                                </div>
                                                            </td>
                                                            <td
                                                                class="px-3 py-3"
                                                            >
                                                                <span
                                                                    class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-muted dark:text-gray-400"
                                                                >
                                                                    {{
                                                                        variant?.sku ||
                                                                        product.sku_base ||
                                                                        'N/A'
                                                                    }}
                                                                </span>
                                                            </td>
                                                            <td
                                                                class="px-3 py-3 text-center"
                                                            >
                                                                <span
                                                                    class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                                                                    :class="
                                                                        stockFor(
                                                                            product,
                                                                            variant,
                                                                        ) > 5
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : stockFor(
                                                                                    product,
                                                                                    variant,
                                                                                ) >
                                                                                0
                                                                              ? 'bg-amber-100 text-amber-700'
                                                                              : 'bg-red-100 text-red-700'
                                                                    "
                                                                >
                                                                    {{
                                                                        stockFor(
                                                                            product,
                                                                            variant,
                                                                        )
                                                                    }}
                                                                </span>
                                                            </td>
                                                            <td
                                                                class="px-3 py-3 text-right"
                                                            >
                                                                <PriceDisplay
                                                                    :base-price="
                                                                        context ===
                                                                        'purchase'
                                                                            ? costFor(
                                                                                  product,
                                                                                  variant,
                                                                              )
                                                                            : priceFor(
                                                                                  product,
                                                                                  variant,
                                                                              )
                                                                    "
                                                                    :tax-rate="
                                                                        context ===
                                                                        'purchase'
                                                                            ? 0
                                                                            : taxRateFor(
                                                                                  product,
                                                                                  variant,
                                                                              )
                                                                    "
                                                                    size="sm"
                                                                />
                                                            </td>
                                                            <td
                                                                class="px-3 py-3 text-center"
                                                                @click.stop
                                                            >
                                                                <input
                                                                    v-if="
                                                                        isSelected(
                                                                            product,
                                                                            variant,
                                                                        )
                                                                    "
                                                                    type="number"
                                                                    min="1"
                                                                    class="w-20 rounded-lg border border-indigo-300 bg-white px-2 py-1.5 text-center text-sm font-semibold text-indigo-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none dark:border-indigo-600 dark:bg-muted dark:text-indigo-300"
                                                                    :value="
                                                                        selectedQuantities[
                                                                            rowKey(
                                                                                product,
                                                                                variant,
                                                                            )
                                                                        ]
                                                                    "
                                                                    @input="
                                                                        setQuantity(
                                                                            product,
                                                                            variant,
                                                                            Number(
                                                                                (
                                                                                    $event.target as HTMLInputElement
                                                                                )
                                                                                    .value,
                                                                            ),
                                                                        )
                                                                    "
                                                                />
                                                                <span
                                                                    v-else
                                                                    class="text-xs text-gray-300"
                                                                    >N/A</span
                                                                >
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>

                        <div
                            v-if="hasMore"
                            class="flex justify-center border-t border-gray-100 py-4 dark:border-border/50"
                        >
                            <button
                                type="button"
                                class="rounded-lg border border-indigo-200 bg-indigo-50 px-6 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                                :disabled="loadingMore"
                                @click="emit('load-more')"
                            >
                                {{
                                    loadingMore
                                        ? 'Cargando...'
                                        : 'Cargar mas resultados'
                                }}
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    class="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white px-6 py-4 dark:border-border dark:bg-card"
                >
                    <span class="text-sm text-gray-500">
                        <span
                            class="font-semibold text-indigo-600 dark:text-primary"
                            >{{ selectedCount }}</span
                        >
                        variante{{
                            selectedCount !== 1 ? 's' : ''
                        }}
                        seleccionada{{ selectedCount !== 1 ? 's' : '' }}
                    </span>
                    <div class="flex gap-3">
                        <button
                            type="button"
                            class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                            @click="emit('close')"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            class="rounded-xl px-6 py-2 text-sm font-bold text-white transition-all"
                            :class="
                                selectedCount > 0
                                    ? 'bg-indigo-600 shadow-sm hover:bg-indigo-700 hover:shadow-md dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90'
                                    : 'cursor-not-allowed bg-gray-300 opacity-50 dark:bg-gray-600'
                            "
                            :disabled="selectedCount === 0"
                            @click="submit"
                        >
                            {{ confirmLabel }} ({{ selectedCount }})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Transition>

    <ProductDetailModal
        v-if="selectedProductForDetail"
        :product="selectedProductForDetail"
        @close="selectedProductForDetail = null"
    />
</template>
