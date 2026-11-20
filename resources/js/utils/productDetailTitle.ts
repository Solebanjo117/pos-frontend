/**
 * Título del detalle de producto: categoría y carro por defecto (el primero compatible),
 * por ejemplo "Filtro de aceite · Toyota Corolla E110 1995-2002".
 * Si no hay categoría ni carro, se usa el nombre del producto.
 */
export const productDetailTitle = (input: {
    categoryName?: string | null;
    defaultVehicle?: string | null;
    isUniversal?: boolean;
    productName?: string | null;
}): string => {
    const category = input.categoryName?.trim() || '';
    // Un producto universal no tiene un carro por defecto (ya lleva la etiqueta "Universal").
    const vehicle = input.isUniversal ? '' : input.defaultVehicle?.trim() || '';
    const title = [category, vehicle].filter(Boolean).join(' · ');

    return title || input.productName?.trim() || 'Producto';
};
