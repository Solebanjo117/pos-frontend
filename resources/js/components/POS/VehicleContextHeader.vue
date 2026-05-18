<script setup lang="ts">
import { ref } from 'vue';
import { Car, X, ChevronRight } from 'lucide-vue-next';
import {
    useVehicleContext,
    type VehicleContext,
} from '@/composables/useVehicleContext';
import VehicleSelector from '@/components/VehicleSelector.vue';

const { vehicle, vehicleDisplay, isVehicleSelected, setVehicle, clearVehicle } =
    useVehicleContext();

const showModal = ref(false);
const tempSelection = ref<VehicleContext>({});

// Open modal and prep selection with current state if any, or empty
const openModal = () => {
    if (isVehicleSelected.value) {
        tempSelection.value = { ...vehicle.value };
    } else {
        tempSelection.value = {};
    }
    showModal.value = true;
};

const closeModal = () => {
    showModal.value = false;
};

const handleConfirm = () => {
    // Only confirm if engine is selected (full selection)
    if (tempSelection.value.engine_id) {
        setVehicle(tempSelection.value);
        closeModal();
    }
};
</script>

<template>
    <div
        class="flex items-center justify-between border-b border-indigo-100 bg-indigo-50 px-6 py-2 dark:border-indigo-800 dark:bg-indigo-900/20"
    >
        <div class="flex items-center gap-3">
            <div
                class="rounded-full bg-indigo-600 p-1.5 text-white dark:bg-primary dark:text-primary-foreground"
            >
                <Car :size="16" />
            </div>

            <div v-if="isVehicleSelected" class="flex items-center gap-2">
                <span
                    class="text-sm font-medium text-indigo-900 dark:text-indigo-200"
                >
                    Vehículo Activo:
                </span>
                <span
                    class="text-lg font-bold text-indigo-700 dark:text-indigo-300"
                >
                    {{ vehicleDisplay }}
                </span>
                <button
                    @click="clearVehicle"
                    class="ml-2 rounded-full p-1 text-indigo-600 transition-colors hover:bg-indigo-200 dark:text-indigo-400 dark:text-primary dark:hover:bg-indigo-800"
                    title="Quitar vehículo"
                >
                    <X :size="16" />
                </button>
            </div>

            <div v-else class="flex items-center gap-2">
                <span
                    class="text-sm text-indigo-600 dark:text-indigo-300 dark:text-primary"
                >
                    No hay vehículo seleccionado
                </span>
            </div>
        </div>

        <button
            @click="openModal"
            class="rounded border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:bg-card dark:text-indigo-300 dark:hover:bg-indigo-900"
        >
            {{
                isVehicleSelected ? 'Cambiar Vehículo' : 'Seleccionar Vehículo'
            }}
        </button>

        <!-- Modal -->
        <div
            v-if="showModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            @click.self="closeModal"
        >
            <div
                class="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-card"
            >
                <div
                    class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-border dark:bg-card/50"
                >
                    <h3
                        class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        <Car
                            :size="20"
                            class="text-indigo-600 dark:text-primary"
                        />
                        Seleccionar Vehículo del Cliente
                    </h3>
                    <button
                        @click="closeModal"
                        class="text-gray-400 hover:text-gray-500"
                    >
                        <X :size="20" />
                    </button>
                </div>

                <div class="p-6">
                    <VehicleSelector v-model="tempSelection" />

                    <div class="mt-8 flex justify-end gap-3">
                        <button
                            @click="closeModal"
                            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-300 dark:hover:bg-muted"
                        >
                            Cancelar
                        </button>
                        <button
                            @click="handleConfirm"
                            :disabled="!tempSelection.engine_id"
                            class="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            Confirmar Vehículo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
