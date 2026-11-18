import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * 2026-11-18: las marcas de un proveedor conviven "por sus piezas" (calculado) y "marcadas a mano".
 * Solo las marcadas a mano se quitan desde la ficha del proveedor.
 */
const jsDir = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(jsDir, path), 'utf8');

describe('Suppliers: brands by pieces and by hand', () => {
    it('shows where each brand comes from and only lets hand-marked brands be removed', () => {
        const page = source('pages/Suppliers/Show.vue');

        expect(page).toContain('data-test="supplier-brand-origin"');
        expect(page).toContain("'· marcada a mano'");
        expect(page).toMatch(
            /v-if="\(brand\.pieces \?\? 0\) === 0"[\s\S]{0,400}removeBrand\(brand\.id\)/,
        );
    });
});
