<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleEngines } from '@/composables/useVehicleEngines'
import { useVehicleVins } from '@/composables/useVehicleVins'
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
    { title: 'Vehiculos', href: '/vehicles' },
    { title: 'Motores', href: '/vehicles/engines' },
    { title: 'Crear', href: '/vehicles/engines/create' },
]

const { engines, createEngine, fetchEngines, loading, error } = useVehicleEngines()

const form = ref({
    engine_code: '',
    displacement: '',
    fuel_type: 'Gasoline',
    model_ids: [] as number[],
})

const pendingVins = ref<string[]>([])
const newVinInput = ref('')
const vinQueueError = ref<string | null>(null)

const addPendingVin = () => {
    const normalized = newVinInput.value.trim().toUpperCase()

    if (normalized.length < 1 || normalized.length > 40) {
        vinQueueError.value = 'Cada VIN debe tener entre 1 y 40 caracteres.'
        return
    }

    if (pendingVins.value.includes(normalized)) {
        vinQueueError.value = 'Este VIN ya esta en la cola.'
        return
    }

    pendingVins.value.push(normalized)
    newVinInput.value = ''
    vinQueueError.value = null
}

const removePendingVin = (vin: string) => {
    pendingVins.value = pendingVins.value.filter(item => item !== vin)
}

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
    fetchEngines({ per_page: 500 }) // Duplicate code guard
})

const duplicateConfirmed = ref(false)

const checkDuplicate = (code: string): boolean => {
    return engines.value.some((engine) =>
        engine.engine_code.toLowerCase().trim() === code.toLowerCase().trim()
    )
}

const handleSubmit = async () => {
    if (!duplicateConfirmed.value && checkDuplicate(form.value.engine_code)) {
        const confirm = window.confirm(
            `Ya existe un motor con el codigo "${form.value.engine_code}".\n\nDesea crear un motor duplicado?`
        )
        if (!confirm) return
        duplicateConfirmed.value = true
    }

    const uniqueModelIds = Array.from(new Set(form.value.model_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))))

    try {
        const createdEngine = await createEngine({
            engine_code: form.value.engine_code,
            displacement: form.value.displacement || undefined,
            fuel_type: form.value.fuel_type,
            model_id: uniqueModelIds[0] ?? null,
            model_ids: uniqueModelIds,
            aspiration: 'N/A',
        })

        if (pendingVins.value.length > 0) {
            const vinApi = useVehicleVins({ engineId: createdEngine.id })
            const failed: string[] = []

            for (const vin of pendingVins.value) {
                try {
                    await vinApi.addVin(vin)
                } catch {
                    failed.push(vin)
                }
            }

            if (failed.length > 0) {
                window.alert(`Motor creado, pero no se pudieron guardar ${failed.length} VIN(s): ${failed.join(', ')}`)
                router.visit(`/vehicles/engines/${createdEngine.id}/edit`)
                return
            }
        }

        router.visit('/vehicles/engines')
    } catch {
        duplicateConfirmed.value = false
    }
}
</script>

<template>
    <Head title="Crear Motor" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-3xl space-y-6 p-6">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Crear Nuevo Motor</h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Los motores son reutilizables y pueden asociarse a compatibilidad vehicular.
                </p>
            </div>

            <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {{ error }}
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Codigo de Motor <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="form.engine_code"
                            type="text"
                            required
                            placeholder="Ej: 2ZR-FE, K20A, 1GR-FE"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm font-mono focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                        <p class="mt-1 text-xs text-gray-500">Codigo unico que identifica este motor.</p>
                    </div>

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
                            <option value="Hybrid">Hibrido</option>
                            <option value="Electric">Electrico</option>
                        </select>
                    </div>

                    <div class="space-y-3 rounded-md border border-gray-200 p-3 dark:border-border">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                VINs del motor (opcional)
                            </label>
                            <p class="mt-1 text-xs text-gray-500">Se guardaran automaticamente despues de crear el motor.</p>
                        </div>

                        <div class="flex gap-2">
                            <input
                                v-model="newVinInput"
                                type="text"
                                maxlength="40"
                                placeholder="VIN (hasta 40 caracteres)"
                                class="flex-1 rounded-md border-gray-300 font-mono text-sm uppercase shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                @keyup.enter.prevent="addPendingVin"
                            />
                            <button
                                type="button"
                                class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-border dark:hover:bg-muted"
                                @click="addPendingVin"
                            >
                                Agregar
                            </button>
                        </div>

                        <p v-if="vinQueueError" class="text-xs text-red-600">{{ vinQueueError }}</p>

                        <div v-if="pendingVins.length === 0" class="text-xs text-gray-400">Sin VINs en cola.</div>
                        <ul v-else class="max-h-36 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 dark:divide-border dark:border-border">
                            <li
                                v-for="vin in pendingVins"
                                :key="vin"
                                class="flex items-center justify-between px-3 py-1.5"
                            >
                                <span class="font-mono text-xs tracking-wide text-gray-800 dark:text-gray-200">{{ vin }}</span>
                                <button
                                    type="button"
                                    class="text-xs text-red-500 hover:text-red-700"
                                    @click="removePendingVin(vin)"
                                >
                                    Quitar
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Modelos asociados (opcional)
                            </label>
                            <p class="mt-1 text-xs text-gray-500">Puedes asociar este motor a uno o varios modelos, incluso de diferentes marcas.</p>
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
                                            Anos: {{ formatModelYears(model) }}
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

                    <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-border">
                        <Link
                            href="/vehicles/engines"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading || !form.engine_code"
                            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            {{ loading ? 'Guardando...' : 'Guardar Motor' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
