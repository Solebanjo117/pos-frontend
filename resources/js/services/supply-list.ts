import apiClient from './api/client'

const BASE_URL = '/supply-list'

export interface SupplyListItem {
    id: number
    product_id: number
    variant_id: number | null
    supplier_id: number | null
    quantity_needed: number
    unit_cost: number
    tax_rate: number
    sale_price: number
    notes: string | null
    subtotal: number
    tax_amount: number
    total: number
    product?: { id: number; name: string; sku_base: string }
    variant?: { id: number; sku: string }
    supplier?: { id: number; name: string }
    added_by?: { id: number; name: string }
    created_at: string
}

export const supplyListService = {
    /** Get all pending supply list items */
    async getItems(): Promise<SupplyListItem[]> {
        const { data } = await apiClient.get(BASE_URL)
        return data.data
    },

    /** Add item to supply list */
    async addItem(payload: {
        product_id: number
        variant_id?: number | null
        supplier_id?: number | null
        quantity_needed?: number
        unit_cost?: number
        tax_rate?: number
        sale_price?: number
        notes?: string
    }): Promise<SupplyListItem> {
        const { data } = await apiClient.post(BASE_URL, payload)
        return data.data
    },

    /** Update item in supply list (inline editing) */
    async updateItem(id: number, payload: {
        supplier_id?: number | null
        quantity_needed?: number
        unit_cost?: number
        tax_rate?: number
        sale_price?: number
        notes?: string
    }): Promise<SupplyListItem> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, payload)
        return data.data
    },

    /** Remove item from supply list */
    async removeItem(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`)
    },

    /** Convert supply list into PurchaseOrders grouped by supplier */
    async convert(): Promise<{ message: string; orders_created: { id: number; po_number: string; supplier: string; items_count: number }[] }> {
        const { data } = await apiClient.post(`${BASE_URL}/convert`)
        return data
    },

    /** Convert filtered items (by supplier) into PurchaseOrders */
    async convertFiltered(itemIds: number[]): Promise<{ message: string; orders_created: { id: number; po_number: string; supplier: string; items_count: number }[] }> {
        const { data } = await apiClient.post(`${BASE_URL}/convert`, { item_ids: itemIds })
        return data
    },

    /** Import low stock products into supply list */
    async importLowStock(warehouseId?: number): Promise<{
        message: string
        imported_count: number
        skipped_count: number
        items: { id: number; product_name: string; supplier_name: string; quantity: number }[]
    }> {
        const { data } = await apiClient.post(`${BASE_URL}/import-low-stock`, { warehouse_id: warehouseId })
        return data
    },
}
