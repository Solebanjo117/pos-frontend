// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import apiClient from '@/services/api/client';
import CashPositionReport from './CashPositionReport.vue';

vi.mock('@inertiajs/vue3', () => ({
    Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
}));
vi.mock('@/services/api/client', () => ({ default: { get: vi.fn() } }));
vi.mock('@/utils/formatters', () => ({
    formatCurrency: (amount: number) => `$${amount}`,
    formatReportDateTime: (date: string) => date,
    formatDateInputValue: () => '2026-10-04',
}));

const filters = {
    date_from: '2026-01-01',
    date_to: '2026-10-04',
    warehouse_id: 3,
};
let report: any;
beforeEach(() => {
    vi.clearAllMocks();
    report = {
        data: [
            {
                id: 1,
                row_key: 'sales:1',
                source_id: 1,
                origin: 'sales',
                kind: 'sale',
                amount: 120,
                balance: null,
                included_in_cash_balance: false,
                document_url: '/sales-orders/9',
                reference: 'SO-9',
                effective_at: '2026-06-20T17:00:00Z',
                occurred_at: '2026-06-20T17:00:00Z',
            },
        ],
        summary: {
            initialized: false,
            warehouse_id: 3,
            opening_balance: null,
            incoming: 120,
            outgoing: 0,
            closing_balance: null,
        },
        history_summary: {
            records_in_range: 1,
            untracked_records: 1,
            outside_range_records: 0,
        },
        warnings: ['Saldo sin inicializar.'],
        meta: { total: 1, current_page: 1, last_page: 1 },
    };
    vi.mocked(apiClient.get).mockImplementation(
        async (url) =>
            ({
                data:
                    url === '/reports/cash-position'
                        ? structuredClone(report)
                        : {
                              data: [],
                              filter_options: {
                                  methods: [],
                                  operators: [],
                                  sessions: [],
                              },
                          },
            }) as any,
    );
});

it('muestra documentos históricos sin inventar efectivo físico y conserva el rango en Disponible actual', async () => {
    const wrapper = mount(CashPositionReport, {
        props: { initialFilters: filters },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Historial de efectivo');
    expect(wrapper.text()).toContain('Documento histórico');
    expect(wrapper.text()).toContain('No calcula el saldo disponible');
    expect(wrapper.text()).toContain('No disponible');
    expect(wrapper.find('a[href="/sales-orders/9"]').exists()).toBe(true);
    expect(wrapper.find('a[href^="/finance/transfers/create"]').exists()).toBe(
        false,
    );
    expect(wrapper.find('button[aria-haspopup="dialog"]').exists()).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith('/reports/cash-position', {
        params: expect.objectContaining({
            date_from: filters.date_from,
            date_to: filters.date_to,
            mode: 'current',
        }),
    });
});

it('explica un rango vacío cuando hay documentos en otras fechas', async () => {
    report.data = [];
    report.meta.total = 0;
    report.history_summary = {
        records_in_range: 0,
        untracked_records: 0,
        outside_range_records: 15,
    };
    const wrapper = mount(CashPositionReport, {
        props: { initialFilters: { ...filters, date_from: '2026-09-01' } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain(
        'Sin registros de efectivo para este rango',
    );
    expect(wrapper.text()).toContain('Hay 15 registros en otras fechas');
    expect(wrapper.text()).toContain('Amplíe el rango');
});

it('impide transferir cuando existen documentos posteriores al corte sin trazabilidad', async () => {
    report.summary.initialized = true;
    report.warnings = [
        'Hay documentos sin registro en el libro posteriores al corte conciliado.',
    ];
    const wrapper = mount(CashPositionReport, {
        props: { initialFilters: filters },
    });
    await flushPromises();
    expect(wrapper.find('a[href^="/finance/transfers/create"]').exists()).toBe(
        false,
    );
    expect(wrapper.text()).toContain('Revisar conciliación');
    expect(wrapper.text()).toContain('No disponible');
});

it('rechaza rangos invertidos también en Disponible actual', async () => {
    const wrapper = mount(CashPositionReport, {
        props: { initialFilters: filters },
    });
    await flushPromises();
    vi.mocked(apiClient.get).mockClear();
    const vm = wrapper.vm as any;
    vm.filters.date_from = '2026-10-04';
    vm.filters.date_to = '2026-01-01';
    await vm.load(true);
    expect(apiClient.get).not.toHaveBeenCalled();
});
