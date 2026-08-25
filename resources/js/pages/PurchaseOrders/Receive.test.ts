// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Receive from './Receive.vue';

const mocks = vi.hoisted(() => ({
    purchaseOrder: { __v_isRef: true, value: null as any },
    loading: { __v_isRef: true, value: false },
    error: { __v_isRef: true, value: null as string | null },
    fetchPurchaseOrderById: vi.fn(),
    receiveItems: vi.fn(),
    visit: vi.fn(),
    createIdempotencyKey: vi.fn(),
}));

vi.mock('@/composables/usePurchaseOrders', () => ({
    usePurchaseOrders: () => ({
        purchaseOrder: mocks.purchaseOrder,
        loading: mocks.loading,
        error: mocks.error,
        fetchPurchaseOrderById: mocks.fetchPurchaseOrderById,
        receiveItems: mocks.receiveItems,
    }),
}));

vi.mock('@/utils/idempotency', () => ({
    createIdempotencyKey: mocks.createIdempotencyKey,
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div><slot /></div>' },
    Link: { template: '<a><slot /></a>' },
    router: { visit: mocks.visit },
}));

const global = {
    stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        PurchaseOrderToolbar: {
            template: '<div><slot name="actions" /></div>',
        },
        PurchaseOrderSection: { template: '<section><slot /></section>' },
        Save: true,
        FileText: true,
        Package: true,
        ClipboardCheck: true,
        DollarSign: true,
        UserRound: true,
        CreditCard: true,
        PackageCheck: true,
    },
};

describe('Purchase order receipt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createIdempotencyKey
            .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
            .mockReturnValue('22222222-2222-4222-8222-222222222222');
        mocks.purchaseOrder.value = {
            id: 41,
            po_number: 'PO-41',
            status: 'sent',
            items: [
                {
                    id: 9,
                    product_id: 3,
                    product: { id: 3, name: 'Filtro', sku_base: null },
                    variant: null,
                    quantity_ordered: 5,
                    quantity_received: 0,
                    effective_received_quantity: 0,
                    pending_quantity: 5,
                    units_per_package: 1,
                    unit_cost: 4,
                    is_fully_received: false,
                },
            ],
        };
        mocks.loading.value = false;
        mocks.error.value = null;
        mocks.fetchPurchaseOrderById.mockResolvedValue(
            mocks.purchaseOrder.value,
        );
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('keeps the same key and form data when a failed receipt is retried', async () => {
        mocks.error.value = 'No se pudo registrar la recepción';
        mocks.receiveItems.mockRejectedValue(new Error('controlled'));
        const wrapper = mount(Receive, {
            props: { purchaseOrderId: 41 },
            global,
        });
        await flushPromises();

        const input = wrapper.get('input[type="number"]');
        await input.setValue('3');
        await wrapper.get('form').trigger('submit');
        await flushPromises();
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.receiveItems).toHaveBeenCalledTimes(2);
        expect(mocks.receiveItems).toHaveBeenNthCalledWith(1, 41, {
            idempotency_key: '11111111-1111-4111-8111-111111111111',
            items: [{ item_id: 9, quantity_received: 3 }],
        });
        expect(mocks.receiveItems).toHaveBeenNthCalledWith(2, 41, {
            idempotency_key: '11111111-1111-4111-8111-111111111111',
            items: [{ item_id: 9, quantity_received: 3 }],
        });
        expect((input.element as HTMLInputElement).value).toBe('3');
        expect(wrapper.text()).toContain('No se pudo registrar la recepción');
        expect(mocks.visit).not.toHaveBeenCalled();
    });

    it('uses a new key after the failed payload is changed', async () => {
        mocks.receiveItems.mockRejectedValue(new Error('controlled'));
        const wrapper = mount(Receive, {
            props: { purchaseOrderId: 41 },
            global,
        });
        await flushPromises();

        const input = wrapper.get('input[type="number"]');
        await input.setValue('3');
        await wrapper.get('form').trigger('submit');
        await flushPromises();
        await input.setValue('4');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.receiveItems).toHaveBeenNthCalledWith(2, 41, {
            idempotency_key: '22222222-2222-4222-8222-222222222222',
            items: [{ item_id: 9, quantity_received: 4 }],
        });
    });
});
