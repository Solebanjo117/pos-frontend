export type FinancialAccountType = 'cash' | 'bank' | 'petty_cash' | 'other';
export type MoneyEndpointType =
    | 'financial_account'
    | 'pos_session'
    | 'warehouse_cash';

export interface MoneyAccountOption {
    endpoint_type: MoneyEndpointType;
    endpoint_id: number;
    account_type: FinancialAccountType;
    name: string;
    masked_number: string | null;
    balance: number;
    initialized?: boolean;
    currency: string;
    allow_negative_balance: boolean;
}

export interface FinancialAccount {
    id: number;
    name: string;
    type: Exclude<FinancialAccountType, 'cash'>;
    institution_name?: string | null;
    masked_number: string | null;
    currency: string;
    opening_balance: string | number;
    current_balance: string | number;
    allow_negative_balance: boolean;
    is_active: boolean;
    is_legacy: boolean;
    ledger_account_id: number;
    ledger_account?: { id: number; code: string; name: string };
}

export interface FinancialTransfer {
    id: number;
    folio: string;
    amount: string | number;
    reference: string | null;
    notes: string | null;
    status: 'completed' | 'reversed';
    business_datetime: string;
    created_at: string;
    creator?: { id: number; name: string };
    from_account: { id: number; name: string; type: FinancialAccountType };
    to_account: { id: number; name: string; type: FinancialAccountType };
    has_receipt: boolean;
    reversal_of?: { id: number; folio: string } | null;
    reversed_by?: { id: number; folio: string } | null;
    collection_date_from?: string | null;
    collection_date_to?: string | null;
    deposit_allocations?: Array<{
        id: number;
        source_scope: string;
        source_id: number;
        amount: number | string;
        released_at: string | null;
        released_by_transfer_id: number | null;
    }>;
}
