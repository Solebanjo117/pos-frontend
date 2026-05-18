import { ref } from 'vue';
import apiClient from '@/services/api/client';

export interface VehicleModel {
    id: number;
    make_id: number;
    name: string;
    year_from?: number;
    year_to?: number;
    generation?: string;
    make?: {
        id: number;
        name: string;
    };
    chassis?: Array<{
        id: number;
        code: string;
        name?: string;
        year_from?: string;
        year_to?: string;
    }>;
    engines_count?: number;
}

export function useVehicleModels() {
    const models = ref<VehicleModel[]>([]);
    const model = ref<VehicleModel | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Fetch all models (with optional search and make_id filter)
    const fetchModels = async (
        params: {
            page?: number;
            search?: string;
            per_page?: number;
            make_id?: number;
        } = {},
    ) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.get('/vehicle-models', { params });
            models.value = response.data.data;
            return response.data; // Return full response for pagination meta
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching vehicle models';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Fetch a single model by ID
    const fetchModel = async (id: number) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.get(`/vehicle-models/${id}`);
            model.value = response.data.data;
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching vehicle model';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Create a new model
    const createModel = async (data: {
        make_id: number;
        name: string;
        year_from?: number;
        year_to?: number;
        generation?: string;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.post('/vehicle-models', data);
            models.value.push(response.data.data);
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error creating vehicle model';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Update an existing model
    const updateModel = async (
        id: number,
        data: {
            make_id: number;
            name: string;
            year_from?: number;
            year_to?: number;
            generation?: string;
        },
    ) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.put(`/vehicle-models/${id}`, data);
            const index = models.value.findIndex((m) => m.id === id);
            if (index !== -1) {
                models.value[index] = response.data.data;
            }
            model.value = response.data.data;
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error updating vehicle model';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Delete a model
    const deleteModel = async (id: number) => {
        loading.value = true;
        error.value = null;
        try {
            await apiClient.delete(`/vehicle-models/${id}`);
            models.value = models.value.filter((m) => m.id !== id);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error deleting vehicle model';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    return {
        models,
        model,
        loading,
        error,
        fetchModels,
        fetchModel,
        createModel,
        updateModel,
        deleteModel,
    };
}
