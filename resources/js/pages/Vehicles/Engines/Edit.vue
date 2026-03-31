<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleEngines } from '@/composables/useVehicleEngines'

const props = defineProps<{
    engineId: number
}>()

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles' },
    { title: 'Motores', href: '/vehicles/engines' },
    { title: 'Editar', href: '#' },
]

const { engines, fetchEngine, fetchEngines, updateEngine, loading, error } = useVehicleEngines()

const form = ref({
    engine_code: '',
    displacement: '',
    fuel_type: 'Gasoline',
})

const loadingEngine = ref(true)
const duplicateConfirmed = ref(false)

// R20: Check for duplicate engine code (excluding current engine)
const checkDuplicate = (code: string): boolean => {
    return engines.value.some(e => 
        e.engine_code.toLowerCase().trim() === code.toLowerCase().trim() &&
        e.id !== props.engineId
    )
}

onMounted(async () => {
    try {
        const data = await fetchEngine(props.engineId)
        form.value.engine_code = data.engine_code
        form.value.displacement = data.displacement || ''
        form.value.fuel_type = data.fuel_type || 'Gasoline'
        // Load all engines for duplicate check
        await fetchEngines({ per_page: 500 })
    } finally {
        loadingEngine.value = false
    }
})

const handleSubmit = async () => {
    // R20: Check for duplicate
    if (!duplicateConfirmed.value && checkDuplicate(form.value.engine_code)) {
        const confirm = window.confirm(
            `⚠️ Ya existe un motor con el código "${form.value.engine_code}".\n\n¿Desea guardar este motor duplicado?`
        )
        if (!confirm) return
        duplicateConfirmed.value = true
    }

    try {
        await updateEngine(props.engineId, {
            ...form.value,
            aspiration: 'N/A',
        })
        router.visit('/vehicles/engines')
    } catch (e) {
        // Error handled in composable
        duplicateConfirmed.value = false
    }
}
</script>

<template>
    <Head title="Editar Motor" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-xl space-y-6 p-6">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Editar Motor</h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Modificar las propiedades de este motor
                </p>
            </div>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {{ error }}
            </div>

            <div v-if="loadingEngine" class="rounded-lg bg-white p-12 shadow dark:bg-card text-center">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p class="mt-4 text-gray-500">Cargando motor...</p>
            </div>

            <div v-else class="rounded-lg bg-white p-6 shadow dark:bg-card">
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
                            {{ loading ? 'Guardando...' : 'Actualizar Motor' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
