import type {
    OperationalExpense,
    OperationalExpenseCategoryRecord,
    OperationalExpenseFilters,
    OperationalExpenseListResponse,
    OperationalExpensePayload,
    OperationalExpenseBeneficiary,
    OperationalExpenseParty,
} from '@/types/operational-expense';
import apiClient from './api/client';

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

    async listCategories(): Promise<OperationalExpenseCategoryRecord[]> {
        const response = await apiClient.get('/operational-expense-categories');
        return response.data.data ?? [];
    },

    async createCategory(payload: {
        name: string;
        subcategory?: string | null;
        default_ledger_account_id?: number | null;
        expense_kind?: string;
        affects_cash_flow?: boolean;
        affects_income_statement?: boolean;
    }): Promise<OperationalExpenseCategoryRecord> {
        const response = await apiClient.post(
            '/operational-expense-categories',
            payload,
        );
        return response.data.data;
    },

    async searchParties(q = ''): Promise<OperationalExpenseParty[]> {
        const response = await apiClient.get('/operational-expenses/parties', {
            params: { q, limit: 50 },
        });
        return response.data.data ?? [];
    },

    async createBeneficiary(payload: {
        name: string;
        type: 'individual' | 'company';
        email?: string | null;
        phone?: string | null;
        notes?: string | null;
    }): Promise<OperationalExpenseBeneficiary> {
        const response = await apiClient.post(
            '/operational-expense-beneficiaries',
            payload,
        );
        return response.data.data;
    },

    async getBeneficiary(id: number): Promise<OperationalExpenseBeneficiary> {
        const response = await apiClient.get(
            `/operational-expense-beneficiaries/${id}`,
        );
        return response.data.data;
    },
};
