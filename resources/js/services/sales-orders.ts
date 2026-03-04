import apiClient from './api/client'
import type {
    SalesOrder,
    SalesOrderFilters,
    SalesOrderStatistics,
    CreateSalesOrderData,
    UpdateSalesOrderData,
    AddOrderItemData,
    UpdateOrderItemData,
    SalesOrderItem,
} from '@/types/sales-order'

const BASE_URL = '/sales-orders'

export const salesOrdersService = {
    /**
     * Get all sales orders with filters
     */
    async getAll(filters?: SalesOrderFilters) {
        const { data } = await apiClient.get(BASE_URL, { params: filters })
        return data
    },

    /**
     * Get single sales order by ID
     */
    async getById(id: number): Promise<SalesOrder> {
        const { data } = await apiClient.get(`${BASE_URL}/${id}`)
        return data
    },

    /**
     * Create new sales order
     */
    async create(orderData: CreateSalesOrderData): Promise<SalesOrder> {
        const { data } = await apiClient.post(BASE_URL, orderData)
        return data.data
    },

    /**
     * Update existing sales order
     */
    async update(id: number, orderData: UpdateSalesOrderData): Promise<SalesOrder> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, orderData)
        return data.data
    },

    /**
     * Delete sales order
     */
    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`)
    },

    /**
     * Confirm order and deduct inventory
     */
    async confirm(id: number): Promise<SalesOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/confirm`)
        return data.data
    },

    /**
     * Complete order
     */
    async complete(id: number): Promise<SalesOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/complete`)
        return data.data
    },

    /**
     * Cancel order and revert inventory
     */
    async cancel(id: number): Promise<SalesOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/cancel`)
        return data.data
    },

    /**
     * Add item to order
     */
    async addItem(orderId: number, itemData: AddOrderItemData): Promise<SalesOrderItem> {
        const { data } = await apiClient.post(`${BASE_URL}/${orderId}/items`, itemData)
        return data.data
    },

    /**
     * Update order item
     */
    async updateItem(itemId: number, itemData: UpdateOrderItemData): Promise<SalesOrderItem> {
        const { data } = await apiClient.put(`${BASE_URL}/items/${itemId}`, itemData)
        return data.data
    },

    /**
     * Remove item from order
     */
    async removeItem(itemId: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/items/${itemId}`)
    },

    /**
     * Get sales statistics
     */
    async getStatistics(filters?: { date_from?: string; date_to?: string }): Promise<SalesOrderStatistics> {
        const { data } = await apiClient.get(`${BASE_URL}/statistics`, { params: filters })
        return data
    },
}
