<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useSuppliers } from '@/composables/useSuppliers';
import apiClient from '@/services/api/client';
import {
    ArrowLeft,
    Pencil,
    Package,
    Mail,
    Phone,
    MapPin,
    Clock,
    CreditCard,
    Building2,
    Tag,
    Plus,
    X,
    Search,
    Trash2,
} from 'lucide-vue-next';

const props = defineProps<{ supplierId: number }>();

const {
    supplier,
    supplierProducts,
    supplierBrands,
    availableBrands,
    loadingBrands,
    loading,
    error,
    fetchSupplierById,
    fetchSupplierBrands,
    fetchAvailableBrands,
    attachBrandToSupplier,
    detachBrandFromSupplier,
    attachVariantToSupplier,
    detachVariantFromSupplier,
} = useSuppliers();

const showBrandSelector = ref(false);
const attachingBrand = ref(false);
const selectedBrandId = ref<number | null>(null);
const variantSearch = ref('');
const variantResults = ref<any[]>([]);
const searchingVariants = ref(false);
const attachingVariant = ref(false);
const variantForm = ref({
    variant_id: null as number | null,
    label: '',
    supplier_cost: 0,
    lead_time_days: null as number | null,
    minimum_order_quantity: 1,
    is_preferred: false,
});

const brandsNotYetLinked = computed(() => {
    const linkedIds = new Set(supplierBrands.value.map((b) => b.id));
    return availableBrands.value.filter((b) => !linkedIds.has(b.id));
});

onMounted(async () => {
    await fetchSupplierById(props.supplierId);
    fetchSupplierBrands(props.supplierId).catch(() => {});
    fetchAvailableBrands().catch(() => {});
});

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
    } catch (e) {
        console.error('Error attaching brand:', e);
    } finally {
        attachingBrand.value = false;
    }
};

const removeBrand = async (brandId: number) => {
    if (!confirm('¿Desasociar esta marca del proveedor?')) return;
    try {
        await detachBrandFromSupplier(props.supplierId, brandId);
    } catch (e) {
        console.error('Error detaching brand:', e);
    }
};

const searchVariants = async () => {
    if (variantSearch.value.length < 2) {
        variantResults.value = [];
        return;
    }

    searchingVariants.value = true;
    try {
        const { data } = await apiClient.get('/products', {
            params: {
                search: variantSearch.value,
                per_page: 20,
                with_variants: true,
            },
        });
        const query = variantSearch.value.toLowerCase();
        variantResults.value = (data.data || []).flatMap((product: any) => {
            const variants = product.variants?.length
                ? product.variants
                : product.default_variant
                  ? [product.default_variant]
                  : [];
            return variants
                .filter((variant: any) => {
                    const brandName = variant.brand?.name || '';
                    const sku = variant.sku || product.sku_base || '';
                    return (
                        product.name.toLowerCase().includes(query) ||
                        sku.toLowerCase().includes(query) ||
                        brandName.toLowerCase().includes(query)
                    );
                })
                .map((variant: any) => ({
                    id: variant.id,
                    label: `${product.name} · ${variant.brand?.name || 'Sin marca'} · ${variant.sku || product.sku_base || 'N/A'}`,
                    cost: variant.pricing?.cost ?? product.pricing?.cost ?? 0,
                }));
        });
    } finally {
        searchingVariants.value = false;
    }
};

const selectVariant = (row: any) => {
    variantForm.value.variant_id = row.id;
    variantForm.value.label = row.label;
    variantForm.value.supplier_cost = Number(row.cost || 0);
    variantSearch.value = '';
    variantResults.value = [];
};

const attachSelectedVariant = async () => {
    if (!variantForm.value.variant_id) return;
    attachingVariant.value = true;
    try {
        await attachVariantToSupplier(props.supplierId, {
            variant_id: variantForm.value.variant_id,
            supplier_cost: Number(variantForm.value.supplier_cost || 0),
            lead_time_days: variantForm.value.lead_time_days ?? undefined,
            minimum_order_quantity: Number(
                variantForm.value.minimum_order_quantity || 1,
            ),
            is_preferred: variantForm.value.is_preferred,
        });
        variantForm.value = {
            variant_id: null,
            label: '',
            supplier_cost: 0,
            lead_time_days: null,
            minimum_order_quantity: 1,
            is_preferred: false,
        };
    } finally {
        attachingVariant.value = false;
    }
};

const removeVariant = async (variantId?: number | null) => {
    if (!variantId || !confirm('¿Desasociar esta variante del proveedor?'))
        return;
    await detachVariantFromSupplier(props.supplierId, variantId);
};
</script>

<template>
    <Head :title="supplier?.name || 'Proveedor'" />
    <AppLayout>
        <div class="mx-auto max-w-4xl space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <Link
                        href="/suppliers"
                        class="p-2 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <ArrowLeft :size="24" />
                    </Link>
                    <div>
                        <h1
                            class="text-3xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ supplier?.name }}
                        </h1>
                        <p
                            class="mt-1 text-sm text-gray-500 dark:text-gray-400"
                        >
                            Detalle del proveedor
                        </p>
                    </div>
                </div>
                <Link
                    v-if="supplier"
                    :href="`/suppliers/${supplier.id}/edit`"
                    class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Pencil :size="18" />
                    Editar
                </Link>
            </div>

            <div v-if="loading" class="flex items-center justify-center py-12">
                <div
                    class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
                ></div>
            </div>

            <template v-else-if="supplier">
                <!-- Info Cards -->
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <!-- Contact Info -->
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            <Building2 :size="20" class="text-indigo-500" />
                            Información de Contacto
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
                                        — {{ supplier.country }}</span
                                    >
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <!-- Commercial Info -->
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            <CreditCard :size="20" class="text-indigo-500" />
                            Información Comercial
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
                                    {{ supplier.lead_time_days }} días de
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

                <!-- Products Table -->
                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center gap-2 border-b border-gray-200 px-6 py-4 dark:border-border"
                    >
                        <Package :size="20" class="text-indigo-500" />
                        <h2
                            class="text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            Variantes suministradas ({{
                                supplierProducts.length
                            }})
                        </h2>
                    </div>
                    <div
                        class="border-b border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted/20"
                    >
                        <div
                            class="grid gap-3 lg:grid-cols-[1fr_130px_110px_110px_auto]"
                        >
                            <div class="relative">
                                <Search
                                    class="absolute top-2.5 left-3 text-gray-400"
                                    :size="18"
                                />
                                <input
                                    v-model="variantSearch"
                                    type="text"
                                    placeholder="Buscar variante por producto, marca o SKU..."
                                    class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    @input="searchVariants"
                                />
                                <div
                                    v-if="variantResults.length"
                                    class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card"
                                >
                                    <button
                                        v-for="row in variantResults"
                                        :key="row.id"
                                        type="button"
                                        class="block w-full border-b border-gray-100 px-4 py-2 text-left text-sm last:border-0 hover:bg-gray-50 dark:border-border dark:hover:bg-muted/50"
                                        @click="selectVariant(row)"
                                    >
                                        {{ row.label }}
                                    </button>
                                </div>
                                <p
                                    v-if="variantForm.label"
                                    class="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                                >
                                    Seleccionada: {{ variantForm.label }}
                                </p>
                                <p
                                    v-else-if="searchingVariants"
                                    class="mt-1 text-xs text-gray-500"
                                >
                                    Buscando...
                                </p>
                            </div>
                            <input
                                v-model.number="variantForm.supplier_cost"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Costo"
                                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            />
                            <input
                                v-model.number="
                                    variantForm.minimum_order_quantity
                                "
                                type="number"
                                min="1"
                                placeholder="MOQ"
                                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            />
                            <input
                                v-model.number="variantForm.lead_time_days"
                                type="number"
                                min="0"
                                placeholder="Dias"
                                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            />
                            <button
                                type="button"
                                :disabled="
                                    !variantForm.variant_id || attachingVariant
                                "
                                class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                @click="attachSelectedVariant"
                            >
                                <Plus :size="16" />
                                Asociar
                            </button>
                        </div>
                        <label
                            class="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                            <input
                                v-model="variantForm.is_preferred"
                                type="checkbox"
                                class="rounded border-gray-300"
                            />
                            Marcar como proveedor preferido de esta variante
                        </label>
                    </div>
                    <div class="overflow-x-auto">
                        <table
                            v-if="supplierProducts.length"
                            class="min-w-full divide-y divide-gray-200 dark:divide-border"
                        >
                            <thead class="bg-gray-50 dark:bg-background">
                                <tr>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        SKU
                                    </th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Producto
                                    </th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Marca
                                    </th>
                                    <th
                                        class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Stock
                                    </th>
                                    <th
                                        class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Costo
                                    </th>
                                    <th
                                        class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Lead Time
                                    </th>
                                    <th
                                        class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        MOQ
                                    </th>
                                    <th
                                        class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Preferido
                                    </th>
                                    <th
                                        class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                    >
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-gray-200 dark:divide-border"
                            >
                                <tr
                                    v-for="p in supplierProducts"
                                    :key="p.id"
                                    class="hover:bg-gray-50 dark:hover:bg-muted/50"
                                >
                                    <td
                                        class="px-6 py-3 font-mono text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        {{ p.product_sku }}
                                    </td>
                                    <td class="px-6 py-3">
                                        <Link
                                            :href="`/products/${p.product_id}`"
                                            class="text-sm text-indigo-600 hover:underline dark:text-indigo-400 dark:text-primary"
                                        >
                                            {{ p.product_name }}
                                        </Link>
                                    </td>
                                    <td
                                        class="px-6 py-3 text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        {{ p.brand_name || '-' }}
                                    </td>
                                    <td
                                        class="px-6 py-3 text-right text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        {{ p.total_stock ?? 0 }}
                                    </td>
                                    <td
                                        class="px-6 py-3 text-right text-sm text-gray-900 dark:text-white"
                                    >
                                        ${{
                                            Number(p.supplier_cost).toFixed(2)
                                        }}
                                    </td>
                                    <td
                                        class="px-6 py-3 text-right text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        {{ p.lead_time_days || '-' }} días
                                    </td>
                                    <td
                                        class="px-6 py-3 text-right text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        {{ p.minimum_order_quantity || '-' }}
                                    </td>
                                    <td class="px-6 py-3 text-center">
                                        <span
                                            v-if="p.is_preferred"
                                            class="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                                            >Preferido</span
                                        >
                                        <span
                                            v-else
                                            class="text-sm text-gray-400"
                                            >-</span
                                        >
                                    </td>
                                    <td class="px-6 py-3 text-right">
                                        <button
                                            type="button"
                                            class="inline-flex p-2 text-gray-400 hover:text-red-600"
                                            title="Desasociar variante"
                                            @click="removeVariant(p.variant_id)"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div
                            v-else
                            class="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                        >
                            <Package
                                class="mx-auto mb-3 text-gray-300"
                                :size="48"
                            />
                            <p>Este proveedor no tiene variantes asociadas</p>
                        </div>
                    </div>
                </div>

                <!-- Brands Section -->
                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border"
                    >
                        <div class="flex items-center gap-2">
                            <Tag :size="20" class="text-indigo-500" />
                            <h2
                                class="text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                Marcas Asociadas ({{ supplierBrands.length }})
                            </h2>
                        </div>
                        <button
                            type="button"
                            @click="openBrandSelector"
                            class="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            <Plus :size="16" />
                            Agregar Marca
                        </button>
                    </div>

                    <!-- Add brand selector -->
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
                                @click="attachSelectedBrand"
                                :disabled="!selectedBrandId || attachingBrand"
                                class="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {{
                                    attachingBrand ? 'Asociando...' : 'Asociar'
                                }}
                            </button>
                            <button
                                type="button"
                                @click="showBrandSelector = false"
                                class="px-3 py-2 text-sm text-gray-600 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Cancelar
                            </button>
                        </div>
                        <p
                            v-if="brandsNotYetLinked.length === 0"
                            class="mt-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                            Todas las marcas ya están asociadas a este
                            proveedor.
                        </p>
                    </div>

                    <div class="p-6">
                        <div
                            v-if="loadingBrands"
                            class="flex justify-center py-4"
                        >
                            <div
                                class="h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
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
                                    @click="removeBrand(brand.id)"
                                    class="ml-0.5 text-blue-400 transition hover:text-red-500"
                                    title="Desasociar marca"
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
            </template>
        </div>
    </AppLayout>
</template>
