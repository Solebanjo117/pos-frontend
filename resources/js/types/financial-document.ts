export type FinancialDocumentMode = 'receivable' | 'payable';
export const FINANCIAL_DOCUMENT_COLUMNS = [
    'Fecha',
    'Persona / Empresa',
    '# Factura',
    'Total',
    'Pagado',
    'Saldo',
    'Editar',
    'Eliminar',
] as const;
export type FinancialDocumentStatus =
    | 'pending'
    | 'partial'
    | 'overdue'
    | 'settled'
    | 'cancelled';

export interface FinancialDocumentMovement {
    id: number;
    amount: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
    financial_account_id?: number | null;
    occurred_at?: string | null;
    created_by?: string | null;
}

export interface FinancialDocument {
    id: number;
    document_type: 'sales_order' | 'purchase_order';
    date: string | null;
    party: {
        id: number | null;
        name: string;
        type: 'customer' | 'supplier';
    };
    document_number: string;
    source_number: string;
    total: number;
    paid: number;
    balance: number;
    due_date?: string | null;
    status: FinancialDocumentStatus;
    status_label: string;
    detail_url: string;
    edit_url: string;
    capabilities: {
        can_edit: boolean;
        can_delete: boolean;
        can_cancel: boolean;
        can_register_payment: boolean;
        can_register_receipt: boolean;
    };
    movements: FinancialDocumentMovement[];
}

export interface FinancialDocumentFilters {
    date_from: string;
    date_to: string;
    search: string;
    document_number: string;
    party_id: number | null;
    status: string;
    page: number;
    per_page: number;
}

export interface FinancialDocumentResponse {
    data: FinancialDocument[];
    summary: {
        total: number;
        paid: number;
        balance: number;
        pending_documents: number;
    };
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    statuses: Record<string, string>;
}
