<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-vue-next';

defineOptions({ layout: AppLayout });

type ReturnStatus = 'pending' | 'approved' | 'rejected';

type SalesReturnRow = {
    id: number;
    return_number: string;
    sales_order_id: number;
    total_amount: number | string;
    status: ReturnStatus;
    created_at: string;
    sales_order?: { id: number; order_number: string } | null;
    customer?: { id: number; name: string } | null;
    user?: { id: number; name: string } | null;
};

const returns = ref<SalesReturnRow[]>([]);
const statusFilter = ref<'all' | ReturnStatus>('all');
const loading = ref(false);
const error = ref<string | null>(null);
const processingId = ref<number | null>(null);

const pagination = ref({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
});

const fetchReturns = async (page = 1) => {
    loading.value = true;
    error.value = null;

    try {
        const params: Record<string, string | number> = {
            page,
            per_page: pagination.value.per_page,
        };

        if (statusFilter.value !== 'all') {
            params.status = statusFilter.value;
        }

        const { data } = await apiClient.get('/sales-returns', { params });
        returns.value = data.data ?? [];
        pagination.value = {
            current_page: data.current_page ?? 1,
            last_page: data.last_page ?? 1,
            per_page: data.per_page ?? pagination.value.per_page,
            total: data.total ?? 0,
        };
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error cargando devoluciones';
    } finally {
        loading.value = false;
    }
};

watch(statusFilter, () => {
    fetchReturns(1);
});

onMounted(() => {
    fetchReturns(1);
});

const formatCurrency = (value: number | string) => {
    const numeric = Number(value || 0);
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(numeric);
};

const formatDate = (value: string) => {
    return new Date(value).toLocaleString('es-PA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getStatusClasses = (status: ReturnStatus) => {
    if (status === 'approved') {
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    }
    if (status === 'rejected') {
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    }
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
};

const processReturn = async (id: number, action: 'approve' | 'reject') => {
    const message =
        action === 'approve'
            ? 'Aprobar esta devolucion?'
            : 'Rechazar esta devolucion?';
    if (!confirm(message)) return;

    processingId.value = id;
    try {
        await apiClient.post(`/sales-returns/${id}/${action}`);
        await fetchReturns(pagination.value.current_page);
    } catch (e: any) {
        alert(e.response?.data?.message || 'No se pudo procesar la devolucion');
    } finally {
        processingId.value = null;
    }
};

const goToOrder = (orderId?: number) => {
    if (!orderId) return;
    router.visit(`/sales-orders/${orderId}`);
};

const nextPage = () => {
    if (pagination.value.current_page < pagination.value.last_page) {
        fetchReturns(pagination.value.current_page + 1);
    }
};

const prevPage = () => {
    if (pagination.value.current_page > 1) {
        fetchReturns(pagination.value.current_page - 1);
    }
};
</script>

<template>
    <Head title="Devoluciones" />

    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1
                    class="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white"
                >
                    <RotateCcw
                        class="h-8 w-8 text-cyan-600 dark:text-cyan-400"
                    />
                    Devoluciones
                </h1>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Listado global de devoluciones de ventas
                </p>
            </div>

            <select
                v-model="statusFilter"
                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted"
            >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobada</option>
                <option value="rejected">Rechazada</option>
            </select>
        </div>

        <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"
        >
            {{ error }}
        </div>

        <div
            class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card"
        >
            <div v-if="loading" class="p-10 text-center text-gray-500">
                Cargando devoluciones...
            </div>

            <div
                v-else-if="returns.length === 0"
                class="p-10 text-center text-gray-500"
            >
                No hay devoluciones para el filtro seleccionado.
            </div>

            <div v-else class="overflow-x-auto">
                <table
                    class="min-w-full divide-y divide-gray-200 dark:divide-border"
                >
                    <thead class="bg-gray-50 dark:bg-background">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                            >
                                Devolucion
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                            >
                                Orden
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                            >
                                Cliente
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                            >
                                Monto
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                            >
                                Estado
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                            >
                                Fecha
                            </th>
                            <th
                                class="px-6 py-3 text-right text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody
                        class="divide-y divide-gray-100 dark:divide-border/50"
                    >
                        <tr
                            v-for="item in returns"
                            :key="item.id"
                            class="hover:bg-gray-50/70 dark:hover:bg-muted/30"
                        >
                            <td
                                class="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white"
                            >
                                {{ item.return_number || `DEV-${item.id}` }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                            >
                                {{
                                    item.sales_order?.order_number ||
                                    `#${item.sales_order_id}`
                                }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                            >
                                {{ item.customer?.name || 'Publico General' }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                            >
                                {{ formatCurrency(item.total_amount) }}
                            </td>
                            <td class="px-6 py-4 text-sm">
                                <span
                                    :class="[
                                        'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                                        getStatusClasses(item.status),
                                    ]"
                                >
                                    {{ item.status }}
                                </span>
                            </td>
                            <td
                                class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                            >
                                {{ formatDate(item.created_at) }}
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="inline-flex items-center gap-2">
                                    <button
                                        type="button"
                                        class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-100 dark:border-border dark:hover:bg-muted"
                                        @click="goToOrder(item.sales_order_id)"
                                    >
                                        Ver orden
                                    </button>

                                    <button
                                        v-if="item.status === 'pending'"
                                        type="button"
                                        class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-700"
                                        :disabled="processingId === item.id"
                                        @click="
                                            processReturn(item.id, 'approve')
                                        "
                                    >
                                        <CheckCircle2 :size="13" />
                                        Aprobar
                                    </button>

                                    <button
                                        v-if="item.status === 'pending'"
                                        type="button"
                                        class="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs text-white hover:bg-red-700"
                                        :disabled="processingId === item.id"
                                        @click="
                                            processReturn(item.id, 'reject')
                                        "
                                    >
                                        <XCircle :size="13" />
                                        Rechazar
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div
                v-if="!loading && pagination.last_page > 1"
                class="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-border"
            >
                <span class="text-sm text-gray-600 dark:text-gray-400">
                    Pagina {{ pagination.current_page }} de
                    {{ pagination.last_page }}
                </span>
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-border"
                        :disabled="pagination.current_page <= 1"
                        @click="prevPage"
                    >
                        Anterior
                    </button>
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-border"
                        :disabled="
                            pagination.current_page >= pagination.last_page
                        "
                        @click="nextPage"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
