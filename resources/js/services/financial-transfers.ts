import apiClient from '@/services/api/client';
import type {
    FinancialAccount,
    FinancialTransfer,
    MoneyAccountOption,
} from '@/types/financial-transfer';

export interface TransferPayload {
    idempotency_key: string;
    from_endpoint_type: string;
    from_endpoint_id: number;
    to_endpoint_type: string;
    to_endpoint_id: number;
    amount: number;
    business_datetime?: string;
    reference?: string;
    notes?: string;
    receipt?: File | null;
}

export const financialTransfersService = {
    async options(
        type?: string,
        purpose?: 'transfer' | 'settlement',
    ): Promise<MoneyAccountOption[]> {
        const response = await apiClient.get('/money-accounts/options', {
            params:
                type || purpose
                    ? { type: type || undefined, purpose: purpose || undefined }
                    : undefined,
        });
        return response.data.data;
    },
    async list(params: Record<string, unknown> = {}) {
        const response = await apiClient.get('/financial-transfers', {
            params,
        });
        return response.data;
    },
    async get(id: number): Promise<FinancialTransfer> {
        const response = await apiClient.get(`/financial-transfers/${id}`);
        return response.data.data;
    },
    async create(payload: TransferPayload): Promise<FinancialTransfer> {
        const body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                body.append(key, value instanceof File ? value : String(value));
            }
        });
        const response = await apiClient.post('/financial-transfers', body, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data.data;
    },
    async reverse(id: number, reason: string): Promise<FinancialTransfer> {
        const response = await apiClient.post(
            `/financial-transfers/${id}/reverse`,
            { reason },
        );
        return response.data.data;
    },
    receiptUrl(id: number): string {
        return `/api/v1/financial-transfers/${id}/receipt`;
    },
    async accountsReport(params: Record<string, unknown>) {
        return (await apiClient.get('/financial-accounts/report', { params }))
            .data;
    },
    async accountMovements(id: number, params: Record<string, unknown>) {
        return (
            await apiClient.get(`/financial-accounts/${id}/movements`, {
                params,
            })
        ).data;
    },
    async accounts(): Promise<FinancialAccount[]> {
        const response = await apiClient.get('/financial-accounts');
        return response.data.data;
    },
    async ledgerAccounts() {
        const response = await apiClient.get(
            '/financial-accounts/ledger-options',
        );
        return response.data.data as Array<{
            id: number;
            code: string;
            name: string;
        }>;
    },
    async createAccount(payload: Record<string, unknown>) {
        const response = await apiClient.post('/financial-accounts', payload);
        return response.data.data as FinancialAccount;
    },
    async updateAccount(id: number, payload: Record<string, unknown>) {
        const response = await apiClient.patch(
            `/financial-accounts/${id}`,
            payload,
        );
        return response.data.data as FinancialAccount;
    },
};
