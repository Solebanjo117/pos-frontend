import type { BrandTier } from '@/utils/brandTier';
import type { Supplier } from './supplier';

export interface BrandSupplierLink {
    id: number;
    name: string;
    manual: boolean;
    pieces: number;
    origin: 'pieces' | 'manual';
}

export interface Brand {
    id: number;
    name: string;
    description?: string;
    tier?: BrandTier;
    logo_url?: string;
    website?: string;
    status?: string;
    product_variants_count?: number;
    suppliers_count?: number;
    suppliers?: Pick<Supplier, 'id' | 'name' | 'contact_name' | 'phone'>[];
    /** Proveedores por sus piezas (calculado) y marcados a mano, en una sola lista. */
    supplier_links?: BrandSupplierLink[];
    created_at?: string;
    updated_at?: string;
}

export interface BrandFilters {
    search?: string;
    sort_by?: string;
    sort_direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface CreateBrandData {
    name: string;
    description?: string;
    tier: BrandTier;
    supplier_ids?: number[];
}

export interface UpdateBrandData extends Partial<CreateBrandData> {}
