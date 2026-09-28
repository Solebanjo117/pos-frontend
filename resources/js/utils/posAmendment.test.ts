import { describe, expect, it } from 'vitest';
import {
    createSalesOrderAmendmentKeyResolver,
    previewSalesOrderAmendment,
    type AmendmentCartItem,
    type AmendmentOrder,
} from './posAmendment';

const order: AmendmentOrder = {
    id: 73,
    total: '99.00',
    items: [
        {
            id: 12,
            product_id: 5,
            variant_id: 9,
            warehouse_id: 2,
            quantity: 1,
            unit_price: '100.00',
            discount_amount: '10.00',
            discount_percent: '10',
            tax_percent: '10',
            total: '99.00',
            seller_id: 4,
        },
    ],
};

const originalCartLine: AmendmentCartItem = {
    order_item_id: 12,
    product_id: 5,
    variant_id: 9,
    warehouse_id: 2,
    quantity: 2,
    product_price: 999,
    discount_amount: 50,
    discount_percent: 50,
    tax_percent: 0,
    seller_id: 88,
};

describe('POS transaction amendment', () => {
    it('uses the original line ID, price, absolute discount and tax when quantity increases', () => {
        const preview = previewSalesOrderAmendment(
            order,
            [originalCartLine],
            2,
        );

        expect(preview.difference).toBe(110);
        expect(preview.items).toEqual([
            expect.objectContaining({
                order_item_id: 12,
                product_id: 5,
                variant_id: 9,
                qty: 2,
                price: 100,
                discount_amount: 10,
                tax_percent: 10,
                seller_id: 4,
            }),
        ]);
    });

    it('adds new lines with their exact fixed discount and taxes', () => {
        const preview = previewSalesOrderAmendment(
            order,
            [
                { ...originalCartLine, quantity: 1 },
                {
                    product_id: 8,
                    variant_id: null,
                    warehouse_id: 2,
                    quantity: 1,
                    product_price: 50,
                    discount_amount: 5,
                    discount_percent: 10,
                    tax_percent: 10,
                },
            ],
            2,
        );

        expect(preview.difference).toBe(49.5);
        expect(preview.items).toEqual([
            expect.objectContaining({
                product_id: 8,
                qty: 1,
                price: 50,
                discount_amount: 5,
                tax_percent: 10,
            }),
        ]);
    });

    it('keeps panel payment references and account IDs with a stable retry key', () => {
        const preview = previewSalesOrderAmendment(
            order,
            [originalCartLine],
            2,
        );
        const resolve = createSalesOrderAmendmentKeyResolver();
        const payments = [
            {
                method: 'transfer',
                amount: 100,
                reference_number: 'BANCO-123',
                financial_account_id: 41,
                notes: 'Referencia recibida',
            },
            { method: 'cash', amount: 10 },
        ];

        const first = resolve(preview, payments);
        const retry = resolve(preview, payments);
        const changed = resolve(preview, [
            { ...payments[0], reference_number: 'BANCO-124' },
            payments[1],
        ]);
        const increasedPreview = previewSalesOrderAmendment(
            order,
            [{ ...originalCartLine, quantity: 3 }],
            2,
        );
        const increased = resolve(increasedPreview, [
            { method: 'cash', amount: 220 },
        ]);

        expect(first).toMatchObject({
            expected_total: 99,
            warehouse_id: 2,
            payment: [
                expect.objectContaining({
                    method: 'transfer',
                    amount: 100,
                    reference_number: 'BANCO-123',
                    financial_account_id: 41,
                    notes: 'Referencia recibida',
                }),
                expect.objectContaining({ method: 'cash', amount: 10 }),
            ],
        });
        expect(retry.idempotency_key).toBe(first.idempotency_key);
        expect(changed.idempotency_key).not.toBe(first.idempotency_key);
        expect(increased.idempotency_key).not.toBe(first.idempotency_key);
        expect(() =>
            resolve(preview, [{ method: 'cash', amount: 109 }]),
        ).toThrow('exactamente la diferencia');
    });

    it('rejects reductions, removal of original items and cross-warehouse lines', () => {
        expect(() =>
            previewSalesOrderAmendment(
                order,
                [{ ...originalCartLine, quantity: 0 }],
                2,
            ),
        ).toThrow();
        expect(() => previewSalesOrderAmendment(order, [], 2)).toThrow(
            'No puedes quitar',
        );
        expect(() =>
            previewSalesOrderAmendment(
                order,
                [{ ...originalCartLine, warehouse_id: 3 }],
                2,
            ),
        ).toThrow('sucursal activa');
    });
});
