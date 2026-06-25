import type {
    Brand,
    BrandFilters,
    CreateBrandData,
    UpdateBrandData,
} from '@/types/brand';
import apiClient from './api/client';

const BASE_URL = '/brands';

export const brandsService = {
    /**
     * Get all brands with filters
     */
    async getAll(filters?: BrandFilters) {
        const { data } = await apiClient.get(BASE_URL, { params: filters });
        return data;
    },

    /**
     * Get all brands (for dropdowns)
     */
    async getAllActive() {
        const { data } = await apiClient.get(`${BASE_URL}/all`);
        return data.data;
    },

    /**
     * Get single brand by ID
     */
    async getById(id: number) {
        const { data } = await apiClient.get(`${BASE_URL}/${id}`);
        return data;
    },

    /**
     * Create new brand
     */
    async create(brandData: CreateBrandData): Promise<Brand> {
        const { data } = await apiClient.post(BASE_URL, brandData);
        return data.data;
    },

    /**
     * Update existing brand
     */
    async update(id: number, brandData: UpdateBrandData): Promise<Brand> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, brandData);
        return data.data;
    },

    /**
     * Delete brand
     */
    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`);
    },
};
