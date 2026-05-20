import type {
    ProductVehicleCompatibilityPayload,
    ProductAttributeType,
} from '@/types/product';

type RefLike<T> = { value: T };

const isRefLike = <T = unknown>(value: unknown): value is RefLike<T> =>
    value !== null && typeof value === 'object' && 'value' in value;

type NormalizedProductAttribute = {
    name: string;
    value: string | string[];
    unit?: string;
    source: 'category' | 'custom';
    source_category_id: number | null;
    type?: ProductAttributeType;
    options?: string[];
};

export const toPositiveInt = (value: unknown): number | null => {
    const candidate = isRefLike(value) ? value.value : value;

    if (candidate === null || candidate === undefined || candidate === '') {
        return null;
    }

    const numberValue = Number(candidate);

    return Number.isInteger(numberValue) && numberValue > 0
        ? numberValue
        : null;
};

export const toNonNegativeNumber = (value: unknown, fallback = 0): number => {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) && numberValue >= 0
        ? numberValue
        : fallback;
};

export const normalizeIdArray = (values: unknown): number[] => {
    if (!Array.isArray(values)) {
        return [];
    }

    return [...new Set(values.map(toPositiveInt).filter(Boolean))] as number[];
};

const normalizeAttributeValue = (value: unknown): string | string[] | null => {
    if (Array.isArray(value)) {
        const options = value
            .map((item) => String(item ?? '').trim())
            .filter((item) => item !== '');

        return options.length > 0 ? options : null;
    }

    const text = String(value ?? '').trim();

    return text !== '' ? text : null;
};

export const normalizeProductAttributesPayload = <
    T extends {
        name?: unknown;
        value?: unknown;
        unit?: unknown;
        source?: unknown;
        fromCategory?: unknown;
        source_category_id?: unknown;
        type?: unknown;
        options?: unknown;
    },
>(
    attributes: T[],
): NormalizedProductAttribute[] =>
    attributes
        .map((attribute): NormalizedProductAttribute | null => {
            const name = String(attribute.name ?? '').trim();
            const value = normalizeAttributeValue(attribute.value);

            if (!name || value === null) {
                return null;
            }

            const source =
                attribute.source === 'category' ||
                attribute.fromCategory === true
                    ? ('category' as const)
                    : ('custom' as const);
            const sourceCategoryId =
                source === 'category'
                    ? toPositiveInt(attribute.source_category_id)
                    : null;
            const unit = String(attribute.unit ?? '').trim();
            const type =
                attribute.type === 'select'
                    ? ('select' as ProductAttributeType)
                    : undefined;
            const options = Array.isArray(attribute.options)
                ? attribute.options
                      .map((option) => String(option ?? '').trim())
                      .filter((option) => option !== '')
                : undefined;

            return {
                name,
                value,
                source,
                source_category_id: sourceCategoryId,
                ...(unit ? { unit } : {}),
                ...(type ? { type } : {}),
                ...(options && options.length > 0 ? { options } : {}),
            };
        })
        .filter(
            (attribute): attribute is NormalizedProductAttribute =>
                attribute !== null,
        );

export const normalizeVehicleCompatibilityPayload = (
    compatibility: {
        engines?: Array<{ engine_id?: unknown }>;
        chassis?: Array<{ chassis_id?: unknown }>;
        allEngines?: unknown;
        allChassis?: unknown;
        all_engines?: unknown;
        all_chassis?: unknown;
        modelId?: unknown;
        model_id?: unknown;
    },
    exposedModelId?: unknown,
): ProductVehicleCompatibilityPayload => {
    const modelId =
        toPositiveInt(exposedModelId) ??
        toPositiveInt(compatibility.modelId) ??
        toPositiveInt(compatibility.model_id);

    return {
        engines: normalizeIdArray(
            compatibility.engines?.map((engine) => engine.engine_id),
        ).map((engineId) => ({ engine_id: engineId })),
        chassis: normalizeIdArray(
            compatibility.chassis?.map((chassis) => chassis.chassis_id),
        ).map((chassisId) => ({ chassis_id: chassisId })),
        all_engines: Boolean(
            compatibility.allEngines ?? compatibility.all_engines,
        ),
        all_chassis: Boolean(
            compatibility.allChassis ?? compatibility.all_chassis,
        ),
        ...(modelId ? { model_id: modelId } : {}),
    };
};

export const normalizePricingPayload = (
    pricing: Record<string, unknown>,
    fallbackTaxRate: number,
) => {
    const saleTaxRate = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                Number(
                    pricing.sale_tax_rate ??
                        pricing.tax_rate ??
                        fallbackTaxRate,
                ),
            ),
        ),
    );
    const costTaxRate = Math.max(
        0,
        Math.min(100, Math.round(Number(pricing.cost_tax_rate ?? saleTaxRate))),
    );

    return {
        ...pricing,
        base_price: toNonNegativeNumber(pricing.base_price),
        msrp: toNonNegativeNumber(pricing.msrp),
        cost: toNonNegativeNumber(pricing.cost),
        tax_rate: saleTaxRate,
        sale_tax_rate: saleTaxRate,
        cost_tax_rate: costTaxRate,
    };
};

export const normalizeInitialInventoryPayload = (inventory: unknown) => {
    if (!Array.isArray(inventory)) {
        return [];
    }

    return inventory
        .map((item) => {
            const warehouseId = toPositiveInt(item?.warehouse_id);

            if (!warehouseId) {
                return null;
            }

            return {
                warehouse_id: warehouseId,
                stock_available: Math.max(
                    0,
                    Math.trunc(Number(item?.stock_available ?? 0) || 0),
                ),
                reorder_point: Math.max(
                    0,
                    Math.trunc(Number(item?.reorder_point ?? 0) || 0),
                ),
                reorder_quantity: Math.max(
                    0,
                    Math.trunc(Number(item?.reorder_quantity ?? 0) || 0),
                ),
            };
        })
        .filter(Boolean) as Array<{
        warehouse_id: number;
        stock_available: number;
        reorder_point: number;
        reorder_quantity: number;
    }>;
};

export const normalizeOemReferencesPayload = <
    T extends { oem_code?: unknown; manufacturer?: unknown },
>(
    references: T[],
) =>
    references
        .map((reference) => ({
            oem_code: String(reference.oem_code ?? '').trim(),
            manufacturer: String(reference.manufacturer ?? '').trim() || null,
        }))
        .filter((reference) => reference.oem_code !== '');

export const normalizeAlternativesPayload = <
    T extends {
        id?: unknown;
        alternative_product_id?: unknown;
        relationship_type?: unknown;
    },
>(
    alternatives: T[],
) =>
    alternatives
        .map((alternative) => {
            const alternativeProductId =
                toPositiveInt(alternative.alternative_product_id) ??
                toPositiveInt(alternative.id);
            const relationshipType = [
                'compatible',
                'substitute',
                'upgrade',
            ].includes(String(alternative.relationship_type))
                ? (alternative.relationship_type as
                      | 'compatible'
                      | 'substitute'
                      | 'upgrade')
                : 'compatible';

            return alternativeProductId
                ? {
                      alternative_product_id: alternativeProductId,
                      relationship_type: relationshipType,
                  }
                : null;
        })
        .filter(Boolean) as Array<{
        alternative_product_id: number;
        relationship_type: 'compatible' | 'substitute' | 'upgrade';
    }>;
