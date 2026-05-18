import apiClient from './api/client';
import type {
    OperationalExpense,
    OperationalExpenseFilters,
    OperationalExpenseListResponse,
    OperationalExpensePayload,
} from '@/types/operational-expense';

export const operationalExpensesService = {
    async list(
        filters: OperationalExpenseFilters = {},
    ): Promise<OperationalExpenseListResponse> {
        const response = await apiClient.get('/operational-expenses', {
            params: filters,
        });
        return response.data;
    },

    async create(
        payload: OperationalExpensePayload,
    ): Promise<OperationalExpense> {
        const response = await apiClient.post('/operational-expenses', payload);
        return response.data.data;
    },

    async update(
        id: number,
        payload: OperationalExpensePayload,
    ): Promise<OperationalExpense> {
        const response = await apiClient.put(
            `/operational-expenses/${id}`,
            payload,
        );
        return response.data.data;
    },

    async remove(id: number): Promise<void> {
        await apiClient.delete(`/operational-expenses/${id}`);
    },
};
