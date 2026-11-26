<script setup lang="ts">
import { CircleDollarSign } from 'lucide-vue-next';
import { ref, computed, nextTick, onMounted, watch, useId } from 'vue';
import PriceMarginTable from '@/components/Products/PriceMarginTable.vue';
import PricingFormula from '@/components/Products/PricingFormula.vue';
import StockAdjustModal from '@/components/Products/StockAdjustModal.vue';
import VariantFifoHistoryPanel from '@/components/Products/VariantFifoHistoryPanel.vue';
import VariantSuppliersPanel from '@/components/Products/VariantSuppliersPanel.vue';
import AppModal from '@/components/ui/AppModal.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { useMarginCostSource } from '@/composables/useMarginCostSource';
import { usePosSettings } from '@/composables/usePosSettings';
import { useProducts } from '@/composables/useProducts';
import { useStoreSettings } from '@/composables/useStoreSettings';
import { MULTI_WAREHOUSE_ENABLED as multiWarehouse } from '@/config/features';
import apiClient from '@/services/api/client';
import { suppliersService } from '@/services/suppliers';
import { draftSuppliersPayload } from '@/services/variantSuppliers';
import type { DraftVariantSupplier } from '@/services/variantSuppliers';
import {
    brandOptionLabel,
    brandTierLabel,
    normalizeBrandTier,
} from '@/utils/brandTier';
import { itbmChoiceFromRate, itbmRateFromChoice } from '@/utils/itbm';
import type { ItbmChoice } from '@/utils/itbm';
import {
    MARGIN_COST_SOURCES,
    formatPercent,
    marginCostInputFromVariant,
    marginPercent,
    markupPercent,
    resolveMarginCost,
} from '@/utils/priceMargins';
import type { MarginCostInput, MarginSupplier } from '@/utils/priceMargins';

type HeaderLotSyncState = {
    revision: number;
    warehouse_id: number | null;
    quantity_available: number;
    unit_cost_base: number;
    cost_tax_rate: number;
    misc_total: number;
    sale_price: number;
};
type LotUpdatedPayload = {
    lot: {
        id: number;
        warehouse_id: number;
        quantity_available: number;
        received_quantity?: number;
        unit_cost_base: number;
        tax_per_unit: number;
        misc_per_unit: number;
        misc_total?: number;
        landed_unit_cost: number;
        sale_price: number;
        remaining_value?: number;
    };
    summary?: {
        active_lot_id?: number | null;
        stock_available?: number;
        current_cost?: number;
        current_sale_price?: number;
        fifo_cost_current?: number;
        fifo_sale_price_current?: number;
    } | null;
    warehouse_id: number | null;
};
type VariantFifoHistoryPanelRef = {
    saveSyncedActiveLot: () => Promise<'saved' | 'skipped' | 'failed'>;
};

const props = defineProps<{
    productId?: number;
    categoryId?: number;
    categoryMargin?: number | null;
    categoryFormula?: string | null;
    categoryAppliesItbm?: boolean;
    categoryItbmPercent?: number | null;
    skuBase?: string;
    productName?: string;
    initialEditVariantId?: number | null;
}>();

const emit = defineEmits<{
    'draft-variants-changed': [variants: any[]];
}>();

const {
    fetchVariants,
    createVariant,
    updateVariant,
    deleteVariant,
    loading,
    error,
} = useProducts();
const {
    settings: storeSettings,
    fetchSettings,
    defaultTaxRate,
    resolveTaxRate,
} = useStoreSettings();
const { currentWarehouseId, initWarehouse } = usePosSettings();

// === Rounding helper — respects LL-013: only applied on auto-calc, never on manual input ===
const applyRounding = (price: number): number => {
    const increment = Number(storeSettings.value.price_rounding_increment) || 0;
    if (increment <= 0) return price;
    return Math.ceil(price / increment) * increment;
};

// Draft mode (when no productId)
const draftVariants = ref<any[]>([]);
const isDraftMode = computed(() => !props.productId);

const variants = ref<any[]>([]);
const showModal = ref(false);
const editingVariant = ref<any>(null);
const variantHistoryPanel = ref<VariantFifoHistoryPanelRef | null>(null);
const processing = ref(false);
const initialEditVariantHandled = ref(false);
const headerSyncRevision = ref(0);
const suppressHeaderSync = ref(false);

const modalInitialSnapshot = ref('');

// Form Data
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
    initial_inventory: [
        {
            warehouse_id: 1,
            stock_available: 0,
            reorder_point: 5,
            reorder_quantity: 10,
            // De qué proveedor vino la existencia inicial (opcional).
            supplier_id: null as number | null,
        },
    ] as Array<{
        warehouse_id: number;
        stock_available: number;
        reorder_point: number;
        reorder_quantity: number;
        supplier_id?: number | null;
    }>,
    // Proveedores de una marca nueva (se guardan junto con la marca).
    suppliers: [] as DraftVariantSupplier[],
});

const toSafeNumber = (value: any, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const buildModalStateSnapshot = (): string => {
    return JSON.stringify({
        form: {
            brand_id: form.value.brand_id ?? null,
            status: form.value.status ?? 'active',
            pricing_formula: form.value.pricing_formula ?? '',
            pricing: {
                base_price: toSafeNumber(form.value.pricing.base_price),
                msrp: toSafeNumber(form.value.pricing.msrp),
                cost: toSafeNumber(form.value.pricing.cost),
                cost_base: toSafeNumber((form.value.pricing as any).cost_base),
                cost_miscellaneous: toSafeNumber(
                    (form.value.pricing as any).cost_miscellaneous,
                ),
                tax_rate: toSafeNumber(form.value.pricing.tax_rate),
                sale_tax_rate: toSafeNumber(form.value.pricing.sale_tax_rate),
                cost_tax_rate: toSafeNumber(form.value.pricing.cost_tax_rate),
                tax_type: form.value.pricing.tax_type ?? 'custom',
            },
            suppliers: form.value.suppliers ?? [],
            initial_inventory: (form.value.initial_inventory ?? []).map(
                (row: any) => ({
                    warehouse_id: row.warehouse_id ?? null,
                    stock_available: toSafeNumber(row.stock_available),
                    reorder_point: toSafeNumber(row.reorder_point),
                    reorder_quantity: toSafeNumber(row.reorder_quantity),
                    supplier_id: row.supplier_id ?? null,
                }),
            ),
        },
    });
};

const captureModalInitialState = () => {
    modalInitialSnapshot.value = buildModalStateSnapshot();
};

const hasUnsavedModalChanges = (): boolean => {
    if (!showModal.value) return false;
    return buildModalStateSnapshot() !== modalInitialSnapshot.value;
};

const requestCloseModal = (force = false) => {
    if (!showModal.value) return;

    if (!force && hasUnsavedModalChanges()) {
        const shouldClose = confirm(
            'Tienes cambios sin guardar en la variante. ¿Quieres salir sin guardar?',
        );
        if (!shouldClose) return;
    }

    showModal.value = false;
    modalInitialSnapshot.value = '';
};

const handleVariantModalOpenChange = (isOpen: boolean) => {
    if (isOpen) {
        showModal.value = true;
        if (!modalInitialSnapshot.value) {
            captureModalInitialState();
        }
        return;
    }

    requestCloseModal();
};

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

const hasInitialStockForNewVariant = computed(
    () =>
        !editingVariant.value &&
        toSafeNumber(form.value.initial_inventory?.[0]?.stock_available) > 0,
);

const submitButtonLabel = computed(() => {
    if (processing.value) return 'Guardando...';

    return hasInitialStockForNewVariant.value
        ? 'Guardar variante y crear lote inicial'
        : 'Guardar variante';
});

// Warehouses options — fetched from API
const warehouses = ref<{ id: number; name: string }[]>([]);
// Proveedores para "Proveedor del stock inicial".
const stockSupplierOptions = ref<{ value: number | null; label: string }[]>([
    { value: null, label: 'Sin proveedor' },
]);
const loadStockSuppliers = async () => {
    try {
        const list = (await suppliersService.getAllActive()) ?? [];
        stockSupplierOptions.value = [
            { value: null, label: 'Sin proveedor' },
            ...list.map((s: { id: number; name: string }) => ({
                value: s.id,
                label: s.name,
            })),
        ];
    } catch {
        // Sin la lista, el stock inicial queda sin proveedor.
    }
};
const fetchWarehouses = async () => {
    try {
        const { data } = await apiClient.get('/warehouses/all');
        warehouses.value = data.data ?? data;
    } catch {
        warehouses.value = [];
    }
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);

// === Editable stock per warehouse ===
const getVariantStockForWarehouse = (
    variant: any,
    warehouseId: number | null,
): number => {
    if (!warehouseId || !variant.inventory) return 0;
    const inv = variant.inventory.find(
        (i: any) => i.warehouse?.id === warehouseId,
    );
    return inv?.quantity_available ?? 0;
};

const getVariantTotalStock = (variant: any): number => {
    if (!variant.inventory) return 0;
    return variant.inventory.reduce(
        (sum: number, i: any) => sum + (i.quantity_available ?? 0),
        0,
    );
};

const currentWarehouseName = computed(() => {
    if (!currentWarehouseId.value) return '';
    const wh = warehouses.value.find((w) => w.id === currentWarehouseId.value);
    return wh?.name || `#${currentWarehouseId.value}`;
});

// Ajuste de existencia: siempre con motivo (queda como movimiento de inventario), nunca escribiendo el número.
const stockAdjustVariant = ref<any>(null);
const showStockAdjust = ref(false);

const openStockAdjust = (variant: any) => {
    stockAdjustVariant.value = variant;
    showStockAdjust.value = true;
};

const stockAdjustLabel = computed(() => {
    const variant = stockAdjustVariant.value;
    if (!variant) return '';
    const brand = variant.brand?.name ?? 'Sin marca';
    return `${props.productName || 'Producto'} · ${brand}${currentWarehouseName.value ? ` · ${currentWarehouseName.value}` : ''}`;
});

const onStockAdjusted = async () => {
    const data = await loadVariants();
    if (editingVariant.value && Array.isArray(data)) {
        const fresh = data.find((v: any) => v.id === editingVariant.value.id);
        if (fresh)
            editingVariant.value = {
                ...editingVariant.value,
                inventory: fresh.inventory,
            };
    }
};

const showSalePriceMode = ref(
    localStorage.getItem('variants_show_sale_price_mode') === 'true',
);
const showPriceWithItbm = ref(
    localStorage.getItem('variants_show_price_with_itbm') === 'true',
);

const toggleDisplayMode = () => {
    showSalePriceMode.value = !showSalePriceMode.value;
    localStorage.setItem(
        'variants_show_sale_price_mode',
        String(showSalePriceMode.value),
    );
};

const togglePriceItbmView = () => {
    if (!showSalePriceMode.value) return;

    showPriceWithItbm.value = !showPriceWithItbm.value;
    localStorage.setItem(
        'variants_show_price_with_itbm',
        String(showPriceWithItbm.value),
    );
};

const variantValueColumnTitle = computed(() => {
    if (!showSalePriceMode.value) return 'Costo Total';
    return showPriceWithItbm.value ? 'Precio Venta + ITBM' : 'Precio Venta';
});

const toSafeTaxRate = (value: any): number => {
    const parsed = toSafeNumber(value, 0);
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const cloneVariantForModal = (variant: any) => ({
    ...variant,
    brand: variant?.brand ? { ...variant.brand } : variant?.brand,
    pricing: variant?.pricing ? { ...variant.pricing } : variant?.pricing,
    inventory:
        variant?.inventory?.map((item: any) => ({
            ...item,
            warehouse: item?.warehouse
                ? { ...item.warehouse }
                : item?.warehouse,
        })) ?? [],
});

const updateEditingVariantWarehouse = (
    warehouseId: number | null,
    quantityAvailable: number,
    currentCost?: number,
    currentSalePrice?: number,
) => {
    if (!editingVariant.value || !warehouseId) return;

    const inventory = [...(editingVariant.value.inventory ?? [])];
    const index = inventory.findIndex(
        (item: any) => Number(item.warehouse?.id) === Number(warehouseId),
    );

    if (index === -1) return;

    inventory[index] = {
        ...inventory[index],
        quantity_available: quantityAvailable,
        current_cost: currentCost ?? inventory[index].current_cost,
        current_sale_price:
            currentSalePrice ?? inventory[index].current_sale_price,
        fifo_cost_current: currentCost ?? inventory[index].fifo_cost_current,
        fifo_sale_price_current:
            currentSalePrice ?? inventory[index].fifo_sale_price_current,
    };
    editingVariant.value = {
        ...editingVariant.value,
        inventory,
        total_stock: inventory.reduce(
            (sum: number, item: any) =>
                sum + toSafeNumber(item.quantity_available),
            0,
        ),
    };
};

const modalHistoryVariant = computed(() => {
    if (!editingVariant.value) return null;

    return {
        ...editingVariant.value,
        pricing: {
            ...(editingVariant.value.pricing ?? {}),
            ...form.value.pricing,
        },
    };
});

const modalLotSyncState = computed<HeaderLotSyncState | null>(() => {
    if (!editingVariant.value) return null;

    return {
        revision: headerSyncRevision.value,
        warehouse_id: currentWarehouseId.value,
        quantity_available: getVariantStockForWarehouse(
            editingVariant.value,
            currentWarehouseId.value,
        ),
        unit_cost_base: toSafeNumber(form.value.pricing.cost_base),
        cost_tax_rate: toSafeTaxRate(form.value.pricing.cost_tax_rate),
        misc_total: toSafeNumber(form.value.pricing.cost_miscellaneous),
        sale_price: toSafeNumber(form.value.pricing.base_price),
    };
});

const markHeaderSyncDirty = () => {
    if (!editingVariant.value || suppressHeaderSync.value) return;
    headerSyncRevision.value += 1;
};

// ITBM por variante: solo se elige si aplica (Sí/No). La tasa es la de la tienda (Ajustes > Tienda).
const itbmChoice = itbmChoiceFromRate;
const itbmRateFor = (choice: ItbmChoice): number =>
    itbmRateFromChoice(choice, defaultTaxRate());
const costItbmApplies = computed({
    get: () => itbmChoice(form.value.pricing.cost_tax_rate),
    set: (choice: ItbmChoice) => {
        form.value.pricing.cost_tax_rate = itbmRateFor(choice);
        markHeaderSyncDirty();
    },
});
const saleItbmApplies = computed({
    get: () =>
        itbmChoice(
            form.value.pricing.sale_tax_rate ?? form.value.pricing.tax_rate,
        ),
    set: (choice: ItbmChoice) => {
        const rate = itbmRateFor(choice);
        form.value.pricing.sale_tax_rate = rate;
        form.value.pricing.tax_rate = rate;
    },
});

const resolveSaleTaxRate = (pricing: any): number => {
    return toSafeTaxRate(pricing?.sale_tax_rate ?? pricing?.tax_rate);
};

const resolveCostTaxRate = (pricing: any): number => {
    return toSafeTaxRate(
        pricing?.cost_tax_rate ?? pricing?.sale_tax_rate ?? pricing?.tax_rate,
    );
};

const withItbm = (amount: number, taxRate: number): number => {
    return Number((amount * (1 + taxRate / 100)).toFixed(2));
};

const hasExplicitCostBase = (pricing: any): boolean => {
    return (
        pricing?.cost_base !== null &&
        pricing?.cost_base !== undefined &&
        pricing?.cost_base !== ''
    );
};

const getPricingCostTotal = (pricing: any): number => {
    if (!pricing) return 0;

    const explicitCostTotal = toSafeNumber(pricing.cost_total, NaN);
    if (Number.isFinite(explicitCostTotal)) {
        return Number(explicitCostTotal.toFixed(2));
    }

    if (!hasExplicitCostBase(pricing)) {
        return Number(toSafeNumber(pricing.cost).toFixed(2));
    }

    const costBase = toSafeNumber(pricing.cost_base);
    const costTaxRate = resolveCostTaxRate(pricing);
    const costMiscellaneous = toSafeNumber(pricing.cost_miscellaneous);

    return Number(
        (costBase * (1 + costTaxRate / 100) + costMiscellaneous).toFixed(2),
    );
};

const getFormCostTotal = (): number => {
    return getPricingCostTotal(form.value.pricing);
};

const getVariantCostAmount = (variant: any): number | null => {
    if (!variant?.pricing) return null;

    return getPricingCostTotal(variant.pricing);
};

const getVariantSaleAmount = (
    variant: any,
    includeItbm = false,
): number | null => {
    if (!variant?.pricing) return null;

    const basePrice = toSafeNumber(
        variant.pricing.calculated_price ?? variant.pricing.base_price,
    );
    if (!includeItbm) return Number(basePrice.toFixed(2));

    return withItbm(basePrice, resolveSaleTaxRate(variant.pricing));
};

const getVariantDisplayAmount = (variant: any): number | null => {
    if (!showSalePriceMode.value) {
        return getVariantCostAmount(variant);
    }

    return getVariantSaleAmount(variant, showPriceWithItbm.value);
};

const formatVariantDisplay = (variant: any): string => {
    const amount = getVariantDisplayAmount(variant);
    return amount === null ? '—' : formatCurrency(amount);
};

// === Markup y margen (como el "Pricing" de Lightspeed): precio sin ITBM contra el costo elegido ===
const { marginCostSource } = useMarginCostSource();

const getVariantMargins = (variant: any) => {
    const price = getVariantSaleAmount(variant, false);
    if (price === null) return null;
    const resolved = resolveMarginCost(
        marginCostSource.value,
        marginCostInputFromVariant(variant, currentWarehouseId.value),
    );
    return {
        markup: formatPercent(markupPercent(price, resolved.cost)),
        margin: formatPercent(marginPercent(price, resolved.cost)),
        negative: price < resolved.cost,
        detail: resolved.detail,
        fallback: resolved.fallback,
    };
};

// Una vez por marca y por cambio de costo elegido (cada fila lo lee en dos celdas).
const variantMarginsByKey = computed(
    () =>
        new Map(
            displayVariants.value.map((variant: any) => [
                variant.id ?? variant._draftId,
                getVariantMargins(variant),
            ]),
        ),
);
const marginsFor = (variant: any) =>
    variantMarginsByKey.value.get(variant.id ?? variant._draftId) ?? null;
const marginCellClass = (variant: any) =>
    marginsFor(variant)?.negative
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-900 dark:text-white';

// En la ventana de la marca: valores del formulario en vivo y proveedores del panel.
const modalSupplierRows = ref<MarginSupplier[] | null>(null);
const modalMarginCostInput = computed<MarginCostInput>(() => {
    const fromVariant = marginCostInputFromVariant(
        editingVariant.value,
        currentWarehouseId.value,
    );
    const savedVariant = Boolean(
        editingVariant.value && !isDraftMode.value && props.productId,
    );
    return {
        ...fromVariant,
        brandCost: getFormCostTotal(),
        costTaxRate: toSafeNumber(form.value.pricing.cost_tax_rate),
        costMiscellaneous: toSafeNumber(form.value.pricing.cost_miscellaneous),
        suppliers: savedVariant
            ? (modalSupplierRows.value ?? fromVariant.suppliers)
            : (form.value.suppliers ?? []),
    };
});

// === Precio Final: PricingFormula es la única fuente de verdad ===
// Al recibir un nuevo precio calculado (sea fórmula o numero directo),
// lo almacenamos directamente en base_price para que el payload sea correcto.
const onFormulaTotalChange = (newTotal: number) => {
    form.value.pricing.base_price = newTotal;
    markHeaderSyncDirty();
};

// SKU is now fully manual - no auto-generation

// === Auto Price Calculation from Category Margin ===
// Tracks whether the user manually typed a price in this modal session.
// Only reset when a new modal session opens (not when price reaches 0).
const priceManuallyEdited = ref(false);

const recalculatePriceFromCategory = async () => {
    const cost = getFormCostTotal();
    if (cost <= 0) {
        priceManuallyEdited.value = false;
        return;
    }

    if (props.categoryFormula) {
        // Formula takes priority over margin
        try {
            const { data } = await apiClient.post('/categories/preview-price', {
                formula: props.categoryFormula,
                costo: cost,
                applies_itbm: false,
                itbm_percent: resolveTaxRate(props.categoryItbmPercent ?? null),
            });
            if (data.price !== null) {
                form.value.pricing.base_price = applyRounding(data.price);
                markHeaderSyncDirty();
            }
        } catch {
            /* silencioso */
        }
    } else {
        // Fallback: simple margin (LL-013)
        const margin = props.categoryMargin;
        if (margin != null && margin > 0) {
            const raw = cost * (1 + margin / 100);
            form.value.pricing.base_price = applyRounding(
                Number(raw.toFixed(2)),
            );
            markHeaderSyncDirty();
        }
    }
    priceManuallyEdited.value = false;
};

// Auto-recalculate when cost total changes (only if user hasn't manually overridden price)
watch(
    () => getFormCostTotal(),
    async (newCostTotal) => {
        if (priceManuallyEdited.value) return;
        const cost = Number(newCostTotal) || 0;
        if (cost <= 0) return;

        if (props.categoryFormula) {
            // Formula takes priority
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
                if (data.price !== null) {
                    form.value.pricing.base_price = applyRounding(data.price);
                    markHeaderSyncDirty();
                }
            } catch {
                /* silencioso */
            }
        } else {
            // Fallback: simple margin (LL-013)
            const margin = props.categoryMargin;
            if (margin != null && margin > 0) {
                const raw = cost * (1 + margin / 100);
                form.value.pricing.base_price = applyRounding(
                    Number(raw.toFixed(2)),
                );
                markHeaderSyncDirty();
            }
        }
    },
);

const loadVariants = async () => {
    if (isDraftMode.value) return; // draft mode: no API call
    try {
        const data = await fetchVariants(props.productId!);
        variants.value = data;
        return data;
    } catch (e) {
        console.error('Error loading variants', e);
        return [];
    }
};

// In draft mode, variants displayed are draftVariants; in normal mode, fetched from API
const displayVariants = computed(() =>
    isDraftMode.value ? draftVariants.value : variants.value,
);

const openCreateModal = () => {
    editingVariant.value = null;
    headerSyncRevision.value = 0;
    suppressHeaderSync.value = true;
    const initialWarehouseId =
        warehouses.value.find(
            (warehouse) => warehouse.id === currentWarehouseId.value,
        )?.id ?? warehouses.value[0]?.id;

    form.value = {
        brand_id: brands.value[0]?.id ?? 1,
        sku: '',
        upc: '',
        status: 'active',
        pricing_formula: props.categoryFormula || '',
        pricing: {
            base_price: 0,
            msrp: 0,
            cost: 0,
            cost_base: 0,
            cost_miscellaneous: 0,
            tax_rate: defaultTaxRate(),
            sale_tax_rate: defaultTaxRate(),
            cost_tax_rate: defaultTaxRate(),
            tax_type: 'custom',
            pricing_formula: props.categoryFormula || '',
        },
        initial_inventory:
            initialWarehouseId !== undefined
                ? [
                      {
                          warehouse_id: initialWarehouseId,
                          stock_available: 0,
                          reorder_point: 5,
                          reorder_quantity: 10,
                          supplier_id: null,
                      },
                  ]
                : [],
        suppliers: [],
    };
    priceManuallyEdited.value = false;
    showModal.value = true;
    captureModalInitialState();
    nextTick(() => {
        suppressHeaderSync.value = false;
    });
};

const openEditModal = (variant: any) => {
    editingVariant.value = cloneVariantForModal(variant);
    headerSyncRevision.value = 0;
    suppressHeaderSync.value = true;

    const p = variant.pricing ?? {};
    const costBase = hasExplicitCostBase(p)
        ? toSafeNumber(p.cost_base)
        : toSafeNumber(p.cost);
    const costMiscellaneous = toSafeNumber(p.cost_miscellaneous);
    const costTotal = hasExplicitCostBase(p)
        ? getPricingCostTotal({
              ...p,
              cost_base: costBase,
              cost_miscellaneous: costMiscellaneous,
          })
        : toSafeNumber(p.cost);

    form.value = {
        brand_id: variant.brand_id,
        sku: variant.sku,
        upc: variant.upc || '',
        status: variant.status,
        pricing_formula: p?.pricing_formula || '',
        pricing: {
            base_price: p?.base_price ?? 0,
            msrp: p?.msrp ?? 0,
            cost: costTotal,
            cost_base: costBase,
            cost_miscellaneous: costMiscellaneous,
            // Sí/No con la tasa vigente de la tienda (una tasa antigua distinta se ajusta).
            tax_rate: itbmRateFor(itbmChoice(resolveSaleTaxRate(p))),
            sale_tax_rate: itbmRateFor(itbmChoice(resolveSaleTaxRate(p ?? {}))),
            cost_tax_rate: itbmRateFor(itbmChoice(resolveCostTaxRate(p ?? {}))),
            tax_type: (p as any)?.tax_type || 'standard',
            pricing_formula: p?.pricing_formula || '',
        },
        initial_inventory: [],
        // Solo una marca en borrador trae su lista; la de una marca guardada se maneja en su panel.
        suppliers: isDraftMode.value ? [...(variant.suppliers ?? [])] : [],
    };

    // base_price ya se carga directo en form.pricing.base_price desde el backend

    showModal.value = true;
    captureModalInitialState();
    nextTick(() => {
        suppressHeaderSync.value = false;
    });
};

const refreshEditingVariantFromList = async () => {
    if (!editingVariant.value?.id || isDraftMode.value) return;

    const freshVariants = await loadVariants();
    const freshVariant = freshVariants?.find(
        (variant: any) =>
            Number(variant.id) === Number(editingVariant.value.id),
    );

    if (freshVariant) {
        editingVariant.value = cloneVariantForModal(freshVariant);
    }
};

const applyUpdatedLotToModal = (payload?: LotUpdatedPayload) => {
    if (!payload?.lot || !editingVariant.value) return;

    const activeLotId = payload.summary?.active_lot_id;
    const updatedLotIsActive =
        activeLotId !== null &&
        activeLotId !== undefined &&
        Number(payload.lot.id) === Number(activeLotId);

    if (!updatedLotIsActive) {
        return;
    }

    const unitCostBase = toSafeNumber(payload.lot.unit_cost_base);
    const taxPerUnit = toSafeNumber(payload.lot.tax_per_unit);
    const salePrice = toSafeNumber(
        payload.summary?.current_sale_price ??
            payload.summary?.fifo_sale_price_current ??
            payload.lot.sale_price,
    );
    const quantityAvailable = toSafeNumber(
        payload.summary?.stock_available ?? payload.lot.quantity_available,
    );
    const costTaxRate = itbmRateFor(
        itbmChoice(
            unitCostBase > 0
                ? (taxPerUnit / unitCostBase) * 100
                : form.value.pricing.cost_tax_rate,
        ),
    );

    form.value.pricing.cost_base = unitCostBase;
    form.value.pricing.cost_miscellaneous = toSafeNumber(
        payload.lot.misc_total ??
            payload.lot.misc_per_unit *
                Math.max(1, toSafeNumber(payload.lot.received_quantity, 1)),
    );
    form.value.pricing.cost_tax_rate = costTaxRate;
    form.value.pricing.cost = getPricingCostTotal({
        ...form.value.pricing,
        cost_base: unitCostBase,
        cost_miscellaneous: form.value.pricing.cost_miscellaneous,
        cost_tax_rate: costTaxRate,
    });
    form.value.pricing.base_price = salePrice;

    updateEditingVariantWarehouse(
        payload.warehouse_id ?? payload.lot.warehouse_id,
        quantityAvailable,
        payload.summary?.current_cost ??
            payload.summary?.fifo_cost_current ??
            payload.lot.landed_unit_cost,
        salePrice,
    );
};

const handleHistoryPanelUpdated = async (payload?: LotUpdatedPayload) => {
    await refreshEditingVariantFromList();
    applyUpdatedLotToModal(payload);
    captureModalInitialState();
};

const openInitialEditVariant = () => {
    if (
        initialEditVariantHandled.value ||
        isDraftMode.value ||
        !props.initialEditVariantId
    ) {
        return;
    }

    const targetVariant = variants.value.find(
        (variant) => Number(variant.id) === Number(props.initialEditVariantId),
    );

    if (!targetVariant) return;

    initialEditVariantHandled.value = true;
    openEditModal(targetVariant);
};

watch(
    () => props.initialEditVariantId,
    () => {
        initialEditVariantHandled.value = false;
        openInitialEditVariant();
    },
);

const handleSubmit = async () => {
    processing.value = true;
    try {
        const normalizedSaleTaxRate = itbmRateFor(
            itbmChoice(
                form.value.pricing.sale_tax_rate ?? form.value.pricing.tax_rate,
            ),
        );
        const normalizedCostTaxRate = itbmRateFor(
            itbmChoice(
                form.value.pricing.cost_tax_rate ?? normalizedSaleTaxRate,
            ),
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

        form.value.pricing.cost = costTotal;

        if (editingVariant.value && variantHistoryPanel.value) {
            const syncedLotResult =
                await variantHistoryPanel.value.saveSyncedActiveLot();

            if (syncedLotResult === 'failed') {
                throw new Error('No se pudo sincronizar el lote activo.');
            }
        }

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
            brand_id: form.value.brand_id,
            status: form.value.status,
            // Sin códigos: la marca usa el número de parte del producto (solo marca y precios).
            pricing_formula: form.value.pricing_formula || null,
            pricing: pricingPayload,
            initial_inventory: form.value.initial_inventory,
            // Al crear la marca se envían sus proveedores (código y costo).
            suppliers:
                !editingVariant.value || isDraftMode.value
                    ? draftSuppliersPayload(form.value.suppliers)
                    : undefined,
        };

        if (isDraftMode.value) {
            // Draft mode: store locally, do not call API
            if (editingVariant.value !== null) {
                const idx = draftVariants.value.findIndex(
                    (v) => v._draftId === editingVariant.value._draftId,
                );
                if (idx >= 0) {
                    const brand = brands.value.find(
                        (b) => b.id === payload.brand_id,
                    );
                    draftVariants.value[idx] = {
                        ...payload,
                        suppliers: form.value.suppliers,
                        _draftId: editingVariant.value._draftId,
                        brand,
                    };
                }
            } else {
                const brand = brands.value.find(
                    (b) => b.id === payload.brand_id,
                );
                draftVariants.value.push({
                    ...payload,
                    suppliers: form.value.suppliers,
                    _draftId: Date.now(),
                    brand,
                });
            }
            emit('draft-variants-changed', draftVariants.value);
            requestCloseModal(true);
        } else {
            if (editingVariant.value) {
                await updateVariant(
                    props.productId!,
                    editingVariant.value.id,
                    payload,
                );
            } else {
                await createVariant(props.productId!, payload);
            }
            await loadVariants();
            requestCloseModal(true);
        }
    } catch (e) {
        console.error(e);
    } finally {
        processing.value = false;
    }
};

const handleDelete = async (variant: any) => {
    if (isDraftMode.value) {
        const idx = draftVariants.value.findIndex(
            (v) => v._draftId === variant._draftId,
        );
        if (idx >= 0) draftVariants.value.splice(idx, 1);
        emit('draft-variants-changed', draftVariants.value);
        return;
    }
    if (
        !confirm(
            `¿Estás seguro de eliminar la variante ${variant.brand?.name}?`,
        )
    )
        return;
    try {
        await deleteVariant(props.productId!, variant.id);
        await loadVariants();
    } catch (e) {
        console.error(e);
        alert('No se pudo eliminar la variante.');
    }
};

// === Inline Brand Creation ===
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

onMounted(async () => {
    await Promise.all([
        loadVariants(),
        fetchBrands(),
        fetchWarehouses(),
        fetchSettings(),
        loadStockSuppliers(),
    ]);
    if (!editingVariant.value) {
        const rate = defaultTaxRate();
        form.value.pricing.tax_rate = rate;
        form.value.pricing.sale_tax_rate = rate;
        form.value.pricing.cost_tax_rate = rate;
    }
    openInitialEditVariant();
    if (!isDraftMode.value) {
        initWarehouse().catch(() => {});
    }
});

// Id único por instancia: los botones del pie envían el formulario con form="...".
const formId = useId();
</script>

<template>
    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                Variantes (Marcas)
            </h2>
            <div class="flex flex-wrap items-center gap-2">
                <div
                    class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 dark:border-border dark:bg-muted/40"
                >
                    <span
                        class="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >Columna</span
                    >
                    <button
                        type="button"
                        @click="toggleDisplayMode"
                        :class="[
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none',
                            showSalePriceMode
                                ? 'bg-blue-500 focus:ring-blue-400'
                                : 'bg-gray-300 focus:ring-gray-400 dark:bg-gray-600',
                        ]"
                        :title="
                            showSalePriceMode
                                ? 'Mostrando precio de venta'
                                : 'Mostrando costo total'
                        "
                    >
                        <span
                            :class="[
                                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
                                showSalePriceMode
                                    ? 'translate-x-5'
                                    : 'translate-x-0.5',
                            ]"
                        />
                    </button>
                    <span
                        class="text-[10px] font-medium"
                        :class="
                            showSalePriceMode
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-300'
                        "
                    >
                        {{ showSalePriceMode ? 'Venta' : 'Costo' }}
                    </span>
                </div>

                <div
                    class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 dark:border-border dark:bg-muted/40"
                >
                    <span
                        class="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >ITBM Venta</span
                    >
                    <button
                        type="button"
                        @click="togglePriceItbmView"
                        :disabled="!showSalePriceMode"
                        :class="[
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none',
                            !showSalePriceMode
                                ? 'cursor-not-allowed bg-gray-200 focus:ring-gray-300 dark:bg-gray-700'
                                : showPriceWithItbm
                                  ? 'bg-emerald-500 focus:ring-emerald-400'
                                  : 'bg-gray-300 focus:ring-gray-400 dark:bg-gray-600',
                        ]"
                        :title="
                            !showSalePriceMode
                                ? 'Activa modo Venta para aplicar ITBM'
                                : showPriceWithItbm
                                  ? 'Mostrando precio venta con ITBM'
                                  : 'Mostrando precio venta sin ITBM'
                        "
                    >
                        <span
                            :class="[
                                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
                                showSalePriceMode && showPriceWithItbm
                                    ? 'translate-x-5'
                                    : 'translate-x-0.5',
                            ]"
                        />
                    </button>
                    <span
                        class="text-[10px] font-medium"
                        :class="
                            !showSalePriceMode
                                ? 'text-gray-400'
                                : showPriceWithItbm
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-gray-500 dark:text-gray-300'
                        "
                    >
                        {{
                            !showSalePriceMode
                                ? 'Inactivo'
                                : showPriceWithItbm
                                  ? '+ITBM'
                                  : 'Sin ITBM'
                        }}
                    </span>
                </div>

                <div
                    class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1 dark:border-border dark:bg-muted/40"
                >
                    <span
                        class="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >Costo para margen</span
                    >
                    <AppSelect
                        v-model="marginCostSource"
                        data-test="variants-margin-cost-source"
                        class="w-44 min-w-0"
                        :options="MARGIN_COST_SOURCES"
                    />
                </div>

                <Button type="button" @click="openCreateModal">
                    Agregar Variante
                </Button>
            </div>
        </div>

        <div
            v-if="loading && !displayVariants.length"
            class="flex justify-center py-8"
        >
            <div
                class="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent dark:border-primary"
            ></div>
        </div>

        <div
            v-else-if="displayVariants.length === 0"
            class="py-8 text-center text-gray-500"
        >
            {{
                isDraftMode
                    ? 'Agrega variantes con el botón de arriba. Se crearán al guardar el producto.'
                    : 'No hay variantes registradas.'
            }}
        </div>

        <div v-else class="overflow-x-auto">
            <table
                class="w-full text-left text-sm text-gray-500 dark:text-gray-400"
            >
                <thead
                    class="bg-gray-50 text-xs text-gray-700 uppercase dark:bg-muted dark:text-gray-400"
                >
                    <tr>
                        <!-- SKU oculto (R38: cliente usa SKU del producto padre) -->
                        <th class="px-6 py-3">Nombre</th>
                        <th class="px-6 py-3">Marca</th>
                        <th class="px-6 py-3">{{ variantValueColumnTitle }}</th>
                        <th
                            class="px-4 py-3 text-right"
                            title="Ganancia sobre el costo (precio sin ITBM)"
                        >
                            Markup
                        </th>
                        <th
                            class="px-4 py-3 text-right"
                            title="Ganancia sobre el precio (precio sin ITBM)"
                        >
                            Margen
                        </th>
                        <th class="px-6 py-3">
                            <div class="flex items-center gap-1">
                                Stock
                                <span
                                    v-if="currentWarehouseName"
                                    class="text-[10px] font-normal text-gray-400"
                                    >({{ currentWarehouseName }})</span
                                >
                            </div>
                        </th>
                        <th class="px-6 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="variant in displayVariants"
                        :key="variant.id ?? variant._draftId"
                        class="border-b bg-white hover:bg-gray-50 dark:border-border dark:bg-card dark:hover:bg-muted"
                    >
                        <!-- SKU cell oculto -->
                        <td
                            class="px-6 py-4 font-medium text-gray-900 dark:text-white"
                        >
                            {{ productName || 'Producto Base' }}
                        </td>
                        <td
                            class="px-6 py-4 font-medium text-gray-900 dark:text-white"
                        >
                            {{ variant.brand?.name }}
                            <span
                                v-if="isDraftMode"
                                class="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                >Pendiente</span
                            >
                            <!-- Gama de la marca, con el mismo estilo que el detalle del costo -->
                            <div
                                v-if="variant.brand"
                                data-testid="variant-brand-tier"
                                class="mt-0.5 text-[10px] font-normal"
                                :class="
                                    normalizeBrandTier(variant.brand.tier) ===
                                    'premium'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-gray-400'
                                "
                            >
                                {{ brandTierLabel(variant.brand.tier) }}
                            </div>
                        </td>
                        <td
                            class="px-6 py-4 font-medium text-gray-900 dark:text-white"
                        >
                            {{ formatVariantDisplay(variant) }}
                            <div
                                v-if="variant.pricing"
                                class="mt-0.5 text-[10px] font-normal text-gray-400"
                            >
                                <template v-if="showSalePriceMode">
                                    <span v-if="showPriceWithItbm"
                                        >ITBM
                                        {{
                                            resolveSaleTaxRate(variant.pricing)
                                        }}%</span
                                    >
                                    <span v-else>Sin ITBM</span>
                                </template>
                                <template v-else>
                                    Base
                                    {{
                                        formatCurrency(
                                            toSafeNumber(
                                                variant.pricing.cost_base ??
                                                    variant.pricing.cost,
                                            ),
                                        )
                                    }}
                                    · ITBM
                                    {{ resolveCostTaxRate(variant.pricing) }}% ·
                                    Misc total
                                    {{
                                        formatCurrency(
                                            toSafeNumber(
                                                variant.pricing
                                                    .cost_miscellaneous,
                                            ),
                                        )
                                    }}
                                </template>
                            </div>
                        </td>
                        <td
                            data-test="variant-markup"
                            class="px-4 py-4 text-right font-medium tabular-nums"
                            :class="marginCellClass(variant)"
                            :title="marginsFor(variant)?.detail"
                        >
                            {{ marginsFor(variant)?.markup ?? '—' }}
                        </td>
                        <td
                            data-test="variant-margin"
                            class="px-4 py-4 text-right font-medium tabular-nums"
                            :class="marginCellClass(variant)"
                            :title="marginsFor(variant)?.detail"
                        >
                            {{ marginsFor(variant)?.margin ?? '—' }}
                            <div
                                v-if="marginsFor(variant)?.fallback"
                                class="mt-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400"
                            >
                                con costo de la marca
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <template v-if="isDraftMode">
                                {{ getVariantTotalStock(variant) }}
                            </template>
                            <template v-else>
                                <div class="flex items-center gap-2">
                                    <span
                                        data-test="variant-stock"
                                        class="min-w-8 text-right font-medium tabular-nums"
                                        >{{
                                            getVariantStockForWarehouse(
                                                variant,
                                                currentWarehouseId,
                                            )
                                        }}</span
                                    >
                                    <button
                                        type="button"
                                        data-test="adjust-stock"
                                        class="text-xs font-medium text-primary hover:underline"
                                        @click="openStockAdjust(variant)"
                                    >
                                        Ajustar
                                    </button>
                                    <span
                                        v-if="variant.inventory?.length > 1"
                                        class="text-[10px] text-gray-400"
                                    >
                                        (total:
                                        {{ getVariantTotalStock(variant) }})
                                    </span>
                                </div>
                            </template>
                        </td>
                        <td class="px-6 py-4 text-right">
                            <button
                                type="button"
                                @click="openEditModal(variant)"
                                class="mr-3 font-medium text-blue-600 hover:underline dark:text-blue-500 dark:text-primary"
                            >
                                Editar
                            </button>
                            <button
                                type="button"
                                @click="handleDelete(variant)"
                                class="font-medium text-red-600 hover:underline dark:text-red-500"
                            >
                                Eliminar
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Create/Edit Modal -->
        <AppModal
            :open="showModal"
            :title="editingVariant ? 'Editar Variante' : 'Nueva Variante'"
            description="Marca, precios e inventario de esta variante."
            size="xl"
            @update:open="handleVariantModalOpenChange"
        >
            <!-- Formulario Modal con .stop para evitar burbujeo al padre Create.vue -->
            <form
                :id="formId"
                @submit.prevent.stop="handleSubmit"
                class="space-y-4 py-4"
            >
                <section
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="mb-3 flex items-center justify-between gap-3">
                        <h4
                            class="text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            Datos
                        </h4>
                        <span
                            v-if="editingVariant"
                            class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-muted dark:text-gray-300"
                        >
                            {{ currentWarehouseName || 'Almacén actual' }}
                        </span>
                    </div>

                    <div class="grid grid-cols-1 gap-4 md:grid-cols-12">
                        <div class="md:col-span-4">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Producto</label
                            >
                            <input
                                :value="productName || 'Producto Base'"
                                type="text"
                                readonly
                                class="h-9 w-full min-w-0 cursor-default rounded-md border border-input bg-muted/50 bg-transparent px-3 py-1 text-base text-muted-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 dark:bg-muted/30"
                            />
                        </div>

                        <div class="md:col-span-4">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Marca</label
                            >
                            <div class="flex gap-2">
                                <SearchableSelect
                                    class="min-w-0 flex-1"
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
                                    class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition hover:border-ring hover:text-foreground dark:bg-input/30"
                                    title="Crear nueva marca"
                                    aria-label="Crear nueva marca"
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

                        <div class="md:col-span-4">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Estado</label
                            >
                            <AppSelect
                                v-model="form.status"
                                class="w-full min-w-0"
                                :options="[
                                    { value: 'active', label: 'Activo' },
                                    {
                                        value: 'discontinued',
                                        label: 'Discontinuado',
                                    },
                                ]"
                            />
                        </div>

                        <div v-if="editingVariant" class="md:col-span-3">
                            <span
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Stock actual</span
                            >
                            <div class="flex h-9 items-center gap-3">
                                <span
                                    data-test="modal-variant-stock"
                                    class="text-base font-semibold tabular-nums"
                                    >{{
                                        getVariantStockForWarehouse(
                                            editingVariant,
                                            currentWarehouseId,
                                        )
                                    }}</span
                                >
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-test="modal-adjust-stock"
                                    @click="openStockAdjust(editingVariant)"
                                    >Ajustar</Button
                                >
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    v-if="editingVariant && !isDraftMode && productId"
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <VariantSuppliersPanel
                        :product-id="productId"
                        :variant-id="editingVariant.id"
                        @rows-change="(rows) => (modalSupplierRows = rows)"
                    />
                </section>
                <!-- Marca nueva o en borrador: los proveedores se guardan junto con la marca. -->
                <section
                    v-else
                    data-test="draft-variant-suppliers"
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <VariantSuppliersPanel draft v-model="form.suppliers" />
                </section>

                <section
                    v-if="!editingVariant && form.initial_inventory[0]"
                    class="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/10"
                >
                    <div
                        class="mb-3 flex flex-wrap items-center justify-between gap-2"
                    >
                        <h4
                            class="text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            Stock inicial
                        </h4>
                        <span
                            v-if="hasInitialStockForNewVariant"
                            class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        >
                            Lote inicial
                        </span>
                    </div>

                    <div class="grid grid-cols-1 gap-4 md:grid-cols-12">
                        <div v-if="multiWarehouse" class="md:col-span-7">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Almacén</label
                            >
                            <AppSelect
                                v-model="form.initial_inventory[0].warehouse_id"
                                class="w-full min-w-0"
                                :options="[
                                    ...(warehouses ?? []).map((warehouse) => ({
                                        value: warehouse.id,
                                        label: String(warehouse.name),
                                    })),
                                ]"
                            />
                        </div>

                        <div class="md:col-span-5">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Cantidad inicial</label
                            >
                            <input
                                v-model.number="
                                    form.initial_inventory[0].stock_available
                                "
                                type="number"
                                step="1"
                                min="0"
                                class="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-right text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
                            />
                        </div>

                        <div
                            class="md:col-span-7"
                            data-test="initial-stock-supplier"
                        >
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Proveedor del stock inicial (opcional)</label
                            >
                            <AppSelect
                                v-model="form.initial_inventory[0].supplier_id"
                                class="w-full min-w-0"
                                :options="stockSupplierOptions"
                            />
                        </div>
                    </div>
                </section>

                <!-- ═══ Pricing Section ═══ -->
                <section
                    class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted/30"
                >
                    <h4
                        class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"
                    >
                        <CircleDollarSign class="h-4 w-4 text-gray-500" />
                        Costos y precio
                    </h4>

                    <!-- ITBM: solo Sí/No por variante; la tasa se cambia en Ajustes > Tienda. -->

                    <!-- Costos: Base + ITBM% + Misceláneos => Costo Total -->
                    <div
                        class="space-y-3 rounded-lg border border-dashed border-gray-200 bg-white p-3 dark:border-border dark:bg-card"
                    >
                        <div
                            class="grid grid-cols-1 items-start gap-4 md:grid-cols-12"
                        >
                            <div class="md:col-span-3">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Costo base
                                </label>
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
                                        @input="markHeaderSyncDirty"
                                        :title="
                                            props.categoryFormula
                                                ? `Al cambiar el costo total, se recalculará precio usando: ${props.categoryFormula}`
                                                : 'Costo base antes de impuestos y extras'
                                        "
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

                            <div class="md:col-span-3">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Misceláneos total</label
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
                                        @input="markHeaderSyncDirty"
                                        class="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 pl-7 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
                                    />
                                </div>
                            </div>

                            <div class="md:col-span-4">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Costo total</label
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
                                    :price="
                                        Number(form.pricing.base_price) || 0
                                    "
                                    @update:model-value="
                                        (v) => (form.pricing_formula = v)
                                    "
                                    @update:price="onFormulaTotalChange"
                                />
                                <!-- Botón recalcular por categoría si el usuario editó manualmente -->
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
                                    :title="
                                        props.categoryFormula
                                            ? `Fórmula: ${props.categoryFormula}`
                                            : `Margen de categoría: ${props.categoryMargin}%`
                                    "
                                >
                                    &#8635; Recalcular por categor&iacute;a
                                </button>
                            </div>
                        </div>
                    </div>

                    <PriceMarginTable
                        class="mt-4"
                        :price="Number(form.pricing.base_price) || 0"
                        :cost-input="modalMarginCostInput"
                    />
                </section>

                <!-- Error display -->
                <div v-if="error" class="mt-2 text-sm text-red-500">
                    {{ error }}
                </div>

                <VariantFifoHistoryPanel
                    v-if="modalHistoryVariant?.id && props.productId"
                    ref="variantHistoryPanel"
                    :product-id="props.productId"
                    :variant="modalHistoryVariant"
                    :warehouses="warehouses"
                    :initial-warehouse-id="currentWarehouseId"
                    :header-sync="modalLotSyncState"
                    @updated="handleHistoryPanelUpdated"
                />
            </form>

            <template #footer>
                <Button
                    type="button"
                    variant="outline"
                    @click="requestCloseModal()"
                >
                    Cancelar
                </Button>
                <Button type="submit" :form="formId" :disabled="processing">
                    {{ submitButtonLabel }}
                </Button>
            </template>
        </AppModal>

        <!-- Brand Creation Mini-Modal -->
        <AppModal
            :open="showBrandModal"
            title="Nueva Marca"
            size="sm"
            @close="showBrandModal = false"
        >
            <div class="space-y-4">
                <ErrorMessage v-if="brandError">
                    {{ brandError }}
                </ErrorMessage>
                <div>
                    <label
                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >Nombre de la Marca
                        <span class="text-red-500">*</span></label
                    >
                    <input
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
            v-if="stockAdjustVariant && productId"
            v-model:open="showStockAdjust"
            :product-id="productId"
            :variant-id="stockAdjustVariant.id"
            :warehouse-id="currentWarehouseId"
            :current-quantity="
                getVariantStockForWarehouse(
                    stockAdjustVariant,
                    currentWarehouseId,
                )
            "
            :label="stockAdjustLabel"
            @saved="onStockAdjusted"
        />
    </div>
</template>
