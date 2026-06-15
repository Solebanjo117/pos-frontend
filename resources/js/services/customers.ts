import apiClient from './api/client';
import type {
    Customer,
    CustomerFilters,
    CustomerFormData,
    CustomerBalanceSummary,
    CustomerProfileSummary,
    CustomerTransaction,
    CustomerVehicle,
    CustomerVehicleFormData,
    CustomerSalesHistory,
    CustomerSalesHistoryFilters,
} from '@/types/customer';

export const CustomersApiService = {
    /**
     * Get paginated customers list
     */
    async getCustomers(filters: CustomerFilters = {}, page = 1, perPage = 15) {
        const params = {
            ...filters,
            page,
            per_page: perPage,
        };
        return await apiClient.get<{
            data: Customer[];
            total: number;
            current_page: number;
            last_page: number;
        }>('/customers', { params });
    },

    /**
     * Search customers (autocomplete)
     */
    async searchCustomers(query: string, limit = 10) {
        return await apiClient.get<Customer[]>('/customers/search', {
            params: { q: query, limit },
        });
    },

    /**
     * Get single customer
     */
    async getCustomer(id: number) {
        return await apiClient.get<{
            customer: Customer;
            balance_summary: CustomerBalanceSummary;
            profile_summary: CustomerProfileSummary;
        }>(`/customers/${id}`);
    },

    async getSalesHistory(
        id: number,
        filters: CustomerSalesHistoryFilters = {},
    ) {
        return await apiClient.get<CustomerSalesHistory>(
            `/customers/${id}/sales-history`,
            { params: filters },
        );
    },

    async getVehicles(id: number) {
        return await apiClient.get<{ data: CustomerVehicle[] }>(
            `/customers/${id}/vehicles`,
        );
    },

    async createVehicle(id: number, data: CustomerVehicleFormData) {
        return await apiClient.post<{ data: CustomerVehicle }>(
            `/customers/${id}/vehicles`,
            data,
        );
    },

    async updateVehicle(
        id: number,
        vehicleId: number,
        data: Partial<CustomerVehicleFormData>,
    ) {
        return await apiClient.put<{ data: CustomerVehicle }>(
            `/customers/${id}/vehicles/${vehicleId}`,
            data,
        );
    },

    async deleteVehicle(id: number, vehicleId: number) {
        return await apiClient.delete<{ data: CustomerVehicle }>(
            `/customers/${id}/vehicles/${vehicleId}`,
        );
    },

    /**
     * Create customer
     */
    async createCustomer(data: CustomerFormData) {
        return await apiClient.post<Customer>('/customers', data);
    },

    /**
     * Update customer
     */
    async updateCustomer(id: number, data: Partial<CustomerFormData>) {
        return await apiClient.put<Customer>(`/customers/${id}`, data);
    },

    /**
     * Delete customer
     */
    async deleteCustomer(id: number) {
        return await apiClient.delete(`/customers/${id}`);
    },

    /**
     * Get customer transactions
     */
    async getTransactions(id: number, page = 1) {
        return await apiClient.get<{
            data: CustomerTransaction[];
            total: number;
            current_page: number;
            last_page: number;
        }>(`/customers/${id}/transactions`, { params: { page } });
    },

    /**
     * Adjust customer balance
     */
    async adjustBalance(id: number, amount: number, reason: string) {
        return await apiClient.post<{
            message: string;
            transaction: CustomerTransaction;
            new_balance: number;
        }>(`/customers/${id}/adjust-balance`, { amount, reason });
    },
};
