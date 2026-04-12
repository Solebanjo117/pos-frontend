import type { Product } from './product'
import type { Warehouse } from './warehouse'

export interface InventoryMovement {
    id: number
    movement_type: 'in' | 'out' | 'transfer'
    product: {
        id: number
        name: string
        sku: string
    }
    variant?: {
        id: number
        sku: string
    } | null
    warehouse: {
        id: number
        name: string
        code: string
    }
    destination_warehouse?: {
        id: number
        name: string
        code: string
    } | null
    product_batch_id?: number | null
    product_batch?: {
        id: number
        batch_number: string
        expiry_date?: string | null
    } | null
    quantity: number
    reference_type?: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'return'
    reference_id?: number
    notes?: string
    user?: {
        id: number
        name: string
    } | null
    supplier?: {
        id: number
        name: string
    } | null
    created_at: string
    updated_at: string
}

export interface InventoryMovementFilters {
    product_id?: number
    warehouse_id?: number
    movement_type?: 'in' | 'out' | 'transfer'
    date_from?: string
    date_to?: string
    search?: string
    variant_id?: number
}

export interface CreateInboundMovementRequest {
    product_id: number
    variant_id?: number
    warehouse_id: number
    quantity: number
    reference_type?: 'purchase' | 'adjustment' | 'return'
    reference_id?: number
    notes?: string
    batch_number?: string
    expiry_date?: string
    manufacturing_date?: string
    cost?: number
}

export interface CreateOutboundMovementRequest {
    product_id: number
    variant_id?: number
    warehouse_id: number
    quantity: number
    reference_type?: 'sale' | 'adjustment' | 'transfer'
    reference_id?: number
    notes?: string
    product_batch_id?: number
}

export interface CreateTransferMovementRequest {
    product_id: number
    variant_id?: number
    warehouse_id: number
    destination_warehouse_id: number
    quantity: number
    notes?: string
    product_batch_id?: number
}

export interface PaginatedMovementsResponse {
    data: InventoryMovement[]
    meta: {
        current_page: number
        last_page: number
        per_page: number
        total: number
    }
}
