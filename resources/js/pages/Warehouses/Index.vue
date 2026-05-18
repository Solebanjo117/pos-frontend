<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { useWarehouses } from '@/composables/useWarehouses';
import type { WarehouseFilters } from '@/types/warehouse';
import { usePosSettings } from '@/composables/usePosSettings';
import { CheckCircle } from 'lucide-vue-next';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Almacenes', href: '/warehouses' },
];

const {
    warehouses,
    loading,
    error,
    currentPage,
    lastPage,
    total,
    fetchWarehouses,
    nextPage,
    prevPage,
    deleteWarehouse,
} = useWarehouses();

const { currentWarehouseId, setWarehouse, initWarehouse } = usePosSettings();

// Filters
const filters = ref<WarehouseFilters>({
    search: '',
    status: undefined,
});

// Fetch warehouses on mount
onMounted(async () => {
    await initWarehouse();
    await fetchWarehouses(filters.value);
});

// Apply filters
const applyFilters = async () => {
    await fetchWarehouses(filters.value);
};

// Clear filters
const clearFilters = () => {
    filters.value = {
        search: '',
        status: undefined,
    };
    applyFilters();
};

// Delete handler
const handleDelete = async (id: number, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el almacén "${name}"?`)) {
        try {
            await deleteWarehouse(id);
        } catch (err: any) {
            // Error already handled in composable
        }
    }
};

// Get status color
const getStatusColor = (status: string) => {
    return status === 'active'
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        : 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-200';
};

// Get status label
const getStatusLabel = (status: string) => {
    return status === 'active' ? 'Activo' : 'Inactivo';
};

// Format utilization
const formatUtilization = (warehouse: any) => {
    if (!warehouse.capacity || !warehouse.total_units) return 'N/A';
    return `${warehouse.utilization_percentage}%`;
};
</script>

<template>
    <Head title="Almacenes" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-8 flex items-center justify-between">
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Almacenes
                    </h1>
                    <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        Gestiona los almacenes y ubicaciones del sistema
                    </p>
                </div>
                <a
                    href="/warehouses/create"
                    class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    Nuevo Almacén
                </a>
            </div>

            <!-- Filters -->
            <div
                class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-card dark:shadow-gray-900/50"
            >
                <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
                        >
                            Buscar
                        </label>
                        <input
                            v-model="filters.search"
                            type="text"
                            placeholder="Nombre, código o ubicación..."
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white dark:placeholder-gray-400"
                            @keyup.enter="applyFilters"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
                        >
                            Estado
                        </label>
                        <select
                            v-model="filters.status"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="undefined">Todos</option>
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                        </select>
                    </div>

                    <div class="flex items-end gap-2">
                        <button
                            @click="applyFilters"
                            class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 dark:focus:ring-offset-gray-800"
                        >
                            Filtrar
                        </button>
                        <button
                            @click="clearFilters"
                            class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-offset-gray-800"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="py-12 text-center">
                <div
                    class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent dark:border-primary"
                ></div>
                <p class="mt-2 text-gray-800 dark:text-gray-200">
                    Cargando almacenes...
                </p>
            </div>

            <!-- Error State -->
            <div
                v-else-if="error"
                class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200"
            >
                <p>{{ error }}</p>
            </div>

            <!-- Warehouses Table -->
            <div
                v-else-if="warehouses.length > 0"
                class="overflow-hidden rounded-lg bg-white shadow dark:bg-card"
            >
                <table
                    class="min-w-full divide-y divide-gray-200 dark:divide-border"
                >
                    <thead class="bg-gray-50 dark:bg-muted">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                            >
                                Código
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                            >
                                Nombre
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                            >
                                Ubicación
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                            >
                                Capacidad
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                            >
                                Uso
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                            >
                                Estado
                            </th>
                            <th
                                class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody
                        class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                    >
                        <tr
                            v-for="warehouse in warehouses"
                            :key="warehouse.id"
                            class="hover:bg-gray-50 dark:hover:bg-muted/50"
                        >
                            <td
                                class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white"
                            >
                                {{ warehouse.code }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm text-gray-900 dark:text-white"
                            >
                                {{ warehouse.name }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                            >
                                {{ warehouse.location || 'N/A' }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                            >
                                {{ warehouse.capacity || 'N/A' }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                            >
                                {{ formatUtilization(warehouse) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span
                                    :class="getStatusColor(warehouse.status)"
                                    class="inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold"
                                >
                                    {{ getStatusLabel(warehouse.status) }}
                                </span>
                            </td>
                            <td
                                class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap"
                            >
                                <a
                                    :href="`/warehouses/${warehouse.id}`"
                                    class="mr-3 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:text-primary dark:hover:text-blue-300"
                                >
                                    Ver
                                </a>
                                <button
                                    v-if="currentWarehouseId !== warehouse.id"
                                    @click="setWarehouse(warehouse.id)"
                                    class="mr-3 font-medium text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                >
                                    Seleccionar
                                </button>
                                <span
                                    v-else
                                    class="mr-3 inline-flex items-center text-sm font-bold text-green-700 dark:text-green-400"
                                >
                                    <CheckCircle class="mr-1 h-4 w-4" /> Activo
                                </span>
                                <a
                                    :href="`/warehouses/${warehouse.id}/edit`"
                                    class="mr-3 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:text-primary dark:hover:text-indigo-300"
                                >
                                    Editar
                                </a>
                                <button
                                    @click="
                                        handleDelete(
                                            warehouse.id,
                                            warehouse.name,
                                        )
                                    "
                                    class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Pagination -->
                <div
                    class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-border dark:bg-card"
                >
                    <div class="flex flex-1 justify-between sm:hidden">
                        <button
                            @click="prevPage(filters)"
                            :disabled="currentPage === 1"
                            class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Anterior
                        </button>
                        <button
                            @click="nextPage(filters)"
                            :disabled="currentPage === lastPage"
                            class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                        >
                            Siguiente
                        </button>
                    </div>
                    <div
                        class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between"
                    >
                        <div>
                            <p class="text-sm text-gray-900 dark:text-white">
                                Mostrando
                                <span class="font-medium">{{
                                    (currentPage - 1) * 20 + 1
                                }}</span>
                                a
                                <span class="font-medium">{{
                                    Math.min(currentPage * 20, total)
                                }}</span>
                                de
                                <span class="font-medium">{{ total }}</span>
                                almacenes
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <button
                                @click="prevPage(filters)"
                                :disabled="currentPage === 1"
                                class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                            >
                                Anterior
                            </button>
                            <span
                                class="flex items-center px-4 text-sm text-gray-900 dark:text-white"
                            >
                                Página {{ currentPage }} de {{ lastPage }}
                            </span>
                            <button
                                @click="nextPage(filters)"
                                :disabled="currentPage === lastPage"
                                class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div
                v-else
                class="rounded-lg bg-white py-12 text-center shadow dark:bg-card"
            >
                <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                </svg>
                <h3
                    class="mt-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                    No hay almacenes
                </h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Comienza creando un nuevo almacén.
                </p>
                <div class="mt-6">
                    <a
                        href="/warehouses/create"
                        class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        Nuevo Almacén
                    </a>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
