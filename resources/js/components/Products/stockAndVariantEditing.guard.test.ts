import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Guardias de dos decisiones de Productos:
 * - Editar una marca desde la lista abre el modal ahí mismo (no navega a la página del producto).
 * - La existencia nunca se cambia escribiendo el número: solo con "Ajustar" (movimiento con motivo).
 */
const jsDir = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(jsDir, path), 'utf8');

describe('Products: variant editing and stock adjustments', () => {
    it('edits a brand from the products list in a modal, without leaving the page', () => {
        const index = source('pages/Products/Index.vue');

        expect(index).not.toContain('/edit?variant=');
        expect(index).toContain('<ProductVariantFormModal');
        expect(index).toContain('openVariantEdit(');
    });

    it('never adjusts stock by typing the quantity in the variants table or the variant modal', () => {
        for (const path of [
            'components/Products/VariantManager.vue',
            'components/Products/ProductVariantFormModal.vue',
        ]) {
            const file = source(path);
            expect(file, path).not.toContain('updateVariantStock');
            expect(file, path).not.toContain('onStockBlur');
            expect(file, path).toContain('<StockAdjustModal');
        }
    });
});
