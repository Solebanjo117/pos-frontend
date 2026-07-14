// Product Types
export interface Brand {
    id: number;
    name: string;
    logo_url?: string;
    description?: string;
}

export interface ProductLine {
    id: number;
    name: string;
    description?: string;
}

export interface ProductPricing {
    base_price: number;
    current_sale_price?: number;
    fifo_sale_price_current?: number;
    calculated_price?: number;
    msrp: number;
    cost: number;
    cost_base?: number;
    cost_miscellaneous?: number;
    cost_total?: number;
    margin_percentage: number;
    tax_rate: number;
    sale_tax_rate?: number;
    cost_tax_rate?: number;
    tax_type?: 'standard' | 'exempt' | 'custom';
    max_discount_percentage?: number;
}

export interface AttributeDefinition {
    id: number;
    name: string;
    data_type: 'decimal' | 'string';
    unit?: string;
}

export type ProductAttributeType = 'string' | 'select';

export interface ProductAttribute {
    id?: number;
    product_id?: number;
    name: string;
    value: number | string | string[];
    unit?: string;
    required?: boolean;
    type?: ProductAttributeType;
    options?: string[] | null;
    data_type?: string;
    source?: 'category' | 'custom';
    source_category_id?: number | null;
}

export interface Supplier {
    id: number;
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
}

export interface ProductSupplier {
    id: number;
    name: string;
    supplier_cost: number;
    lead_time_days: number;
    minimum_order_quantity: number;
    is_preferred: boolean;
}

export interface Warehouse {
    id: number;
    name: string;
    code: string;
}

export interface ProductInventory {
    id: number;
    warehouse_id: number;
    variant_id: number | null;
    variant_sku?: string;
    // Standardized fields matching VariantInventory
    warehouse?: {
        id: number;
        name: string;
        code: string;
    };
    stock_available: number;
    stock_reserved: number;
    stock_on_order: number;
    reorder_point: number;
    needs_reorder: boolean;
    active_lot_id?: number | null;
    fifo_cost_current?: number;
    fifo_sale_price_current?: number;
    current_cost?: number;
    current_sale_price?: number;
    inventory_value?: number;
    // Legacy fields (optional if needed)
    quantity_available?: number;
    quantity_reserved?: number;
}

export interface VariantInventory {
    warehouse_id?: number;
    warehouse: {
        id: number;
        name: string;
        code: string;
    };
    stock_available?: number;
    stock_reserved?: number;
    stock_on_order?: number;
    quantity_available?: number;
    quantity_reserved?: number;
    reorder_point?: number;
    needs_reorder?: boolean;
    active_lot_id?: number | null;
    fifo_cost_current?: number;
    fifo_sale_price_current?: number;
    current_cost?: number;
    current_sale_price?: number;
    inventory_value?: number;
}

export interface ProductMedia {
    id: number;
    media_type: string;
    category: string;
    filename: string;
    url: string;
    file_size: string;
    display_order: number;
}

export interface ProductImage {
    id: number | null;
    url: string;
    original_filename?: string;
    display_order: number;
    source?: 'product' | 'media' | 'category';
    source_category_id?: number | null;
    category_name?: string | null;
    category_media_id?: number | null;
}

export interface OemReference {
    id?: number;
    oem_code: string;
    manufacturer: string | null;
}

export interface VehicleCompatibility {
    id?: number;
    engine_id?: number | null;
    chassis_id?: number | null;
    make?: string | null;
    model?: string | null;
    year_range?: string | null;
    engine?: string | null;
    chassis?: {
        id: number;
        code: string;
        name?: string | null;
        full_description?: string | null;
    } | null;
    all_engines?: boolean;
    all_chassis?: boolean;
    notes?: string;
}

export interface AlternativeProduct extends Product {
    pivot: {
        primary_product_id: number;
        alternative_product_id: number;
        relationship_type: 'compatible' | 'substitute' | 'upgrade';
    };
}

// Main Product Interface (Base Product)
export interface Product {
    id: number;
    system_id?: string;
    sku_base: string; // Base SKU (e.g., "ALT-12V-90A")
    alternate_code?: string | null; // Alternate identifier
    name: string;
    description?: string;
    image_url?: string | null;
    status: 'active' | 'discontinued' | 'pending';
    batch_tracking: boolean;
    is_universal?: boolean;
    category_id?: number;
    product_line?: ProductLine;
    category?: {
        id: number;
        name: string;
        name_en?: string;
    };
    extra_category_ids?: number[];
    extra_categories?: Array<{
        id: number;
        name: string;
    }>;
    pricing?: ProductPricing;
    // Variant information
    default_variant?: ProductVariant;
    variants?: ProductVariant[];
    variants_count?: number;
    total_stock?: number;
    fitment_status?: 'exact' | 'universal' | 'incompatible';
    search_match_type?: 'product' | 'variant' | null;
    search_match_system_id?: string | null;
    search_match_variant_id?: number | null;
    created_at: string;
    updated_at: string;
    // Optional loaded relationships
    inventory?: ProductInventory[];
    key_attributes?: Array<{
        name: string;
        value: string;
        unit?: string;
    }>;
    brand?: Brand;
}

// Product Variant Interface (Brand-specific variant)
export interface ProductVariant {
    id: number;
    system_id?: string;
    product_id: number;
    brand_id: number;
    sku: string;
    upc?: string;
    is_default: boolean;
    brand?: Brand;
    pricing?: ProductPricing; // Variant-level pricing (overrides product pricing)
    base_price?: number | null;
    current_sale_price?: number | null;
    fifo_sale_price_current?: number | null;
    total_stock?: number;
    created_at: string;
    updated_at: string;
    inventory?: VariantInventory[];
}

export interface VariantFifoSummary {
    product_id: number;
    variant_id: number;
    warehouse_id: number;
    stock_available: number;
    active_lot_id?: number | null;
    current_cost?: number;
    current_sale_price?: number;
    inventory_value?: number;
    fifo_cost_current: number;
    fifo_sale_price_current?: number;
    total_lot_quantity: number;
    total_lot_value: number;
    average_landed_cost: number;
    open_lots_count: number;
    last_received_at?: string | null;
    last_sold_at?: string | null;
}

export interface InventoryFifoLot {
    id: number;
    warehouse_id: number;
    warehouse?: Warehouse | null;
    source_type?: string | null;
    source_id?: number | null;
    source_movement_id?: number | null;
    batch_number?: string | null;
    received_quantity: number;
    quantity_available: number;
    unit_cost_base: number;
    tax_per_unit: number;
    tax_total?: number;
    misc_per_unit: number;
    misc_total?: number;
    landed_unit_cost: number;
    landed_total?: number;
    sale_price: number;
    remaining_value: number;
    received_at?: string | null;
}

export interface VariantFifoMovement {
    id: number;
    movement_type: 'in' | 'out' | 'transfer';
    quantity: number;
    quantity_before?: number | null;
    quantity_after?: number | null;
    reference_type?: string | null;
    reference_id?: number | null;
    reason?: string | null;
    notes?: string | null;
    supplier?: Supplier | null;
    warehouse?: Warehouse | null;
    destination_warehouse?: Warehouse | null;
    user?: { id: number; name: string } | null;
    created_at: string;
    fifo_lots?: Array<{
        lot_id: number;
        quantity: number;
        quantity_available: number;
        unit_cost_base: number;
        tax_per_unit: number;
        tax_total?: number;
        misc_per_unit: number;
        misc_total?: number;
        landed_unit_cost: number;
        landed_total?: number;
        sale_price: number;
        remaining_value: number;
        received_at?: string | null;
    }>;
    source_lots?: Array<{
        lot_id: number;
        quantity: number;
        quantity_available: number;
        unit_cost_base: number;
        tax_per_unit: number;
        tax_total?: number;
        misc_per_unit: number;
        misc_total?: number;
        landed_unit_cost: number;
        landed_total?: number;
        sale_price: number;
        remaining_value: number;
        received_at?: string | null;
    }>;
    fifo_allocations?: Array<{
        lot_id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
        source_type?: string | null;
        source_id?: number | null;
        received_at?: string | null;
    }>;
    lot_allocations?: Array<{
        lot_id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
        source_type?: string | null;
        source_id?: number | null;
        received_at?: string | null;
    }>;
}

export interface VariantFifoHistory {
    summary: VariantFifoSummary;
    lots: InventoryFifoLot[];
    purchase_movements: VariantFifoMovement[];
    sale_movements: VariantFifoMovement[];
    movement_timeline: VariantFifoMovement[];
}

export interface ProductVin {
    id: number;
    vin: string;
    description?: string;
    created_at?: string;
}

// Detailed Product (with all relationships)
export interface ProductDetail extends Product {
    // Direct properties from the default variant (for convenience)
    sku?: string;
    upc?: string;
    brand?: Brand;
    pricing?: ProductPricing;
    total_stock?: number;
    // Relationships
    attributes?: ProductAttribute[];
    suppliers?: ProductSupplier[];
    media?: ProductMedia[];
    images?: ProductImage[];
    oem_references?: OemReference[];
    alternatives?: AlternativeProduct[];
    compatibility?: VehicleCompatibility[];
    vins?: ProductVin[];
    // Inherited images from categories
    inherited_images?: Array<{
        id?: number | null;
        url: string;
        source: 'category';
        source_category_id: number;
        category_name: string;
        category_media_id?: number | null;
        display_order?: number;
    }>;
    all_images?: Array<{
        url: string;
        source: 'product' | 'media' | 'category';
        source_category_id?: number;
        category_name?: string;
        id?: number;
        display_order?: number;
    }>;
}

// API Request Types
export interface ProductVehicleCompatibilityPayload {
    engines: Array<{ engine_id: number }>;
    chassis: Array<{ chassis_id: number }>;
    all_engines: boolean;
    all_chassis: boolean;
    model_id?: number | null;
}

export interface CreateProductRequest {
    sku_base: string;
    name: string;
    description?: string;
    product_line_id?: number;
    category_id?: number | null;
    extra_category_ids?: number[];
    engine_id?: number; // R21: motor as reusable entity
    status?: 'active' | 'discontinued' | 'pending';
    batch_tracking?: boolean;
    alternate_code?: string; // alternate identifier
    pricing_formula?: string; // Excel-like pricing formula
    // Default variant fields
    brand_id?: number;
    sku: string;
    upc?: string;
    pricing: {
        base_price: number;
        msrp: number;
        cost: number;
        cost_base?: number;
        cost_miscellaneous?: number;
        tax_rate: number;
        sale_tax_rate?: number;
        cost_tax_rate?: number;
        tax_type?: 'standard' | 'exempt' | 'custom';
        max_discount_percentage?: number;
    };
    initial_inventory?: Array<{
        warehouse_id: number;
        stock_available: number;
        reorder_point?: number;
        reorder_quantity?: number;
    }>;
    attributes?: Array<{
        name: string;
        value: number | string | string[];
        unit?: string;
        source?: 'category' | 'custom';
        source_category_id?: number | null;
        type?: ProductAttributeType;
        options?: string[] | null;
    }>;
    vins?: string[];
    vehicle_compatibility?: ProductVehicleCompatibilityPayload;
}

export interface UpdateProductRequest {
    sku_base?: string;
    upc?: string;
    alternate_code?: string; // alternate identifier
    pricing_formula?: string; // Excel-like pricing formula
    product_line_id?: number;
    category_id?: number | null;
    extra_category_ids?: number[];
    engine_id?: number; // R21: motor as reusable entity
    name?: string;
    description?: string;
    status?: 'active' | 'discontinued' | 'pending';
    batch_tracking?: boolean;
    is_universal?: boolean;
    pricing?: {
        base_price?: number;
        msrp?: number;
        cost?: number;
        cost_base?: number;
        cost_miscellaneous?: number;
        tax_rate?: number;
        sale_tax_rate?: number;
        cost_tax_rate?: number;
        tax_type?: 'standard' | 'exempt' | 'custom';
        max_discount_percentage?: number;
    };
    attributes?: Array<{
        name: string;
        value: number | string | string[];
        unit?: string;
        source?: 'category' | 'custom';
        source_category_id?: number | null;
        type?: ProductAttributeType;
        options?: string[] | null;
    }>;
    oem_references?: Array<{
        oem_code: string;
        manufacturer?: string | null;
    }>;
    alternatives?: Array<{
        id?: number;
        alternative_product_id?: number;
        relationship_type?: 'compatible' | 'substitute' | 'upgrade';
    }>;
    vehicle_compatibility?: ProductVehicleCompatibilityPayload;
}

export interface ProductFilters {
    status?: 'active' | 'discontinued' | 'pending';
    brand_id?: number | number[];
    category_id?: number | number[];
    product_line_id?: number;
    search?: string;
    has_stock?: boolean;
    vehicle_engine_id?: number;
    strict_fitment?: boolean;
    warehouse_id?: number;
    per_page?: number;
    page?: number;
    // Deep linking filters
    oem_code?: string;
    attribute_value?: string;
    vin?: string;
    // Sidebar advanced filters
    sku?: string;
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort?: string;
    // Archive filter
    archived?: 'true' | 'false' | 'all';
    // Sorting
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
}

export interface ProductProfileFilters {
    warehouse_id: number;
    variant_id?: number;
    per_page?: number;
    date_from?: string;
    date_to?: string;
}

export interface ProductOperationalProfile {
    product: {
        id: number;
        system_id?: string | null;
        sku_base: string;
        name: string;
        status: string;
        category?: { id: number; name: string } | null;
        product_line?: { id: number; name: string } | null;
        pricing?: {
            configuration?: ProductOperationalPricingConfiguration | null;
        };
    };
    warehouse_id: number;
    variants: ProductVariantOperationalProfile[];
    customers: ProductOperationalCustomer[];
    suppliers: ProductOperationalSupplier[];
    compatibility: VehicleCompatibility[];
}

export interface ProductVariantOperationalProfile {
    id: number;
    system_id?: string | null;
    sku?: string | null;
    upc?: string | null;
    status: string;
    is_default: boolean;
    brand?: { id: number; name: string } | null;
    pricing: {
        configuration?: ProductOperationalPricingConfiguration | null;
        current: ProductOperationalCurrentPricing;
        price_family?: {
            visible_price_source: 'active_lot' | 'configuration_fallback';
            surfaces: string[];
        };
    };
    inventory: {
        summary: ProductOperationalInventorySummary;
        warehouses: ProductOperationalWarehouseInventory[];
    };
    lots: ProductOperationalLot[];
    movements: ProductOperationalMovementSection;
    sales: ProductOperationalSalesSection;
    quotes: ProductOperationalQuotesSection;
    purchases: ProductOperationalPurchasesSection;
    suppliers: ProductOperationalSupplier[];
}

export interface ProductOperationalPricingConfiguration {
    base_price: number;
    calculated_price: number;
    cost: number;
    cost_base: number;
    cost_miscellaneous: number;
    cost_total: number;
    sale_tax_rate: number;
    cost_tax_rate: number;
    tax_type?: string;
    pricing_formula?: string | null;
}

export interface ProductOperationalCurrentPricing {
    warehouse_id: number;
    active_lot_id?: number | null;
    current_cost: number;
    current_sale_price: number;
    inventory_value: number;
    fifo_cost_current: number;
    fifo_sale_price_current: number;
}

export interface ProductOperationalInventorySummary {
    warehouse_id: number;
    stock_available: number;
    stock_reserved: number;
    active_lot_id?: number | null;
    current_cost: number;
    current_sale_price: number;
    fifo_cost_current: number;
    fifo_sale_price_current: number;
    inventory_value: number;
}

export interface ProductOperationalWarehouseInventory {
    warehouse?: { id: number; name: string; code?: string | null } | null;
    quantity_available: number;
    quantity_reserved: number;
    reorder_point: number;
    reorder_quantity: number;
    location_in_warehouse?: string | null;
    last_restocked_at?: string | null;
}

export interface ProductOperationalLot {
    id: number;
    warehouse_id: number;
    warehouse?: { id: number; name: string; code?: string | null } | null;
    source_type?: string | null;
    source_id?: number | null;
    batch_number?: string | null;
    received_quantity: number;
    quantity_available: number;
    unit_cost_base: number;
    tax_per_unit: number;
    misc_per_unit: number;
    landed_unit_cost: number;
    sale_price: number;
    remaining_value: number;
    received_at?: string | null;
}

export interface ProductOperationalMovementSection {
    summary: {
        total_movements: number;
        inbound_movements: number;
        outbound_movements: number;
        transfer_movements: number;
    };
    recent: ProductOperationalMovement[];
}

export interface ProductOperationalMovement {
    id: number;
    movement_type: string;
    reason?: string | null;
    quantity: number;
    reference_type?: string | null;
    reference_id?: number | null;
    warehouse?: { id: number; name: string; code?: string | null } | null;
    destination_warehouse?: {
        id: number;
        name: string;
        code?: string | null;
    } | null;
    created_at?: string | null;
}

export interface ProductOperationalSalesSection {
    summary: {
        orders_count: number;
        units_sold: number;
        total_revenue: number;
        customers_count: number;
    };
    recent: ProductOperationalSale[];
}

export interface ProductOperationalSale {
    id?: number | null;
    order_number?: string | null;
    date?: string | null;
    status?: string | null;
    customer?: { id: number; code?: string | null; name: string } | null;
    quantity: number;
    unit_price: number;
    unit_cost?: number;
    total: number;
}

export interface ProductOperationalQuotesSection {
    summary: {
        quotes_count: number;
        units_quoted: number;
        total_quoted: number;
        customers_count: number;
    };
    recent: ProductOperationalQuote[];
}

export interface ProductOperationalQuote {
    id?: number | null;
    quote_number?: string | null;
    date?: string | null;
    status?: string | null;
    customer?: { id: number; code?: string | null; name: string } | null;
    quantity: number;
    unit_price: number;
    total: number;
}

export interface ProductOperationalPurchasesSection {
    summary: {
        orders_count: number;
        units_ordered: number;
        units_received: number;
        total_ordered: number;
    };
    recent: ProductOperationalPurchase[];
}

export interface ProductOperationalPurchase {
    id?: number | null;
    po_number?: string | null;
    supplier_invoice_number?: string | null;
    order_date?: string | null;
    received_date?: string | null;
    status?: string | null;
    payment_status?: string | null;
    supplier?: { id: number; name: string } | null;
    quantity_ordered: number;
    units_per_package: number;
    total_units_ordered: number;
    total_units_received: number;
    unit_cost: number;
    total: number;
}

export interface ProductOperationalCustomer {
    id: number;
    code?: string | null;
    name: string;
    email?: string | null;
    orders_count: number;
    units_purchased: number;
    total_spent: number;
    last_purchased_at?: string | null;
}

export interface ProductOperationalSupplier {
    id: number;
    name: string;
    variant_id?: number | null;
    variant_sku?: string | null;
    brand_name?: string | null;
    supplier_cost: number;
    lead_time_days?: number | null;
    minimum_order_quantity?: number | null;
    is_preferred: boolean;
    source?: 'configured' | 'purchase_order';
}
// API Response Types
export interface PaginatedResponse<T> {
    data: T[];
    links: {
        first: string;
        last: string;
        prev: string | null;
        next: string | null;
    };
    meta: {
        current_page: number;
        from: number;
        last_page: number;
        path: string;
        per_page: number;
        to: number;
        total: number;
    };
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
}
