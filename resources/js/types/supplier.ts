export interface Supplier {
    id: number;
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    payment_terms?: string;
    lead_time_days?: number;
    notes?: string;
    status: 'active' | 'inactive';
    products_count?: number;
    brands?: Pick<Brand, 'id' | 'name'>[];
    can_edit?: boolean;
    can_delete?: boolean;
    delete_block_reason?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

interface Brand {
    id: number;
    name: string;
}

export interface SupplierFilters {
    search?: string;
    status?: 'active' | 'inactive';
    sort_by?: string;
    sort_direction?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
}

export interface CreateSupplierData {
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    payment_terms?: string;
    lead_time_days?: number;
    notes?: string;
    status?: 'active' | 'inactive';
    brand_ids?: number[];
}

export interface SupplierRelationshipItem {
    id: number;
    name: string;
    source: 'configured' | 'purchased' | 'both';
}

export interface SupplierRelationships {
    brands: SupplierRelationshipItem[];
    categories: SupplierRelationshipItem[];
    configured_products_count: number;
    purchased_products_count: number;
    purchase_orders_count: number;
    accounts_payable_orders_count: number;
}

export type UpdateSupplierData = Partial<CreateSupplierData>;

export interface SupplierProduct {
    id: number;
    product_id: number;
    variant_id?: number | null;
    product_name: string;
    product_sku?: string | null;
    variant_sku?: string | null;
    brand_name?: string | null;
    supplier_cost: number;
    lead_time_days: number;
    minimum_order_quantity: number;
    is_preferred: boolean;
    total_stock?: number;
    last_unit_cost?: number | null;
    last_landed_unit_cost?: number | null;
    previous_unit_cost?: number | null;
    cost_delta?: number | null;
    cost_delta_percent?: number | null;
    purchase_count?: number;
    average_days_between_purchases?: number | null;
    pending_orders_count?: number;
    pending_units?: number;
    last_purchase_at?: string | null;
    promised_lead_time_days?: number | null;
    average_actual_lead_time_days?: number | null;
}

export interface SupplierVariantPayload {
    variant_id?: number;
    product_id?: number;
    supplier_cost: number;
    lead_time_days?: number;
    minimum_order_quantity?: number;
    is_preferred?: boolean;
}

export interface SupplierPurchaseHistoryItem {
    id: number;
    product_id: number | null;
    variant_id: number | null;
    product_name: string | null;
    product_sku: string | null;
    variant_sku: string | null;
    brand_name: string | null;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
    tax_amount: number;
    misc_cost: number;
    total: number;
}

export interface SupplierPurchaseHistoryPayment {
    id: number;
    method: string;
    method_label: string;
    amount: number;
    reference_number?: string | null;
    paid_at?: string | null;
    notes?: string | null;
    user_name?: string | null;
}

export interface SupplierPurchaseHistoryOrder {
    id: number;
    po_number: string;
    supplier_invoice_number?: string | null;
    order_date?: string | null;
    status: string;
    status_label: string;
    payment_status: string;
    payment_status_label: string;
    is_accounts_payable: boolean;
    warehouse?: { id: number; name: string } | null;
    document_total?: number;
    total: number;
    amount_paid: number;
    amount_due: number;
    supplier_items_total: number;
    items: SupplierPurchaseHistoryItem[];
    payments: SupplierPurchaseHistoryPayment[];
    payment_summary: Array<{
        method: string;
        method_label: string;
        amount: number;
        count: number;
    }>;
}

export interface SupplierPurchaseHistory {
    data: SupplierPurchaseHistoryOrder[];
    summary: {
        orders_count: number;
        items_count: number;
        total_ordered: number;
        total_paid: number;
        total_due: number;
        total_received_units: number;
        total_ordered_units: number;
    };
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface SupplierPurchaseHistoryFilters {
    search?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    payment_status?: string;
    page?: number;
    per_page?: number;
}

export interface SupplierCommercialDashboard {
    summary: {
        suppliers_count: number;
        supplied_variants_count: number;
        products_without_supplier_count: number;
        low_stock_without_supplier_count: number;
    };
    products_without_supplier: Array<{
        product_id: number;
        variant_id?: number | null;
        product_name: string;
        product_sku?: string | null;
        variant_sku?: string | null;
        brand_name?: string | null;
        warehouse?: { id: number; name: string } | null;
        quantity_available: number;
        reorder_point: number;
        reorder_quantity: number;
        needs_reorder: boolean;
    }>;
    suppliers_with_pending_orders: Array<{
        id: number;
        name: string;
        pending_orders_count: number;
    }>;
}

export interface SupplierCommercialDashboardFilters {
    search?: string;
    warehouse_id?: number;
    only_low_stock?: boolean;
    per_page?: number;
}
