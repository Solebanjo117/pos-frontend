import type {
    SalesReturnCreatePayload,
    SalesReturnListFilters,
    SalesReturnOperationalDetail,
} from '@/types/sales-return';
import apiClient from './api/client';

const BASE_PATH = '/sales-returns';

export const SalesReturnsApiService = {
    async list(params: SalesReturnListFilters = {}): Promise<any> {
        const response = await apiClient.get(BASE_PATH, { params });

        return response.data;
    },

    async getOperationalDetail(
        id: number,
    ): Promise<SalesReturnOperationalDetail> {
        const response = await apiClient.get<{
            success: boolean;
            data: SalesReturnOperationalDetail;
        }>(`${BASE_PATH}/${id}/operational-detail`);

        return response.data.data;
    },

    async createForOrder(
        orderId: number,
        payload: SalesReturnCreatePayload,
    ): Promise<any> {
        const response = await apiClient.post(
            `/sales-orders/${orderId}/returns`,
            payload,
        );

        return response.data;
    },

    async approve(id: number): Promise<any> {
        const response = await apiClient.post(`${BASE_PATH}/${id}/approve`);

        return response.data;
    },

    async reject(id: number): Promise<any> {
        const response = await apiClient.post(`${BASE_PATH}/${id}/reject`);

        return response.data;
    },
};
