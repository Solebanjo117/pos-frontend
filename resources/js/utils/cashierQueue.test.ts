import { describe, expect, it } from 'vitest';
import { QUEUE_ENTRY_TYPE, queueEntryKind } from './cashierQueue';

describe('queueEntryKind', () => {
    it('maps backend wire values to semantic kinds', () => {
        expect(queueEntryKind(QUEUE_ENTRY_TYPE.sale)).toBe('sale');
        expect(queueEntryKind(QUEUE_ENTRY_TYPE.expense)).toBe('expense');
        expect(queueEntryKind(QUEUE_ENTRY_TYPE.return)).toBe('return');
    });

    it('maps raw wire strings exactly as the backend serializes them', () => {
        expect(queueEntryKind('sale_collection')).toBe('sale');
        expect(queueEntryKind('expense_payment')).toBe('expense');
        expect(queueEntryKind('sales_return_refund')).toBe('return');
    });

    it('rejects legacy short labels that never arrive from the backend', () => {
        expect(queueEntryKind('sale')).toBeNull();
        expect(queueEntryKind('expense')).toBeNull();
        expect(queueEntryKind('return')).toBeNull();
    });

    it('returns null for unknown or missing values', () => {
        expect(queueEntryKind('something_else')).toBeNull();
        expect(queueEntryKind(null)).toBeNull();
        expect(queueEntryKind(undefined)).toBeNull();
        expect(queueEntryKind('')).toBeNull();
    });
});
