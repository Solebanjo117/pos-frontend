import { describe, expect, it } from 'vitest';
import { purchaseReceiptSignature } from './purchaseReceipt';

describe('purchaseReceiptSignature', () => {
    it('normalizes item order and numeric values for safe retries', () => {
        const first = purchaseReceiptSignature([
            { item_id: 2, quantity_received: 3, batch_number: ' L-2 ' },
            { item_id: 1, quantity_received: 5 },
        ]);
        const retry = purchaseReceiptSignature([
            { item_id: 1, quantity_received: 5 },
            { item_id: 2, quantity_received: 3, batch_number: 'L-2' },
        ]);

        expect(retry).toBe(first);
    });

    it('changes when the receipt payload changes', () => {
        expect(
            purchaseReceiptSignature([{ item_id: 1, quantity_received: 5 }]),
        ).not.toBe(
            purchaseReceiptSignature([{ item_id: 1, quantity_received: 6 }]),
        );
    });
});
