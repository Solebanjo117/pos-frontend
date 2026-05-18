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
    created_at: string;
    updated_at: string;
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
