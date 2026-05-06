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
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {}

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
}

export interface SupplierVariantPayload {
    variant_id?: number;
    product_id?: number;
    supplier_cost: number;
    lead_time_days?: number;
    minimum_order_quantity?: number;
    is_preferred?: boolean;
}
