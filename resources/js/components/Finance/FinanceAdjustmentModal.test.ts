// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import FinanceAdjustmentModal from './FinanceAdjustmentModal.vue';

const optionsMock = vi.fn();
const createMock = vi.fn();
vi.mock('@/services/financial-adjustments', () => ({
    financialAdjustmentsService: {
        options: (...args: unknown[]) => optionsMock(...args),
        create: (...args: unknown[]) => createMock(...args),
    },
}));

const options = {
    types: [
        { value: 'cash', label: 'Efectivo' },
        { value: 'bank', label: 'Banco' },
        { value: 'manual_correction', label: 'Ajuste contable manual' },
    ],
    directions: [
        { value: 'increase', label: 'Aumentar saldo' },
        { value: 'decrease', label: 'Disminuir saldo' },
    ],
    pos_sessions: [{ value: 1, label: 'Caja #1' }],
    financial_accounts: [
        {
            value: 2,
            label: 'Banco principal',
            type: 'bank',
            institution_name: 'Banco General',
            masked_number: '4321',
            balance: 100,
        },
    ],
    ledger_accounts: [
        { value: 3, label: '1100 · Efectivo' },
        { value: 4, label: '3999 · Contrapartida' },
    ],
    warehouses: [],
    customers: [],
    suppliers: [],
    sales_orders: [],
    purchase_orders: [],
    products: [],
};

const stubs = {
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
    DialogDescription: { template: '<p><slot /></p>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
    SearchableSelect: {
        props: ['modelValue', 'options'],
        emits: ['update:modelValue'],
        template:
            '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    },
};

async function mountModal() {
    const wrapper = mount(FinanceAdjustmentModal, {
        props: { open: false },
        global: { stubs },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    return wrapper;
}

describe('FinanceAdjustmentModal', () => {
    beforeEach(() => {
        optionsMock.mockReset().mockResolvedValue(options);
        createMock
            .mockReset()
            .mockResolvedValue({ id: 10, folio: 'AJ-2026-000001' });
    });

    it('uses a dropdown, Efectivo naming, positive amount and explicit direction', async () => {
        const wrapper = await mountModal();
        expect(wrapper.text()).toContain('Tipo de ajuste');
        expect(wrapper.text()).toContain('Efectivo');
        expect(wrapper.text()).not.toContain('Cash');
        expect(wrapper.text()).toContain('Tipo de movimiento');
        expect(wrapper.find('input[type="number"]').attributes('min')).toBe(
            '0.01',
        );
    });

    it('requires explicit debit and credit accounts for a manual adjustment', async () => {
        const wrapper = await mountModal();
        const vm = wrapper.vm as any;
        vm.form.type = 'manual_correction';
        await nextTick();

        expect(wrapper.text()).toContain('Cuenta débito');
        expect(wrapper.text()).toContain('Cuenta crédito');
        expect(wrapper.text()).not.toContain('Tipo de movimiento');
        vm.form.amount = 25;
        vm.form.reason = 'Reclasificación';
        vm.form.affected_ledger_account_id = 3;
        vm.form.counterparty_ledger_account_id = 3;
        await nextTick();
        expect(vm.canContinue).toBe(false);
    });

    it('shows the exact bank selector and blocks duplicate submissions', async () => {
        const wrapper = await mountModal();
        const vm = wrapper.vm as any;
        vm.form.type = 'bank';
        await nextTick();
        expect(wrapper.text()).toContain('Cuenta bancaria afectada');

        vm.form.financial_account_id = 2;
        vm.form.counterparty_ledger_account_id = 4;
        vm.form.amount = 10;
        vm.form.reason = 'Corrección bancaria';
        await nextTick();
        const first = vm.submit();
        const second = vm.submit();
        await Promise.all([first, second]);
        expect(createMock).toHaveBeenCalledTimes(1);
        expect(createMock.mock.calls[0][0].amount).toBe(10);
        expect(createMock.mock.calls[0][0].direction).toBe('increase');
    });
});
