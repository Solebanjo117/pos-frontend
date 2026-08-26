// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import CreateReturnModal from './CreateReturnModal.vue';

const mocks = vi.hoisted(() => ({
    fetchMethods: vi.fn(),
    get: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
    default: { get: mocks.get },
}));

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: () => ({
        methods: ref([
            {
                id: 1,
                code: 'cash',
                name: 'Efectivo',
                is_active: true,
                is_archived: false,
                liquidity_bucket: 'cash',
            },
            {
                id: 2,
                code: 'transfer',
                name: 'Transferencia',
                is_active: true,
                is_archived: false,
                liquidity_bucket: 'bank',
            },
        ]),
        fetchMethods: mocks.fetchMethods,
    }),
}));

const items = [
    {
        id: 12,
        product_id: 20,
        product_name: 'Producto devuelto',
        product_sku: 'DEV-12',
        quantity: 2,
        unit_price: 10,
        discount_percent: 0,
        total: 20,
    },
];

describe('CreateReturnModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.get.mockResolvedValue({
            data: {
                data: [
                    {
                        endpoint_id: 41,
                        name: 'Banco principal',
                        masked_number: '1234',
                    },
                ],
            },
        });
    });

    it('emits one durable operation key and blocks duplicate submits', async () => {
        const wrapper = mount(CreateReturnModal, {
            props: {
                show: false,
                orderId: 8,
                orderNumber: 'V-8',
                items,
            },
            global: { stubs: { Teleport: true } },
        });
        await wrapper.setProps({ show: true });
        await flushPromises();

        const vm = wrapper.vm as any;
        vm.quantities[12] = 1;
        vm.handleSubmit();
        vm.handleSubmit();

        expect(wrapper.emitted('submit')).toHaveLength(1);
        const payload = wrapper.emitted('submit')?.[0]?.[0] as any;
        expect(payload).toMatchObject({
            idempotency_key: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            ),
            refund_method: 'cash',
            items: [
                {
                    sales_order_item_id: 12,
                    quantity: 1,
                    user_id: null,
                },
            ],
        });
    });

    it('keeps the same key for a failed retry and creates a new key when reopened', async () => {
        const wrapper = mount(CreateReturnModal, {
            props: {
                show: false,
                orderId: 8,
                orderNumber: 'V-8',
                items,
                loading: false,
                error: null,
            },
            global: { stubs: { Teleport: true } },
        });
        await wrapper.setProps({ show: true });
        const vm = wrapper.vm as any;
        vm.quantities[12] = 1;
        vm.handleSubmit();
        const firstKey = (wrapper.emitted('submit')?.[0]?.[0] as any)
            .idempotency_key;

        await wrapper.setProps({ loading: true });
        await wrapper.setProps({ loading: false, error: 'Fallo recuperable' });
        vm.handleSubmit();
        expect(wrapper.emitted('submit')).toHaveLength(2);
        expect(
            (wrapper.emitted('submit')?.[1]?.[0] as any).idempotency_key,
        ).toBe(firstKey);

        await wrapper.setProps({ show: false });
        await wrapper.setProps({ show: true, error: null });
        vm.quantities[12] = 1;
        vm.handleSubmit();
        expect(
            (wrapper.emitted('submit')?.[2]?.[0] as any).idempotency_key,
        ).not.toBe(firstKey);
    });

    it('requires and preserves the selected bank account in the submitted operation', async () => {
        const wrapper = mount(CreateReturnModal, {
            props: {
                show: false,
                orderId: 8,
                orderNumber: 'V-8',
                items,
            },
            global: { stubs: { Teleport: true } },
        });
        await wrapper.setProps({ show: true });
        await flushPromises();

        expect(mocks.get).toHaveBeenCalledWith('/money-accounts/options', {
            params: { type: 'bank', purpose: 'settlement' },
        });

        const vm = wrapper.vm as any;
        vm.quantities[12] = 1;
        vm.refundMethod = 'transfer';
        vm.handleSubmit();
        expect(wrapper.emitted('submit')).toBeUndefined();

        vm.financialAccountId = 41;
        vm.handleSubmit();
        expect(wrapper.emitted('submit')).toHaveLength(1);
        expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
            refund_method: 'transfer',
            financial_account_id: 41,
        });

        const key = (wrapper.emitted('submit')?.[0]?.[0] as any)
            .idempotency_key;
        await wrapper.setProps({ loading: true });
        await wrapper.setProps({
            loading: false,
            error: 'La cuenta bancaria ya no está disponible.',
        });
        expect(vm.financialAccountId).toBe(41);
        vm.handleSubmit();
        expect(wrapper.emitted('submit')?.[1]?.[0]).toMatchObject({
            idempotency_key: key,
            financial_account_id: 41,
        });
    });
});
