import type { ProductCode } from '@/types/product';

/**
 * Códigos para el editor de un producto o variante.
 *
 * Si ya tiene códigos guardados, se usan tal cual (copiados). Si no tiene ninguno (los productos
 * cargados antes del editor de códigos solo tienen SKU/UPC), se arma la lista con el SKU como
 * código principal y el UPC si existe. Así el editor muestra el código actual y, al guardar,
 * no se pierden el SKU ni el UPC.
 *
 * Ojo: una lista vacía ([]) cuenta como "sin códigos" (antes solo se miraba null/undefined).
 */
export const codesForEditing = (
    codes: ProductCode[] | null | undefined,
    sku?: string | null,
    upc?: string | null,
): ProductCode[] => {
    if (codes && codes.length > 0) {
        return codes.map((code) => ({ ...code }));
    }

    const fallback: ProductCode[] = [];
    const skuCode = sku?.trim();
    const upcCode = upc?.trim();
    if (skuCode) {
        fallback.push({ code: skuCode, type: 'sku', is_primary: true });
    }
    if (upcCode && upcCode !== skuCode) {
        fallback.push({
            code: upcCode,
            type: 'upc',
            is_primary: fallback.length === 0,
        });
    }
    return fallback;
};
