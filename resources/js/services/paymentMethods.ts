import type {
    PaymentMethod,
    PaymentMethodContext,
    CreatePaymentMethodData,
    UpdatePaymentMethodData,
} from '@/types/payment-method';
import apiClient from './api/client';

const BASE_URL = '/payment-methods';

export const paymentMethodsService = {
    /**
     * Get all active payment methods (for POS, dropdowns)
     */
    async getActive(
        context?: PaymentMethodContext,
        realMoney = false,
    ): Promise<PaymentMethod[]> {
        const { data } = await apiClient.get(BASE_URL, {
            params: { context, real_money: realMoney || undefined },
        });
        return data;
    },

    /**
     * Get ALL payment methods including inactive (admin)
     */
    async getAll(): Promise<PaymentMethod[]> {
        const { data } = await apiClient.get(`${BASE_URL}/all`);
        return data;
    },

    /**
     * Create new payment method
     */
    async create(methodData: CreatePaymentMethodData): Promise<PaymentMethod> {
        const { data } = await apiClient.post(BASE_URL, methodData);
        return data;
    },

    /**
     * Update existing payment method
     */
    async update(
        id: number,
        methodData: UpdatePaymentMethodData,
    ): Promise<PaymentMethod> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, methodData);
        return data;
    },

    /**
     * Archive (soft delete) payment method
     */
    async archive(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`);
    },

    /**
     * Reorder payment methods
     */
    async reorder(order: number[]): Promise<void> {
        await apiClient.post(`${BASE_URL}/reorder`, { order });
    },
};
