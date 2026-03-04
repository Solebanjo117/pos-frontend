<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleEngines } from '@/composables/useVehicleEngines'
import { useVehicleModels } from '@/composables/useVehicleModels'
import { useVehicleMakes } from '@/composables/useVehicleMakes'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' },
    { title: 'Motores', href: '/vehicles/engines' },
    { title: 'Crear', href: '/vehicles/engines/create' },
]

const { createEngine, loading, error } = useVehicleEngines()
const { makes, fetchMakes } = useVehicleMakes()
const { models, fetchModels } = useVehicleModels()

const selectedMakeId = ref<number | ''>('')
const form = ref({
    model_id: '' as string | number,
    engine_code: '',
    displacement: '',
    fuel_type: 'Gasoline',
    aspiration: 'Naturally Aspirated'
})

// Load Makes on mount
onMounted(async () => {
    await fetchMakes({ per_page: 100 })
})

// Load Models when Make changes
watch(selectedMakeId, async (newVal) => {
    form.value.model_id = ''
    if (newVal) {
        await fetchModels({ make_id: Number(newVal), per_page: 100 })
    } else {
        models.value = []
    }
})

const handleSubmit = async () => {
    try {
        await createEngine({
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
    <Head title="Crear Motor" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-2xl space-y-6 p-6">
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Crear Nuevo Motor</h1>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <form @submit.prevent="handleSubmit" class="space-y-6">
                    <!-- Make Selection (Helper) -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Marca (Filtrar Modelos)
                        </label>
                        <select
                            v-model="selectedMakeId"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
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
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
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
                            Código de Motor (Ej: 2ZR-FE)
                        </label>
                        <input
                            v-model="form.engine_code"
                            type="text"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Desplazamiento (Ej: 1.8L)
                        </label>
                        <input
                            v-model="form.displacement"
                            type="text"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Combustible
                        </label>
                        <select
                            v-model="form.fuel_type"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
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
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading"
                            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {{ loading ? 'Guardando...' : 'Guardar Motor' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
