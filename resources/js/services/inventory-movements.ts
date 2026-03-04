import { AxiosResponse } from 'axios'
import apiClient from './api/client'
import type {
    InventoryMovement,
    InventoryMovementFilters,
    CreateInboundMovementRequest,
    CreateOutboundMovementRequest,
    CreateTransferMovementRequest,
    PaginatedMovementsResponse,
} from '@/types/inventory-movement'

class InventoryMovementsApiService {
    /**
     * Get paginated list of movements
     */
    async getMovements(filters: InventoryMovementFilters = {}, page = 1, perPage = 20): Promise<PaginatedMovementsResponse> {
        const response: AxiosResponse<PaginatedMovementsResponse> = await apiClient.get('/inventory-movements', {
            params: {
                ...filters,
                page,
                per_page: perPage,
            },
        })
        return response.data
    }

    /**
     * Get movement by ID
     */
    async getMovementById(id: number): Promise<InventoryMovement> {
        const response: AxiosResponse<{ data: InventoryMovement }> = await apiClient.get(`/inventory-movements/${id}`)
        return response.data.data
    }

    /**
     * Record inbound movement
     */
    async recordInbound(data: CreateInboundMovementRequest): Promise<InventoryMovement> {
        const response: AxiosResponse<{ data: InventoryMovement; message: string }> = await apiClient.post(
            '/inventory-movements/inbound',
            data
        )
        return response.data.data
    }

    /**
     * Record bulk inbound movement
     */
    async recordBulkInbound(data: { items: CreateInboundMovementRequest[] }): Promise<InventoryMovement[]> {
        const response: AxiosResponse<{ data: InventoryMovement[]; message: string }> = await apiClient.post(
            '/inventory-movements/inbound/bulk',
            data
        )
        return response.data.data
    }

    /**
     * Record outbound movement
     */
    async recordOutbound(data: CreateOutboundMovementRequest): Promise<InventoryMovement> {
        const response: AxiosResponse<{ data: InventoryMovement; message: string }> = await apiClient.post(
            '/inventory-movements/outbound',
            data
        )
        return response.data.data
    }

    /**
     * Record bulk outbound movement
     */
    async recordBulkOutbound(data: { items: CreateOutboundMovementRequest[] }): Promise<InventoryMovement[]> {
        const response: AxiosResponse<{ data: InventoryMovement[]; message: string }> = await apiClient.post(
            '/inventory-movements/outbound/bulk',
            data
        )
        return response.data.data
    }

    /**
     * Record transfer movement
     */
    async recordTransfer(data: CreateTransferMovementRequest): Promise<InventoryMovement> {
        const response: AxiosResponse<{ data: InventoryMovement; message: string }> = await apiClient.post(
            '/inventory-movements/transfer',
            data
        )
        return response.data.data
    }

    /**
     * Get movements by product
     */
    async getMovementsByProduct(productId: number, filters: InventoryMovementFilters = {}, page = 1, perPage = 20): Promise<PaginatedMovementsResponse> {
        const response: AxiosResponse<PaginatedMovementsResponse> = await apiClient.get(`/inventory-movements/product/${productId}`, {
            params: {
                ...filters,
                page,
                per_page: perPage,
            },
        })
        return response.data
    }

    /**
     * Get movements by warehouse
     */
    async getMovementsByWarehouse(warehouseId: number, filters: InventoryMovementFilters = {}, page = 1, perPage = 20): Promise<PaginatedMovementsResponse> {
        const response: AxiosResponse<PaginatedMovementsResponse> = await apiClient.get(`/inventory-movements/warehouse/${warehouseId}`, {
            params: {
                ...filters,
                page,
                per_page: perPage,
            },
        })
        return response.data
    }

    /**
     * Get related movements
     */
    async getRelatedMovements(id: number): Promise<InventoryMovement[]> {
        const response: AxiosResponse<{ data: InventoryMovement[] }> = await apiClient.get(`/inventory-movements/${id}/related`)
        return response.data.data
    }
}

export default new InventoryMovementsApiService()
