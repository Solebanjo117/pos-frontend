export type OperationalExpenseCategory = string;

export type OperationalExpensePaymentMethod = string;

export interface OperationalExpensePaymentMethodOption {
    value: OperationalExpensePaymentMethod;
    label: string;
}

export type OperationalExpenseStatus =
    | 'draft'
    | 'pending'
    | 'scheduled'
    | 'queued'
    | 'paid'
    | 'cancelled'
    | 'reversed';

export type OperationalExpenseRecurrence =
    | 'one_time'
    | 'weekly'
    | 'monthly'
    | 'yearly';

export type OperationalExpenseKind =
    | 'operational'
    | 'administrative'
    | 'financial'
    | 'other';

export type OperationalExpensePartyType =
    | 'customer'
    | 'supplier'
    | 'beneficiary'
    | 'staff';

export interface OperationalExpenseParty {
    type: OperationalExpensePartyType;
    id: number;
    related_id?: number;
    name: string;
}

export interface OperationalExpenseBeneficiary {
    id: number;
    name: string;
    type: 'individual' | 'company';
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    is_active: boolean;
    user_id?: number | null;
    beneficiary_kind?:
        | 'employee'
        | 'seller'
        | 'contractor'
        | 'company'
        | 'staff'
        | 'other';
    expenses_count?: number;
    expenses_sum_amount?: number;
}

export interface OperationalExpenseCategoryRecord {
    id: number;
    name: string;
    slug: string;
    subcategory?: string | null;
    default_ledger_account_id?: number | null;
    expense_kind: OperationalExpenseKind;
    affects_cash_flow: boolean;
    affects_income_statement: boolean;
    is_active: boolean;
    sort_order: number;
}

export interface OperationalExpense {
    id: number;
    warehouse_id?: number | null;
    warehouse?: { id: number; name: string } | null;
    created_by?: number | null;
    creator?: { id: number; name: string } | null;
    cash_movement_id?: number | null;
    cash_movement?: {
        id: number;
        pos_session_id: number;
        amount: number;
    } | null;
    pos_session_id?: number | null;
    pos_session?: { id: number; status: string } | null;
    expense_date: string;
    category: OperationalExpenseCategory;
    category_id?: number | null;
    category_record?: OperationalExpenseCategoryRecord | null;
    category_label: string;
    subcategory?: string | null;
    supplier_id?: number | null;
    supplier?: { id: number; name: string } | null;
    customer_id?: number | null;
    customer?: { id: number; name: string } | null;
    beneficiary_id?: number | null;
    beneficiary?: OperationalExpenseBeneficiary | null;
    party?: OperationalExpenseParty | null;
    ledger_account_id?: number | null;
    ledger_account?: { id: number; code: string; name: string } | null;
    description?: string | null;
    amount: number;
    estimated_amount?: number | null;
    final_amount?: number | null;
    variance_amount?: number | null;
    variance_reason?: string | null;
    payment_method?: OperationalExpensePaymentMethod | null;
    planned_payment_method?: OperationalExpensePaymentMethod | null;
    payment_method_label?: string | null;
    recurrence?: OperationalExpenseRecurrence | null;
    status?: OperationalExpenseStatus | null;
    paid_at?: string | null;
    due_at?: string | null;
    queued_at?: string | null;
    cancelled_at?: string | null;
    reversed_at?: string | null;
    affects_cash_flow?: boolean;
    affects_income_statement?: boolean;
    expense_kind?: OperationalExpenseKind | null;
    reference_number?: string | null;
    notes?: string | null;
    created_at: string;
    updated_at: string;
    business_datetime?: string | null;
    capabilities?: {
        can_edit: boolean;
        can_send_to_cashier: boolean;
        can_cancel: boolean;
        can_reverse: boolean;
    };
}

export interface OperationalExpensePayload {
    warehouse_id: number | null;
    expense_date: string;
    category?: OperationalExpenseCategory | null;
    category_id: number | null;
    custom_category_name: string | null;
    subcategory: string | null;
    supplier_id?: number | null;
    customer_id?: number | null;
    beneficiary_id?: number | null;
    party_type: OperationalExpensePartyType | null;
    party_id: number | null;
    ledger_account_id: number | null;
    description?: string | null;
    amount: number;
    estimated_amount?: number | null;
    final_amount?: number | null;
    variance_reason?: string | null;
    payment_method: OperationalExpensePaymentMethod | null;
    planned_payment_method?: OperationalExpensePaymentMethod | null;
    recurrence: OperationalExpenseRecurrence;
    status: OperationalExpenseStatus;
    paid_at?: string | null;
    due_at?: string | null;
    change_reason?: string | null;
    affects_cash_flow: boolean;
    affects_income_statement: boolean;
    expense_kind: OperationalExpenseKind;
    reference_number?: string | null;
    notes?: string | null;
    business_datetime?: string | null;
}

export interface OperationalExpenseFilters {
    date_from?: string;
    date_to?: string;
    category?: OperationalExpenseCategory | '';
    warehouse_id?: number | null;
    expense_kind?: OperationalExpenseKind | '';
    status?: OperationalExpenseStatus | '';
    party_type?: OperationalExpensePartyType | '';
    party_id?: number | null;
    per_page?: number;
    page?: number;
}

export interface OperationalExpenseListResponse {
    data: OperationalExpense[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    summary: {
        total_amount: number;
        count: number;
        by_category?: Array<{
            category: string;
            total_amount: number;
            count: number;
        }>;
        by_party?: Array<{
            party_type: OperationalExpensePartyType | null;
            party_id: number | null;
            party_name: string;
            total_amount: number;
            count: number;
        }>;
    };
    categories: Record<string, string>;
    expense_categories?: OperationalExpenseCategoryRecord[];
    payment_methods: Array<
        OperationalExpensePaymentMethod | OperationalExpensePaymentMethodOption
    >;
    statuses?: Record<OperationalExpenseStatus, string>;
    recurrences?: Record<OperationalExpenseRecurrence, string>;
    expense_kinds?: Record<OperationalExpenseKind, string>;
}
