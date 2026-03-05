<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleEngines } from '@/composables/useVehicleEngines'
import { useVehicleModels } from '@/composables/useVehicleModels'
import { useVehicleMakes } from '@/composables/useVehicleMakes'

const props = defineProps<{
    id: string 
}>()

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' },
    { title: 'Motores', href: '/vehicles/engines' },
    { title: 'Editar', href: '#' },
]

const { fetchEngine, updateEngine, loading, error } = useVehicleEngines()
const { makes, fetchMakes } = useVehicleMakes()
const { models, fetchModels } = useVehicleModels()

const selectedMakeId = ref<number | ''>('')
const form = ref({
    model_id: '' as string | number,
    engine_code: '',
    displacement: '',
    fuel_type: '',
    aspiration: ''
})

onMounted(async () => {
    await fetchMakes({ per_page: 100 })
    
    if (props.id) {
        const data = await fetchEngine(parseInt(props.id))
        form.value.engine_code = data.engine_code
        form.value.displacement = data.displacement
        form.value.fuel_type = data.fuel_type
        form.value.aspiration = data.aspiration || ''
        
        // Pre-select Make and Model logic
        if (data.model) {
            form.value.model_id = data.model.id
            if (data.model.make_id) {
                selectedMakeId.value = data.model.make_id
                await fetchModels({ make_id: data.model.make_id, per_page: 100 })
            }
        }
    }
})

// Cascading update
watch(selectedMakeId, async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
        // Only fetch if changed (and prevent wiping model_id on initial load)
        await fetchModels({ make_id: Number(newVal), per_page: 100 })
        // If the selected model doesn't belong to the new make, clear it
        // (This logic is simplified, could be more robust)
    }
})

const handleSubmit = async () => {
    try {
        await updateEngine(parseInt(props.id), {
            ...form.value,
            model_id: Number(form.value.model_id)
        })
        router.visit('/vehicles/engines')
    } catch (e) {
        // Error handled in composable
    }
}
</script>

<template>
    <Head title="Editar Motor" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-2xl space-y-6 p-6">
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Editar Motor</h1>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form @submit.prevent="handleSubmit" class="space-y-6">
                    <!-- Make Selection (Helper) -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Marca (Filtrar Modelos)
                        </label>
                        <select
                            v-model="selectedMakeId"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        >
                            <option value="" disabled>Selecciona una marca</option>
                            <option v-for="make in makes" :key="make.id" :value="make.id">
                                {{ make.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Model Selection -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Modelo
                        </label>
                        <select
                            v-model="form.model_id"
                            required
                            :disabled="!selectedMakeId"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        >
                            <option value="" disabled>Selecciona un modelo</option>
                            <option v-for="carModel in models" :key="carModel.id" :value="carModel.id">
                                {{ carModel.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Engine Details -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Código de Motor
                        </label>
                        <input
                            v-model="form.engine_code"
                            type="text"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Desplazamiento
                        </label>
                        <input
                            v-model="form.displacement"
                            type="text"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Combustible
                        </label>
                        <select
                            v-model="form.fuel_type"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        >
                            <option value="Gasoline">Gasolina</option>
                            <option value="Diesel">Diesel</option>
                            <option value="Hybrid">Híbrido</option>
                            <option value="Electric">Eléctrico</option>
                        </select>
                    </div>

                    <div class="flex justify-end gap-3">
                        <Link
                            href="/vehicles/engines"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading"
                            class="rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50"
                        >
                            {{ loading ? 'Actualizar...' : 'Actualizar Motor' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
