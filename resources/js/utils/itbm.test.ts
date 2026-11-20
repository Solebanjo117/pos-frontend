import { describe, expect, it } from 'vitest';
import { itbmChoiceFromRate, itbmRateFromChoice } from './itbm';

describe('itbm', () => {
    it('muestra Sí cuando la variante tiene tasa y No cuando es 0 o no tiene', () => {
        expect(itbmChoiceFromRate(7)).toBe('yes');
        expect(itbmChoiceFromRate('10')).toBe('yes');
        expect(itbmChoiceFromRate(0)).toBe('no');
        expect(itbmChoiceFromRate('0.2')).toBe('no');
        expect(itbmChoiceFromRate(null)).toBe('no');
        expect(itbmChoiceFromRate(undefined)).toBe('no');
        expect(itbmChoiceFromRate('abc')).toBe('no');
    });

    it('guarda la tasa de la tienda con Sí y 0 con No', () => {
        expect(itbmRateFromChoice('yes', 7)).toBe(7);
        expect(itbmRateFromChoice('yes', 10)).toBe(10);
        expect(itbmRateFromChoice('no', 7)).toBe(0);
    });

    it('una tasa antigua distinta se normaliza a la de la tienda al guardar', () => {
        expect(itbmRateFromChoice(itbmChoiceFromRate(10), 7)).toBe(7);
    });
});
