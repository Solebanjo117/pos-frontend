<script setup lang="ts">
import { ref } from 'vue'
import { Car, X, ChevronRight } from 'lucide-vue-next'
import { useVehicleContext, type VehicleContext } from '@/composables/useVehicleContext'
import VehicleSelector from '@/components/VehicleSelector.vue'

const { vehicle, vehicleDisplay, isVehicleSelected, setVehicle, clearVehicle } = useVehicleContext()

const showModal = ref(false)
const tempSelection = ref<VehicleContext>({})

// Open modal and prep selection with current state if any, or empty
const openModal = () => {
    if (isVehicleSelected.value) {
        tempSelection.value = { ...vehicle.value }
    } else {
        tempSelection.value = {}
    }
    showModal.value = true
}

const closeModal = () => {
    showModal.value = false
}

const handleConfirm = () => {
    // Only confirm if engine is selected (full selection)
    if (tempSelection.value.engine_id) {
        setVehicle(tempSelection.value)
        closeModal()
    }
}
</script>

<template>
    <div class="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 px-6 py-2 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <div class="bg-indigo-600 dark:bg-primary dark:text-primary-foreground rounded-full p-1.5 text-white">
                <Car :size="16" />
            </div>
            
            <div v-if="isVehicleSelected" class="flex items-center gap-2">
                <span class="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                    Vehículo Activo:
                </span>
                <span class="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                    {{ vehicleDisplay }}
                </span>
                <button 
                    @click="clearVehicle"
                    class="ml-2 p-1 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full text-indigo-600 dark:text-primary dark:text-indigo-400 transition-colors"
                    title="Quitar vehículo"
                >
                    <X :size="16" />
                </button>
            </div>
            
            <div v-else class="flex items-center gap-2">
                 <span class="text-sm text-indigo-600 dark:text-primary dark:text-indigo-300">
                    No hay vehículo seleccionado
                </span>
            </div>
        </div>

        <button 
            @click="openModal"
            class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-card border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors shadow-sm"
        >
            {{ isVehicleSelected ? 'Cambiar Vehículo' : 'Seleccionar Vehículo' }}
        </button>

        <!-- Modal -->
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="closeModal">
            <div class="bg-white dark:bg-card rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-border flex justify-between items-center bg-gray-50 dark:bg-card/50">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Car :size="20" class="text-indigo-600 dark:text-primary" />
                        Seleccionar Vehículo del Cliente
                    </h3>
                    <button @click="closeModal" class="text-gray-400 hover:text-gray-500">
                        <X :size="20" />
                    </button>
                </div>
                
                <div class="p-6">
                    <VehicleSelector v-model="tempSelection" />
                    
                    <div class="mt-8 flex justify-end gap-3">
                        <button 
                            @click="closeModal"
                            class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-muted border border-gray-300 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-muted"
                        >
                            Cancelar
                        </button>
                        <button 
                            @click="handleConfirm"
                            :disabled="!tempSelection.engine_id"
                            class="px-6 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-all"
                        >
                            Confirmar Vehículo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
