import { ref } from 'vue';
import apiClient from '@/services/api/client';

export const VEHICLE_ENGINE_FUEL_TYPE_OPTIONS = [
    { value: 'Gasoline', label: 'Gasolina' },
    { value: 'Diesel', label: 'Diesel' },
    { value: 'Hybrid', label: 'Hibrido' },
    { value: 'Electric', label: 'Electrico' },
] as const;

export type VehicleEngineFuelType =
    (typeof VEHICLE_ENGINE_FUEL_TYPE_OPTIONS)[number]['value'];

const DEFAULT_VEHICLE_ENGINE_FUEL_TYPE: VehicleEngineFuelType = 'Gasoline';

const fuelTypeByNormalizedValue = new Map<string, VehicleEngineFuelType>(
    VEHICLE_ENGINE_FUEL_TYPE_OPTIONS.map((option) => [
        option.value.toLowerCase(),
        option.value,
    ]),
);

const normalizeModelIds = (
    modelIds: Array<number | string | null | undefined>,
): number[] => {
    return Array.from(
        new Set(
            modelIds
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0),
        ),
    );
};

export const normalizeVehicleEngineCode = (engineCode: string): string => {
    return String(engineCode ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/gu, ' ');
};

export const hasWhitespaceInVehicleEngineCode = (
    engineCode: string,
): boolean => {
    return /\s/u.test(engineCode);
};

export const normalizeVehicleEngineFuelType = (
    fuelType?: string | null,
): VehicleEngineFuelType => {
    const normalized = String(fuelType ?? '')
        .trim()
        .toLowerCase();

    if (!normalized) {
        return DEFAULT_VEHICLE_ENGINE_FUEL_TYPE;
    }

    return (
        fuelTypeByNormalizedValue.get(normalized) ??
        DEFAULT_VEHICLE_ENGINE_FUEL_TYPE
    );
};

export const buildVehicleEnginePayload = (data: {
    make_id?: number | string | null;
    engine_code: string;
    displacement?: string | null;
    fuel_type?: string | null;
    model_ids?: Array<number | string | null | undefined>;
    model_id?: number | string | null;
    aspiration?: string | null;
}) => {
    const normalizedModelIds = normalizeModelIds(data.model_ids ?? []);
    const legacyModelId = normalizeModelIds([data.model_id])[0] ?? null;

    if (legacyModelId !== null && !normalizedModelIds.includes(legacyModelId)) {
        normalizedModelIds.unshift(legacyModelId);
    }

    const normalizedDisplacement = String(data.displacement ?? '').trim();
    const normalizedAspiration = String(data.aspiration ?? '').trim();

    return {
        make_id: Number(data.make_id) || null,
        model_id: normalizedModelIds[0] ?? null,
        model_ids: normalizedModelIds,
        engine_code: normalizeVehicleEngineCode(data.engine_code),
        displacement: normalizedDisplacement || undefined,
        fuel_type: normalizeVehicleEngineFuelType(data.fuel_type),
        aspiration: normalizedAspiration || undefined,
    };
};

export interface VehicleEngine {
    id: number;
    make_id: number | null;
    model_id: number | null; // R21: Engines can be independent (no model)
    model_ids?: number[];
    engine_code: string;
    displacement: string; // e.g., "2.0L"
    fuel_type: string | null;
    aspiration?: string;
    make?: {
        id: number;
        name: string;
    };
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

export function useVehicleEngines() {
    const engines = ref<VehicleEngine[]>([]);
    const engine = ref<VehicleEngine | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Fetch all engines (with optional search and model_id filter)
    const fetchEngines = async (
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
            const response = await apiClient.get('/vehicle-engines', {
                params,
            });
            engines.value = response.data.data;
            return response.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching vehicle engines';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Fetch a single engine by ID
    const fetchEngine = async (id: number) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.get(`/vehicle-engines/${id}`);
            engine.value = response.data.data;
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error fetching vehicle engine';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Create a new engine (R21: model_id is now optional)
    const createEngine = async (data: {
        make_id?: number | null;
        model_id?: number | null;
        model_ids?: number[];
        engine_code: string;
        displacement?: string;
        fuel_type?: string | null;
        aspiration?: string;
    }) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.post('/vehicle-engines', data);
            engines.value.push(response.data.data);
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error creating vehicle engine';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Update an existing engine (R21: model_id is optional for updates)
    const updateEngine = async (
        id: number,
        data: {
            make_id?: number | null;
            model_id?: number | null;
            model_ids?: number[];
            engine_code?: string;
            displacement?: string;
            fuel_type?: string | null;
            aspiration?: string;
        },
    ) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.put(
                `/vehicle-engines/${id}`,
                data,
            );
            const index = engines.value.findIndex((e) => e.id === id);
            if (index !== -1) {
                engines.value[index] = response.data.data;
            }
            engine.value = response.data.data;
            return response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error updating vehicle engine';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Delete an engine
    const deleteEngine = async (id: number) => {
        loading.value = true;
        error.value = null;
        try {
            await apiClient.delete(`/vehicle-engines/${id}`);
            engines.value = engines.value.filter((e) => e.id !== id);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error deleting vehicle engine';
            throw err;
        } finally {
            loading.value = false;
        }
    };

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
    };
}
