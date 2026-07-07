import { ref } from 'vue';
import { ReportsApiService } from '@/services/reports';
import type {
    StockLevelsReport,
    StockLevelsFilters,
    MovementHistoryReport,
    MovementHistoryFilters,
    DailyFinancialSummary,
    BalanceSheetReport,
    FinancialAdjustment,
    FinancialAdjustmentType,
    CapitalMovement,
    FinancialDrilldownReport,
    FinancialAdvancedStatusReport,
} from '@/types/report';

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
    const incomeStatementReport = ref<any>(null);
    const financialPositionReport = ref<any>(null);
    const brandProfitabilityReport = ref<any[] | null>(null);
    const categoryProfitabilityReport = ref<any[] | null>(null);
    const zReport = ref<any>(null);
    const dailySummary = ref<DailyFinancialSummary | null>(null);
    const balanceSheet = ref<BalanceSheetReport | null>(null);
    const financialDrilldown = ref<FinancialDrilldownReport | null>(null);
    const financialAdvancedStatus = ref<FinancialAdvancedStatusReport | null>(
        null,
    );
    const adjustments = ref<FinancialAdjustment[]>([]);
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

    const storeAdjustment = async (payload: {
        type: FinancialAdjustmentType;
        amount: number;
        reason: string;
        adjustment_date: string;
        warehouse_id?: number | null;
        notes?: string | null;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            await ReportsApiService.createAdjustment(payload);
            await fetchAdjustments({
                date_from: payload.adjustment_date,
                date_to: payload.adjustment_date,
                warehouse_id: payload.warehouse_id,
            });
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error creating adjustment';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const fetchAdjustments = async (filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number | null;
    }) => {
        try {
            adjustments.value = await ReportsApiService.getAdjustments(filters);
        } catch (err: any) {
            console.error('Error fetching adjustments:', err);
        }
    };

    const storeCapitalMovement = async (payload: {
        movement_type: 'in' | 'out';
        amount: number;
        reason: string;
        movement_date: string;
        warehouse_id?: number | null;
        notes?: string | null;
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
        zReport,
        dailySummary,
        balanceSheet,
        financialDrilldown,
        financialAdvancedStatus,
        adjustments,
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
        fetchZReport,
        exportZReport,
        fetchDailySummary,
        fetchFinancialSnapshots,
        fetchBalanceSheet,
        fetchFinancialDrilldown,
        fetchFinancialAdvancedStatus,
        storeAdjustment,
        fetchAdjustments,
        storeCapitalMovement,
        fetchCapitalMovements,
    };
}
