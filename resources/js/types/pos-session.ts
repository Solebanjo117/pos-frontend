export interface PosSession {
    id: number;
    user_id: number;
    opened_at: string;
    closed_at: string | null;
    opening_amount: number;
    closing_amount: number | null;
    expected_amount: number;
    status: 'open' | 'closed';
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface PosSessionSummary {
    opening_amount: number;
    cash_sales: number;
    electronic_sales: number;
    total_sales: number;
    total_discounts?: number;
    shipping_revenue?: number;
    cash_movements_in?: number;
    cash_movements_out?: number;
    expected_cash: number;
    expected_total?: number;
    total_billed?: number;
    declared_cash?: number;
    declared_total?: number;
    difference?: number;
    total_difference?: number;
    electronic_breakdown?: Record<string, number>;
    informational_breakdown?: Record<string, number>;
    reconciliation_rows?: Array<{
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
    }>;
}
