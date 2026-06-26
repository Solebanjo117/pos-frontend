import type {
    InventoryItem,
    Warehouse,
    InventoryFilters,
    UpdateInventoryRequest,
    InventoryPaginatedResponse,
} from '@/types/inventory';
import apiClient from './api/client';

const BASE_PATH = '/inventory';

/**
 * Inventory API Service
 */
export const InventoryApiService = {
    /**
     * Get inventory list with filters
     */
    async getInventory(
        filters?: InventoryFilters,
    ): Promise<InventoryPaginatedResponse> {
        const response = await apiClient.get<InventoryPaginatedResponse>(
            BASE_PATH,
            {
                params: filters,
            },
        );
        return response.data;
    },

    /**
     * Update inventory for a specific product and warehouse
     */
    async updateInventory(
        productId: number,
        warehouseId: number,
        data: UpdateInventoryRequest,
    ): Promise<{ data: InventoryItem; message: string }> {
        const response = await apiClient.put<{
            data: InventoryItem;
            message: string;
        }>(
            `${BASE_PATH}/products/${productId}/warehouses/${warehouseId}`,
            data,
        );
        return response.data;
    },

    /**
     * Get all active warehouses
     */
    async getWarehouses(): Promise<Warehouse[]> {
        const response = await apiClient.get<{ data: Warehouse[] }>(
            '/warehouses',
        );
        return response.data.data;
    },
};
