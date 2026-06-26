import { useStorage } from '@vueuse/core';
import { ref, computed } from 'vue';

export interface VehicleContext {
    make_id?: number;
    make_name?: string;
    model_id?: number;
    model_name?: string;
    engine_id?: number;
    engine_name?: string;
    year?: number;
}

// Global state (outside function) to share across components
const activeVehicle = useStorage<VehicleContext>('pos-vehicle-context', {});

export function useVehicleContext() {
    const setVehicle = (vehicle: VehicleContext) => {
        activeVehicle.value = vehicle;
    };

    const clearVehicle = () => {
        activeVehicle.value = {};
    };

    const isVehicleSelected = computed(() => {
        return !!activeVehicle.value.make_id && !!activeVehicle.value.model_id;
    });

    // Helper to format display string
    const vehicleDisplay = computed(() => {
        if (!activeVehicle.value.make_id) return 'Ningún vehículo seleccionado';

        const parts = [
            activeVehicle.value.year,
            activeVehicle.value.make_name,
            activeVehicle.value.model_name,
        ].filter(Boolean);

        if (activeVehicle.value.engine_name) {
            parts.push(`(${activeVehicle.value.engine_name})`);
        }

        return parts.join(' ');
    });

    return {
        vehicle: activeVehicle,
        setVehicle,
        clearVehicle,
        isVehicleSelected,
        vehicleDisplay,
    };
}
