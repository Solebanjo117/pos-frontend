<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleModels } from '@/composables/useVehicleModels'
import { useVehicleMakes } from '@/composables/useVehicleMakes'
import { Search, Plus, Pencil, Trash2, Filter } from 'lucide-vue-next'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' }, // Parent section
    { title: 'Modelos', href: '/vehicles/models' },
]

const { models, loading, fetchModels, deleteModel } = useVehicleModels()
const { makes, fetchMakes } = useVehicleMakes() // For filter dropdown

const search = ref('')
const selectedMakeId = ref<number | undefined>(undefined)
const page = ref(1)
const total = ref(0)
const perPage = ref(15)

const loadData = async () => {
    const data = await fetchModels({
        page: page.value,
        search: search.value,
        per_page: perPage.value,
        make_id: selectedMakeId.value
    })
    total.value = data.meta.total
    perPage.value = data.meta.per_page
}

// Load Makes for filter
const loadMakes = async () => {
    await fetchMakes({ per_page: 100 }) // Fetch enough makes for dropdown
}

// Debounce search
let timeout: ReturnType<typeof setTimeout>
watch([search, selectedMakeId], () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
        page.value = 1
        loadData()
    }, 300)
})

const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este modelo?')) {
        await deleteModel(id)
        loadData()
    }
}

const changePage = (newPage: number) => {
    page.value = newPage
    loadData()
}

onMounted(() => {
    loadData()
    loadMakes()
})
</script>

<template>
    <Head title="Modelos de Vehículos" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-7xl space-y-6 p-6">
            <div class="flex items-center justify-between">
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Modelos de Vehículos</h1>
                <Link
                    href="/vehicles/models/create"
                    class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                    <Plus class="h-5 w-5" />
                    Nuevo Modelo
                </Link>
            </div>

            <!-- Search and Filter -->
            <div class="flex flex-col gap-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:flex-row">
                <!-- Search -->
                <div class="relative flex-1">
                    <Search class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                        v-model="search"
                        type="text"
                        placeholder="Buscar modelos..."
                        class="w-full rounded-md border border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <!-- Make Filter -->
                <div class="relative w-full md:w-64">
                    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Filter class="h-4 w-4" />
                    </div>
                    <select
                        v-model="selectedMakeId"
                        class="w-full rounded-md border border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                        <option :value="undefined">Todas las Marcas</option>
                        <option v-for="make in makes" :key="make.id" :value="make.id">
                            {{ make.name }}
                        </option>
                    </select>
                </div>
            </div>

            <!-- Data Table -->
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Marca
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Modelo
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Motores Asociados
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr v-if="loading" class="animate-pulse">
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">Cargando...</td>
                        </tr>
                        <tr v-else-if="models.length === 0">
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">No se encontraron modelos</td>
                        </tr>
                        <tr
                            v-for="carModel in models"
                            :key="carModel.id"
                            class="hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            <td class="whitespace-nowrap px-6 py-4 text-gray-900 dark:text-white">
                                <span class="font-medium">{{ carModel.make?.name }}</span>
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-900 dark:text-white">
                                {{ carModel.name }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500 dark:text-gray-300">
                                <span class="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                    {{ carModel.engines_count || 0 }} motores
                                </span>
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <Link
                                        :href="`/vehicles/models/${carModel.id}/edit`"
                                        class="rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-gray-600"
                                    >
                                        <Pencil class="h-5 w-5" />
                                    </Link>
                                    <button
                                        @click="handleDelete(carModel.id)"
                                        class="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-600"
                                    >
                                        <Trash2 class="h-5 w-5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Pagination -->
                <div v-if="total > perPage" class="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-700">
                    <button
                        :disabled="page === 1"
                        @click="changePage(page - 1)"
                        class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Anterior
                    </button>
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                        Página {{ page }}
                    </span>
                    <button
                        :disabled="page * perPage >= total"
                        @click="changePage(page + 1)"
                        class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
