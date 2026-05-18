import apiClient from './api/client';

export interface LowStockItem {
    inventory_id: number;
    product_id: number;
    product: {
        id: number;
        sku: string;
        name: string;
    };
    warehouse_id: number;
    warehouse_name: string;
    current_stock: number;
    reorder_point: number;
    reorder_quantity: number;
    suggested_quantity: number;
    unit_cost: number;
    lead_time_days: number;
    minimum_order_qty: number;
}

export interface SupplierLowStock {
    supplier: {
        id: number;
        name: string;
        email?: string;
        phone?: string;
    };
    items: LowStockItem[];
}

export interface LowStockStats {
    total_items: number;
    critical_stock: number;
    low_stock: number;
    without_supplier: number;
}

export interface BatchCreateOrder {
    supplier_id: number;
    warehouse_id: number;
    notes?: string;
    items: {
        product_id: number;
        quantity: number;
        unit_cost: number;
        notes?: string;
    }[];
}

export interface CreatedPurchaseOrder {
    id: number;
    po_number: string;
    supplier: { id: number; name: string };
    warehouse: { id: number; name: string };
    status: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    items: {
        id: number;
        product_id: number;
        quantity_ordered: number;
        unit_cost: number;
        product: { id: number; name: string; sku_base: string };
    }[];
}

const BASE_URL = '/smart-reorder';

export const smartReorderService = {
    async getLowStock(warehouseId?: number): Promise<SupplierLowStock[]> {
        const params = warehouseId ? { warehouse_id: warehouseId } : {};
        const { data } = await apiClient.get(`${BASE_URL}/low-stock`, {
            params,
        });
        return data.data;
    },

    async getStats(warehouseId?: number): Promise<LowStockStats> {
        const params = warehouseId ? { warehouse_id: warehouseId } : {};
        const { data } = await apiClient.get(`${BASE_URL}/stats`, { params });
        return data.data;
    },

    async batchCreate(
        orders: BatchCreateOrder[],
    ): Promise<CreatedPurchaseOrder[]> {
        const { data } = await apiClient.post(`${BASE_URL}/batch-create`, {
            orders,
        });
        return data.data;
    },
};
