<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import {
    AlertCircle,
    ArrowLeft,
    Box,
    History,
    Package,
    Pencil,
    RefreshCw,
    Search,
    Warehouse,
    X,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import VariantFifoHistoryPanel from '@/components/Products/VariantFifoHistoryPanel.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { productsApi } from '@/services/api/products';
import { type BreadcrumbItem } from '@/types';
import type {
    ProductDetail,
    ProductInventory,
    ProductVariant,
    VariantInventory,
} from '@/types/product';

type WarehouseOption = {
    id: number;
    name: string;
    code?: string;
};

type VariantStatus = 'out_of_stock' | 'low_stock' | 'normal' | 'optimal';
type StockFilter = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';

const props = defineProps<{
    productId: number;
}>();

const { currentWarehouseId, getDefaultWarehouseId, initWarehouse } =
    usePosSettings();

const product = ref<ProductDetail | null>(null);
const warehouses = ref<WarehouseOption[]>([]);
const selectedWarehouseId = ref<number | null>(null);
const selectedVariantId = ref<number | null>(null);
const historyRefreshKey = ref(0);
const variantSearch = ref('');
const stockFilter = ref<StockFilter>('all');
const dateFrom = ref('');
const dateTo = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    {
        title: product.value?.name ?? 'Producto',
        href: `/inventory/products/${props.productId}`,
    },
]);

const variants = computed<ProductVariant[]>(
    () => product.value?.variants ?? [],
);

const selectedVariant = computed<ProductVariant | null>(() => {
    return (
        variants.value.find(
            (variant) => Number(variant.id) === Number(selectedVariantId.value),
        ) ??
        variants.value[0] ??
        null
    );
});

const currentWarehouse = computed(() => {
    return (
        warehouses.value.find(
            (warehouse) =>
                Number(warehouse.id) === Number(selectedWarehouseId.value),
        ) ?? null
    );
});

const productWarehouseOptions = computed<WarehouseOption[]>(() => {
    const fromInventory =
        product.value?.inventory
            ?.map((item) => item.warehouse)
            .filter(Boolean)
            .map((warehouse: any) => ({
                id: Number(warehouse.id),
                name: warehouse.name,
                code: warehouse.code,
            })) ?? [];

    const seen = new Set<number>();

    return [...warehouses.value, ...fromInventory].filter((warehouse) => {
        if (!warehouse?.id || seen.has(Number(warehouse.id))) {
            return false;
        }

        seen.add(Number(warehouse.id));
        return true;
    });
});

const variantRows = computed(() =>
    variants.value.map((variant) => {
        const inventory = inventoryForVariant(variant);
        const available = inventoryAvailable(inventory);
        const reserved = inventoryReserved(inventory);
        const currentCost = inventoryCurrentCost(inventory);
        const inventoryValue = inventoryValueFor(
            inventory,
            available,
            currentCost,
        );

        return {
            variant,
            inventory,
            available,
            reserved,
            currentCost,
            inventoryValue,
            status: statusForInventory(inventory, available),
        };
    }),
);

const selectedVariantRow = computed(() => {
    return (
        variantRows.value.find(
            (row) => Number(row.variant.id) === Number(selectedVariantId.value),
        ) ??
        variantRows.value[0] ??
        null
    );
});

const filteredVariantRows = computed(() => {
    const search = variantSearch.value.trim().toLowerCase();

    return variantRows.value.filter((row) => {
        const matchesSearch =
            !search ||
            row.variant.sku?.toLowerCase().includes(search) ||
            row.variant.brand?.name?.toLowerCase().includes(search);

        const matchesStock =
            stockFilter.value === 'all' ||
            (stockFilter.value === 'in_stock' && row.available > 0) ||
            (stockFilter.value === 'out_of_stock' && row.available <= 0) ||
            (stockFilter.value === 'low_stock' && row.status === 'low_stock');

        return matchesSearch && matchesStock;
    });
});

const stockFilterOptions = computed<
    Array<{ key: StockFilter; label: string; count: number }>
>(() => [
    { key: 'all', label: 'Todas', count: variantRows.value.length },
    {
        key: 'in_stock',
        label: 'Con stock',
        count: variantRows.value.filter((row) => row.available > 0).length,
    },
    {
        key: 'out_of_stock',
        label: 'Sin stock',
        count: variantRows.value.filter((row) => row.available <= 0).length,
    },
    {
        key: 'low_stock',
        label: 'Stock bajo',
        count: variantRows.value.filter((row) => row.status === 'low_stock')
            .length,
    },
]);

const metrics = computed(() => {
    const rows = variantRows.value;
    const stock = rows.reduce((sum, row) => sum + row.available, 0);
    const reserved = rows.reduce((sum, row) => sum + row.reserved, 0);
    const value = rows.reduce((sum, row) => sum + row.inventoryValue, 0);
    const variantsWithStock = rows.filter((row) => row.available > 0).length;
    const weightedCost =
        stock > 0
            ? rows.reduce(
                  (sum, row) => sum + row.currentCost * row.available,
                  0,
              ) / stock
            : 0;

    return {
        stock,
        reserved,
        currentCost: weightedCost,
        value,
        variantsWithStock,
    };
});

onMounted(async () => {
    await initWarehouse();
    await fetchWarehouses();
    hydrateFiltersFromQuery();
    await fetchProduct();
});

watch(selectedWarehouseId, async (warehouseId, previousWarehouseId) => {
    if (!warehouseId || warehouseId === previousWarehouseId) {
        return;
    }

    await fetchProduct();
});

async function fetchProduct(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
        const response = await productsApi.getProduct(props.productId, {
            include: [
                'attributes',
                'inventory',
                'suppliers',
                'compatibility',
                'oem',
            ].join(','),
            warehouse_id: selectedWarehouseId.value || undefined,
        });

        product.value = response.data;

        if (
            variants.value.length > 0 &&
            (!selectedVariantId.value ||
                !variants.value.some(
                    (variant) =>
                        Number(variant.id) === Number(selectedVariantId.value),
                ))
        ) {
            selectedVariantId.value = variants.value[0].id;
        }
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'Error al cargar el producto.';
    } finally {
        loading.value = false;
    }
}

async function fetchWarehouses(): Promise<void> {
    try {
        const { data } = await apiClient.get('/warehouses');
        warehouses.value = data.data ?? [];
    } catch (err) {
        console.error('Warehouses fetch error:', err);
    }
}

function hydrateFiltersFromQuery(): void {
    const query = new URLSearchParams(window.location.search);
    const queryWarehouseId = Number(query.get('warehouse_id'));
    const queryVariantId = Number(query.get('variant'));

    selectedWarehouseId.value =
        (Number.isFinite(queryWarehouseId) && queryWarehouseId > 0
            ? queryWarehouseId
            : currentWarehouseId.value || getDefaultWarehouseId()) ?? null;

    selectedVariantId.value =
        Number.isFinite(queryVariantId) && queryVariantId > 0
            ? queryVariantId
            : null;
}

function inventoryForVariant(
    variant: ProductVariant,
): VariantInventory | ProductInventory | null {
    const productInventory =
        product.value?.inventory?.find(
            (item) =>
                Number(item.variant_id) === Number(variant.id) &&
                (!selectedWarehouseId.value ||
                    Number(item.warehouse_id) ===
                        Number(selectedWarehouseId.value)),
        ) ?? null;

    const variantInventory =
        variant.inventory?.find(
            (item) =>
                !selectedWarehouseId.value ||
                Number(item.warehouse?.id) ===
                    Number(selectedWarehouseId.value),
        ) ?? null;

    if (variantInventory) {
        return variantInventory;
    }

    return productInventory;
}

function inventoryAvailable(
    inventory: VariantInventory | ProductInventory | null,
): number {
    return Number(
        inventory?.stock_available ?? inventory?.quantity_available ?? 0,
    );
}

function inventoryReserved(
    inventory: VariantInventory | ProductInventory | null,
): number {
    return Number(
        inventory?.stock_reserved ?? inventory?.quantity_reserved ?? 0,
    );
}

function inventoryCurrentCost(
    inventory: VariantInventory | ProductInventory | null,
): number {
    return Number(inventory?.current_cost ?? inventory?.fifo_cost_current ?? 0);
}

function inventoryValueFor(
    inventory: VariantInventory | ProductInventory | null,
    available: number,
    currentCost: number,
): number {
    return Number(inventory?.inventory_value ?? available * currentCost);
}

function statusForInventory(
    inventory: VariantInventory | ProductInventory | null,
    available: number,
): VariantStatus {
    if (available <= 0) {
        return 'out_of_stock';
    }

    const reorderPoint = Number(inventory?.reorder_point ?? 0);
    if (reorderPoint > 0 && available <= reorderPoint) {
        return 'low_stock';
    }

    return 'normal';
}

function selectVariant(variant: ProductVariant): void {
    selectedVariantId.value = variant.id;
    historyRefreshKey.value += 1;
    const query = new URLSearchParams(window.location.search);
    query.set('variant', String(variant.id));

    if (selectedWarehouseId.value) {
        query.set('warehouse_id', String(selectedWarehouseId.value));
    }

    window.history.replaceState(
        {},
        '',
        `/inventory/products/${props.productId}?${query.toString()}`,
    );
}

function clearVariantSearch(): void {
    variantSearch.value = '';
}

function applyWarehouseFilter(): void {
    const query = new URLSearchParams(window.location.search);

    if (selectedWarehouseId.value) {
        query.set('warehouse_id', String(selectedWarehouseId.value));
    } else {
        query.delete('warehouse_id');
    }

    if (selectedVariantId.value) {
        query.set('variant', String(selectedVariantId.value));
    }

    window.history.replaceState(
        {},
        '',
        `/inventory/products/${props.productId}?${query.toString()}`,
    );
}

function refreshPage(): void {
    historyRefreshKey.value += 1;
    fetchProduct();
}

function goBackToInventory(): void {
    router.visit('/inventory');
}

function formatCurrency(value?: number | string | null): string {
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value || 0));
}

function statusLabel(status: VariantStatus): string {
    return (
        {
            out_of_stock: 'Sin stock',
            low_stock: 'Stock bajo',
            normal: 'Normal',
            optimal: 'Optimo',
        }[status] ?? 'Normal'
    );
}

function statusClass(status: VariantStatus): string {
    return (
        {
            out_of_stock:
                'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
            low_stock:
                'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
            normal: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
            optimal:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        }[status] ?? 'bg-gray-100 text-gray-700'
    );
}
</script>

<template>
    <Head :title="`Movimientos - ${product?.name ?? 'Inventario'}`" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
            >
                <div class="min-w-0">
                    <button
                        type="button"
                        class="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
                        @click="goBackToInventory"
                    >
                        <ArrowLeft class="h-4 w-4" />
                        Inventario
                    </button>
                    <h1
                        class="text-2xl font-semibold text-gray-950 dark:text-white"
                    >
                        {{ product?.name ?? 'Movimientos de inventario' }}
                    </h1>
                    <div
                        class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                        <span class="font-mono">{{
                            product?.sku_base ?? '-'
                        }}</span>
                        <span>-</span>
                        <span>{{ currentWarehouse?.name ?? 'Almacén' }}</span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Link
                        :href="`/products/${productId}`"
                        class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                    >
                        <Box class="h-4 w-4" />
                        Ver producto
                    </Link>
                    <Link
                        :href="`/products/${productId}/edit`"
                        class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <Pencil class="h-4 w-4" />
                        Editar producto
                    </Link>
                </div>
            </div>

            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
                {{ error }}
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-5">
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Stock
                            </p>
                            <p
                                class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{ metrics.stock }}
                            </p>
                        </div>
                        <Package class="h-7 w-7 text-emerald-600" />
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Reservado
                            </p>
                            <p
                                class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{ metrics.reserved }}
                            </p>
                        </div>
                        <AlertCircle class="h-7 w-7 text-amber-600" />
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div>
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Costo actual
                        </p>
                        <p
                            class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                        >
                            {{ formatCurrency(metrics.currentCost) }}
                        </p>
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div>
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Valor inventario
                        </p>
                        <p
                            class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                        >
                            {{ formatCurrency(metrics.value) }}
                        </p>
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Variantes con stock
                            </p>
                            <p
                                class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{ metrics.variantsWithStock }}
                            </p>
                        </div>
                        <History class="h-7 w-7 text-indigo-600" />
                    </div>
                </div>
            </div>

            <div
                class="sticky top-0 z-10 rounded-lg border border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-border dark:bg-card/95"
            >
                <div class="grid grid-cols-1 gap-3 lg:grid-cols-12">
                    <div class="lg:col-span-4">
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Almacén
                        </label>
                        <select
                            v-model.number="selectedWarehouseId"
                            class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-border dark:bg-muted dark:text-white"
                            @change="applyWarehouseFilter"
                        >
                            <option
                                v-for="warehouse in productWarehouseOptions"
                                :key="warehouse.id"
                                :value="warehouse.id"
                            >
                                {{ warehouse.name }}
                            </option>
                        </select>
                    </div>
                    <div class="lg:col-span-3">
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Desde
                        </label>
                        <input
                            v-model="dateFrom"
                            type="date"
                            class="h-10 w-full rounded-md border border-gray-300 px-3 text-sm dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>
                    <div class="lg:col-span-3">
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Hasta
                        </label>
                        <input
                            v-model="dateTo"
                            type="date"
                            class="h-10 w-full rounded-md border border-gray-300 px-3 text-sm dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>
                    <div class="flex items-end lg:col-span-2">
                        <button
                            type="button"
                            class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                            :disabled="loading"
                            title="Actualizar producto e historial"
                            @click="refreshPage"
                        >
                            <RefreshCw
                                class="h-4 w-4"
                                :class="{ 'animate-spin': loading }"
                            />
                            Actualizar
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <aside
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 p-4 dark:border-border"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <Warehouse class="h-4 w-4 text-gray-500" />
                                <h2
                                    class="text-sm font-semibold text-gray-950 dark:text-white"
                                >
                                    Variantes
                                </h2>
                            </div>
                            <span class="text-xs text-gray-500">
                                {{ filteredVariantRows.length }} /
                                {{ variantRows.length }}
                            </span>
                        </div>

                        <div class="relative mt-3">
                            <Search
                                class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                v-model="variantSearch"
                                type="search"
                                placeholder="Buscar marca o SKU"
                                class="h-10 w-full rounded-md border border-gray-300 bg-white pr-10 pl-9 text-sm dark:border-border dark:bg-muted dark:text-white"
                            />
                            <button
                                v-if="variantSearch"
                                type="button"
                                class="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-background dark:hover:text-gray-200"
                                @click="clearVariantSearch"
                            >
                                <X class="h-4 w-4" />
                            </button>
                        </div>

                        <div class="mt-3 flex flex-wrap gap-2">
                            <button
                                v-for="option in stockFilterOptions"
                                :key="option.key"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition"
                                :class="
                                    stockFilter === option.key
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-primary dark:bg-primary/10 dark:text-primary'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted'
                                "
                                @click="stockFilter = option.key"
                            >
                                {{ option.label }}
                                <span class="font-semibold">{{
                                    option.count
                                }}</span>
                            </button>
                        </div>
                    </div>

                    <div class="max-h-[68vh] overflow-y-auto p-2">
                        <button
                            v-for="row in filteredVariantRows"
                            :key="row.variant.id"
                            type="button"
                            class="mb-2 w-full rounded-lg border p-3 text-left transition last:mb-0"
                            :class="
                                selectedVariantId === row.variant.id
                                    ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-primary dark:bg-primary/10'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-border dark:bg-card dark:hover:bg-muted/40'
                            "
                            @click="selectVariant(row.variant)"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p
                                        class="truncate text-sm font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{
                                            row.variant.brand?.name ??
                                            'Variante'
                                        }}
                                    </p>
                                    <p
                                        class="truncate font-mono text-xs text-gray-500"
                                    >
                                        {{ row.variant.sku }}
                                    </p>
                                </div>
                                <span
                                    :class="statusClass(row.status)"
                                    class="shrink-0 rounded-full px-2 py-1 text-xs font-medium"
                                >
                                    {{ statusLabel(row.status) }}
                                </span>
                            </div>

                            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <p class="text-gray-500">Disponible</p>
                                    <p
                                        class="text-right text-sm font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{ row.available }}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-gray-500">Reservado</p>
                                    <p
                                        class="text-right text-sm font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{ row.reserved }}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-gray-500">Costo actual</p>
                                    <p
                                        class="text-right font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{ formatCurrency(row.currentCost) }}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-gray-500">
                                        Valor inventario
                                    </p>
                                    <p
                                        class="text-right font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{ formatCurrency(row.inventoryValue) }}
                                    </p>
                                </div>
                            </div>
                        </button>

                        <div
                            v-if="filteredVariantRows.length === 0"
                            class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-border"
                        >
                            No hay variantes para el filtro actual.
                        </div>
                    </div>
                </aside>

                <section class="min-w-0 space-y-4">
                    <div
                        v-if="selectedVariantRow"
                        class="relative overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            v-if="loading"
                            class="absolute inset-x-0 top-0 h-1 overflow-hidden bg-blue-100 dark:bg-primary/20"
                        >
                            <div
                                class="h-full w-1/3 animate-pulse bg-blue-600 dark:bg-primary"
                            />
                        </div>

                        <div
                            class="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between"
                        >
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h2
                                        class="truncate text-lg font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{
                                            selectedVariantRow.variant.brand
                                                ?.name ?? 'Variante'
                                        }}
                                    </h2>
                                    <span
                                        :class="
                                            statusClass(
                                                selectedVariantRow.status,
                                            )
                                        "
                                        class="rounded-full px-2 py-1 text-xs font-medium"
                                    >
                                        {{
                                            statusLabel(
                                                selectedVariantRow.status,
                                            )
                                        }}
                                    </span>
                                </div>
                                <p class="mt-1 font-mono text-sm text-gray-500">
                                    {{ selectedVariantRow.variant.sku }}
                                </p>
                            </div>

                            <p
                                class="text-sm font-medium text-gray-500 dark:text-gray-400"
                            >
                                Almacén:
                                {{ currentWarehouse?.name ?? 'Almacén' }}
                            </p>
                        </div>

                        <div
                            class="grid border-t border-gray-200 bg-gray-50 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-border dark:bg-muted/30"
                        >
                            <div class="border-gray-200 p-4 lg:border-r">
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Stock
                                </p>
                                <p
                                    class="mt-1 text-right text-xl font-semibold text-gray-950 dark:text-white"
                                >
                                    {{ selectedVariantRow.available }}
                                </p>
                            </div>
                            <div class="border-gray-200 p-4 lg:border-r">
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Reservado
                                </p>
                                <p
                                    class="mt-1 text-right text-xl font-semibold text-gray-950 dark:text-white"
                                >
                                    {{ selectedVariantRow.reserved }}
                                </p>
                            </div>
                            <div class="border-gray-200 p-4 lg:border-r">
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Costo actual
                                </p>
                                <p
                                    class="mt-1 text-right text-xl font-semibold text-gray-950 dark:text-white"
                                >
                                    {{
                                        formatCurrency(
                                            selectedVariantRow.currentCost,
                                        )
                                    }}
                                </p>
                            </div>
                            <div class="p-4">
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Valor inventario
                                </p>
                                <p
                                    class="mt-1 text-right text-xl font-semibold text-gray-950 dark:text-white"
                                >
                                    {{
                                        formatCurrency(
                                            selectedVariantRow.inventoryValue,
                                        )
                                    }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <VariantFifoHistoryPanel
                        v-if="selectedVariant"
                        :key="`${productId}:${selectedVariant.id}:${selectedWarehouseId}:${dateFrom}:${dateTo}:${historyRefreshKey}`"
                        :product-id="productId"
                        :variant="selectedVariant"
                        :warehouses="productWarehouseOptions"
                        :initial-warehouse-id="selectedWarehouseId"
                        :date-from="dateFrom"
                        :date-to="dateTo"
                        embedded
                        @updated="refreshPage"
                    />

                    <div
                        v-else-if="!loading"
                        class="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 dark:border-border dark:bg-card"
                    >
                        No hay variante disponible para mostrar movimientos.
                    </div>
                </section>
            </div>
        </div>
    </AppLayout>
</template>
