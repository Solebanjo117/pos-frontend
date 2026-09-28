import type {
    TransactionFilters,
    TransactionListResponse,
} from '@/types/transaction-list';
import apiClient from './api/client';

export const transactionsService = {
    async list(filters: TransactionFilters): Promise<TransactionListResponse> {
        const response = await apiClient.get<TransactionListResponse>(
            '/transactions',
            { params: filters },
        );
        return response.data;
    },
};
