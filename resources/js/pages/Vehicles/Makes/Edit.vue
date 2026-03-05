<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleMakes } from '@/composables/useVehicleMakes'

const props = defineProps<{
    id: string 
}>()

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' },
    { title: 'Marcas', href: '/vehicles/makes' },
    { title: 'Editar', href: '#' },
]

const { fetchMake, updateMake, loading, error } = useVehicleMakes()
const form = ref({
    name: ''
})

onMounted(async () => {
    // Basic ID validation
    if (props.id) {
        const data = await fetchMake(parseInt(props.id))
        form.value.name = data.name
    }
})

const handleSubmit = async () => {
    try {
        await updateMake(parseInt(props.id), form.value)
        router.visit('/vehicles/makes')
    } catch (e) {
        // Error handled in composable
    }
}
</script>

<template>
    <Head title="Editar Marca" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-2xl space-y-6 p-6">
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Editar Marca</h1>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form @submit.prevent="handleSubmit" class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Nombre de la Marca
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
                            href="/vehicles/makes"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading"
                            class="rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50"
                        >
                            {{ loading ? 'Actualizar...' : 'Actualizar Marca' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
