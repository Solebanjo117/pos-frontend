<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useVehicleMakes } from '@/composables/useVehicleMakes'
import { Search, Plus, Pencil, Trash2 } from 'lucide-vue-next'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' },
    { title: 'Marcas', href: '/vehicles/makes' },
]

const { makes, loading, fetchMakes, deleteMake } = useVehicleMakes()
const search = ref('')
const page = ref(1)
const total = ref(0)
const perPage = ref(15)

const loadData = async () => {
    const data = await fetchMakes({
        page: page.value,
        search: search.value,
        per_page: perPage.value
    })
    total.value = data.meta.total
    perPage.value = data.meta.per_page
}

// Debounce search
let timeout: ReturnType<typeof setTimeout>
watch(search, () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
        page.value = 1
        loadData()
    }, 300)
})

const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar esta marca?')) {
        await deleteMake(id)
        loadData()
    }
}

const changePage = (newPage: number) => {
    page.value = newPage
    loadData()
}

onMounted(() => {
    loadData()
})
</script>

<template>
    <Head title="Marcas de Vehículos" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-7xl space-y-6 p-6">
            <div class="flex items-center justify-between">
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Marcas de Vehículos</h1>
                <Link
                    href="/vehicles/makes/create"
                    class="flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-white hover:bg-blue-700 dark:hover:bg-primary/90"
                >
                    <Plus class="h-5 w-5" />
                    Nueva Marca
                </Link>
            </div>

            <!-- Search and Filter -->
            <div class="flex items-center gap-4 rounded-lg bg-white p-4 shadow dark:bg-card">
                <div class="relative flex-1">
                    <Search class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                        v-model="search"
                        type="text"
                        placeholder="Buscar marcas..."
                        class="w-full rounded-md border border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                    />
                </div>
            </div>

            <!-- Data Table -->
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-card">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                    <thead class="bg-gray-50 dark:bg-muted">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Nombre
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Modelos Asociados
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-if="loading" class="animate-pulse">
                            <td colspan="3" class="px-6 py-4 text-center text-gray-500">Cargando...</td>
                        </tr>
                        <tr v-else-if="makes.length === 0">
                            <td colspan="3" class="px-6 py-4 text-center text-gray-500">No se encontraron marcas</td>
                        </tr>
                        <tr
                            v-for="make in makes"
                            :key="make.id"
                            class="hover:bg-gray-50 dark:hover:bg-muted/50"
                        >
                            <td class="whitespace-nowrap px-6 py-4 text-gray-900 dark:text-white">
                                {{ make.name }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500 dark:text-gray-300">
                                <span class="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                    {{ make.models_count || 0 }} modelos
                                </span>
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <Link
                                        :href="`/vehicles/makes/${make.id}/edit`"
                                        class="rounded p-1 text-blue-600 dark:text-primary hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-muted"
                                    >
                                        <Pencil class="h-5 w-5" />
                                    </Link>
                                    <button
                                        @click="handleDelete(make.id)"
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
