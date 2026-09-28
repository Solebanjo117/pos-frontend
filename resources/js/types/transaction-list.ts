export type TransactionType = 'order' | 'quote';

export interface TransactionLinkedQuote {
    id: number;
    number: string;
    status: string;
    status_label: string;
}

export interface TransactionRow {
    key: string;
    type: TransactionType;
    id: number;
    number: string;
    date: string;
    customer_id: number | null;
    customer_name: string | null;
    seller_name: string | null;
    warehouse_id: number | null;
    status: string;
    status_label: string;
    total: string;
    amount_due: number | null;
    payment_status: string | null;
    linked_quote: TransactionLinkedQuote | null;
    actions: string[];
}

export interface TransactionMetrics {
    total_transactions: number;
    orders: number;
    quotes: number;
    pending: number;
    order_amount: string;
    quote_amount: string;
}

export interface TransactionListResponse {
    data: TransactionRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    metrics: TransactionMetrics;
}

export interface TransactionFilters {
    type?: 'all' | TransactionType;
    status?: string;
    status_group?: 'pending' | 'completed' | 'cancelled';
    search?: string;
    customer_id?: number;
    warehouse_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
}
