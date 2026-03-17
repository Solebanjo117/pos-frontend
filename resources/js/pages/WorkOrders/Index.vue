<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useWorkOrders } from '@/composables/useWorkOrders'
import { Plus, Search, Wrench } from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

const { workOrders, loading, error, total, fetchWorkOrders } = useWorkOrders()

const statusFilter = ref('')
const searchQuery = ref('')

const STATUSES = [
    { value: '',            label: 'Todos los estados' },
    { value: 'pending',     label: 'Pendiente' },
    { value: 'in_progress', label: 'En progreso' },
    { value: 'done',        label: 'Terminado' },
    { value: 'delivered',   label: 'Entregado' },
    { value: 'cancelled',   label: 'Cancelado' },
]

const STATUS_LABELS: Record<string, string> = {
    pending:     'Pendiente',
    in_progress: 'En progreso',
    done:        'Terminado',
    delivered:   'Entregado',
    cancelled:   'Cancelado',
}

const STATUS_CLASSES: Record<string, string> = {
    pending:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    done:        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    delivered:   'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    cancelled:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const applyFilters = () => {
    fetchWorkOrders({
        status: statusFilter.value || undefined,
        search: searchQuery.value || undefined,
    })
}

onMounted(() => {
    fetchWorkOrders()
})

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
</script>

<template>
    <Head title="Órdenes de Trabajo" />

    <div class="p-6 space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <Wrench class="text-primary" :size="24" />
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Trabajo</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ total }} orden{{ total !== 1 ? 'es' : '' }} en total
                    </p>
                </div>
            </div>
            <button
                class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition"
                disabled
                title="Próximamente"
            >
                <Plus :size="18" />
                Nueva orden de trabajo
            </button>
        </div>

        <!-- Filters -->
        <div class="flex flex-col sm:flex-row gap-3">
            <!-- Search -->
            <div class="relative flex-1">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Buscar por folio o vehículo..."
                    class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    @input="applyFilters"
                />
            </div>
            <!-- Status filter -->
            <select
                v-model="statusFilter"
                class="px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                @change="applyFilters"
            >
                <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
        </div>

        <!-- Error -->
        <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {{ error }}
        </div>

        <!-- Table -->
        <div class="bg-white dark:bg-card rounded-xl shadow border border-gray-200 dark:border-border overflow-hidden">
            <!-- Loading -->
            <div v-if="loading" class="flex justify-center items-center py-16 text-gray-400">
                <svg class="animate-spin h-8 w-8 text-indigo-500 mr-3" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Cargando órdenes...
            </div>

            <!-- Empty state -->
            <div v-else-if="workOrders.length === 0" class="flex flex-col items-center py-16 text-gray-400 dark:text-gray-500">
                <Wrench :size="40" class="mb-3 opacity-40" />
                <p class="text-lg font-medium">No hay órdenes de trabajo</p>
                <p class="text-sm mt-1">Crea la primera usando el botón superior.</p>
            </div>

            <!-- Data table -->
            <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-border">
                <thead class="bg-gray-50 dark:bg-background">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Folio</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vehículo</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sucursal</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                    <tr
                        v-for="wo in workOrders"
                        :key="wo.id"
                        class="hover:bg-gray-50 dark:hover:bg-muted/40 transition-colors"
                    >
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900 dark:text-white">
                            {{ wo.folio }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                            {{ wo.vehicle_description ?? '—' }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span
                                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                :class="STATUS_CLASSES[wo.status]"
                            >
                                {{ STATUS_LABELS[wo.status] ?? wo.status }}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                            {{ wo.warehouse?.name ?? `#${wo.warehouse_id}` }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {{ formatDate(wo.created_at) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
