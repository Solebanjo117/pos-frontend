import apiClient from '@/services/api/client';
import type {
    FinancialAdjustment,
    FinancialAdjustmentListResponse,
    FinancialAdjustmentOptions,
    FinancialAdjustmentPayload,
} from '@/types/financial-adjustment';

export const financialAdjustmentsService = {
    async options(): Promise<FinancialAdjustmentOptions> {
        const response = await apiClient.get('/reports/adjustments/options');
        return response.data.data;
    },
    async list(
        params: Record<string, unknown> = {},
    ): Promise<FinancialAdjustmentListResponse> {
        const response = await apiClient.get('/reports/adjustments', {
            params,
        });
        return response.data;
    },
    async get(id: number): Promise<FinancialAdjustment> {
        const response = await apiClient.get(`/reports/adjustments/${id}`);
        return response.data.data;
    },
    async create(
        payload: FinancialAdjustmentPayload,
    ): Promise<FinancialAdjustment> {
        const response = await apiClient.post('/reports/adjustments', payload);
        return response.data.data;
    },
    async reverse(
        id: number,
        payload: {
            idempotency_key: string;
            reason: string;
            notes?: string;
            business_datetime: string;
        },
    ): Promise<FinancialAdjustment> {
        const response = await apiClient.post(
            `/reports/adjustments/${id}/reverse`,
            payload,
        );
        return response.data.data;
    },
};
