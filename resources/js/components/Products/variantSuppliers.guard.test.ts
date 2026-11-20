import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Decisión del jefe (2026-11-17): cada marca tiene sus proveedores (con su código y el costo de la
 * última compra); el más barato es el proveedor por defecto y lo calcula el sistema; cada lote
 * muestra su proveedor y los que no tienen se pueden cargar a mano.
 */
const jsDir = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(jsDir, path), 'utf8');

describe('Products: suppliers of each brand', () => {
    it('shows the suppliers section in both brand windows', () => {
        for (const path of [
            'components/Products/VariantManager.vue',
            'components/Products/ProductVariantFormModal.vue',
        ]) {
            expect(source(path), path).toContain('<VariantSuppliersPanel');
        }
    });

    it('shows the supplier of each lot and lets lots without purchase get one', () => {
        const panel = source('components/Products/VariantFifoHistoryPanel.vue');

        expect(panel).toContain('data-test="lot-supplier"');
        expect(panel).toContain('lot.supplier_editable');
        expect(panel).toContain('assignLotSupplier(');
    });

    it('does not let anyone mark the preferred supplier by hand: it is the cheapest', () => {
        const supplierPage = source('pages/Suppliers/Show.vue');

        expect(supplierPage).not.toMatch(
            /\.is_preferred\s*"\s*type="checkbox"/,
        );
        expect(supplierPage).toContain('Más barato');
    });
});
