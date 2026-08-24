<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import {
    AlertTriangle,
    ArrowLeft,
    Box,
    Car,
    Copy,
    DollarSign,
    FileText,
    ImageIcon,
    Layers,
    Package,
    Pencil,
    Star,
    Tags,
    Warehouse,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import VariantFifoHistoryPanel from '@/components/Products/VariantFifoHistoryPanel.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import { productsApi } from '@/services/api/products';
import { type BreadcrumbItem } from '@/types';
import type {
    AlternativeProduct,
    ProductDetail,
    ProductImage,
    ProductOperationalProfile,
    ProductPricing,
    ProductVariant,
} from '@/types/product';
import { canManagePurchasingRecords } from '@/utils/catalogPermissions';

const props = defineProps<{
    productId: number;
}>();
const page = usePage();
const canManageProducts = computed(() =>
    canManagePurchasingRecords((page.props.auth?.user as any)?.role),
);

const {
    fetchSettings,
    initWarehouse,
    currentWarehouseId,
    getDefaultWarehouseId,
} = usePosSettings();
const { currentProduct, loading, error, fetchProduct } = useProducts();
const toast = useToast();

const duplicating = ref(false);
const operationalProfile = ref<ProductOperationalProfile | null>(null);
const operationalProfileError = ref<string | null>(null);
const currentImageIndex = ref(0);
const selectedFifoVariantId = ref<number | null>(null);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
    { title: 'Detalle', href: `/products/${props.productId}` },
];

const product = computed<ProductDetail | null>(() => currentProduct.value);

const variants = computed<ProductVariant[]>(() => {
    return product.value?.variants ?? [];
});

const operationalVariants = computed(
    () => operationalProfile.value?.variants ?? [],
);

const operationalLots = computed(() =>
    operationalVariants.value.flatMap((variant) =>
        variant.lots.map((lot) => ({ ...lot, variant })),
    ),
);

const operationalSales = computed(() =>
    operationalVariants.value.flatMap((variant) =>
        variant.sales.recent.map((sale) => ({ ...sale, variant })),
    ),
);

const operationalPurchases = computed(() =>
    operationalVariants.value.flatMap((variant) =>
        variant.purchases.recent.map((purchase) => ({ ...purchase, variant })),
    ),
);

function operationalVariantFor(variant: ProductVariant) {
    return operationalVariants.value.find(
        (operationalVariant) => operationalVariant.id === variant.id,
    );
}

const productWarehouseOptions = computed(() => {
    const inventoryWarehouses =
        product.value?.inventory
            ?.map((item) => item.warehouse)
            .filter(Boolean)
            .map((warehouse: any) => ({
                id: Number(warehouse.id),
                name: warehouse.name,
                code: warehouse.code,
            })) ?? [];

    const variantWarehouses = variants.value.flatMap(
        (variant) =>
            variant.inventory
                ?.map((item) => item.warehouse)
                .filter(Boolean)
                .map((warehouse: any) => ({
                    id: Number(warehouse.id),
                    name: warehouse.name,
                    code: warehouse.code,
                })) ?? [],
    );

    const seen = new Set<number>();
    return [...inventoryWarehouses, ...variantWarehouses].filter(
        (warehouse) => {
            if (!warehouse?.id || seen.has(Number(warehouse.id))) {
                return false;
            }

            seen.add(Number(warehouse.id));
            return true;
        },
    );
});

const effectiveImages = computed<ProductImage[]>(() => {
    const allImages = product.value?.all_images ?? [];
    const directImages = product.value?.images ?? [];
    const inheritedImages = product.value?.inherited_images ?? [];
    const merged = [...allImages, ...directImages, ...inheritedImages];
    const seen = new Set<string>();
    const unique = merged.filter((image: any) => {
        if (!image?.url || seen.has(image.url)) {
            return false;
        }

        seen.add(image.url);
        return true;
    });

    if (!unique.length && product.value?.image_url) {
        return [
            {
                id: null,
                url: product.value.image_url,
                display_order: 0,
                source: 'product',
            },
        ];
    }

    return unique as ProductImage[];
});

const currentImage = computed(
    () => effectiveImages.value[currentImageIndex.value] ?? null,
);

const primaryPricing = computed<ProductPricing | null>(() => {
    return product.value?.pricing ?? variants.value[0]?.pricing ?? null;
});

const totalStock = computed(() => {
    if (typeof product.value?.total_stock === 'number') {
        return product.value.total_stock;
    }

    const variantStock = variants.value.reduce(
        (sum, variant) => sum + Number(variant.total_stock ?? 0),
        0,
    );

    if (variantStock > 0) {
        return variantStock;
    }

    return (
        product.value?.inventory?.reduce(
            (sum, item) => sum + Number(item.stock_available || 0),
            0,
        ) ?? 0
    );
});

const resolvedWarehouseId = computed(
    () => currentWarehouseId.value ?? getDefaultWarehouseId(),
);

const currentWarehouseInventory = computed(() => {
    if (!resolvedWarehouseId.value) {
        return null;
    }

    return (
        product.value?.inventory?.find(
            (item) =>
                Number(item.warehouse_id) === Number(resolvedWarehouseId.value),
        ) ?? null
    );
});

const activeInventoryForVariant = (variant: ProductVariant) => {
    const inventory = variant.inventory ?? [];
    if (!resolvedWarehouseId.value) {
        return (
            inventory.find(
                (item) =>
                    Number(
                        item.current_sale_price ??
                            item.fifo_sale_price_current ??
                            0,
                    ) > 0 ||
                    Number(item.current_cost ?? item.fifo_cost_current ?? 0) >
                        0,
            ) ?? null
        );
    }

    return (
        inventory.find(
            (item) =>
                Number(item.warehouse?.id) ===
                Number(resolvedWarehouseId.value),
        ) ?? null
    );
};

const primaryCurrentCost = computed(() => {
    const value = variants.value
        .map((variant) => activeInventoryForVariant(variant))
        .find(
            (item) => Number(item?.current_cost ?? item?.fifo_cost_current) > 0,
        );

    return value
        ? Number(value.current_cost ?? value.fifo_cost_current)
        : Number(primaryPricing.value?.cost ?? 0);
});

const primaryCurrentSalePrice = computed(() => {
    const value = variants.value
        .map((variant) => activeInventoryForVariant(variant))
        .find(
            (item) =>
                Number(
                    item?.current_sale_price ?? item?.fifo_sale_price_current,
                ) > 0,
        );

    return value
        ? Number(value.current_sale_price ?? value.fifo_sale_price_current)
        : Number(primaryPricing.value?.base_price ?? 0);
});

const preferredSupplier = computed(() => {
    return (
        product.value?.suppliers?.find((supplier) => supplier.is_preferred) ??
        product.value?.suppliers?.[0] ??
        null
    );
});

const reorderAlerts = computed(
    () => product.value?.inventory?.filter((item) => item.needs_reorder) ?? [],
);

const oemReferences = computed(() => product.value?.oem_references ?? []);
const alternatives = computed<AlternativeProduct[]>(
    () => product.value?.alternatives ?? [],
);
const compatibility = computed(() => product.value?.compatibility ?? []);
const attributes = computed(() => product.value?.attributes ?? []);

const statusLabel = computed(() => {
    return {
        active: 'Activo',
        discontinued: 'Descontinuado',
        pending: 'Pendiente',
    }[product.value?.status ?? 'pending'];
});

const statusClass = computed(() => {
    return {
        active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        discontinued:
            'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
        pending:
            'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    }[product.value?.status ?? 'pending'];
});

function formatCurrency(value?: number | string | null): string {
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value || 0));
}

function formatPercent(value?: number | string | null): string {
    return `${Number(value || 0).toFixed(2)}%`;
}

function formatDate(value?: string | null): string {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleDateString('es-PA');
}

function inventoryStockForVariant(variant: ProductVariant): number {
    const operationalSummary =
        operationalVariantFor(variant)?.inventory.summary;

    if (operationalSummary) {
        return Number(operationalSummary.stock_available ?? 0);
    }

    if (!resolvedWarehouseId.value) {
        return Number(variant.total_stock ?? 0);
    }

    return (
        variant.inventory?.find(
            (item) =>
                Number(item.warehouse?.id) ===
                Number(resolvedWarehouseId.value),
        )?.stock_available ?? Number(variant.total_stock ?? 0)
    );
}

function fifoCostForVariant(variant: ProductVariant): number | undefined {
    const operationalPricing = operationalVariantFor(variant)?.pricing.current;

    if (operationalPricing) {
        return Number(
            operationalPricing.current_cost ??
                operationalPricing.fifo_cost_current,
        );
    }

    const inventory = activeInventoryForVariant(variant);
    const value = inventory?.current_cost ?? inventory?.fifo_cost_current;

    return value !== undefined ? Number(value) : undefined;
}

function fifoSalePriceForVariant(variant: ProductVariant): number | undefined {
    const operationalPricing = operationalVariantFor(variant)?.pricing.current;

    if (operationalPricing) {
        return Number(
            operationalPricing.current_sale_price ??
                operationalPricing.fifo_sale_price_current,
        );
    }

    const inventory = activeInventoryForVariant(variant);
    const value =
        inventory?.current_sale_price ?? inventory?.fifo_sale_price_current;

    return value !== undefined ? Number(value) : undefined;
}

function toggleVariantFifoHistory(variant: ProductVariant): void {
    selectedFifoVariantId.value =
        selectedFifoVariantId.value === variant.id ? null : variant.id;
}

function relationLabel(type?: string): string {
    return (
        {
            compatible: 'Compatible',
            substitute: 'Sustituto',
            upgrade: 'Mejora',
        }[type ?? ''] ??
        type ??
        '-'
    );
}

async function loadProduct() {
    const warehouseId = resolvedWarehouseId.value || undefined;

    await fetchProduct(props.productId, warehouseId);

    operationalProfile.value = null;
    operationalProfileError.value = null;

    if (!warehouseId) {
        operationalProfileError.value =
            'Selecciona una sucursal para ver el historial operativo.';
        return;
    }

    try {
        const response = await productsApi.getProductProfile(props.productId, {
            warehouse_id: warehouseId,
        });
        operationalProfile.value = response.data;
    } catch (err: any) {
        operationalProfileError.value =
            err.response?.data?.message ||
            'No se pudo cargar el historial operativo del producto.';
    }
}

async function handleDuplicate() {
    if (duplicating.value) {
        return;
    }

    duplicating.value = true;

    try {
        const response = await productsApi.duplicateProduct(props.productId);
        const duplicatedProductId = response?.data?.id;

        if (!duplicatedProductId) {
            throw new Error('No se recibio el ID del producto duplicado');
        }

        toast.success('Producto duplicado. Ajusta los campos necesarios.');
        window.location.href = `/products/${duplicatedProductId}/edit`;
    } catch (err: any) {
        toast.error(
            err.response?.data?.message || 'Error al duplicar producto',
        );
    } finally {
        duplicating.value = false;
    }
}

onMounted(async () => {
    await fetchSettings();
    await initWarehouse();
    await loadProduct();
});

watch(currentWarehouseId, async () => {
    await loadProduct();
});

watch(effectiveImages, () => {
    currentImageIndex.value = 0;
});
</script>

<template>
    <Head :title="product?.name || 'Detalle del producto'" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="min-h-[calc(100vh-4rem)] bg-gray-50/60 dark:bg-background">
            <div class="mx-auto max-w-7xl space-y-4 p-4">
                <div
                    class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                >
                    <div class="min-w-0">
                        <div class="mb-2 flex flex-wrap items-center gap-2">
                            <Link
                                href="/products"
                                class="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-300 dark:hover:bg-muted"
                            >
                                <ArrowLeft :size="15" />
                                Productos
                            </Link>
                            <span
                                v-if="product"
                                :class="[
                                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                                    statusClass,
                                ]"
                            >
                                {{ statusLabel }}
                            </span>
                            <span
                                v-if="product?.is_universal"
                                class="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                            >
                                Universal
                            </span>
                        </div>
                        <h1
                            class="text-2xl font-semibold break-words text-gray-950 lg:text-3xl dark:text-white"
                        >
                            {{ product?.name || 'Detalle del producto' }}
                        </h1>
                        <p
                            v-if="product"
                            class="mt-1 flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400"
                        >
                            <span class="font-mono">{{
                                product.sku_base
                            }}</span>
                            <span v-if="product.brand?.name"
                                >· {{ product.brand.name }}</span
                            >
                            <span v-if="product.category?.name"
                                >· {{ product.category.name }}</span
                            >
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-if="canManageProducts"
                            type="button"
                            :disabled="duplicating"
                            class="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                            @click="handleDuplicate"
                        >
                            <Copy :size="16" />
                            {{ duplicating ? 'Duplicando...' : 'Duplicar' }}
                        </button>
                        <Link
                            v-if="canManageProducts"
                            :href="`/products/${productId}/edit`"
                            class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                            <Pencil :size="16" />
                            Editar
                        </Link>
                    </div>
                </div>

                <div
                    v-if="loading"
                    class="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-border dark:bg-card"
                >
                    <div
                        class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-r-transparent"
                    ></div>
                    <p class="mt-3 text-sm text-gray-500">
                        Cargando producto...
                    </p>
                </div>

                <div
                    v-else-if="error"
                    class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                >
                    {{ error }}
                </div>

                <template v-else-if="product">
                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex items-center gap-2 text-sm font-medium text-gray-500"
                            >
                                <Package :size="16" />
                                Stock total
                            </div>
                            <p
                                class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{ totalStock }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex items-center gap-2 text-sm font-medium text-gray-500"
                            >
                                <Warehouse :size="16" />
                                Almacen actual
                            </div>
                            <p
                                class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{
                                    currentWarehouseInventory?.stock_available ??
                                    '-'
                                }}
                            </p>
                            <p class="mt-1 truncate text-xs text-gray-500">
                                {{
                                    currentWarehouseInventory?.warehouse
                                        ?.name || 'Sin contexto'
                                }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex items-center gap-2 text-sm font-medium text-gray-500"
                            >
                                <DollarSign :size="16" />
                                Costo / Precio
                            </div>
                            <p
                                class="mt-2 text-lg font-semibold text-gray-950 dark:text-white"
                            >
                                {{ formatCurrency(primaryCurrentCost) }}
                            </p>
                            <p class="text-xs text-gray-500">
                                Venta
                                {{ formatCurrency(primaryCurrentSalePrice) }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex items-center gap-2 text-sm font-medium text-gray-500"
                            >
                                <AlertTriangle :size="16" />
                                Reorden
                            </div>
                            <p
                                class="mt-2 text-2xl font-semibold"
                                :class="
                                    reorderAlerts.length
                                        ? 'text-amber-600'
                                        : 'text-emerald-600'
                                "
                            >
                                {{ reorderAlerts.length }}
                            </p>
                            <p class="text-xs text-gray-500">
                                almacenes con alerta
                            </p>
                        </div>
                    </div>

                    <div
                        class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]"
                    >
                        <section
                            class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex aspect-[16/10] items-center justify-center bg-gray-100 dark:bg-muted/40"
                            >
                                <img
                                    v-if="currentImage"
                                    :src="currentImage.url"
                                    :alt="product.name"
                                    class="h-full w-full object-contain"
                                />
                                <div
                                    v-else
                                    class="flex flex-col items-center gap-2 text-gray-400"
                                >
                                    <ImageIcon :size="42" />
                                    <span class="text-sm">Sin imagen</span>
                                </div>
                            </div>
                            <div
                                v-if="currentImage?.source === 'category'"
                                class="border-t border-gray-100 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:border-border dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                                Imagen heredada de
                                {{ currentImage.category_name || 'categoria' }}
                            </div>
                            <div
                                v-if="effectiveImages.length > 1"
                                class="flex gap-2 overflow-x-auto border-t border-gray-100 p-3 dark:border-border"
                            >
                                <button
                                    v-for="(image, index) in effectiveImages"
                                    :key="`${image.url}-${index}`"
                                    type="button"
                                    class="h-16 w-20 shrink-0 overflow-hidden rounded-md border bg-gray-50"
                                    :class="
                                        currentImageIndex === index
                                            ? 'border-emerald-500 ring-2 ring-emerald-200'
                                            : 'border-gray-200 dark:border-border'
                                    "
                                    @click="currentImageIndex = index"
                                >
                                    <img
                                        :src="image.url"
                                        :alt="product.name"
                                        class="h-full w-full object-cover"
                                    />
                                </button>
                            </div>
                        </section>

                        <section class="space-y-4">
                            <div
                                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                            >
                                <div class="mb-3 flex items-center gap-2">
                                    <Tags :size="18" class="text-emerald-600" />
                                    <h2
                                        class="text-sm font-semibold text-gray-950 dark:text-white"
                                    >
                                        Resumen de compra
                                    </h2>
                                </div>
                                <dl
                                    class="grid grid-cols-[8rem_1fr] gap-y-2 text-sm"
                                >
                                    <dt class="text-gray-500">SKU base</dt>
                                    <dd class="font-mono font-semibold">
                                        {{ product.sku_base }}
                                    </dd>
                                    <dt class="text-gray-500">Marca</dt>
                                    <dd>
                                        {{ product.brand?.name || '-' }}
                                    </dd>
                                    <dt class="text-gray-500">Categoria</dt>
                                    <dd>{{ product.category?.name || '-' }}</dd>
                                    <dt class="text-gray-500">Linea</dt>
                                    <dd>
                                        {{ product.product_line?.name || '-' }}
                                    </dd>
                                    <dt class="text-gray-500">Margen</dt>
                                    <dd class="font-semibold text-emerald-700">
                                        {{
                                            formatPercent(
                                                primaryPricing?.margin_percentage,
                                            )
                                        }}
                                    </dd>
                                </dl>
                            </div>

                            <div
                                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                            >
                                <div class="mb-3 flex items-center gap-2">
                                    <Star :size="18" class="text-amber-500" />
                                    <h2
                                        class="text-sm font-semibold text-gray-950 dark:text-white"
                                    >
                                        Proveedor preferido
                                    </h2>
                                </div>
                                <div
                                    v-if="preferredSupplier"
                                    class="space-y-2 text-sm"
                                >
                                    <div
                                        class="flex items-start justify-between gap-3"
                                    >
                                        <div>
                                            <p class="font-semibold">
                                                {{ preferredSupplier.name }}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                Entrega
                                                {{
                                                    preferredSupplier.lead_time_days
                                                }}
                                                dias
                                            </p>
                                        </div>
                                        <p class="font-mono font-semibold">
                                            {{
                                                formatCurrency(
                                                    preferredSupplier.supplier_cost,
                                                )
                                            }}
                                        </p>
                                    </div>
                                    <p class="text-xs text-gray-500">
                                        MOQ
                                        {{
                                            preferredSupplier.minimum_order_quantity
                                        }}
                                    </p>
                                </div>
                                <p v-else class="text-sm text-gray-500">
                                    No hay proveedores vinculados.
                                </p>
                            </div>
                        </section>
                    </div>

                    <nav
                        class="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-sm dark:border-border dark:bg-card"
                    >
                        <a
                            v-for="section in [
                                ['#resumen', 'Resumen'],
                                ['#variantes', 'Variantes'],
                                ['#inventario', 'Inventario'],
                                ['#lotes', 'Lotes'],
                                ['#ventas', 'Ventas'],
                                ['#compras', 'Compras'],
                                ['#proveedores', 'Proveedores'],
                                ['#referencias', 'Referencias'],
                                ['#compatibilidad', 'Compatibilidad'],
                                ['#alternativas', 'Alternativas'],
                            ]"
                            :key="section[0]"
                            :href="section[0]"
                            class="shrink-0 rounded-md px-3 py-2 font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-gray-300 dark:hover:bg-emerald-950/30"
                        >
                            {{ section[1] }}
                        </a>
                    </nav>

                    <section
                        id="resumen"
                        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                    >
                        <div class="mb-3 flex items-center gap-2">
                            <FileText :size="18" class="text-emerald-600" />
                            <h2
                                class="font-semibold text-gray-950 dark:text-white"
                            >
                                Informacion general
                            </h2>
                        </div>
                        <p
                            v-if="product.description"
                            class="text-sm leading-6 whitespace-pre-wrap text-gray-700 dark:text-gray-300"
                        >
                            {{ product.description }}
                        </p>
                        <p v-else class="text-sm text-gray-500">
                            Sin descripcion registrada.
                        </p>
                    </section>

                    <section
                        id="variantes"
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-100 px-4 py-3 dark:border-border"
                        >
                            <div class="flex items-center gap-2">
                                <Layers :size="18" class="text-emerald-600" />
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Variantes
                                </h2>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead
                                    class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                                >
                                    <tr>
                                        <th class="px-4 py-2 text-left">
                                            Marca
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Stock
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Costo
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Precio
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template
                                        v-for="variant in variants"
                                        :key="variant.id"
                                    >
                                        <tr
                                            class="border-t border-gray-100 dark:border-border"
                                        >
                                            <td class="px-4 py-3">
                                                {{ variant.brand?.name || '-' }}
                                            </td>
                                            <td
                                                class="px-4 py-3 text-right font-semibold"
                                            >
                                                {{
                                                    inventoryStockForVariant(
                                                        variant,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-3 text-right font-mono"
                                            >
                                                {{
                                                    formatCurrency(
                                                        fifoCostForVariant(
                                                            variant,
                                                        ) ??
                                                            variant.pricing
                                                                ?.cost ??
                                                            product.pricing
                                                                ?.cost,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-3 text-right font-mono font-semibold"
                                            >
                                                {{
                                                    formatCurrency(
                                                        fifoSalePriceForVariant(
                                                            variant,
                                                        ) ??
                                                            variant.pricing
                                                                ?.base_price ??
                                                            product.pricing
                                                                ?.base_price,
                                                    )
                                                }}
                                            </td>
                                            <td class="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    class="text-sm font-medium text-blue-600 hover:underline dark:text-primary"
                                                    @click="
                                                        toggleVariantFifoHistory(
                                                            variant,
                                                        )
                                                    "
                                                >
                                                    {{
                                                        selectedFifoVariantId ===
                                                        variant.id
                                                            ? 'Ocultar historial'
                                                            : 'Historial de stock'
                                                    }}
                                                </button>
                                            </td>
                                        </tr>
                                        <tr
                                            v-if="
                                                selectedFifoVariantId ===
                                                variant.id
                                            "
                                            class="border-t border-gray-100 dark:border-border"
                                        >
                                            <td colspan="5" class="px-4 py-4">
                                                <VariantFifoHistoryPanel
                                                    :product-id="product.id"
                                                    :variant="variant"
                                                    :warehouses="
                                                        productWarehouseOptions
                                                    "
                                                    :initial-warehouse-id="
                                                        resolvedWarehouseId
                                                    "
                                                />
                                            </td>
                                        </tr>
                                    </template>
                                    <tr v-if="variants.length === 0">
                                        <td
                                            colspan="5"
                                            class="px-4 py-8 text-center text-sm text-gray-500"
                                        >
                                            Sin variantes registradas.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section
                        id="inventario"
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-100 px-4 py-3 dark:border-border"
                        >
                            <div class="flex items-center gap-2">
                                <Warehouse
                                    :size="18"
                                    class="text-emerald-600"
                                />
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Inventario por almacen
                                </h2>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead
                                    class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                                >
                                    <tr>
                                        <th class="px-4 py-2 text-left">
                                            Almacen
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Disponible
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Reservado
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            En pedido
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Reorden
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Costo actual
                                        </th>
                                        <th class="px-4 py-2 text-left">
                                            Estado
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="item in product.inventory"
                                        :key="item.id"
                                        class="border-t border-gray-100 dark:border-border"
                                    >
                                        <td class="px-4 py-3 font-medium">
                                            {{ item.warehouse?.name || '-' }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-semibold"
                                        >
                                            {{ item.stock_available }}
                                        </td>
                                        <td class="px-4 py-3 text-right">
                                            {{ item.stock_reserved }}
                                        </td>
                                        <td class="px-4 py-3 text-right">
                                            {{ item.stock_on_order }}
                                        </td>
                                        <td class="px-4 py-3 text-right">
                                            {{ item.reorder_point }}
                                        </td>
                                        <td class="px-4 py-3 text-right">
                                            {{
                                                formatCurrency(
                                                    item.fifo_cost_current,
                                                )
                                            }}
                                        </td>
                                        <td class="px-4 py-3">
                                            <span
                                                v-if="item.needs_reorder"
                                                class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                            >
                                                <AlertTriangle :size="13" />
                                                Reordenar
                                            </span>
                                            <span
                                                v-else
                                                class="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                            >
                                                OK
                                            </span>
                                        </td>
                                    </tr>
                                    <tr v-if="!product.inventory?.length">
                                        <td
                                            colspan="7"
                                            class="px-4 py-8 text-center text-sm text-gray-500"
                                        >
                                            Sin inventario registrado.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <div
                        v-if="operationalProfileError"
                        class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                        {{ operationalProfileError }}
                    </div>

                    <section
                        id="lotes"
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-100 px-4 py-3 dark:border-border"
                        >
                            <div class="flex items-center gap-2">
                                <Package :size="18" class="text-emerald-600" />
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Lotes activos
                                </h2>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead
                                    class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                                >
                                    <tr>
                                        <th class="px-4 py-2 text-left">
                                            Variante
                                        </th>
                                        <th class="px-4 py-2 text-left">
                                            Lote
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Disponible
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Costo aterr.
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Precio
                                        </th>
                                        <th class="px-4 py-2 text-left">
                                            Recibido
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="lot in operationalLots"
                                        :key="lot.id"
                                        class="border-t border-gray-100 dark:border-border"
                                    >
                                        <td class="px-4 py-3">
                                            {{ lot.variant.brand?.name || '-' }}
                                            <p
                                                class="font-mono text-xs text-gray-500"
                                            >
                                                {{ lot.variant.sku || '-' }}
                                            </p>
                                        </td>
                                        <td class="px-4 py-3 font-mono">
                                            {{
                                                lot.batch_number || `#${lot.id}`
                                            }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-semibold"
                                        >
                                            {{ lot.quantity_available }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-mono"
                                        >
                                            {{
                                                formatCurrency(
                                                    lot.landed_unit_cost,
                                                )
                                            }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-mono font-semibold"
                                        >
                                            {{ formatCurrency(lot.sale_price) }}
                                        </td>
                                        <td class="px-4 py-3 text-gray-600">
                                            {{ formatDate(lot.received_at) }}
                                        </td>
                                    </tr>
                                    <tr v-if="operationalLots.length === 0">
                                        <td
                                            colspan="6"
                                            class="px-4 py-8 text-center text-sm text-gray-500"
                                        >
                                            Sin lotes activos para la sucursal
                                            actual.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section id="ventas" class="grid gap-4 lg:grid-cols-2">
                        <div
                            class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-gray-100 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Ventas recientes
                                </h2>
                            </div>
                            <div
                                class="divide-y divide-gray-100 dark:divide-border"
                            >
                                <div
                                    v-for="sale in operationalSales.slice(0, 8)"
                                    :key="`${sale.variant.id}-${sale.id}`"
                                    class="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm"
                                >
                                    <div class="min-w-0">
                                        <Link
                                            v-if="sale.id"
                                            :href="`/sales-orders/${sale.id}`"
                                            class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                                        >
                                            {{
                                                sale.order_number ||
                                                `Venta #${sale.id}`
                                            }}
                                        </Link>
                                        <p
                                            class="truncate text-xs text-gray-500"
                                        >
                                            {{
                                                sale.customer?.name ||
                                                'Cliente no registrado'
                                            }}
                                        </p>
                                    </div>
                                    <div class="text-right font-mono">
                                        <p class="font-semibold">
                                            {{ formatCurrency(sale.total) }}
                                        </p>
                                        <p class="text-xs text-gray-500">
                                            {{ sale.quantity }} und.
                                        </p>
                                    </div>
                                </div>
                                <div
                                    v-if="operationalSales.length === 0"
                                    class="px-4 py-8 text-center text-sm text-gray-500"
                                >
                                    Sin ventas recientes para la sucursal
                                    actual.
                                </div>
                            </div>
                        </div>

                        <div
                            class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-gray-100 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Clientes que compraron
                                </h2>
                            </div>
                            <div
                                class="divide-y divide-gray-100 dark:divide-border"
                            >
                                <div
                                    v-for="customer in operationalProfile?.customers.slice(
                                        0,
                                        8,
                                    ) ?? []"
                                    :key="customer.id"
                                    class="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm"
                                >
                                    <div class="min-w-0">
                                        <Link
                                            :href="`/customers/${customer.id}`"
                                            class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                                        >
                                            {{ customer.name }}
                                        </Link>
                                        <p class="text-xs text-gray-500">
                                            Ultima compra
                                            {{
                                                formatDate(
                                                    customer.last_purchased_at,
                                                )
                                            }}
                                        </p>
                                    </div>
                                    <div class="text-right font-mono">
                                        <p class="font-semibold">
                                            {{
                                                formatCurrency(
                                                    customer.total_spent,
                                                )
                                            }}
                                        </p>
                                        <p class="text-xs text-gray-500">
                                            {{ customer.units_purchased }} und.
                                        </p>
                                    </div>
                                </div>
                                <div
                                    v-if="!operationalProfile?.customers.length"
                                    class="px-4 py-8 text-center text-sm text-gray-500"
                                >
                                    Sin clientes en el historial cargado.
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        id="compras"
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-100 px-4 py-3 dark:border-border"
                        >
                            <h2
                                class="font-semibold text-gray-950 dark:text-white"
                            >
                                Compras recientes
                            </h2>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead
                                    class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                                >
                                    <tr>
                                        <th class="px-4 py-2 text-left">OC</th>
                                        <th class="px-4 py-2 text-left">
                                            Proveedor
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Ordenado
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Recibido
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="purchase in operationalPurchases.slice(
                                            0,
                                            10,
                                        )"
                                        :key="`${purchase.variant.id}-${purchase.id}`"
                                        class="border-t border-gray-100 dark:border-border"
                                    >
                                        <td class="px-4 py-3">
                                            <Link
                                                v-if="purchase.id"
                                                :href="`/purchase-orders/${purchase.id}`"
                                                class="font-mono font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                                            >
                                                {{
                                                    purchase.po_number ||
                                                    `#${purchase.id}`
                                                }}
                                            </Link>
                                            <p class="text-xs text-gray-500">
                                                {{
                                                    formatDate(
                                                        purchase.order_date,
                                                    )
                                                }}
                                            </p>
                                        </td>
                                        <td class="px-4 py-3">
                                            {{ purchase.supplier?.name || '-' }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-mono"
                                        >
                                            {{ purchase.total_units_ordered }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-mono"
                                        >
                                            {{ purchase.total_units_received }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-mono font-semibold"
                                        >
                                            {{ formatCurrency(purchase.total) }}
                                        </td>
                                    </tr>
                                    <tr
                                        v-if="operationalPurchases.length === 0"
                                    >
                                        <td
                                            colspan="5"
                                            class="px-4 py-8 text-center text-sm text-gray-500"
                                        >
                                            Sin compras recientes para este
                                            producto.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                    <section
                        id="proveedores"
                        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                    >
                        <div class="mb-3 flex items-center gap-2">
                            <Star :size="18" class="text-amber-500" />
                            <h2
                                class="font-semibold text-gray-950 dark:text-white"
                            >
                                Proveedores
                            </h2>
                        </div>
                        <div class="grid gap-3 md:grid-cols-2">
                            <div
                                v-for="supplier in product.suppliers"
                                :key="supplier.id"
                                class="rounded-lg border border-gray-100 p-3 dark:border-border"
                            >
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div>
                                        <p class="font-semibold">
                                            {{ supplier.name }}
                                        </p>
                                        <p class="text-xs text-gray-500">
                                            Entrega
                                            {{ supplier.lead_time_days }} dias ·
                                            MOQ
                                            {{
                                                supplier.minimum_order_quantity
                                            }}
                                        </p>
                                    </div>
                                    <span
                                        v-if="supplier.is_preferred"
                                        class="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                                    >
                                        Preferido
                                    </span>
                                </div>
                                <p class="mt-3 font-mono text-lg font-semibold">
                                    {{ formatCurrency(supplier.supplier_cost) }}
                                </p>
                            </div>
                            <p
                                v-if="!product.suppliers?.length"
                                class="text-sm text-gray-500"
                            >
                                Sin proveedores vinculados.
                            </p>
                        </div>
                    </section>

                    <section id="referencias" class="grid gap-4 lg:grid-cols-2">
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                        >
                            <div class="mb-3 flex items-center gap-2">
                                <Box :size="18" class="text-emerald-600" />
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Atributos tecnicos
                                </h2>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Link
                                    v-for="attribute in attributes"
                                    :key="`${attribute.name}-${attribute.value}`"
                                    :href="`/products?attribute_value=${encodeURIComponent(String(attribute.value))}`"
                                    class="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:border-emerald-200 hover:bg-emerald-50 dark:border-border dark:bg-muted/30"
                                >
                                    <span class="block text-xs text-gray-500">{{
                                        attribute.name
                                    }}</span>
                                    <span class="font-semibold">
                                        {{ attribute.value }}
                                        <span v-if="attribute.unit">{{
                                            attribute.unit
                                        }}</span>
                                    </span>
                                </Link>
                                <p
                                    v-if="!attributes.length"
                                    class="text-sm text-gray-500"
                                >
                                    Sin atributos registrados.
                                </p>
                            </div>
                        </div>

                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                        >
                            <div class="mb-3 flex items-center gap-2">
                                <FileText :size="18" class="text-emerald-600" />
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Referencias OEM
                                </h2>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Link
                                    v-for="reference in oemReferences"
                                    :key="`${reference.manufacturer}-${reference.oem_code}`"
                                    :href="`/products?oem_code=${encodeURIComponent(reference.oem_code)}`"
                                    class="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:border-emerald-200 hover:bg-emerald-50 dark:border-border dark:bg-muted/30"
                                >
                                    <span
                                        class="block font-mono font-semibold"
                                        >{{ reference.oem_code }}</span
                                    >
                                    <span class="text-xs text-gray-500">{{
                                        reference.manufacturer || '-'
                                    }}</span>
                                </Link>
                                <p
                                    v-if="!oemReferences.length"
                                    class="text-sm text-gray-500"
                                >
                                    Sin referencias OEM.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section
                        id="compatibilidad"
                        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                    >
                        <div class="mb-3 flex items-center gap-2">
                            <Car :size="18" class="text-emerald-600" />
                            <h2
                                class="font-semibold text-gray-950 dark:text-white"
                            >
                                Compatibilidad vehicular
                            </h2>
                        </div>
                        <div
                            v-if="product.is_universal"
                            class="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300"
                        >
                            Producto universal compatible con multiples
                            vehiculos.
                        </div>
                        <div
                            v-else-if="compatibility.length"
                            class="grid gap-3 md:grid-cols-2"
                        >
                            <div
                                v-for="(item, index) in compatibility"
                                :key="item.id ?? index"
                                class="rounded-lg border border-gray-100 p-3 text-sm dark:border-border"
                            >
                                <p class="font-semibold">
                                    {{ item.make || '-' }}
                                    {{ item.model || '' }}
                                </p>
                                <p class="text-gray-500">
                                    {{ item.year_range || '-' }}
                                </p>
                                <p>
                                    Motor:
                                    {{
                                        item.engine ||
                                        (item.all_engines ? 'Todos' : '-')
                                    }}
                                </p>
                                <p v-if="item.chassis?.full_description">
                                    Chasis: {{ item.chassis.full_description }}
                                </p>
                                <p
                                    v-if="item.notes"
                                    class="mt-1 text-xs text-gray-500"
                                >
                                    {{ item.notes }}
                                </p>
                            </div>
                        </div>
                        <p v-else class="text-sm text-gray-500">
                            No hay compatibilidad definida.
                        </p>
                    </section>

                    <section
                        id="alternativas"
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-100 px-4 py-3 dark:border-border"
                        >
                            <div class="flex items-center gap-2">
                                <Layers :size="18" class="text-emerald-600" />
                                <h2
                                    class="font-semibold text-gray-950 dark:text-white"
                                >
                                    Alternativas y sustitutos
                                </h2>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead
                                    class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                                >
                                    <tr>
                                        <th class="px-4 py-2 text-left">
                                            Producto
                                        </th>
                                        <th class="px-4 py-2 text-left">
                                            Relacion
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Stock
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Precio
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="alternative in alternatives"
                                        :key="alternative.id"
                                        class="border-t border-gray-100 dark:border-border"
                                    >
                                        <td class="px-4 py-3">
                                            <Link
                                                :href="`/products/${alternative.id}`"
                                                class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                                            >
                                                {{ alternative.name }}
                                            </Link>
                                            <p
                                                class="font-mono text-xs text-gray-500"
                                            >
                                                {{ alternative.sku_base }}
                                            </p>
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                relationLabel(
                                                    alternative.pivot
                                                        ?.relationship_type,
                                                )
                                            }}
                                        </td>
                                        <td class="px-4 py-3 text-right">
                                            {{ alternative.total_stock ?? '-' }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-mono"
                                        >
                                            {{
                                                formatCurrency(
                                                    alternative.pricing
                                                        ?.base_price,
                                                )
                                            }}
                                        </td>
                                    </tr>
                                    <tr v-if="!alternatives.length">
                                        <td
                                            colspan="4"
                                            class="px-4 py-8 text-center text-sm text-gray-500"
                                        >
                                            Sin alternativas registradas.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </template>
            </div>
        </div>
    </AppLayout>
</template>
