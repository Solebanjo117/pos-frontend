import apiClient from './client';

export interface PosSettings {
    single_warehouse_mode: boolean;
    default_warehouse_id: number | null;
    client_mode?: boolean;
    default_warehouse: {
        id: number;
        name: string;
        code: string;
    } | null;
}

export const posService = {
    async getSettings(): Promise<PosSettings> {
        const response = await apiClient.get('/pos/settings');
        return response.data;
    },

    async setWarehouseContext(warehouseId: number): Promise<void> {
        await apiClient.post('/user/warehouse-context', {
            warehouse_id: warehouseId,
        });
    },

    async getWarehouseContext(): Promise<{
        current_warehouse_id: number | null;
        allowed_warehouses?: Array<{ id: number; name: string }>;
    }> {
        const response = await apiClient.get('/user/warehouse-context');
        return response.data;
    },
};
