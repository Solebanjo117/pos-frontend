import { ref } from 'vue'
import apiClient from '@/services/api/client'

export interface VehicleMake {
    id: number
    name: string
    models_count?: number
    created_at?: string
    updated_at?: string
}

export function useVehicleMakes() {
    const makes = ref<VehicleMake[]>([])
    const make = ref<VehicleMake | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Fetch all makes (with optional search)
    const fetchMakes = async (params: { page?: number; search?: string; per_page?: number } = {}) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.get('/vehicle-makes', { params })
            makes.value = response.data.data
            return response.data // Return full response for pagination meta
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error fetching vehicle makes'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Fetch a single make by ID
    const fetchMake = async (id: number) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.get(`/vehicle-makes/${id}`)
            make.value = response.data.data
            return response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error fetching vehicle make'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Create a new make
    const createMake = async (data: { name: string }) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.post('/vehicle-makes', data)
            makes.value.push(response.data.data)
            return response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error creating vehicle make'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Update an existing make
    const updateMake = async (id: number, data: { name: string }) => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.put(`/vehicle-makes/${id}`, data)
            const index = makes.value.findIndex((m) => m.id === id)
            if (index !== -1) {
                makes.value[index] = response.data.data
            }
            make.value = response.data.data
            return response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error updating vehicle make'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Delete a make
    const deleteMake = async (id: number) => {
        loading.value = true
        error.value = null
        try {
            await apiClient.delete(`/vehicle-makes/${id}`)
            makes.value = makes.value.filter((m) => m.id !== id)
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error deleting vehicle make'
            throw err
        } finally {
            loading.value = false
        }
    }

    return {
        makes,
        make,
        loading,
        error,
        fetchMakes,
        fetchMake,
        createMake,
        updateMake,
        deleteMake,
    }
}
