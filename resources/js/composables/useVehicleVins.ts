import { ref } from 'vue'
import apiClient from '@/services/api/client'

export interface VehicleVin {
    id: number
    model_id: number
    engine_id?: number | null
    vin: string
    notes?: string | null
}

export function useVehicleVins(modelId: number) {
    const vins = ref<VehicleVin[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const fetchVins = async () => {
        loading.value = true
        error.value = null
        try {
            const res = await apiClient.get(`/vehicle-models/${modelId}/vins`)
            vins.value = res.data.data ?? []
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error cargando VINs'
        } finally {
            loading.value = false
        }
    }

    const addVin = async (vin: string, notes?: string) => {
        error.value = null
        try {
            const res = await apiClient.post(`/vehicle-models/${modelId}/vins`, { vin, notes })
            vins.value.unshift(res.data.data)
            return res.data.data as VehicleVin
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al agregar VIN'
            throw err
        }
    }

    const removeVin = async (vinId: number) => {
        error.value = null
        try {
            await apiClient.delete(`/vehicle-models/${modelId}/vins/${vinId}`)
            vins.value = vins.value.filter(v => v.id !== vinId)
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al eliminar VIN'
            throw err
        }
    }

    return { vins, loading, error, fetchVins, addVin, removeVin }
}
