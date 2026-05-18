<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useWorkOrders } from '@/composables/useWorkOrders';
import { Plus, Search, Wrench } from 'lucide-vue-next';

defineOptions({ layout: AppLayout });

const { workOrders, loading, error, total, fetchWorkOrders } = useWorkOrders();

const statusFilter = ref('');
const searchQuery = ref('');

const STATUSES = [
    { value: '', label: 'Todos los estados' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'in_progress', label: 'En progreso' },
    { value: 'done', label: 'Terminado' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'cancelled', label: 'Cancelado' },
];

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    done: 'Terminado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
};

const STATUS_CLASSES: Record<string, string> = {
    pending:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    in_progress:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    delivered:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const applyFilters = () => {
    fetchWorkOrders({
        status: statusFilter.value || undefined,
        search: searchQuery.value || undefined,
    });
};

onMounted(() => {
    fetchWorkOrders();
});

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
</script>

<template>
    <Head title="Órdenes de Trabajo" />

    <div class="space-y-6 p-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <Wrench class="text-primary" :size="24" />
                <div>
                    <h1
                        class="text-2xl font-bold text-gray-900 dark:text-white"
                    >
                        Órdenes de Trabajo
                    </h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ total }} orden{{ total !== 1 ? 'es' : '' }} en total
                    </p>
                </div>
            </div>
            <button
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                disabled
                title="Próximamente"
            >
                <Plus :size="18" />
                Nueva orden de trabajo
            </button>
        </div>

        <!-- Filters -->
        <div class="flex flex-col gap-3 sm:flex-row">
            <!-- Search -->
            <div class="relative flex-1">
                <Search
                    class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
                    :size="18"
                />
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Buscar por folio o vehículo..."
                    class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-background dark:text-white"
                    @input="applyFilters"
                />
            </div>
            <!-- Status filter -->
            <select
                v-model="statusFilter"
                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-background dark:text-white"
                @change="applyFilters"
            >
                <option v-for="s in STATUSES" :key="s.value" :value="s.value">
                    {{ s.label }}
                </option>
            </select>
        </div>

        <!-- Error -->
        <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
            {{ error }}
        </div>

        <!-- Table -->
        <div
            class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow dark:border-border dark:bg-card"
        >
            <!-- Loading -->
            <div
                v-if="loading"
                class="flex items-center justify-center py-16 text-gray-400"
            >
                <svg
                    class="mr-3 h-8 w-8 animate-spin text-indigo-500"
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    />
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                    />
                </svg>
                Cargando órdenes...
            </div>

            <!-- Empty state -->
            <div
                v-else-if="workOrders.length === 0"
                class="flex flex-col items-center py-16 text-gray-400 dark:text-gray-500"
            >
                <Wrench :size="40" class="mb-3 opacity-40" />
                <p class="text-lg font-medium">No hay órdenes de trabajo</p>
                <p class="mt-1 text-sm">
                    Crea la primera usando el botón superior.
                </p>
            </div>

            <!-- Data table -->
            <table
                v-else
                class="min-w-full divide-y divide-gray-200 dark:divide-border"
            >
                <thead class="bg-gray-50 dark:bg-background">
                    <tr>
                        <th
                            class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Folio
                        </th>
                        <th
                            class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Vehículo
                        </th>
                        <th
                            class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Estado
                        </th>
                        <th
                            class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Sucursal
                        </th>
                        <th
                            class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Fecha
                        </th>
                    </tr>
                </thead>
                <tbody
                    class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                >
                    <tr
                        v-for="wo in workOrders"
                        :key="wo.id"
                        class="transition-colors hover:bg-gray-50 dark:hover:bg-muted/40"
                    >
                        <td
                            class="px-6 py-4 font-mono text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white"
                        >
                            {{ wo.folio }}
                        </td>
                        <td
                            class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                        >
                            {{ wo.vehicle_description ?? '—' }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span
                                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                                :class="STATUS_CLASSES[wo.status]"
                            >
                                {{ STATUS_LABELS[wo.status] ?? wo.status }}
                            </span>
                        </td>
                        <td
                            class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                        >
                            {{ wo.warehouse?.name ?? `#${wo.warehouse_id}` }}
                        </td>
                        <td
                            class="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400"
                        >
                            {{ formatDate(wo.created_at) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
