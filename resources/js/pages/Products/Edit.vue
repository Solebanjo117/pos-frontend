<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { Archive, Wrench, Copy, RefreshCw, Plus, X } from 'lucide-vue-next';
import { ref, onMounted, watch, computed } from 'vue';
import AlternativeManager from '@/components/Products/AlternativeManager.vue';
import AttributeManager from '@/components/Products/AttributeManager.vue';
import OemReferenceManager from '@/components/Products/OemReferenceManager.vue';
import ProductCodesEditor from '@/components/Products/ProductCodesEditor.vue';
import ProductImagesSection from '@/components/Products/ProductImagesSection.vue';
import VariantManager from '@/components/Products/VariantManager.vue';
import VehicleCompatSection from '@/components/Products/VehicleCompatSection.vue';
import VehicleInlineModals from '@/components/Products/VehicleInlineModals.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import type { ProductAttribute as EditableProductAttribute } from '@/composables/useProductAttributes';
import { useProducts } from '@/composables/useProducts';
import { useStoreSettings } from '@/composables/useStoreSettings';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { productsApi } from '@/services/api/products';
import { type BreadcrumbItem } from '@/types';
import type { Category } from '@/types/category';
import type { UpdateProductRequest } from '@/types/product';
import {
    normalizeAlternativesPayload,
    normalizeOemReferencesPayload,
    normalizeProductAttributesPayload,
    normalizeVehicleCompatibilityPayload,
} from '@/utils/productPayload';

const props = defineProps<{
    productId: number;
}>();

const { resolveTaxRate } = useStoreSettings();

interface DraftOemReference {
    id: number;
    oem_code: string;
    manufacturer: string | null;
}

interface DraftAlternative {
    id: number;
    sku: string;
    name: string;
    relationship_type: 'compatible' | 'substitute' | 'upgrade';
}

interface DraftCompatData {
    engines: Array<{
        engine_id: number;
        make: string;
        model: string;
        engine: string;
        year: string;
        chassis: string;
    }>;
    chassis: Array<{
        chassis_id: number;
        make: string;
        model: string;
        year: string;
        chassis: string;
    }>;
    allEngines: boolean;
    allChassis: boolean;
    isUniversal: boolean;
    modelId?: number | null;
    makeId?: number | null;
}

const { currentProduct, updateProduct, fetchProduct, loading, error } =
    useProducts();
const toast = useToast();
const duplicating = ref(false);
const archiving = ref(false);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
    { title: 'Editar', href: `/products/${props.productId}/edit` },
];

const form = ref<UpdateProductRequest>({
    sku_base: '',
    codes: [],
    upc: '',
    alternate_code: '',
    product_line_id: undefined,
    name: '',
    description: '',
    status: 'active',
    is_universal: false,
});
const productCodesRef = ref<InstanceType<typeof ProductCodesEditor> | null>(
    null,
);
const primaryCommercialCode = computed(
    () => form.value.codes?.find((code) => code.is_primary)?.code ?? '',
);
const productCodesModel = computed({
    get: () => form.value.codes ?? [],
    set: (codes) => (form.value.codes = codes),
});

const validationErrors = ref<Record<string, string[]>>({});
const successMessage = ref('');
const initialEditVariantId = ref<number | null>(null);

const categories = ref<Category[]>([]);
const loadingCategories = ref(false);
const categoryFormula = ref<string | null>(null);
const categoryAppliesItbm = ref<boolean>(false);
const categoryItbmPercent = ref<number | null>(null);
const categoryMargin = ref<number | null>(null);
const regenerating = ref(false);
const selectedCategoryId = ref<number | null>(null);
const extraCategoryIds = ref<number[]>([]);
const selectedExtraCategoryId = ref<number | null>(null);
const categoryDetailCache = ref<Record<number, Category>>({});
const attributeManagerRef = ref<InstanceType<typeof AttributeManager> | null>(
    null,
);
const metadataInitialized = ref(false);
const draftIdCounter = ref(-1000);
const draftAttributes = ref<EditableProductAttribute[]>([]);
const draftOemReferences = ref<DraftOemReference[]>([]);
const draftAlternatives = ref<DraftAlternative[]>([]);
const draftCompatibility = ref<DraftCompatData>({
    engines: [],
    chassis: [],
    allEngines: false,
    allChassis: false,
    isUniversal: false,
    modelId: null,
    makeId: null,
});

const categoryOptions = computed(() =>
    categories.value.map((c) => ({
        value: c.id,
        label: c.name,
    })),
);

const categoryNameById = (categoryId: number | undefined | null): string => {
    if (!categoryId) return '';
    return (
        categories.value.find((category) => category.id === categoryId)?.name ??
        ''
    );
};

const toCategoryId = (
    value: number | string | null | undefined,
): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const categoryId = Number(value);
    return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
};

const sortCategoryIdsByName = (
    categoryIds: Array<number | string | null | undefined>,
): number[] => {
    return [...new Set(categoryIds)]
        .map(toCategoryId)
        .filter((categoryId): categoryId is number => categoryId !== null)
        .sort((left, right) =>
            categoryNameById(left).localeCompare(categoryNameById(right), 'es'),
        );
};

const categoryPayload = () => ({
    category_id: toCategoryId(selectedCategoryId.value),
    extra_category_ids: sortCategoryIdsByName(extraCategoryIds.value),
});

const nextDraftId = () => draftIdCounter.value--;

const attributeNameKey = (name: string): string => name.trim().toLowerCase();
const normalizeAttributeType = (value: unknown): 'string' | 'select' =>
    value === 'select' ? 'select' : 'string';
const normalizeAttributeOptions = (options: unknown): string[] => {
    if (!Array.isArray(options)) return [];

    return options
        .map((option) => String(option ?? '').trim())
        .filter((option) => option !== '');
};

const formatYearRange = (yearRange: string | null | undefined): string => {
    if (!yearRange) return '';
    return yearRange;
};

const normalizeDraftAttributes = (
    attributes: any[] = [],
): EditableProductAttribute[] => {
    return attributes.map((attribute) => {
        const type = normalizeAttributeType(attribute?.type);

        // Deserialize value: for select types, ensure it’s an array.
        let value: string | string[];
        const rawValue = attribute.value;
        if (type === 'select') {
            if (Array.isArray(rawValue)) {
                value = rawValue;
            } else if (typeof rawValue === 'string') {
                // Try JSON decode for legacy data
                try {
                    const parsed = JSON.parse(rawValue);
                    value = Array.isArray(parsed) ? parsed : [rawValue];
                } catch {
                    value = rawValue ? [rawValue] : [];
                }
            } else {
                value = [];
            }
        } else {
            value =
                typeof rawValue === 'string'
                    ? rawValue
                    : Array.isArray(rawValue)
                      ? rawValue.join(', ')
                      : String(rawValue ?? '');
        }

        return {
            source:
                attribute?.source === 'category'
                    ? ('category' as const)
                    : ('custom' as const),
            source_category_id:
                attribute?.source === 'category'
                    ? toCategoryId(attribute?.source_category_id)
                    : null,
            type,
            options:
                type === 'select'
                    ? normalizeAttributeOptions(attribute?.options)
                    : null,
            id: Number(attribute.id ?? nextDraftId()),
            product_id: props.productId,
            name: String(attribute.name ?? ''),
            value,
            unit: attribute.unit ?? null,
        };
    });
};

const normalizeDraftOemReferences = (
    references: any[] = [],
): DraftOemReference[] => {
    return references.map((reference) => ({
        id: Number(reference.id ?? nextDraftId()),
        oem_code: String(reference.oem_code ?? ''),
        manufacturer: reference.manufacturer ?? null,
    }));
};

const normalizeDraftAlternatives = (
    alternatives: any[] = [],
): DraftAlternative[] => {
    const allowedTypes = ['compatible', 'substitute', 'upgrade'] as const;

    return alternatives
        .filter((alternative) =>
            allowedTypes.includes(alternative.relationship_type as any),
        )
        .map((alternative) => ({
            id: Number(alternative.id),
            sku: String(alternative.sku ?? alternative.sku_base ?? ''),
            name: String(alternative.name ?? ''),
            relationship_type:
                alternative.relationship_type as DraftAlternative['relationship_type'],
        }));
};

const normalizeDraftCompatibility = (
    compatibility: any[] = [],
    isUniversal = false,
): DraftCompatData => {
    const scopedCompatibility = compatibility.find(
        (item) => (item.all_engines || item.all_chassis) && item.model_id,
    );
    const scopedModel = scopedCompatibility?.model ?? null;
    const scopedMake = scopedCompatibility?.make ?? scopedModel?.make ?? null;

    return {
        engines: compatibility
            .filter((item) => item.engine_id)
            .map((item) => ({
                engine_id: Number(item.engine_id),
                make: String(item.make ?? ''),
                model: String(item.model ?? ''),
                engine: String(item.engine ?? ''),
                year: formatYearRange(item.year_range),
                chassis: String(item.chassis?.code ?? item.chassis ?? ''),
            })),
        chassis: compatibility
            .filter((item) => item.chassis_id)
            .map((item) => ({
                chassis_id: Number(item.chassis_id),
                make: String(item.make ?? ''),
                model: String(item.model ?? ''),
                year: formatYearRange(item.year_range),
                chassis: String(item.chassis?.code ?? item.chassis ?? ''),
            })),
        allEngines: compatibility.some((item) => item.all_engines),
        allChassis: compatibility.some((item) => item.all_chassis),
        isUniversal,
        modelId: scopedCompatibility?.model_id
            ? Number(scopedCompatibility.model_id)
            : null,
        makeId:
            scopedCompatibility?.make_id ??
            scopedMake?.id ??
            scopedModel?.make_id ??
            null,
    };
};

const extraCategoryOptions = computed(() => {
    return categories.value
        .filter(
            (category) =>
                category.id !== selectedCategoryId.value &&
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

const selectedCategoryIdsForImages = computed(() => {
    const ids: number[] = [];
    if (selectedCategoryId.value) ids.push(selectedCategoryId.value);
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
        categoryFromList?.pricing_formula !== undefined ||
        categoryFromList?.default_attributes
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

const applyPrimaryCategorySettings = async (categoryId: number | null) => {
    const category = categoryId ? await fetchCategoryDetail(categoryId) : null;

    categoryFormula.value = category?.pricing_formula ?? null;
    categoryAppliesItbm.value = category?.applies_itbm ?? false;
    categoryItbmPercent.value = category
        ? resolveTaxRate(category.itbm_percent ?? null)
        : null;
    categoryMargin.value = category?.default_margin_percent ?? null;
};

const categoryDefaultAttributeValue = (
    attribute: {
        value?: string;
        default_value?: string;
    },
    type: string = 'string',
): string | string[] => {
    if (type === 'select') return [];
    return String(attribute.value ?? attribute.default_value ?? '');
};

const recalculateDraftAttributesFromCategories = async () => {
    const primaryCategoryId = toCategoryId(selectedCategoryId.value);
    const orderedExtraIds = sortCategoryIdsByName(
        extraCategoryIds.value,
    ).filter((categoryId) => categoryId !== primaryCategoryId);
    const categoryIds = [primaryCategoryId, ...orderedExtraIds].filter(
        (categoryId): categoryId is number => categoryId !== null,
    );
    const categoryDetails = (
        await Promise.all(
            categoryIds.map((categoryId) => fetchCategoryDetail(categoryId)),
        )
    ).filter(Boolean) as Category[];
    const existingByName = new Map<string, EditableProductAttribute>();

    draftAttributes.value.forEach((attribute) => {
        const key = attributeNameKey(attribute.name);
        if (key && !existingByName.has(key)) {
            existingByName.set(key, attribute);
        }
    });

    const seenDefaultNames = new Set<string>();
    const defaultAttributes: EditableProductAttribute[] = [];

    categoryDetails.forEach((category) => {
        (category.default_attributes ?? []).forEach((attribute) => {
            const name = String(attribute.name ?? '').trim();
            const key = attributeNameKey(name);
            const type = normalizeAttributeType(attribute.type);
            const options =
                type === 'select'
                    ? normalizeAttributeOptions(attribute.options)
                    : null;

            if (!key || seenDefaultNames.has(key)) return;

            const existing = existingByName.get(key);

            // Preserve existing value; for selects ensure it’s an array.
            let value: string | string[];
            if (existing?.value !== undefined) {
                if (type === 'select') {
                    value = Array.isArray(existing.value)
                        ? existing.value
                        : existing.value
                          ? [String(existing.value)]
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
                value = categoryDefaultAttributeValue(attribute, type);
            }

            defaultAttributes.push({
                id: existing?.id ?? nextDraftId(),
                product_id: props.productId,
                name,
                value,
                unit: existing?.unit ?? attribute.unit ?? null,
                source: 'category' as const,
                source_category_id: category.id,
                type,
                options,
            });
            seenDefaultNames.add(key);
        });
    });

    const customAttributes = draftAttributes.value
        .filter(
            (attribute) =>
                !seenDefaultNames.has(attributeNameKey(attribute.name)),
        )
        .map((attribute) => ({
            ...attribute,
            source: 'custom' as const,
            source_category_id: null as number | null,
            type: 'string' as const,
            options: null,
        }));
    draftAttributes.value = [...defaultAttributes, ...customAttributes];
};

const addExtraCategory = () => {
    const categoryId = toCategoryId(selectedExtraCategoryId.value);

    if (
        !categoryId ||
        categoryId === selectedCategoryId.value ||
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

const initializeProductDraft = async () => {
    if (!currentProduct.value) return;

    metadataInitialized.value = false;

    const categoryId = toCategoryId(
        currentProduct.value.category_id ??
            (currentProduct.value.category as any)?.id ??
            null,
    );
    selectedCategoryId.value = categoryId;
    extraCategoryIds.value = sortCategoryIdsByName(
        currentProduct.value.extra_category_ids ??
            currentProduct.value.extra_categories?.map(
                (category) => category.id,
            ) ??
            [],
    ).filter((extraCategoryId) => extraCategoryId !== categoryId);

    form.value = {
        sku_base: currentProduct.value.sku_base || '',
        codes:
            currentProduct.value.codes?.map((code) => ({ ...code })) ??
            (currentProduct.value.sku_base
                ? [
                      {
                          code: currentProduct.value.sku_base,
                          type: 'sku' as const,
                          is_primary: true,
                      },
                  ]
                : []),
        upc: currentProduct.value.default_variant?.upc || '',
        alternate_code: (currentProduct.value as any).alternate_code || '',
        category_id: categoryId ?? undefined,
        name: currentProduct.value.name,
        description: currentProduct.value.description || '',
        status: currentProduct.value.status,
        is_universal: currentProduct.value.is_universal ?? false,
        batch_tracking: currentProduct.value.batch_tracking,
        extra_category_ids: extraCategoryIds.value,
    };

    draftAttributes.value = normalizeDraftAttributes(
        currentProduct.value.attributes ?? [],
    );
    draftOemReferences.value = normalizeDraftOemReferences(
        currentProduct.value.oem_references ?? [],
    );
    draftAlternatives.value = normalizeDraftAlternatives(
        currentProduct.value.alternatives ?? [],
    );
    draftCompatibility.value = normalizeDraftCompatibility(
        currentProduct.value.compatibility ?? [],
        currentProduct.value.is_universal ?? false,
    );

    await applyPrimaryCategorySettings(categoryId);
    metadataInitialized.value = true;
};

onMounted(async () => {
    const params = new URLSearchParams(window.location.search);
    const variantParam = Number(params.get('variant'));
    initialEditVariantId.value =
        Number.isInteger(variantParam) && variantParam > 0
            ? variantParam
            : null;

    loadingCategories.value = true;
    try {
        const response = await apiClient.get('/categories');
        categories.value = response.data;
        categoryDetailCache.value = Object.fromEntries(
            categories.value.map((category) => [category.id, category]),
        );
    } catch {
        /* ignore */
    } finally {
        loadingCategories.value = false;
    }

    await fetchProduct(props.productId);
    await initializeProductDraft();
});

watch(selectedCategoryId, async (newCategoryId) => {
    const categoryId = toCategoryId(newCategoryId);
    form.value.category_id = categoryId ?? undefined;
    if (categoryId && extraCategoryIds.value.includes(categoryId)) {
        extraCategoryIds.value = extraCategoryIds.value.filter(
            (extraCategoryId) => extraCategoryId !== categoryId,
        );
    }

    await applyPrimaryCategorySettings(categoryId);

    if (metadataInitialized.value) {
        await recalculateDraftAttributesFromCategories();
    }
});

watch(extraCategoryIds, async () => {
    form.value.extra_category_ids = sortCategoryIdsByName(
        extraCategoryIds.value,
    );

    if (metadataInitialized.value) {
        await recalculateDraftAttributesFromCategories();
    }
});

const metadataPayload = (): UpdateProductRequest => {
    const primaryCode =
        form.value.codes?.find((code) => code.is_primary)?.code ?? null;
    const upcCode =
        form.value.codes?.find((code) => code.type === 'upc')?.code ??
        undefined;

    return {
        ...form.value,
        sku_base: primaryCode,
        upc: upcCode,
        ...categoryPayload(),
        is_universal: draftCompatibility.value.isUniversal,
        attributes: normalizeProductAttributesPayload(draftAttributes.value),
        oem_references: normalizeOemReferencesPayload(draftOemReferences.value),
        alternatives: normalizeAlternativesPayload(draftAlternatives.value),
        vehicle_compatibility: vehicleCompatibilityPayload(),
    };
};

const vehicleCompatibilityPayload = () => {
    return normalizeVehicleCompatibilityPayload(
        draftCompatibility.value,
        vehicleCompatRef.value?.selectedModelId,
    );
};

const handleSubmit = async () => {
    validationErrors.value = {};
    successMessage.value = '';

    await productCodesRef.value?.validateAll();
    if (productCodesRef.value?.hasConflicts()) {
        toast.error('Corrige los códigos duplicados antes de guardar.');
        return;
    }

    try {
        await updateProduct(props.productId, metadataPayload());
        await fetchProduct(props.productId);
        await initializeProductDraft();
        successMessage.value = 'Producto actualizado exitosamente';
        toast.success('Producto actualizado exitosamente');
    } catch (err: any) {
        if (err.response?.data?.errors) {
            validationErrors.value = err.response.data.errors;
        }
    }
};

const handleArchive = async () => {
    const productName =
        currentProduct.value?.name || form.value.name || 'este producto';
    if (
        !confirm(
            `¿Desea archivar "${productName}"? Desaparecerá del Punto de Venta, pero las facturas históricas lo conservarán.`,
        )
    )
        return;

    archiving.value = true;
    try {
        await productsApi.deleteProduct(props.productId);
        toast.success('Producto archivado correctamente');
        window.location.href = '/products';
    } catch (err: any) {
        toast.error(
            err.response?.data?.message || 'Error al archivar producto',
        );
    } finally {
        archiving.value = false;
    }
};

const cancel = () => {
    window.location.href = '/products';
};

const handleDuplicate = async () => {
    if (duplicating.value) return;

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
};

const handleRegenerateName = async () => {
    if (regenerating.value) return;
    regenerating.value = true;
    try {
        const response = await productsApi.previewName(props.productId, {
            ...categoryPayload(),
            vehicle_compatibility: vehicleCompatibilityPayload(),
        });
        const newName = response.data?.name;
        if (newName) {
            form.value.name = newName;
            toast.success('Descripción regenerada correctamente');
        }
    } catch (err: any) {
        toast.error(
            err.response?.data?.message || 'Error al regenerar la descripción',
        );
    } finally {
        regenerating.value = false;
    }
};

// === Vehicle Inline Modals ===
const vehicleCompatRef = ref<InstanceType<typeof VehicleCompatSection> | null>(
    null,
);
const vehicleModalsRef = ref<InstanceType<typeof VehicleInlineModals> | null>(
    null,
);
const vehicleModalType = ref<
    'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis' | null
>(null);

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

const editCategoryName = computed(() => {
    return (
        categoryNameById(selectedCategoryId.value) ||
        currentProduct.value?.category?.name ||
        'Sin categoria'
    );
});

const editVariantCount = computed(() => {
    return (
        currentProduct.value?.variants_count ??
        currentProduct.value?.variants?.length ??
        0
    );
});

const editTotalStock = computed(() => {
    const product = currentProduct.value as any;
    if (product?.total_stock !== undefined && product?.total_stock !== null) {
        return Number(product.total_stock) || 0;
    }

    return (product?.variants ?? []).reduce(
        (total: number, variant: any) =>
            total + (Number(variant.total_stock) || 0),
        0,
    );
});

const editPrimaryPricing = computed(() => {
    const pricing =
        currentProduct.value?.default_variant?.pricing ??
        currentProduct.value?.pricing ??
        null;

    return {
        cost: Number(pricing?.cost ?? pricing?.cost_total ?? 0),
        price: Number(
            pricing?.current_sale_price ??
                pricing?.base_price ??
                pricing?.calculated_price ??
                0,
        ),
    };
});

const summaryMetrics = computed(() => [
    {
        label: 'Categoria',
        value: editCategoryName.value,
        tone: 'indigo',
    },
    {
        label: 'Codigo',
        value: primaryCommercialCode.value || 'Sin código',
        tone: primaryCommercialCode.value ? 'gray' : 'amber',
    },
    {
        label: 'Variantes',
        value: editVariantCount.value.toLocaleString('es-MX'),
        tone: editVariantCount.value > 0 ? 'gray' : 'amber',
    },
    {
        label: 'Stock',
        value: editTotalStock.value.toLocaleString('es-MX'),
        tone: editTotalStock.value > 0 ? 'emerald' : 'amber',
    },
    {
        label: 'Costo',
        value: `$${editPrimaryPricing.value.cost.toFixed(2)}`,
        tone: 'gray',
    },
    {
        label: 'Precio',
        value: `$${editPrimaryPricing.value.price.toFixed(2)}`,
        tone: 'emerald',
    },
]);

const readinessItems = computed(() => [
    {
        label: 'Identidad',
        ready: Boolean(form.value.name),
    },
    {
        label: 'Categoria',
        ready: Boolean(selectedCategoryId.value),
    },
    {
        label: 'Codigo',
        ready: true,
    },
    {
        label: 'Variantes',
        ready: editVariantCount.value > 0,
    },
    {
        label: 'Stock',
        ready: editTotalStock.value > 0,
    },
]);

const validationErrorItems = computed(() =>
    Object.entries(validationErrors.value).flatMap(([field, messages]) =>
        messages.map((message) => ({ field, message })),
    ),
);
</script>

<template>
    <Head title="Editar Producto" />

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
                        <span>Edicion operativa</span>
                        <span
                            class="rounded-md px-2 py-1"
                            :class="
                                form.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                            "
                        >
                            {{ statusLabels[form.status ?? 'pending'] }}
                        </span>
                    </div>
                    <h1
                        class="text-2xl font-bold break-words text-gray-900 dark:text-white"
                    >
                        {{ form.name || currentProduct?.name || 'Producto' }}
                    </h1>
                    <p
                        class="mt-1 font-mono text-sm break-words text-gray-500 dark:text-gray-400"
                    >
                        {{
                            primaryCommercialCode ||
                            currentProduct?.primary_code ||
                            'Sin código'
                        }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2 lg:justify-end">
                    <button
                        type="button"
                        :disabled="duplicating"
                        @click="handleDuplicate"
                        class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-card dark:text-white dark:hover:bg-muted"
                    >
                        <Copy class="h-4 w-4" />
                        {{ duplicating ? 'Duplicando...' : 'Duplicar' }}
                    </button>
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
                        {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
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

            <!-- Loading -->
            <div v-if="loading && !currentProduct" class="py-12 text-center">
                <div
                    class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent dark:border-primary"
                ></div>
                <p class="mt-2 text-gray-600">Cargando producto...</p>
            </div>

            <div v-else class="space-y-4">
                <!-- Success Message -->
                <div
                    v-if="successMessage"
                    class="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
                >
                    {{ successMessage }}
                </div>

                <!-- Error Message -->
                <div
                    v-if="error"
                    class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                    {{ error }}
                </div>

                <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <div class="space-y-4">
                        <!-- SECTION 1: Descripcion -->
                        <form
                            @submit.prevent="handleSubmit"
                            @keydown.enter="
                                (e: KeyboardEvent) => {
                                    if (
                                        (e.target as HTMLElement)?.tagName ===
                                        'INPUT'
                                    )
                                        e.preventDefault();
                                }
                            "
                            class="space-y-4"
                        >
                            <div
                                id="identidad"
                                class="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                            >
                                <h2
                                    class="text-sm font-semibold tracking-wider text-gray-500 uppercase"
                                >
                                    Identidad y clasificacion
                                </h2>
                                <div
                                    class="grid grid-cols-1 gap-4 md:grid-cols-2"
                                >
                                    <div>
                                        <label
                                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                        >
                                            Descripción
                                            <span class="text-red-500">*</span>
                                        </label>
                                        <div class="mt-1 flex gap-2">
                                            <input
                                                v-model="form.name"
                                                type="text"
                                                required
                                                class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                            />
                                            <button
                                                type="button"
                                                :disabled="regenerating"
                                                @click="handleRegenerateName"
                                                class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-card dark:text-gray-300 dark:hover:bg-muted"
                                                title="Regenerar descripción automática desde categoría + compatibilidad vehicular"
                                            >
                                                <RefreshCw
                                                    class="h-3.5 w-3.5"
                                                    :class="{
                                                        'animate-spin':
                                                            regenerating,
                                                    }"
                                                />
                                                Auto
                                            </button>
                                        </div>
                                        <p
                                            v-if="validationErrors.name"
                                            class="mt-1 text-sm text-red-600"
                                        >
                                            {{ validationErrors.name[0] }}
                                        </p>
                                    </div>
                                    <div>
                                        <label
                                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                            >Categoría</label
                                        >
                                        <SearchableSelect
                                            :options="categoryOptions"
                                            :model-value="selectedCategoryId"
                                            @update:model-value="
                                                (v) =>
                                                    (selectedCategoryId =
                                                        toCategoryId(v))
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
                                            :model-value="
                                                selectedExtraCategoryId
                                            "
                                            @update:model-value="
                                                (v) =>
                                                    (selectedExtraCategoryId =
                                                        toCategoryId(v))
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
                                        v-if="
                                            selectedExtraCategories.length > 0
                                        "
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
                                                    removeExtraCategory(
                                                        category.id,
                                                    )
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

                            <!-- SECTION 2: Código y Estado -->
                            <div
                                id="codigos"
                                class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                            >
                                <h2
                                    class="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase"
                                >
                                    Codigo y estado
                                </h2>
                                <div
                                    class="grid grid-cols-1 gap-4 md:grid-cols-2"
                                >
                                    <div class="md:col-span-2">
                                        <label
                                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                        >
                                            Códigos comerciales
                                            <span
                                                class="text-xs font-normal text-gray-400"
                                                >(opcionales)</span
                                            >
                                        </label>
                                        <ProductCodesEditor
                                            ref="productCodesRef"
                                            v-model="productCodesModel"
                                            :exclude-product-id="
                                                props.productId
                                            "
                                        />
                                        <p
                                            v-if="validationErrors.codes"
                                            class="mt-1 text-sm text-red-600"
                                        >
                                            {{ validationErrors.codes[0] }}
                                        </p>
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
                                            <option value="active">
                                                Activo
                                            </option>
                                            <option value="discontinued">
                                                Discontinuado
                                            </option>
                                            <option value="pending">
                                                Pendiente
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </form>

                        <!-- SECTION 3: Códigos Alternos -->
                        <OemReferenceManager
                            v-model="draftOemReferences"
                            mode="draft"
                            :product-id="props.productId"
                        />

                        <!-- SECTION 4: Compatibilidad Vehicular -->
                        <VehicleCompatSection
                            id="compatibilidad"
                            ref="vehicleCompatRef"
                            v-model="draftCompatibility"
                            mode="draft"
                            :product-id="props.productId"
                            @open-inline="openVehicleInline"
                        />

                        <!-- SECTION 5: Variantes -->
                        <VariantManager
                            id="variantes"
                            :product-id="props.productId"
                            :category-id="
                                selectedCategoryId ??
                                currentProduct?.category_id ??
                                currentProduct?.category?.id
                            "
                            :sku-base="currentProduct?.sku_base || ''"
                            :product-name="currentProduct?.name || ''"
                            :category-formula="categoryFormula"
                            :category-applies-itbm="categoryAppliesItbm"
                            :category-itbm-percent="categoryItbmPercent"
                            :category-margin="categoryMargin"
                            :initial-edit-variant-id="initialEditVariantId"
                        />

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
                            </div>
                            <p
                                class="mb-4 text-sm text-gray-500 dark:text-gray-400"
                            >
                                Agrega o edita atributos del producto a nivel
                                base.
                            </p>
                            <AttributeManager
                                ref="attributeManagerRef"
                                v-model="draftAttributes"
                                mode="draft"
                                :product-id="props.productId"
                            />
                        </div>

                        <!-- SECTION 7: Upsales -->
                        <div
                            id="relaciones"
                            class="rounded-xl border border-l-4 border-gray-100 border-l-violet-500 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                        >
                            <h2
                                class="mb-3 text-sm font-semibold tracking-wider text-gray-500 uppercase"
                            >
                                Upsales
                            </h2>
                            <AlternativeManager
                                v-model="draftAlternatives"
                                mode="draft"
                                :product-id="props.productId"
                            />
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
                            mode="gallery"
                            :product-id="props.productId"
                            :product-name="currentProduct?.name"
                            :category-ids="selectedCategoryIdsForImages"
                            :category-name-map="categoryNameMapForImages"
                        />
                    </div>

                    <aside class="space-y-4 xl:sticky xl:top-16 xl:self-start">
                        <div
                            class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                        >
                            <h2
                                class="text-sm font-semibold tracking-wide text-gray-900 uppercase dark:text-white"
                            >
                                Estado del producto
                            </h2>
                            <div class="mt-4 space-y-3">
                                <div
                                    v-for="item in readinessItems"
                                    :key="item.label"
                                    class="flex items-center justify-between gap-3 text-sm"
                                >
                                    <span
                                        class="text-gray-600 dark:text-gray-300"
                                    >
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
                                    {{
                                        loading
                                            ? 'Guardando...'
                                            : 'Guardar cambios'
                                    }}
                                </button>
                                <button
                                    type="button"
                                    :disabled="duplicating"
                                    @click="handleDuplicate"
                                    class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-card dark:text-white"
                                >
                                    <Copy class="h-4 w-4" />
                                    {{
                                        duplicating
                                            ? 'Duplicando...'
                                            : 'Duplicar'
                                    }}
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

                        <div
                            class="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20"
                        >
                            <h2
                                class="text-sm font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300"
                            >
                                Archivo
                            </h2>
                            <p
                                class="mt-2 text-sm text-amber-700 dark:text-amber-200"
                            >
                                Archivar oculta el producto del Punto de Venta
                                sin afectar facturas historicas.
                            </p>
                            <button
                                type="button"
                                :disabled="archiving"
                                @click="handleArchive"
                                class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800 dark:bg-card dark:text-amber-300 dark:hover:bg-amber-950/40"
                            >
                                <Archive class="h-4 w-4" />
                                {{
                                    archiving
                                        ? 'Archivando...'
                                        : 'Archivar producto'
                                }}
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    </AppLayout>
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
</template>
