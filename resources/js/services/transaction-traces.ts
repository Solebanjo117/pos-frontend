import apiClient from '@/services/api/client';
import type { TransactionTrace } from '@/types/transaction-trace';

export const transactionTraceService = {
    async get(
        type: string,
        id: number,
        page = 1,
        perPage = 25,
        signal?: AbortSignal,
    ): Promise<TransactionTrace> {
        const { data } = await apiClient.get(
            `/transaction-traces/${encodeURIComponent(type)}/${id}`,
            { params: { page, per_page: perPage }, signal },
        );

        return data.data;
    },
};
