export type SalesOrderStatus =
    | 'draft'
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'completed'
    | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod =
    | 'cash'
    | 'card'
    | 'transfer'
    | 'credit'
    | 'multiple';

export interface SalesOrderItem {
    id: number;
    sales_order_id: number;
    product_id: number | null;
    product_name: string;
    product_sku: string;
    is_custom_line?: boolean;
    custom_description?: string | null;
    warehouse_id: number;
    warehouse_name: string;
    seller_id?: number;
    seller_name?: string;
    added_after_sale?: boolean;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    formatted_total: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface SalesOrderOperationalParty {
    id: number;
    code?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    current_balance?: number;
    credit_limit?: number;
    credit_days?: number | null;
}

export interface SalesOrderOperationalOrder {
    id: number;
    document_type: 'sales_order';
    order_number: string;
    date: string | null;
    status: SalesOrderStatus;
    status_label: string;
    payment_status: PaymentStatus;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    shipping_cost: number;
    total: number;
    notes?: string | null;
    internal_notes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    business_datetime?: string | null;
    sent_to_warehouse_at?: string | null;
    prepared_at?: string | null;
    prepared_by?: { id: number; name: string } | null;
    user?: { id: number; name: string; email?: string | null } | null;
    customer?: SalesOrderOperationalParty | null;
    customer_vehicle?: {
        id: number;
        plate_number?: string | null;
        vin?: string | null;
        year?: number | null;
        make?: string | null;
        model?: string | null;
        chassis?: string | null;
        engine?: string | null;
    } | null;
    referred_by_customer?: SalesOrderOperationalParty | null;
    pos_session?: {
        id: number;
        status: string;
        opened_at?: string | null;
        closed_at?: string | null;
        user_name?: string | null;
        warehouse_id?: number | null;
        warehouse_name?: string | null;
    } | null;
}

export interface SalesOrderOperationalItem {
    id: number;
    product_id: number | null;
    variant_id?: number | null;
    product_name?: string | null;
    product_sku?: string | null;
    variant_sku?: string | null;
    brand_name?: string | null;
    warehouse_id?: number | null;
    warehouse_name?: string | null;
    seller_id?: number | null;
    seller_name?: string | null;
    quantity: number;
    unit_price: number;
    unit_cost?: number | null;
    discount_percent: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    total_cost: number;
    gross_profit: number;
    gross_margin_percent?: number | null;
    notes?: string | null;
    is_custom_line: boolean;
    custom_description?: string | null;
    added_after_sale: boolean;
}

export interface SalesOrderOperationalPayment {
    id: number;
    method: string;
    method_label: string;
    amount: number;
    is_refund: boolean;
    paid_at?: string | null;
    business_datetime?: string | null;
    notes?: string | null;
    creator_name?: string | null;
}

export interface SalesOrderPaymentSummary {
    method: string;
    method_label: string;
    amount: number;
    count: number;
}

export interface SalesOrderOperationalReturn {
    id: number;
    return_number: string;
    status: 'pending' | 'approved' | 'rejected';
    status_label: string;
    reason?: string | null;
    refund_method?: string | null;
    refund_notes?: string | null;
    total_amount: number;
    created_at?: string | null;
    processed_by_name?: string | null;
    warehouse_name?: string | null;
    items: Array<{
        id: number;
        sales_order_item_id: number;
        product_id: number;
        variant_id?: number | null;
        product_name?: string | null;
        product_sku?: string | null;
        variant_sku?: string | null;
        brand_name?: string | null;
        quantity: number;
        unit_price: number;
        subtotal: number;
        seller_name?: string | null;
    }>;
}

export interface SalesOrderInventoryContext {
    movements: Array<{
        id: number;
        movement_type: string;
        reason?: string | null;
        product_id?: number | null;
        variant_id?: number | null;
        product_name?: string | null;
        product_sku?: string | null;
        variant_sku?: string | null;
        brand_name?: string | null;
        warehouse_id?: number | null;
        warehouse_name?: string | null;
        destination_warehouse_id?: number | null;
        destination_warehouse_name?: string | null;
        quantity: number;
        reference_type?: string | null;
        reference_id?: number | null;
        notes?: string | null;
        created_at?: string | null;
        business_datetime?: string | null;
        user_name?: string | null;
        lot_allocations: Array<{
            id: number;
            sales_order_item_id?: number | null;
            inventory_lot_id: number;
            batch_number?: string | null;
            quantity: number;
            unit_cost: number;
            total_cost: number;
        }>;
    }>;
}

export interface SalesOrderProfitSummary {
    subtotal: number;
    total_cost: number;
    gross_profit: number;
    gross_margin_percent?: number | null;
    has_missing_costs: boolean;
}

export interface SalesOrderOperationalDetail {
    order: SalesOrderOperationalOrder;
    items: SalesOrderOperationalItem[];
    payments: SalesOrderOperationalPayment[];
    payment_summary: SalesOrderPaymentSummary[];
    ar_context: {
        customer_id?: number | null;
        amount_paid: number;
        amount_due: number;
        total_returned: number;
        customer_transactions: Array<{
            id: number;
            type: string;
            type_label: string;
            reference_type?: string | null;
            reference_id?: number | null;
            amount: number;
            balance_before: number;
            balance_after: number;
            description?: string | null;
            transaction_date?: string | null;
            creator_name?: string | null;
        }>;
        ledger_entries: Array<{
            id: number;
            movement_type: string;
            document_type?: string | null;
            document_id?: number | null;
            document_number?: string | null;
            batch_number?: string | null;
            debit: number;
            credit: number;
            balance_after: number;
            occurred_at?: string | null;
            reference_number?: string | null;
            notes?: string | null;
            creator_name?: string | null;
            applications: any[];
        }>;
    };
    returns: SalesOrderOperationalReturn[];
    inventory_context: SalesOrderInventoryContext;
    profit_summary: SalesOrderProfitSummary;
    audit: Array<{
        action: string;
        metadata?: Record<string, any>;
        timestamp?: string;
    }>;
}

export interface SalesOrder {
    id: number;
    order_number: string;
    customer_id?: number;
    customer_vehicle_id?: number | null;
    referred_by_customer_id?: number | null;
    customer_name?: string;
    customer_code?: string;
    user_id: number;
    user_name: string;
    date: string;
    status: SalesOrderStatus;
    status_label: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    shipping_cost: number;
    total: number;
    formatted_total: string;
    payment_status: PaymentStatus;
    payment_method?: PaymentMethod;
    notes?: string;
    audit_logs?: Array<{
        action: string;
        metadata: Record<string, any>;
        timestamp: string;
    }>;
    items: SalesOrderItem[];
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

export interface SalesOrderFilters {
    status?: SalesOrderStatus;
    customer_id?: number;
    warehouse_id?: number;
    date_from?: string;
    date_to?: string;
    search?: string;
    sort_by?: string;
    sort_direction?: 'asc' | 'desc';
    per_page?: number;
}

export interface SalesOrderStatistics {
    total_orders: number;
    total_sales: number;
    pending_orders: number;
    confirmed_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    average_order_value: number;
}

export interface CreateSalesOrderData {
    user_id?: number;
    customer_id?: number;
    customer_vehicle_id?: number | null;
    referred_by_customer_id?: number | null;
    date?: string;
    status?: 'draft' | 'pending' | 'confirmed';
    warehouse_id?: number;
    source_quote_id?: number;
    discount_amount?: number;
    shipping_cost?: number;
    payment_method?: PaymentMethod;
    payment_status?: PaymentStatus;
    initial_payment?: number;
    payments?: Array<{
        amount: number;
        method: string;
        reference_number?: string | null;
        notes?: string | null;
    }>;
    notes?: string;
    audit_logs?: Array<{
        action: string;
        metadata: Record<string, any>;
        timestamp: string;
    }>;
    items?: Array<{
        source_quote_item_id?: number;
        product_id: number | null;
        variant_id?: number;
        warehouse_id?: number;
        quantity: number;
        unit_price: number;
        discount_percent?: number;
        discount_amount?: number;
        tax_percent?: number;
        seller_id?: number;
        notes?: string;
        is_custom_line?: boolean;
        custom_description?: string;
    }>;
}

export interface UpdateSalesOrderData {
    customer_id?: number;
    customer_vehicle_id?: number | null;
    referred_by_customer_id?: number | null;
    date?: string;
    discount_amount?: number;
    shipping_cost?: number;
    payment_method?: PaymentMethod;
    notes?: string;
    items?: Array<{
        product_id: number | null;
        warehouse_id?: number;
        quantity: number;
        unit_price: number;
        discount_percent?: number;
        discount_amount?: number;
        tax_percent?: number;
        seller_id?: number;
        notes?: string;
        is_custom_line?: boolean;
        custom_description?: string;
    }>;
}

export interface AddOrderItemData {
    product_id: number | null;
    warehouse_id?: number;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    discount_amount?: number;
    tax_percent?: number;
    seller_id?: number;
    notes?: string;
    is_custom_line?: boolean;
    custom_description?: string;
}

export interface UpdateOrderItemData {
    quantity?: number;
    unit_price?: number;
    discount_percent?: number;
    discount_amount?: number;
    tax_percent?: number;
    seller_id?: number;
    notes?: string;
}
