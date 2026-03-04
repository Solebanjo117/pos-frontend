export interface StockLevelSummary {
    total_products: number
    critical_stock: number
    low_stock: number
    normal_stock: number
    optimal_stock: number
    total_value: number
}

export interface WarehouseStockSummary {
    warehouse_id: number
    warehouse_name: string
    total_products: number
    critical: number
    low: number
    normal: number
    optimal: number
}

export interface ProductStockLevel {
    id: number
    sku: string
    name: string
    brand: string | null
    warehouse_id: number
    warehouse: string
    current_stock: number
    reorder_point: number
    target_level: number
    status: 'critical' | 'low' | 'normal' | 'optimal'
    stock_value: number
}

export interface StockLevelsReport {
    summary: StockLevelSummary
    by_warehouse: WarehouseStockSummary[]
    products: ProductStockLevel[]
}

export interface MovementHistorySummary {
    total_movements: number
    total_inbound: number
    total_outbound: number
    total_transfers: number
    total_quantity_in: number
    total_quantity_out: number
    net_change: number
}

export interface TimelineData {
    date: string
    inbound: number
    outbound: number
    transfers: number
    net: number
}

export interface ProductMovementSummary {
    product_id: number
    product_name: string
    product_sku: string
    total_movements: number
    inbound: number
    outbound: number
    transfers: number
}

export interface MovementDetail {
    id: number
    date: string
    product_id: number
    product_name: string
    product_sku: string
    warehouse: string
    destination_warehouse: string | null
    movement_type: 'in' | 'out' | 'transfer'
    quantity: number
    reference_type: string | null
    reference_id: string | null
    user: string | null
}

export interface MovementHistoryReport {
    summary: MovementHistorySummary
    timeline: TimelineData[]
    by_product: ProductMovementSummary[]
    movements: MovementDetail[]
}

export interface StockLevelsFilters {
    warehouse_id?: number
    brand_id?: number
    category_id?: number
    status?: 'critical' | 'low' | 'normal' | 'optimal'
}

export interface MovementHistoryFilters {
    date_from: string
    date_to: string
    product_id?: number | null
    warehouse_id?: number | null
    user_id?: number | null
    movement_type?: 'in' | 'out' | 'transfer' | null
    group_by?: 'day' | 'week' | 'month' | 'product' | 'warehouse'
}
