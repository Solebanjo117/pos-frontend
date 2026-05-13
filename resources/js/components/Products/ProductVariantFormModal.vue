<script setup lang="ts">
import { CircleDollarSign } from 'lucide-vue-next';
import { ref, computed, watch } from 'vue';
import PricingFormula from '@/components/Products/PricingFormula.vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { useProducts } from '@/composables/useProducts';
import { useStoreSettings } from '@/composables/useStoreSettings';
import apiClient from '@/services/api/client';

const props = defineProps<{
    open: boolean;
    productId: number;
    variantId?: number | null;
    categoryFormula?: string | null;
    categoryMargin?: number | null;
    categoryItbmPercent?: number | null;
    productName?: string;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    saved: [variant: any];
}>();

const { updateVariant, fetchVariants, loading, error } = useProducts();
const { settings: storeSettings, fetchSettings } = useStoreSettings();

const applyRounding = (price: number): number => {
    const increment = Number(storeSettings.value.price_rounding_increment) || 0;
    if (increment <= 0) return price;
    return Math.ceil(price / increment) * increment;
};

const processing = ref(false);
const loadingVariant = ref(false);
const editingVariant = ref<any>(null);

const brands = ref<{ id: number; name: string }[]>([]);
const loadingBrands = ref(false);

const fetchBrands = async () => {
    loadingBrands.value = true;
    try {
        const { data } = await apiClient.get('/brands/all');
        brands.value = data.data ?? data;
    } catch {
        brands.value = [];
    } finally {
        loadingBrands.value = false;
    }
};

const brandOptions = computed(() =>
    brands.value.map((b) => ({ value: b.id, label: b.name })),
);

// Inline brand creation
const showBrandModal = ref(false);
const newBrandName = ref('');
const creatingBrand = ref(false);
const brandError = ref<string | null>(null);

const openBrandModal = () => {
    newBrandName.value = '';
    brandError.value = null;
    showBrandModal.value = true;
};

const submitNewBrand = async () => {
    if (!newBrandName.value.trim()) {
        brandError.value = 'El nombre es requerido';
        return;
    }
    creatingBrand.value = true;
    brandError.value = null;
    try {
        const { data } = await apiClient.post('/brands', {
            name: newBrandName.value.trim(),
        });
        const newBrand = data.data ?? data;
        brands.value.push(newBrand);
        form.value.brand_id = newBrand.id;
        showBrandModal.value = false;
    } catch (e: any) {
        brandError.value =
            e.response?.data?.message || 'Error al crear la marca';
    } finally {
        creatingBrand.value = false;
    }
};

const toSafeNumber = (value: any, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeTaxRate = (value: any): number => {
    const parsed = toSafeNumber(value, 0);
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const resolveSaleTaxRate = (pricing: any): number =>
    toSafeTaxRate(pricing?.sale_tax_rate ?? pricing?.tax_rate);

const resolveCostTaxRate = (pricing: any): number =>
    toSafeTaxRate(
        pricing?.cost_tax_rate ?? pricing?.sale_tax_rate ?? pricing?.tax_rate,
    );

const hasExplicitCostBase = (pricing: any): boolean =>
    pricing?.cost_base !== null &&
    pricing?.cost_base !== undefined &&
    pricing?.cost_base !== '';

const getPricingCostTotal = (pricing: any): number => {
    if (!pricing) return 0;
    const explicitCostTotal = toSafeNumber(pricing.cost_total, NaN);
    if (Number.isFinite(explicitCostTotal))
        return Number(explicitCostTotal.toFixed(2));
    if (!hasExplicitCostBase(pricing))
        return Number(toSafeNumber(pricing.cost).toFixed(2));
    const costBase = toSafeNumber(pricing.cost_base);
    const costTaxRate = resolveCostTaxRate(pricing);
    const costMiscellaneous = toSafeNumber(pricing.cost_miscellaneous);
    return Number(
        (costBase * (1 + costTaxRate / 100) + costMiscellaneous).toFixed(2),
    );
};

const form = ref({
    brand_id: 1,
    sku: '',
    upc: '',
    status: 'active',
    pricing_formula: '' as string,
    pricing: {
        base_price: 0,
        msrp: 0,
        cost: 0,
        cost_base: 0,
        cost_miscellaneous: 0,
        tax_rate: 7,
        sale_tax_rate: 7,
        cost_tax_rate: 7,
        tax_type: 'custom' as 'standard' | 'exempt' | 'custom',
        pricing_formula: '' as string,
    },
});

const getFormCostTotal = (): number => getPricingCostTotal(form.value.pricing);

const priceManuallyEdited = ref(false);

const recalculatePriceFromCategory = async () => {
    const cost = getFormCostTotal();
    if (cost <= 0) {
        priceManuallyEdited.value = false;
        return;
    }
    if (props.categoryFormula) {
        try {
            const { data } = await apiClient.post('/categories/preview-price', {
                formula: props.categoryFormula,
                costo: cost,
                applies_itbm: false,
                itbm_percent: props.categoryItbmPercent ?? 7,
            });
            if (data.price !== null)
                form.value.pricing.base_price = applyRounding(data.price);
        } catch {
            /* silencioso */
        }
    } else {
        const margin = props.categoryMargin;
        if (margin != null && margin > 0) {
            form.value.pricing.base_price = applyRounding(
                Number((cost * (1 + margin / 100)).toFixed(2)),
            );
        }
    }
    priceManuallyEdited.value = false;
};

watch(
    () => getFormCostTotal(),
    async (newCostTotal) => {
        if (priceManuallyEdited.value) return;
        const cost = Number(newCostTotal) || 0;
        if (cost <= 0) return;
        if (props.categoryFormula) {
            try {
                const { data } = await apiClient.post(
                    '/categories/preview-price',
                    {
                        formula: props.categoryFormula,
                        costo: cost,
                        applies_itbm: false,
                        itbm_percent: props.categoryItbmPercent ?? 7,
                    },
                );
                if (data.price !== null)
                    form.value.pricing.base_price = applyRounding(data.price);
            } catch {
                /* silencioso */
            }
        } else {
            const margin = props.categoryMargin;
            if (margin != null && margin > 0) {
                form.value.pricing.base_price = applyRounding(
                    Number((cost * (1 + margin / 100)).toFixed(2)),
                );
            }
        }
    },
);

const onFormulaTotalChange = (newTotal: number) => {
    form.value.pricing.base_price = newTotal;
};

const modalInitialSnapshot = ref('');

const buildSnapshot = (): string =>
    JSON.stringify({
        brand_id: form.value.brand_id ?? null,
        sku: form.value.sku ?? '',
        pricing: {
            base_price: toSafeNumber(form.value.pricing.base_price),
            cost_base: toSafeNumber((form.value.pricing as any).cost_base),
            cost_miscellaneous: toSafeNumber(
                (form.value.pricing as any).cost_miscellaneous,
            ),
            sale_tax_rate: toSafeNumber(form.value.pricing.sale_tax_rate),
            cost_tax_rate: toSafeNumber(form.value.pricing.cost_tax_rate),
        },
    });

const hasUnsavedChanges = () =>
    props.open && buildSnapshot() !== modalInitialSnapshot.value;

const requestClose = (force = false) => {
    if (!force && hasUnsavedChanges()) {
        if (
            !confirm(
                'Tienes cambios sin guardar en la variante. ¿Quieres salir sin guardar?',
            )
        )
            return;
    }
    emit('update:open', false);
};

const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        requestClose();
    }
};

const loadAndPopulate = async () => {
    if (!props.variantId) return;
    loadingVariant.value = true;
    try {
        const variants = await fetchVariants(props.productId);
        const variant = variants.find((v: any) => v.id === props.variantId);
        if (!variant) return;
        editingVariant.value = variant;

        const p = variant.pricing ?? {};
        const costBase = hasExplicitCostBase(p)
            ? toSafeNumber(p.cost_base)
            : toSafeNumber(p.cost);
        const costMiscellaneous = toSafeNumber(p.cost_miscellaneous);

        form.value = {
            brand_id: variant.brand_id,
            sku: variant.sku,
            upc: variant.upc || '',
            status: variant.status,
            pricing_formula: p?.pricing_formula || '',
            pricing: {
                base_price: p?.base_price ?? 0,
                msrp: p?.msrp ?? 0,
                cost: getPricingCostTotal({
                    ...p,
                    cost_base: costBase,
                    cost_miscellaneous: costMiscellaneous,
                }),
                cost_base: costBase,
                cost_miscellaneous: costMiscellaneous,
                tax_rate: resolveSaleTaxRate(p),
                sale_tax_rate: resolveSaleTaxRate(p),
                cost_tax_rate: resolveCostTaxRate(p),
                tax_type: (p as any)?.tax_type || 'standard',
                pricing_formula: p?.pricing_formula || '',
            },
        };
        priceManuallyEdited.value = false;
        modalInitialSnapshot.value = buildSnapshot();
    } catch (e) {
        console.error('Error loading variant for edit', e);
    } finally {
        loadingVariant.value = false;
    }
};

watch(
    () => props.open,
    async (isOpen) => {
        if (isOpen) {
            if (brands.value.length === 0) await fetchBrands();
            await fetchSettings();
            await loadAndPopulate();
        }
    },
);

const handleSubmit = async () => {
    if (!editingVariant.value) return;
    processing.value = true;
    try {
        const normalizedSaleTaxRate = toSafeTaxRate(
            form.value.pricing.sale_tax_rate ?? form.value.pricing.tax_rate,
        );
        const normalizedCostTaxRate = toSafeTaxRate(
            form.value.pricing.cost_tax_rate ?? normalizedSaleTaxRate,
        );
        const normalizedCostBase = Math.max(
            0,
            toSafeNumber((form.value.pricing as any).cost_base),
        );
        const normalizedCostMiscellaneous = Math.max(
            0,
            toSafeNumber((form.value.pricing as any).cost_miscellaneous),
        );
        const costTotal = Number(
            (
                normalizedCostBase * (1 + normalizedCostTaxRate / 100) +
                normalizedCostMiscellaneous
            ).toFixed(2),
        );

        const pricingPayload = {
            ...form.value.pricing,
            cost: costTotal,
            cost_base: normalizedCostBase,
            cost_miscellaneous: normalizedCostMiscellaneous,
            tax_rate: normalizedSaleTaxRate,
            sale_tax_rate: normalizedSaleTaxRate,
            cost_tax_rate: normalizedCostTaxRate,
            pricing_formula: form.value.pricing_formula || null,
        };

        const payload = {
            ...form.value,
            pricing: pricingPayload,
            sku: form.value.sku || '',
        };

        const savedVariant = await updateVariant(
            props.productId,
            editingVariant.value.id,
            payload,
        );

        const brand = brands.value.find((b) => b.id === form.value.brand_id);

        emit('saved', {
            ...savedVariant,
            // Ensure display fields are populated even if API response is partial
            brand: savedVariant?.brand ?? brand,
            sku: savedVariant?.sku ?? form.value.sku,
            pricing: savedVariant?.pricing ?? pricingPayload,
            _costTotal: costTotal,
            _costBase: normalizedCostBase,
            _costMiscellaneous: normalizedCostMiscellaneous,
        });

        emit('update:open', false);
    } catch (e) {
        console.error(e);
    } finally {
        processing.value = false;
    }
};
</script>

<template>
    <Dialog :open="open" @update:open="handleOpenChange">
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Editar Variante</DialogTitle>
                <DialogDescription>
                    Marca, precios e inventario de esta variante.
                </DialogDescription>
            </DialogHeader>

            <div v-if="loadingVariant" class="flex justify-center py-10">
                <div
                    class="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
                />
            </div>

            <form
                v-else
                @submit.prevent.stop="handleSubmit"
                class="space-y-4 py-4"
            >
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <!-- Brand -->
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Marca</label
                        >
                        <div class="flex gap-1">
                            <SearchableSelect
                                :options="brandOptions"
                                :model-value="form.brand_id"
                                @update:model-value="
                                    (v) => (form.brand_id = v as number)
                                "
                                placeholder="-- Selecciona marca --"
                                :loading="loadingBrands"
                            />
                            <button
                                type="button"
                                @click="openBrandModal"
                                class="flex-shrink-0 rounded-md border border-gray-300 bg-white p-2 text-gray-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-border dark:bg-muted dark:hover:text-blue-400"
                                title="Crear nueva marca"
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
                            </button>
                        </div>
                    </div>

                    <!-- Status -->
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Estado</label
                        >
                        <select
                            v-model="form.status"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option value="active">Activo</option>
                            <option value="discontinued">Discontinuado</option>
                            <option value="pending">Pendiente</option>
                        </select>
                    </div>
                </div>

                <!-- Pricing Section -->
                <div class="border-t border-gray-200 pt-4 dark:border-border">
                    <h4
                        class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"
                    >
                        <CircleDollarSign class="h-4 w-4 text-gray-500" />
                        Precios de esta Variante
                    </h4>

                    <div
                        class="space-y-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 dark:border-border dark:bg-muted/50"
                    >
                        <div
                            class="grid grid-cols-1 items-start gap-4 md:grid-cols-12"
                        >
                            <div class="md:col-span-3">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Producto</label
                                >
                                <input
                                    :value="productName || 'Producto Base'"
                                    type="text"
                                    readonly
                                    class="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 shadow-sm dark:border-border dark:bg-muted/30 dark:text-white"
                                />
                            </div>

                            <div class="md:col-span-2">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Costo Base</label
                                >
                                <div class="relative mt-1">
                                    <span
                                        class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400"
                                        >$</span
                                    >
                                    <input
                                        v-model.number="form.pricing.cost_base"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        class="block w-full rounded-md border-gray-300 pl-7 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                            </div>

                            <div class="md:col-span-2">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >ITBM%</label
                                >
                                <input
                                    v-model.number="form.pricing.cost_tax_rate"
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100"
                                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>

                            <div class="md:col-span-2">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Misceláneos</label
                                >
                                <div class="relative mt-1">
                                    <span
                                        class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400"
                                        >$</span
                                    >
                                    <input
                                        v-model.number="
                                            form.pricing.cost_miscellaneous
                                        "
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        class="block w-full rounded-md border-gray-300 pl-7 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                            </div>

                            <div class="md:col-span-3">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Costo Total</label
                                >
                                <div class="relative mt-1">
                                    <span
                                        class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400"
                                        >$</span
                                    >
                                    <input
                                        :value="getFormCostTotal().toFixed(2)"
                                        type="text"
                                        readonly
                                        class="block w-full rounded-md border-gray-200 bg-gray-100 pl-7 dark:border-border dark:bg-muted/30 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div
                            class="grid grid-cols-1 items-start gap-4 md:grid-cols-12"
                        >
                            <div class="md:col-span-3">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >% ITBM Venta</label
                                >
                                <input
                                    v-model.number="form.pricing.sale_tax_rate"
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100"
                                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>

                            <div class="md:col-span-9">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Precio de Venta
                                    <span
                                        v-if="props.categoryFormula"
                                        class="ml-1 text-xs font-semibold text-blue-500"
                                    >
                                        · Fórmula:
                                        <code
                                            class="rounded bg-blue-50 px-1 font-mono dark:bg-blue-900/20"
                                            >{{ props.categoryFormula }}</code
                                        >
                                    </span>
                                </label>
                                <PricingFormula
                                    :cost="getFormCostTotal()"
                                    :tax-rate="
                                        Number(
                                            form.pricing.sale_tax_rate ??
                                                form.pricing.tax_rate,
                                        ) || 7
                                    "
                                    :model-value="form.pricing_formula"
                                    :price="
                                        Number(form.pricing.base_price) || 0
                                    "
                                    @update:model-value="
                                        (v) => (form.pricing_formula = v)
                                    "
                                    @update:price="onFormulaTotalChange"
                                />
                                <button
                                    v-if="
                                        priceManuallyEdited &&
                                        (props.categoryFormula ||
                                            (props.categoryMargin != null &&
                                                props.categoryMargin > 0))
                                    "
                                    type="button"
                                    @click="recalculatePriceFromCategory"
                                    class="mt-1 flex items-center gap-1 text-xs text-gray-400 transition hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                    &#8635; Recalcular por categoría
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="error" class="mt-2 text-sm text-red-500">
                    {{ error }}
                </div>

                <div class="mt-6 flex justify-end space-x-3">
                    <Button
                        type="button"
                        variant="outline"
                        @click="requestClose()"
                        >Cancelar</Button
                    >
                    <Button type="submit" :disabled="processing || loading">
                        {{ processing ? 'Guardando...' : 'Guardar' }}
                    </Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>

    <!-- Brand Creation Mini-Modal -->
    <Dialog
        :open="showBrandModal"
        @update:open="
            (v) => {
                if (!v) showBrandModal = false;
            }
        "
    >
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>Nueva Marca</DialogTitle>
            </DialogHeader>
            <div class="space-y-4 pt-2">
                <p
                    v-if="brandError"
                    class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                    {{ brandError }}
                </p>
                <div>
                    <label
                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Nombre de la Marca <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="newBrandName"
                        type="text"
                        @keyup.enter="submitNewBrand"
                        class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="Ej: Bosch, NGK, BERU..."
                    />
                </div>
                <div class="flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        @click="showBrandModal = false"
                        >Cancelar</Button
                    >
                    <Button
                        type="button"
                        @click="submitNewBrand"
                        :disabled="creatingBrand"
                    >
                        {{ creatingBrand ? 'Creando...' : 'Crear Marca' }}
                    </Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
