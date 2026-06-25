export interface StockLevelSummary {
    total_products: number;
    critical_stock: number;
    low_stock: number;
    normal_stock: number;
    optimal_stock: number;
    total_value: number;
    critical_value?: number;
    low_value?: number;
    normal_value?: number;
    optimal_value?: number;
    at_risk_value?: number;
}

export interface WarehouseStockSummary {
    warehouse_id: number;
    warehouse_name: string;
    total_products: number;
    critical: number;
    low: number;
    normal: number;
    optimal: number;
    total_value?: number;
    critical_value?: number;
    low_value?: number;
    at_risk_value?: number;
}

export interface ProductStockLevel {
    id: number;
    sku: string;
    name: string;
    brand: string | null;
    variant_id?: number | null;
    variant_sku?: string | null;
    warehouse_id: number;
    warehouse: string;
    current_stock: number;
    reorder_point: number;
    target_level: number;
    status: 'critical' | 'low' | 'normal' | 'optimal';
    stock_value: number;
    current_cost?: number;
    fifo_cost_current?: number;
}

export interface StockLevelsReport {
    summary: StockLevelSummary;
    by_warehouse: WarehouseStockSummary[];
    products: ProductStockLevel[];
    pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface MovementHistorySummary {
    total_movements: number;
    total_inbound: number;
    total_outbound: number;
    total_transfers: number;
    total_quantity_in: number;
    total_quantity_out: number;
    net_change: number;
    total_assigned_cost?: number;
}

export interface TimelineData {
    date: string;
    inbound: number;
    outbound: number;
    transfers: number;
    net: number;
}

export interface ProductMovementSummary {
    product_id: number;
    product_name: string;
    product_sku: string;
    total_movements: number;
    inbound: number;
    outbound: number;
    transfers: number;
}

export interface MovementDetail {
    id: number;
    date: string;
    product_id: number;
    product_name: string;
    product_sku: string;
    warehouse: string;
    destination_warehouse: string | null;
    movement_type: 'in' | 'out' | 'transfer';
    quantity: number;
    reference_type: string | null;
    reference_id: string | null;
    user: string | null;
    variant_id?: number | null;
    variant_sku?: string | null;
    fifo_total_cost?: number;
    lot_total_cost?: number;
    lot_allocations?: Array<{
        lot_id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
        source_type?: string | null;
        source_id?: number | null;
    }>;
    fifo_allocations?: Array<{
        lot_id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
        source_type?: string | null;
        source_id?: number | null;
    }>;
}

export interface MovementHistoryReport {
    summary: MovementHistorySummary;
    timeline: TimelineData[];
    by_product: ProductMovementSummary[];
    movements: MovementDetail[];
    pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface StockLevelsFilters {
    warehouse_id?: number;
    brand_id?: number;
    category_id?: number;
    status?: 'critical' | 'low' | 'normal' | 'optimal';
    page?: number;
    sort_by?:
        | 'sku'
        | 'name'
        | 'brand'
        | 'warehouse'
        | 'current_stock'
        | 'reorder_point'
        | 'target_level'
        | 'status'
        | 'current_cost'
        | 'stock_value';
    sort_direction?: 'asc' | 'desc';
}

export interface MovementHistoryFilters {
    date_from: string;
    date_to: string;
    product_id?: number | null;
    warehouse_id?: number | null;
    user_id?: number | null;
    movement_type?: 'in' | 'out' | 'transfer' | null;
    group_by?: 'day' | 'week' | 'month' | 'product' | 'warehouse';
    page?: number;
}

export interface FinancialReport {
    summary: {
        total_revenue: number;
        total_cogs: number;
        total_refunds: number;
        total_operational_expenses: number;
        gross_profit: number;
        net_profit: number;
        margin_percentage: number;
        total_tax: number;
        total_discounts: number;
        orders_count: number;
    };
    credit_balances: {
        accounts_receivable: {
            total_open_balance: number;
            open_documents_count: number;
            accounts_count: number;
            aging_buckets?: AgingBuckets;
            documents?: CreditDocument[];
            recent_movements?: CreditMovement[];
        };
        accounts_payable: {
            total_open_balance: number;
            open_documents_count: number;
            accounts_count: number;
            aging_buckets?: AgingBuckets;
            documents?: CreditDocument[];
            recent_movements?: CreditMovement[];
        };
    };
    timeline: Array<{
        date: string;
        revenue: number;
        cogs: number;
        operational_expenses: number;
        gross_profit: number;
        profit: number;
        orders_count: number;
    }>;
    operational_expenses: {
        total: number;
        by_category: Array<{
            category: string;
            label: string;
            amount: number;
            count: number;
        }>;
        timeline: Array<{
            date: string;
            amount: number;
            count: number;
        }>;
    };
}

export interface AgingBucket {
    label: string;
    amount: number;
    count: number;
}

export interface AgingBuckets {
    current: AgingBucket;
    '1_30': AgingBucket;
    '31_60': AgingBucket;
    '61_90': AgingBucket;
    '90_plus': AgingBucket;
}

export interface CreditDocument {
    id: number;
    document_type: 'sales_order' | 'purchase_order';
    document_number: string;
    account_id?: number | null;
    account_name?: string | null;
    date?: string | null;
    due_date?: string | null;
    total: number;
    amount_paid: number;
    amount_due: number;
    days_overdue: number;
    warehouse_id?: number | null;
    status: string;
}

export interface CreditMovement {
    id: number;
    batch_number: string;
    account_type: 'customer' | 'supplier';
    account_id: number;
    direction: string;
    amount: number;
    method: string;
    paid_at?: string | null;
    reference_number?: string | null;
}

export interface StatementRow {
    key: string;
    label: string;
    amount: number;
    type:
        | 'income'
        | 'expense'
        | 'profit'
        | 'asset'
        | 'liability'
        | 'equity'
        | 'neutral';
    detail?: string | null;
}

export interface StatementSection {
    key: string;
    label: string;
    amount: number;
    rows: StatementRow[];
}

export interface IncomeStatementReport extends FinancialReport {
    basis: 'cash' | 'accrual_operational';
    period: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    };
    sections: StatementSection[];
    comparison?: {
        previous_period: {
            date_from: string;
            date_to: string;
        };
        previous: {
            summary: FinancialReport['summary'];
        };
        variance: Record<
            string,
            {
                amount: number;
                percentage: number | null;
            }
        >;
    } | null;
    breakdowns?: {
        by_brand: Array<Record<string, any>>;
        by_category: Array<Record<string, any>>;
        by_warehouse: Array<Record<string, any>>;
    };
}

export interface FinancialPositionReport {
    basis: 'current_operational_snapshot';
    mode: 'current_snapshot' | 'as_of';
    as_of: string;
    warehouse_id?: number | null;
    summary: {
        total_assets: number;
        total_liabilities: number;
        operational_equity: number;
        operational_cash?: number;
        accounts_receivable?: number;
        inventory_value?: number;
        accounts_payable?: number;
    };
    sections: StatementSection[];
    credit_balances: FinancialReport['credit_balances'];
    aging?: {
        accounts_receivable: AgingBuckets;
        accounts_payable: AgingBuckets;
    };
    documents?: {
        accounts_receivable: CreditDocument[];
        accounts_payable: CreditDocument[];
    };
    warnings?: Array<{
        code: string;
        message: string;
    }>;
}

export interface CustomerReferenceReportOrder {
    id: number;
    order_number: string;
    date: string | null;
    status: string;
    customer_id: number | null;
    customer_name: string | null;
    referred_by_customer_id: number | null;
    referred_by_customer_name: string | null;
    total: number;
}

export interface CustomerReferenceReportRow {
    customer_id: number;
    customer_code: string;
    customer_name: string;
    direct_revenue: number;
    referred_revenue: number;
    combined_revenue: number;
    orders_count: number;
    referred_orders_count: number;
    direct_orders: CustomerReferenceReportOrder[];
    referred_orders: CustomerReferenceReportOrder[];
}

export interface CustomerReferenceReport {
    summary: {
        direct_revenue: number;
        referred_revenue: number;
        combined_revenue: number;
        customers_count: number;
    };
    data: CustomerReferenceReportRow[];
}

export interface SalesByClientFilters {
    date_from: string;
    date_to: string;
    warehouse_id: number | null;
    customer_id: number | null;
    referred_by_customer_id: number | null;
    search?: string;
    status?: string | null;
    payment_status?: string | null;
    sort_by?:
        | 'customer_name'
        | 'orders_count'
        | 'total_revenue'
        | 'total_paid'
        | 'pending_amount'
        | 'last_payment_date'
        | 'status';
    sort_direction?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
}

export interface SalesByClientInvoice {
    id: number;
    order_number: string;
    date: string | null;
    status: string;
    payment_status: string;
    total: number;
    amount_paid: number;
    pending_amount: number;
    method?: string | null;
    method_label?: string | null;
    href: string;
}

export interface SalesByClientPurchasedItem {
    product_id?: number | null;
    variant_id?: number | null;
    name: string | null;
    sku?: string | null;
    brand_name?: string | null;
    quantity: number;
    total: number;
}

export interface SalesByClientVehicle {
    id: number;
    name: string;
    vin?: string | null;
    status: string;
}

export interface SalesByClientRow {
    customer_id: number;
    customer_code?: string | null;
    customer_name: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    initials: string;
    referred_by_customer_id?: number | null;
    referred_by_customer_name?: string | null;
    orders_count: number;
    total_revenue: number;
    total_paid: number;
    pending_amount: number;
    last_payment_amount: number;
    last_payment_date?: string | null;
    dominant_payment_method?: string | null;
    dominant_payment_method_label: string;
    status: 'aldia' | 'pendiente' | 'vencido';
    status_label: string;
    details: {
        invoices: SalesByClientInvoice[];
        items: SalesByClientPurchasedItem[];
        vehicles: SalesByClientVehicle[];
    };
}

export interface SalesByClientReferrer {
    customer_id?: number | null;
    customer_name: string;
    initials: string;
    clients_count: number;
    orders_count: number;
    total_revenue: number;
    commission: number;
    growth: number;
}

export interface SalesByClientTopClient {
    customer_id: number;
    customer_name: string;
    total_revenue: number;
    orders_count: number;
    growth: number;
}

export interface SalesByClientReport {
    summary: {
        total_revenue: number;
        orders_count: number;
        average_ticket: number;
        active_customers: number;
        total_paid: number;
        pending_amount: number;
        overdue_amount: number;
    };
    data: SalesByClientRow[];
    by_referrer: SalesByClientReferrer[];
    top_clients: SalesByClientTopClient[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface DailyFinancialRow {
    date: string;
    cash: number;
    inventory: number;
    purchase: number;
    expenses: number;
    sales: number;
    cogs: number;
    profit: number;
    credit_payable: number;
    credit_receivable: number;
    cogs_credit: number;
    investment: number;
    opening_cash?: number;
    opening_inventory?: number;
    opening_accounts_receivable?: number;
    opening_accounts_payable?: number;
    cash_sales?: number;
    credit_sales?: number;
    cash_purchases?: number;
    credit_purchases?: number;
    customer_payments?: number;
    supplier_payments?: number;
    cogs_cash_sales?: number;
    cogs_credit_sales?: number;
    investment_in?: number;
    investment_out?: number;
    cash_adjustments?: number;
    inventory_adjustments?: number;
    closing_cash?: number;
    closing_inventory?: number;
    accounts_receivable?: number;
    accounts_payable?: number;
    gross_profit?: number;
    net_profit?: number;
    net_investment?: number;
    is_locked?: boolean;
    computed_at?: string | null;
}

export interface DailyFinancialSummary {
    rows: DailyFinancialRow[];
    totals: Record<string, number>;
    period: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    };
}

export interface BalanceSheetReport {
    assets: {
        cash: number;
        cash_initial: number;
        inventory: number;
        inventory_initial: number;
    };
    liabilities: {
        accounts_payable: number;
        accounts_receivable: number;
    };
    totals: {
        total_assets: number;
        total_liabilities: number;
        balance: number;
    };
    as_of: string;
    warehouse_id?: number | null;
}

export interface ExpenseBreakdownItem {
    label: string;
    amount: number;
}

export interface ExpenseBreakdown {
    items: ExpenseBreakdownItem[];
    other: ExpenseBreakdownItem;
    total: number;
}

export interface FinancialAdjustment {
    id: number;
    type: 'cash' | 'inventory';
    type_label: string;
    amount: number;
    reason: string;
    adjustment_date: string;
    notes?: string | null;
    warehouse_id?: number | null;
}

export interface CapitalMovement {
    id: number;
    movement_type: 'in' | 'out';
    movement_type_label: string;
    amount: number;
    movement_date: string;
    reason: string;
    notes?: string | null;
    warehouse_id?: number | null;
    user_id?: number | null;
}
