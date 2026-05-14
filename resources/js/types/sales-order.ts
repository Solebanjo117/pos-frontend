export type SalesOrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit' | 'multiple'

export interface SalesOrderItem {
    id: number
    sales_order_id: number
    product_id: number | null
    product_name: string
    product_sku: string
    is_custom_line?: boolean
    custom_description?: string | null
    warehouse_id: number
    warehouse_name: string
    seller_id?: number
    seller_name?: string
    added_after_sale?: boolean
    quantity: number
    unit_price: number
    discount_percent: number
    discount_amount: number
    tax_percent: number
    tax_amount: number
    subtotal: number
    total: number
    formatted_total: string
    notes?: string
    created_at: string
    updated_at: string
}

export interface SalesOrder {
    id: number
    order_number: string
    customer_id?: number
    customer_name?: string
    customer_code?: string
    user_id: number
    user_name: string
    date: string
    status: SalesOrderStatus
    status_label: string
    subtotal: number
    tax_amount: number
    discount_amount: number
    shipping_cost: number
    total: number
    formatted_total: string
    payment_status: PaymentStatus
    payment_method?: PaymentMethod
    notes?: string
    audit_logs?: Array<{ action: string; metadata: Record<string, any>; timestamp: string }>
    items: SalesOrderItem[]
    created_at: string
    updated_at: string
    deleted_at?: string
}

export interface SalesOrderFilters {
    status?: SalesOrderStatus
    customer_id?: number
    warehouse_id?: number
    date_from?: string
    date_to?: string
    search?: string
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
    per_page?: number
}

export interface SalesOrderStatistics {
    total_orders: number
    total_sales: number
    pending_orders: number
    confirmed_orders: number
    completed_orders: number
    cancelled_orders: number
    average_order_value: number
}

export interface CreateSalesOrderData {
    user_id?: number
    customer_id?: number
    date?: string
    status?: 'draft' | 'pending' | 'confirmed'
    warehouse_id?: number
    source_quote_id?: number
    discount_amount?: number
    shipping_cost?: number
    payment_method?: PaymentMethod
    payment_status?: PaymentStatus
    initial_payment?: number
    payments?: Array<{
        amount: number
        method: string
        notes?: string
    }>
    notes?: string
    audit_logs?: Array<{ action: string; metadata: Record<string, any>; timestamp: string }>
    items?: Array<{
        product_id: number | null
        variant_id?: number
        warehouse_id?: number
        quantity: number
        unit_price: number
        discount_percent?: number
        discount_amount?: number
        tax_percent?: number
        seller_id?: number
        notes?: string
        is_custom_line?: boolean
        custom_description?: string
    }>
}

export interface UpdateSalesOrderData {
    customer_id?: number
    date?: string
    discount_amount?: number
    shipping_cost?: number
    payment_method?: PaymentMethod
    notes?: string
    items?: Array<{
        product_id: number | null
        warehouse_id?: number
        quantity: number
        unit_price: number
        discount_percent?: number
        discount_amount?: number
        tax_percent?: number
        seller_id?: number
        notes?: string
        is_custom_line?: boolean
        custom_description?: string
    }>
}

export interface AddOrderItemData {
    product_id: number | null
    warehouse_id?: number
    quantity: number
    unit_price: number
    discount_percent?: number
    discount_amount?: number
    tax_percent?: number
    seller_id?: number
    notes?: string
    is_custom_line?: boolean
    custom_description?: string
}

export interface UpdateOrderItemData {
    quantity?: number
    unit_price?: number
    discount_percent?: number
    discount_amount?: number
    tax_percent?: number
    seller_id?: number
    notes?: string
}
