export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'

export interface PurchaseOrderItem {
    id: number
    purchase_order_id: number
    product_id: number
    variant_id?: number
    product?: {
        id: number
        sku_base: string
        name: string
        brand?: { id: number; name: string }
        pricing?: { id: number; cost: number; base_price: number }
    }
    quantity_ordered: number
    quantity_received: number
    units_per_package: number
    total_units_ordered: number
    total_units_received: number
    unit_cost: number
    subtotal: number
    pending_quantity: number
    is_fully_received: boolean
    notes?: string
    created_at: string
    updated_at: string
}

export type PurchaseOrderPaymentStatus = 'pending' | 'partial' | 'paid'

export interface PurchaseOrder {
    id: number
    po_number: string
    supplier_id: number
    supplier?: { id: number; name: string }
    warehouse_id: number
    warehouse?: { id: number; name: string }
    user_id: number
    user?: { id: number; name: string }
    status: PurchaseOrderStatus
    status_label: string
    payment_status: PurchaseOrderPaymentStatus
    payment_status_label: string
    order_date: string
    expected_date?: string
    received_date?: string
    subtotal: number
    tax_amount: number
    shipping_cost: number
    total: number
    formatted_total: string
    amount_paid: number
    amount_due: number
    notes?: string
    items: PurchaseOrderItem[]
    items_count?: number
    created_at: string
    updated_at: string
    deleted_at?: string
}

export interface PurchaseOrderFilters {
    search?: string
    status?: PurchaseOrderStatus
    supplier_id?: number
    payment_status?: PurchaseOrderPaymentStatus | string
    date_from?: string
    date_to?: string
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
    per_page?: number
}

export interface PurchaseOrderStatistics {
    total_orders: number
    total_spent: number
    draft_orders: number
    sent_orders: number
    partial_orders: number
    received_orders: number
    cancelled_orders: number
    average_order_value: number
    total_unpaid: number
    pending_payment_orders: number
}

export interface CreatePurchaseOrderData {
    supplier_id: number
    warehouse_id: number
    order_date?: string
    expected_date?: string
    tax_amount?: number
    shipping_cost?: number
    notes?: string
    items: Array<{
        product_id: number
        quantity_ordered: number
        units_per_package?: number
        unit_cost: number
        notes?: string
    }>
}

export interface UpdatePurchaseOrderData extends Partial<Omit<CreatePurchaseOrderData, 'items'>> {
    items?: CreatePurchaseOrderData['items']
}

export interface ReceiveItemsData {
    items: Array<{
        item_id: number
        quantity_received: number
        batch_number?: string
        expiry_date?: string
    }>
}
