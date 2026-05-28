export interface SalesQuoteCustomer {
    id: number;
    code?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
}

export interface SalesQuoteUser {
    id: number;
    name: string;
}

export interface SalesQuoteWarehouse {
    id: number;
    name: string;
}

export interface SalesQuoteProduct {
    id: number;
    name: string;
    sku?: string | null;
}

export interface SalesQuoteVariant {
    id: number;
    sku: string;
    brand?: { id: number; name: string } | null;
}

export interface SalesQuoteItem {
    id: number;
    product_id?: number | null;
    variant_id?: number | null;
    warehouse_id: number;
    product_name: string;
    product_sku: string;
    product?: SalesQuoteProduct | null;
    variant?: SalesQuoteVariant | null;
    warehouse?: SalesQuoteWarehouse | null;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    notes?: string | null;
    is_custom_line?: boolean;
    custom_description?: string | null;
}

export interface SalesQuote {
    id: number;
    quote_number: string;
    customer: SalesQuoteCustomer | null;
    user: SalesQuoteUser | null;
    warehouse?: SalesQuoteWarehouse | null;
    date: string;
    valid_until: string | null;
    status: string;
    status_label: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total: number;
    formatted_total: string;
    notes: string | null;
    internal_notes?: string | null;
    converted_order_id: number | null;
    converted_order?: { id: number; order_number: string } | null;
    items: SalesQuoteItem[];
}

export interface SalesQuoteStockWarning {
    type: 'stock_shortage' | string;
    product_id: number | null;
    variant_id: number | null;
    warehouse_id: number | null;
    product_name: string;
    requested_quantity: number;
    available_quantity: number;
    missing_quantity: number;
    message: string;
}

export interface SalesQuoteOperationalItem extends SalesQuoteItem {
    product: SalesQuoteProduct | null;
    variant: SalesQuoteVariant | null;
    warehouse: SalesQuoteWarehouse | null;
    stock: {
        is_stock_tracked: boolean;
        available_quantity: number | null;
        requested_quantity: number;
        missing_quantity: number;
        warning: SalesQuoteStockWarning | null;
    };
}

export interface SalesQuoteWorkflow {
    status: string;
    status_label: string;
    is_expired: boolean;
    actions: {
        can_edit: boolean;
        can_open_in_pos: boolean;
        can_send_to_deposit: boolean;
        can_send_to_cashier: boolean;
        can_mark_collected: boolean;
        can_convert: boolean;
        can_delete: boolean;
    };
    links: {
        quote: string;
        edit: string;
        customer: string | null;
        converted_order: string | null;
        pos: string | null;
    };
}

export interface SalesQuoteDocument {
    type: 'ticket' | 'proforma' | string;
    label: string;
    mode: 'standard' | 'blind' | string;
    href: string;
}

export interface SalesQuoteTimelineEvent {
    type: string;
    label: string;
    occurred_at: string;
    source: string;
    href?: string | null;
}

export interface SalesQuoteOperationalDetail {
    quote: SalesQuote & {
        sent_to_cashier_at?: string | null;
        pos_session?: {
            id: number;
            status: string;
            opened_at: string | null;
            closed_at: string | null;
        } | null;
    };
    items: SalesQuoteOperationalItem[];
    workflow: SalesQuoteWorkflow;
    stock_context: {
        has_warnings: boolean;
        warnings_count: number;
        warnings: SalesQuoteStockWarning[];
    };
    documents: SalesQuoteDocument[];
    converted_order_context: {
        id: number;
        order_number: string;
        status: string;
        payment_status: string;
        total: number;
        sent_to_warehouse_at: string | null;
        prepared_at: string | null;
        created_at: string | null;
        href: string;
    } | null;
    timeline: SalesQuoteTimelineEvent[];
}

export interface SalesQuotesListFilters {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    customer_id?: number;
    user_id?: number;
    warehouse_id?: number;
    date_from?: string;
    date_to?: string;
}
