export type OperationalExpenseCategory =
    | 'electricity'
    | 'accounting'
    | 'rent'
    | 'maintenance'
    | 'software'
    | 'payroll'
    | 'utilities'
    | 'other';

export type OperationalExpensePaymentMethod =
    | 'cash'
    | 'card'
    | 'transfer'
    | 'other';

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
    category_label: string;
    description?: string | null;
    amount: number;
    payment_method?: OperationalExpensePaymentMethod | null;
    payment_method_label?: string | null;
    reference_number?: string | null;
    notes?: string | null;
    created_at: string;
    updated_at: string;
}

export interface OperationalExpensePayload {
    warehouse_id: number | null;
    expense_date: string;
    category: OperationalExpenseCategory;
    description?: string | null;
    amount: number;
    payment_method?: OperationalExpensePaymentMethod | null;
    reference_number?: string | null;
    notes?: string | null;
}

export interface OperationalExpenseFilters {
    date_from?: string;
    date_to?: string;
    category?: OperationalExpenseCategory | '';
    warehouse_id?: number | null;
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
    };
    categories: Record<OperationalExpenseCategory, string>;
    payment_methods: OperationalExpensePaymentMethod[];
}
