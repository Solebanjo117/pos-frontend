// Product Types
export interface Brand {
    id: number
    name: string
    logo_url?: string
    description?: string
}

export interface ProductLine {
    id: number
    name: string
    description?: string
}

export interface ProductPricing {
    base_price: number
    calculated_price?: number
    msrp: number
    cost: number
    margin_percentage: number
    tax_rate: number
    tax_type?: 'standard' | 'exempt' | 'custom'
    max_discount_percentage?: number
}

export interface AttributeDefinition {
    id: number
    name: string
    data_type: 'decimal' | 'string'
    unit?: string
}

export interface ProductAttribute {
    name: string
    value: number | string
    unit?: string
    data_type: string
}

export interface Supplier {
    id: number
    name: string
    contact_name?: string
    email?: string
    phone?: string
}

export interface ProductSupplier {
    id: number
    name: string
    supplier_cost: number
    lead_time_days: number
    minimum_order_quantity: number
    is_preferred: boolean
}

export interface Warehouse {
    id: number
    name: string
    code: string
}

export interface ProductInventory {
    id: number
    warehouse_id: number
    variant_id: number | null
    variant_sku?: string
    // Standardized fields matching VariantInventory
    warehouse?: {
        id: number
        name: string
        code: string
    }
    stock_available: number
    stock_reserved: number
    stock_on_order: number
    reorder_point: number
    needs_reorder: boolean
    // Legacy fields (optional if needed)
    quantity_available?: number
    quantity_reserved?: number
}

export interface VariantInventory {
    warehouse: {
        id: number
        name: string
        code: string
    }
    stock_available: number
    stock_reserved: number
    stock_on_order: number
    reorder_point: number
    needs_reorder: boolean
}

export interface ProductMedia {
    id: number
    media_type: string
    category: string
    filename: string
    url: string
    file_size: string
    display_order: number
}

export interface OemReference {
    oem_code: string
    manufacturer: string
}

export interface VehicleCompatibility {
    make: string
    model: string
    year_range: string
    engine: string
    notes?: string
}

export interface AlternativeProduct extends Product {
    pivot: {
        primary_product_id: number
        alternative_product_id: number
        relationship_type: 'compatible' | 'substitute' | 'upgrade'
    }
}

// Main Product Interface (Base Product)
export interface Product {
    id: number
    sku_base: string  // Base SKU (e.g., "ALT-12V-90A")
    name: string
    description?: string
    image_url?: string | null
    status: 'active' | 'discontinued' | 'pending'
    batch_tracking: boolean
    is_universal?: boolean
    category_id?: number
    product_line?: ProductLine
    category?: {
        id: number
        name: string
        name_en?: string
    }
    pricing?: ProductPricing
    // Variant information
    default_variant?: ProductVariant
    variants?: ProductVariant[]
    variants_count?: number
    total_stock?: number
    fitment_status?: 'exact' | 'universal' | 'incompatible'
    created_at: string
    updated_at: string
    // Optional loaded relationships
    inventory?: ProductInventory[]
    key_attributes?: Array<{
        name: string
        value: string
        unit?: string
    }>
    brand?: Brand
}

// Product Variant Interface (Brand-specific variant)
export interface ProductVariant {
    id: number
    product_id: number
    brand_id: number
    sku: string
    upc?: string
    is_default: boolean
    brand?: Brand
    pricing?: ProductPricing           // Variant-level pricing (overrides product pricing)
    total_stock?: number
    created_at: string
    updated_at: string
    inventory?: VariantInventory[]
    attributes?: ProductAttribute[]   // Variant-specific spec overrides
}

export interface ProductVin {
    id: number
    vin: string
    description?: string
    created_at?: string
}

// Detailed Product (with all relationships)
export interface ProductDetail extends Product {
    // Direct properties from the default variant (for convenience)
    sku?: string
    upc?: string
    brand?: Brand
    pricing?: ProductPricing
    total_stock?: number
    // Relationships
    attributes?: ProductAttribute[]
    suppliers?: ProductSupplier[]
    media?: ProductMedia[]
    oem_references?: OemReference[]
    alternatives?: AlternativeProduct[]
    compatibility?: VehicleCompatibility[]
    vins?: ProductVin[]
}

// API Request Types
export interface CreateProductRequest {
    sku_base: string
    name: string
    description?: string
    product_line_id?: number
    category_id?: number
    status?: 'active' | 'discontinued' | 'pending'
    batch_tracking?: boolean
    alternate_code?: string      // alternate identifier
    pricing_formula?: string     // Excel-like pricing formula
    // Default variant fields
    brand_id: number
    sku: string
    upc?: string
    pricing: {
        base_price: number
        msrp: number
        cost: number
        tax_rate: number
        tax_type?: 'standard' | 'exempt' | 'custom'
        max_discount_percentage?: number
    }
    initial_inventory?: Array<{
        warehouse_id: number
        stock_available: number
        reorder_point?: number
        reorder_quantity?: number
    }>
    attributes?: Array<{
        name: string
        value: number | string
        unit?: string
    }>
}

export interface UpdateProductRequest {
    sku_base?: string
    upc?: string
    alternate_code?: string      // alternate identifier
    pricing_formula?: string     // Excel-like pricing formula
    product_line_id?: number
    name?: string
    description?: string
    status?: 'active' | 'discontinued' | 'pending'
    batch_tracking?: boolean
    is_universal?: boolean
    pricing?: {
        base_price?: number
        msrp?: number
        cost?: number
        tax_rate?: number
        tax_type?: 'standard' | 'exempt' | 'custom'
        max_discount_percentage?: number
    }
}

export interface ProductFilters {
    status?: 'active' | 'discontinued' | 'pending'
    brand_id?: number
    category_id?: number
    product_line_id?: number
    search?: string
    has_stock?: boolean
    vehicle_engine_id?: number
    strict_fitment?: boolean
    warehouse_id?: number
    per_page?: number
    page?: number
    // Deep linking filters
    oem_code?: string
    attribute_value?: string
    vin?: string
    // Archive filter
    archived?: 'true' | 'false' | 'all'
    // Sorting
    sortField?: string
    sortDirection?: 'asc' | 'desc'
}

// API Response Types
export interface PaginatedResponse<T> {
    data: T[]
    links: {
        first: string
        last: string
        prev: string | null
        next: string | null
    }
    meta: {
        current_page: number
        from: number
        last_page: number
        path: string
        per_page: number
        to: number
        total: number
    }
}

export interface ApiResponse<T> {
    data: T
    message?: string
}
