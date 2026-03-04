import type { Product } from './product'

// Category Type
export interface Category {
    id: number
    name: string
    slug: string
    parent_id?: number | null
    description?: string
    icon?: string
    priority: number
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
    priority?: number
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> { }
