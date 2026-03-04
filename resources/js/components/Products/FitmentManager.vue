<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, Info } from 'lucide-vue-next'
import VehicleSelector from '@/components/VehicleSelector.vue'
import { useProductFitment } from '@/composables/useProductFitment'

const props = defineProps<{
    productId: number
}>()

const { fitments, loading, fetchFitments, addFitment, removeFitment } = useProductFitment(props.productId)

const selectedVehicle = ref<{
    make_id?: number
    model_id?: number
    engine_id?: number
    year?: number
}>({})

const notes = ref('')
const adding = ref(false)

onMounted(() => {
    fetchFitments()
})

const handleAdd = async () => {
    if (!selectedVehicle.value.engine_id) return

    adding.value = true
    try {
        await addFitment(selectedVehicle.value.engine_id, notes.value)
        // Reset selection (optional, or keep for rapid entry)
        notes.value = ''
    } catch (e) {
        // Error handled in composable
        alert('Error adding fitment')
    } finally {
        adding.value = false
    }
}
</script>

<template>
    <div class="space-y-6">
        <!-- Header / Add Bar -->
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 class="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus class="h-4 w-4" />
                Agregar Compatibilidad
            </h3>
            
            <div class="grid gap-4">
                <!-- Selector -->
                <VehicleSelector v-model="selectedVehicle" />

                <!-- Notes & Action -->
                <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div class="flex-1">
                        <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Notas (Opcional)</label>
                        <input 
                            v-model="notes"
                            type="text" 
                            placeholder="Ej: Solo delantero, Transmisión Automática..."
                            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                        >
                    </div>
                    <button
                        @click="handleAdd"
                        :disabled="!selectedVehicle.engine_id || adding"
                        class="flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <span v-if="adding">Guardando...</span>
                        <span v-else>Agregar Vehículo</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Matrix List -->
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div class="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">Vehículos Compatibles (Fitment)</h3>
            </div>
            
            <div v-if="loading && fitments.length === 0" class="p-8 text-center text-gray-500">
                Cargando compatibilidades...
            </div>

            <div v-else-if="fitments.length === 0" class="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                <Info class="mb-2 h-8 w-8 text-gray-400" />
                <p>Este producto no tiene vehículos asignados.</p>
                <p class="text-sm text-gray-400">Es considerado "Universal" o falta información.</p>
            </div>

            <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Vehículo</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Motor</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Notas</th>
                        <th scope="col" class="relative px-6 py-3">
                            <span class="sr-only">Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    <tr v-for="fitment in fitments" :key="fitment.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="whitespace-nowrap px-6 py-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">
                                {{ fitment.engine?.model?.make?.name }} {{ fitment.engine?.model?.name }}
                            </div>
                            <div class="text-xs text-gray-500">
                                {{ fitment.engine?.model?.year_from || '?' }} - {{ fitment.engine?.model?.year_to || 'Present' }}
                            </div>
                        </td>
                        <td class="whitespace-nowrap px-6 py-4">
                            <div class="text-sm text-gray-900 dark:text-white">
                                {{ fitment.engine?.displacement }} {{ fitment.engine?.engine_code }}
                            </div>
                            <div class="text-xs text-gray-500">
                                {{ fitment.engine?.fuel_type }}
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <span v-if="fitment.notes" class="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                                {{ fitment.notes }}
                            </span>
                            <span v-else class="text-xs text-gray-400">-</span>
                        </td>
                        <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                            <button 
                                @click="removeFitment(fitment.id)"
                                class="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                                title="Eliminar compatibilidad"
                            >
                                <Trash2 class="h-5 w-5" />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
