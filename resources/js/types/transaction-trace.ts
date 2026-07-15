export type TransactionTraceEventCategory =
    | 'business'
    | 'financial'
    | 'inventory'
    | 'status'
    | 'edit'
    | 'reversal'
    | 'cancellation';

export interface TransactionTraceNode {
    type: string;
    id: number;
    relation?: string | null;
    label: string;
    number?: string | null;
    status?: string | null;
    occurred_at?: string | null;
    amount?: number | null;
    quantity?: number | null;
    href?: string | null;
    can_view: boolean;
    restricted: boolean;
    traceable: boolean;
}

export interface TransactionTraceEvent {
    id: string;
    category: TransactionTraceEventCategory;
    event_type: string;
    label: string;
    occurred_at: string;
    user?: { id?: number | null; name: string } | null;
    status?: string | null;
    amount?: number | null;
    quantity?: number | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
    document: TransactionTraceNode;
}

export interface InventoryMovementTraceDetails {
    movement_type: string;
    movement_group_uuid?: string | null;
    business_datetime?: string | null;
    created_at?: string | null;
    user?: { id: number; name: string } | null;
    warehouse?: { id: number; name: string; code: string } | null;
    destination_warehouse?: {
        id: number;
        name: string;
        code: string;
    } | null;
    product?: {
        id: number;
        name: string;
        sku: string;
        href: string;
    } | null;
    variant?: { id: number; sku: string } | null;
    quantity_before?: number | null;
    quantity: number;
    quantity_after?: number | null;
    unit_cost: number;
    total_cost: number;
    reason?: string | null;
    notes?: string | null;
    fifo_lots: Array<{
        id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
        batch_number?: string | null;
    }>;
}

export interface TransactionTrace {
    root: TransactionTraceNode;
    details?: InventoryMovementTraceDetails | Record<string, unknown> | null;
    relationships: TransactionTraceNode[];
    timeline: TransactionTraceEvent[];
    breadcrumbs?: TransactionTraceNode[];
    actions?: Array<{
        key: string;
        label: string;
        href?: string | null;
        can_run: boolean;
    }>;
    context?: { type: string; id: number };
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}
