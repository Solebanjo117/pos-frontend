import apiClient from '@/services/api/client';

export type CashOperationType = 'cash_in' | 'cash_out' | 'expense' | 'funding';

export interface FundingCategory {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
    sort_order: number;
}

export interface CashOperationPayload {
    operation_type: CashOperationType;
    amount: number;
    notes?: string;
    expense_category_id?: number;
    funding_category_id?: number;
    idempotency_key: string;
}

export const cashOperationsService = {
    async create(payload: CashOperationPayload) {
        const response = await apiClient.post(
            '/cash-operation-requests',
            payload,
        );
        return response.data;
    },

    async fundingCategories(all = false): Promise<FundingCategory[]> {
        const response = await apiClient.get('/funding-categories', {
            params: { all: all ? 1 : 0 },
        });
        return response.data.data ?? [];
    },

    async createFundingCategory(name: string): Promise<FundingCategory> {
        const response = await apiClient.post('/funding-categories', { name });
        return response.data.data;
    },

    async updateFundingCategory(
        id: number,
        payload: { name?: string; is_active?: boolean },
    ): Promise<FundingCategory> {
        const response = await apiClient.patch(
            `/funding-categories/${id}`,
            payload,
        );
        return response.data.data;
    },
};
