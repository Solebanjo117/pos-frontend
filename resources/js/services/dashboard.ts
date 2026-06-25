import type {
    DashboardStats,
    DashboardData,
    DashboardFilters,
    TopProduct,
    LowStockProduct,
    InventorySummary,
    ReorderAlert,
    SalesChartData,
} from '@/types/dashboard';
import apiClient from './api/client';

const BASE_PATH = '/dashboard';

/**
 * Dashboard API Service
 */
export const DashboardApiService = {
    /**
     * Get all dashboard data in one request
     */
    async getDashboardData(
        warehouseIdOrFilters?: number | null | DashboardFilters,
        period: string = '7d',
    ): Promise<DashboardData> {
        const params = new URLSearchParams();
        const filters =
            typeof warehouseIdOrFilters === 'object'
                ? warehouseIdOrFilters
                : {
                      warehouse_id: warehouseIdOrFilters,
                      period,
                  };

        if (filters?.warehouse_id) {
            params.append('warehouse_id', filters.warehouse_id.toString());
        }
        if (filters?.period) {
            params.append('period', filters.period);
        }
        if (filters?.date_from) {
            params.append('date_from', filters.date_from);
        }
        if (filters?.date_to) {
            params.append('date_to', filters.date_to);
        }
        if (filters?.compare) {
            params.append('compare', 'true');
        }

        const response = await apiClient.get<{ data: DashboardData }>(
            `${BASE_PATH}?${params.toString()}`,
        );
        return response.data.data;
    },

    /**
     * Get dashboard statistics
     */
    async getStats(warehouseId?: number | null): Promise<DashboardStats> {
        const params = new URLSearchParams();
        if (warehouseId) params.append('warehouse_id', warehouseId.toString());

        const response = await apiClient.get<{ data: DashboardStats }>(
            `${BASE_PATH}/stats?${params.toString()}`,
        );
        return response.data.data;
    },

    /**
     * Get top selling products
     */
    async getTopProducts(
        warehouseId?: number | null,
        period: string = '30d',
        limit: number = 5,
    ): Promise<TopProduct[]> {
        const params = new URLSearchParams();
        if (warehouseId) params.append('warehouse_id', warehouseId.toString());
        if (period) params.append('period', period);
        if (limit) params.append('limit', limit.toString());

        const response = await apiClient.get<{ data: TopProduct[] }>(
            `${BASE_PATH}/top-products?${params.toString()}`,
        );
        return response.data.data;
    },

    /**
     * Get products with low stock
     */
    async getLowStockProducts(
        warehouseId?: number | null,
        limit: number = 10,
    ): Promise<LowStockProduct[]> {
        const params = new URLSearchParams();
        if (warehouseId) params.append('warehouse_id', warehouseId.toString());
        if (limit) params.append('limit', limit.toString());

        const response = await apiClient.get<{ data: LowStockProduct[] }>(
            `${BASE_PATH}/low-stock?${params.toString()}`,
        );
        return response.data.data;
    },

    /**
     * Get inventory summary by warehouse
     */
    async getInventorySummary(
        warehouseId?: number | null,
    ): Promise<InventorySummary[]> {
        const params = new URLSearchParams();
        if (warehouseId) params.append('warehouse_id', warehouseId.toString());

        const response = await apiClient.get<{ data: InventorySummary[] }>(
            `${BASE_PATH}/inventory-summary?${params.toString()}`,
        );
        return response.data.data;
    },

    /**
     * Get products that need reordering
     */
    async getReorderAlerts(
        warehouseId?: number | null,
    ): Promise<ReorderAlert[]> {
        const params = new URLSearchParams();
        if (warehouseId) params.append('warehouse_id', warehouseId.toString());

        const response = await apiClient.get<{ data: ReorderAlert[] }>(
            `${BASE_PATH}/reorder-alerts?${params.toString()}`,
        );
        return response.data.data;
    },

    /**
     * Get sales chart data
     */
    async getSalesChartData(
        period: string = '7d',
        warehouseId?: number | null,
    ): Promise<SalesChartData> {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (warehouseId) params.append('warehouse_id', warehouseId.toString());

        const response = await apiClient.get<{ data: SalesChartData }>(
            `${BASE_PATH}/sales-chart?${params.toString()}`,
        );
        return response.data.data;
    },
};
