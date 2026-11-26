import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Pedido del jefe (2026-11-26), a partir del "Pricing" de Lightspeed: ver markup y margen de los
 * precios de venta. En HermeX el precio y el costo son de cada marca, así que se ven en la ventana
 * de cada marca (las dos que existen) y por marca en la tabla de Editar producto, con el costo
 * elegido en un selector (lote actual, proveedor más barato o más caro; por defecto el más barato).
 */
const source = (file: string) => readFileSync(resolve(__dirname, file), 'utf8');

describe('Markup and margin of each brand', () => {
    it('both brand windows show the margin table', () => {
        for (const file of [
            'ProductVariantFormModal.vue',
            'VariantManager.vue',
        ]) {
            expect(source(file), file).toMatch(/<PriceMarginTable\s/);
        }
    });

    it('the brands table of Edit product has Markup and Margen per brand', () => {
        const manager = source('VariantManager.vue');

        expect(manager).toMatch(/>\s*Markup\s*</);
        expect(manager).toMatch(/>\s*Margen\s*</);
        expect(manager).toContain('data-test="variant-markup"');
        expect(manager).toContain('data-test="variant-margin"');
        expect(manager).toContain('data-test="variants-margin-cost-source"');
        // Precio sin ITBM, igual que en la ventana de la marca.
        expect(manager).toContain(
            'const price = getVariantSaleAmount(variant, false);',
        );
    });
});
