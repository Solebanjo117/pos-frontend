import { AxiosResponse } from 'axios';
import apiClient from './api/client';
import type {
    Warehouse,
    WarehouseFilters,
    WarehouseInventoryFilters,
    CreateWarehouseRequest,
    UpdateWarehouseRequest,
    PaginatedWarehousesResponse,
} from '@/types/warehouse';

class WarehousesApiService {
    /**
     * Get paginated list of warehouses
     */
    async getWarehouses(
        filters: WarehouseFilters = {},
        page = 1,
        perPage = 20,
    ): Promise<PaginatedWarehousesResponse> {
        const response: AxiosResponse<PaginatedWarehousesResponse> =
            await apiClient.get('/warehouses', {
                params: {
                    ...filters,
                    page,
                    per_page: perPage,
                },
            });
        return response.data;
    }

    /**
     * Get warehouse by ID with statistics
     */
    async getWarehouseById(id: number): Promise<Warehouse> {
        const response: AxiosResponse<{ data: Warehouse }> =
            await apiClient.get(`/warehouses/${id}`);
        return response.data.data;
    }

    /**
     * Create new warehouse
     */
    async createWarehouse(data: CreateWarehouseRequest): Promise<Warehouse> {
        const response: AxiosResponse<{ data: Warehouse; message: string }> =
            await apiClient.post('/warehouses', data);
        return response.data.data;
    }

    /**
     * Update warehouse
     */
    async updateWarehouse(
        id: number,
        data: UpdateWarehouseRequest,
    ): Promise<Warehouse> {
        const response: AxiosResponse<{ data: Warehouse; message: string }> =
            await apiClient.put(`/warehouses/${id}`, data);
        return response.data.data;
    }

    /**
     * Delete warehouse
     */
    async deleteWarehouse(id: number): Promise<void> {
        await apiClient.delete(`/warehouses/${id}`);
    }

    /**
     * Get warehouse inventory
     */
    async getWarehouseInventory(
        id: number,
        filters: WarehouseInventoryFilters = {},
        page = 1,
        perPage = 20,
    ): Promise<any> {
        const response = await apiClient.get(`/warehouses/${id}/inventory`, {
            params: {
                ...filters,
                page,
                per_page: perPage,
            },
        });
        return response.data;
    }

    /**
     * Get all warehouses for dropdown
     */
    async getAllWarehouses(): Promise<Warehouse[]> {
        const response: AxiosResponse<{ data: Warehouse[] }> =
            await apiClient.get('/warehouses/all');
        return response.data.data;
    }
}

export default new WarehousesApiService();
