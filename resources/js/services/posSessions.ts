import apiClient from './api/client';

const BASE_PATH = '/pos-sessions';

export interface PosSessionReconciliationRow {
    code: string;
    label: string;
    start_adds: number;
    payments: number;
    withdrawals: number;
    expected_total: number;
    declared_total?: number;
    difference?: number;
    is_countable?: boolean;
    is_informational?: boolean;
}

export interface PosSessionSummary {
    opening_amount: number;
    cash_sales: number;
    card_sales?: number;
    transfer_sales?: number;
    credit_sales?: number;
    electronic_sales?: number;
    total_sales: number;
    total_discounts?: number;
    shipping_revenue: number;
    cash_movements_in?: number;
    cash_movements_out?: number;
    expected_cash: number;
    declared_cash: number;
    difference: number;
    expected_total?: number;
    declared_total?: number;
    total_difference?: number;
    total_billed?: number;
    electronic_breakdown?: Record<string, number>;
    informational_breakdown?: Record<string, number>;
    accounts_receivable_generated?: number;
    store_credit_applied?: number;
    informational_total?: number;
    reconciliation_rows?: PosSessionReconciliationRow[];
}

export interface PosSessionDocument {
    id: string;
    type:
        | 'sale'
        | 'ar_receipt'
        | 'ap_payment'
        | 'operational_expense'
        | 'cash_movement'
        | string;
    type_label: string;
    document_id: number | string | null;
    document_number: string | null;
    amount: number;
    method: string | null;
    method_label: string | null;
    direction: 'in' | 'out' | string;
    occurred_at: string | null;
    actor_id: number | null;
    actor_name: string | null;
    customer_id: number | null;
    customer_name: string | null;
    supplier_id: number | null;
    supplier_name: string | null;
    reference: string | null;
    notes: string | null;
    href: string | null;
    is_cash_counted: boolean;
    source: string;
    applications?: Array<{
        document_type: string;
        document_id: number;
        document_number: string | null;
        amount: string | number;
    }>;
    [key: string]: any;
}

export interface PosSessionTimelineEvent {
    id: string;
    type: string;
    label: string;
    amount: number;
    direction: 'in' | 'out' | string;
    occurred_at: string | null;
    href: string | null;
    source: string;
    document?: {
        id: number | string | null;
        number: string | null;
        reference: string | null;
    };
}

export interface PosSessionRecord {
    id: number;
    user_id: number;
    warehouse_id: number | null;
    opened_at: string;
    closed_at: string | null;
    opening_amount: string;
    closing_amount: string | null;
    expected_amount: string | null;
    closing_details: {
        summary?: PosSessionSummary;
        reconciliation_rows?: PosSessionReconciliationRow[];
        [key: string]: any;
    } | null;
    status: string;
    notes: string | null;
    user?: { id: number; name: string };
    warehouse?: { id: number; name: string };
    cash_movements?: CashMovementRecord[];
    purchase_payments?: PurchasePaymentRecord[];
    account_payments?: AccountPaymentRecord[];
    operational_expenses?: OperationalExpenseRecord[];
}

export interface PosSessionDetailResponse {
    data: PosSessionRecord;
    summary: PosSessionSummary;
    reconciliation_rows: PosSessionReconciliationRow[];
    documents: PosSessionDocument[];
    timeline: PosSessionTimelineEvent[];
    sales_orders: SessionSalesOrder[];
    cash_movements: CashMovementRecord[];
    purchase_payments: PurchasePaymentRecord[];
    account_payments: AccountPaymentRecord[];
    operational_expenses: OperationalExpenseRecord[];
}

export interface CashMovementRecord {
    id: number;
    pos_session_id: number;
    user_id: number;
    type: 'in' | 'out';
    amount: string;
    reason: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface SessionSalesOrder {
    id: number;
    order_number: string;
    total: string;
    subtotal: string;
    tax: string;
    tax_amount?: string;
    discount_amount: string;
    status: string;
    payment_method: string;
    customer_id: number | null;
    created_at: string;
    customer?: { id: number; name: string } | null;
}

export interface PurchasePaymentRecord {
    id: number;
    purchase_order_id: number;
    pos_session_id: number | null;
    cash_movement_id: number | null;
    user_id: number | null;
    amount: string;
    method: string;
    reference_number: string | null;
    notes: string | null;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
    purchase_order?: {
        id: number;
        po_number: string;
        total: string;
        supplier?: { id: number; name: string } | null;
    } | null;
    user?: { id: number; name: string } | null;
}

export interface AccountPaymentRecord {
    id: number;
    account_type: 'customer' | 'supplier';
    account_id: number;
    direction: 'incoming' | 'outgoing';
    batch_number: string;
    amount: string;
    method: string;
    reference_number: string | null;
    notes: string | null;
    paid_at: string | null;
    created_at: string;
    creator?: { id: number; name: string } | null;
    applications?: Array<{
        document_type: string;
        document_id: number;
        document_number: string | null;
        amount: string;
    }>;
}

export interface OperationalExpenseRecord {
    id: number;
    warehouse_id: number | null;
    created_by: number | null;
    cash_movement_id: number | null;
    pos_session_id: number | null;
    expense_date: string;
    category: string;
    category_label?: string;
    description: string | null;
    amount: string;
    payment_method: string | null;
    payment_method_label?: string | null;
    reference_number: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    warehouse?: { id: number; name: string } | null;
    creator?: { id: number; name: string } | null;
}

export const PosSessionsApiService = {
    /**
     * List POS sessions with optional filters
     */
    async list(
        params: {
            status?: string;
            warehouse_id?: number;
            user_id?: number;
            date_from?: string;
            date_to?: string;
            page?: number;
            per_page?: number;
        } = {},
        signal?: AbortSignal,
    ): Promise<{ data: any }> {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.append(key, String(value));
            }
        });
        const response = await apiClient.get<{ data: any }>(
            `${BASE_PATH}?${query.toString()}`,
            { signal },
        );
        return response.data;
    },

    /**
     * Get a single session with its sales orders
     */
    async show(
        id: number,
        signal?: AbortSignal,
    ): Promise<PosSessionDetailResponse> {
        const response = await apiClient.get<PosSessionDetailResponse>(
            `${BASE_PATH}/${id}`,
            { signal },
        );
        return response.data;
    },
};
