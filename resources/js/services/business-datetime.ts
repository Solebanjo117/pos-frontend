import apiClient from '@/services/api/client';

export type BusinessDatetimeRecordType =
    | 'sales_order'
    | 'purchase_order'
    | 'sales_order_payment'
    | 'purchase_order_payment'
    | 'account_payment_batch'
    | 'inventory_movement'
    | 'operational_expense'
    | 'financial_adjustment'
    | 'capital_movement';

export interface BusinessDatetimeAudit {
    id: number;
    old_business_datetime?: string | null;
    new_business_datetime: string;
    reason: string;
    changed_at: string;
    changed_by?: {
        id: number;
        name: string;
    } | null;
}

export interface BusinessDatetimeDetail {
    record_type: BusinessDatetimeRecordType;
    record_id: number;
    business_datetime?: string | null;
    created_at?: string | null;
    latest_audit?: BusinessDatetimeAudit | null;
    audits?: BusinessDatetimeAudit[];
}

export async function fetchBusinessDatetime(
    recordType: BusinessDatetimeRecordType,
    recordId: number,
): Promise<BusinessDatetimeDetail> {
    const response = await apiClient.get(
        `/business-datetime/${recordType}/${recordId}`,
    );

    return response.data.data;
}

export async function updateBusinessDatetime(
    recordType: BusinessDatetimeRecordType,
    recordId: number,
    payload: {
        business_datetime: string;
        reason: string;
    },
): Promise<BusinessDatetimeDetail> {
    const response = await apiClient.patch(
        `/business-datetime/${recordType}/${recordId}`,
        payload,
    );

    return response.data.data;
}
