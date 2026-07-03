export type SalesReturnStatus = 'pending' | 'approved' | 'rejected';
export type SalesReturnRefundMethod =
    | 'cash'
    | 'card'
    | 'transfer'
    | 'yappy'
    | 'ach'
    | 'cheque'
    | 'visa'
    | 'mastercard'
    | 'amex'
    | 'other'
    | 'balance'
    | 'store_credit';

export interface SalesReturnListFilters {
    status?: SalesReturnStatus | '';
    customer_id?: number | string;
    sales_order_id?: number | string;
    warehouse_id?: number | string;
    refund_method?: SalesReturnRefundMethod | '';
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    per_page?: number;
}

export interface SalesReturnListRow {
    id: number;
    return_number: string;
    sales_order_id: number;
    customer_id?: number | null;
    warehouse_id?: number | null;
    user_id?: number | null;
    total_amount: number | string;
    status: SalesReturnStatus;
    status_label?: string;
    refund_method?: SalesReturnRefundMethod | string | null;
    refund_notes?: string | null;
    reason?: string | null;
    created_at: string;
    processed_by_name?: string | null;
    processed_at?: string | null;
    sales_order?: {
        id: number;
        order_number: string;
        status?: string;
        total?: number | string;
        created_at?: string | null;
    } | null;
    customer?: {
        id: number;
        name: string;
        code?: string | null;
    } | null;
    warehouse?: {
        id: number;
        code?: string | null;
        name: string;
    } | null;
    user?: {
        id: number;
        name: string;
    } | null;
    items?: Array<{
        id: number;
        product_name?: string | null;
        quantity: number;
    }>;
}

export interface SalesReturnCandidateItem {
    id: number;
    product_id: number;
    variant_id?: number | null;
    product_name: string;
    product_sku: string;
    quantity: number;
    sold_quantity?: number;
    already_returned_quantity?: number;
    unit_price: number;
    discount_percent: number;
    tax_percent?: number;
    total: number;
    seller_name?: string | null;
}

export interface SalesReturnCandidate {
    id: number;
    order_number: string;
    status: string;
    payment_status?: string | null;
    date?: string | null;
    total: number;
    has_customer: boolean;
    customer?: {
        id: number;
        name: string;
        code?: string | null;
    } | null;
    items: SalesReturnCandidateItem[];
}

export interface SalesReturnParty {
    id: number;
    code?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    current_balance?: number;
    href?: string;
}

export interface SalesReturnDocument {
    id: number;
    order_number: string;
    status: string;
    status_label?: string;
    payment_status?: string;
    date?: string | null;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total: number;
    href: string;
    customer?: SalesReturnParty | null;
    customer_vehicle?: Record<string, any> | null;
}

export interface SalesReturnOperationalItem {
    id: number;
    sales_order_item_id: number;
    product_id: number | null;
    variant_id?: number | null;
    product_name?: string | null;
    product_sku?: string | null;
    variant_sku?: string | null;
    brand_name?: string | null;
    quantity_sold: number;
    quantity_returned_total: number;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tax_amount: number;
    total: number;
    unit_cost?: number | null;
    warehouse_id?: number | null;
    seller_name?: string | null;
}

export interface SalesReturnRefundContext {
    method?: string | null;
    amount: number;
    requires_open_session: boolean;
    refund_payment?: {
        id: number;
        method: string;
        method_label?: string;
        amount: number;
        paid_at?: string | null;
        notes?: string | null;
        creator_name?: string | null;
    } | null;
    customer_transaction?: SalesReturnCustomerTransaction | null;
}

export interface SalesReturnCustomerTransaction {
    id: number;
    type: string;
    type_label?: string;
    reference_type?: string | null;
    reference_id?: number | null;
    amount: number;
    balance_before: number;
    balance_after: number;
    description?: string | null;
    transaction_date?: string | null;
    creator_name?: string | null;
}

export interface SalesReturnInventoryContext {
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
        quantity: number;
        reference_type?: string | null;
        reference_id?: number | null;
        notes?: string | null;
        created_at?: string | null;
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

export interface SalesReturnWorkflow {
    can_approve: boolean;
    can_reject: boolean;
    can_open_order: boolean;
    can_open_customer: boolean;
    can_open_pos_session: boolean;
    blocked_reason?: string | null;
}

export interface SalesReturnOperationalDetail {
    return: SalesReturnListRow & {
        user?: { id: number; name: string; email?: string | null } | null;
        customer?: SalesReturnParty | null;
        warehouse?: { id: number; code?: string | null; name: string } | null;
        updated_at?: string | null;
    };
    sales_order?: SalesReturnDocument | null;
    items: SalesReturnOperationalItem[];
    refund_context: SalesReturnRefundContext;
    inventory_context: SalesReturnInventoryContext;
    ar_context: {
        customer_transactions: SalesReturnCustomerTransaction[];
        ledger_entries: Array<Record<string, any>>;
    };
    workflow: SalesReturnWorkflow;
    timeline: Array<{
        type: string;
        label: string;
        occurred_at?: string | null;
        amount?: number | null;
    }>;
}

export interface SalesReturnCreatePayload {
    reason?: string;
    refund_method: SalesReturnRefundMethod | string;
    refund_notes?: string;
    items: Array<{
        sales_order_item_id: number;
        quantity: number;
        user_id?: number | null;
        seller_id?: number | null;
    }>;
}
