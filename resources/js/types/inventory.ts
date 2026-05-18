// Inventory Types
export interface InventoryItem {
    id: number;
    product_id: number;
    product_name: string;
    product_sku: string;
    brand: string;
    warehouse_id: number;
    warehouse_name: string;
    stock_available: number;
    stock_reserved: number;
    stock_on_order: number;
    reorder_point: number;
    target_level: number;
    needs_reorder: boolean;
    status: 'out_of_stock' | 'low_stock' | 'normal' | 'optimal';
    base_price: number | null; // precio de venta (product_pricing.base_price)
    cost: number | null; // costo de adquisición
}

export interface Warehouse {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
}

export interface InventoryFilters {
    warehouse_id?: number;
    low_stock?: boolean;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface UpdateInventoryRequest {
    stock_available?: number;
    stock_reserved?: number;
    stock_on_order?: number;
    reorder_point?: number;
    target_level?: number;
    variant_id?: number;
}

export interface InventoryPaginatedResponse {
    data: InventoryItem[];
    meta: {
        current_page: number;
        from: number;
        last_page: number;
        per_page: number;
        to: number;
        total: number;
    };
}
