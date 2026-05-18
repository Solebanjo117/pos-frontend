import { ref } from 'vue';
import { ReportsApiService } from '@/services/reports';
import type {
    StockLevelsReport,
    StockLevelsFilters,
    MovementHistoryReport,
    MovementHistoryFilters,
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
    const brandProfitabilityReport = ref<any[] | null>(null);
    const categoryProfitabilityReport = ref<any[] | null>(null);
    const zReport = ref<any>(null);

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

    return {
        stockLevelsReport,
        movementHistoryReport,
        financialReport,
        brandProfitabilityReport,
        categoryProfitabilityReport,
        zReport,
        loading,
        error,
        fetchStockLevels,
        fetchMovementHistory,
        exportReport,
        fetchFinancialReport,
        fetchBrandProfitability,
        fetchCategoryProfitability,
        fetchZReport,
        exportZReport,
    };
}
