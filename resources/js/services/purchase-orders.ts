import apiClient from './api/client'
import type {
    PurchaseOrder,
    PurchaseOrderFilters,
    PurchaseOrderStatistics,
    CreatePurchaseOrderData,
    UpdatePurchaseOrderData,
    ReceiveItemsData,
} from '@/types/purchase-order'

const BASE_URL = '/purchase-orders'

export const purchaseOrdersService = {
    /**
     * Get all purchase orders with filters
     */
    async getAll(filters?: PurchaseOrderFilters) {
        const { data } = await apiClient.get(BASE_URL, { params: filters })
        return data
    },

    /**
     * Get single purchase order by ID
     */
    async getById(id: number): Promise<{ data: PurchaseOrder }> {
        const { data } = await apiClient.get(`${BASE_URL}/${id}`)
        return data
    },

    /**
     * Create new purchase order
     */
    async create(orderData: CreatePurchaseOrderData): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(BASE_URL, orderData)
        return data.data
    },

    /**
     * Fast-track create, send and receive purchase order (Backorders)
     */
    async quickReceive(orderData: any): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/quick-receive`, orderData)
        return data.data
    },

    /**
     * Update existing purchase order
     */
    async update(id: number, orderData: UpdatePurchaseOrderData): Promise<PurchaseOrder> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, orderData)
        return data.data
    },

    /**
     * Delete purchase order
     */
    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`)
    },

    /**
     * Send purchase order to supplier
     */
    async send(id: number): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/send`)
        return data.data
    },

    /**
     * Receive items for a purchase order
     */
    async receive(id: number, receiveData: ReceiveItemsData): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/receive`, receiveData)
        return data.data
    },

    /**
     * Cancel purchase order
     */
    async cancel(id: number): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/cancel`)
        return data.data
    },

    /**
     * Get purchase order statistics
     */
    async getStatistics(filters?: { date_from?: string; date_to?: string }): Promise<PurchaseOrderStatistics> {
        const { data } = await apiClient.get(`${BASE_URL}/statistics`, { params: filters })
        return data
    },
}
