import { describe, expect, it } from 'vitest';
import { productDetailTitle } from './productDetailTitle';

describe('productDetailTitle', () => {
    it('usa la categoría y el carro por defecto', () => {
        expect(
            productDetailTitle({
                categoryName: 'Filtro de aceite',
                defaultVehicle: 'TOYOTA COROLLA E110 1995-2002',
                productName: 'Filtro de aceite largo',
            }),
        ).toBe('Filtro de aceite · TOYOTA COROLLA E110 1995-2002');
    });

    it('muestra solo lo que exista', () => {
        expect(
            productDetailTitle({ categoryName: 'Bujías', productName: 'X' }),
        ).toBe('Bujías');
        expect(
            productDetailTitle({
                defaultVehicle: 'NISSAN SENTRA',
                productName: 'X',
            }),
        ).toBe('NISSAN SENTRA');
    });

    it('no pone carro si el producto es universal', () => {
        expect(
            productDetailTitle({
                categoryName: 'Aceite',
                defaultVehicle: 'TOYOTA HILUX',
                isUniversal: true,
            }),
        ).toBe('Aceite');
    });

    it('usa el nombre del producto si no hay categoría ni carro', () => {
        expect(
            productDetailTitle({ categoryName: ' ', productName: 'Pastilla' }),
        ).toBe('Pastilla');
        expect(productDetailTitle({})).toBe('Producto');
    });
});
