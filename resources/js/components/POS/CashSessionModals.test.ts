// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import CashMovementModal from './CashMovementModal.vue';
import CloseSessionModal from './CloseSessionModal.vue';
import OpenSessionModal from './OpenSessionModal.vue';

const fetchMethods = vi.fn().mockResolvedValue(undefined);

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: () => ({
        methods: ref([
            {
                code: 'cash',
                name: 'Efectivo',
                is_active: true,
                requires_cash_count: true,
            },
        ]),
        fetchMethods,
    }),
}));

describe('cash session modals', () => {
    beforeEach(() => {
        fetchMethods.mockClear();
    });

    it('prevents duplicate opening submits and clears the amount after hiding', async () => {
        const wrapper = mount(OpenSessionModal, {
            props: { show: true, loading: false },
        });
        const vm = wrapper.vm as any;
        vm.openingAmount = 75;

        vm.handleSubmit();
        vm.handleSubmit();

        expect(wrapper.emitted('submit')).toEqual([[75]]);

        await wrapper.setProps({ show: false });
        expect(vm.openingAmount).toBe(0);
    });

    it('emits one idempotent movement and resets all fields on reopen', async () => {
        const wrapper = mount(CashMovementModal, {
            props: { show: true, loading: false, initialType: 'out' },
        });
        const vm = wrapper.vm as any;
        vm.amount = 20;
        vm.reason = 'Retiro autorizado';
        vm.referenceNumber = 'REF-20';
        vm.notes = 'Prueba';
        await nextTick();

        const firstKey = vm.idempotencyKey;
        vm.handleSubmit();
        vm.handleSubmit();

        expect(wrapper.emitted('submit')).toHaveLength(1);
        expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
            type: 'out',
            amount: 20,
            reason: 'Retiro autorizado',
            idempotency_key: firstKey,
        });

        await wrapper.setProps({ show: false });
        await wrapper.setProps({ show: true });

        expect(vm.amount).toBeNull();
        expect(vm.reason).toBe('');
        expect(vm.referenceNumber).toBe('');
        expect(vm.notes).toBe('');
        expect(vm.idempotencyKey).not.toBe(firstKey);
    });

    it('clears the closing count and justification and emits only once', async () => {
        const wrapper = mount(CloseSessionModal, {
            props: {
                show: true,
                loading: false,
                session: {
                    id: 1,
                    user_id: 1,
                    opened_at: '2026-08-24T08:00:00Z',
                    closed_at: null,
                    opening_amount: 0,
                    closing_amount: null,
                    expected_amount: 0,
                    status: 'open',
                    notes: null,
                    created_at: '2026-08-24T08:00:00Z',
                    updated_at: '2026-08-24T08:00:00Z',
                },
                summary: {
                    opening_amount: 0,
                    cash_sales: 0,
                    electronic_sales: 0,
                    total_sales: 0,
                    expected_cash: 0,
                    reconciliation_rows: [
                        {
                            code: 'cash',
                            label: 'Efectivo',
                            start_adds: 0,
                            payments: 0,
                            withdrawals: 0,
                            expected_total: 0,
                        },
                    ],
                },
            },
        });
        const vm = wrapper.vm as any;
        vm.extraCash = 10;
        vm.notes = 'Sobrante contado';
        await nextTick();

        vm.handleSubmit();
        vm.handleSubmit();

        expect(wrapper.emitted('submit')).toHaveLength(1);
        expect(wrapper.emitted('submit')?.[0]?.slice(0, 2)).toEqual([
            10,
            'Sobrante contado',
        ]);

        await wrapper.setProps({ show: false });
        await wrapper.setProps({ show: true });

        expect(vm.extraCash).toBe(0);
        expect(vm.notes).toBe('');
    });

    it('preserves negative declared totals for non-cash payment methods', async () => {
        const wrapper = mount(CloseSessionModal, {
            props: {
                show: true,
                loading: false,
                session: {
                    id: 2,
                    user_id: 1,
                    opened_at: '2026-09-06T08:00:00Z',
                    closed_at: null,
                    opening_amount: 0,
                    closing_amount: null,
                    expected_amount: 0,
                    status: 'open',
                    notes: null,
                    created_at: '2026-09-06T08:00:00Z',
                    updated_at: '2026-09-06T08:00:00Z',
                },
                summary: {
                    opening_amount: 0,
                    cash_sales: 0,
                    electronic_sales: 0,
                    total_sales: 0,
                    expected_cash: 0,
                    reconciliation_rows: [
                        {
                            code: 'cash',
                            label: 'Efectivo',
                            start_adds: 0,
                            payments: 0,
                            withdrawals: 0,
                            expected_total: 0,
                        },
                        {
                            code: 'transfer',
                            label: 'Transferencia',
                            start_adds: 0,
                            payments: 0,
                            withdrawals: -50,
                            expected_total: -50,
                        },
                    ],
                },
            },
        });
        const vm = wrapper.vm as any;

        vm.handlePaymentChange('transfer', '-50');
        await nextTick();
        vm.handleSubmit();

        expect(wrapper.emitted('submit')).toHaveLength(1);
        expect(wrapper.emitted('submit')?.[0]?.[0]).toBe(0);
        expect(wrapper.emitted('submit')?.[0]?.[2]).toMatchObject({
            payment_method_counts: { transfer: -50 },
        });
    });
});
