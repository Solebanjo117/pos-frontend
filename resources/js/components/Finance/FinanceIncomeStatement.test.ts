// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type {
    IncomeStatementReconciliation,
    StatementSection,
} from '@/types/report';
import FinanceIncomeStatement from './FinanceIncomeStatement.vue';

const reconciliation: IncomeStatementReconciliation = {
    gross_sales_ex_tax: 200,
    discounts: 20,
    returns_ex_tax: 90,
    net_sales_ex_tax: 90,
    tax_collected: 6.3,
    gross_cogs: 80,
    return_cogs: 40,
    net_cogs: 40,
    gross_profit: 50,
    operational_expenses: 10,
    net_income: 40,
};

const sections: StatementSection[] = [
    {
        key: 'income',
        label: 'Ingresos',
        amount: 90,
        rows: [
            {
                key: 'gross-sales',
                label: 'Subtotal',
                amount: 200,
                type: 'income',
            },
            {
                key: 'discounts',
                label: 'Descuentos',
                amount: -20,
                type: 'expense',
            },
            {
                key: 'approved-refunds',
                label: 'Devoluciones / notas de credito',
                amount: -90,
                type: 'expense',
            },
            {
                key: 'tax-collected',
                label: 'ITBMS cobrado',
                amount: 6.3,
                type: 'neutral',
                included_in_section_total: false,
            },
        ],
    },
    {
        key: 'cost-of-goods-sold',
        label: 'Costo',
        amount: 40,
        rows: [
            {
                key: 'gross-cogs',
                label: 'Costo de productos vendidos',
                amount: 80,
                type: 'expense',
            },
            {
                key: 'return-cogs',
                label: 'Reversion por devoluciones',
                amount: -40,
                type: 'income',
            },
        ],
    },
    {
        key: 'operational-expenses',
        label: 'Gastos',
        amount: 10,
        rows: [
            {
                key: 'operational-expense-rent',
                label: 'Alquiler',
                amount: 10,
                type: 'expense',
            },
        ],
    },
];

const mountStatement = (
    values: IncomeStatementReconciliation | null = reconciliation,
) =>
    mount(FinanceIncomeStatement, {
        props: {
            reconciliation: values,
            sections,
            currencyFormatter: (value: number) => `$${value.toFixed(2)}`,
        },
    });

describe('FinanceIncomeStatement', () => {
    it('renders one reconciled hierarchy with identical Net Income values', () => {
        const wrapper = mountStatement();
        const text = wrapper.text();

        expect(text.indexOf('Sales')).toBeLessThan(text.indexOf('Cost'));
        expect(text.indexOf('Cost')).toBeLessThan(text.indexOf('Gross Profit'));
        expect(text.indexOf('Gross Profit')).toBeLessThan(
            text.indexOf('Expenses'),
        );
        expect(
            wrapper
                .findAll('button')
                .filter((button) => button.text().includes('Net Income')),
        ).toHaveLength(2);
        expect(
            wrapper
                .findAll('button')
                .filter((button) => button.text().includes('Net Income'))
                .every((button) => button.text().includes('$40.00')),
        ).toBe(true);
        expect(text).not.toContain('Net Profit');
        expect(text).not.toContain('Ventas netas');
        expect(text).not.toContain('Costo neto');
    });

    it('marks ITBMS as informative and keeps it outside Sales', () => {
        const wrapper = mountStatement();

        expect(wrapper.text()).toContain('ITBMS cobrado');
        expect(wrapper.text()).toContain('Informativo');
        expect(
            reconciliation.gross_sales_ex_tax -
                reconciliation.discounts -
                reconciliation.returns_ex_tax,
        ).toBe(reconciliation.net_sales_ex_tax);
    });

    it('uses full-row accessible accordion buttons', async () => {
        const wrapper = mountStatement();
        const trigger = wrapper.get('#income-statement-sales-trigger');

        expect(trigger.element.tagName).toBe('BUTTON');
        expect(trigger.attributes('aria-expanded')).toBe('true');
        expect(trigger.attributes('aria-controls')).toBe(
            'income-statement-sales-details',
        );
        expect(wrapper.find('#income-statement-sales-details').exists()).toBe(
            true,
        );

        await trigger.trigger('click');

        expect(trigger.attributes('aria-expanded')).toBe('false');
        expect(wrapper.find('#income-statement-sales-details').exists()).toBe(
            false,
        );
    });

    it('renders dynamic expenses and safe zero values', () => {
        const wrapper = mountStatement(null);

        expect(wrapper.text()).toContain('Alquiler');
        expect(wrapper.text()).toContain('$0.00');
        expect(wrapper.text()).not.toContain('NaN');
        expect(wrapper.text()).not.toContain('undefined');
    });
});
