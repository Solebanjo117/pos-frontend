export interface Warehouse {
    id: number;
    name: string;
    code: string;
    location?: string;
    capacity?: number;
    status: 'active' | 'inactive';
    notes?: string;
    created_at: string;
    updated_at: string;
    // Computed fields
    total_products?: number;
    total_units?: number;
    total_value?: number;
    low_stock_products?: number;
    out_of_stock_products?: number;
    utilization_percentage?: number;
}

export interface WarehouseFilters {
    search?: string;
    status?: 'active' | 'inactive';
    order_by?: string;
    order_direction?: 'asc' | 'desc';
}

export interface WarehouseInventoryFilters {
    search?: string;
    low_stock?: boolean;
    out_of_stock?: boolean;
    order_by?: string;
    order_direction?: 'asc' | 'desc';
}

export interface CreateWarehouseRequest {
    name: string;
    code: string;
    location?: string;
    capacity?: number;
    status: 'active' | 'inactive';
    notes?: string;
}

export interface UpdateWarehouseRequest {
    name?: string;
    code?: string;
    location?: string;
    capacity?: number;
    status?: 'active' | 'inactive';
    notes?: string;
}

export interface PaginatedWarehousesResponse {
    data: Warehouse[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}
