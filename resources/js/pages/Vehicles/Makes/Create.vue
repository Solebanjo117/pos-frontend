<script setup lang="ts">
import { ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleMakes } from '@/composables/useVehicleMakes'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' },
    { title: 'Marcas', href: '/vehicles/makes' },
    { title: 'Crear', href: '/vehicles/makes/create' },
]

const { createMake, loading, error } = useVehicleMakes()
const form = ref({
    name: ''
})

const handleSubmit = async () => {
    try {
        await createMake(form.value)
        router.visit('/vehicles/makes')
    } catch (e) {
        // Error is handled by composable
    }
}
</script>

<template>
    <Head title="Crear Marca" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-2xl space-y-6 p-6">
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Crear Nueva Marca</h1>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Nombre de la Marca
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                            placeholder="Ej: Toyota, Ford, Nissan"
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
                            {{ loading ? 'Guardando...' : 'Guardar Marca' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
