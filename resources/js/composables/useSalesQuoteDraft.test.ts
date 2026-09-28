// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
    useSalesQuoteDraft,
    type QuoteDraftPayload,
} from './useSalesQuoteDraft';

const mocks = vi.hoisted(() => ({
    put: vi.fn(),
    uuid: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

vi.mock('@/services/api/client', () => ({ default: { put: mocks.put } }));
vi.mock('@/utils/idempotency', () => ({ createIdempotencyKey: mocks.uuid }));

const draftPayload = (): QuoteDraftPayload => ({
    customer_id: null,
    customer_vehicle_id: null,
    warehouse_id: 2,
    notes: 'Entregar hoy',
    internal_notes: null,
    items: [
        {
            product_id: 8,
            variant_id: 9,
            warehouse_id: 2,
            quantity: 1,
            unit_price: 20,
            discount_percent: 0,
            discount_amount: 2,
            tax_percent: 7,
            notes: null,
            is_custom_line: false,
            custom_description: null,
        },
    ],
});

function savedQuote(revision: number) {
    return {
        data: {
            data: {
                id: 44,
                quote_number: '0000000044',
                draft_revision: revision,
                idempotency_key: '11111111-1111-4111-8111-111111111111',
                status: 'draft',
            },
        },
    };
}

describe('quote draft autosave', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.useFakeTimers();
        mocks.put.mockReset();
        mocks.uuid.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('waits 800 ms, uses one stable UUID and acknowledges the saved revision', async () => {
        const payload = draftPayload();
        const onSaved = vi.fn();
        mocks.put.mockResolvedValue(savedQuote(1));
        const draft = useSalesQuoteDraft(
            () => ({ payload, cart: [{ id: 'line-1' }] }),
            onSaved,
        );
        draft.start(5, 2);
        draft.recordChange();

        await vi.advanceTimersByTimeAsync(799);
        expect(mocks.put).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        expect(mocks.put).toHaveBeenCalledOnce();
        expect(mocks.put).toHaveBeenCalledWith(
            '/sales-quotes/drafts/11111111-1111-4111-8111-111111111111',
            expect.objectContaining({
                expected_revision: 0,
                notes: 'Entregar hoy',
                quote_id: null,
            }),
        );
        expect(draft.quoteId.value).toBe(44);
        expect(draft.revision.value).toBe(1);
        expect(draft.dirty.value).toBe(false);
        expect(onSaved).toHaveBeenCalledOnce();
        draft.dispose();
    });

    it('serializes changes made during an outstanding save', async () => {
        let releaseFirst!: (value: unknown) => void;
        mocks.put
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        releaseFirst = resolve;
                    }),
            )
            .mockResolvedValueOnce(savedQuote(2));
        const payload = draftPayload();
        const draft = useSalesQuoteDraft(
            () => ({ payload: { ...payload }, cart: [] }),
            vi.fn(),
        );
        draft.start(5, 2);
        draft.recordChange();
        await vi.advanceTimersByTimeAsync(800);

        payload.notes = 'Entregar mañana';
        draft.recordChange();
        await vi.advanceTimersByTimeAsync(800);
        expect(mocks.put).toHaveBeenCalledOnce();

        releaseFirst(savedQuote(1));
        await Promise.resolve();
        await Promise.resolve();
        await draft.flush();

        expect(mocks.put).toHaveBeenCalledTimes(2);
        expect(mocks.put.mock.calls[1][1]).toMatchObject({
            quote_id: 44,
            expected_revision: 1,
            notes: 'Entregar mañana',
        });
        expect(draft.revision.value).toBe(2);
        expect(draft.dirty.value).toBe(false);
        draft.dispose();
    });

    it('retains an unsaved local snapshot after a network error and recovers with the same UUID', async () => {
        const payload = draftPayload();
        mocks.put
            .mockRejectedValueOnce(new Error('Sin conexión'))
            .mockResolvedValueOnce(savedQuote(1));
        const first = useSalesQuoteDraft(
            () => ({ payload, cart: [{ id: 'line-1' }] }),
            vi.fn(),
        );
        first.start(5, 2);
        first.recordChange();
        expect(await first.flush()).toBe(false);
        expect(first.dirty.value).toBe(true);
        first.dispose();

        const recovered = useSalesQuoteDraft(
            () => ({ payload, cart: [{ id: 'line-1' }] }),
            vi.fn(),
        );
        const local = recovered.start(5, 2);
        expect(local?.cart).toEqual([{ id: 'line-1' }]);
        expect(local?.payload.notes).toBe('Entregar hoy');
        expect(await recovered.flush()).toBe(true);
        expect(mocks.put.mock.calls[0][0]).toBe(mocks.put.mock.calls[1][0]);
        expect(recovered.dirty.value).toBe(false);
        recovered.dispose();
    });

    it('does not overwrite a conflicting revision or retry automatically after 409', async () => {
        const payload = draftPayload();
        mocks.put.mockRejectedValue({
            response: { status: 409, data: { data: savedQuote(2).data.data } },
        });
        const draft = useSalesQuoteDraft(
            () => ({ payload, cart: [{ id: 'line-1' }] }),
            vi.fn(),
        );
        draft.start(5, 2, 44, 1, '11111111-1111-4111-8111-111111111111');
        draft.recordChange();

        expect(await draft.flush()).toBe(false);
        expect(draft.conflict.value).toBe(true);
        expect(draft.dirty.value).toBe(true);
        expect(mocks.put).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(1600);
        expect(mocks.put).toHaveBeenCalledOnce();
        draft.dispose();
    });

    it('keeps a local copy of an empty new draft without creating a server quote', async () => {
        const payload = {
            ...draftPayload(),
            items: [],
            notes: 'Cliente por confirmar',
        };
        const draft = useSalesQuoteDraft(
            () => ({ payload, cart: [] }),
            vi.fn(),
        );
        draft.start(5, 2);
        draft.recordChange();

        expect(await draft.flush()).toBe(true);
        expect(mocks.put).not.toHaveBeenCalled();
        expect(draft.dirty.value).toBe(true);
        expect(localStorage.length).toBe(1);
        draft.dispose();
    });

    it('retries a lost acknowledgement with the original revision and canonical UUID', async () => {
        const payload = draftPayload();
        mocks.put
            .mockRejectedValueOnce(new Error('Respuesta perdida'))
            .mockResolvedValueOnce(savedQuote(1));
        const first = useSalesQuoteDraft(
            () => ({ payload, cart: [{ id: 'line-1' }] }),
            vi.fn(),
        );
        first.start(5, 2, 44, 0, '11111111-1111-4111-8111-111111111111');
        first.recordChange();
        expect(await first.flush()).toBe(false);
        first.dispose();

        const recovered = useSalesQuoteDraft(
            () => ({ payload, cart: [{ id: 'line-1' }] }),
            vi.fn(),
        );
        const local = recovered.start(
            5,
            2,
            44,
            1,
            '11111111-1111-4111-8111-111111111111',
        );
        expect(local?.dirty).toBe(true);
        expect(recovered.conflict.value).toBe(false);
        expect(await recovered.flush()).toBe(true);
        expect(mocks.put.mock.calls[1]).toEqual(mocks.put.mock.calls[0]);
        recovered.dispose();
    });
});
