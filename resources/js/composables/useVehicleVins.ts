import { ref } from 'vue'
import apiClient from '@/services/api/client'

export interface VehicleVin {
    id: number
    model_id: number
    chassis_id?: number | null
    engine_id?: number | null
    vin: string
    notes?: string | null
}

export interface VehicleVinScope {
    modelId?: number | null
    chassisId?: number | null
    engineId?: number | null
}

const resolveBasePath = (scope: VehicleVinScope): string => {
    if (
        scope.modelId !== null &&
        scope.modelId !== undefined &&
        scope.chassisId !== null &&
        scope.chassisId !== undefined &&
        scope.engineId !== null &&
        scope.engineId !== undefined
    ) {
        return `/vehicle-models/${scope.modelId}/chassis/${scope.chassisId}/engines/${scope.engineId}/vins`
    }

    if (
        scope.modelId !== null &&
        scope.modelId !== undefined &&
        scope.engineId !== null &&
        scope.engineId !== undefined
    ) {
        return `/vehicle-models/${scope.modelId}/engines/${scope.engineId}/vins`
    }

    if (scope.modelId !== null && scope.modelId !== undefined) {
        return `/vehicle-models/${scope.modelId}/vins`
    }

    if (scope.engineId !== null && scope.engineId !== undefined) {
        return `/vehicle-engines/${scope.engineId}/vins`
    }

    throw new Error('useVehicleVins requires modelId, modelId + engineId, or engineId')
}

export function useVehicleVins(scopeOrModelId: number | VehicleVinScope) {
    const scope: VehicleVinScope = typeof scopeOrModelId === 'number'
        ? { modelId: scopeOrModelId }
        : scopeOrModelId

    const basePath = resolveBasePath(scope)

    const vins = ref<VehicleVin[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const fetchVins = async () => {
        loading.value = true
        error.value = null
        try {
            const res = await apiClient.get(basePath)
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
            const res = await apiClient.post(basePath, { vin, notes })
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
            await apiClient.delete(`${basePath}/${vinId}`)
            vins.value = vins.value.filter(v => v.id !== vinId)
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al eliminar VIN'
            throw err
        }
    }

    return { vins, loading, error, fetchVins, addVin, removeVin }
}
