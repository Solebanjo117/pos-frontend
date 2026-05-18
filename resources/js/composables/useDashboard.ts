import { ref } from 'vue';
import { DashboardApiService } from '@/services/dashboard';
import type {
    DashboardStats,
    TopProduct,
    LowStockProduct,
    InventorySummary,
    SalesChartData,
    CategorySales,
    TopCashier,
    RecentActivity,
} from '@/types/dashboard';

export function useDashboard() {
    const loading = ref(false);
    const error = ref<string | null>(null);

    const stats = ref<DashboardStats>({
        today_sales: 0,
        today_profit: 0,
        pending_orders: 0,
        low_stock_items: 0,
        active_alerts: 0,
        total_inventory_value: 0,
    });

    const topProducts = ref<TopProduct[]>([]);
    const lowStockProducts = ref<LowStockProduct[]>([]);
    const inventorySummary = ref<InventorySummary[]>([]);
    const chartData = ref<SalesChartData>({ labels: [], data: [], profit: [] });
    const profitByBrand = ref<any[]>([]);
    const salesByCategory = ref<CategorySales[]>([]);
    const topCashiers = ref<TopCashier[]>([]);
    const recentActivity = ref<RecentActivity[]>([]);

    /**
     * Fetch all dashboard data
     */
    const fetchDashboardData = async (
        warehouseId?: number | null,
        period: string = '7d',
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const data = await DashboardApiService.getDashboardData(
                warehouseId,
                period,
            );
            stats.value = data.stats;
            topProducts.value = data.top_products;
            lowStockProducts.value = data.low_stock_products;
            inventorySummary.value = data.inventory_summary;
            if (data.sales_chart) {
                chartData.value = data.sales_chart;
            }
            if (data.profit_by_brand) {
                profitByBrand.value = data.profit_by_brand;
            }
            if (data.sales_by_category) {
                salesByCategory.value = data.sales_by_category;
            }
            if (data.top_cashiers) {
                topCashiers.value = data.top_cashiers;
            }
            if (data.recent_activity) {
                recentActivity.value = data.recent_activity;
            }
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error al cargar datos del dashboard';
            console.error('Dashboard fetch error:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch only stats
     */
    const fetchStats = async (warehouseId?: number | null) => {
        loading.value = true;
        error.value = null;

        try {
            stats.value = await DashboardApiService.getStats(warehouseId);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar estadísticas';
            console.error('Stats fetch error:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch top products
     */
    const fetchTopProducts = async (
        warehouseId?: number | null,
        period: string = '30d',
    ) => {
        try {
            topProducts.value = await DashboardApiService.getTopProducts(
                warehouseId,
                period,
            );
        } catch (err: any) {
            console.error('Top products fetch error:', err);
        }
    };

    /**
     * Fetch low stock products
     */
    const fetchLowStockProducts = async (warehouseId?: number | null) => {
        try {
            lowStockProducts.value =
                await DashboardApiService.getLowStockProducts(warehouseId);
        } catch (err: any) {
            console.error('Low stock fetch error:', err);
        }
    };

    /**
     * Fetch sales chart data
     */
    const fetchSalesChartData = async (
        period: string = '7d',
        warehouseId?: number | null,
    ) => {
        try {
            chartData.value = await DashboardApiService.getSalesChartData(
                period,
                warehouseId,
            );
        } catch (err: any) {
            console.error('Sales chart fetch error:', err);
        }
    };

    return {
        // State
        loading,
        error,
        stats,
        topProducts,
        lowStockProducts,
        inventorySummary,
        chartData,
        profitByBrand,
        salesByCategory,
        topCashiers,
        recentActivity,

        // Methods
        fetchDashboardData,
        fetchStats,
        fetchTopProducts,
        fetchLowStockProducts,
        fetchSalesChartData,
    };
}
