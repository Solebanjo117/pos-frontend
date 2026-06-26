import type {
    Supplier,
    SupplierFilters,
    CreateSupplierData,
    UpdateSupplierData,
    SupplierProduct,
    SupplierVariantPayload,
    SupplierPurchaseHistoryFilters,
    SupplierPurchaseHistory,
    SupplierCommercialDashboard,
    SupplierCommercialDashboardFilters,
} from '@/types/supplier';
import apiClient from './api/client';

const BASE_URL = '/suppliers';

export const suppliersService = {
    /**
     * Get all suppliers with filters
     */
    async getAll(filters?: SupplierFilters) {
        const { data } = await apiClient.get(BASE_URL, { params: filters });
        return data;
    },

    /**
     * Get all active suppliers (for dropdowns)
     */
    async getAllActive() {
        const { data } = await apiClient.get(`${BASE_URL}/all`);
        return data.data;
    },

    /**
     * Get single supplier by ID
     */
    async getById(id: number) {
        const { data } = await apiClient.get(`${BASE_URL}/${id}`);
        return data;
    },

    /**
     * Create new supplier
     */
    async create(supplierData: CreateSupplierData): Promise<Supplier> {
        const { data } = await apiClient.post(BASE_URL, supplierData);
        return data.data;
    },

    /**
     * Update existing supplier
     */
    async update(
        id: number,
        supplierData: UpdateSupplierData,
    ): Promise<Supplier> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, supplierData);
        return data.data;
    },

    /**
     * Delete supplier
     */
    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`);
    },

    /**
     * Get supplier's purchase orders
     */
    async getPurchaseOrders(id: number) {
        const { data } = await apiClient.get(
            `${BASE_URL}/${id}/purchase-orders`,
        );
        return data;
    },

    async getPurchaseHistory(
        id: number,
        filters?: SupplierPurchaseHistoryFilters,
    ): Promise<SupplierPurchaseHistory> {
        const { data } = await apiClient.get(
            `${BASE_URL}/${id}/purchase-history`,
            { params: filters },
        );
        return data;
    },

    async getCommercialDashboard(
        filters?: SupplierCommercialDashboardFilters,
    ): Promise<SupplierCommercialDashboard> {
        const { data } = await apiClient.get(
            `${BASE_URL}/commercial-dashboard`,
            {
                params: filters,
            },
        );
        return data.data;
    },

    /**
     * Get brands associated with a supplier
     */
    async getBrands(id: number) {
        const { data } = await apiClient.get(`${BASE_URL}/${id}/brands`);
        return data.data;
    },

    async getVariants(
        id: number,
        filters?: { search?: string; page?: number; per_page?: number },
    ) {
        const { data } = await apiClient.get(`${BASE_URL}/${id}/variants`, {
            params: filters,
        });
        return data;
    },

    async attachVariant(id: number, payload: SupplierVariantPayload) {
        const { data } = await apiClient.post(
            `${BASE_URL}/${id}/variants`,
            payload,
        );
        return data.data;
    },

    async updateVariant(
        id: number,
        variantId: number,
        payload: Omit<SupplierVariantPayload, 'variant_id'>,
    ) {
        const { data } = await apiClient.put(
            `${BASE_URL}/${id}/variants/${variantId}`,
            payload,
        );
        return data.data;
    },

    async detachVariant(id: number, variantId: number) {
        const { data } = await apiClient.delete(
            `${BASE_URL}/${id}/variants/${variantId}`,
        );
        return data.data;
    },

    /**
     * Attach a brand to a supplier
     */
    async attachBrand(id: number, brandId: number) {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/brands`, {
            brand_id: brandId,
        });
        return data.data;
    },

    /**
     * Detach a brand from a supplier
     */
    async detachBrand(id: number, brandId: number) {
        const { data } = await apiClient.delete(
            `${BASE_URL}/${id}/brands/${brandId}`,
        );
        return data.data;
    },
};
