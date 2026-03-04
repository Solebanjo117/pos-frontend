import apiClient from './api/client'
import type {
    Supplier,
    SupplierFilters,
    CreateSupplierData,
    UpdateSupplierData,
} from '@/types/supplier'

const BASE_URL = '/suppliers'

export const suppliersService = {
    /**
     * Get all suppliers with filters
     */
    async getAll(filters?: SupplierFilters) {
        const { data } = await apiClient.get(BASE_URL, { params: filters })
        return data
    },

    /**
     * Get all active suppliers (for dropdowns)
     */
    async getAllActive() {
        const { data } = await apiClient.get(`${BASE_URL}/all`)
        return data.data
    },

    /**
     * Get single supplier by ID
     */
    async getById(id: number) {
        const { data } = await apiClient.get(`${BASE_URL}/${id}`)
        return data
    },

    /**
     * Create new supplier
     */
    async create(supplierData: CreateSupplierData): Promise<Supplier> {
        const { data } = await apiClient.post(BASE_URL, supplierData)
        return data.data
    },

    /**
     * Update existing supplier
     */
    async update(id: number, supplierData: UpdateSupplierData): Promise<Supplier> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, supplierData)
        return data.data
    },

    /**
     * Delete supplier
     */
    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`)
    },

    /**
     * Get supplier's purchase orders
     */
    async getPurchaseOrders(id: number) {
        const { data } = await apiClient.get(`${BASE_URL}/${id}/purchase-orders`)
        return data
    },
}
