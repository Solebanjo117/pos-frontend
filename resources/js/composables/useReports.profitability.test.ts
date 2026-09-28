import { describe, expect, it, vi } from 'vitest';
import {
    emptySalesByProductSummary,
    normalizeLineProfitabilityRows,
    sumLineProfitability,
    sumSalesByProduct,
    useReports,
} from './useReports';

vi.mock('@/services/api/client', () => ({
    default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

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
        brand_id: null,
        brand_name: 'Sin Marca',
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

describe('normalizeLineProfitabilityRows', () => {
    it('mapea marcas a la forma comun de la tabla', () => {
        expect(normalizeLineProfitabilityRows(brandRows, 'brand')).toEqual([
            {
                key: 'brand-3',
                label: 'Bosch',
                revenue: 1000,
                cogs: 600,
                profit: 400,
                items_sold: 10,
                margin: 40,
            },
            {
                key: 'brand-sin-asignar-1',
                label: 'Sin Marca',
                revenue: 250.5,
                cogs: 300.25,
                profit: -49.75,
                items_sold: 3,
                margin: -19.86,
            },
        ]);
    });

    it('mapea categorias usando category_id y category_name', () => {
        const rows = normalizeLineProfitabilityRows(categoryRows, 'category');

        expect(rows).toHaveLength(1);
        expect(rows[0].key).toBe('category-7');
        expect(rows[0].label).toBe('Filtros');
        expect(rows[0].margin).toBe(60);
    });

    it('usa una etiqueta por defecto y tolera respuestas vacias', () => {
        expect(normalizeLineProfitabilityRows(null, 'brand')).toEqual([]);
        expect(normalizeLineProfitabilityRows(undefined, 'category')).toEqual(
            [],
        );
        expect(
            normalizeLineProfitabilityRows(
                [{ brand_id: null, brand_name: '' } as never],
                'brand',
            )[0].label,
        ).toBe('Sin marca');
        expect(
            normalizeLineProfitabilityRows(
                [{ category_id: null, category_name: '' } as never],
                'category',
            )[0].label,
        ).toBe('Sin categoria');
    });

    it('convierte valores numericos entregados como texto', () => {
        const rows = normalizeLineProfitabilityRows(
            [
                {
                    brand_id: 1,
                    brand_name: 'Mann',
                    revenue: '120.50',
                    cogs: '80',
                    profit: '40.50',
                    items_sold: '4',
                    margin: '33.61',
                } as never,
            ],
            'brand',
        );

        expect(rows[0]).toMatchObject({
            revenue: 120.5,
            cogs: 80,
            profit: 40.5,
            items_sold: 4,
            margin: 33.61,
        });
    });
});

describe('sumLineProfitability', () => {
    it('suma los importes y recalcula el margen sobre los totales', () => {
        const totals = sumLineProfitability(
            normalizeLineProfitabilityRows(brandRows, 'brand'),
        );

        expect(totals).toEqual({
            revenue: 1250.5,
            cogs: 900.25,
            profit: 350.25,
            items_sold: 13,
            margin: 28.01,
        });
    });

    it('no suma los margenes individuales', () => {
        const totals = sumLineProfitability(
            normalizeLineProfitabilityRows(brandRows, 'brand'),
        );

        expect(totals.margin).not.toBe(40 + -19.86);
    });

    it('devuelve margen cero cuando no hay ingresos', () => {
        expect(
            sumLineProfitability([
                {
                    key: 'brand-1',
                    label: 'Sin ventas',
                    revenue: 0,
                    cogs: 0,
                    profit: 0,
                    items_sold: 0,
                    margin: 0,
                },
            ]),
        ).toMatchObject({ revenue: 0, margin: 0 });

        expect(sumLineProfitability([])).toEqual({
            revenue: 0,
            cogs: 0,
            profit: 0,
            items_sold: 0,
            margin: 0,
        });
    });
});

describe('sumSalesByProduct', () => {
    const rows = [
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
        {
            product_id: 4,
            variant_id: null,
            product_name: 'Bujia',
            sku: 'BUJ-9',
            quantity_sold: 5,
            quantity_returned: 0,
            gross_sales: 75.25,
            returns_amount: 0,
            net_sales: 75.25,
            cost: 40.1,
            profit: 35.15,
        },
    ];

    it('prefiere el summary del backend porque cubre todas las paginas', () => {
        const summary = {
            count: 40,
            quantity_sold: 120,
            quantity_returned: 4,
            gross_sales: 4000,
            returns_amount: 200,
            net_sales: 3800,
            cost: 2400,
            profit: 1400,
        };

        expect(sumSalesByProduct(rows, summary)).toEqual(summary);
    });

    it('suma las filas visibles cuando el backend no envia summary', () => {
        expect(sumSalesByProduct(rows)).toEqual({
            count: 2,
            quantity_sold: 7,
            quantity_returned: 1,
            gross_sales: 175.25,
            returns_amount: 50,
            net_sales: 125.25,
            cost: 60.1,
            profit: 65.15,
        });
    });

    it('devuelve ceros sin filas ni summary', () => {
        expect(sumSalesByProduct([])).toEqual(emptySalesByProductSummary());
    });
});

describe('useReports fetchers de rentabilidad y ventas', () => {
    it('consulta el endpoint de ventas por producto y guarda la respuesta', async () => {
        const apiClient = (await import('@/services/api/client')).default;
        const payload = {
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
                count: 1,
                quantity_sold: 2,
                quantity_returned: 1,
                gross_sales: 100,
                returns_amount: 50,
                net_sales: 50,
                cost: 20,
                profit: 30,
            },
            meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
        };
        vi.mocked(apiClient.get).mockResolvedValue({ data: payload });

        const { fetchSalesByProduct, salesByProductReport } = useReports();
        await fetchSalesByProduct({
            date_from: '2026-07-01',
            date_to: '2026-07-31',
            warehouse_id: 2,
            page: 1,
            per_page: 25,
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            '/reports/sales-by-product',
            {
                params: {
                    date_from: '2026-07-01',
                    date_to: '2026-07-31',
                    warehouse_id: 2,
                    page: 1,
                    per_page: 25,
                },
            },
        );
        expect(salesByProductReport.value).toEqual(payload);
    });

    it('desempaqueta data en los reportes de rentabilidad', async () => {
        const apiClient = (await import('@/services/api/client')).default;
        vi.mocked(apiClient.get).mockResolvedValue({
            data: { data: categoryRows },
        });

        const { fetchCategoryProfitability, categoryProfitabilityReport } =
            useReports();
        await fetchCategoryProfitability({
            date_from: '2026-07-01',
            date_to: '2026-07-31',
            warehouse_id: null,
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            '/reports/category-profitability',
            {
                params: {
                    date_from: '2026-07-01',
                    date_to: '2026-07-31',
                    warehouse_id: null,
                },
            },
        );
        expect(categoryProfitabilityReport.value).toEqual(categoryRows);
    });
});
