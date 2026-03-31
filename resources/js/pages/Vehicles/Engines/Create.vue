<script setup lang="ts">
import { ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleEngines } from '@/composables/useVehicleEngines'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles' },
    { title: 'Motores', href: '/vehicles/engines' },
    { title: 'Crear', href: '/vehicles/engines/create' },
]

const { engines, createEngine, fetchEngines, loading, error } = useVehicleEngines()

const form = ref({
    engine_code: '',
    displacement: '',
    fuel_type: 'Gasoline',
})

const duplicateConfirmed = ref(false)

// R20: Check for duplicate engine code
const checkDuplicate = (code: string): boolean => {
    return engines.value.some(e => 
        e.engine_code.toLowerCase().trim() === code.toLowerCase().trim()
    )
}

const handleSubmit = async () => {
    // R20: Check for duplicate
    if (!duplicateConfirmed.value && checkDuplicate(form.value.engine_code)) {
        const confirm = window.confirm(
            `⚠️ Ya existe un motor con el código "${form.value.engine_code}".\n\n¿Desea crear un motor duplicado?`
        )
        if (!confirm) return
        duplicateConfirmed.value = true
    }

    try {
        await createEngine({
            ...form.value,
            aspiration: 'N/A',  // Campo legacy, no se usa ya
        })
        router.visit('/vehicles/engines')
    } catch (e) {
        // Error handled in composable
        duplicateConfirmed.value = false
    }
}

// Load engines for duplicate check
fetchEngines({ per_page: 500 })
</script>

<template>
    <Head title="Crear Motor" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-xl space-y-6 p-6">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Crear Nuevo Motor</h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Los motores son reutilizables y pueden asignarse a múltiples vehículos
                </p>
            </div>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form @submit.prevent="handleSubmit" class="space-y-6">
                    <!-- Código de Motor -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Código de Motor <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="form.engine_code"
                            type="text"
                            required
                            placeholder="Ej: 2ZR-FE, K20A, 1GR-FE"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white font-mono"
                        />
                        <p class="mt-1 text-xs text-gray-500">Código único que identifica este motor</p>
                    </div>

                    <!-- Desplazamiento -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Desplazamiento
                        </label>
                        <input
                            v-model="form.displacement"
                            type="text"
                            placeholder="Ej: 1.8L, 2.4L, 3.5L"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Combustible -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Combustible
                        </label>
                        <select
                            v-model="form.fuel_type"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option value="Gasoline">Gasolina</option>
                            <option value="Diesel">Diesel</option>
                            <option value="Hybrid">Híbrido</option>
                            <option value="Electric">Eléctrico</option>
                        </select>
                    </div>

                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-border">
                        <Link
                            href="/vehicles/engines"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading || !form.engine_code"
                            class="rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50"
                        >
                            {{ loading ? 'Guardando...' : 'Guardar Motor' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
