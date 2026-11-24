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

/*
 * 2026-11-18: las "referencias OEM" eran otra lista de números de la pieza. Se pasaron a los números
 * de parte del producto y la tabla se eliminó.
 */
describe('Products: no OEM references', () => {
    it('shows the part numbers on the product page and never calls the old OEM endpoints', () => {
        expect(source('Show.vue')).toContain('Números de parte');
        for (const file of [
            'Show.vue',
            'Index.vue',
            '../../components/Products/ProductDetailModal.vue',
            '../../services/api/products.ts',
            '../../types/product.ts',
        ]) {
            const text = source(file);
            expect(text, file).not.toContain('oem-references');
            expect(text, file).not.toContain('oem_references');
            expect(text, file).not.toContain('oem_code');
        }
    });
});

/*
 * 2026-11-18: el menú de Inventario no repite los botones de Productos. Crear e importar se hacen
 * desde Productos, y esos botones solo se muestran a quien puede usarlos (igual que el backend).
 */
describe('Products: create and import only from the products page, by role', () => {
    it('has no "new product" or "import products" shortcut in the inventory menu', () => {
        const menu = source('../../navigation/modules.ts');

        expect(menu).not.toContain("href: '/inventory/products/create'");
        expect(menu).not.toContain("href: '/inventory/products/import'");
        expect(menu).toContain("href: '/inventory/products'");
    });

    it('shows the create button to purchasing roles and the import button to admin or manager', () => {
        const index = source('Index.vue');

        expect(index).toMatch(
            /v-if="canManageProducts"\s*href="\/inventory\/products\/create"/,
        );
        expect(index).toMatch(
            /v-if="canImportProducts"\s*href="\/inventory\/products\/import"/,
        );
        expect(index).toMatch(
            /canImportProducts = computed\(\(\) =>\s*canManageCatalog\(/,
        );
    });
});

/*
 * 2026-11-18: al crear una marca (en Crear producto o una marca nueva) también se indican sus
 * proveedores y de qué proveedor vino el stock inicial; se guardan junto con la marca.
 */
describe('Products: suppliers when creating a brand', () => {
    it('shows the suppliers section and the initial stock supplier for new brands, and sends them', () => {
        const manager = source('../../components/Products/VariantManager.vue');

        expect(manager).toContain('data-test="draft-variant-suppliers"');
        expect(manager).toContain(
            '<VariantSuppliersPanel draft v-model="form.suppliers" />',
        );
        expect(manager).toContain('data-test="initial-stock-supplier"');
        expect(manager).toContain(
            'draftSuppliersPayload(form.value.suppliers)',
        );
        expect(source('Create.vue')).toMatch(
            /suppliers:\s*draftSuppliersPayload\(\s*variant\.suppliers \?\? \[\],?\s*\)/,
        );
    });
});

/*
 * Pedido de Luis (2026-11-24): al guardar un producto debe salir un solo aviso (el flotante de
 * arriba), no además una barra dentro de la página.
 */
describe('Products: one success message when saving', () => {
    it('Edit.vue uses only the toast', () => {
        const page = source('Edit.vue');
        expect(page).toContain(
            "toast.success('Producto actualizado exitosamente')",
        );
        expect(page).not.toContain('successMessage');
    });
});
