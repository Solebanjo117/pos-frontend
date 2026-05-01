import apiClient from './api/client';

const BASE_URL = '/supply-list';

export interface SupplyListItem {
    id: number;
    product_id: number;
    variant_id: number | null;
    supplier_id: number | null;
    warehouse_id: number;
    supply_date: string;
    quantity_needed: number;
    stock_added_qty: number;
    unit_cost: number;
    tax_rate: number;
    sale_price: number;
    notes: string | null;
    subtotal: number;
    tax_amount: number;
    total: number;
    product?: { id: number; name: string; sku_base: string };
    variant?: { id: number; sku: string };
    supplier?: { id: number; name: string };
    warehouse?: { id: number; name: string };
    added_by?: { id: number; name: string };
    created_at: string;
}

export interface SupplyListAddItemResult {
    item: SupplyListItem;
    stock_added: number;
}

export const supplyListService = {
    /** Get all pending supply list items */
    async getItems(params?: {
        warehouse_id?: number | null;
        supply_date?: string;
    }): Promise<SupplyListItem[]> {
        const { data } = await apiClient.get(BASE_URL, { params });
        return data.data;
    },

    /** Add item to supply list */
    async addItem(payload: {
        product_id: number;
        variant_id?: number | null;
        supplier_id?: number | null;
        warehouse_id?: number | null;
        supply_date?: string;
        quantity_needed?: number;
        unit_cost?: number;
        tax_rate?: number;
        sale_price?: number;
        notes?: string;
    }): Promise<SupplyListAddItemResult> {
        const { data } = await apiClient.post(BASE_URL, payload);
        return {
            item: data.data,
            stock_added: Number(
                data.stock_added ?? payload.quantity_needed ?? 1,
            ),
        };
    },

    /** Update item in supply list (inline editing) */
    async updateItem(
        id: number,
        payload: {
            supplier_id?: number | null;
            warehouse_id?: number | null;
            supply_date?: string;
            quantity_needed?: number;
            unit_cost?: number;
            tax_rate?: number;
            sale_price?: number;
            notes?: string;
        },
    ): Promise<SupplyListItem> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, payload);
        return data.data;
    },

    /** Remove item from supply list */
    async removeItem(
        id: number,
        params?: { warehouse_id?: number | null; supply_date?: string },
    ): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`, { params });
    },

    /** Convert supply list into PurchaseOrders grouped by supplier */
    async convert(payload?: {
        warehouse_id?: number | null;
        supply_date?: string;
    }): Promise<{
        message: string;
        orders_created: {
            id: number;
            po_number: string;
            supplier: string;
            items_count: number;
        }[];
    }> {
        const { data } = await apiClient.post(
            `${BASE_URL}/convert`,
            payload ?? {},
        );
        return data;
    },

    /** Convert filtered items (by supplier) into PurchaseOrders */
    async convertFiltered(
        itemIds: number[],
        payload?: { warehouse_id?: number | null; supply_date?: string },
    ): Promise<{
        message: string;
        orders_created: {
            id: number;
            po_number: string;
            supplier: string;
            items_count: number;
        }[];
    }> {
        const { data } = await apiClient.post(`${BASE_URL}/convert`, {
            ...(payload ?? {}),
            item_ids: itemIds,
        });
        return data;
    },

    /** Import low stock products into supply list */
    async importLowStock(
        warehouseId?: number | null,
        supplyDate?: string,
    ): Promise<{
        message: string;
        imported_count: number;
        skipped_count: number;
        items: {
            id: number;
            product_name: string;
            supplier_name: string;
            quantity: number;
        }[];
    }> {
        const { data } = await apiClient.post(`${BASE_URL}/import-low-stock`, {
            warehouse_id: warehouseId,
            supply_date: supplyDate,
        });
        return data;
    },
};
