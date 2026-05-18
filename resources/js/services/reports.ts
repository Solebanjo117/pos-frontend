import apiClient from './api/client';
import type {
    StockLevelsReport,
    StockLevelsFilters,
    MovementHistoryReport,
    MovementHistoryFilters,
    FinancialReport,
} from '@/types/report';

export const ReportsApiService = {
    /**
     * Get stock levels report
     */
    async getStockLevels(
        filters?: StockLevelsFilters,
    ): Promise<StockLevelsReport> {
        const response = await apiClient.get('/reports/stock-levels', {
            params: filters,
        });
        return response.data;
    },

    /**
     * Get movement history report
     */
    async getMovementHistory(
        filters: MovementHistoryFilters,
    ): Promise<MovementHistoryReport> {
        const response = await apiClient.get('/reports/movement-history', {
            params: filters,
        });
        return response.data;
    },

    /**
     * Export stock levels report
     */
    async exportStockLevels(
        format: 'pdf' | 'excel',
        filters?: StockLevelsFilters,
    ): Promise<Blob> {
        const response = await apiClient.get(
            `/reports/stock-levels/export/${format}`,
            {
                params: filters,
                responseType: 'blob',
            },
        );
        return response.data;
    },

    /**
     * Export movement history report
     */
    async exportMovementHistory(
        format: 'pdf' | 'excel',
        filters: MovementHistoryFilters,
    ): Promise<Blob> {
        const response = await apiClient.get(
            `/reports/movement-history/export/${format}`,
            {
                params: filters,
                responseType: 'blob',
            },
        );
        return response.data;
    },

    /**
     * Get financial report
     */
    async getFinancialReport(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }): Promise<FinancialReport> {
        const response = await apiClient.get('/reports/financial', {
            params: filters,
        });
        return response.data;
    },

    /**
     * Get brand profitability report
     */
    async getBrandProfitability(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }): Promise<any> {
        const response = await apiClient.get('/reports/brand-profitability', {
            params: filters,
        });
        return response.data;
    },

    /**
     * Get category profitability report
     */
    async getCategoryProfitability(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }): Promise<any> {
        const response = await apiClient.get(
            '/reports/category-profitability',
            {
                params: filters,
            },
        );
        return response.data;
    },

    /**
     * Get Z-Report
     */
    async getZReport(
        date: string,
        warehouse_id?: number,
        user_id?: number,
    ): Promise<any> {
        const response = await apiClient.get('/reports/z-report', {
            params: { date, warehouse_id, user_id },
        });
        return response.data;
    },

    /**
     * Export Z-Report
     */
    async exportZReport(
        date: string,
        warehouse_id?: number,
        user_id?: number,
    ): Promise<Blob> {
        const response = await apiClient.get(`/reports/z-report/export`, {
            params: { date, warehouse_id, user_id },
            responseType: 'blob',
        });
        return response.data;
    },
};
