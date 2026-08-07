export type FinancialAdjustmentType =
    | 'cash'
    | 'bank'
    | 'inventory'
    | 'sales'
    | 'purchases'
    | 'expenses'
    | 'investment'
    | 'accounts_receivable'
    | 'accounts_payable'
    | 'manual_correction';

export type FinancialAdjustmentDirection = 'increase' | 'decrease';

export interface AdjustmentOption {
    value: number | string;
    label: string;
    type?: string;
    parent_id?: number;
    balance?: number;
    total?: number;
    institution_name?: string | null;
    masked_number?: string | null;
    variants?: AdjustmentOption[];
}

export interface FinancialAdjustmentOptions {
    types: AdjustmentOption[];
    directions: AdjustmentOption[];
    pos_sessions: AdjustmentOption[];
    financial_accounts: AdjustmentOption[];
    ledger_accounts: AdjustmentOption[];
    warehouses: AdjustmentOption[];
    customers: AdjustmentOption[];
    suppliers: AdjustmentOption[];
    sales_orders: AdjustmentOption[];
    purchase_orders: AdjustmentOption[];
    products: AdjustmentOption[];
}

export interface FinancialAdjustment {
    id: number;
    folio: string;
    type: FinancialAdjustmentType;
    type_label: string;
    direction: FinancialAdjustmentDirection;
    status: 'completed' | 'reversed';
    is_legacy: boolean;
    amount: number;
    quantity?: number | null;
    unit_cost?: number | null;
    reason: string;
    reference?: string | null;
    notes?: string | null;
    adjustment_date: string;
    business_datetime: string;
    timezone: string;
    created_ip?: string | null;
    before_values?: Record<string, number | string | null> | null;
    after_values?: Record<string, number | string | null> | null;
    user?: { id: number; name: string } | null;
    affected_ledger_account?: {
        id: number;
        code: string;
        name: string;
        type?: string;
    } | null;
    counterparty_ledger_account?: {
        id: number;
        code: string;
        name: string;
        type?: string;
    } | null;
    financial_account?: {
        id: number;
        name: string;
        institution_name?: string | null;
        masked_number?: string | null;
    } | null;
    pos_session?: { id: number; status: string } | null;
    customer?: { id: number; name: string } | null;
    supplier?: { id: number; name: string } | null;
    sales_order?: { id: number; order_number: string; total: number } | null;
    purchase_order?: {
        id: number;
        po_number: string;
        supplier_invoice_number?: string | null;
        total: number;
    } | null;
    product?: { id: number; name: string } | null;
    variant?: { id: number; name: string } | null;
    journal_entry?: {
        id: number;
        lines: Array<{
            id: number;
            debit: number;
            credit: number;
            ledger_account: { id: number; code: string; name: string };
        }>;
    } | null;
    reversal_of?: { id: number; folio: string } | null;
    reversed_by?: { id: number; folio: string } | null;
    capabilities?: { can_view: boolean; can_reverse: boolean };
}

export type FinancialAdjustmentPayload = Record<
    string,
    string | number | null | undefined
> & {
    idempotency_key: string;
    type: FinancialAdjustmentType;
    amount?: number;
    reason: string;
    business_datetime: string;
    counterparty_ledger_account_id: number;
};

export interface FinancialAdjustmentListResponse {
    data: FinancialAdjustment[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}
