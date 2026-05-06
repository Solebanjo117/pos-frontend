<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import {
    ArrowLeft,
    Building2,
    ChevronDown,
    ChevronRight,
    Clock,
    CreditCard,
    Mail,
    MapPin,
    Package,
    Pencil,
    Phone,
    Plus,
    Save,
    Search,
    Tag,
    Trash2,
    X,
} from 'lucide-vue-next';
import ProductVariantPickerModal from '@/components/Products/ProductVariantPickerModal.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { useSuppliers } from '@/composables/useSuppliers';
import apiClient from '@/services/api/client';
import type { Product } from '@/types/product';
import type { ProductVariantSelection } from '@/types/product-variant-picker';
import type { SupplierProduct } from '@/types/supplier';

interface PaginationState {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from?: number | null;
    to?: number | null;
}

interface PickerFilters {
    query: string;
    category_ids?: number[];
    brand_ids?: number[];
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort?: string;
}

interface EditForm {
    supplier_cost: number;
    lead_time_days: number | null;
    minimum_order_quantity: number;
    is_preferred: boolean;
}

interface SupplierProductLink {
    product_id: number;
    variant_id: number | null;
    supplier_cost: number;
    lead_time_days: number | null;
    minimum_order_quantity: number | null;
    is_preferred: boolean;
}

const props = defineProps<{ supplierId: number }>();

const {
    supplier,
    supplierProducts,
    supplierBrands,
    availableBrands,
    loadingBrands,
    loading,
    fetchSupplierById,
    fetchSupplierBrands,
    fetchAvailableBrands,
    attachBrandToSupplier,
    detachBrandFromSupplier,
    attachVariantToSupplier,
    updateSupplierVariant,
    detachVariantFromSupplier,
} = useSuppliers();

const showBrandSelector = ref(false);
const attachingBrand = ref(false);
const selectedBrandId = ref<number | null>(null);
const linkingProducts = ref(false);
const supplierProductActionError = ref<string | null>(null);

const showProductPicker = ref(false);
const pickerProducts = ref<Product[]>([]);
const pickerFilters = ref<PickerFilters>({ query: '' });
const pickerLoading = ref(false);
const pickerLoadingMore = ref(false);
const pickerCurrentPage = ref(1);
const pickerLastPage = ref(1);
const pickerTotal = ref(0);
const productFilterCategories = ref<Array<{ id: number; name: string }>>([]);
const productFilterBrands = ref<Array<{ id: number; name: string }>>([]);

const suppliedSearch = ref('');
const suppliedPage = ref(1);
const loadingSupplierProducts = ref(false);
const supplierProductsPagination = ref<PaginationState>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
    from: null,
    to: null,
});
const expandedProductIds = ref<Set<number>>(new Set());
const editForms = ref<Record<number, EditForm>>({});
const savingVariantIds = ref<Set<number>>(new Set());
const selectedSupplierProductLinks = ref<SupplierProductLink[]>([]);

const brandsNotYetLinked = computed(() => {
    const linkedIds = new Set(supplierBrands.value.map((b) => b.id));
    return availableBrands.value.filter((b) => !linkedIds.has(b.id));
});

const selectedSupplierBrandIds = computed(() =>
    supplierBrands.value.map((brand) => Number(brand.id)),
);

const buildSupplierProductLinks = (
    rows: SupplierProduct[],
): SupplierProductLink[] =>
    rows.map((row) => ({
        product_id: Number(row.product_id),
        variant_id: row.variant_id ? Number(row.variant_id) : null,
        supplier_cost: Number(row.supplier_cost || 0),
        lead_time_days: row.lead_time_days ?? null,
        minimum_order_quantity: row.minimum_order_quantity ?? null,
        is_preferred: Boolean(row.is_preferred),
    }));

const groupedSupplierProducts = computed(() => {
    const groups = new Map<
        number,
        {
            product_id: number;
            product_name: string;
            product_sku?: string | null;
            variants: SupplierProduct[];
            total_stock: number;
            min_cost: number;
            average_cost: number;
        }
    >();

    supplierProducts.value.forEach((row) => {
        const productId = Number(row.product_id);
        const current = groups.get(productId) ?? {
            product_id: productId,
            product_name: row.product_name,
            product_sku: row.product_sku,
            variants: [],
            total_stock: 0,
            min_cost: Number(row.supplier_cost || 0),
            average_cost: 0,
        };
        const variants = [...current.variants, row];
        const costs = variants.map((item) => Number(item.supplier_cost || 0));

        groups.set(productId, {
            ...current,
            variants,
            total_stock: variants.reduce(
                (total, item) => total + Number(item.total_stock || 0),
                0,
            ),
            min_cost: Math.min(...costs),
            average_cost:
                costs.reduce((total, cost) => total + cost, 0) / costs.length,
        });
    });

    return Array.from(groups.values());
});

onMounted(async () => {
    await fetchSupplierById(props.supplierId);
    selectedSupplierProductLinks.value = buildSupplierProductLinks(
        supplierProducts.value,
    );
    await Promise.all([
        fetchSupplierBrands(props.supplierId).catch(() => {}),
        fetchAvailableBrands().catch(() => {}),
        fetchProductFilterOptions(),
    ]);
    fetchSupplierProducts();
});

const syncEditForms = (): void => {
    const next = { ...editForms.value };

    supplierProducts.value.forEach((row) => {
        if (!row.variant_id) return;

        next[row.variant_id] = {
            supplier_cost: Number(row.supplier_cost || 0),
            lead_time_days: row.lead_time_days ?? null,
            minimum_order_quantity: Number(row.minimum_order_quantity || 1),
            is_preferred: Boolean(row.is_preferred),
        };
    });

    editForms.value = next;
};

const refreshSupplierProductLinks = async (): Promise<void> => {
    const { data } = await apiClient.get(`/suppliers/${props.supplierId}`);
    selectedSupplierProductLinks.value = buildSupplierProductLinks(
        data.products || [],
    );
};

const fetchSupplierProducts = async (page = suppliedPage.value) => {
    loadingSupplierProducts.value = true;
    try {
        const { data } = await apiClient.get(
            `/suppliers/${props.supplierId}/variants`,
            {
                params: {
                    search: suppliedSearch.value || undefined,
                    page,
                    per_page: supplierProductsPagination.value.per_page,
                },
            },
        );

        supplierProducts.value = data.data || [];
        supplierProductsPagination.value = {
            current_page: data.current_page ?? page,
            last_page: data.last_page ?? 1,
            per_page: data.per_page ?? 10,
            total: data.total ?? supplierProducts.value.length,
            from: data.from ?? null,
            to: data.to ?? null,
        };
        suppliedPage.value = supplierProductsPagination.value.current_page;
        syncEditForms();
    } finally {
        loadingSupplierProducts.value = false;
    }
};

const openBrandSelector = () => {
    showBrandSelector.value = true;
    selectedBrandId.value = null;
};

const attachSelectedBrand = async () => {
    if (!selectedBrandId.value) return;
    attachingBrand.value = true;
    try {
        await attachBrandToSupplier(props.supplierId, selectedBrandId.value);
        showBrandSelector.value = false;
        selectedBrandId.value = null;
    } finally {
        attachingBrand.value = false;
    }
};

const removeBrand = async (brandId: number) => {
    if (!confirm('Desasociar esta marca del proveedor?')) return;
    await detachBrandFromSupplier(props.supplierId, brandId);
};

const toggleProductGroup = (productId: number): void => {
    const next = new Set(expandedProductIds.value);

    if (next.has(productId)) {
        next.delete(productId);
    } else {
        next.add(productId);
    }

    expandedProductIds.value = next;
};

const fetchProductFilterOptions = async () => {
    try {
        const [categoriesResponse, brandsResponse] = await Promise.all([
            apiClient.get('/categories'),
            apiClient.get('/brands'),
        ]);

        productFilterCategories.value =
            categoriesResponse.data.data ?? categoriesResponse.data ?? [];
        productFilterBrands.value =
            brandsResponse.data.data ?? brandsResponse.data ?? [];
    } catch (e) {
        productFilterCategories.value = [];
        productFilterBrands.value = [];
    }
};

const fetchPickerProducts = async (append = false) => {
    if (append && pickerCurrentPage.value >= pickerLastPage.value) return;

    if (append) {
        pickerLoadingMore.value = true;
    } else {
        pickerLoading.value = true;
        pickerCurrentPage.value = 1;
    }

    try {
        const page = append ? pickerCurrentPage.value + 1 : 1;
        const filters = pickerFilters.value;
        const { data } = await apiClient.get('/products', {
            params: {
                search: filters.query || undefined,
                category_id: filters.category_ids,
                brand_id: filters.brand_ids,
                min_price: filters.min_price,
                max_price: filters.max_price,
                in_stock: filters.in_stock,
                sort: filters.sort,
                page,
                per_page: 20,
                with_variants: true,
            },
        });

        const rows = data.data || [];
        pickerProducts.value = append
            ? [...pickerProducts.value, ...rows]
            : rows;
        pickerCurrentPage.value = data.meta?.current_page ?? page;
        pickerLastPage.value = data.meta?.last_page ?? page;
        pickerTotal.value = data.meta?.total ?? rows.length;
    } finally {
        pickerLoading.value = false;
        pickerLoadingMore.value = false;
    }
};

const openProductPicker = () => {
    supplierProductActionError.value = null;
    showProductPicker.value = true;
    pickerFilters.value = { query: '' };
    refreshSupplierProductLinks().catch(() => {});
    fetchPickerProducts();
};

const handlePickerSearch = (filters: PickerFilters) => {
    pickerFilters.value = filters;
    fetchPickerProducts();
};

const addVariantSelections = async (selections: ProductVariantSelection[]) => {
    const rows = selections.filter(
        (selection) => selection.variant?.id || selection.product?.id,
    );

    if (!rows.length) {
        supplierProductActionError.value =
            'Selecciona al menos una variante o producto para vincular.';
        return;
    }

    linkingProducts.value = true;
    supplierProductActionError.value = null;

    try {
        for (const selection of rows) {
            await attachVariantToSupplier(props.supplierId, {
                variant_id: selection.variant?.id
                    ? Number(selection.variant.id)
                    : undefined,
                product_id: selection.variant?.id
                    ? undefined
                    : Number(selection.product.id),
                supplier_cost: Number(
                    selection.unitCost ?? selection.product.pricing?.cost ?? 0,
                ),
                lead_time_days: supplier.value?.lead_time_days ?? undefined,
                minimum_order_quantity: 1,
                is_preferred: false,
            });
        }

        showProductPicker.value = false;
        await fetchSupplierBrands(props.supplierId).catch(() => {});
        await refreshSupplierProductLinks().catch(() => {});
        await fetchSupplierProducts(1);
    } catch (error: any) {
        supplierProductActionError.value =
            error?.response?.data?.message ||
            'No se pudieron vincular los productos seleccionados.';
    } finally {
        linkingProducts.value = false;
    }
};

const searchSupplierProducts = () => {
    fetchSupplierProducts(1);
};

const updateVariant = async (row: SupplierProduct) => {
    if (!row.variant_id) return;

    const form = editForms.value[row.variant_id];
    if (!form) return;

    const nextSaving = new Set(savingVariantIds.value);
    nextSaving.add(row.variant_id);
    savingVariantIds.value = nextSaving;

    try {
        await updateSupplierVariant(props.supplierId, row.variant_id, {
            supplier_cost: Number(form.supplier_cost || 0),
            lead_time_days: form.lead_time_days ?? undefined,
            minimum_order_quantity: Number(form.minimum_order_quantity || 1),
            is_preferred: form.is_preferred,
        });
        await refreshSupplierProductLinks().catch(() => {});
        await fetchSupplierProducts(suppliedPage.value);
    } finally {
        const doneSaving = new Set(savingVariantIds.value);
        doneSaving.delete(row.variant_id);
        savingVariantIds.value = doneSaving;
    }
};

const removeVariant = async (variantId?: number | null) => {
    if (!variantId || !confirm('Desasociar esta variante del proveedor?')) {
        return;
    }

    await detachVariantFromSupplier(props.supplierId, variantId);
    await refreshSupplierProductLinks().catch(() => {});
    await fetchSupplierProducts(suppliedPage.value);
};
</script>

<template>
    <Head :title="supplier?.name || 'Proveedor'" />
    <AppLayout>
        <div class="mx-auto max-w-6xl space-y-6">
            <div
                class="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/30 dark:bg-card"
            >
                <div
                    class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                >
                    <div class="flex min-w-0 items-start gap-3">
                        <div
                            class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                            <Building2 :size="20" />
                        </div>
                        <div class="min-w-0">
                            <nav
                                class="mb-1 hidden items-center gap-1.5 text-xs font-medium text-gray-500 md:flex dark:text-gray-400"
                            >
                                <Link
                                    href="/suppliers"
                                    class="hover:text-emerald-700 dark:hover:text-emerald-300"
                                >
                                    Proveedores
                                </Link>
                                <ChevronRight :size="14" />
                            </nav>
                            <div
                                class="flex min-w-0 flex-wrap items-center gap-2"
                            >
                                <h1
                                    class="truncate text-lg font-semibold text-gray-950 dark:text-white"
                                >
                                    {{ supplier?.name }}
                                </h1>
                                <span
                                    v-if="supplier"
                                    :class="[
                                        'rounded-md border px-2 py-0.5 text-xs font-semibold',
                                        supplier.status === 'active'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                            : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-border dark:bg-muted dark:text-gray-300',
                                    ]"
                                >
                                    {{
                                        supplier.status === 'active'
                                            ? 'Activo'
                                            : 'Inactivo'
                                    }}
                                </span>
                            </div>
                            <p
                                class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400"
                            >
                                Productos suministrados:
                                {{ supplierProductsPagination.total }} | Marcas:
                                {{ supplierBrands.length }}
                            </p>
                        </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Link
                            href="/suppliers"
                            class="p-2 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
                            title="Volver"
                        >
                            <ArrowLeft :size="24" />
                        </Link>
                        <Link
                            v-if="supplier"
                            :href="`/suppliers/${supplier.id}/edit`"
                            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            <Pencil :size="18" />
                            Editar
                        </Link>
                    </div>
                </div>
            </div>

            <div v-if="loading" class="flex items-center justify-center py-12">
                <div
                    class="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600 dark:border-primary"
                ></div>
            </div>

            <template v-else-if="supplier">
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            <Building2 :size="20" class="text-emerald-500" />
                            Informacion de Contacto
                        </h2>
                        <dl class="space-y-3">
                            <div
                                v-if="supplier.contact_name"
                                class="flex items-start gap-2"
                            >
                                <dt
                                    class="w-24 shrink-0 text-sm text-gray-500 dark:text-gray-400"
                                >
                                    Contacto:
                                </dt>
                                <dd
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    {{ supplier.contact_name }}
                                </dd>
                            </div>
                            <div
                                v-if="supplier.email"
                                class="flex items-start gap-2"
                            >
                                <Mail
                                    :size="16"
                                    class="mt-0.5 shrink-0 text-gray-400"
                                />
                                <dd
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    {{ supplier.email }}
                                </dd>
                            </div>
                            <div
                                v-if="supplier.phone"
                                class="flex items-start gap-2"
                            >
                                <Phone
                                    :size="16"
                                    class="mt-0.5 shrink-0 text-gray-400"
                                />
                                <dd
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    {{ supplier.phone }}
                                </dd>
                            </div>
                            <div
                                v-if="supplier.address"
                                class="flex items-start gap-2"
                            >
                                <MapPin
                                    :size="16"
                                    class="mt-0.5 shrink-0 text-gray-400"
                                />
                                <dd
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    {{ supplier.address }}
                                    <span v-if="supplier.city"
                                        >, {{ supplier.city }}</span
                                    >
                                    <span v-if="supplier.country">
                                        - {{ supplier.country }}</span
                                    >
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div
                        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            <CreditCard :size="20" class="text-emerald-500" />
                            Informacion Comercial
                        </h2>
                        <dl class="space-y-3">
                            <div class="flex items-start gap-2">
                                <dt
                                    class="w-32 shrink-0 text-sm text-gray-500 dark:text-gray-400"
                                >
                                    Estado:
                                </dt>
                                <dd>
                                    <span
                                        :class="[
                                            'rounded-full px-2 py-1 text-xs font-semibold',
                                            supplier.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-400',
                                        ]"
                                    >
                                        {{
                                            supplier.status === 'active'
                                                ? 'Activo'
                                                : 'Inactivo'
                                        }}
                                    </span>
                                </dd>
                            </div>
                            <div
                                v-if="supplier.payment_terms"
                                class="flex items-start gap-2"
                            >
                                <CreditCard
                                    :size="16"
                                    class="mt-0.5 shrink-0 text-gray-400"
                                />
                                <dd
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    {{ supplier.payment_terms }}
                                </dd>
                            </div>
                            <div
                                v-if="supplier.lead_time_days"
                                class="flex items-start gap-2"
                            >
                                <Clock
                                    :size="16"
                                    class="mt-0.5 shrink-0 text-gray-400"
                                />
                                <dd
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    {{ supplier.lead_time_days }} dias de
                                    entrega
                                </dd>
                            </div>
                        </dl>
                        <div
                            v-if="supplier.notes"
                            class="mt-4 border-t border-gray-200 pt-4 dark:border-border"
                        >
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                {{ supplier.notes }}
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                >
                    <div
                        class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-border"
                    >
                        <div class="flex items-center gap-2">
                            <Package :size="20" class="text-emerald-500" />
                            <h2
                                class="text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                Productos suministrados ({{
                                    supplierProductsPagination.total
                                }})
                            </h2>
                        </div>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="linkingProducts"
                            @click="openProductPicker"
                        >
                            <Plus :size="16" />
                            {{
                                linkingProducts
                                    ? 'Vinculando...'
                                    : 'Vincular productos'
                            }}
                        </button>
                    </div>

                    <div
                        v-if="supplierProductActionError"
                        class="border-b border-red-200 bg-red-50 px-6 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                    >
                        {{ supplierProductActionError }}
                    </div>

                    <div
                        class="border-b border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted/20"
                    >
                        <div class="flex flex-col gap-3 md:flex-row">
                            <div class="relative flex-1">
                                <Search
                                    class="absolute top-2.5 left-3 text-gray-400"
                                    :size="18"
                                />
                                <input
                                    v-model="suppliedSearch"
                                    type="text"
                                    placeholder="Buscar por producto, SKU o marca..."
                                    class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    @keyup.enter="searchSupplierProducts"
                                />
                            </div>
                            <button
                                type="button"
                                class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                                @click="searchSupplierProducts"
                            >
                                <Search :size="16" />
                                Buscar
                            </button>
                        </div>
                    </div>

                    <div v-if="loadingSupplierProducts" class="p-8 text-center">
                        <div
                            class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600"
                        ></div>
                        <p class="mt-3 text-sm text-gray-500">
                            Cargando productos suministrados...
                        </p>
                    </div>

                    <div
                        v-else-if="groupedSupplierProducts.length"
                        class="divide-y divide-gray-200 dark:divide-border"
                    >
                        <div
                            v-for="group in groupedSupplierProducts"
                            :key="group.product_id"
                        >
                            <button
                                type="button"
                                class="grid w-full grid-cols-[auto_1fr] gap-3 px-6 py-4 text-left transition hover:bg-gray-50 md:grid-cols-[auto_1fr_120px_120px_140px] dark:hover:bg-muted/40"
                                @click="toggleProductGroup(group.product_id)"
                            >
                                <span
                                    class="mt-1 rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-muted"
                                >
                                    <ChevronDown
                                        v-if="
                                            expandedProductIds.has(
                                                group.product_id,
                                            )
                                        "
                                        :size="18"
                                    />
                                    <ChevronRight v-else :size="18" />
                                </span>
                                <span>
                                    <Link
                                        :href="`/products/${group.product_id}`"
                                        class="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                                        @click.stop
                                    >
                                        {{ group.product_name }}
                                    </Link>
                                    <span
                                        class="mt-1 block font-mono text-xs text-gray-500"
                                    >
                                        {{ group.product_sku || 'N/A' }}
                                    </span>
                                </span>
                                <span class="text-sm text-gray-600">
                                    {{ group.variants.length }} vinculo(s)
                                </span>
                                <span class="text-sm text-gray-600">
                                    Stock {{ group.total_stock }}
                                </span>
                                <span class="text-sm text-gray-600">
                                    Desde ${{
                                        Number(group.min_cost || 0).toFixed(2)
                                    }}
                                    <span class="block text-xs text-gray-400">
                                        Prom. ${{
                                            Number(
                                                group.average_cost || 0,
                                            ).toFixed(2)
                                        }}
                                    </span>
                                </span>
                            </button>

                            <div
                                v-if="expandedProductIds.has(group.product_id)"
                                class="overflow-x-auto bg-gray-50 px-6 pb-4 dark:bg-muted/20"
                            >
                                <table class="min-w-full text-sm">
                                    <thead>
                                        <tr
                                            class="border-b border-gray-200 text-xs font-medium text-gray-500 uppercase dark:border-border"
                                        >
                                            <th class="py-2 text-left">SKU</th>
                                            <th class="py-2 text-left">
                                                Marca
                                            </th>
                                            <th class="py-2 text-right">
                                                Stock
                                            </th>
                                            <th class="py-2 text-right">
                                                Costo
                                            </th>
                                            <th class="py-2 text-right">MOQ</th>
                                            <th class="py-2 text-right">
                                                Lead time
                                            </th>
                                            <th class="py-2 text-center">
                                                Preferido
                                            </th>
                                            <th class="py-2 text-right">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="row in group.variants"
                                            :key="row.id"
                                            class="border-b border-gray-200 last:border-0 dark:border-border"
                                        >
                                            <td
                                                class="py-3 pr-4 font-mono text-gray-600 dark:text-gray-300"
                                            >
                                                <span v-if="row.variant_sku">{{
                                                    row.variant_sku
                                                }}</span>
                                                <span v-else>
                                                    {{
                                                        row.product_sku || 'N/A'
                                                    }}
                                                    <span
                                                        class="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 ring-inset"
                                                    >
                                                        Producto completo
                                                    </span>
                                                </span>
                                            </td>
                                            <td class="py-3 pr-4 text-gray-600">
                                                {{ row.brand_name || '-' }}
                                            </td>
                                            <td
                                                class="py-3 pr-4 text-right text-gray-600"
                                            >
                                                {{ row.total_stock ?? 0 }}
                                            </td>
                                            <td class="py-3 pr-4 text-right">
                                                <input
                                                    v-if="row.variant_id"
                                                    v-model.number="
                                                        editForms[
                                                            row.variant_id
                                                        ].supplier_cost
                                                    "
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    class="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm dark:border-border dark:bg-card"
                                                />
                                                <span
                                                    v-else
                                                    class="text-gray-700 dark:text-gray-200"
                                                >
                                                    ${{
                                                        Number(
                                                            row.supplier_cost ||
                                                                0,
                                                        ).toFixed(2)
                                                    }}
                                                </span>
                                            </td>
                                            <td class="py-3 pr-4 text-right">
                                                <input
                                                    v-if="row.variant_id"
                                                    v-model.number="
                                                        editForms[
                                                            row.variant_id
                                                        ].minimum_order_quantity
                                                    "
                                                    type="number"
                                                    min="1"
                                                    class="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm dark:border-border dark:bg-card"
                                                />
                                                <span
                                                    v-else
                                                    class="text-gray-600"
                                                >
                                                    {{
                                                        row.minimum_order_quantity ||
                                                        '-'
                                                    }}
                                                </span>
                                            </td>
                                            <td class="py-3 pr-4 text-right">
                                                <input
                                                    v-if="row.variant_id"
                                                    v-model.number="
                                                        editForms[
                                                            row.variant_id
                                                        ].lead_time_days
                                                    "
                                                    type="number"
                                                    min="0"
                                                    class="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm dark:border-border dark:bg-card"
                                                />
                                                <span
                                                    v-else
                                                    class="text-gray-600"
                                                >
                                                    {{
                                                        row.lead_time_days ||
                                                        '-'
                                                    }}
                                                </span>
                                            </td>
                                            <td class="py-3 pr-4 text-center">
                                                <input
                                                    v-if="row.variant_id"
                                                    v-model="
                                                        editForms[
                                                            row.variant_id
                                                        ].is_preferred
                                                    "
                                                    type="checkbox"
                                                    class="rounded border-gray-300"
                                                />
                                                <span
                                                    v-else-if="row.is_preferred"
                                                    class="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                                                >
                                                    Preferido
                                                </span>
                                                <span
                                                    v-else
                                                    class="text-sm text-gray-400"
                                                    >-</span
                                                >
                                            </td>
                                            <td
                                                class="space-x-1 py-3 text-right whitespace-nowrap"
                                            >
                                                <button
                                                    v-if="row.variant_id"
                                                    type="button"
                                                    class="inline-flex rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-muted"
                                                    :disabled="
                                                        !row.variant_id ||
                                                        savingVariantIds.has(
                                                            row.variant_id,
                                                        )
                                                    "
                                                    title="Guardar cambios"
                                                    @click="updateVariant(row)"
                                                >
                                                    <Save :size="16" />
                                                </button>
                                                <button
                                                    v-if="row.variant_id"
                                                    type="button"
                                                    class="inline-flex rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-muted"
                                                    title="Desasociar variante"
                                                    @click="
                                                        removeVariant(
                                                            row.variant_id,
                                                        )
                                                    "
                                                >
                                                    <Trash2 :size="16" />
                                                </button>
                                                <span
                                                    v-else
                                                    class="text-xs text-gray-400"
                                                >
                                                    Vinculo de producto
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div
                        v-else
                        class="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                        <Package
                            class="mx-auto mb-3 text-gray-300"
                            :size="48"
                        />
                        <p>Este proveedor no tiene productos asociados</p>
                    </div>

                    <div
                        v-if="supplierProductsPagination.total > 0"
                        class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 text-sm text-gray-600 dark:border-border dark:text-gray-300"
                    >
                        <span>
                            Mostrando
                            {{ supplierProductsPagination.from || 0 }} -
                            {{ supplierProductsPagination.to || 0 }} de
                            {{ supplierProductsPagination.total }}
                        </span>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                class="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-border"
                                :disabled="
                                    supplierProductsPagination.current_page <= 1
                                "
                                @click="
                                    fetchSupplierProducts(
                                        supplierProductsPagination.current_page -
                                            1,
                                    )
                                "
                            >
                                Anterior
                            </button>
                            <span>
                                Pagina
                                {{ supplierProductsPagination.current_page }} /
                                {{ supplierProductsPagination.last_page }}
                            </span>
                            <button
                                type="button"
                                class="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-border"
                                :disabled="
                                    supplierProductsPagination.current_page >=
                                    supplierProductsPagination.last_page
                                "
                                @click="
                                    fetchSupplierProducts(
                                        supplierProductsPagination.current_page +
                                            1,
                                    )
                                "
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border"
                    >
                        <div class="flex items-center gap-2">
                            <Tag :size="20" class="text-emerald-500" />
                            <h2
                                class="text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                Marcas Asociadas ({{ supplierBrands.length }})
                            </h2>
                        </div>
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white transition hover:bg-emerald-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                            @click="openBrandSelector"
                        >
                            <Plus :size="16" />
                            Agregar Marca
                        </button>
                    </div>

                    <div
                        v-if="showBrandSelector"
                        class="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-border dark:bg-muted/30"
                    >
                        <div class="flex items-center gap-3">
                            <select
                                v-model="selectedBrandId"
                                class="flex-1 rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option :value="null" disabled>
                                    Seleccionar marca...
                                </option>
                                <option
                                    v-for="brand in brandsNotYetLinked"
                                    :key="brand.id"
                                    :value="brand.id"
                                >
                                    {{ brand.name }}
                                </option>
                            </select>
                            <button
                                type="button"
                                class="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                :disabled="!selectedBrandId || attachingBrand"
                                @click="attachSelectedBrand"
                            >
                                {{
                                    attachingBrand ? 'Asociando...' : 'Asociar'
                                }}
                            </button>
                            <button
                                type="button"
                                class="px-3 py-2 text-sm text-gray-600 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                @click="showBrandSelector = false"
                            >
                                Cancelar
                            </button>
                        </div>
                        <p
                            v-if="brandsNotYetLinked.length === 0"
                            class="mt-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                            Todas las marcas ya estan asociadas a este
                            proveedor.
                        </p>
                    </div>

                    <div class="p-6">
                        <div
                            v-if="loadingBrands"
                            class="flex justify-center py-4"
                        >
                            <div
                                class="h-6 w-6 animate-spin rounded-full border-b-2 border-emerald-600 dark:border-primary"
                            ></div>
                        </div>
                        <div
                            v-else-if="supplierBrands.length"
                            class="flex flex-wrap gap-2"
                        >
                            <span
                                v-for="brand in supplierBrands"
                                :key="brand.id"
                                class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                            >
                                <Link
                                    :href="`/brands/${brand.id}/edit`"
                                    class="hover:underline"
                                >
                                    {{ brand.name }}
                                </Link>
                                <button
                                    type="button"
                                    class="ml-0.5 text-blue-400 transition hover:text-red-500"
                                    title="Desasociar marca"
                                    @click="removeBrand(brand.id)"
                                >
                                    <X :size="14" />
                                </button>
                            </span>
                        </div>
                        <div
                            v-else
                            class="py-6 text-center text-gray-500 dark:text-gray-400"
                        >
                            <Tag
                                class="mx-auto mb-2 text-gray-300"
                                :size="36"
                            />
                            <p>No hay marcas asociadas a este proveedor</p>
                        </div>
                    </div>
                </div>

                <ProductVariantPickerModal
                    :show="showProductPicker"
                    :products="pickerProducts"
                    :search-query="pickerFilters.query"
                    :total-count="pickerTotal"
                    :has-more="pickerCurrentPage < pickerLastPage"
                    :loading-more="pickerLoadingMore"
                    :loading="pickerLoading"
                    :categories="productFilterCategories"
                    :brands="productFilterBrands"
                    :selected-supplier-id="props.supplierId"
                    :selected-supplier-brand-ids="selectedSupplierBrandIds"
                    :selected-supplier-product-links="
                        selectedSupplierProductLinks
                    "
                    title="Vincular variantes suministradas"
                    confirm-label="Vincular"
                    context="supplier"
                    @close="showProductPicker = false"
                    @confirm="addVariantSelections"
                    @load-more="fetchPickerProducts(true)"
                    @search="handlePickerSearch"
                />
            </template>
        </div>
    </AppLayout>
</template>
