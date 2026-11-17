<script setup lang="ts">
import { CircleDollarSign } from 'lucide-vue-next';
import { ref, computed, watch } from 'vue';
import PricingFormula from '@/components/Products/PricingFormula.vue';
import StockAdjustModal from '@/components/Products/StockAdjustModal.vue';
import VariantSuppliersPanel from '@/components/Products/VariantSuppliersPanel.vue';
import AppModal from '@/components/ui/AppModal.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage.vue';
import LoadingState from '@/components/ui/LoadingState.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useProducts } from '@/composables/useProducts';
import { useStoreSettings } from '@/composables/useStoreSettings';
import apiClient from '@/services/api/client';
import { brandOptionLabel } from '@/utils/brandTier';
import { itbmChoiceFromRate, itbmRateFromChoice } from '@/utils/itbm';
import type { ItbmChoice } from '@/utils/itbm';

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
    'stock-adjusted': [];
}>();

const { updateVariant, fetchVariants, loading, error } = useProducts();
const {
    settings: storeSettings,
    fetchSettings,
    defaultTaxRate,
    resolveTaxRate,
} = useStoreSettings();

const applyRounding = (price: number): number => {
    const increment = Number(storeSettings.value.price_rounding_increment) || 0;
    if (increment <= 0) return price;
    return Math.ceil(price / increment) * increment;
};

const processing = ref(false);
const loadingVariant = ref(false);
const editingVariant = ref<any>(null);

const brands = ref<{ id: number; name: string; tier?: string }[]>([]);
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
    brands.value.map((b) => ({ value: b.id, label: brandOptionLabel(b) })),
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

// ITBM por variante: solo se elige si aplica (Sí/No). La tasa es la de la tienda (Ajustes > Tienda).
const itbmRateFor = (choice: ItbmChoice): number =>
    itbmRateFromChoice(choice, defaultTaxRate());
const normalizeItbmRate = (rate: unknown): number =>
    itbmRateFor(itbmChoiceFromRate(rate));
const costItbmApplies = computed({
    get: () => itbmChoiceFromRate(form.value.pricing.cost_tax_rate),
    set: (choice: ItbmChoice) => {
        form.value.pricing.cost_tax_rate = itbmRateFor(choice);
    },
});
const saleItbmApplies = computed({
    get: () =>
        itbmChoiceFromRate(
            form.value.pricing.sale_tax_rate ?? form.value.pricing.tax_rate,
        ),
    set: (choice: ItbmChoice) => {
        const rate = itbmRateFor(choice);
        form.value.pricing.sale_tax_rate = rate;
        form.value.pricing.tax_rate = rate;
    },
});

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
        tax_rate: defaultTaxRate(),
        sale_tax_rate: defaultTaxRate(),
        cost_tax_rate: defaultTaxRate(),
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
                itbm_percent: resolveTaxRate(props.categoryItbmPercent ?? null),
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
                        itbm_percent: resolveTaxRate(
                            props.categoryItbmPercent ?? null,
                        ),
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

// Existencia de la marca en el almacén actual: se cambia solo con un ajuste (movimiento con motivo).
const { currentWarehouseId } = usePosSettings();
const showStockAdjust = ref(false);
const currentStock = computed<number>(() => {
    const inventory = editingVariant.value?.inventory ?? [];
    const row = inventory.find(
        (item: any) =>
            (item.warehouse?.id ?? item.warehouse_id) ===
            currentWarehouseId.value,
    );
    return Number(row?.quantity_available ?? 0);
});
const stockAdjustLabel = computed(() => {
    const brand = brands.value.find((b) => b.id === form.value.brand_id);
    return [props.productName, brand?.name].filter(Boolean).join(' · ');
});
const onStockAdjusted = async () => {
    const variants = await fetchVariants(props.productId);
    const fresh = variants.find((v: any) => v.id === props.variantId);
    if (fresh && editingVariant.value) {
        editingVariant.value = {
            ...editingVariant.value,
            inventory: fresh.inventory,
        };
    }
    emit('stock-adjusted');
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
                tax_rate: normalizeItbmRate(resolveSaleTaxRate(p)),
                sale_tax_rate: normalizeItbmRate(resolveSaleTaxRate(p)),
                cost_tax_rate: normalizeItbmRate(resolveCostTaxRate(p)),
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
            // El indicador de carga cubre todo: marcas, configuración y la variante (en paralelo).
            // Antes, la primera vez se veía el formulario vacío mientras llegaban las marcas.
            loadingVariant.value = Boolean(props.variantId);
            try {
                await Promise.all([
                    brands.value.length === 0 ? fetchBrands() : undefined,
                    fetchSettings(),
                ]);
            } catch (e) {
                console.error('Error loading brands or settings', e);
            }
            await loadAndPopulate();
        }
    },
    // immediate: desde Productos la ventana se crea ya abierta; sin esto no cargaba la marca.
    { immediate: true },
);

const handleSubmit = async () => {
    if (!editingVariant.value) return;
    processing.value = true;
    try {
        const normalizedSaleTaxRate = normalizeItbmRate(
            form.value.pricing.sale_tax_rate ?? form.value.pricing.tax_rate,
        );
        const normalizedCostTaxRate = normalizeItbmRate(
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

        // Sin códigos ni SKU: la marca usa el número de parte del producto (solo marca y precios).
        const payload: Record<string, unknown> = {
            ...form.value,
            pricing: pricingPayload,
        };
        delete payload.sku;
        delete payload.upc;

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
    <AppModal
        :open="open"
        title="Editar Variante"
        description="Marca, precios e inventario de esta variante."
        size="lg"
        @update:open="handleOpenChange"
    >
        <LoadingState v-if="loadingVariant" label="Cargando variante..." />

        <form
            v-else
            id="product-variant-form"
            @submit.prevent.stop="handleSubmit"
            class="space-y-4"
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
                    <AppSelect
                        v-model="form.status"
                        class="mt-1 w-full min-w-0"
                        :options="[
                            { value: 'active', label: 'Activo' },
                            {
                                value: 'discontinued',
                                label: 'Discontinuado',
                            },
                        ]"
                    />
                </div>

                <!-- Solo lectura (2026-11-13): se imprime en tickets y lo usa el importador. -->
                <div>
                    <label
                        for="variant-brand-code"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >Código de la marca
                        <span class="text-xs font-normal text-gray-400"
                            >(solo lectura)</span
                        ></label
                    >
                    <input
                        id="variant-brand-code"
                        data-test="brand-code"
                        :value="form.sku || '—'"
                        type="text"
                        readonly
                        tabindex="-1"
                        title="Se imprime en tickets y cotizaciones. No se edita aquí."
                        class="mt-1 h-9 w-full min-w-0 cursor-default rounded-md border border-input bg-muted/50 px-3 py-1 font-mono text-sm text-muted-foreground outline-none dark:bg-muted/30"
                    />
                </div>

                <div v-if="editingVariant">
                    <span
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >Stock actual</span
                    >
                    <div class="mt-1 flex h-9 items-center gap-3">
                        <span
                            data-test="variant-stock"
                            class="text-base font-semibold tabular-nums"
                            >{{ currentStock }}</span
                        >
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-test="adjust-stock"
                            @click="showStockAdjust = true"
                            >Ajustar</Button
                        >
                    </div>
                </div>
            </div>

            <div
                v-if="editingVariant"
                class="border-t border-gray-200 pt-4 dark:border-border"
            >
                <VariantSuppliersPanel
                    :product-id="productId"
                    :variant-id="editingVariant.id"
                />
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
                                class="mt-1 h-9 w-full min-w-0 cursor-default rounded-md border border-input bg-muted/50 bg-transparent px-3 py-1 text-base text-muted-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 dark:bg-muted/30"
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
                                    class="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 pl-7 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
                                />
                            </div>
                        </div>

                        <div class="md:col-span-2">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >ITBM costo</label
                            >
                            <AppSelect
                                v-model="costItbmApplies"
                                data-testid="cost-itbm-select"
                                class="w-full min-w-0"
                                :options="[
                                    {
                                        value: 'yes',
                                        label: `Sí (${defaultTaxRate()}%)`,
                                    },
                                    { value: 'no', label: 'No' },
                                ]"
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
                                    class="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 pl-7 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
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
                                    class="h-9 w-full min-w-0 cursor-default rounded-md border border-input bg-muted/50 bg-transparent px-3 py-1 pl-7 text-base text-muted-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 dark:bg-muted/30"
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
                                >ITBM venta</label
                            >
                            <AppSelect
                                v-model="saleItbmApplies"
                                data-testid="sale-itbm-select"
                                class="w-full min-w-0"
                                :options="[
                                    {
                                        value: 'yes',
                                        label: `Sí (${defaultTaxRate()}%)`,
                                    },
                                    { value: 'no', label: 'No' },
                                ]"
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
                                :tax-rate="itbmRateFor(saleItbmApplies)"
                                :model-value="form.pricing_formula"
                                :price="Number(form.pricing.base_price) || 0"
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

            <ErrorMessage v-if="error">{{ error }}</ErrorMessage>
        </form>

        <template v-if="!loadingVariant" #footer>
            <Button type="button" variant="outline" @click="requestClose()"
                >Cancelar</Button
            >
            <Button
                type="submit"
                form="product-variant-form"
                :disabled="processing || loading"
            >
                {{ processing ? 'Guardando...' : 'Guardar' }}
            </Button>
        </template>
    </AppModal>

    <!-- Brand Creation Mini-Modal -->
    <AppModal
        :open="showBrandModal"
        title="Nueva Marca"
        size="sm"
        @update:open="(v) => (showBrandModal = v)"
    >
        <div class="space-y-4">
            <ErrorMessage v-if="brandError">
                {{ brandError }}
            </ErrorMessage>
            <div>
                <label
                    for="variant-new-brand-name"
                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                    Nombre de la Marca <span class="text-red-500">*</span>
                </label>
                <input
                    id="variant-new-brand-name"
                    v-model="newBrandName"
                    type="text"
                    @keyup.enter="submitNewBrand"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                    placeholder="Ej: Bosch, NGK, BERU..."
                />
            </div>
        </div>

        <template #footer>
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
        </template>
    </AppModal>

    <StockAdjustModal
        v-if="editingVariant"
        v-model:open="showStockAdjust"
        :product-id="productId"
        :variant-id="editingVariant.id"
        :warehouse-id="currentWarehouseId"
        :current-quantity="currentStock"
        :label="stockAdjustLabel"
        @saved="onStockAdjusted"
    />
</template>
