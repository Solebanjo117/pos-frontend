import type {
    Product,
    ProductDetail,
    CreateProductRequest,
    UpdateProductRequest,
    ProductFilters,
    ProductOperationalProfile,
    ProductProfileFilters,
    VariantFifoHistory,
    PaginatedResponse,
    ApiResponse,
} from '@/types/product';
import apiClient from './client';

export const productsApi = {
    /**
     * Get paginated list of products
     */
    async getProducts(
        filters?: ProductFilters,
    ): Promise<PaginatedResponse<Product>> {
        const response = await apiClient.get<PaginatedResponse<Product>>(
            '/products',
            { params: filters },
        );
        return response.data;
    },

    /**
     * Get single product with optional includes
     */
    async getProduct(
        id: number,
        paramsOrIncludes?: string[] | any,
    ): Promise<ApiResponse<ProductDetail>> {
        let params: any = {};

        if (Array.isArray(paramsOrIncludes)) {
            if (paramsOrIncludes.length) {
                params.include = paramsOrIncludes.join(',');
            }
        } else if (typeof paramsOrIncludes === 'object') {
            params = paramsOrIncludes;
        }

        const response = await apiClient.get<ApiResponse<ProductDetail>>(
            `/products/${id}`,
            { params },
        );
        return response.data;
    },

    async getProductProfile(
        id: number,
        filters: ProductProfileFilters,
    ): Promise<ApiResponse<ProductOperationalProfile>> {
        const response = await apiClient.get<
            ApiResponse<ProductOperationalProfile>
        >(`/products/${id}/profile`, { params: filters });
        return response.data;
    },
    /**
     * Create new product
     */
    async createProduct(
        data: CreateProductRequest,
    ): Promise<ApiResponse<Product>> {
        const response = await apiClient.post<ApiResponse<Product>>(
            '/products',
            data,
        );
        return response.data;
    },

    /**
     * Duplicate an existing product
     */
    async duplicateProduct(id: number): Promise<ApiResponse<Product>> {
        const response = await apiClient.post<ApiResponse<Product>>(
            `/products/${id}/duplicate`,
        );
        return response.data;
    },

    /**
     * Update existing product
     */
    async updateProduct(
        id: number,
        data: UpdateProductRequest,
    ): Promise<ApiResponse<Product>> {
        const response = await apiClient.put<ApiResponse<Product>>(
            `/products/${id}`,
            data,
        );
        return response.data;
    },

    /**
     * Regenerate auto-generated product name from category + vehicle compatibility
     */
    async regenerateName(
        id: number,
        data?: Pick<
            UpdateProductRequest,
            'category_id' | 'extra_category_ids' | 'vehicle_compatibility'
        >,
    ): Promise<ApiResponse<Product>> {
        const response = await apiClient.post<ApiResponse<Product>>(
            `/products/${id}/regenerate-name`,
            data ?? {},
        );
        return response.data;
    },

    /**
     * Preview generated product name without persisting changes
     */
    async previewName(
        id: number,
        data: Pick<
            UpdateProductRequest,
            'category_id' | 'extra_category_ids' | 'vehicle_compatibility'
        >,
    ): Promise<ApiResponse<{ name: string }>> {
        const response = await apiClient.post<ApiResponse<{ name: string }>>(
            `/products/${id}/preview-name`,
            data,
        );
        return response.data;
    },

    /**
     * Delete product (soft delete / archive)
     */
    async deleteProduct(id: number): Promise<ApiResponse<void>> {
        const response = await apiClient.delete<ApiResponse<void>>(
            `/products/${id}`,
        );
        return response.data;
    },

    /**
     * Restore a soft-deleted (archived) product
     */
    async restoreProduct(id: number): Promise<ApiResponse<any>> {
        const response = await apiClient.post<ApiResponse<any>>(
            `/products/${id}/restore`,
        );
        return response.data;
    },

    /**
     * Assign attributes to product
     */
    async assignAttributes(
        id: number,
        attributes: Array<{
            attribute_definition_id: number;
            numeric_value?: number;
            text_value?: string;
        }>,
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.post<ApiResponse<any>>(
            `/products/${id}/attributes`,
            { attributes },
        );
        return response.data;
    },

    /**
     * Delete attribute from product
     */
    async deleteAttribute(
        productId: number,
        attributeDefinitionId: number,
    ): Promise<ApiResponse<void>> {
        const response = await apiClient.delete<ApiResponse<void>>(
            `/products/${productId}/attributes/${attributeDefinitionId}`,
        );
        return response.data;
    },

    /**
     * Assign supplier to product
     */
    async assignSupplier(
        id: number,
        data: {
            supplier_id: number;
            supplier_cost: number;
            lead_time_days?: number;
            minimum_order_quantity?: number;
            is_preferred?: boolean;
        },
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.post<ApiResponse<any>>(
            `/products/${id}/suppliers`,
            data,
        );
        return response.data;
    },

    /**
     * Remove supplier from product
     */
    async removeSupplier(
        productId: number,
        supplierId: number,
    ): Promise<ApiResponse<void>> {
        const response = await apiClient.delete<ApiResponse<void>>(
            `/products/${productId}/suppliers/${supplierId}`,
        );
        return response.data;
    },

    /**
     * Add vehicle compatibility
     */
    async addCompatibility(
        id: number,
        data: {
            engine_id: number;
            notes?: string;
        },
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.post<ApiResponse<any>>(
            `/products/${id}/compatibility`,
            data,
        );
        return response.data;
    },

    /**
     * Remove vehicle compatibility
     */
    async removeCompatibility(
        productId: number,
        engineId: number,
    ): Promise<ApiResponse<void>> {
        const response = await apiClient.delete<ApiResponse<void>>(
            `/products/${productId}/compatibility/${engineId}`,
        );
        return response.data;
    },

    /**
     * Add OEM reference
     */
    async addOemReference(
        id: number,
        data: {
            oem_code: string;
            manufacturer?: string;
        },
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.post<ApiResponse<any>>(
            `/products/${id}/oem-references`,
            data,
        );
        return response.data;
    },

    /**
     * Remove OEM reference
     */
    async removeOemReference(
        productId: number,
        referenceId: number,
    ): Promise<ApiResponse<void>> {
        const response = await apiClient.delete<ApiResponse<void>>(
            `/products/${productId}/oem-references/${referenceId}`,
        );
        return response.data;
    },

    /**
     * Add alternative product
     */
    async addAlternative(
        id: number,
        data: {
            alternative_product_id: number;
            relationship_type: 'compatible' | 'substitute' | 'upgrade';
        },
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.post<ApiResponse<any>>(
            `/products/${id}/alternatives`,
            data,
        );
        return response.data;
    },

    /**
     * Remove alternative product
     */
    async removeAlternative(
        productId: number,
        alternativeId: number,
    ): Promise<ApiResponse<void>> {
        const response = await apiClient.delete<ApiResponse<void>>(
            `/products/${productId}/alternatives/${alternativeId}`,
        );
        return response.data;
    },

    /**
     * Get batches for a product
     */
    async getBatches(
        productId: number,
        warehouseId?: number,
    ): Promise<ApiResponse<any[]>> {
        const params: any = {};
        if (warehouseId) {
            params.warehouse_id = warehouseId;
        }

        const response = await apiClient.get<ApiResponse<any[]>>(
            `/products/${productId}/batches`,
            { params },
        );
        return response.data;
    },

    /**
     * Get variants for a product
     */
    async getVariants(productId: number): Promise<ApiResponse<any[]>> {
        const response = await apiClient.get<ApiResponse<any[]>>(
            `/products/${productId}/variants`,
        );
        return response.data;
    },

    /**
     * Create variant for a product
     */
    async createVariant(
        productId: number,
        data: any,
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.post<ApiResponse<any>>(
            `/products/${productId}/variants`,
            data,
        );
        return response.data;
    },

    /**
     * Update variant
     */
    async updateVariant(
        productId: number,
        variantId: number,
        data: any,
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.put<ApiResponse<any>>(
            `/products/${productId}/variants/${variantId}`,
            data,
        );
        return response.data;
    },

    /**
     * Delete variant
     */
    async deleteVariant(
        productId: number,
        variantId: number,
    ): Promise<ApiResponse<void>> {
        const response = await apiClient.delete<ApiResponse<void>>(
            `/products/${productId}/variants/${variantId}`,
        );
        return response.data;
    },

    /**
     * Get stock history for a product variant in a warehouse
     */
    async getVariantFifoHistory(
        productId: number,
        variantId: number,
        filters: {
            warehouse_id: number;
            date_from?: string;
            date_to?: string;
            per_page?: number;
        },
    ): Promise<ApiResponse<VariantFifoHistory>> {
        const response = await apiClient.get<ApiResponse<VariantFifoHistory>>(
            `/products/${productId}/variants/${variantId}/inventory-history`,
            { params: filters },
        );
        return response.data;
    },

    async updateInventoryLot(
        lotId: number,
        data: {
            received_at: string;
            quantity_available: number;
            unit_cost_base: number;
            tax_per_unit: number;
            misc_per_unit: number;
            sale_price: number;
        },
    ): Promise<ApiResponse<any>> {
        const response = await apiClient.patch<ApiResponse<any>>(
            `/inventory/lots/${lotId}`,
            data,
        );
        return response.data;
    },
};
