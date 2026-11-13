import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Decisión de Luis (2026-11-13): Crear y Editar producto tienen un solo lugar
 * para los códigos ("Código y estado", con el principal). "Códigos alternos"
 * (código + marca) repetía eso y lo de las Variantes, así que no se muestra.
 * Editar tampoco envía `oem_references`, para no tocar las ya guardadas.
 */
const source = (file: string) => readFileSync(resolve(__dirname, file), 'utf8');

describe('Products: one place for codes on create and edit', () => {
    for (const file of ['Create.vue', 'Edit.vue']) {
        it(`${file} has no "Códigos alternos" section`, () => {
            const page = source(file);

            expect(page).not.toMatch(/C[oó]digos alternos/i);
            expect(page).not.toContain('OemReferenceManager');
            expect(page).not.toContain('/oem-references');
        });
    }

    it('Edit.vue does not send oem_references, so saved ones are kept', () => {
        expect(source('Edit.vue')).not.toContain('oem_references');
    });
});

describe('Products: no alternate_code column', () => {
    it('reads extra codes from product codes, not from products.alternate_code', () => {
        for (const file of [
            'Create.vue',
            'Edit.vue',
            '../../types/product.ts',
            '../../components/Products/ProductCatalogView.vue',
        ]) {
            expect(source(file), file).not.toContain('alternate_code');
        }
    });
});
