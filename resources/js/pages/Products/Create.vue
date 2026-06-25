<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { Plus, X, Globe, Wrench } from 'lucide-vue-next';
import { ref, onMounted, watch, computed } from 'vue';
import AsyncProductCombobox from '@/components/AsyncProductCombobox.vue';
import PricingFormula from '@/components/Products/PricingFormula.vue';
import ProductImagesSection from '@/components/Products/ProductImagesSection.vue';
import type { PendingImage } from '@/components/Products/ProductImagesSection.vue';
import VariantManager from '@/components/Products/VariantManager.vue';
import type { DraftCompatData } from '@/components/Products/VehicleCompatSection.vue';
import VehicleCompatSection from '@/components/Products/VehicleCompatSection.vue';
import VehicleInlineModals from '@/components/Products/VehicleInlineModals.vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { useProducts } from '@/composables/useProducts';
import { useStoreSettings } from '@/composables/useStoreSettings';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { type BreadcrumbItem } from '@/types';
import type { Brand } from '@/types/brand';
import type { Category } from '@/types/category';
import type { CreateProductRequest, Product } from '@/types/product';
import {
    normalizeIdArray,
    normalizeInitialInventoryPayload,
    normalizePricingPayload,
    normalizeProductAttributesPayload,
    normalizeVehicleCompatibilityPayload,
    toPositiveInt,
} from '@/utils/productPayload';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
    { title: 'Crear Producto', href: '/products/create' },
];

const { createProduct, loading, error } = useProducts();
const {
    settings: storeSettings,
    fetchSettings: fetchStoreSettings,
    defaultTaxRate,
    resolveTaxRate,
} = useStoreSettings();
const toast = useToast();

const applyRounding = (price: number): number => {
    const increment = Number(storeSettings.value.price_rounding_increment) || 0;
    if (increment <= 0) return price;
    return Math.ceil(price / increment) * increment;
};

const form = ref<CreateProductRequest>({
    sku_base: '',
    name: '',
    description: '',
    product_line_id: undefined,
    category_id: undefined,
    engine_id: undefined,
    status: 'active',
    alternate_code: '',
    pricing_formula: '',
    brand_id: undefined,
    sku: '',
    upc: '',
    pricing: {
        base_price: 0,
        msrp: 0,
        cost: 0,
        tax_rate: defaultTaxRate(),
        sale_tax_rate: defaultTaxRate(),
        cost_tax_rate: defaultTaxRate(),
        tax_type: 'custom',
        max_discount_percentage: 0,
    },
    initial_inventory: [
        {
            warehouse_id: 0,
            stock_available: 0,
            reorder_point: 5,
            reorder_quantity: 20,
        },
    ],
});

const custom_total = ref<number | null>(null);

const computed_total = computed(() => {
    if (custom_total.value !== null && custom_total.value !== undefined) {
        return custom_total.value;
    }
    const p = form.value.pricing;
    const base = Number(p.base_price) || 0;
    const rate = Number((p as any).sale_tax_rate ?? p.tax_rate) || 0;
    return Number((base * (1 + rate / 100)).toFixed(2));
});

const onFormulaTotalChange = (newTotal: number) => {
    custom_total.value = newTotal;
};

watch(
    () => form.value.pricing.base_price,
    () => {
        custom_total.value = null;
    },
);
watch(
    () => form.value.pricing.tax_rate,
    () => {
        custom_total.value = null;
    },
);
watch(
    () => (form.value.pricing as any).sale_tax_rate,
    () => {
        custom_total.value = null;
    },
);
watch(
    () => form.value.pricing_formula,
    (v) => {
        if (!v) custom_total.value = null;
    },
);

const validationErrors = ref<Record<string, string[]>>({});
const successMessage = ref('');
const categories = ref<Category[]>([]);
const brands = ref<Brand[]>([]);
const loadingCategories = ref(false);
const loadingBrands = ref(false);
const extraCategoryIds = ref<number[]>([]);
const selectedExtraCategoryId = ref<number | null>(null);
const categoryDetailCache = ref<Record<number, Category>>({});

type DraftProductAttribute = {
    name: string;
    value: string | string[];
    unit: string;
    required: boolean;
    type: 'string' | 'select';
    options?: string[] | null;
    fromCategory?: boolean;
    source_category_id?: number | null;
};

const productAttributes = ref<DraftProductAttribute[]>([]);

const attributeNameKey = (name: string) => name.trim().toLowerCase();
const normalizeAttributeType = (value: unknown): 'string' | 'select' =>
    value === 'select' ? 'select' : 'string';
const normalizeAttributeOptions = (options: unknown): string[] => {
    if (!Array.isArray(options)) return [];

    return options
        .map((option) => String(option ?? '').trim())
        .filter((option) => option !== '');
};
const hasSelectOptions = (attribute: DraftProductAttribute): boolean =>
    attribute.type === 'select' &&
    attribute.fromCategory === true &&
    Array.isArray(attribute.options) &&
    attribute.options.length > 0;

const categoryNameById = (categoryId: number | undefined | null): string => {
    if (!categoryId) return '';
    return (
        categories.value.find((category) => category.id === categoryId)?.name ??
        ''
    );
};

const sortCategoryIdsByName = (categoryIds: number[]): number[] => {
    return [...new Set(categoryIds)]
        .filter(Boolean)
        .sort((left, right) =>
            categoryNameById(left).localeCompare(categoryNameById(right), 'es'),
        );
};

const effectiveCategoryIdsForName = computed(() => {
    const primaryCategoryId = (form.value as any).category_id as
        | number
        | undefined;
    return sortCategoryIdsByName([
        ...(primaryCategoryId ? [primaryCategoryId] : []),
        ...extraCategoryIds.value,
    ]);
});

const effectiveCategoryNames = computed(() => {
    return effectiveCategoryIdsForName.value
        .map(categoryNameById)
        .filter(Boolean);
});

const effectiveCategoryBaseName = computed(() => {
    return effectiveCategoryNames.value.length > 0
        ? effectiveCategoryNames.value.join(' ')
        : 'Producto sin nombre';
});

const mergeCategoryDefaultAttributes = (defaults: any[]) => {
    const existingByName = new Map<string, DraftProductAttribute>();
    productAttributes.value.forEach((attr) => {
        const key = attributeNameKey(attr.name);
        if (key) existingByName.set(key, attr);
    });

    const seenDefaultNames = new Set<string>();
    const normalizedDefaults = defaults
        .map((attr: any) => {
            const name = String(attr?.name ?? '').trim();
            if (!name) return null;

            const key = attributeNameKey(name);
            if (seenDefaultNames.has(key)) return null;
            seenDefaultNames.add(key);

            const existing = existingByName.get(key);
            const type = normalizeAttributeType(attr?.type);
            const options =
                type === 'select'
                    ? normalizeAttributeOptions(attr?.options)
                    : null;
            const defaultValue =
                type === 'select'
                    ? []
                    : String(attr?.default_value ?? attr?.value ?? '');

            // Preserve existing value; for selects ensure it’s an array.
            let value: string | string[];
            if (existing?.value !== undefined) {
                if (type === 'select') {
                    value = Array.isArray(existing.value)
                        ? existing.value
                        : existing.value
                          ? [existing.value]
                          : [];
                } else {
                    value =
                        typeof existing.value === 'string'
                            ? existing.value
                            : Array.isArray(existing.value)
                              ? existing.value.join(', ')
                              : String(existing.value ?? '');
                }
            } else {
                value = defaultValue;
            }
            return {
                name,
                value,
                unit: String(attr?.unit ?? existing?.unit ?? '').trim(),
                required: Boolean(attr?.required),
                type,
                options,
                fromCategory: true,
                source_category_id: attr?.source_category_id ?? null,
            } as DraftProductAttribute;
        })
        .filter(Boolean) as DraftProductAttribute[];

    const defaultKeys = new Set(
        normalizedDefaults.map((attr) => attributeNameKey(attr.name)),
    );
    const customAttributes = productAttributes.value
        .filter((attr) => !defaultKeys.has(attributeNameKey(attr.name)))
        .map((attr) => ({
            ...attr,
            fromCategory: false,
            type: 'string' as const,
            options: null,
            source_category_id: null as number | null,
        }));

    productAttributes.value = [...normalizedDefaults, ...customAttributes];
};

const keepOnlyCustomAttributes = () => {
    productAttributes.value = productAttributes.value
        .filter((attr) => !attr.fromCategory)
        .map((attr) => ({
            ...attr,
            fromCategory: false,
            type: 'string' as const,
            options: null,
            source_category_id: null,
        }));
};

const addCustomAttribute = () => {
    productAttributes.value.push({
        name: '',
        value: '',
        unit: '',
        required: false,
        type: 'string',
        options: null,
        fromCategory: false,
        source_category_id: null,
    });
};

const removeProductAttribute = (index: number) => {
    productAttributes.value.splice(index, 1);
};

const fetchCategoryDetail = async (
    categoryId: number,
): Promise<Category | null> => {
    if (categoryDetailCache.value[categoryId]) {
        return categoryDetailCache.value[categoryId];
    }

    const categoryFromList = categories.value.find(
        (category) => category.id === categoryId,
    );
    if (
        categoryFromList?.default_attributes ||
        categoryFromList?.pricing_formula !== undefined
    ) {
        categoryDetailCache.value[categoryId] = categoryFromList;
        return categoryFromList;
    }

    try {
        const response = await apiClient.get(`/categories/${categoryId}`);
        categoryDetailCache.value[categoryId] = response.data;
        return response.data;
    } catch {
        return null;
    }
};

let refreshToken = 0;
const refreshCategoryDerivedState = async () => {
    const token = ++refreshToken;

    const primaryCategoryId = (form.value as any).category_id as
        | number
        | undefined;
    if (
        primaryCategoryId &&
        extraCategoryIds.value.includes(primaryCategoryId)
    ) {
        extraCategoryIds.value = extraCategoryIds.value.filter(
            (categoryId) => categoryId !== primaryCategoryId,
        );
    }

    const defaultsCategoryIds = [
        ...(primaryCategoryId ? [primaryCategoryId] : []),
        ...sortCategoryIdsByName(extraCategoryIds.value),
    ];

    const categoryDetails = (
        await Promise.all(defaultsCategoryIds.map(fetchCategoryDetail))
    ).filter(Boolean) as Category[];

    // Discard if a newer refresh was triggered while awaiting.
    if (token !== refreshToken) return;

    const mergedDefaults = categoryDetails.flatMap((category) =>
        (category.default_attributes ?? []).map((attribute) => ({
            ...attribute,
            source_category_id: category.id,
        })),
    );
    if (mergedDefaults.length > 0) {
        mergeCategoryDefaultAttributes(mergedDefaults);
    } else {
        keepOnlyCustomAttributes();
    }

    const primaryCategory = primaryCategoryId
        ? (categoryDetails.find(
              (category) => category.id === primaryCategoryId,
          ) ?? (await fetchCategoryDetail(primaryCategoryId)))
        : null;

    if (token !== refreshToken) return;

    categoryFormula.value = primaryCategory?.pricing_formula ?? null;
    categoryAppliesItbm.value = primaryCategory?.applies_itbm ?? false;
    categoryItbmPercent.value = primaryCategory
        ? resolveTaxRate(primaryCategory.itbm_percent ?? null)
        : null;
    categoryMargin.value = primaryCategory?.default_margin_percent ?? null;
};

const addExtraCategory = () => {
    const categoryId = selectedExtraCategoryId.value;
    const primaryCategoryId = (form.value as any).category_id;

    if (
        !categoryId ||
        categoryId === primaryCategoryId ||
        extraCategoryIds.value.includes(categoryId)
    ) {
        selectedExtraCategoryId.value = null;
        return;
    }

    extraCategoryIds.value = sortCategoryIdsByName([
        ...extraCategoryIds.value,
        categoryId,
    ]);
    selectedExtraCategoryId.value = null;
};

const removeExtraCategory = (categoryId: number) => {
    extraCategoryIds.value = extraCategoryIds.value.filter(
        (id) => id !== categoryId,
    );
};

const categoryFormula = ref<string | null>(null);
const categoryAppliesItbm = ref<boolean>(false);
const categoryItbmPercent = ref<number | null>(null);
const categoryMargin = ref<number | null>(null);
const priceManuallyEdited = ref(false);
const onBasePriceInput = () => {
    priceManuallyEdited.value = true;
};

// R20: Duplicate checking
const duplicates = ref<{ id: number; name: string; sku_base: string }[]>([]);
const checkingDuplicates = ref(false);
let duplicateCheckTimeout: ReturnType<typeof setTimeout> | null = null;

const checkDuplicates = async () => {
    const sku = form.value.sku_base?.trim();

    if (!sku) {
        duplicates.value = [];
        return;
    }

    checkingDuplicates.value = true;
    try {
        const response = await apiClient.get('/products/check-duplicate', {
            params: { sku },
        });
        duplicates.value = response.data.data || [];
    } catch (e) {
        console.error('Error checking duplicates:', e);
        duplicates.value = [];
    } finally {
        checkingDuplicates.value = false;
    }
};

watch(
    () => form.value.sku_base,
    () => {
        if (duplicateCheckTimeout) {
            clearTimeout(duplicateCheckTimeout);
        }
        duplicateCheckTimeout = setTimeout(() => {
            checkDuplicates();
        }, 600);
    },
);

const nameManuallyEdited = ref(false);
const onNameInput = () => {
    nameManuallyEdited.value = true;
};

// === Vehicle compatibility (draft mode via component) ===
const vehicleCompatRef = ref<InstanceType<typeof VehicleCompatSection> | null>(
    null,
);
const vehicleModalsRef = ref<InstanceType<typeof VehicleInlineModals> | null>(
    null,
);
const vehicleModalType = ref<
    'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis' | null
>(null);

const vehicleCompat = ref<DraftCompatData>({
    engines: [],
    chassis: [],
    allEngines: false,
    allChassis: false,
    isUniversal: false,
    modelId: null,
    makeId: null,
});

const openVehicleInline = (
    type: 'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis',
) => {
    vehicleModalType.value = type;
    vehicleModalsRef.value?.open(type);
};

const closeVehicleInline = () => {
    vehicleModalType.value = null;
};

const onMakeCreated = (make: { id: number; name: string }) => {
    vehicleCompatRef.value?.addMake(make);
    vehicleModalType.value = null;
};

const onModelCreated = (model: any) => {
    vehicleCompatRef.value?.addModel(model);
    vehicleModalType.value = null;
};

const onEngineCreated = (engine: any) => {
    vehicleCompatRef.value?.addEngine(engine);
    vehicleModalType.value = null;
};

const onChassisCreated = (chassis: any) => {
    vehicleCompatRef.value?.addChassisToList(chassis);
};

// === Name preview helpers ===
type EngineCompatibilityEntry = {
    engine_id: number;
    make: string;
    model: string;
    engine: string;
    year: string;
    chassis: string;
};

type ChassisCompatibilityEntry = {
    chassis_id: number;
    make: string;
    model: string;
    year: string;
    chassis: string;
};

const formatYearRange = (
    model?: {
        year_from?: number;
        year_to?: number;
        generation?: string;
    } | null,
): string => {
    const from = model?.year_from;
    const to = model?.year_to;
    if (from && to) return from === to ? `${from}` : `${from}-${to}`;
    if (from) return `${from}`;
    if (to) return `${to}`;
    return '';
};

const getModelChassis = (model?: { generation?: string } | null): string => {
    return String(model?.generation ?? '').trim();
};

const engineCategoryKeywords = [
    'motor',
    'piston',
    'pistón',
    'biela',
    'cigueñal',
    'cigüeñal',
    'culata',
    'valvula',
    'válvula',
    'arbol de levas',
    'árbol de levas',
    'empaque',
    'junta de culata',
    'bomba de aceite',
    'cadena',
    'correa',
    'timing',
    'engine',
    'piston ring',
    'anillo',
];

const normalizeTextKey = (value: string): string => {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const isEngineCategory = (categoryName?: string): boolean => {
    const normalizedCategory = normalizeTextKey(String(categoryName ?? ''));
    if (!normalizedCategory) return false;
    return engineCategoryKeywords.some((keyword) =>
        normalizedCategory.includes(normalizeTextKey(keyword)),
    );
};

const toTwoDigitYearRange = (yearValue?: string): string => {
    const raw = String(yearValue ?? '').trim();
    if (!raw) return '';
    const years = Array.from(raw.matchAll(/\d{4}/g)).map((match) =>
        match[0].slice(-2),
    );
    if (years.length >= 2) return `${years[0]}-${years[1]}`;
    if (years.length === 1) {
        if (raw.includes('+')) return `${years[0]}+`;
        return years[0];
    }
    return raw;
};

const buildChassisLevelLabel = (entry: {
    make?: string;
    model?: string;
    year?: string;
    chassis?: string;
}): string => {
    const make = String(entry.make ?? '').trim();
    const model = String(entry.model ?? '').trim();
    const year = toTwoDigitYearRange(entry.year);
    if (!make || !model) return '';
    return `${make} ${model}${year ? ` ${year}` : ''}`;
};

const buildEngineLevelLabel = (entry: {
    make?: string;
    engine?: string;
    model?: string;
    year?: string;
    chassis?: string;
}): string => {
    const make = String(entry.make ?? '').trim();
    const model = String(entry.model ?? '').trim();
    const engine = String(entry.engine ?? '').trim();
    const year = toTwoDigitYearRange(entry.year);
    if (!make || !model) return '';
    if (engine) return `${engine} ${make} ${model}${year ? ` ${year}` : ''}`;
    return `${make} ${model}${year ? ` ${year}` : ''}`;
};

const namePreview = computed(() => {
    const categoryName = effectiveCategoryBaseName.value;
    const engineCategory = effectiveCategoryNames.value.some((name) =>
        isEngineCategory(name),
    );

    const addedEngines = vehicleCompat.value.engines;
    const addedChassis = vehicleCompat.value.chassis;
    const allEnginesFlag = vehicleCompat.value.allEngines;
    const allChassisFlag = vehicleCompat.value.allChassis;

    const selectedMake =
        vehicleCompatRef.value?.vehicleMakes?.find(
            (m) => m.id === vehicleCompatRef.value?.selectedMakeId,
        )?.name || '';
    const selectedModel = vehicleCompatRef.value?.vehicleModels?.find(
        (m) => m.id === vehicleCompatRef.value?.selectedModelId,
    );
    const selectedModelName = selectedModel?.name || '';
    const selectedYear = formatYearRange(selectedModel);
    const selectedChassis = getModelChassis(selectedModel);

    const chassisLabels = addedChassis
        .map((entry) => buildChassisLevelLabel(entry))
        .filter(Boolean);
    const engineLabels = addedEngines
        .map((entry) =>
            engineCategory
                ? buildEngineLevelLabel(entry)
                : buildChassisLevelLabel(entry),
        )
        .filter(Boolean);

    if (allChassisFlag && selectedModelName) {
        const allChassisLabel = buildChassisLevelLabel({
            make: selectedMake,
            model: selectedModelName,
            year: selectedYear,
            chassis: selectedChassis || 'todos los chasis',
        });
        if (allChassisLabel) chassisLabels.push(allChassisLabel);
    }

    if (allEnginesFlag && selectedModelName) {
        const allEnginesLabel = engineCategory
            ? buildEngineLevelLabel({
                  make: selectedMake,
                  engine: 'todos los motores',
                  model: selectedModelName,
                  year: selectedYear,
                  chassis: selectedChassis || 'todos los chasis',
              })
            : buildChassisLevelLabel({
                  make: selectedMake,
                  model: selectedModelName,
                  year: selectedYear,
                  chassis: selectedChassis,
              });
        if (allEnginesLabel) engineLabels.push(allEnginesLabel);
    }

    const compatibilityLabels = [
        ...new Set([...chassisLabels, ...engineLabels]),
    ];
    if (compatibilityLabels.length === 0) return categoryName;

    const displayed = compatibilityLabels.slice(0, 3).join(', ');
    const suffix = compatibilityLabels.length > 3 ? ' y más' : '';
    return `${categoryName} - ${displayed}${suffix}`;
});

watch(namePreview, (newVal) => {
    if (!nameManuallyEdited.value && newVal !== 'Producto sin nombre') {
        form.value.name = newVal;
    }
});

let categoryRefreshTimer: ReturnType<typeof setTimeout> | null = null;
watch(
    [() => (form.value as any).category_id, () => [...extraCategoryIds.value]],
    () => {
        if (categoryRefreshTimer) clearTimeout(categoryRefreshTimer);
        categoryRefreshTimer = setTimeout(refreshCategoryDerivedState, 100);
    },
);

watch(
    () => form.value.pricing.cost,
    async (newCost) => {
        if (priceManuallyEdited.value) return;
        const cost = Number(newCost) || 0;
        if (cost <= 0) return;

        if (categoryFormula.value) {
            try {
                const { data } = await apiClient.post(
                    '/categories/preview-price',
                    {
                        formula: categoryFormula.value,
                        costo: cost,
                        applies_itbm: categoryAppliesItbm.value,
                        itbm_percent: resolveTaxRate(
                            categoryItbmPercent.value ?? null,
                        ),
                    },
                );
                if (data.price !== null) {
                    form.value.pricing.base_price = applyRounding(data.price);
                }
            } catch {
                /* silencioso */
            }
        } else if (categoryMargin.value != null && categoryMargin.value > 0) {
            form.value.pricing.base_price = applyRounding(
                Number((cost * (1 + categoryMargin.value / 100)).toFixed(2)),
            );
        }
    },
);

// === OEM refs (draft) ===
type PendingOemReference = { oem_code: string; manufacturer: string | null };
const addedRefs = ref<PendingOemReference[]>([]);
const refInput = ref('');
const refManufacturerInput = ref<string | null>(null);

const addRef = () => {
    const code = refInput.value.trim();
    const manufacturer = (refManufacturerInput.value || '').trim() || null;
    if (!code) return;
    const exists = addedRefs.value.some(
        (ref) =>
            ref.oem_code.toLowerCase() === code.toLowerCase() &&
            (ref.manufacturer ?? '') === (manufacturer ?? ''),
    );
    if (exists) return;
    addedRefs.value.push({ oem_code: code, manufacturer });
    refInput.value = '';
    refManufacturerInput.value = null;
};
const removeRef = (idx: number) => addedRefs.value.splice(idx, 1);

// === Upsales (draft) ===
type UpsaleRelationship = 'compatible' | 'substitute' | 'upgrade';
type PendingUpsale = {
    id: number;
    sku_base: string;
    name: string;
    relationship_type: UpsaleRelationship;
};

const selectedUpsaleProduct = ref<Product | null>(null);
const upsaleRelationshipType = ref<UpsaleRelationship>('compatible');
const pendingUpsales = ref<PendingUpsale[]>([]);

const addUpsale = () => {
    if (!selectedUpsaleProduct.value) return;
    const selected = selectedUpsaleProduct.value;
    if (pendingUpsales.value.some((item) => item.id === selected.id)) return;
    pendingUpsales.value.push({
        id: selected.id,
        sku_base: selected.sku_base,
        name: selected.name,
        relationship_type: upsaleRelationshipType.value,
    });
    selectedUpsaleProduct.value = null;
    upsaleRelationshipType.value = 'compatible';
};

const removeUpsale = (productId: number) => {
    pendingUpsales.value = pendingUpsales.value.filter(
        (item) => item.id !== productId,
    );
};

const getUpsaleRelationshipLabel = (type: UpsaleRelationship): string => {
    const labels: Record<UpsaleRelationship, string> = {
        compatible: 'Compatible',
        substitute: 'Sustituto',
        upgrade: 'Upgrade',
    };
    return labels[type];
};

// === Images (draft via component) ===
const pendingImages = ref<PendingImage[]>([]);

// === Inline modals for Category & Brand (Create-only) ===
const inlineModal = ref<'category' | 'brand' | null>(null);
const inlineForm = ref<Record<string, any>>({});
const inlineProcessing = ref(false);
const inlineError = ref<string | null>(null);

const openInline = (type: 'category' | 'brand') => {
    inlineModal.value = type;
    inlineError.value = null;
    inlineProcessing.value = false;
    if (type === 'category') inlineForm.value = { name: '', parent_id: null };
    else if (type === 'brand') inlineForm.value = { name: '' };
};

const closeInline = () => {
    inlineModal.value = null;
};

const submitInline = async () => {
    inlineProcessing.value = true;
    inlineError.value = null;
    try {
        if (inlineModal.value === 'category') {
            const { data } = await apiClient.post(
                '/categories',
                inlineForm.value,
            );
            categories.value.push(data.data ?? data);
            (form.value as any).category_id = (data.data ?? data).id;
        } else if (inlineModal.value === 'brand') {
            const { data } = await apiClient.post('/brands', inlineForm.value);
            const newBrand = data.data ?? data;
            brands.value.push(newBrand);
            form.value.brand_id = newBrand.id;
        }
        closeInline();
    } catch (e: any) {
        inlineError.value = e.response?.data?.message || 'Error al crear';
    } finally {
        inlineProcessing.value = false;
    }
};

const selectedCategoryIdsForImages = computed(() => {
    const primary = (form.value as any).category_id;
    const ids: number[] = [];
    if (primary) ids.push(primary);
    for (const id of extraCategoryIds.value) {
        if (!ids.includes(id)) ids.push(id);
    }
    return ids;
});

const categoryNameMapForImages = computed(() => {
    const map: Record<number, string> = {};
    for (const c of categories.value) {
        map[c.id] = c.name;
    }
    return map;
});

const categoryOptions = computed(() =>
    categories.value.flatMap((c) => ({
        value: c.id,
        label: c.name,
    })),
);
const extraCategoryOptions = computed(() => {
    const primaryCategoryId = (form.value as any).category_id;

    return categories.value
        .filter(
            (category) =>
                category.id !== primaryCategoryId &&
                !extraCategoryIds.value.includes(category.id),
        )
        .map((category) => ({
            value: category.id,
            label: category.name,
        }));
});
const selectedExtraCategories = computed(() => {
    return sortCategoryIdsByName(extraCategoryIds.value)
        .map((categoryId) =>
            categories.value.find((category) => category.id === categoryId),
        )
        .filter(Boolean) as Category[];
});
const oemBrandOptions = computed(() =>
    brands.value.map((b) => ({ value: b.name, label: b.name })),
);

onMounted(async () => {
    await fetchStoreSettings();
    form.value.pricing.tax_rate = resolveTaxRate(form.value.pricing.tax_rate);
    form.value.pricing.sale_tax_rate = resolveTaxRate(
        (form.value.pricing as any).sale_tax_rate ?? null,
    );
    form.value.pricing.cost_tax_rate = resolveTaxRate(
        (form.value.pricing as any).cost_tax_rate ?? null,
    );
    loadingCategories.value = true;
    try {
        const response = await apiClient.get('/categories');
        categories.value = response.data;
        categoryDetailCache.value = Object.fromEntries(
            categories.value.map((category) => [category.id, category]),
        );
    } catch (e) {
        console.error('Error loading categories:', e);
    } finally {
        loadingCategories.value = false;
    }

    loadingBrands.value = true;
    try {
        const response = await apiClient.get('/brands/all');
        brands.value = response.data.data;
    } catch (e) {
        console.error('Error loading brands:', e);
    } finally {
        loadingBrands.value = false;
    }

    try {
        const response = await apiClient.get('/warehouses');
        const warehouses = response.data.data || response.data;
        if (
            Array.isArray(warehouses) &&
            warehouses.length > 0 &&
            form.value.initial_inventory &&
            form.value.initial_inventory.length > 0
        ) {
            form.value.initial_inventory[0].warehouse_id = warehouses[0].id;
        }
    } catch (e) {
        console.error('Error loading warehouses:', e);
    }
});

// Draft variants from VariantManager in draft mode
const pendingVariants = ref<any[]>([]);
const onDraftVariantsChanged = (variants: any[]) => {
    pendingVariants.value = variants;
};

const resolveVehicleModelId = (): number | null => {
    return (
        toPositiveInt(vehicleCompatRef.value?.selectedModelId) ??
        toPositiveInt(vehicleCompat.value.modelId)
    );
};

const vehicleCompatibilityPayload = () => {
    return normalizeVehicleCompatibilityPayload(
        vehicleCompat.value,
        vehicleCompatRef.value?.selectedModelId,
    );
};

const handleSubmit = async () => {
    validationErrors.value = {};
    successMessage.value = '';
    const normalizedInitialInventory = normalizeInitialInventoryPayload(
        form.value.initial_inventory,
    );

    if (form.value.brand_id && normalizedInitialInventory.length === 0) {
        toast.error(
            'Debes seleccionar un almacén cuando creas una variante con marca',
        );
        return;
    }

    // Require model selection when "todos los motores" or "todos los chasis" is checked.
    if (
        (vehicleCompat.value.allEngines || vehicleCompat.value.allChassis) &&
        !resolveVehicleModelId()
    ) {
        toast.error(
            'Debes seleccionar un modelo de vehículo antes de marcar "todos los motores" o "todos los chasis".',
        );
        return;
    }

    try {
        const payload = {
            ...form.value,
            extra_category_ids: normalizeIdArray(
                sortCategoryIdsByName(extraCategoryIds.value),
            ),
            initial_inventory: normalizedInitialInventory,
            pricing: normalizePricingPayload(
                form.value.pricing as Record<string, unknown>,
                defaultTaxRate(),
            ),
            sku: form.value.sku || form.value.sku_base || '',
            attributes: normalizeProductAttributesPayload(
                productAttributes.value,
            ),
            vehicle_compatibility: vehicleCompatibilityPayload(),
            is_universal: vehicleCompat.value.isUniversal,
        };
        const result = await createProduct(payload);
        const productId = (result as any)?.data?.id ?? (result as any)?.id;

        if (productId && addedRefs.value.length > 0) {
            const failedReferences: string[] = [];
            for (const ref of addedRefs.value) {
                try {
                    await apiClient.post(
                        `/products/${productId}/oem-references`,
                        {
                            oem_code: ref.oem_code,
                            manufacturer: ref.manufacturer,
                        },
                    );
                } catch (refError: any) {
                    console.error(
                        'Error creating OEM reference:',
                        refError.response?.data || refError,
                    );
                    failedReferences.push(ref.oem_code);
                }
            }
            if (failedReferences.length > 0) {
                toast.error(
                    `Producto creado, pero fallaron códigos alternos: ${failedReferences.join(', ')}`,
                );
            }
        }

        if (productId && pendingVariants.value.length > 0) {
            const failedVariants: string[] = [];
            for (const variant of pendingVariants.value) {
                try {
                    await apiClient.post(`/products/${productId}/variants`, {
                        brand_id: variant.brand_id,
                        sku: variant.sku || '',
                        upc: variant.upc || null,
                        status: variant.status || 'active',
                        pricing: variant.pricing,
                        initial_inventory: variant.initial_inventory || [],
                    });
                } catch (variantError: any) {
                    console.error(
                        'Error creating variant:',
                        variantError.response?.data || variantError,
                    );
                    failedVariants.push(
                        variant.brand?.name || variant.sku || 'desconocida',
                    );
                }
            }
            if (failedVariants.length > 0) {
                toast.error(
                    `Producto creado, pero fallaron variantes: ${failedVariants.join(', ')}`,
                );
            }
        }

        if (productId && pendingUpsales.value.length > 0) {
            const failedUpsales: string[] = [];
            for (const upsale of pendingUpsales.value) {
                try {
                    await apiClient.post(
                        `/products/${productId}/alternatives`,
                        {
                            alternative_product_id: upsale.id,
                            relationship_type: upsale.relationship_type,
                        },
                    );
                } catch (upsaleError: any) {
                    console.error(
                        'Error creating upsale relation:',
                        upsaleError.response?.data || upsaleError,
                    );
                    failedUpsales.push(`${upsale.sku_base} - ${upsale.name}`);
                }
            }
            if (failedUpsales.length > 0) {
                toast.error(
                    `Producto creado, pero fallaron upsales: ${failedUpsales.join(', ')}`,
                );
            }
        }

        if (productId && pendingImages.value.length > 0) {
            const formData = new FormData();
            pendingImages.value.forEach((item) =>
                formData.append('images[]', item.file),
            );
            try {
                await apiClient.post(
                    `/products/${productId}/images`,
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    },
                );
            } catch (imageError: any) {
                console.error(
                    'Error uploading product images:',
                    imageError.response?.data || imageError,
                );
                toast.error(
                    'Producto creado, pero no se pudieron subir algunas imagenes',
                );
            } finally {
                pendingImages.value.forEach((item) =>
                    URL.revokeObjectURL(item.previewUrl),
                );
                pendingImages.value = [];
            }
        }

        successMessage.value = 'Producto creado exitosamente';
        toast.success('Producto creado exitosamente');
        setTimeout(() => {
            window.location.href = '/products';
        }, 1000);
    } catch (err: any) {
        if (err.response?.data?.errors) {
            validationErrors.value = err.response.data.errors;
            toast.error('Corrige los errores en el formulario');
        } else {
            toast.error(
                err.response?.data?.message || 'Error al crear el producto',
            );
        }
    }
};

const cancel = () => {
    window.location.href = '/products';
};
const getError = (field: string) => validationErrors.value[field]?.[0] || '';

const validationErrorItems = computed(() =>
    Object.entries(validationErrors.value).flatMap(([field, messages]) =>
        messages.map((message) => ({ field, message })),
    ),
);

const workbenchSections = [
    { id: 'identidad', label: 'Resumen' },
    { id: 'codigos', label: 'Codigos' },
    { id: 'compatibilidad', label: 'Compatibilidad' },
    { id: 'variantes', label: 'Variantes' },
    { id: 'atributos', label: 'Atributos' },
    { id: 'relaciones', label: 'Relaciones' },
    { id: 'imagenes', label: 'Imagenes' },
];

const statusLabels: Record<string, string> = {
    active: 'Activo',
    pending: 'Pendiente',
    discontinued: 'Descontinuado',
};

const primaryCategoryName = computed(() => {
    return categoryNameById((form.value as any).category_id) || 'Sin categoria';
});

const initialStockTotal = computed(() =>
    (form.value.initial_inventory ?? []).reduce(
        (total, item) => total + (Number(item.stock_available) || 0),
        0,
    ),
);

const summaryMetrics = computed(() => [
    {
        label: 'Categoria',
        value: primaryCategoryName.value,
        tone: 'indigo',
    },
    {
        label: 'Codigo',
        value: form.value.sku_base || 'Pendiente',
        tone: form.value.sku_base ? 'gray' : 'amber',
    },
    {
        label: 'Variantes',
        value:
            pendingVariants.value.length > 0
                ? `${pendingVariants.value.length} adicionales`
                : 'Base',
        tone: 'gray',
    },
    {
        label: 'Stock inicial',
        value: initialStockTotal.value.toLocaleString('es-MX'),
        tone: initialStockTotal.value > 0 ? 'emerald' : 'amber',
    },
    {
        label: 'Costo',
        value: `$${Number(form.value.pricing.cost || 0).toFixed(2)}`,
        tone: 'gray',
    },
    {
        label: 'Precio',
        value: `$${Number(computed_total.value || 0).toFixed(2)}`,
        tone: 'emerald',
    },
]);

const readinessItems = computed(() => [
    {
        label: 'Identidad',
        ready: Boolean(form.value.name || namePreview.value),
    },
    {
        label: 'Categoria',
        ready: Boolean((form.value as any).category_id),
    },
    {
        label: 'Codigo',
        ready: Boolean(form.value.sku_base),
    },
    {
        label: 'Precio',
        ready: Number(form.value.pricing.base_price || 0) > 0,
    },
    {
        label: 'Stock',
        ready: initialStockTotal.value > 0,
    },
]);
</script>

<template>
    <Head title="Crear Producto" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <!-- Header -->
            <div
                class="flex flex-col gap-4 border-b border-gray-200 pb-4 lg:flex-row lg:items-start lg:justify-between dark:border-border"
            >
                <div class="min-w-0">
                    <div
                        class="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                        <span>Productos</span>
                        <span class="text-gray-300 dark:text-gray-600">/</span>
                        <span>Alta operativa</span>
                        <span
                            class="rounded-md bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                        >
                            {{ statusLabels[form.status ?? 'pending'] }}
                        </span>
                    </div>
                    <h1
                        class="text-2xl font-bold break-words text-gray-900 dark:text-white"
                    >
                        {{ form.name || namePreview || 'Nuevo producto' }}
                    </h1>
                    <p
                        class="mt-1 font-mono text-sm break-words text-gray-500 dark:text-gray-400"
                    >
                        {{ form.sku_base || 'Codigo pendiente' }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2 lg:justify-end">
                    <button
                        type="button"
                        @click="cancel"
                        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        @click="handleSubmit"
                        :disabled="loading"
                        class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        {{ loading ? 'Creando...' : 'Crear Producto' }}
                    </button>
                </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div
                    v-for="metric in summaryMetrics"
                    :key="metric.label"
                    class="rounded-lg border bg-white p-3 shadow-sm dark:border-border dark:bg-card"
                    :class="{
                        'border-amber-200 dark:border-amber-900/60':
                            metric.tone === 'amber',
                        'border-emerald-200 dark:border-emerald-900/60':
                            metric.tone === 'emerald',
                        'border-indigo-200 dark:border-indigo-900/60':
                            metric.tone === 'indigo',
                        'border-gray-200': metric.tone === 'gray',
                    }"
                >
                    <p
                        class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                    >
                        {{ metric.label }}
                    </p>
                    <p
                        class="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white"
                        :class="{ 'font-mono': metric.label === 'Codigo' }"
                        :title="metric.value"
                    >
                        {{ metric.value }}
                    </p>
                </div>
            </div>

            <nav
                class="sticky top-0 z-20 -mx-4 overflow-x-auto border-y border-gray-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-border dark:bg-background/95"
                aria-label="Secciones del producto"
            >
                <div class="flex min-w-max gap-2">
                    <a
                        v-for="section in workbenchSections"
                        :key="section.id"
                        :href="`#${section.id}`"
                        class="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                    >
                        {{ section.label }}
                    </a>
                </div>
            </nav>

            <div
                v-if="validationErrorItems.length"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"
            >
                <div class="font-semibold">Revisa los datos del producto</div>
                <ul class="mt-2 space-y-1">
                    <li
                        v-for="item in validationErrorItems"
                        :key="`${item.field}-${item.message}`"
                        class="break-words"
                    >
                        <span class="font-mono text-xs">{{ item.field }}</span>
                        <span class="mx-1">-</span>
                        <span>{{ item.message }}</span>
                    </li>
                </ul>
            </div>

            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
                {{ error }}
            </div>

            <!-- R20: Duplicate warning banner -->
            <div
                v-if="duplicates.length > 0"
                class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-900/20"
            >
                <div class="flex items-start gap-3">
                    <svg
                        class="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <div class="flex-1">
                        <h3
                            class="text-sm font-semibold text-amber-800 dark:text-amber-300"
                        >
                            Productos similares encontrados
                        </h3>
                        <p
                            class="mt-1 text-sm text-amber-700 dark:text-amber-400"
                        >
                            Productos con código similar encontrados. Verifica
                            que no estés duplicando:
                        </p>
                        <ul class="mt-2 space-y-1">
                            <li
                                v-for="dup in duplicates"
                                :key="dup.id"
                                class="text-sm text-amber-700 dark:text-amber-400"
                            >
                                • <strong>{{ dup.name }}</strong>
                                <span
                                    class="text-xs text-amber-600 dark:text-amber-500"
                                    >(SKU: {{ dup.sku_base }})</span
                                >
                            </li>
                        </ul>
                        <p
                            class="mt-2 text-xs text-amber-600 dark:text-amber-500"
                        >
                            Puedes continuar y guardar si confirmas que es un
                            producto diferente.
                        </p>
                    </div>
                </div>
            </div>

            <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <form
                    @submit.prevent="handleSubmit"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-4"
                >
                    <!-- SECTION 1: Descripcion -->
                    <div
                        id="identidad"
                        class="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="text-sm font-semibold tracking-wider text-gray-500 uppercase"
                        >
                            Identidad y clasificacion
                        </h2>
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label
                                    class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Descripción
                                    <span class="text-red-500">*</span>
                                </label>
                                <input
                                    v-model="form.name"
                                    type="text"
                                    @input="onNameInput"
                                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                    placeholder="Se autogenera con categoría + compatibilidad vehicular..."
                                />
                                <div
                                    v-if="!form.name && namePreview"
                                    class="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 dark:border-amber-700/40 dark:bg-amber-900/20"
                                >
                                    <p
                                        class="text-xs text-amber-600 dark:text-amber-400"
                                    >
                                        Preview:
                                        <span class="font-semibold">{{
                                            namePreview
                                        }}</span>
                                    </p>
                                </div>
                            </div>
                            <div>
                                <div
                                    class="mb-1 flex items-center justify-between"
                                >
                                    <label
                                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                        >Categoría</label
                                    >
                                    <button
                                        type="button"
                                        @click="openInline('category')"
                                        class="flex items-center gap-0.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
                                    >
                                        <Plus class="h-3 w-3" /> Crear
                                    </button>
                                </div>
                                <SearchableSelect
                                    :options="categoryOptions"
                                    :model-value="
                                        (form as any).category_id ?? null
                                    "
                                    @update:model-value="
                                        (v) => ((form as any).category_id = v)
                                    "
                                    placeholder="-- Selecciona categoría --"
                                    :loading="loadingCategories"
                                />
                            </div>
                        </div>
                        <div class="space-y-2">
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Categorías extra</label
                            >
                            <div
                                class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]"
                            >
                                <SearchableSelect
                                    :options="extraCategoryOptions"
                                    :model-value="selectedExtraCategoryId"
                                    @update:model-value="
                                        (v) =>
                                            (selectedExtraCategoryId = v as
                                                | number
                                                | null)
                                    "
                                    placeholder="-- Selecciona categoría extra --"
                                    :loading="loadingCategories"
                                    :clearable="true"
                                />
                                <button
                                    type="button"
                                    @click="addExtraCategory"
                                    :disabled="!selectedExtraCategoryId"
                                    class="inline-flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    <Plus class="h-4 w-4" /> Agregar
                                </button>
                            </div>
                            <div
                                v-if="selectedExtraCategories.length > 0"
                                class="flex flex-wrap gap-2"
                            >
                                <span
                                    v-for="category in selectedExtraCategories"
                                    :key="category.id"
                                    class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                                >
                                    {{ category.name }}
                                    <button
                                        type="button"
                                        @click="
                                            removeExtraCategory(category.id)
                                        "
                                        class="rounded p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-800"
                                        :aria-label="`Quitar ${category.name}`"
                                    >
                                        <X class="h-3 w-3" />
                                    </button>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- SECTION 2: Codigo + Estado -->
                    <div
                        id="codigos"
                        class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase"
                        >
                            Codigo y estado
                        </h2>
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Código
                                    <span
                                        class="text-xs font-normal text-gray-400"
                                        >(opcional)</span
                                    >
                                </label>
                                <input
                                    v-model="form.sku_base"
                                    type="text"
                                    class="mt-0 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-border dark:bg-muted dark:text-white"
                                    placeholder="Ingresa manualmente el código"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Estado</label
                                >
                                <select
                                    v-model="form.status"
                                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                >
                                    <option value="active">Activo</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="discontinued">
                                        Descontinuado
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- SECTION 3: Codigos alternos -->
                    <div
                        class="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="text-sm font-semibold tracking-wider text-gray-500 uppercase"
                        >
                            Códigos alternos
                        </h2>
                        <div class="grid items-end gap-3 sm:grid-cols-12">
                            <div class="sm:col-span-5">
                                <label
                                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                                    >Código
                                    <span class="text-red-500">*</span></label
                                >
                                <input
                                    v-model="refInput"
                                    type="text"
                                    @keydown.enter.prevent="addRef"
                                    class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-border dark:bg-muted dark:text-white"
                                    placeholder="Ej: 123-456-ABC"
                                />
                            </div>
                            <div class="sm:col-span-4">
                                <label
                                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                                    >Marca</label
                                >
                                <SearchableSelect
                                    :options="oemBrandOptions"
                                    :model-value="refManufacturerInput"
                                    @update:model-value="
                                        (value) =>
                                            (refManufacturerInput = value as
                                                | string
                                                | null)
                                    "
                                    :loading="loadingBrands"
                                    placeholder="Sin marca"
                                    search-placeholder="Buscar marca..."
                                    :clearable="true"
                                />
                            </div>
                            <div class="sm:col-span-3">
                                <button
                                    type="button"
                                    @click="addRef"
                                    :disabled="!refInput.trim()"
                                    class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>

                        <div
                            class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background"
                        >
                            <div
                                v-if="addedRefs.length === 0"
                                class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                            >
                                No hay códigos alternos agregados.
                            </div>
                            <table v-else class="w-full text-left text-sm">
                                <thead class="bg-gray-50 dark:bg-card">
                                    <tr>
                                        <th
                                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Código
                                        </th>
                                        <th
                                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Marca
                                        </th>
                                        <th class="w-12 px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-gray-100 dark:divide-border/50"
                                >
                                    <tr
                                        v-for="(ref, idx) in addedRefs"
                                        :key="`${ref.oem_code}-${ref.manufacturer || ''}-${idx}`"
                                    >
                                        <td
                                            class="px-4 py-2 font-mono text-gray-900 dark:text-white"
                                        >
                                            {{ ref.oem_code }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-gray-700 dark:text-gray-300"
                                        >
                                            {{ ref.manufacturer || '-' }}
                                        </td>
                                        <td class="px-4 py-2 text-right">
                                            <button
                                                type="button"
                                                @click="removeRef(idx)"
                                                class="text-xs font-semibold text-red-500 hover:text-red-700"
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- SECTION 4: Compatibilidad Vehicular -->
                    <VehicleCompatSection
                        id="compatibilidad"
                        ref="vehicleCompatRef"
                        mode="draft"
                        v-model="vehicleCompat"
                        @open-inline="openVehicleInline"
                    />

                    <!-- SECTION 5: Variantes -->
                    <div
                        id="variantes"
                        class="rounded-xl border border-l-4 border-gray-100 border-l-indigo-500 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div class="px-5 py-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2
                                        class="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white"
                                    >
                                        Variantes del Producto
                                        <span
                                            class="text-xs font-normal text-gray-400"
                                            >(opcional)</span
                                        >
                                        <span
                                            v-if="pendingVariants.length > 0"
                                            class="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        >
                                            {{ pendingVariants.length }}
                                            pendiente{{
                                                pendingVariants.length > 1
                                                    ? 's'
                                                    : ''
                                            }}
                                        </span>
                                    </h2>
                                    <p
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Agrega variantes adicionales con su
                                        propia marca, precios e inventario. Se
                                        guardarán junto con el producto.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div class="px-5 pb-5">
                            <VariantManager
                                :category-id="form.category_id ?? undefined"
                                :sku-base="form.sku_base || undefined"
                                :product-name="form.name"
                                :category-formula="categoryFormula"
                                :category-applies-itbm="categoryAppliesItbm"
                                :category-itbm-percent="categoryItbmPercent"
                                @draft-variants-changed="onDraftVariantsChanged"
                            />
                        </div>
                    </div>

                    <!-- SECTION 6: Atributos -->
                    <div
                        id="atributos"
                        class="rounded-xl border border-l-4 border-gray-100 border-l-indigo-500 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="mb-3 flex items-center justify-between gap-3"
                        >
                            <h2
                                class="flex items-center gap-1 text-sm font-semibold tracking-wider text-gray-500 uppercase"
                            >
                                <Wrench class="h-4 w-4" /> Atributos
                            </h2>
                            <button
                                type="button"
                                @click="addCustomAttribute"
                                class="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                            >
                                <Plus class="h-3.5 w-3.5" /> Agregar atributo
                            </button>
                        </div>
                        <div
                            v-if="productAttributes.length === 0"
                            class="rounded-md border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-border dark:text-gray-400"
                        >
                            Puedes agregar atributos manualmente o seleccionar
                            una categoría con atributos por defecto.
                        </div>
                        <div v-else class="space-y-3">
                            <div
                                v-for="(attr, index) in productAttributes"
                                :key="index"
                                class="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end"
                            >
                                <div class="sm:col-span-5">
                                    <label
                                        class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                                    >
                                        Nombre del atributo
                                        <span
                                            v-if="attr.required"
                                            class="text-red-500"
                                            >*</span
                                        >
                                    </label>
                                    <input
                                        v-model="attr.name"
                                        type="text"
                                        :required="attr.required"
                                        :readonly="attr.fromCategory"
                                        class="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white"
                                        :class="
                                            attr.fromCategory
                                                ? 'cursor-not-allowed opacity-75'
                                                : ''
                                        "
                                        placeholder="Ej: Amperaje"
                                    />
                                </div>
                                <div class="sm:col-span-6">
                                    <label
                                        class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                                    >
                                        Valor
                                        <span
                                            v-if="attr.required"
                                            class="text-red-500"
                                            >*</span
                                        >
                                    </label>
                                    <div
                                        v-if="hasSelectOptions(attr)"
                                        class="mt-0.5 w-full"
                                    >
                                        <div
                                            class="max-h-40 overflow-y-auto rounded-md border border-gray-300 bg-white dark:border-border dark:bg-muted"
                                        >
                                            <label
                                                v-for="option in attr.options"
                                                :key="option"
                                                class="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-muted/80"
                                                :class="
                                                    (
                                                        Array.isArray(
                                                            attr.value,
                                                        )
                                                            ? attr.value.includes(
                                                                  option,
                                                              )
                                                            : attr.value ===
                                                              option
                                                    )
                                                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                                                        : 'text-gray-700 dark:text-gray-300'
                                                "
                                            >
                                                <input
                                                    type="checkbox"
                                                    :checked="
                                                        Array.isArray(
                                                            attr.value,
                                                        )
                                                            ? attr.value.includes(
                                                                  option,
                                                              )
                                                            : attr.value ===
                                                              option
                                                    "
                                                    class="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                                    @change="
                                                        (() => {
                                                            const current =
                                                                Array.isArray(
                                                                    attr.value,
                                                                )
                                                                    ? [
                                                                          ...attr.value,
                                                                      ]
                                                                    : attr.value
                                                                      ? [
                                                                            String(
                                                                                attr.value,
                                                                            ),
                                                                        ]
                                                                      : [];
                                                            attr.value =
                                                                current.includes(
                                                                    option,
                                                                )
                                                                    ? current.filter(
                                                                          (v) =>
                                                                              v !==
                                                                              option,
                                                                      )
                                                                    : [
                                                                          ...current,
                                                                          option,
                                                                      ];
                                                        })()
                                                    "
                                                />
                                                <span
                                                    class="text-sm select-none"
                                                    >{{ option }}</span
                                                >
                                            </label>
                                        </div>
                                        <p
                                            v-if="
                                                Array.isArray(attr.value) &&
                                                attr.value.length > 0
                                            "
                                            class="mt-1 text-xs text-gray-400 dark:text-gray-500"
                                        >
                                            {{
                                                attr.value.length === 1
                                                    ? '1 seleccionado'
                                                    : `${attr.value.length} seleccionados`
                                            }}
                                        </p>
                                    </div>
                                    <input
                                        v-else
                                        v-model="attr.value"
                                        type="text"
                                        :required="attr.required"
                                        class="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white"
                                        :placeholder="
                                            attr.name
                                                ? `${attr.name}...`
                                                : 'Valor'
                                        "
                                    />
                                </div>
                                <div class="sm:col-span-1">
                                    <button
                                        type="button"
                                        @click="removeProductAttribute(index)"
                                        :disabled="attr.fromCategory"
                                        class="w-full rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                        :class="
                                            attr.fromCategory
                                                ? 'cursor-not-allowed opacity-50'
                                                : ''
                                        "
                                        title="Quitar atributo"
                                    >
                                        <X class="mx-auto h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECTION 7: Upsales -->
                    <div
                        id="relaciones"
                        class="space-y-4 rounded-xl border border-l-4 border-gray-200 border-l-violet-500 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="text-sm font-semibold tracking-wider text-gray-500 uppercase"
                        >
                            Upsales
                        </h2>

                        <div class="grid items-end gap-4 sm:grid-cols-12">
                            <div class="sm:col-span-6">
                                <label
                                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                                    >Buscar producto
                                    <span class="text-red-500">*</span></label
                                >
                                <AsyncProductCombobox
                                    :model-value="
                                        selectedUpsaleProduct?.id ?? null
                                    "
                                    @select="selectedUpsaleProduct = $event"
                                />
                            </div>
                            <div class="sm:col-span-3">
                                <label
                                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                                    >Tipo de relación</label
                                >
                                <select
                                    v-model="upsaleRelationshipType"
                                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                >
                                    <option value="compatible">
                                        Compatible
                                    </option>
                                    <option value="substitute">
                                        Sustituto
                                    </option>
                                    <option value="upgrade">Upgrade</option>
                                </select>
                            </div>
                            <div class="sm:col-span-3">
                                <button
                                    type="button"
                                    @click="addUpsale"
                                    :disabled="!selectedUpsaleProduct"
                                    class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                                >
                                    Agregar upsale
                                </button>
                            </div>
                        </div>

                        <div
                            class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background"
                        >
                            <div
                                v-if="pendingUpsales.length === 0"
                                class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                            >
                                No hay upsales pendientes por vincular.
                            </div>
                            <table v-else class="w-full text-left text-sm">
                                <thead class="bg-gray-50 dark:bg-card">
                                    <tr>
                                        <th
                                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Producto
                                        </th>
                                        <th
                                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Relacion
                                        </th>
                                        <th class="w-12 px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-gray-100 dark:divide-border/50"
                                >
                                    <tr
                                        v-for="item in pendingUpsales"
                                        :key="item.id"
                                    >
                                        <td
                                            class="px-4 py-2 text-gray-900 dark:text-white"
                                        >
                                            <span class="font-mono">{{
                                                item.sku_base
                                            }}</span>
                                            <span class="text-gray-500">
                                                - {{ item.name }}</span
                                            >
                                        </td>
                                        <td
                                            class="px-4 py-2 text-gray-700 dark:text-gray-300"
                                        >
                                            {{
                                                getUpsaleRelationshipLabel(
                                                    item.relationship_type,
                                                )
                                            }}
                                        </td>
                                        <td class="px-4 py-2 text-right">
                                            <button
                                                type="button"
                                                @click="removeUpsale(item.id)"
                                                class="text-red-500 hover:text-red-700"
                                                title="Quitar upsale"
                                            >
                                                <X class="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- SECTION 8: Notas -->
                    <div
                        class="rounded-xl border border-l-4 border-gray-100 border-l-slate-400 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase"
                        >
                            Notas internas
                        </h2>
                        <textarea
                            v-model="form.description"
                            rows="3"
                            class="mt-1 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Notas internas del producto..."
                        ></textarea>
                    </div>

                    <!-- SECTION 9: Imagen del Producto -->
                    <ProductImagesSection
                        id="imagenes"
                        mode="pending"
                        v-model="pendingImages"
                        :category-ids="selectedCategoryIdsForImages"
                        :category-name-map="categoryNameMapForImages"
                    />
                </form>

                <aside class="space-y-4 xl:sticky xl:top-16 xl:self-start">
                    <div
                        class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="text-sm font-semibold tracking-wide text-gray-900 uppercase dark:text-white"
                        >
                            Estado del alta
                        </h2>
                        <div class="mt-4 space-y-3">
                            <div
                                v-for="item in readinessItems"
                                :key="item.label"
                                class="flex items-center justify-between gap-3 text-sm"
                            >
                                <span class="text-gray-600 dark:text-gray-300">
                                    {{ item.label }}
                                </span>
                                <span
                                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                                    :class="
                                        item.ready
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                    "
                                >
                                    {{ item.ready ? 'Listo' : 'Pendiente' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div
                        class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                    >
                        <h2
                            class="text-sm font-semibold tracking-wide text-gray-900 uppercase dark:text-white"
                        >
                            Acciones
                        </h2>
                        <div class="mt-4 grid gap-2">
                            <button
                                type="button"
                                @click="handleSubmit"
                                :disabled="loading"
                                class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
                            >
                                {{ loading ? 'Creando...' : 'Crear producto' }}
                            </button>
                            <button
                                type="button"
                                @click="cancel"
                                class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-white"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>

        <!-- Inline Creation Modal (Category & Brand only — vehicle modals use VehicleInlineModals) -->
        <Dialog
            :open="inlineModal !== null"
            @update:open="
                (v) => {
                    if (!v) closeInline();
                }
            "
        >
            <DialogContent class="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        {{
                            inlineModal === 'category'
                                ? 'Nueva Categoría'
                                : inlineModal === 'brand'
                                  ? 'Nueva Marca de Artículo'
                                  : ''
                        }}
                    </DialogTitle>
                </DialogHeader>
                <form @submit.prevent="submitInline" class="space-y-4 py-2">
                    <template v-if="inlineModal === 'category'">
                        <div class="space-y-4">
                            <div class="space-y-2">
                                <Label
                                    >Nombre de la Categoría
                                    <span class="text-red-500">*</span></Label
                                >
                                <Input
                                    v-model="inlineForm.name"
                                    required
                                    placeholder="Ej: Filtros, Frenos"
                                />
                            </div>
                            <div class="space-y-2">
                                <Label>Categoría Padre (Opcional)</Label>
                                <SearchableSelect
                                    :options="categoryOptions"
                                    :model-value="inlineForm.parent_id"
                                    @update:model-value="
                                        (v) =>
                                            (inlineForm.parent_id = v as
                                                | number
                                                | null)
                                    "
                                    placeholder="-- Selecciona categoría padre --"
                                />
                            </div>
                        </div>
                    </template>
                    <template v-if="inlineModal === 'brand'">
                        <div class="space-y-2">
                            <Label
                                >Nombre de la Marca
                                <span class="text-red-500">*</span></Label
                            >
                            <Input
                                v-model="inlineForm.name"
                                required
                                placeholder="Ej: KYB, Bosch, Monroe"
                            />
                        </div>
                    </template>

                    <div v-if="inlineError" class="text-sm text-red-600">
                        {{ inlineError }}
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="closeInline"
                            >Cancelar</Button
                        >
                        <Button type="submit" :disabled="inlineProcessing">{{
                            inlineProcessing ? 'Guardando...' : 'Guardar'
                        }}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

        <!-- Vehicle Inline Modals -->
        <VehicleInlineModals
            ref="vehicleModalsRef"
            :current-modal="vehicleModalType"
            :selected-make-id="vehicleCompatRef?.selectedMakeId ?? null"
            :selected-model-id="vehicleCompatRef?.selectedModelId ?? null"
            @close="closeVehicleInline"
            @make-created="onMakeCreated"
            @model-created="onModelCreated"
            @engine-created="onEngineCreated"
            @chassis-created="onChassisCreated"
        />
    </AppLayout>
</template>
