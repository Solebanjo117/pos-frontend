// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import SalesLinesReport from '@/components/Finance/SalesLinesReport.vue';
import type * as ReportsModule from '@/composables/useReports';
import apiClient from '@/services/api/client';
import Financial from './Financial.vue';
vi.mock('@/services/api/client', () => ({ default: { get: vi.fn() } }));

const mocks = vi.hoisted(() => ({
    brandProfitabilityReport: { __v_isRef: true, value: null as any },
    categoryProfitabilityReport: { __v_isRef: true, value: null as any },
    salesByProductReport: { __v_isRef: true, value: null as any },
    fetchBrandProfitability: vi.fn(),
    fetchCategoryProfitability: vi.fn(),
    fetchSalesByProduct: vi.fn(),
}));

vi.mock('@/composables/useReports', async () => {
    const actual = await vi.importActual<typeof ReportsModule>(
        '@/composables/useReports',
    );

    return {
        ...actual,
        useReports: () => ({
            incomeStatementReport: ref(null),
            dailySummary: ref(null),
            balanceSheet: ref(null),
            financialDrilldown: ref(null),
            financialAdvancedStatus: ref(null),
            capitalMovements: ref([]),
            brandProfitabilityReport: mocks.brandProfitabilityReport,
            categoryProfitabilityReport: mocks.categoryProfitabilityReport,
            salesByProductReport: mocks.salesByProductReport,
            error: ref(null),
            fetchIncomeStatement: vi.fn().mockResolvedValue(undefined),
            fetchDailySummary: vi.fn().mockResolvedValue(undefined),
            fetchBalanceSheet: vi.fn().mockResolvedValue(undefined),
            fetchFinancialDrilldown: vi.fn().mockResolvedValue(undefined),
            fetchFinancialAdvancedStatus: vi.fn().mockResolvedValue(undefined),
            fetchBrandProfitability: mocks.fetchBrandProfitability,
            fetchCategoryProfitability: mocks.fetchCategoryProfitability,
            fetchSalesByProduct: mocks.fetchSalesByProduct,
            storeCapitalMovement: vi.fn().mockResolvedValue(undefined),
            fetchCapitalMovements: vi.fn().mockResolvedValue(undefined),
        }),
    };
});

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({
        currentWarehouseId: ref(2),
        initWarehouse: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('@/composables/useStoreSettings', () => ({
    useStoreSettings: () => ({
        fetchSettings: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div><slot /></div>' },
    Link: { template: '<a><slot /></a>' },
}));

const global = {
    stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        FinanceReportShell: {
            template: '<div><slot name="actions" /><slot /></div>',
        },
        FinanceKpiRow: true,
        FinanceDailySummaryTable: true,
        FinanceBalanceSheet: true,
        FinanceIncomeStatement: true,
        FinanceAdvancedAccountingPanel: true,
        FinancialDrilldownDrawer: true,
        TransactionTraceDrawer: true,
        CapitalMovementModal: true,
        BusinessDatetimeEditor: true,
        TraceableCell: true,
        DateRangeInput: true,
        Button: { template: '<button><slot /></button>' },
    },
};

const brandRows = [
    {
        brand_id: 3,
        brand_name: 'Bosch',
        revenue: 1000,
        cogs: 600,
        profit: 400,
        items_sold: 10,
        margin: 40,
    },
    {
        brand_id: 5,
        brand_name: 'Mann',
        revenue: 250.5,
        cogs: 300.25,
        profit: -49.75,
        items_sold: 3,
        margin: -19.86,
    },
];

const categoryRows = [
    {
        category_id: 7,
        category_name: 'Filtros',
        revenue: 500,
        cogs: 200,
        profit: 300,
        items_sold: 5,
        margin: 60,
    },
];

const setUrl = (search: string): void => {
    window.history.replaceState({}, '', `/reports/financial${search}`);
};

const mountAt = async (search: string) => {
    setUrl(search);
    const wrapper = mount(Financial, { global });
    await flushPromises();
    return wrapper;
};

describe('Reporte financiero: pestanas de rentabilidad y ventas', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
            if (url !== '/reports/sales-lines')
                return { data: { data: [] } } as any;
            const params = config?.params;
            if (params.group_by === 'brand' || params.group_by === 'category') {
                const rows =
                    params.group_by === 'brand' ? brandRows : categoryRows;
                const data = rows.map((row) => ({
                    ...row,
                    net_sales: row.revenue,
                    cost: row.cogs,
                    quantity_sold: row.items_sold,
                    quantity_returned: 0,
                    discounts: 0,
                }));
                const net_sales = data.reduce(
                    (sum, row) => sum + row.net_sales,
                    0,
                );
                const cost = data.reduce((sum, row) => sum + row.cost, 0);
                return {
                    data: {
                        data,
                        summary: {
                            net_sales,
                            cost,
                            profit: net_sales - cost,
                            margin:
                                Math.round(
                                    ((net_sales - cost) / net_sales) * 10000,
                                ) / 100,
                            quantity_sold: data.reduce(
                                (sum, row) => sum + row.quantity_sold,
                                0,
                            ),
                        },
                        warnings: [],
                        meta: {
                            current_page: 1,
                            last_page: 1,
                            total: rows.length,
                        },
                    },
                } as any;
            }
            return {
                data: mocks.salesByProductReport.value ?? {
                    data: [],
                    summary: {},
                    warnings: [],
                    meta: { current_page: 1, last_page: 1, total: 0 },
                },
            } as any;
        });
        mocks.brandProfitabilityReport.value = null;
        mocks.categoryProfitabilityReport.value = null;
        mocks.salesByProductReport.value = null;
        mocks.fetchBrandProfitability.mockImplementation(async () => {
            mocks.brandProfitabilityReport.value = brandRows;
        });
        mocks.fetchCategoryProfitability.mockImplementation(async () => {
            mocks.categoryProfitabilityReport.value = categoryRows;
        });
        mocks.fetchSalesByProduct.mockResolvedValue(undefined);
    });

    it('expone las dos pestanas nuevas en la navegacion', async () => {
        const wrapper = await mountAt('');
        const labels = wrapper.findAll('nav button').map((tab) => tab.text());

        expect(labels).toContain('Rentabilidad por linea');
        expect(labels).toContain('Ventas');
    });

    it('no consulta los endpoints nuevos mientras la pestana no este activa', async () => {
        await mountAt('');

        expect(mocks.fetchBrandProfitability).not.toHaveBeenCalled();
        expect(mocks.fetchSalesByProduct).not.toHaveBeenCalled();
    });

    it('carga rentabilidad por marca al abrir la pestana y escribe el tab en la URL', async () => {
        const wrapper = await mountAt('');
        const tab = wrapper
            .findAll('nav button')
            .find((button) => button.text() === 'Rentabilidad por linea')!;

        await tab.trigger('click');
        await flushPromises();

        expect(apiClient.get).toHaveBeenCalledWith('/reports/sales-lines', {
            params: expect.objectContaining({
                date_from: expect.any(String),
                date_to: expect.any(String),
                group_by: 'brand',
            }),
        });
        expect(window.location.search).toContain('tab=line_profitability');
    });

    it('muestra la fila de totales con el margen recalculado', async () => {
        mocks.brandProfitabilityReport.value = brandRows;
        const wrapper = await mountAt('?tab=line_profitability');

        const bodyRows = wrapper.findAll('tbody tr');
        expect(bodyRows).toHaveLength(2);
        expect(bodyRows[0].text()).toContain('Bosch');

        const totals = wrapper.text();
        expect(
            (wrapper.findComponent(SalesLinesReport).vm as any).result.summary
                .quantity_sold,
        ).toBe(13);
        expect(
            wrapper
                .findAll('tbody tr')
                .map((row) => row.text())
                .join(' '),
        ).toContain('10');
        expect(totals).toContain('$1,250.50');
        expect(totals).toContain('$900.25');
        expect(totals).toContain('$350.25');
        expect(totals).toContain('28.01%');
    });

    it('conmuta entre marca y categoria y repinta la tabla', async () => {
        mocks.brandProfitabilityReport.value = brandRows;
        const wrapper = await mountAt('?tab=line_profitability');

        expect(
            (
                wrapper.find('select[aria-label="Agrupar"]')
                    .element as HTMLSelectElement
            ).value,
        ).toBe('brand');
        expect(wrapper.find('tbody').text()).toContain('Bosch');

        await wrapper.find('select[aria-label="Agrupar"]').setValue('category');
        await flushPromises();

        expect(apiClient.get).toHaveBeenCalledWith('/reports/sales-lines', {
            params: expect.objectContaining({ group_by: 'category' }),
        });
        expect(
            (
                wrapper.find('select[aria-label="Agrupar"]')
                    .element as HTMLSelectElement
            ).value,
        ).toBe('category');
        expect(wrapper.find('tbody').text()).toContain('Filtros');
        expect(wrapper.find('tbody').text()).not.toContain('Bosch');

        const totals = wrapper.text();
        expect(totals).toContain('$500.00');
        expect(totals).toContain('60%');
    });

    it('reutiliza la marca ya cargada al volver del agrupador de categoria', async () => {
        mocks.brandProfitabilityReport.value = brandRows;
        const wrapper = await mountAt('?tab=line_profitability');

        // Al montar con la pestana activa el rango vigente se recarga una vez.
        expect(
            vi
                .mocked(apiClient.get)
                .mock.calls.filter(([url]) => url === '/reports/sales-lines'),
        ).toHaveLength(1);

        await wrapper.find('select[aria-label="Agrupar"]').setValue('category');
        await flushPromises();

        vi.mocked(apiClient.get).mockClear();
        await wrapper.find('select[aria-label="Agrupar"]').setValue('brand');
        await flushPromises();

        expect(apiClient.get).not.toHaveBeenCalled();
        expect(wrapper.find('tbody').text()).toContain('Bosch');
    });

    it('usa el summary del backend para los totales de ventas por producto', async () => {
        mocks.salesByProductReport.value = {
            data: [
                {
                    product_id: 1,
                    variant_id: 2,
                    product_name: 'Filtro de aceite',
                    sku: 'FIL-1',
                    quantity_sold: 2,
                    quantity_returned: 1,
                    gross_sales: 100,
                    returns_amount: 50,
                    net_sales: 50,
                    cost: 20,
                    profit: 30,
                },
            ],
            summary: {
                count: 12,
                quantity_sold: 40,
                quantity_returned: 3,
                gross_sales: 2000,
                returns_amount: 150,
                net_sales: 1850,
                cost: 1100,
                profit: 750,
            },
            meta: { current_page: 1, last_page: 3, per_page: 25, total: 12 },
        };
        const wrapper = await mountAt('?tab=sales');

        expect(wrapper.find('tbody').text()).toContain('Filtro de aceite');
        expect(wrapper.find('tbody').text()).toContain('FIL-1');

        const totals = wrapper.text();
        expect(
            (wrapper.findComponent(SalesLinesReport).vm as any).result.meta
                .total,
        ).toBe(12);
        expect(
            (wrapper.findComponent(SalesLinesReport).vm as any).result.summary
                .quantity_sold,
        ).toBe(40);
        expect(
            (wrapper.findComponent(SalesLinesReport).vm as any).result.summary
                .quantity_returned,
        ).toBe(3);
        expect(totals).toContain('$2,000.00');
        expect(totals).toContain('$150.00');
        expect(totals).toContain('$1,850.00');
        expect(totals).toContain('$1,100.00');
        expect(totals).toContain('$750.00');
    });

    it('pagina ventas por producto respetando el ultimo page del backend', async () => {
        mocks.salesByProductReport.value = {
            data: [
                {
                    product_id: 1,
                    variant_id: null,
                    product_name: 'Bujia',
                    sku: 'BUJ-9',
                    quantity_sold: 1,
                    quantity_returned: 0,
                    gross_sales: 10,
                    returns_amount: 0,
                    net_sales: 10,
                    cost: 4,
                    profit: 6,
                },
            ],
            summary: {
                count: 1,
                quantity_sold: 1,
                quantity_returned: 0,
                gross_sales: 10,
                returns_amount: 0,
                net_sales: 10,
                cost: 4,
                profit: 6,
            },
            meta: { current_page: 1, last_page: 2, per_page: 25, total: 30 },
        };
        const wrapper = await mountAt('?tab=sales');
        const vm = wrapper.findComponent(SalesLinesReport).vm as any;

        vm.changePage(2);
        await flushPromises();
        expect(apiClient.get).toHaveBeenLastCalledWith('/reports/sales-lines', {
            params: expect.objectContaining({ page: 2, per_page: 25 }),
        });

        vi.mocked(apiClient.get).mockClear();
        vm.changePage(9);
        await flushPromises();
        expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('envia el texto de busqueda y vuelve a la primera pagina', async () => {
        const wrapper = await mountAt('?tab=sales');
        const vm = wrapper.findComponent(SalesLinesReport).vm as any;

        vi.mocked(apiClient.get).mockClear();
        vm.filters.search = '  filtro  ';
        vm.filters.page = 4;
        await vm.load(true);
        await flushPromises();

        expect(apiClient.get).toHaveBeenCalledWith('/reports/sales-lines', {
            params: expect.objectContaining({ search: 'filtro', page: 1 }),
        });
    });
});
