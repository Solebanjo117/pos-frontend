export interface PosSession {
    id: number
    user_id: number
    opened_at: string
    closed_at: string | null
    opening_amount: number
    closing_amount: number | null
    expected_amount: number
    status: 'open' | 'closed'
    notes: string | null
    created_at: string
    updated_at: string
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
    total_billed?: number;
    declared_cash?: number;
    difference?: number;
    electronic_breakdown?: Record<string, number>;
}
