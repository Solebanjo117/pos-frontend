import { ref } from 'vue'
import apiClient from '@/services/api/client'

export interface VehicleEngine {
    id: number
    model_id: number | null // R21: Engines can be independent (no model)
    engine_code: string
    displacement: string // e.g., "2.0L"
    fuel_type: string
    aspiration?: string
    model?: {
        id: number
        name: string
        make?: {
            id: number
            name: string
        }
    }
}

export function useVehicleEngines() {
    const engines = ref<VehicleEngine[]>([])
    const engine = ref<VehicleEngine | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Fetch all engines (with optional search and model_id filter)
    const fetchEngines = async (params: { page?: number; search?: string; per_page?: number; model_id?: number } = {}) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.get('/vehicle-engines', { params })
            engines.value = response.data.data
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error fetching vehicle engines'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Fetch a single engine by ID
    const fetchEngine = async (id: number) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.get(`/vehicle-engines/${id}`)
            engine.value = response.data.data
            return response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error fetching vehicle engine'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Create a new engine (R21: model_id is now optional)
    const createEngine = async (data: {
        model_id?: number | null;
        engine_code: string;
        displacement?: string;
        fuel_type?: string;
        aspiration?: string;
    }) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.post('/vehicle-engines', data)
            engines.value.push(response.data.data)
            return response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error creating vehicle engine'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Update an existing engine (R21: model_id is optional for updates)
    const updateEngine = async (id: number, data: {
        model_id?: number | null;
        engine_code?: string;
        displacement?: string;
        fuel_type?: string;
        aspiration?: string;
    }) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.put(`/vehicle-engines/${id}`, data)
            const index = engines.value.findIndex((e) => e.id === id)
            if (index !== -1) {
                engines.value[index] = response.data.data
            }
            engine.value = response.data.data
            return response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error updating vehicle engine'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Delete an engine
    const deleteEngine = async (id: number) => {
        loading.value = true
        error.value = null
        try {
            await apiClient.delete(`/vehicle-engines/${id}`)
            engines.value = engines.value.filter((e) => e.id !== id)
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error deleting vehicle engine'
            throw err
        } finally {
            loading.value = false
        }
    }

    return {
        engines,
        engine,
        loading,
        error,
        fetchEngines,
        fetchEngine,
        createEngine,
        updateEngine,
        deleteEngine,
    }
}
