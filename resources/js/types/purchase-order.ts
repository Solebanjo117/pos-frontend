import type { TransactionTrace } from './transaction-trace';

export type PurchaseOrderStatus =
    | 'draft'
    | 'open'
    | 'sent'
    | 'partial'
    | 'received'
    | 'cancelled';

export interface PurchaseOrderItem {
    id: number;
    purchase_order_id: number;
    product_id: number;
    variant_id?: number;
    product?: {
        id: number;
        sku_base: string;
        name: string;
        brand?: { id: number; name: string };
        pricing?: { id: number; cost: number; base_price: number };
    };
    variant?: {
        id: number;
        sku?: string | null;
        brand?: { id: number; name: string };
    };
    supplier?: { id: number; name: string };
    status?: string;
    quantity_ordered: number;
    quantity_received: number;
    pre_stock_applied_qty?: number;
    pre_applied_quantity?: number;
    effective_received_quantity?: number;
    units_per_package: number;
    total_units_ordered: number;
    total_units_received: number;
    unit_cost: number;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    misc_cost?: number;
    total: number;
    line_cost_summary?: PurchaseOrderLineCostSummary;
    inventory_lots?: PurchaseOrderInventoryLot[];
    pending_quantity: number;
    is_fully_received: boolean;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export type PurchaseOrderPaymentStatus = 'pending' | 'partial' | 'paid';

export interface PurchaseOrder {
    id: number;
    po_number: string;
    supplier_invoice_number?: string | null;
    supplier_id: number;
    supplier?: { id: number; name: string };
    warehouse_id: number;
    warehouse?: { id: number; name: string };
    user_id: number;
    user?: { id: number; name: string };
    status: PurchaseOrderStatus;
    status_label: string;
    payment_status: PurchaseOrderPaymentStatus;
    payment_status_label: string;
    order_date: string;
    received_date?: string;
    subtotal: number;
    tax_amount: number;
    shipping_cost: number;
    total: number;
    formatted_total: string;
    amount_paid: number;
    amount_due: number;
    notes?: string;
    items: PurchaseOrderItem[];
    payments?: PurchaseOrderPayment[];
    cost_summary?: PurchaseOrderCostSummary;
    receipt_summary?: PurchaseOrderReceiptSummary;
    payment_summary?: PurchaseOrderPaymentSummary;
    supplier_summary?: PurchaseOrderSupplierSummary;
    ap_impact?: PurchaseOrderApImpact;
    inventory_impact?: PurchaseOrderInventoryImpact;
    trace?: TransactionTrace;
    items_count?: number;
    created_at: string;
    updated_at: string;
    business_datetime?: string | null;
    deleted_at?: string;
}

export interface PurchaseOrderFilters {
    search?: string;
    status?: PurchaseOrderStatus;
    supplier_id?: number;
    payment_status?: PurchaseOrderPaymentStatus | string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_direction?: 'asc' | 'desc';
    per_page?: number;
}

export interface PurchaseOrderStatistics {
    total_orders: number;
    total_spent: number;
    draft_orders: number;
    sent_orders: number;
    partial_orders: number;
    received_orders: number;
    cancelled_orders: number;
    average_order_value: number;
    total_unpaid: number;
    pending_payment_orders: number;
}

export interface CreatePurchaseOrderData {
    supplier_id: number;
    supplier_invoice_number?: string;
    warehouse_id: number;
    order_date?: string;
    tax_amount?: number;
    shipping_cost?: number;
    notes?: string;
    source_supply_list_item_ids?: number[];
    items: Array<{
        product_id: number;
        variant_id?: number | null;
        quantity_ordered: number;
        units_per_package?: number;
        unit_cost: number;
        tax_rate?: number;
        tax_amount?: number;
        misc_cost?: number;
        notes?: string;
    }>;
}

export type PurchaseOrderCandidateSource = 'low_stock' | 'daily';

export interface PurchaseOrderCandidateItem {
    id: string;
    source: PurchaseOrderCandidateSource;
    source_supply_list_item_id: number | null;
    product_id: number;
    variant_id?: number | null;
    product_name: string;
    sku?: string | null;
    current_stock?: number | null;
    suggested_quantity: number;
    unit_cost: number;
    tax_rate?: number;
    tax_amount?: number;
    misc_cost?: number;
    notes?: string | null;
}

export interface PurchaseOrderWarning {
    type: 'supplier_variant_missing' | string;
    variant_id?: number;
    product_id?: number;
    sku?: string | null;
    product_name?: string | null;
    brand_name?: string | null;
    message: string;
}

export interface UpdatePurchaseOrderData extends Partial<
    Omit<CreatePurchaseOrderData, 'items'>
> {
    items?: CreatePurchaseOrderData['items'];
}

export interface ReceiveItemsData {
    idempotency_key: string;
    items: Array<{
        item_id: number;
        quantity_received: number;
        batch_number?: string;
        expiry_date?: string;
        sale_price?: number;
    }>;
}

export interface PurchaseOrderLineCostSummary {
    ordered_units: number;
    received_units: number;
    unit_cost: number;
    subtotal: number;
    tax_rate: number;
    tax_total: number;
    misc_total: number;
    line_total: number;
    landed_unit_cost: number;
}

export interface PurchaseOrderCostSummary {
    subtotal: number;
    tax_total: number;
    misc_total: number;
    shipping_total: number;
    grand_total: number;
}

export interface PurchaseOrderReceiptSummary {
    ordered_packages: number;
    received_packages: number;
    pending_packages: number;
    ordered_units: number;
    received_units: number;
    pending_units: number;
    received_percent: number;
}

export interface PurchaseOrderPaymentSummary {
    payment_status: PurchaseOrderPaymentStatus;
    payment_status_label: string;
    amount_paid: number;
    amount_due: number;
    payments_count: number;
    real_payment_total: number;
}

export interface PurchaseOrderSupplierSummary {
    id: number | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    is_daily_order: boolean;
    invoice_number?: string | null;
    item_suppliers_count?: number;
}

export interface PurchaseOrderApImpact {
    status: 'open' | 'settled' | 'cancelled';
    supplier_id: number | null;
    document_type: 'purchase_order';
    document_id: number;
    document_number: string;
    amount_total: number;
    amount_paid: number;
    amount_due: number;
    stays_in_ap: boolean;
}

export interface PurchaseOrderInventoryLot {
    id: number;
    source_item_id: number | null;
    warehouse_id: number;
    warehouse_name?: string | null;
    batch_number?: string | null;
    received_quantity: number;
    quantity_available: number;
    unit_cost_base: number;
    tax_per_unit: number;
    tax_total: number;
    misc_per_unit: number;
    misc_total: number;
    landed_unit_cost: number;
    landed_total: number;
    remaining_value: number;
    received_at?: string | null;
}

export interface PurchaseOrderInventoryImpact {
    lots_count: number;
    received_units: number;
    available_units: number;
    landed_value: number;
    available_value: number;
    lots: PurchaseOrderInventoryLot[];
}

export interface PurchaseOrderPayment {
    id: number;
    amount: number;
    method: string;
    method_label?: string;
    reference_number?: string | null;
    notes?: string | null;
    paid_at?: string | null;
    business_datetime?: string | null;
    pos_session_id?: number | null;
    cash_movement_id?: number | null;
    formatted_amount?: string;
    user?: { id: number; name: string } | null;
}
