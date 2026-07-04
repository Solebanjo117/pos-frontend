<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    RotateCcw,
    Search,
    XCircle,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import CreateReturnModal from '@/components/POS/CreateReturnModal.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { SalesReturnsApiService } from '@/services/sales-returns';
import type {
    SalesReturnCandidate,
    SalesReturnCreatePayload,
    SalesReturnListRow,
    SalesReturnRefundMethod,
    SalesReturnStatus,
} from '@/types/sales-return';

defineOptions({ layout: AppLayout });

const returns = ref<SalesReturnListRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const processingId = ref<number | null>(null);
const expandedId = ref<number | null>(null);
const invoiceSearch = ref('');
const candidateLoading = ref(false);
const candidateError = ref<string | null>(null);
const candidates = ref<SalesReturnCandidate[]>([]);
const selectedCandidate = ref<SalesReturnCandidate | null>(null);
const createReturnLoading = ref(false);
const createReturnError = ref<string | null>(null);

const filters = ref({
    status: '' as '' | SalesReturnStatus,
    refund_method: '' as '' | SalesReturnRefundMethod,
    search: '',
    customer_id: '',
    sales_order_id: '',
    warehouse_id: '',
    date_from: '',
    date_to: '',
});

const pagination = ref({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
});

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const metrics = computed(() => {
    const rows = returns.value;
    return {
        pending: rows.filter((row) => row.status === 'pending').length,
        approved: rows.filter((row) => row.status === 'approved').length,
        rejected: rows.filter((row) => row.status === 'rejected').length,
        approvedAmount: rows
            .filter((row) => row.status === 'approved')
            .reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
        pendingAmount: rows
            .filter((row) => row.status === 'pending')
            .reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    };
});

const fetchReturns = async (page = 1): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
        const params: Record<string, string | number> = {
            page,
            per_page: pagination.value.per_page,
        };

        Object.entries(filters.value).forEach(([key, value]) => {
            if (value !== '') params[key] = value;
        });

        const data = await SalesReturnsApiService.list(params);
        returns.value = data.data ?? [];
        pagination.value = {
            current_page: data.current_page ?? 1,
            last_page: data.last_page ?? 1,
            per_page: data.per_page ?? pagination.value.per_page,
            total: data.total ?? 0,
        };
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'Error cargando devoluciones';
    } finally {
        loading.value = false;
    }
};

watch(
    () => [
        filters.value.status,
        filters.value.refund_method,
        filters.value.customer_id,
        filters.value.sales_order_id,
        filters.value.warehouse_id,
        filters.value.date_from,
        filters.value.date_to,
    ],
    () => fetchReturns(1),
);

watch(
    () => filters.value.search,
    () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchReturns(1), 300);
    },
);

onMounted(() => fetchReturns(1));

const formatCurrency = (value: number | string | null | undefined): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(Number(value || 0));

const formatDate = (value?: string | null): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('es-PA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const statusLabel = (status: SalesReturnStatus): string =>
    ({
        pending: 'Pendiente',
        approved: 'Aprobada',
        rejected: 'Rechazada',
    })[status];

const methodLabel = (method?: string | null): string =>
    ({
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia',
        yappy: 'Yappy',
        ach: 'ACH',
        cheque: 'Cheque',
        visa: 'Visa',
        mastercard: 'Mastercard',
        amex: 'AMEX',
        other: 'Otro',
        receivable: 'Reducir CxC',
        balance: 'Saldo a favor',
    })[method || ''] ||
    method ||
    'N/A';

const statusClasses = (status: SalesReturnStatus): string => {
    if (status === 'approved') {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    }
    if (status === 'rejected') return 'bg-red-50 text-red-700 ring-red-200';
    return 'bg-amber-50 text-amber-700 ring-amber-200';
};

const processReturn = async (
    id: number,
    action: 'approve' | 'reject',
): Promise<void> => {
    const message =
        action === 'approve'
            ? '¿Aprobar esta devolución?'
            : '¿Rechazar esta devolución?';
    if (!confirm(message)) return;

    processingId.value = id;
    try {
        if (action === 'approve') {
            await SalesReturnsApiService.approve(id);
        } else {
            await SalesReturnsApiService.reject(id);
        }
        await fetchReturns(pagination.value.current_page);
    } catch (err: any) {
        alert(
            err.response?.data?.message || 'No se pudo procesar la devolución',
        );
    } finally {
        processingId.value = null;
    }
};

const clearFilters = (): void => {
    filters.value = {
        status: '',
        refund_method: '',
        search: '',
        customer_id: '',
        sales_order_id: '',
        warehouse_id: '',
        date_from: '',
        date_to: '',
    };
};

const searchCandidates = async (): Promise<void> => {
    candidateLoading.value = true;
    candidateError.value = null;

    try {
        candidates.value = await SalesReturnsApiService.candidates({
            search: invoiceSearch.value.trim() || undefined,
            per_page: 10,
        });
    } catch (err: any) {
        candidateError.value =
            err.response?.data?.message || 'No se pudo buscar la factura';
    } finally {
        candidateLoading.value = false;
    }
};

const openCreateReturn = (candidate: SalesReturnCandidate): void => {
    selectedCandidate.value = candidate;
    createReturnError.value = null;
};

const closeCreateReturn = (): void => {
    selectedCandidate.value = null;
    createReturnError.value = null;
};

const handleCreateReturn = async (
    payload: SalesReturnCreatePayload,
): Promise<void> => {
    if (!selectedCandidate.value) return;

    createReturnLoading.value = true;
    createReturnError.value = null;
    try {
        await SalesReturnsApiService.createForOrder(
            selectedCandidate.value.id,
            payload,
        );
        closeCreateReturn();
        candidates.value = [];
        invoiceSearch.value = '';
        await fetchReturns(1);
    } catch (err: any) {
        createReturnError.value =
            err.response?.data?.message || 'No se pudo crear la devolucion';
    } finally {
        createReturnLoading.value = false;
    }
};
</script>

<template>
    <Head title="Devoluciones" />

    <div class="space-y-4">
        <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
                <div class="flex items-center gap-2">
                    <RotateCcw class="h-6 w-6 text-cyan-700" />
                    <h1 class="text-2xl font-semibold text-gray-950">
                        Devoluciones
                    </h1>
                </div>
                <p class="mt-1 text-sm text-gray-500">
                    Reembolsos, saldos a favor, inventario y facturas origen.
                </p>
            </div>
        </header>

        <section class="grid gap-3 md:grid-cols-5">
            <div class="rounded-lg border bg-white p-3">
                <p class="text-xs font-medium text-gray-500">Pendientes</p>
                <p class="mt-1 text-2xl font-semibold text-amber-700">
                    {{ metrics.pending }}
                </p>
                <p class="text-xs text-gray-500">
                    {{ formatCurrency(metrics.pendingAmount) }}
                </p>
            </div>
            <div class="rounded-lg border bg-white p-3">
                <p class="text-xs font-medium text-gray-500">Aprobadas</p>
                <p class="mt-1 text-2xl font-semibold text-emerald-700">
                    {{ metrics.approved }}
                </p>
                <p class="text-xs text-gray-500">
                    {{ formatCurrency(metrics.approvedAmount) }}
                </p>
            </div>
            <div class="rounded-lg border bg-white p-3">
                <p class="text-xs font-medium text-gray-500">Rechazadas</p>
                <p class="mt-1 text-2xl font-semibold text-red-700">
                    {{ metrics.rejected }}
                </p>
                <p class="text-xs text-gray-500">En la página actual</p>
            </div>
            <div class="rounded-lg border bg-white p-3">
                <p class="text-xs font-medium text-gray-500">Resultados</p>
                <p class="mt-1 text-2xl font-semibold text-gray-950">
                    {{ pagination.total }}
                </p>
                <p class="text-xs text-gray-500">Con filtros activos</p>
            </div>
            <div class="rounded-lg border bg-white p-3">
                <p class="text-xs font-medium text-gray-500">Página</p>
                <p class="mt-1 text-2xl font-semibold text-gray-950">
                    {{ pagination.current_page }}/{{ pagination.last_page }}
                </p>
                <p class="text-xs text-gray-500">
                    {{ pagination.per_page }} por página
                </p>
            </div>
        </section>

        <section class="rounded-lg border bg-white p-3">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div class="flex-1">
                    <label class="mb-1 block text-xs font-semibold text-gray-500 uppercase">
                        Buscar factura para devolucion
                    </label>
                    <div class="relative">
                        <Search
                            class="absolute top-2.5 left-2.5 h-4 w-4 text-gray-400"
                        />
                        <input
                            v-model="invoiceSearch"
                            type="search"
                            placeholder="Numero, cliente, codigo o monto"
                            class="w-full rounded-md border px-8 py-2 text-sm"
                            @keydown.enter.prevent="searchCandidates"
                        />
                    </div>
                </div>
                <button
                    type="button"
                    class="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
                    :disabled="candidateLoading"
                    @click="searchCandidates"
                >
                    <Search class="h-4 w-4" />
                    {{ candidateLoading ? 'Buscando...' : 'Buscar' }}
                </button>
            </div>
            <p
                v-if="candidateError"
                class="mt-2 text-sm text-red-600"
            >
                {{ candidateError }}
            </p>
            <div
                v-if="candidates.length > 0"
                class="mt-3 overflow-hidden rounded-md border"
            >
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                            <th class="px-3 py-2 text-left">Factura</th>
                            <th class="px-3 py-2 text-left">Cliente</th>
                            <th class="px-3 py-2 text-left">Fecha</th>
                            <th class="px-3 py-2 text-right">Total</th>
                            <th class="px-3 py-2 text-center">Items</th>
                            <th class="px-3 py-2 text-right">Accion</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr
                            v-for="candidate in candidates"
                            :key="candidate.id"
                            class="hover:bg-gray-50"
                        >
                            <td class="px-3 py-2 font-semibold text-gray-900">
                                {{ candidate.order_number }}
                            </td>
                            <td class="px-3 py-2 text-gray-600">
                                {{ candidate.customer?.name || 'Publico general' }}
                            </td>
                            <td class="px-3 py-2 text-gray-500">
                                {{ candidate.date || 'N/A' }}
                            </td>
                            <td class="px-3 py-2 text-right font-semibold tabular-nums">
                                <div>{{ formatCurrency(candidate.total) }}</div>
                                <div class="text-xs font-normal text-gray-500">
                                    Pagado {{ formatCurrency(candidate.total_paid || 0) }}
                                </div>
                                <div
                                    v-if="Number(candidate.amount_due || 0) > 0"
                                    class="text-xs font-normal text-amber-600"
                                >
                                    CxC {{ formatCurrency(candidate.amount_due || 0) }}
                                </div>
                            </td>
                            <td class="px-3 py-2 text-center">
                                <div>{{ candidate.items.length }}</div>
                                <div class="text-xs text-gray-500">
                                    {{ formatCurrency(candidate.returnable_amount || 0) }}
                                </div>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <button
                                    type="button"
                                    class="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                                    @click="openCreateReturn(candidate)"
                                >
                                    Crear devolucion
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section class="rounded-lg border bg-white p-3">
            <div class="grid gap-2 md:grid-cols-8">
                <div class="relative md:col-span-2">
                    <Search
                        class="absolute top-2.5 left-2.5 h-4 w-4 text-gray-400"
                    />
                    <input
                        v-model="filters.search"
                        type="search"
                        placeholder="Buscar devolución, factura o cliente"
                        class="w-full rounded-md border px-8 py-2 text-sm"
                    />
                </div>
                <select
                    v-model="filters.status"
                    class="rounded-md border px-3 py-2 text-sm"
                >
                    <option value="">Todos los estados</option>
                    <option value="pending">Pendiente</option>
                    <option value="approved">Aprobada</option>
                    <option value="rejected">Rechazada</option>
                </select>
                <select
                    v-model="filters.refund_method"
                    class="rounded-md border px-3 py-2 text-sm"
                >
                    <option value="">Todos los métodos</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="transfer">Transferencia</option>
                    <option value="yappy">Yappy</option>
                    <option value="ach">ACH</option>
                    <option value="cheque">Cheque</option>
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="amex">AMEX</option>
                    <option value="other">Otro</option>
                    <option value="receivable">Reducir CxC</option>
                    <option value="balance">Saldo a favor</option>
                </select>
                <input
                    v-model="filters.customer_id"
                    type="number"
                    min="1"
                    placeholder="Cliente ID"
                    class="rounded-md border px-3 py-2 text-sm"
                />
                <input
                    v-model="filters.sales_order_id"
                    type="number"
                    min="1"
                    placeholder="Factura ID"
                    class="rounded-md border px-3 py-2 text-sm"
                />
                <input
                    v-model="filters.date_from"
                    type="date"
                    class="rounded-md border px-3 py-2 text-sm"
                />
                <div class="flex gap-2">
                    <input
                        v-model="filters.date_to"
                        type="date"
                        class="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        class="rounded-md border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        @click="clearFilters"
                    >
                        Limpiar
                    </button>
                </div>
            </div>
        </section>

        <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
            {{ error }}
        </div>

        <section class="overflow-hidden rounded-lg border bg-white">
            <div v-if="loading" class="p-8 text-center text-sm text-gray-500">
                Cargando devoluciones...
            </div>
            <div
                v-else-if="returns.length === 0"
                class="p-8 text-center text-sm text-gray-500"
            >
                No hay devoluciones para el filtro seleccionado.
            </div>
            <div v-else class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                            <th class="w-10 px-3 py-2"></th>
                            <th class="px-3 py-2 text-left">Devolución</th>
                            <th class="px-3 py-2 text-left">Factura</th>
                            <th class="px-3 py-2 text-left">Cliente</th>
                            <th class="px-3 py-2 text-left">Método</th>
                            <th class="px-3 py-2 text-right">Monto</th>
                            <th class="px-3 py-2 text-left">Estado</th>
                            <th class="px-3 py-2 text-left">Fecha</th>
                            <th class="px-3 py-2 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <template v-for="item in returns" :key="item.id">
                            <tr class="hover:bg-gray-50">
                                <td class="px-3 py-2">
                                    <button
                                        type="button"
                                        class="rounded p-1 hover:bg-gray-100"
                                        @click="
                                            expandedId =
                                                expandedId === item.id
                                                    ? null
                                                    : item.id
                                        "
                                    >
                                        <ChevronDown
                                            v-if="expandedId === item.id"
                                            class="h-4 w-4"
                                        />
                                        <ChevronRight v-else class="h-4 w-4" />
                                    </button>
                                </td>
                                <td class="px-3 py-2">
                                    <button
                                        type="button"
                                        class="font-semibold text-cyan-700 hover:underline"
                                        @click="
                                            router.visit(`/returns/${item.id}`)
                                        "
                                    >
                                        {{
                                            item.return_number ||
                                            `DEV-${item.id}`
                                        }}
                                    </button>
                                </td>
                                <td class="px-3 py-2">
                                    <button
                                        type="button"
                                        class="text-gray-700 hover:text-cyan-700 hover:underline"
                                        @click="
                                            router.visit(
                                                `/sales-orders/${item.sales_order_id}`,
                                            )
                                        "
                                    >
                                        {{
                                            item.sales_order?.order_number ||
                                            `#${item.sales_order_id}`
                                        }}
                                    </button>
                                </td>
                                <td class="px-3 py-2">
                                    <button
                                        v-if="item.customer?.id"
                                        type="button"
                                        class="hover:text-cyan-700 hover:underline"
                                        @click="
                                            router.visit(
                                                `/customers/${item.customer?.id}`,
                                            )
                                        "
                                    >
                                        {{ item.customer.name }}
                                    </button>
                                    <span v-else>Público general</span>
                                </td>
                                <td class="px-3 py-2">
                                    {{ methodLabel(item.refund_method) }}
                                </td>
                                <td
                                    class="px-3 py-2 text-right font-semibold tabular-nums"
                                >
                                    {{ formatCurrency(item.total_amount) }}
                                </td>
                                <td class="px-3 py-2">
                                    <span
                                        :class="[
                                            'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                                            statusClasses(item.status),
                                        ]"
                                    >
                                        {{ statusLabel(item.status) }}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-gray-500">
                                    {{ formatDate(item.created_at) }}
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <div class="inline-flex items-center gap-1">
                                        <button
                                            type="button"
                                            class="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                                            @click="
                                                router.visit(
                                                    `/returns/${item.id}`,
                                                )
                                            "
                                        >
                                            <ExternalLink class="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            v-if="item.status === 'pending'"
                                            type="button"
                                            class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                                            :disabled="processingId === item.id"
                                            @click="
                                                processReturn(
                                                    item.id,
                                                    'approve',
                                                )
                                            "
                                        >
                                            <CheckCircle2 class="h-3.5 w-3.5" />
                                            Aprobar
                                        </button>
                                        <button
                                            v-if="item.status === 'pending'"
                                            type="button"
                                            class="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                                            :disabled="processingId === item.id"
                                            @click="
                                                processReturn(item.id, 'reject')
                                            "
                                        >
                                            <XCircle class="h-3.5 w-3.5" />
                                            Rechazar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="expandedId === item.id">
                                <td></td>
                                <td colspan="8" class="bg-gray-50 px-3 py-3">
                                    <div
                                        class="grid gap-3 text-xs text-gray-600 md:grid-cols-4"
                                    >
                                        <div>
                                            <span class="font-semibold"
                                                >Sucursal:</span
                                            >
                                            {{
                                                item.warehouse?.name ||
                                                item.warehouse?.code ||
                                                'N/A'
                                            }}
                                        </div>
                                        <div>
                                            <span class="font-semibold"
                                                >Usuario:</span
                                            >
                                            {{
                                                item.processed_by_name ||
                                                item.user?.name ||
                                                'Sistema'
                                            }}
                                        </div>
                                        <div>
                                            <span class="font-semibold"
                                                >Motivo:</span
                                            >
                                            {{ item.reason || 'Sin motivo' }}
                                        </div>
                                        <div>
                                            <span class="font-semibold"
                                                >Items:</span
                                            >
                                            {{ item.items?.length ?? 0 }}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

            <div
                class="flex items-center justify-between border-t px-4 py-3 text-sm"
            >
                <span class="text-gray-500">
                    Página {{ pagination.current_page }} de
                    {{ pagination.last_page }}
                </span>
                <div class="flex gap-2">
                    <button
                        type="button"
                        class="rounded-md border px-3 py-1.5 disabled:opacity-40"
                        :disabled="pagination.current_page <= 1"
                        @click="fetchReturns(pagination.current_page - 1)"
                    >
                        Anterior
                    </button>
                    <button
                        type="button"
                        class="rounded-md border px-3 py-1.5 disabled:opacity-40"
                        :disabled="
                            pagination.current_page >= pagination.last_page
                        "
                        @click="fetchReturns(pagination.current_page + 1)"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </section>

        <CreateReturnModal
            v-if="selectedCandidate"
            :show="selectedCandidate !== null"
            :order-id="selectedCandidate.id"
            :order-number="selectedCandidate.order_number"
            :items="selectedCandidate.items"
            :has-customer="selectedCandidate.has_customer"
            :total-paid="selectedCandidate.total_paid || 0"
            :total-returned="selectedCandidate.total_returned || 0"
            :amount-due="selectedCandidate.amount_due || 0"
            :returnable-amount="selectedCandidate.returnable_amount || 0"
            :recommended-refund-method="
                selectedCandidate.recommended_refund_method || null
            "
            :loading="createReturnLoading"
            :error="createReturnError"
            @submit="handleCreateReturn"
            @close="closeCreateReturn"
        />
    </div>
</template>
