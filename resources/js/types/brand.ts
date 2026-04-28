import type { Supplier } from './supplier'

export interface Brand {
    id: number
    name: string
    description?: string
    logo_url?: string
    website?: string
    status?: string
    product_variants_count?: number
    suppliers_count?: number
    suppliers?: Pick<Supplier, 'id' | 'name' | 'contact_name' | 'phone'>[]
    created_at?: string
    updated_at?: string
}

export interface BrandFilters {
    search?: string
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
    per_page?: number
    page?: number
}

export interface CreateBrandData {
    name: string
    description?: string
    logo_url?: string
    website?: string
    supplier_ids?: number[]
}

export interface UpdateBrandData extends Partial<CreateBrandData> { }
