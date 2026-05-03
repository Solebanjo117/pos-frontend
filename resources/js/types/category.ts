import type { Product } from './product'

export type CategoryAttributeType = 'string' | 'select'

export interface CategoryDefaultAttribute {
    name: string
    value?: string
    default_value?: string
    required?: boolean
    unit?: string
    type?: CategoryAttributeType
    options?: string[] | null
}

// Category Type
export interface Category {
    id: number
    name: string
    slug: string
    parent_id?: number | null
    description?: string
    icon?: string
    image_url?: string | null
    priority: number
    default_attributes?: CategoryDefaultAttribute[]
    default_margin_percent?: number | null
    pricing_formula?: string | null
    min_suggested_price?: number | null
    applies_itbm?: boolean
    itbm_percent?: number | null
    products_count?: number
    children_count?: number
    created_at: string
    updated_at: string
    // Loaded relationships
    parent?: Category
    children?: Category[]
    products?: Product[]
}

export interface CategoryFilters {
    search?: string
    parent_id?: number | null
    tree?: boolean
    with_parent?: boolean
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
    per_page?: number
    page?: number
}

export interface CreateCategoryData {
    name: string
    parent_id?: number | null
    description?: string
    icon?: string
    image_url?: string | null
    priority?: number
    default_attributes?: CategoryDefaultAttribute[]
    default_margin_percent?: number | null
    pricing_formula?: string | null
    min_suggested_price?: number | null
    applies_itbm?: boolean
    itbm_percent?: number | null
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> { }
