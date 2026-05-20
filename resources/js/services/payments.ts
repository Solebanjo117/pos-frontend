import apiClient from './api/client';

export const SalesOrderPaymentApiService = {
    /**
     * Get all payments for an order
     */
    async getPayments(orderId: number) {
        const { data } = await apiClient.get(
            `/sales-orders/${orderId}/payments`,
        );
        return data;
    },

    /**
     * Add a payment / abono to an order
     */
    async addPayment(
        orderId: number,
        payload: {
            amount: number;
            method: 'cash' | 'card' | 'transfer' | 'credit';
            notes?: string;
            paid_at?: string;
        },
    ) {
        const { data } = await apiClient.post(
            `/sales-orders/${orderId}/payments`,
            payload,
        );
        return data;
    },
};

export const AccountsReceivableApiService = {
    /**
     * Get customers with outstanding balance (current_balance > 0)
     */
    async getDebtors(params?: {
        search?: string;
        per_page?: number;
        page?: number;
        date_from?: string;
        date_to?: string;
        warehouse_id?: number;
    }) {
        const { data } = await apiClient.get('/accounts-receivable', {
            params: { ...params, per_page: params?.per_page ?? 50 },
        });
        return data;
    },

    /**
     * Get a customer's transactions and open orders
     */
    async getCustomerStatement(
        customerId: number,
        params?: {
            date_from?: string;
            date_to?: string;
            warehouse_id?: number;
        },
    ) {
        const { data } = await apiClient.get(
            `/accounts-receivable/${customerId}/statement`,
            { params },
        );
        return data;
    },

    /**
     * Get open/partial orders for a customer
     */
    async getCustomerOrders(customerId: number) {
        const { data } = await apiClient.get('/sales-orders', {
            params: {
                customer_id: customerId,
                payment_status: 'pending,partial',
                per_page: 100,
            },
        });
        return data;
    },

    async recordReceipt(
        customerId: number,
        payload: {
            amount: number;
            method: string;
            reference_number?: string;
            notes?: string;
            paid_at?: string;
            applications?: Array<{ document_id: number; amount: number }>;
        },
    ) {
        const { data } = await apiClient.post(
            `/accounts-receivable/${customerId}/receipts`,
            payload,
        );
        return data;
    },
};
