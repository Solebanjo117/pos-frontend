import apiClient from './api/client'
import type { PaymentMethod, CreatePaymentMethodData, UpdatePaymentMethodData } from '@/types/payment-method'

const BASE_URL = '/payment-methods'

export const paymentMethodsService = {
    /**
     * Get all active payment methods (for POS, dropdowns)
     */
    async getActive(): Promise<PaymentMethod[]> {
        const { data } = await apiClient.get(BASE_URL)
        return data
    },

    /**
     * Get ALL payment methods including inactive (admin)
     */
    async getAll(): Promise<PaymentMethod[]> {
        const { data } = await apiClient.get(`${BASE_URL}/all`)
        return data
    },

    /**
     * Create new payment method
     */
    async create(methodData: CreatePaymentMethodData): Promise<PaymentMethod> {
        const { data } = await apiClient.post(BASE_URL, methodData)
        return data
    },

    /**
     * Update existing payment method
     */
    async update(id: number, methodData: UpdatePaymentMethodData): Promise<PaymentMethod> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, methodData)
        return data
    },

    /**
     * Archive (soft delete) payment method
     */
    async archive(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`)
    },

    /**
     * Reorder payment methods
     */
    async reorder(order: number[]): Promise<void> {
        await apiClient.post(`${BASE_URL}/reorder`, { order })
    },
}
