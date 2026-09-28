import { ref } from 'vue';
import { ReportsApiService } from '@/services/reports';
import type {
    StockLevelsReport,
    StockLevelsFilters,
    MovementHistoryReport,
    MovementHistoryFilters,
    DailyFinancialSummary,
    BalanceSheetReport,
    CapitalMovement,
    FinancialDrilldownReport,
    FinancialAdvancedStatusReport,
    IncomeStatementReport,
    BrandProfitabilityRow,
    CategoryProfitabilityRow,
    LineProfitabilityApiRow,
    LineProfitabilityGroupBy,
    LineProfitabilityRow,
    SalesByProductFilters,
    SalesByProductReport,
    SalesByProductRow,
    SalesByProductSummary,
} from '@/types/report';

const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number): number =>
    Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Normaliza las filas de marca y categoria a una forma comun para la tabla.
 * El backend entrega `brand_id`/`brand_name` o `category_id`/`category_name`
 * segun el endpoint consultado.
 */
export const normalizeLineProfitabilityRows = (
    rows: LineProfitabilityApiRow[] | null | undefined,
    groupBy: LineProfitabilityGroupBy,
): LineProfitabilityRow[] => {
    if (!Array.isArray(rows)) return [];

    return rows.map((row, index) => {
        const id =
            groupBy === 'brand'
                ? (row as BrandProfitabilityRow).brand_id
                : (row as CategoryProfitabilityRow).category_id;
        const label =
            groupBy === 'brand'
                ? (row as BrandProfitabilityRow).brand_name
                : (row as CategoryProfitabilityRow).category_name;

        return {
            key: `${groupBy}-${id ?? `sin-asignar-${index}`}`,
            label:
                label || (groupBy === 'brand' ? 'Sin marca' : 'Sin categoria'),
            revenue: toNumber(row.revenue),
            cogs: toNumber(row.cogs),
            profit: toNumber(row.profit),
            items_sold: toNumber(row.items_sold),
            margin: toNumber(row.margin),
        };
    });
};

/**
 * Totales de la tabla de rentabilidad. El margen no se suma: se recalcula
 * sobre los totales para que la fila final sea el margen real del periodo.
 */
export const sumLineProfitability = (
    rows: LineProfitabilityRow[],
): Omit<LineProfitabilityRow, 'key' | 'label'> => {
    const totals = rows.reduce(
        (carry, row) => ({
            revenue: carry.revenue + toNumber(row.revenue),
            cogs: carry.cogs + toNumber(row.cogs),
            profit: carry.profit + toNumber(row.profit),
            items_sold: carry.items_sold + toNumber(row.items_sold),
        }),
        { revenue: 0, cogs: 0, profit: 0, items_sold: 0 },
    );

    return {
        revenue: roundMoney(totals.revenue),
        cogs: roundMoney(totals.cogs),
        profit: roundMoney(totals.profit),
        items_sold: roundMoney(totals.items_sold),
        margin:
            totals.revenue > 0
                ? roundMoney((totals.profit / totals.revenue) * 100)
                : 0,
    };
};

export const emptySalesByProductSummary = (): SalesByProductSummary => ({
    count: 0,
    quantity_sold: 0,
    quantity_returned: 0,
    gross_sales: 0,
    returns_amount: 0,
    net_sales: 0,
    cost: 0,
    profit: 0,
});

/**
 * Totales de ventas por producto. Se usa el `summary` del backend cuando
 * existe (cubre todas las paginas) y se suman las filas visibles si falta.
 */
export const sumSalesByProduct = (
    rows: SalesByProductRow[],
    summary?: SalesByProductSummary | null,
): SalesByProductSummary => {
    if (summary) {
        return {
            count: toNumber(summary.count),
            quantity_sold: toNumber(summary.quantity_sold),
            quantity_returned: toNumber(summary.quantity_returned),
            gross_sales: toNumber(summary.gross_sales),
            returns_amount: toNumber(summary.returns_amount),
            net_sales: toNumber(summary.net_sales),
            cost: toNumber(summary.cost),
            profit: toNumber(summary.profit),
        };
    }

    const totals = rows.reduce<SalesByProductSummary>(
        (carry, row) => ({
            ...carry,
            count: carry.count + 1,
            quantity_sold: carry.quantity_sold + toNumber(row.quantity_sold),
            quantity_returned:
                carry.quantity_returned + toNumber(row.quantity_returned),
            gross_sales: carry.gross_sales + toNumber(row.gross_sales),
            returns_amount: carry.returns_amount + toNumber(row.returns_amount),
            net_sales: carry.net_sales + toNumber(row.net_sales),
            cost: carry.cost + toNumber(row.cost),
        }),
        emptySalesByProductSummary(),
    );

    return {
        count: totals.count,
        quantity_sold: roundMoney(totals.quantity_sold),
        quantity_returned: roundMoney(totals.quantity_returned),
        gross_sales: roundMoney(totals.gross_sales),
        returns_amount: roundMoney(totals.returns_amount),
        net_sales: roundMoney(totals.net_sales),
        cost: roundMoney(totals.cost),
        profit: roundMoney(totals.net_sales - totals.cost),
    };
};

export function useReports() {
    const stockLevelsReport = ref<StockLevelsReport | null>(null);
    const movementHistoryReport = ref<MovementHistoryReport | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    /**
     * Fetch stock levels report
     */
    const fetchStockLevels = async (filters?: StockLevelsFilters) => {
        loading.value = true;
        error.value = null;

        try {
            stockLevelsReport.value =
                await ReportsApiService.getStockLevels(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching stock levels report';
            console.error('Error fetching stock levels:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch movement history report
     */
    const fetchMovementHistory = async (filters: MovementHistoryFilters) => {
        loading.value = true;
        error.value = null;

        try {
            movementHistoryReport.value =
                await ReportsApiService.getMovementHistory(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching movement history report';
            console.error('Error fetching movement history:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Export report
     */
    const exportReport = async (
        type: 'stock-levels' | 'movement-history',
        format: 'pdf' | 'excel',
        filters?: any,
    ) => {
        try {
            let blob: Blob;

            if (type === 'stock-levels') {
                blob = await ReportsApiService.exportStockLevels(
                    format,
                    filters,
                );
            } else {
                blob = await ReportsApiService.exportMovementHistory(
                    format,
                    filters,
                );
            }

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error exporting report';
            console.error('Error exporting report:', err);
            throw err;
        }
    };

    const financialReport = ref<any>(null);
    const incomeStatementReport = ref<IncomeStatementReport | null>(null);
    const financialPositionReport = ref<any>(null);
    const brandProfitabilityReport = ref<BrandProfitabilityRow[] | null>(null);
    const categoryProfitabilityReport = ref<CategoryProfitabilityRow[] | null>(
        null,
    );
    const salesByProductReport = ref<SalesByProductReport | null>(null);
    const zReport = ref<any>(null);
    const dailySummary = ref<DailyFinancialSummary | null>(null);
    const balanceSheet = ref<BalanceSheetReport | null>(null);
    const financialDrilldown = ref<FinancialDrilldownReport | null>(null);
    const financialAdvancedStatus = ref<FinancialAdvancedStatusReport | null>(
        null,
    );
    const capitalMovements = ref<CapitalMovement[]>([]);

    /**
     * Fetch financial report
     */
    const fetchFinancialReport = async (filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }) => {
        loading.value = true;
        error.value = null;

        try {
            financialReport.value =
                await ReportsApiService.getFinancialReport(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching financial report';
            console.error('Error fetching financial report:', err);
        } finally {
            loading.value = false;
        }
    };

    const fetchIncomeStatement = async (filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        basis?: 'cash' | 'accrual_operational';
        compare?: 'previous_period' | 'none';
    }) => {
        loading.value = true;
        error.value = null;

        try {
            incomeStatementReport.value =
                await ReportsApiService.getIncomeStatement(filters);
            financialReport.value = incomeStatementReport.value;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching income statement';
            console.error('Error fetching income statement:', err);
        } finally {
            loading.value = false;
        }
    };

    const fetchFinancialPosition = async (filters: {
        warehouse_id?: number | null;
        date_to?: string | null;
        mode?: 'current_snapshot' | 'as_of';
    }) => {
        loading.value = true;
        error.value = null;

        try {
            financialPositionReport.value =
                await ReportsApiService.getFinancialPosition(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching financial position';
            console.error('Error fetching financial position:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch brand profitability report
     */
    const fetchBrandProfitability = async (filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }) => {
        loading.value = true;
        error.value = null;

        try {
            // Unpack data if returned in a wrapper or directly assign
            const res = await ReportsApiService.getBrandProfitability(filters);
            brandProfitabilityReport.value = res.data ?? res;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching brand profitability';
            console.error('Error fetching brand profitability:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch category profitability report
     */
    const fetchCategoryProfitability = async (filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }) => {
        loading.value = true;
        error.value = null;

        try {
            const res =
                await ReportsApiService.getCategoryProfitability(filters);
            categoryProfitabilityReport.value = res.data ?? res;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching category profitability';
            console.error('Error fetching category profitability:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch sales by product report
     */
    const fetchSalesByProduct = async (filters: SalesByProductFilters) => {
        loading.value = true;
        error.value = null;

        try {
            salesByProductReport.value =
                await ReportsApiService.getSalesByProduct(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching sales by product';
            console.error('Error fetching sales by product:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch Z-Report
     */
    const fetchZReport = async (
        date: string,
        warehouse_id?: number,
        user_id?: number,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            zReport.value = await ReportsApiService.getZReport(
                date,
                warehouse_id,
                user_id,
            );
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching z-report';
            console.error('Error fetching z-report:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Export Z-Report
     */
    const exportZReport = async (
        date: string,
        warehouse_id?: number,
        user_id?: number,
    ) => {
        try {
            const blob = await ReportsApiService.exportZReport(
                date,
                warehouse_id,
                user_id,
            );

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `z-report-${date}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error exporting Z-Report';
            console.error('Error exporting Z-Report:', err);
            throw err;
        }
    };

    const fetchDailySummary = async (filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        rebuild?: boolean;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            dailySummary.value =
                await ReportsApiService.getDailySummary(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching daily summary';
        } finally {
            loading.value = false;
        }
    };

    const fetchFinancialSnapshots = async (filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        rebuild?: boolean;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            dailySummary.value =
                await ReportsApiService.getFinancialSnapshots(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching financial snapshots';
        } finally {
            loading.value = false;
        }
    };

    const fetchBalanceSheet = async (filters: {
        as_of?: string | null;
        date_from?: string | null;
        date_to?: string | null;
        warehouse_id?: number | null;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            balanceSheet.value =
                await ReportsApiService.getBalanceSheet(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching balance sheet';
        } finally {
            loading.value = false;
        }
    };

    const fetchFinancialDrilldown = async (filters: {
        metric: string;
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        expense_category?: string | null;
        expense_group?: string | null;
        page?: number;
        per_page?: number;
    }) => {
        try {
            financialDrilldown.value =
                await ReportsApiService.getFinancialDrilldown(filters);
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching financial detail';
            throw err;
        }
    };

    const fetchFinancialAdvancedStatus = async () => {
        try {
            financialAdvancedStatus.value =
                await ReportsApiService.getFinancialAdvancedStatus();
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error fetching advanced finance status';
            throw err;
        }
    };

    const storeCapitalMovement = async (payload: {
        movement_type: 'in' | 'out';
        amount: number;
        reason: string;
        movement_date: string;
        warehouse_id?: number | null;
        notes?: string | null;
        idempotency_key: string;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            await ReportsApiService.createCapitalMovement(payload);
            await fetchCapitalMovements({
                date_from: payload.movement_date,
                date_to: payload.movement_date,
                warehouse_id: payload.warehouse_id,
            });
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error creating capital movement';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const fetchCapitalMovements = async (filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number | null;
    }) => {
        try {
            capitalMovements.value =
                await ReportsApiService.getCapitalMovements(filters);
        } catch (err: any) {
            console.error('Error fetching capital movements:', err);
        }
    };

    return {
        stockLevelsReport,
        movementHistoryReport,
        financialReport,
        incomeStatementReport,
        financialPositionReport,
        brandProfitabilityReport,
        categoryProfitabilityReport,
        salesByProductReport,
        zReport,
        dailySummary,
        balanceSheet,
        financialDrilldown,
        financialAdvancedStatus,
        capitalMovements,
        loading,
        error,
        fetchStockLevels,
        fetchMovementHistory,
        exportReport,
        fetchFinancialReport,
        fetchIncomeStatement,
        fetchFinancialPosition,
        fetchBrandProfitability,
        fetchCategoryProfitability,
        fetchSalesByProduct,
        fetchZReport,
        exportZReport,
        fetchDailySummary,
        fetchFinancialSnapshots,
        fetchBalanceSheet,
        fetchFinancialDrilldown,
        fetchFinancialAdvancedStatus,
        storeCapitalMovement,
        fetchCapitalMovements,
    };
}
