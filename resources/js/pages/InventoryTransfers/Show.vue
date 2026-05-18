<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import {
    ArrowLeftRight,
    Truck,
    PackageCheck,
    XCircle,
    Clock,
    Building2,
    ArrowRight,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import apiClient from '@/services/api/client';

const props = defineProps<{ transferId: number }>();

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Transferencias', href: '/inventory-transfers' },
    { title: 'Detalle', href: '#' },
];

const transfer = ref<any>(null);
const loading = ref(true);
const actionLoading = ref(false);
const errorMsg = ref('');

onMounted(async () => {
    try {
        const res = await apiClient.get(
            `/inventory-transfers/${props.transferId}`,
        );
        transfer.value = res.data;
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
});

const statusBadge = (status: string) => {
    const map: Record<string, { class: string; label: string; icon: any }> = {
        draft: {
            class: 'bg-gray-100 text-gray-700 border-gray-300',
            label: 'Borrador',
            icon: Clock,
        },
        in_transit: {
            class: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            label: 'En Tránsito',
            icon: Truck,
        },
        completed: {
            class: 'bg-green-100 text-green-800 border-green-300',
            label: 'Completada',
            icon: PackageCheck,
        },
        cancelled: {
            class: 'bg-red-100 text-red-700 border-red-300',
            label: 'Cancelada',
            icon: XCircle,
        },
    };
    return map[status] || map.draft;
};

const handleDispatch = async () => {
    if (
        !confirm(
            '¿Despachar esta transferencia? Se descontará el stock del almacén origen.',
        )
    )
        return;
    actionLoading.value = true;
    errorMsg.value = '';
    try {
        const res = await apiClient.post(
            `/inventory-transfers/${props.transferId}/dispatch`,
        );
        transfer.value = res.data.transfer;
    } catch (e: any) {
        errorMsg.value = e.response?.data?.message || 'Error al despachar';
    } finally {
        actionLoading.value = false;
    }
};

const handleReceive = async () => {
    if (
        !confirm('¿Confirmar recepción? Se sumará el stock al almacén destino.')
    )
        return;
    actionLoading.value = true;
    errorMsg.value = '';
    try {
        const res = await apiClient.post(
            `/inventory-transfers/${props.transferId}/receive`,
        );
        transfer.value = res.data.transfer;
    } catch (e: any) {
        errorMsg.value = e.response?.data?.message || 'Error al recibir';
    } finally {
        actionLoading.value = false;
    }
};

const handleCancel = async () => {
    if (!confirm('¿Cancelar esta transferencia?')) return;
    actionLoading.value = true;
    errorMsg.value = '';
    try {
        const res = await apiClient.post(
            `/inventory-transfers/${props.transferId}/cancel`,
        );
        transfer.value = res.data.transfer;
    } catch (e: any) {
        errorMsg.value = e.response?.data?.message || 'Error al cancelar';
    } finally {
        actionLoading.value = false;
    }
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
</script>

<template>
    <Head :title="`Transferencia ${transfer?.reference || ''}`" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-4xl space-y-6 p-4">
            <div v-if="loading" class="py-12 text-center text-gray-500">
                Cargando...
            </div>

            <template v-else-if="transfer">
                <!-- Header -->
                <div
                    class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
                >
                    <div>
                        <div class="flex items-center gap-3">
                            <a
                                href="/inventory-transfers"
                                class="text-2xl text-gray-400 hover:text-gray-600"
                                >←</a
                            >
                            <h1
                                class="font-mono text-3xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ transfer.reference }}
                            </h1>
                            <span
                                :class="statusBadge(transfer.status).class"
                                class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium"
                            >
                                <component
                                    :is="statusBadge(transfer.status).icon"
                                    :size="14"
                                />
                                {{ statusBadge(transfer.status).label }}
                            </span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button
                            v-if="transfer.status === 'draft'"
                            @click="handleDispatch"
                            :disabled="actionLoading"
                            class="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-yellow-600 disabled:opacity-50"
                        >
                            <Truck :size="16" />
                            Despachar
                        </button>
                        <button
                            v-if="transfer.status === 'in_transit'"
                            @click="handleReceive"
                            :disabled="actionLoading"
                            class="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                        >
                            <PackageCheck :size="16" />
                            Recibir
                        </button>
                        <button
                            v-if="transfer.status === 'draft'"
                            @click="handleCancel"
                            :disabled="actionLoading"
                            class="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                            <XCircle :size="16" />
                            Cancelar
                        </button>
                    </div>
                </div>

                <!-- Error -->
                <div
                    v-if="errorMsg"
                    class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                >
                    {{ errorMsg }}
                </div>

                <!-- Info Cards -->
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <!-- Origin -->
                    <div
                        class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                    >
                        <div
                            class="mb-1 flex items-center gap-2 text-sm text-red-500"
                        >
                            <Building2 :size="16" />
                            Almacén Origen
                        </div>
                        <p
                            class="text-xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ transfer.from_warehouse?.name }}
                        </p>
                    </div>
                    <!-- Destination -->
                    <div
                        class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                    >
                        <div
                            class="mb-1 flex items-center gap-2 text-sm text-green-500"
                        >
                            <Building2 :size="16" />
                            Almacén Destino
                        </div>
                        <p
                            class="text-xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ transfer.to_warehouse?.name }}
                        </p>
                    </div>
                </div>

                <!-- Timeline -->
                <div
                    class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                >
                    <h3
                        class="mb-3 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Línea de Tiempo
                    </h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Creado por</span>
                            <span class="text-gray-900 dark:text-white"
                                >{{ transfer.creator?.name }} ·
                                {{ formatDate(transfer.created_at) }}</span
                            >
                        </div>
                        <div
                            v-if="transfer.dispatched_at"
                            class="flex justify-between"
                        >
                            <span class="text-gray-500">Despachado</span>
                            <span class="text-yellow-600">{{
                                formatDate(transfer.dispatched_at)
                            }}</span>
                        </div>
                        <div
                            v-if="transfer.received_at"
                            class="flex justify-between"
                        >
                            <span class="text-gray-500">Recibido por</span>
                            <span class="text-green-600"
                                >{{ transfer.receiver?.name }} ·
                                {{ formatDate(transfer.received_at) }}</span
                            >
                        </div>
                    </div>
                </div>

                <!-- Items -->
                <div
                    class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                >
                    <h3
                        class="mb-3 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Productos ({{ transfer.items?.length || 0 }})
                    </h3>
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 dark:bg-muted/50">
                            <tr>
                                <th
                                    class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300"
                                >
                                    SKU
                                </th>
                                <th
                                    class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300"
                                >
                                    Cantidad
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <tr v-for="item in transfer.items" :key="item.id">
                                <td
                                    class="px-3 py-2 text-gray-900 dark:text-white"
                                >
                                    {{ item.product?.name }}
                                </td>
                                <td
                                    class="px-3 py-2 font-mono text-xs text-gray-500"
                                >
                                    {{ item.variant?.sku || item.product?.sku }}
                                </td>
                                <td
                                    class="px-3 py-2 text-center font-semibold text-gray-900 dark:text-white"
                                >
                                    {{ item.quantity }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Notes -->
                <div
                    v-if="transfer.notes"
                    class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                >
                    <h3 class="mb-1 text-sm font-semibold text-gray-500">
                        Notas
                    </h3>
                    <p class="text-gray-700 dark:text-gray-300">
                        {{ transfer.notes }}
                    </p>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
