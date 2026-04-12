<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleChassis } from '@/composables/useVehicleChassis'
import apiClient from '@/services/api/client'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles' },
    { title: 'Chasis', href: '/vehicles/chassis' },
    { title: 'Crear', href: '/vehicles/chassis/create' },
]

const { chassisList, createChassis, fetchChassis, loading, error } = useVehicleChassis()

const form = ref({
    code: '',
    name: '',
    model_id: null as number | null,
    year_from: '',
    year_to: '',
    notes: '',
})

// Vehicle makes/models for optional association
const makes = ref<{ id: number; name: string }[]>([])
const models = ref<{ id: number; name: string }[]>([])
const selectedMakeId = ref<number | null>(null)

const fetchMakes = async () => {
    try {
        const { data } = await apiClient.get('/vehicle-makes')
        makes.value = data.data
    } catch { makes.value = [] }
}

const fetchModels = async (makeId: number) => {
    try {
        const { data } = await apiClient.get(`/vehicle-makes/${makeId}/models`)
        models.value = data.data
    } catch { models.value = [] }
}

onMounted(() => {
    fetchMakes()
    fetchChassis({ per_page: 500 }) // For duplicate check
})

const onMakeChange = async () => {
    form.value.model_id = null
    models.value = []
    if (selectedMakeId.value) {
        await fetchModels(selectedMakeId.value)
    }
}

const duplicateConfirmed = ref(false)

const checkDuplicate = (code: string): boolean => {
    return chassisList.value.some(c =>
        c.code.toLowerCase().trim() === code.toLowerCase().trim()
    )
}

const handleSubmit = async () => {
    if (!duplicateConfirmed.value && checkDuplicate(form.value.code)) {
        const confirm = window.confirm(
            `⚠️ Ya existe un chasis con el código "${form.value.code}".\n\n¿Desea crear un chasis duplicado?`
        )
        if (!confirm) return
        duplicateConfirmed.value = true
    }

    try {
        await createChassis({
            code: form.value.code,
            name: form.value.name || undefined,
            model_id: form.value.model_id,
            year_from: form.value.year_from || undefined,
            year_to: form.value.year_to || undefined,
            notes: form.value.notes || undefined,
        })
        router.visit('/vehicles/chassis')
    } catch (e) {
        duplicateConfirmed.value = false
    }
}
</script>

<template>
    <Head title="Crear Chasis" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-xl space-y-6 p-6">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Crear Nuevo Chasis</h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Los chasis son reutilizables y pueden asociarse a compatibilidad vehicular de productos
                </p>
            </div>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-6">
                    <!-- Código -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Código de Chasis <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="form.code"
                            type="text"
                            required
                            placeholder="Ej: J200, W205, E90"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white font-mono"
                        />
                        <p class="mt-1 text-xs text-gray-500">Código único que identifica este chasis</p>
                    </div>

                    <!-- Nombre -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Nombre / Descripción
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            placeholder="Ej: Toyota Hilux 8va Gen, BMW Serie 3"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Vehículo asociado (opcional) -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Marca (opcional)
                            </label>
                            <select
                                v-model="selectedMakeId"
                                @change="onMakeChange"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option :value="null">— Sin asociar —</option>
                                <option v-for="m in makes" :key="m.id" :value="m.id">{{ m.name }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Modelo (opcional)
                            </label>
                            <select
                                v-model="form.model_id"
                                :disabled="!selectedMakeId"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white disabled:opacity-50"
                            >
                                <option :value="null">— Sin modelo —</option>
                                <option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}</option>
                            </select>
                        </div>
                    </div>

                    <!-- Años -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Año Desde
                            </label>
                            <input
                                v-model="form.year_from"
                                type="text"
                                maxlength="4"
                                placeholder="Ej: 2015"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Año Hasta
                            </label>
                            <input
                                v-model="form.year_to"
                                type="text"
                                maxlength="4"
                                placeholder="Ej: 2024"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                    </div>

                    <!-- Notas -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Notas
                        </label>
                        <textarea
                            v-model="form.notes"
                            rows="3"
                            placeholder="Notas adicionales sobre este chasis..."
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-border">
                        <Link
                            href="/vehicles/chassis"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading || !form.code"
                            class="rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50"
                        >
                            {{ loading ? 'Guardando...' : 'Guardar Chasis' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
