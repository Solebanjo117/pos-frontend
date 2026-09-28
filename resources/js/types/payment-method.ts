export interface PaymentMethod {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
    is_archived?: boolean;
    is_system: boolean;
    requires_reference: boolean;
    requires_cash_count: boolean;
    requires_financial_account?: boolean;
    default_financial_account_id?: number | null;
    liquidity_bucket?: 'cash' | 'bank' | 'credit' | 'store_credit';
    available_in_sales?: boolean;
    available_in_customer_receipts?: boolean;
    available_in_supplier_payments?: boolean;
    available_in_purchase_orders?: boolean;
    available_in_returns?: boolean;
    sort_order: number;
    archived_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

export type PaymentMethodContext =
    | 'sales'
    | 'customer_receipts'
    | 'supplier_payments'
    | 'purchase_orders'
    | 'returns';

export interface CreatePaymentMethodData {
    name: string;
    is_active?: boolean;
    requires_reference?: boolean;
    requires_cash_count?: boolean;
    requires_financial_account?: boolean;
    default_financial_account_id?: number | null;
    liquidity_bucket?: 'cash' | 'bank' | 'credit' | 'store_credit';
    available_in_sales?: boolean;
    available_in_customer_receipts?: boolean;
    available_in_supplier_payments?: boolean;
    available_in_purchase_orders?: boolean;
    available_in_returns?: boolean;
}

export interface UpdatePaymentMethodData {
    name?: string;
    is_active?: boolean;
    requires_reference?: boolean;
    requires_cash_count?: boolean;
    requires_financial_account?: boolean;
    default_financial_account_id?: number | null;
    liquidity_bucket?: 'cash' | 'bank' | 'credit' | 'store_credit';
    available_in_sales?: boolean;
    available_in_customer_receipts?: boolean;
    available_in_supplier_payments?: boolean;
    available_in_purchase_orders?: boolean;
    available_in_returns?: boolean;
    sort_order?: number;
}
