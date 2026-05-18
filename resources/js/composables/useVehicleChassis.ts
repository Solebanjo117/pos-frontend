import { ref } from 'vue';
import apiClient from '@/services/api/client';

export interface VehicleChassis {
    id: number;
    model_id: number | null; // Chassis can be independent (no model)
    model_ids?: number[];
    code: string;
    name?: string;
    year_from?: string;
    year_to?: string;
    notes?: string;
    model?: {
        id: number;
        name: string;
        year_from?: number;
        year_to?: number;
        make?: {
            id: number;
            name: string;
        };
    };
    models?: Array<{
        id: number;
        name: string;
        year_from?: number;
        year_to?: number;
        make?: {
            id: number;
            name: string;
        };
    }>;
}

export function useVehicleChassis() {
    const chassisList = ref<VehicleChassis[]>([]);
    const chassis = ref<VehicleChassis | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Fetch all chassis (with optional search and vehicle filters)
    const fetchChassis = async (
        params: {
            page?: number;
            search?: string;
            per_page?: number;
            model_id?: number;
            make_id?: number;
        } = {},
    ) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.get('/vehicle-chassis', {
                params,
            });
            chassisList.value = response.data.data;
            return response.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching vehicle chassis';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Fetch a single chassis by ID
    const fetchChassisItem = async (id: number) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.get(`/vehicle-chassis/${id}`);
            chassis.value = response.data.data;
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching vehicle chassis';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Create a new chassis (model_id is optional)
    const createChassis = async (data: {
        model_id?: number | null;
        model_ids?: number[];
        code: string;
        name?: string;
        year_from?: string;
        year_to?: string;
        notes?: string;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.post('/vehicle-chassis', data);
            chassisList.value.push(response.data.data);
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error creating vehicle chassis';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Update an existing chassis
    const updateChassis = async (
        id: number,
        data: {
            model_id?: number | null;
            model_ids?: number[];
            code?: string;
            name?: string;
            year_from?: string;
            year_to?: string;
            notes?: string;
        },
    ) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.put(
                `/vehicle-chassis/${id}`,
                data,
            );
            const index = chassisList.value.findIndex((c) => c.id === id);
            if (index !== -1) {
                chassisList.value[index] = response.data.data;
            }
            chassis.value = response.data.data;
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error updating vehicle chassis';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Delete a chassis
    const deleteChassis = async (id: number) => {
        loading.value = true;
        error.value = null;
        try {
            await apiClient.delete(`/vehicle-chassis/${id}`);
            chassisList.value = chassisList.value.filter((c) => c.id !== id);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error deleting vehicle chassis';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    return {
        chassisList,
        chassis,
        loading,
        error,
        fetchChassis,
        fetchChassisItem,
        createChassis,
        updateChassis,
        deleteChassis,
    };
}
