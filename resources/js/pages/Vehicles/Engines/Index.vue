<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleEngines } from '@/composables/useVehicleEngines'
import { useVehicleMakes } from '@/composables/useVehicleMakes'
import { useVehicleModels } from '@/composables/useVehicleModels'
import { Search, Plus, Pencil, Trash2, X } from 'lucide-vue-next'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles' },
    { title: 'Motores', href: '/vehicles/engines' },
]

const { engines, loading, fetchEngines, deleteEngine } = useVehicleEngines()
const { makes, fetchMakes } = useVehicleMakes()
const { models, fetchModels } = useVehicleModels()

const search = ref('')
const page = ref(1)
const total = ref(0)
const perPage = ref(15)

// Filters
const selectedMakeId = ref<number | undefined>(undefined)
const selectedModelId = ref<number | undefined>(undefined)

const loadData = async () => {
    const params: Record<string, any> = {
        page: page.value,
        search: search.value,
        per_page: perPage.value,
    }
    if (selectedMakeId.value) params.make_id = selectedMakeId.value
    if (selectedModelId.value) params.model_id = selectedModelId.value

    const data = await fetchEngines(params)
    total.value = data.meta.total
    perPage.value = data.meta.per_page
}

onMounted(async () => {
    await fetchMakes()
    loadData()
})

// Debounce search
let timeout: ReturnType<typeof setTimeout>
watch(search, () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
        page.value = 1
        loadData()
    }, 300)
})

// When make changes, load models and reload engines
watch(selectedMakeId, async (makeId) => {
    selectedModelId.value = undefined
    if (makeId) {
        await fetchModels({ make_id: makeId, per_page: 200 })
    } else {
        models.value = []
    }
    page.value = 1
    loadData()
})

// When model changes reload engines
watch(selectedModelId, () => {
    page.value = 1
    loadData()
})

const clearFilters = () => {
    selectedMakeId.value = undefined
    selectedModelId.value = undefined
    search.value = ''
}

const hasActiveFilters = () => {
    return !!selectedMakeId.value || !!selectedModelId.value || !!search.value
}

const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este motor?')) {
        await deleteEngine(id)
        loadData()
    }
}

const changePage = (newPage: number) => {
    page.value = newPage
    loadData()
}

const fuelTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
        'Gasoline': 'Gasolina',
        'Diesel': 'Diesel',
        'Hybrid': 'Híbrido',
        'Electric': 'Eléctrico',
    }
    return labels[type] || type
}
</script>

<template>
    <Head title="Motores" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-6xl space-y-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Motores</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Catálogo de motores reutilizables para asignar a vehículos
                    </p>
                </div>
                <Link
                    href="/vehicles/engines/create"
                    class="flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-white hover:bg-blue-700 dark:hover:bg-primary/90"
                >
                    <Plus class="h-5 w-5" />
                    Nuevo Motor
                </Link>
            </div>

            <!-- Search + Filters -->
            <div class="rounded-lg bg-white p-4 shadow dark:bg-card space-y-4">
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                        v-model="search"
                        type="text"
                        placeholder="Buscar por código o desplazamiento..."
                        class="w-full rounded-md border border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                    />
                </div>

                <!-- Make / Model filters -->
                <div class="flex flex-wrap items-end gap-4">
                    <div class="flex-1 min-w-[180px]">
                        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Marca Vehículo</label>
                        <select
                            v-model="selectedMakeId"
                            class="w-full rounded-md border border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="undefined">Todas las marcas</option>
                            <option v-for="make in makes" :key="make.id" :value="make.id">{{ make.name }}</option>
                        </select>
                    </div>
                    <div class="flex-1 min-w-[180px]">
                        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Modelo</label>
                        <select
                            v-model="selectedModelId"
                            :disabled="!selectedMakeId"
                            class="w-full rounded-md border border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white disabled:opacity-50"
                        >
                            <option :value="undefined">Todos los modelos</option>
                            <option v-for="model in models" :key="model.id" :value="model.id">
                                {{ model.name }}
                                <template v-if="model.year_from"> ({{ model.year_from }}<template v-if="model.year_to">–{{ model.year_to }}</template>)</template>
                            </option>
                        </select>
                    </div>
                    <button
                        v-if="hasActiveFilters()"
                        @click="clearFilters"
                        class="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        <X class="h-4 w-4" />
                        Limpiar
                    </button>
                </div>
            </div>

            <!-- Data Table -->
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-card">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                    <thead class="bg-gray-50 dark:bg-muted">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Código Motor
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Marca / Modelo
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Desplazamiento
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Combustible
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-if="loading" class="animate-pulse">
                            <td colspan="5" class="px-6 py-4 text-center text-gray-500">Cargando...</td>
                        </tr>
                        <tr v-else-if="engines.length === 0">
                            <td colspan="5" class="px-6 py-4 text-center text-gray-500">No se encontraron motores</td>
                        </tr>
                        <tr
                            v-for="engine in engines"
                            :key="engine.id"
                            class="hover:bg-gray-50 dark:hover:bg-muted/50"
                        >
                            <td class="whitespace-nowrap px-6 py-4 font-mono text-sm font-semibold text-gray-900 dark:text-white">
                                {{ engine.engine_code }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                <template v-if="engine.model?.make?.name || engine.model?.name">
                                    <span class="font-medium">{{ engine.model?.make?.name ?? '—' }}</span>
                                    <span class="text-gray-400 mx-1">/</span>
                                    <span>{{ engine.model?.name ?? '—' }}</span>
                                </template>
                                <span v-else class="text-gray-400 italic">Sin modelo</span>
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-900 dark:text-white">
                                {{ engine.displacement || '—' }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500 dark:text-gray-300">
                                {{ fuelTypeLabel(engine.fuel_type) }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <Link
                                        :href="`/vehicles/engines/${engine.id}/edit`"
                                        class="rounded p-1 text-blue-600 dark:text-primary hover:bg-blue-50 dark:hover:bg-muted"
                                    >
                                        <Pencil class="h-5 w-5" />
                                    </Link>
                                    <button
                                        @click="handleDelete(engine.id)"
                                        class="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-muted"
                                    >
                                        <Trash2 class="h-5 w-5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Pagination -->
                <div v-if="total > perPage" class="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-border">
                    <button
                        :disabled="page === 1"
                        @click="changePage(page - 1)"
                        class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        Anterior
                    </button>
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                        Página {{ page }}
                    </span>
                    <button
                        :disabled="page * perPage >= total"
                        @click="changePage(page + 1)"
                        class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
