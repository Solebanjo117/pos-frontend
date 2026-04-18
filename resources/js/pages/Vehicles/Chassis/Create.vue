<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleChassis } from '@/composables/useVehicleChassis'
import apiClient from '@/services/api/client'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'

interface VehicleModelItem {
    id: number
    make_id?: number
    name: string
    year_from?: number | string | null
    year_to?: number | string | null
    make?: {
        id: number
        name: string
    }
}

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
    model_ids: [] as number[],
    year_from: '',
    year_to: '',
    notes: '',
})

const makes = ref<{ id: number; name: string }[]>([])
const models = ref<VehicleModelItem[]>([])
const selectedMakeFilterId = ref<number | null>(null)
const modelSearch = ref('')
const loadingModels = ref(false)

const makeOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas las marcas' },
    ...makes.value.map((make) => ({ value: make.id, label: make.name })),
])

const modelsById = computed(() => {
    return new Map(models.value.map((model) => [model.id, model]))
})

const normalizeYear = (year?: number | string | null): string => {
    if (year === null || year === undefined) return ''
    return String(year).trim()
}

const formatModelYears = (model: VehicleModelItem): string => {
    const yearFrom = normalizeYear(model.year_from)
    const yearTo = normalizeYear(model.year_to)

    if (!yearFrom && !yearTo) return ''
    return `${yearFrom || '?'}-${yearTo || '?'}`
}

const formatModelLabel = (model: VehicleModelItem): string => {
    const makeName = model.make?.name?.trim()
    return [makeName, model.name].filter(Boolean).join(' ')
}

const filteredModels = computed(() => {
    const query = modelSearch.value.trim().toLowerCase()

    const filtered = models.value.filter((model) => {
        const matchesMake = !selectedMakeFilterId.value || model.make?.id === selectedMakeFilterId.value || model.make_id === selectedMakeFilterId.value
        if (!matchesMake) return false

        if (!query) return true

        const haystack = [
            model.name,
            model.make?.name,
            formatModelYears(model),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

        return haystack.includes(query)
    })

    return filtered.sort((a, b) => formatModelLabel(a).localeCompare(formatModelLabel(b)))
})

const selectedModels = computed(() => {
    return form.value.model_ids
        .map((id) => modelsById.value.get(id))
        .filter((model): model is VehicleModelItem => Boolean(model))
})

const fetchMakes = async () => {
    try {
        const { data } = await apiClient.get('/vehicle-makes')
        makes.value = data.data ?? []
    } catch {
        makes.value = []
    }
}

const fetchAllModels = async () => {
    loadingModels.value = true

    try {
        const collected: VehicleModelItem[] = []
        let page = 1
        let lastPage = 1

        do {
            const { data } = await apiClient.get('/vehicle-models', {
                params: { page, per_page: 200 },
            })

            const pageItems = (data.data ?? []) as VehicleModelItem[]
            collected.push(...pageItems)

            lastPage = Number(data.meta?.last_page ?? 1)
            page += 1
        } while (page <= lastPage)

        const uniqueById = new Map<number, VehicleModelItem>()
        collected.forEach((model) => uniqueById.set(model.id, model))
        models.value = Array.from(uniqueById.values())
    } catch {
        models.value = []
    } finally {
        loadingModels.value = false
    }
}

onMounted(() => {
    fetchMakes()
    fetchAllModels()
    fetchChassis({ per_page: 500 }) // Duplicate code guard
})

const duplicateConfirmed = ref(false)

const checkDuplicate = (code: string): boolean => {
    return chassisList.value.some((chassis) =>
        chassis.code.toLowerCase().trim() === code.toLowerCase().trim()
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

    const uniqueModelIds = Array.from(new Set(form.value.model_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))))

    try {
        await createChassis({
            code: form.value.code,
            name: form.value.name || undefined,
            model_id: uniqueModelIds[0] ?? null,
            model_ids: uniqueModelIds,
            year_from: form.value.year_from || undefined,
            year_to: form.value.year_to || undefined,
            notes: form.value.notes || undefined,
        })
        router.visit('/vehicles/chassis')
    } catch {
        duplicateConfirmed.value = false
    }
}
</script>

<template>
    <Head title="Crear Chasis" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-3xl space-y-6 p-6">
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

                    <!-- Modelos asociados (opcional) -->
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Modelos asociados (opcional)
                            </label>
                            <p class="mt-1 text-xs text-gray-500">Puedes asociar este chasis a uno o varios modelos, incluso de diferentes marcas.</p>
                        </div>

                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                                <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Filtro por marca
                                </label>
                                <div class="mt-1">
                                    <SearchableSelect
                                        v-model="selectedMakeFilterId"
                                        :options="makeOptions"
                                        placeholder="Todas las marcas"
                                    />
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Buscar modelo
                                </label>
                                <input
                                    v-model="modelSearch"
                                    type="text"
                                    placeholder="Ej: Hilux, Corolla, Civic..."
                                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                        </div>

                        <div class="rounded-md border border-gray-200 dark:border-border">
                            <div v-if="loadingModels" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                Cargando modelos...
                            </div>

                            <div v-else-if="filteredModels.length === 0" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                No hay modelos para el filtro actual.
                            </div>

                            <div v-else class="max-h-56 divide-y divide-gray-100 overflow-y-auto dark:divide-border">
                                <label
                                    v-for="model in filteredModels"
                                    :key="model.id"
                                    class="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-muted/40"
                                >
                                    <input
                                        v-model="form.model_ids"
                                        type="checkbox"
                                        :value="model.id"
                                        class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />

                                    <div class="min-w-0">
                                        <p class="text-sm font-medium text-gray-900 dark:text-white">
                                            {{ formatModelLabel(model) }}
                                        </p>
                                        <p v-if="formatModelYears(model)" class="text-xs text-gray-500 dark:text-gray-400">
                                            Años: {{ formatModelYears(model) }}
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            {{ form.model_ids.length }} modelo(s) seleccionado(s)
                        </p>

                        <div v-if="selectedModels.length > 0" class="flex flex-wrap gap-2">
                            <span
                                v-for="model in selectedModels"
                                :key="`selected-model-${model.id}`"
                                class="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                                :title="`${formatModelLabel(model)} ${formatModelYears(model)}`"
                            >
                                {{ formatModelLabel(model) }}
                            </span>
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
