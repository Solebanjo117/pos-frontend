export interface Customer {
    id: number;
    code: string;
    type: 'individual' | 'business';
    name: string;
    email: string | null;
    phone: string | null;
    tax_id: string | null;
    tax_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string;
    postal_code: string | null;
    credit_limit: number;
    credit_days: number;
    current_balance: number;
    store_credit: number;
    has_store_credit: boolean;
    contact_person: string | null;
    contact_phone: string | null;
    notes: string | null;
    status: 'active' | 'inactive' | 'blocked';
    vehicles?: CustomerVehicle[];
    created_at: string;
    updated_at: string;
}

export interface CustomerVehicle {
    id: number;
    customer_id: number;
    vehicle_model_id: number;
    vehicle_chassis_id: number | null;
    vehicle_engine_id: number;
    vin: string | null;
    label: string | null;
    notes: string | null;
    status: 'active' | 'inactive';
    display_name: string;
    make?: { id: number; name: string } | null;
    model?: {
        id: number;
        name: string;
        generation?: string | null;
        year_from?: number | null;
        year_to?: number | null;
        make?: { id: number; name: string } | null;
    } | null;
    chassis?: { id: number; code: string; name?: string | null } | null;
    engine?: {
        id: number;
        engine_code: string;
        displacement?: string | null;
    } | null;
    created_at: string;
    updated_at: string;
}

export interface CustomerVehicleFormData {
    vehicle_model_id: number;
    vehicle_chassis_id: number | null;
    vehicle_engine_id: number;
    vin: string | null;
    label?: string | null;
    notes?: string | null;
    status?: 'active' | 'inactive';
}

export interface CustomerTransaction {
    id: number;
    customer_id: number;
    type:
        | 'sale'
        | 'payment'
        | 'credit_note'
        | 'adjustment'
        | 'store_credit_used';
    reference_type: string | null;
    reference_id: number | null;
    amount: number;
    balance_before: number;
    balance_after: number;
    description: string | null;
    transaction_date: string;
    created_by: number | null;
    created_at: string;
    updated_at: string;
}

export interface CustomerBalanceSummary {
    current_balance: number;
    credit_limit: number;
    available_credit: number;
    credit_days: number;
    is_over_limit: boolean;
}

export interface CustomerProfileTopItem {
    product_id: number | null;
    variant_id: number | null;
    name: string | null;
    sku: string | null;
    brand_name: string | null;
    quantity: number;
    total: number;
}

export interface CustomerProfileRecentPayment {
    id: number;
    order_id: number;
    order_number: string;
    method: string;
    method_label: string;
    amount: number;
    paid_at: string | null;
}

export interface CustomerProfileMechanic {
    customer_id: number;
    name: string;
    code: string | null;
    orders_count: number;
    last_order_date: string | null;
}

export interface CustomerProfileSummary {
    total_purchased: number;
    invoices_count: number;
    average_ticket: number;
    last_purchase_date: string | null;
    total_paid: number;
    pending_amount: number;
    credit_used_percent: number;
    credit_status: 'current' | 'pending' | 'over_limit';
    credit_status_label: string;
    top_items: CustomerProfileTopItem[];
    recent_payments: CustomerProfileRecentPayment[];
    mechanic: CustomerProfileMechanic | null;
}

export interface CustomerOrderPaymentSummary {
    method: string;
    method_label: string;
    amount: number;
    count: number;
}

export interface CustomerOrderPayment {
    id: number;
    method: string;
    method_label: string;
    amount: number;
    paid_at: string | null;
    notes: string | null;
    creator_name: string | null;
}

export interface CustomerPurchasedItem {
    id: number;
    product_id: number | null;
    variant_id: number | null;
    product_name: string | null;
    product_sku: string | null;
    variant_sku: string | null;
    brand_name: string | null;
    warehouse_name: string | null;
    seller_name: string | null;
    quantity: number;
    unit_price: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    notes: string | null;
    is_custom_line: boolean;
}

export interface CustomerSalesHistoryOrder {
    id: number;
    order_number: string;
    date: string | null;
    status: string;
    status_label: string;
    payment_status: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    shipping_cost: number;
    total: number;
    amount_paid: number;
    amount_due: number;
    total_returned: number;
    payment_summary: CustomerOrderPaymentSummary[];
    items: CustomerPurchasedItem[];
    payments: CustomerOrderPayment[];
    returns: Array<{
        id: number;
        return_number: string;
        status: string;
        status_label: string;
        refund_method?: string | null;
        total_amount: number;
        reason?: string | null;
        created_at?: string | null;
        href: string;
    }>;
}

export interface CustomerSalesHistory {
    data: CustomerSalesHistoryOrder[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface CustomerSalesHistoryFilters {
    date_from?: string;
    date_to?: string;
    status?: string;
    payment_status?: string;
    search?: string;
    page?: number;
    per_page?: number;
}

export interface CustomerFilters {
    search?: string;
    type?: 'individual' | 'business';
    status?: 'active' | 'inactive' | 'blocked';
    has_credit?: boolean;
    order_by?: string;
    order_direction?: 'asc' | 'desc';
}

export interface CustomerFormData {
    code?: string;
    type: 'individual' | 'business';
    name: string;
    email?: string;
    phone?: string;
    tax_id?: string;
    tax_name?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    credit_limit?: number;
    credit_days?: number;
    contact_person?: string;
    contact_phone?: string;
    notes?: string;
    status?: 'active' | 'inactive' | 'blocked';
    initial_balance?: number;
}
