// Dashboard Types
export interface DashboardStats {
    today_sales: number;
    today_profit: number;
    pending_orders: number;
    low_stock_items: number;
    active_alerts: number;
    total_inventory_value: number;
}

export interface DashboardPeriod {
    key: string;
    date_from: string;
    date_to: string;
    previous_date_from: string;
    previous_date_to: string;
}

export interface DashboardKpiComparison {
    previous_value: number | null;
    formatted_previous_value: string;
    delta_percentage: number | null;
}

export interface DashboardFinancialKpi {
    key: string;
    label: string;
    value: number;
    formatted_value: string;
    route: string;
    tone: string;
    comparison: DashboardKpiComparison | null;
}

export interface DashboardPaymentMethod {
    method: string;
    label: string;
    amount: number;
    percentage: number;
}

export interface DashboardTopClient {
    customer_id: number;
    name: string;
    total_revenue: number;
    pending_amount: number;
    orders_count: number;
    route: string;
}

export interface DashboardLatestTransaction {
    id: number;
    type: string;
    label: string;
    customer_id: number | null;
    customer_name?: string | null;
    reference: string | null;
    amount: number;
    method: string;
    occurred_at: string | null;
    route: string | null;
}

export interface DashboardAlert {
    type: string;
    severity: 'info' | 'attention' | 'warning' | string;
    label: string;
    value: number;
    route: string;
}

export interface DashboardFinancial {
    period: DashboardPeriod;
    kpis: DashboardFinancialKpi[];
    payment_methods: DashboardPaymentMethod[];
    top_clients: DashboardTopClient[];
    latest_transactions: DashboardLatestTransaction[];
    alerts: DashboardAlert[];
    report_links: Record<string, string>;
}

export interface DashboardFilters {
    warehouse_id?: number | null;
    period?: string;
    date_from?: string;
    date_to?: string;
    compare?: boolean;
}

export interface TopProduct {
    name: string;
    sales: number;
    revenue?: number; // Total revenue from this product
}

export interface LowStockProduct {
    product_id: number;
    name: string;
    sku: string;
    stock: number;
    reorder_point: number;
    warehouse: string;
}

export interface InventorySummary {
    warehouse_id: number;
    warehouse_name: string;
    total_available: number;
    total_reserved: number;
    total_on_order: number;
    product_count: number;
}

export interface ReorderAlert {
    product_id: number;
    product_name: string;
    sku: string;
    brand: string;
    warehouse: string;
    current_stock: number;
    reorder_point: number;
    target_level: number;
    shortage: number;
}

export interface SalesChartData {
    labels: string[]; // Date labels for x-axis
    data: number[]; // Sales amounts for y-axis
    profit?: number[]; // Profit amounts for y-axis
    cost?: number[]; // Cost amounts for y-axis
}

export interface BrandProfit {
    brand: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    units_sold: number;
}

export interface CategorySales {
    category: string;
    revenue: number;
    units_sold: number;
}

export interface TopCashier {
    name: string;
    orders: number;
    revenue: number;
}

export interface RecentActivity {
    id: number;
    type: string;
    description: string;
    amount: number;
    date: string;
}

export interface DashboardData {
    stats: DashboardStats;
    top_products: TopProduct[];
    low_stock_products: LowStockProduct[];
    inventory_summary: InventorySummary[];
    sales_chart?: SalesChartData;
    profit_by_brand?: BrandProfit[];
    sales_by_category?: CategorySales[];
    top_cashiers?: TopCashier[];
    recent_activity?: RecentActivity[];
    financial?: DashboardFinancial;
}
