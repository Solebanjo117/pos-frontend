import apiClient from '@/services/api/client';
import type {
    FinancialDocumentFilters,
    FinancialDocumentMode,
    FinancialDocumentResponse,
} from '@/types/financial-document';

const endpoint = (mode: FinancialDocumentMode): string =>
    mode === 'payable' ? '/accounts-payable' : '/accounts-receivable';

export const financialDocumentsService = {
    async list(
        mode: FinancialDocumentMode,
        filters: FinancialDocumentFilters,
    ): Promise<FinancialDocumentResponse> {
        const response = await apiClient.get(`${endpoint(mode)}/documents`, {
            params: filters,
        });

        return response.data;
    },

    async settle(
        mode: FinancialDocumentMode,
        partyId: number,
        payload: Record<string, unknown>,
    ): Promise<void> {
        const suffix = mode === 'payable' ? 'payments' : 'receipts';
        await apiClient.post(`${endpoint(mode)}/${partyId}/${suffix}`, payload);
    },

    async remove(
        documentType: 'sales_order' | 'purchase_order',
        id: number,
    ): Promise<void> {
        const path =
            documentType === 'purchase_order'
                ? `/purchase-orders/${id}`
                : `/sales-orders/${id}`;
        await apiClient.delete(path);
    },

    async cancel(
        documentType: 'sales_order' | 'purchase_order',
        id: number,
        reason: string,
    ): Promise<void> {
        const path =
            documentType === 'purchase_order'
                ? `/purchase-orders/${id}/cancel`
                : `/sales-orders/${id}/cancel`;
        await apiClient.post(path, { reason });
    },
};
