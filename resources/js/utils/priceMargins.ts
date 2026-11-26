/**
 * Markup y margen de un precio de venta, como el recuadro "Pricing" de Lightspeed.
 *
 * - Markup = ganancia / costo (costo 1, precio 3 → 200 %).
 * - Margen = ganancia / precio (costo 1, precio 3 → 66.7 %).
 *
 * El precio es el de venta sin ITBM. El costo es el "Costo Total" de HermeX (base + ITBM de
 * costo + misceláneos); el costo de un proveedor se lleva a esa misma base con el ITBM de costo
 * y los misceláneos de la marca, para que se pueda comparar con el del lote.
 */

export type MarginCostSource = 'lot' | 'cheapest' | 'most_expensive';

export const MARGIN_COST_SOURCES: { value: MarginCostSource; label: string }[] =
    [
        { value: 'lot', label: 'Lote actual' },
        { value: 'cheapest', label: 'Proveedor más barato' },
        { value: 'most_expensive', label: 'Proveedor más caro' },
    ];

/** Decisión del jefe (2026-11-26): por defecto, el proveedor más barato. */
export const DEFAULT_MARGIN_COST_SOURCE: MarginCostSource = 'cheapest';

const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Ganancia sobre el costo, en %. `null` si no hay costo (no se puede dividir). */
export const markupPercent = (price: number, cost: number): number | null =>
    cost > 0 ? round1(((price - cost) / cost) * 100) : null;

/** Ganancia sobre el precio, en %. `null` si no hay precio. */
export const marginPercent = (price: number, cost: number): number | null =>
    price > 0 ? round1(((price - cost) / price) * 100) : null;

export const formatPercent = (value: number | null): string =>
    value === null ? '—' : `${value.toFixed(1)}%`;

export interface MarginSupplier {
    supplier_name?: string | null;
    name?: string | null;
    supplier_cost: number | string | null;
}

export interface MarginCostInput {
    /** Costo Total de la marca (respaldo cuando la fuente elegida no tiene dato). */
    brandCost: number;
    /** ITBM de costo de la marca, en % (0 si no aplica). */
    costTaxRate: number;
    /** Misceláneos por unidad de la marca. */
    costMiscellaneous: number;
    /** Costo del lote activo (FIFO) o `null` si no hay existencia. */
    lotCost: number | null;
    suppliers: MarginSupplier[];
}

export interface ResolvedMarginCost {
    cost: number;
    /** De dónde salió el costo, para mostrarlo debajo de la tabla. */
    detail: string;
    /** true si la fuente elegida no tenía dato y se usó el Costo Total de la marca. */
    fallback: boolean;
}

/** Costo del proveedor llevado a la base del Costo Total (ITBM de costo + misceláneos). */
export const supplierLandedCost = (
    supplierCost: number,
    costTaxRate: number,
    costMiscellaneous: number,
): number =>
    Math.round(
        (supplierCost * (1 + costTaxRate / 100) + costMiscellaneous) * 100,
    ) / 100;

const money = (value: number): string => `$${value.toFixed(2)}`;

export const resolveMarginCost = (
    source: MarginCostSource,
    input: MarginCostInput,
): ResolvedMarginCost => {
    const brandCost = toNumber(input.brandCost);
    const fallback = (reason: string): ResolvedMarginCost => ({
        cost: brandCost,
        detail: `${reason}: se usa el costo de la marca (${money(brandCost)}).`,
        fallback: true,
    });

    if (source === 'lot') {
        if (input.lotCost === null || input.lotCost === undefined) {
            return fallback('Sin existencia');
        }
        const lotCost = toNumber(input.lotCost);
        return {
            cost: lotCost,
            detail: `Costo del lote actual (${money(lotCost)}).`,
            fallback: false,
        };
    }

    const withCost = input.suppliers.filter(
        (supplier) => toNumber(supplier.supplier_cost) > 0,
    );
    if (withCost.length === 0) {
        return fallback('Sin proveedores con costo');
    }

    const sorted = [...withCost].sort(
        (a, b) => toNumber(a.supplier_cost) - toNumber(b.supplier_cost),
    );
    const chosen =
        source === 'cheapest' ? sorted[0] : sorted[sorted.length - 1];
    const cost = supplierLandedCost(
        toNumber(chosen.supplier_cost),
        toNumber(input.costTaxRate),
        toNumber(input.costMiscellaneous),
    );
    const name = chosen.supplier_name ?? chosen.name ?? 'Proveedor';

    return {
        cost,
        detail: `${name}: ${money(toNumber(chosen.supplier_cost))} + ITBM y misceláneos = ${money(cost)}.`,
        fallback: false,
    };
};

/**
 * Datos de costo de una marca tal como llegan de `/products/{id}/variants`:
 * `pricing` (Costo Total, ITBM de costo, misceláneos), `inventory[].current_cost` del lote
 * activo y `suppliers[].supplier_cost`.
 */
export const marginCostInputFromVariant = (
    variant: any,
    warehouseId?: number | null,
): MarginCostInput => {
    const pricing = variant?.pricing ?? {};
    const inventory: any[] = variant?.inventory ?? [];
    const row =
        inventory.find(
            (item) => (item.warehouse?.id ?? item.warehouse_id) === warehouseId,
        ) ?? inventory[0];
    const hasActiveLot = Boolean(row?.active_lot_id);

    return {
        brandCost: toNumber(pricing.cost_total ?? pricing.cost),
        costTaxRate: toNumber(
            pricing.cost_tax_rate ?? pricing.sale_tax_rate ?? pricing.tax_rate,
        ),
        costMiscellaneous: toNumber(pricing.cost_miscellaneous),
        lotCost: hasActiveLot ? toNumber(row.current_cost) : null,
        suppliers: (variant?.suppliers ?? []).map((supplier: any) => ({
            supplier_name: supplier.supplier_name ?? supplier.name ?? null,
            supplier_cost: supplier.supplier_cost,
        })),
    };
};
