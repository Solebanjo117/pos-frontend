// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { BalanceSheetReport } from '@/types/report';
import FinanceBalanceSheet from './FinanceBalanceSheet.vue';

const report = (
    overrides: Partial<BalanceSheetReport> = {},
): BalanceSheetReport => ({
    status: 'ready',
    is_official: true,
    scope: 'consolidated',
    as_of: '2026-08-17',
    period_start: '2026-01-01',
    warehouse_id: null,
    assets: {
        cash: 100,
        cash_initial: 0,
        bank: -25,
        bank_initial: 0,
        inventory: 70,
        inventory_initial: 0,
        accounts_receivable: 30,
        other_assets: 0,
    },
    liabilities: {
        accounts_payable: 20,
        customer_credits: 5,
        pending_refunds: 0,
        other_liabilities: 0,
    },
    equity: {
        contributed_capital: 100,
        retained_earnings: 30,
        period_profit: 20,
        other_equity: 0,
        total_equity: 150,
    },
    totals: {
        total_assets: 175,
        total_liabilities: 25,
        total_equity: 150,
        liabilities_and_equity: 175,
        reconciliation_difference: 0,
        balance: 150,
    },
    reconciliation: {
        trial_balance: { debit: 500, credit: 500, difference: 0 },
        control_accounts: [
            {
                key: 'bank',
                label: 'Banco',
                ledger_balance: -25,
                subledger_balance: -25,
                difference: 0,
                verified: true,
            },
        ],
        control_difference: 0,
        source_coverage: {},
        missing_sources: 0,
        unclassified_accounts: 0,
        historical_inventory_verified: true,
    },
    bank_accounts: [
        {
            id: 1,
            name: 'Cuenta principal',
            institution_name: 'Banco Nacional',
            masked_number: '•••• 2525',
            allow_negative_balance: false,
            is_legacy: false,
            ledger_account_code: '1110',
            balance: -25,
        },
    ],
    warnings: [],
    ...overrides,
});

const mountBalance = (data = report()) =>
    mount(FinanceBalanceSheet, {
        props: {
            data,
            currencyFormatter: (value: number) =>
                `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`,
        },
    });

describe('FinanceBalanceSheet', () => {
    it('renders the consolidated cutoff and reconciled equation', () => {
        const wrapper = mountBalance();

        expect(wrapper.text()).toContain('Consolidado · Balance al 2026-08-17');
        expect(wrapper.text()).toContain('Conciliado');
        expect(wrapper.text()).toContain('Efectivo');
        expect(wrapper.text()).not.toContain('Cash');
        expect(wrapper.text()).toContain('Diferencia $0.00');
    });

    it('shows individual negative bank accounts and their policy', () => {
        const wrapper = mountBalance();

        expect(wrapper.text()).toContain('Cuenta principal');
        expect(wrapper.text()).toContain('-$25.00');
        expect(wrapper.text()).toContain('Saldo negativo no autorizado');
    });

    it('emits ledger-specific metrics for drilldowns', async () => {
        const wrapper = mountBalance();
        const cashButton = wrapper
            .findAll('button')
            .find((button) => button.text() === '$100.00');

        await cashButton?.trigger('click');

        expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({
            metric: 'balance_cash',
            label: 'Efectivo',
            value: 100,
        });
    });

    it('never labels a real difference as reconciled', () => {
        const data = report({
            status: 'unbalanced',
            is_official: false,
            totals: {
                ...report().totals,
                reconciliation_difference: 12.5,
                liabilities_and_equity: 162.5,
            },
        });
        const wrapper = mountBalance(data);

        expect(wrapper.text()).toContain('No balanceado');
        expect(wrapper.text()).toContain('Diferencia$12.50');
        expect(wrapper.text()).not.toContain('Conciliado');
    });
});
