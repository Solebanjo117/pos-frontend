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

describe('Products: code section names', () => {
    it('calls the product codes "Números de parte"', () => {
        for (const file of ['Create.vue', 'Edit.vue']) {
            expect(source(file), file).toContain('Números de parte');
        }
        for (const file of [
            'Create.vue',
            'Edit.vue',
            '../../components/Products/VariantManager.vue',
            '../../components/Products/ProductVariantFormModal.vue',
        ]) {
            expect(source(file), file).not.toContain('Códigos comerciales');
        }
    });
});

/*
 * Decisión de Luis (2026-11-13): en la ventana de una marca solo se editan la marca, los precios
 * y poco más. Los códigos son del producto; la marca usa su número de parte.
 */
describe('Products: brand windows do not edit codes', () => {
    it('has no code editor and sends no codes or SKU when saving a brand', () => {
        for (const file of [
            '../../components/Products/VariantManager.vue',
            '../../components/Products/ProductVariantFormModal.vue',
        ]) {
            const component = source(file);
            expect(component, file).not.toContain('<ProductCodesEditor');
            // Las marcas no tienen código propio (2026-11-17): ni se edita ni se muestra.
            expect(component, file).not.toContain('Código de la marca');
            expect(component, file).not.toContain('data-test="brand-code"');
            expect(component, file).not.toContain('codes: form.value.codes');
            expect(component, file).not.toMatch(
                /sku:\s*form\.value\.codes\.find/,
            );
        }
    });
});

describe('Products: the cart shows the product number, not a brand code', () => {
    it('uses the product principal number first', () => {
        const pos = source('../../composables/usePOS.ts');
        const index = source('Index.vue');

        expect(pos).toMatch(
            /product_sku:\s*\(product as any\)\.sku_base \|\| variant\?\.sku/,
        );
        expect(index).toMatch(
            /sku_base:\s*product\.sku_base \|\| variant\.sku/,
        );
    });
});
