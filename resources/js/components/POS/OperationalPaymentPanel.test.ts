// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import apiClient from '@/services/api/client';
import OperationalPaymentPanel from './OperationalPaymentPanel.vue';

const fetchMethods = vi.fn().mockResolvedValue(undefined);

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: () => ({
        methods: ref([
            {
                id: 2,
                code: 'transfer',
                name: 'Transferencia',
                is_active: true,
                is_system: true,
                requires_reference: false,
                requires_cash_count: false,
                liquidity_bucket: 'bank',
                sort_order: 1,
            },
        ]),
        fetchMethods,
    }),
}));

vi.mock('@/services/api/client', () => ({
    default: {
        get: vi.fn(),
    },
}));

describe('OperationalPaymentPanel', () => {
    beforeEach(() => {
        fetchMethods.mockClear();
        vi.mocked(apiClient.get).mockResolvedValue({
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

    it('requires the destination account and prevents duplicate finish submissions', async () => {
        const wrapper = mount(OperationalPaymentPanel, {
            props: {
                show: true,
                amountToCharge: 100,
            },
        });
        const vm = wrapper.vm as any;
        await flushPromises();

        expect(apiClient.get).toHaveBeenCalledWith('/money-accounts/options', {
            params: { type: 'bank', purpose: 'settlement' },
        });

        vm.payments.transfer = 100;
        await nextTick();
        expect(vm.canFinish).toBe(false);

        vm.paymentAccountIds.transfer = 41;
        await nextTick();
        expect(vm.canFinish).toBe(true);

        vm.handleFinish();
        vm.handleFinish();

        expect(wrapper.emitted('finish')).toHaveLength(1);
        expect(wrapper.emitted('finish')?.[0]?.[0]).toEqual([
            {
                method: 'transfer',
                amount: 100,
                reference_number: null,
                notes: null,
                financial_account_id: 41,
            },
        ]);
    });

    it('unlocks retry only after a failed request is reported', async () => {
        const wrapper = mount(OperationalPaymentPanel, {
            props: {
                show: true,
                amountToCharge: 100,
            },
        });
        const vm = wrapper.vm as any;
        await flushPromises();

        vm.payments.transfer = 100;
        vm.paymentAccountIds.transfer = 41;
        await nextTick();
        vm.handleFinish();

        await wrapper.setProps({ loading: true });
        await wrapper.setProps({
            loading: false,
            error: 'No se pudo completar',
        });
        await nextTick();

        expect(vm.canFinish).toBe(true);
    });
});
