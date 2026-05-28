import apiClient from './api/client';
import type {
    SalesQuote,
    SalesQuoteOperationalDetail,
    SalesQuotesListFilters,
} from '@/types/sales-quote';

const BASE_PATH = '/sales-quotes';

export const SalesQuotesApiService = {
    async list(params: SalesQuotesListFilters = {}): Promise<any> {
        const response = await apiClient.get(BASE_PATH, { params });

        return response.data;
    },

    async show(id: number): Promise<SalesQuote> {
        const response = await apiClient.get<SalesQuote>(`${BASE_PATH}/${id}`);

        return response.data;
    },

    async getOperationalDetail(
        id: number,
    ): Promise<SalesQuoteOperationalDetail> {
        const response = await apiClient.get<{
            success: boolean;
            data: SalesQuoteOperationalDetail;
        }>(`${BASE_PATH}/${id}/operational-detail`);

        return response.data.data;
    },

    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_PATH}/${id}`);
    },

    async transition(
        id: number,
        action: 'send-to-deposit' | 'send-to-cashier' | 'mark-collected',
    ): Promise<any> {
        const response = await apiClient.post(`${BASE_PATH}/${id}/${action}`);

        return response.data;
    },

    async convert(
        id: number,
        payload: {
            payment_method: string;
            payment_status?: string;
            initial_payment?: number;
        },
    ): Promise<any> {
        const response = await apiClient.post(
            `${BASE_PATH}/${id}/convert`,
            payload,
        );

        return response.data;
    },
};
