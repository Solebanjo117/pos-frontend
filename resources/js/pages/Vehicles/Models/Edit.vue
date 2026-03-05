<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleModels } from '@/composables/useVehicleModels'
import { useVehicleMakes } from '@/composables/useVehicleMakes'

const props = defineProps<{
    id: string 
}>()

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' },
    { title: 'Modelos', href: '/vehicles/models' },
    { title: 'Editar', href: '#' },
]

const { fetchModel, updateModel, loading, error } = useVehicleModels()
const { makes, fetchMakes } = useVehicleMakes()

const form = ref({
    make_id: '' as string | number,
    name: '',
    year_from: undefined as number | undefined,
    year_to: undefined as number | undefined,
})

onMounted(async () => {
    // Load Makes first
    await fetchMakes({ per_page: 100 })

    // Load Model data
    if (props.id) {
        const data = await fetchModel(parseInt(props.id))
        form.value.name = data.name
        form.value.make_id = data.make_id
        form.value.year_from = data.year_from
        form.value.year_to = data.year_to
    }
})

const handleSubmit = async () => {
    try {
        await updateModel(parseInt(props.id), {
            ...form.value,
            make_id: Number(form.value.make_id)
        })
        router.visit('/vehicles/models')
    } catch (e) {
        // Error handled in composable
    }
}
</script>

<template>
    <Head title="Editar Modelo" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-2xl space-y-6 p-6">
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Editar Modelo</h1>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form @submit.prevent="handleSubmit" class="space-y-6">
                    <!-- Make Selection -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Marca
                        </label>
                        <select
                            v-model="form.make_id"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        >
                            <option value="" disabled>Selecciona una marca</option>
                            <option v-for="make in makes" :key="make.id" :value="make.id">
                                {{ make.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Model Name -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Nombre del Modelo
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        />
                    </div>

                    <div class="flex justify-end gap-3">
                        <Link
                            href="/vehicles/models"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading"
                            class="rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50"
                        >
                            {{ loading ? 'Actualizar...' : 'Actualizar Modelo' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
