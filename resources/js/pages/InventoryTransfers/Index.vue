<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    ArrowLeftRight,
    Plus,
    Truck,
    PackageCheck,
    XCircle,
    Clock,
    Building2,
    Eye,
} from 'lucide-vue-next';
import { ref, onMounted, computed } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Transferencias', href: '/inventory-transfers' },
];

interface Transfer {
    id: number;
    reference: string;
    from_warehouse: { id: number; name: string };
    to_warehouse: { id: number; name: string };
    status: string;
    created_at: string;
    dispatched_at: string | null;
    received_at: string | null;
    creator: { id: number; name: string };
    items: any[];
}

const transfers = ref<Transfer[]>([]);
const loading = ref(false);
const statusFilter = ref('');

const fetchTransfers = async () => {
    loading.value = true;
    try {
        const params: any = {};
        if (statusFilter.value) params.status = statusFilter.value;
        const res = await apiClient.get('/inventory-transfers', { params });
        transfers.value = res.data.data || res.data || [];
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchTransfers);

const statusBadge = (status: string) => {
    const map: Record<string, { class: string; label: string }> = {
        draft: { class: 'bg-gray-100 text-gray-700', label: 'Borrador' },
        in_transit: {
            class: 'bg-yellow-100 text-yellow-700',
            label: 'En Tránsito',
        },
        completed: {
            class: 'bg-green-100 text-green-700',
            label: 'Completada',
        },
        cancelled: { class: 'bg-red-100 text-red-700', label: 'Cancelada' },
    };
    return map[status] || { class: 'bg-gray-100 text-gray-700', label: status };
};

const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const totalItems = (items: any[]) =>
    items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;
</script>

<template>
    <Head title="Transferencias de Inventario" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-6 p-4">
            <!-- Header -->
            <div
                class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
            >
                <div>
                    <h1
                        class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        <ArrowLeftRight :size="32" class="text-indigo-500" />
                        Transferencias de Inventario
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Enviar y recibir mercancía entre sucursales
                    </p>
                </div>
                <a
                    href="/inventory-transfers/create"
                    class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Plus :size="16" />
                    Nueva Transferencia
                </a>
            </div>

            <!-- Filters -->
            <div class="flex gap-3">
                <select
                    v-model="statusFilter"
                    @change="fetchTransfers"
                    class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-gray-200"
                >
                    <option value="">Todos los estados</option>
                    <option value="draft">Borrador</option>
                    <option value="in_transit">En Tránsito</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                </select>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="py-12 text-center text-gray-500">
                Cargando...
            </div>

            <!-- Empty -->
            <div v-else-if="transfers.length === 0" class="py-12 text-center">
                <ArrowLeftRight :size="48" class="mx-auto mb-4 text-gray-300" />
                <p class="text-gray-500">No hay transferencias registradas</p>
            </div>

            <!-- Table -->
            <div
                v-else
                class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
            >
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-muted/50">
                        <tr>
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300"
                            >
                                Referencia
                            </th>
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300"
                            >
                                Origen → Destino
                            </th>
                            <th
                                class="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300"
                            >
                                Items
                            </th>
                            <th
                                class="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300"
                            >
                                Estado
                            </th>
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300"
                            >
                                Fecha
                            </th>
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300"
                            >
                                Creado por
                            </th>
                            <th
                                class="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-border">
                        <tr
                            v-for="t in transfers"
                            :key="t.id"
                            class="dark:hover:bg-muted/50/30 transition-colors hover:bg-gray-50"
                        >
                            <td
                                class="px-4 py-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400 dark:text-primary"
                            >
                                {{ t.reference }}
                            </td>
                            <td class="px-4 py-3">
                                <div
                                    class="flex items-center gap-1 text-gray-700 dark:text-gray-300"
                                >
                                    <Building2
                                        :size="14"
                                        class="text-red-400"
                                    />
                                    <span>{{ t.from_warehouse?.name }}</span>
                                    <span class="mx-1 text-gray-400">→</span>
                                    <Building2
                                        :size="14"
                                        class="text-green-400"
                                    />
                                    <span>{{ t.to_warehouse?.name }}</span>
                                </div>
                            </td>
                            <td
                                class="px-4 py-3 text-center text-gray-700 dark:text-gray-300"
                            >
                                {{ totalItems(t.items) }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span
                                    :class="statusBadge(t.status).class"
                                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                >
                                    <Truck
                                        v-if="t.status === 'in_transit'"
                                        :size="12"
                                    />
                                    <PackageCheck
                                        v-if="t.status === 'completed'"
                                        :size="12"
                                    />
                                    <Clock
                                        v-if="t.status === 'draft'"
                                        :size="12"
                                    />
                                    <XCircle
                                        v-if="t.status === 'cancelled'"
                                        :size="12"
                                    />
                                    {{ statusBadge(t.status).label }}
                                </span>
                            </td>
                            <td
                                class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400"
                            >
                                {{ formatDate(t.created_at) }}
                            </td>
                            <td
                                class="px-4 py-3 text-gray-700 dark:text-gray-300"
                            >
                                {{ t.creator?.name }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                <a
                                    :href="`/inventory-transfers/${t.id}`"
                                    class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:text-primary"
                                >
                                    <Eye :size="16" />
                                </a>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </AppLayout>
</template>
