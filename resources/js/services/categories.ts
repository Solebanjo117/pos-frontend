import apiClient from './api/client'
import type {
    Category,
    CategoryFilters,
    CreateCategoryData,
    UpdateCategoryData,
} from '@/types/category'

const BASE_URL = '/categories'

export const categoriesService = {
    /**
     * Get all categories with filters
     */
    async getAll(filters?: CategoryFilters) {
        const { data } = await apiClient.get(BASE_URL, { params: filters })
        return data
    },

    /**
     * Get all categories as tree structure
     */
    async getTree() {
        const { data } = await apiClient.get(BASE_URL, { params: { tree: true } })
        return data
    },

    /**
     * Get all categories with parent info
     */
    async getAllWithParent() {
        const { data } = await apiClient.get(BASE_URL, { params: { with_parent: true } })
        return data
    },

    /**
     * Get single category by ID
     */
    async getById(id: number) {
        const { data } = await apiClient.get(`${BASE_URL}/${id}`)
        return data
    },

    /**
     * Create new category
     */
    async create(categoryData: CreateCategoryData): Promise<Category> {
        const { data } = await apiClient.post(BASE_URL, categoryData)
        return data
    },

    /**
     * Update existing category
     */
    async update(id: number, categoryData: UpdateCategoryData): Promise<Category> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, categoryData)
        return data
    },

    /**
     * Delete category
     */
    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`)
    },
}
