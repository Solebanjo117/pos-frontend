<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useVehicleMakes } from '@/composables/useVehicleMakes'
import { useVehicleModels } from '@/composables/useVehicleModels'
import { useVehicleEngines, type VehicleEngine } from '@/composables/useVehicleEngines'

const props = defineProps<{
    modelValue?: {
        make_id?: number
        model_id?: number
        engine_id?: number
    }
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const { makes, fetchMakes, loading: loadingMakes } = useVehicleMakes()
const { models, fetchModels, loading: loadingModels } = useVehicleModels()
const { engines, fetchEngines, loading: loadingEngines } = useVehicleEngines()

const selectedMakeId   = ref<number | ''>(props.modelValue?.make_id   || '')
const selectedModelId  = ref<number | ''>(props.modelValue?.model_id  || '')
const selectedEngineId = ref<number | ''>(props.modelValue?.engine_id || '')

// "Serie" = unique engine_codes for the selected model (one option per code)
const seriesOptions = computed(() => {
    const seen = new Set<string>()
    return engines.value.filter(e => {
        if (seen.has(e.engine_code)) return false
        seen.add(e.engine_code)
        return true
    })
})

const selectedSerie = ref<string>('')   // engine_code string

// Engines filtered by selectedSerie
const filteredEngines = computed(() =>
    selectedSerie.value
        ? engines.value.filter(e => e.engine_code === selectedSerie.value)
        : engines.value
)

onMounted(async () => {
    await fetchMakes({ per_page: 100 })
    if (selectedMakeId.value)  await fetchModels({ make_id: Number(selectedMakeId.value), per_page: 100 })
    if (selectedModelId.value) await fetchEngines({ model_id: Number(selectedModelId.value), per_page: 100 })
})

// Cascading resets
watch(selectedMakeId, async (val) => {
    selectedModelId.value  = ''
    selectedEngineId.value = ''
    selectedSerie.value    = ''
    engines.value = []
    if (val) await fetchModels({ make_id: Number(val), per_page: 100 })
    else models.value = []
    emitChange()
})

watch(selectedModelId, async (val) => {
    selectedEngineId.value = ''
    selectedSerie.value    = ''
    if (val) await fetchEngines({ model_id: Number(val), per_page: 100 })
    else engines.value = []
    emitChange()
})

watch(selectedSerie, () => {
    selectedEngineId.value = ''
    // If only one engine for this serie, auto-select it
    if (filteredEngines.value.length === 1) {
        selectedEngineId.value = filteredEngines.value[0].id
    }
    emitChange()
})

watch(selectedEngineId, () => emitChange())

const emitChange = () => {
    const make   = makes.value.find(m => m.id === Number(selectedMakeId.value))
    const model  = models.value.find(m => m.id === Number(selectedModelId.value))
    const engine = engines.value.find(e => e.id === Number(selectedEngineId.value))

    emit('update:modelValue', {
        make_id:     Number(selectedMakeId.value)   || undefined,
        make_name:   make?.name,
        model_id:    Number(selectedModelId.value)  || undefined,
        model_name:  model?.name,
        engine_id:   Number(selectedEngineId.value) || undefined,
        engine_name: engine ? `${engine.engine_code} ${engine.displacement}` : undefined,
    })
    emit('change', {
        make_id: Number(selectedMakeId.value) || undefined,
        model_id: Number(selectedModelId.value) || undefined,
        engine_id: Number(selectedEngineId.value) || undefined,
    })
}
</script>

<template>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        <!-- Marca -->
        <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Marca</label>
            <select v-model="selectedMakeId" :disabled="loadingMakes"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-border dark:bg-muted dark:text-white sm:text-sm">
                <option value="">{{ loadingMakes ? 'Cargando...' : 'Selecciona Marca' }}</option>
                <option v-for="make in makes" :key="make.id" :value="make.id">{{ make.name }}</option>
            </select>
        </div>

        <!-- Modelo -->
        <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Modelo</label>
            <select v-model="selectedModelId" :disabled="!selectedMakeId || loadingModels"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-border dark:bg-muted dark:text-white sm:text-sm">
                <option value="">{{ loadingModels ? 'Cargando...' : 'Selecciona Modelo' }}</option>
                <option v-for="model in models" :key="model.id" :value="model.id">
                    {{ model.name }}
                    <template v-if="model.year_from">
                        ({{ model.year_from }}–{{ model.year_to ?? 'Presente' }})
                    </template>
                </option>
            </select>
        </div>

        <!-- Serie (engine_code) -->
        <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Serie</label>
            <select v-model="selectedSerie" :disabled="!selectedModelId || loadingEngines"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-border dark:bg-muted dark:text-white sm:text-sm">
                <option value="">{{ loadingEngines ? 'Cargando...' : 'Selecciona Serie' }}</option>
                <option v-for="s in seriesOptions" :key="s.engine_code" :value="s.engine_code">
                    {{ s.engine_code }}
                </option>
            </select>
        </div>

        <!-- Motor (displacement + fuel_type) -->
        <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Motor</label>
            <select v-model="selectedEngineId" :disabled="!selectedSerie || loadingEngines"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-border dark:bg-muted dark:text-white sm:text-sm">
                <option value="">Selecciona Motor</option>
                <option v-for="engine in filteredEngines" :key="engine.id" :value="engine.id">
                    {{ engine.displacement }} · {{ engine.fuel_type }}
                </option>
            </select>
        </div>

    </div>
</template>
