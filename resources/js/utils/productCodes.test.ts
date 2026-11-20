import { describe, expect, it } from 'vitest';
import { codesForEditing } from './productCodes';

describe('codesForEditing', () => {
    it('uses the saved codes when there are any', () => {
        const saved = [
            { id: 1, code: 'A-1', type: 'sku' as const, is_primary: true },
        ];
        const result = codesForEditing(saved, 'REP-0001');
        expect(result).toEqual(saved);
        expect(result[0]).not.toBe(saved[0]);
    });

    it('builds the list from SKU and UPC when the product has no codes yet (empty list)', () => {
        expect(codesForEditing([], 'REP-0001', '7501234567890')).toEqual([
            { code: 'REP-0001', type: 'sku', is_primary: true },
            { code: '7501234567890', type: 'upc', is_primary: false },
        ]);
        expect(codesForEditing(undefined, 'REP-0001')).toEqual([
            { code: 'REP-0001', type: 'sku', is_primary: true },
        ]);
    });

    it('makes the UPC primary when there is no SKU, and returns nothing without codes', () => {
        expect(codesForEditing([], null, '123')).toEqual([
            { code: '123', type: 'upc', is_primary: true },
        ]);
        expect(codesForEditing([], ' ', '')).toEqual([]);
    });
});
