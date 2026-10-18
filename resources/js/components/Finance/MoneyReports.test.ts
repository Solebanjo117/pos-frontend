// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import apiClient from '@/services/api/client';
import { reportPeriod } from '@/utils/moneyReports';
import CashPaymentsReport from './CashPaymentsReport.vue';
import CashPositionReport from './CashPositionReport.vue';
import SalesLinesReport from './SalesLinesReport.vue';
vi.mock('@inertiajs/vue3', () => ({
    Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
}));
vi.mock('@/composables/useAuth', () => ({
    useAuth: () => ({ isAdmin: ref(true), isManager: ref(true) }),
}));
vi.mock('@/utils/formatters', () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatReportDateTime: (v: string) => v,
    formatDateInputValue: () => '2026-09-27',
}));
vi.mock('@/services/api/client', () => ({
    default: { get: vi.fn(), post: vi.fn() },
}));
const salesResult = {
    data: [
        {
            document_id: 9,
            document_number: 'SO-9',
            kind: 'sale',
            sku: 'P1',
            product_name: 'Filtro',
            net_sales: 40,
            discounts: 0,
            cost: 10,
            profit: 30,
        },
    ],
    summary: { net_sales: 1000, profit: 350, cost: 650, margin: 35 },
    warnings: [],
    meta: { total: 30, current_page: 1, last_page: 2 },
};

it('conserva el rango recibido de Finanzas al consultar cobros y efectivo', async () => {
    const initialFilters = {
        date_from: '2026-08-10',
        date_to: '2026-08-15',
        warehouse_id: 3,
    };
    const collections = mount(CashPaymentsReport, {
        props: { reportMode: true, initialFilters },
    });
    await flushPromises();
    expect(apiClient.get).toHaveBeenCalledWith('/cash/payment-movements', {
        params: expect.objectContaining({
            ...initialFilters,
            warehouse_id: '3',
        }),
    });
    expect(collections.emitted('filters-applied')?.[0]).toEqual([
        initialFilters,
    ]);
    const cash = mount(CashPositionReport, { props: { initialFilters } });
    await flushPromises();
    expect(cash.find('button[aria-haspopup="dialog"]').exists()).toBe(true);
    expect(cash.emitted('filters-applied')?.[0]).toEqual([initialFilters]);
    expect(apiClient.get).toHaveBeenCalledWith('/reports/cash-position', {
        params: expect.objectContaining({
            date_from: '2026-08-10',
            date_to: '2026-08-15',
            mode: 'current',
        }),
    });
    await collections.setProps({
        initialFilters: { ...initialFilters, date_from: '2026-08-12' },
    });
    await flushPromises();
    expect(apiClient.get).toHaveBeenCalledWith('/cash/payment-movements', {
        params: expect.objectContaining({
            date_from: '2026-08-12',
            date_to: '2026-08-15',
        }),
    });
});
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
        if (url === '/reports/sales-lines')
            return { data: structuredClone(salesResult) } as any;
        if (url === '/reports/cash-position')
            return {
                data: {
                    data: [
                        {
                            id: 1,
                            amount: -3000,
                            balance: 1500,
                            kind: 'transfer',
                            document_url: '/finance/transfers/7',
                            reference: 'DEP-7',
                        },
                    ],
                    summary: {
                        initialized: true,
                        closing_balance: 1500,
                        opening_balance: 500,
                        incoming: 5000,
                        outgoing: 4000,
                        warehouse_id: 3,
                    },
                    categories: [],
                    warnings: [],
                    meta: { current_page: 1, last_page: 1 },
                },
            } as any;
        if (url === '/cash/payment-movements')
            return {
                data: {
                    data: [
                        {
                            scope: 'sales',
                            id: 1,
                            return_id: 8,
                            document_id: 9,
                            document_number: 'DEV-8',
                            method: 'cash',
                            amount: -20,
                        },
                    ],
                    last_page: 1,
                    filter_options: {
                        warehouses: [],
                        methods: [],
                        operators: [],
                        sessions: [],
                    },
                },
            } as any;
        if (url === '/cash/availability')
            return {
                data: {
                    data: { initialized: true, balance: 1500, warehouse_id: 3 },
                },
            } as any;
        return { data: { data: [] } } as any;
    });
});
it('usa totales completos y pagina sin recalcular la utilidad con la página visible', async () => {
    const wrapper = mount(SalesLinesReport);
    await flushPromises();
    expect(wrapper.text()).toContain('$1000');
    expect(wrapper.text()).toContain('35%');
    expect(wrapper.find('a[href="/sales-orders/9"]').exists()).toBe(true);
    await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Siguiente')!
        .trigger('click');
    await flushPromises();
    expect(apiClient.get).toHaveBeenLastCalledWith('/reports/sales-lines', {
        params: expect.objectContaining({ page: 2 }),
    });
});
it('identifica costos faltantes sin mostrar una utilidad fabricada', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
        data: {
            ...salesResult,
            summary: {
                net_sales: 1000,
                profit: null,
                cost: null,
                incomplete: true,
            },
        },
    });
    const wrapper = mount(SalesLinesReport);
    await flushPromises();
    expect(wrapper.text()).toContain('Rentabilidad incompleta');
    expect(wrapper.text()).toContain('No disponible');
});
it('conserva el efectivo total al filtrar el detalle y abre la transferencia correcta', async () => {
    const wrapper = mount(CashPositionReport);
    await flushPromises();
    expect(wrapper.text()).toContain('$1500');
    expect(wrapper.text()).toContain('$5000');
    expect(
        wrapper
            .find('a[href="/finance/transfers/create?from_warehouse_id=3"]')
            .exists(),
    ).toBe(true);
    expect(wrapper.find('a[href="/finance/transfers/7"]').exists()).toBe(true);
    const vm = wrapper.vm as any;
    vm.filters.kind = 'transfer';
    await vm.load(true);
    expect(apiClient.get).toHaveBeenCalledWith('/reports/cash-position', {
        params: expect.objectContaining({ kind: 'transfer' }),
    });
    expect(wrapper.text()).toContain('$1500');
});
it('comparte la consulta de Caja y enlaza la devolución, separando notas de crédito', async () => {
    const wrapper = mount(CashPaymentsReport, { props: { reportMode: true } });
    await flushPromises();
    expect(apiClient.get).toHaveBeenCalledWith('/cash/payment-movements', {
        params: expect.objectContaining({
            scope: 'sales',
            date_from: '2026-09-01',
            date_to: '2026-09-27',
        }),
    });
    expect(wrapper.find('a[href="/returns/8"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/reports/credit-notes"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Gastos y aportaciones');
});
it('resuelve accesos rápidos con límites de mes y dos meses', () => {
    expect(reportPeriod('previous')).toEqual({
        date_from: '2026-08-01',
        date_to: '2026-08-31',
    });
    expect(reportPeriod('two')).toEqual({
        date_from: '2026-08-01',
        date_to: '2026-09-27',
    });
    expect(reportPeriod('today')).toEqual({
        date_from: '2026-09-27',
        date_to: '2026-09-27',
    });
});

it('actualiza efectivo y banco juntos después de movimientos y no conserva un banco obsoleto ante un fallo', async () => {
    let balance = 40;
    const previous = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
        if (url === '/money-accounts/options')
            return {
                data: {
                    data: [
                        {
                            endpoint_id: 2,
                            name: 'Banco elegido',
                            currency: 'USD',
                            balance,
                        },
                    ],
                },
            } as any;
        return previous(url, config);
    });
    const wrapper = mount(CashPositionReport);
    await flushPromises();
    expect(wrapper.text()).toContain('Banco elegido');
    expect(wrapper.text()).toContain('$40');
    balance = 80;
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('$80');
    expect(
        vi
            .mocked(apiClient.get)
            .mock.calls.filter(([url]) => url === '/money-accounts/options'),
    ).toHaveLength(2);
    vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
        if (url === '/money-accounts/options') throw new Error('Red');
        return previous(url, config);
    });
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).not.toContain('Banco elegido');
    expect(wrapper.text()).toContain(
        'No se pudieron actualizar los saldos bancarios',
    );
    wrapper.unmount();
});

it('explica la falta de conteo inicial sin presentar cobros históricos como saldo físico', async () => {
    const previous = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
        if (url === '/reports/cash-position')
            return {
                data: {
                    data: [],
                    summary: {
                        initialized: false,
                        opening_balance: null,
                        closing_balance: null,
                        incoming: 0,
                        outgoing: 0,
                    },
                    categories: [],
                    warnings: ['Saldo sin inicializar.'],
                    meta: {},
                },
            } as any;
        return previous(url, config);
    });
    const wrapper = mount(CashPositionReport);
    await flushPromises();
    expect(wrapper.text()).toContain('Efectivo disponible');
    expect(wrapper.text()).toContain('No disponible');
    expect(wrapper.text()).toContain('confirmar el conteo inicial');
    expect(wrapper.text()).toContain('No hay cuentas bancarias disponibles');
    expect(wrapper.find('a[href="/cash/payments"]').exists()).toBe(true);
    wrapper.unmount();
});

it('usa el calendario de Resumen para aplicar, limpiar y restablecer el rango de efectivo', async () => {
    const wrapper = mount(CashPositionReport, {
        attachTo: document.body,
        props: {
            initialFilters: {
                date_from: '2026-08-10',
                date_to: '2026-08-15',
                warehouse_id: 3,
            },
        },
    });
    await flushPromises();
    await wrapper.get('select[aria-label="Consulta"]').setValue('period');
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
    expect(document.querySelectorAll('[role="dialog"] section')).toHaveLength(
        3,
    );
    (
        document.querySelector(
            '[data-calendar-day="2026-08-12"]',
        ) as HTMLButtonElement
    ).click();
    (
        document.querySelector(
            '[data-calendar-day="2026-08-14"]',
        ) as HTMLButtonElement
    ).click();
    [...document.querySelectorAll('[role="dialog"] button')]
        .find((b) => b.textContent?.trim() === 'Aplicar')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(apiClient.get).toHaveBeenCalledWith('/reports/cash-position', {
        params: expect.objectContaining({
            date_from: '2026-08-12',
            date_to: '2026-08-14',
            mode: 'period',
        }),
    });
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
    [...document.querySelectorAll('[role="dialog"] button')]
        .find((b) => b.textContent?.trim() === 'Limpiar')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    vi.mocked(apiClient.get).mockClear();
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Selecciona un rango de fechas completo');
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
    [...document.querySelectorAll('[role="dialog"] button')]
        .find((b) => b.textContent?.trim() === 'Este mes')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(apiClient.get).toHaveBeenCalledWith('/reports/cash-position', {
        params: expect.objectContaining({
            date_from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
            mode: 'period',
        }),
    });
    wrapper.unmount();
});
