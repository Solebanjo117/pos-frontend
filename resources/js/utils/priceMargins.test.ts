import { describe, expect, it } from 'vitest';
import {
    DEFAULT_MARGIN_COST_SOURCE,
    MARGIN_COST_SOURCES,
    formatPercent,
    marginCostInputFromVariant,
    marginPercent,
    markupPercent,
    resolveMarginCost,
} from './priceMargins';
import type { MarginCostInput } from './priceMargins';

describe('markup and margin', () => {
    // Mismos números que la captura de Lightspeed que mandó el jefe (costo $1.00).
    it('matches the Lightspeed example', () => {
        expect(markupPercent(3, 1)).toBe(200);
        expect(marginPercent(3, 1)).toBe(66.7);
        expect(markupPercent(2, 1)).toBe(100);
        expect(marginPercent(2, 1)).toBe(50);
        expect(markupPercent(0, 1)).toBe(-100);
        expect(marginPercent(0, 1)).toBeNull();
    });

    it('has no markup without cost', () => {
        expect(markupPercent(5, 0)).toBeNull();
        expect(formatPercent(null)).toBe('—');
        expect(formatPercent(66.666)).toBe('66.7%');
    });
});

describe('cost used for the margins', () => {
    const input: MarginCostInput = {
        brandCost: 12,
        costTaxRate: 7,
        costMiscellaneous: 0.5,
        lotCost: 11.2,
        suppliers: [
            { supplier_name: 'CARO', supplier_cost: 12 },
            { supplier_name: 'BARATO', supplier_cost: 10 },
            { supplier_name: 'SIN COSTO', supplier_cost: 0 },
        ],
    };

    it('offers lot, cheapest and most expensive, cheapest by default', () => {
        expect(MARGIN_COST_SOURCES.map((option) => option.label)).toEqual([
            'Lote actual',
            'Proveedor más barato',
            'Proveedor más caro',
        ]);
        expect(DEFAULT_MARGIN_COST_SOURCE).toBe('cheapest');
    });

    it('uses the active lot cost', () => {
        expect(resolveMarginCost('lot', input)).toMatchObject({
            cost: 11.2,
            fallback: false,
        });
    });

    it('takes suppliers with cost to the same base as Costo Total', () => {
        // 10 × 1.07 + 0.50 = 11.20 ; 12 × 1.07 + 0.50 = 13.34
        expect(resolveMarginCost('cheapest', input)).toMatchObject({
            cost: 11.2,
            fallback: false,
        });
        expect(resolveMarginCost('cheapest', input).detail).toContain('BARATO');
        expect(resolveMarginCost('most_expensive', input)).toMatchObject({
            cost: 13.34,
            fallback: false,
        });
    });

    it('falls back to the brand cost when the source has no data', () => {
        const empty = { ...input, lotCost: null, suppliers: [] };

        expect(resolveMarginCost('lot', empty)).toMatchObject({
            cost: 12,
            fallback: true,
        });
        expect(resolveMarginCost('cheapest', empty).detail).toContain(
            'Sin proveedores con costo',
        );
    });

    it('reads the variant as the API returns it', () => {
        const variant = {
            pricing: {
                cost_total: 9.5,
                cost_tax_rate: 7,
                cost_miscellaneous: 0,
            },
            inventory: [
                {
                    warehouse: { id: 1 },
                    active_lot_id: 33,
                    current_cost: 8.75,
                },
            ],
            suppliers: [{ name: 'ACME', supplier_cost: 8 }],
        };

        expect(marginCostInputFromVariant(variant, 1)).toEqual({
            brandCost: 9.5,
            costTaxRate: 7,
            costMiscellaneous: 0,
            lotCost: 8.75,
            suppliers: [{ supplier_name: 'ACME', supplier_cost: 8 }],
        });
        expect(
            marginCostInputFromVariant(
                {
                    ...variant,
                    inventory: [{ warehouse: { id: 1 }, active_lot_id: null }],
                },
                1,
            ).lotCost,
        ).toBeNull();
    });
});
