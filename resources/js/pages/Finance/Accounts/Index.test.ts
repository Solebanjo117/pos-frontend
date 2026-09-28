// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Index from './Index.vue';

const mocks = vi.hoisted(() => ({
    accounts: vi.fn(),
    accountsReport: vi.fn(),
    accountMovements: vi.fn(),
    ledgerAccounts: vi.fn(),
    updateAccount: vi.fn(),
    createAccount: vi.fn(),
}));

vi.mock('@/services/financial-transfers', () => ({
    financialTransfersService: {
        accounts: mocks.accounts,
        accountsReport: mocks.accountsReport,
        accountMovements: mocks.accountMovements,
        ledgerAccounts: mocks.ledgerAccounts,
        updateAccount: mocks.updateAccount,
        createAccount: mocks.createAccount,
    },
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div><slot /></div>' },
    Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
}));

const global = {
    stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        PageShell: {
            template: '<section><slot name="actions" /><slot /></section>',
        },
        Dialog: { template: '<div><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<p><slot /></p>' },
        DialogFooter: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<h2><slot /></h2>' },
        SearchableSelect: { template: '<div />' },
        Lock: true,
        Pencil: true,
        Plus: true,
        Save: true,
    },
};

const accountsPayload = [
    {
        id: 1,
        name: 'Banco General',
        type: 'bank',
        institution_name: 'Banco General S.A.',
        masked_number: '•••• 4821',
        currency: 'USD',
        opening_balance: '1000.00',
        current_balance: '1250.75',
        allow_negative_balance: false,
        is_active: true,
        is_legacy: false,
        ledger_account_id: 11,
        ledger_account: { id: 11, code: '1102', name: 'Bancos' },
    },
    {
        id: 2,
        name: 'Caja chica taller',
        type: 'petty_cash',
        institution_name: null,
        masked_number: null,
        currency: 'USD',
        opening_balance: '200.00',
        current_balance: '-35.40',
        allow_negative_balance: true,
        is_active: false,
        is_legacy: false,
        ledger_account_id: 12,
        ledger_account: { id: 12, code: '1101', name: 'Caja' },
    },
    {
        id: 3,
        name: 'Cuenta historica',
        type: 'other',
        institution_name: null,
        masked_number: null,
        currency: 'USD',
        opening_balance: '0.00',
        current_balance: '0.00',
        allow_negative_balance: false,
        is_active: true,
        is_legacy: true,
        ledger_account_id: 13,
        ledger_account: { id: 13, code: '1199', name: 'Otras cuentas' },
    },
];

describe('Cuentas financieras', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.accounts.mockResolvedValue(accountsPayload);
        mocks.accountsReport.mockImplementation(async (params) => ({
            data: await mocks.accounts(params),
            total: 3,
            last_page: 1,
            totals_by_currency: [{ currency: 'USD', balance: 1215.35 }],
        }));
        mocks.accountMovements.mockResolvedValue({
            data: [],
            last_page: 1,
            summary: { incoming: 0, outgoing: 0 },
        });
        mocks.ledgerAccounts.mockResolvedValue([
            { id: 11, code: '1102', name: 'Bancos' },
        ]);
    });

    it('lista las cuentas en una tabla con los campos que la API ya devolvia', async () => {
        const wrapper = mount(Index, { global });
        await flushPromises();

        const rows = wrapper.findAll('tbody tr');
        expect(rows).toHaveLength(3);

        const cells = rows[0].findAll('td').map((cell) => cell.text());
        expect(cells[0]).toContain('Banco General');
        expect(cells[1]).toBe('Banco');
        expect(cells[2]).toBe('Banco General S.A.');
        expect(cells[3]).toBe('•••• 4821');
        expect(cells[4]).toBe('1102 · Bancos');
        expect(cells[6]).toBe('$1,250.75');
        expect(cells[7]).toBe('Activa');

        const pettyCash = rows[1].findAll('td').map((cell) => cell.text());
        expect(pettyCash[1]).toBe('Caja chica');
        expect(pettyCash[2]).toBe('—');
        expect(pettyCash[3]).toBe('—');
        expect(pettyCash[6]).toContain('-$35.40');
        expect(pettyCash[6]).toContain('Admite saldo negativo');
        expect(pettyCash[7]).toBe('Inactiva');
    });

    it('mantiene las cuentas legacy como no editables y con su leyenda', async () => {
        const wrapper = mount(Index, { global });
        await flushPromises();

        const legacyRow = wrapper.findAll('tbody tr')[2];
        expect(legacyRow.text()).toContain(
            'Cuenta protegida de compatibilidad histórica',
        );
        expect(legacyRow.text()).toContain('Protegida');

        const legacyButton = legacyRow
            .findAll('td:last-child button')
            .find((button) => button.text() === 'Editar')!;
        expect(legacyButton.attributes('disabled')).toBeDefined();
        expect(legacyButton.attributes('title')).toBe(
            'Cuenta protegida de compatibilidad histórica',
        );

        await legacyButton.trigger('click');
        expect(wrapper.find('h2').text()).toContain('Nueva cuenta financiera');
    });

    it('abre el dialogo de edicion con los datos de la cuenta seleccionada', async () => {
        const wrapper = mount(Index, { global });
        await flushPromises();

        await wrapper
            .findAll('tbody tr')[0]
            .findAll('td:last-child button')
            .find((button) => button.text() === 'Editar')!
            .trigger('click');

        expect(wrapper.find('h2').text()).toContain('Editar cuenta');
        expect(
            (wrapper.find('input[maxlength="120"]').element as HTMLInputElement)
                .value,
        ).toBe('Banco General');
    });

    it('guarda la edicion sin reenviar el saldo inicial', async () => {
        mocks.updateAccount.mockResolvedValue(accountsPayload[0]);
        const wrapper = mount(Index, { global });
        await flushPromises();

        await wrapper
            .findAll('tbody tr')[0]
            .findAll('td:last-child button')
            .find((button) => button.text() === 'Editar')!
            .trigger('click');
        await (wrapper.vm as any).save();

        expect(mocks.updateAccount).toHaveBeenCalledWith(
            1,
            expect.objectContaining({
                name: 'Banco General',
                type: 'bank',
                opening_balance: undefined,
            }),
        );
    });

    it('muestra un estado vacio cuando no hay cuentas', async () => {
        mocks.accounts.mockResolvedValue([]);
        const wrapper = mount(Index, { global });
        await flushPromises();

        expect(wrapper.find('tbody').text()).toContain(
            'Aún no hay cuentas financieras registradas.',
        );
    });
});

it('envía los filtros y orden al servidor y consulta movimientos de la cuenta seleccionada', async () => {
    mocks.accountsReport.mockResolvedValue({
        data: accountsPayload,
        total: 30,
        last_page: 2,
        totals_by_currency: [
            { currency: 'USD', balance: 5000 },
            { currency: 'EUR', balance: 100 },
        ],
    });
    mocks.accountMovements.mockResolvedValue({
        data: [
            {
                id: 7,
                source_type: 'financial_transfer',
                source_id: 4,
                document_url: '/finance/transfers/4',
                amount: 50,
                direction: 'in',
                balance_after: 5000,
            },
        ],
        summary: { incoming: 50, outgoing: 0 },
        last_page: 1,
    });
    const wrapper = mount(Index, { global });
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.accountFilters.search = 'Banco';
    vm.accountFilters.type = 'bank';
    vm.accountFilters.sort_by = 'current_balance';
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mocks.accountsReport).toHaveBeenLastCalledWith(
        expect.objectContaining({
            search: 'Banco',
            type: 'bank',
            sort_by: 'current_balance',
            page: 1,
        }),
    );
    expect(wrapper.text()).toContain('EUR');
    expect(wrapper.text()).toContain('$5,000.00');
    await wrapper
        .findAll('tbody tr')[0]
        .findAll('button')
        .find((button) => button.text() === 'Movimientos')!
        .trigger('click');
    await flushPromises();
    expect(mocks.accountMovements).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
            date_from: expect.any(String),
            date_to: expect.any(String),
        }),
    );
    expect(wrapper.find('a[href="/finance/transfers/4"]').exists()).toBe(true);
});
