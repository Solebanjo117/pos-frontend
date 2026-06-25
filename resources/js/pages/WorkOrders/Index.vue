<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import {
    CalendarDays,
    Car,
    CheckCircle2,
    Clock,
    Eye,
    Filter,
    Play,
    Plus,
    Search,
    UserRound,
    Wrench,
    XCircle,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useWorkOrders } from '@/composables/useWorkOrders';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    WorkOrdersApiService,
    type WorkOrder,
    type WorkOrderStatus,
} from '@/services/workOrders';

defineOptions({ layout: AppLayout });

const {
    workOrders,
    loading,
    error,
    total,
    currentPage,
    lastPage,
    summary,
    fetchWorkOrders,
} = useWorkOrders();

const filters = ref({
    search: '',
    status: '',
    assigned_to: '',
    date_from: '',
    date_to: '',
    page: 1,
    per_page: 15,
});
const transitioningId = ref<number | null>(null);

const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'in_progress', label: 'En proceso' },
    { value: 'done', label: 'Listas' },
    { value: 'delivered', label: 'Entregadas' },
    { value: 'cancelled', label: 'Canceladas' },
];

const statusLabels: Record<WorkOrderStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En proceso',
    done: 'Lista',
    delivered: 'Entregada',
    cancelled: 'Cancelada',
};

const statusClasses: Record<WorkOrderStatus, string> = {
    pending:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    in_progress:
        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
    done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    delivered:
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200',
    cancelled:
        'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

const kpis = computed(() => [
    {
        label: 'Total',
        value: summary.value?.total ?? total.value,
        icon: Wrench,
        tone: 'text-slate-700 dark:text-slate-200',
    },
    {
        label: 'Pendientes',
        value: summary.value?.pending ?? 0,
        icon: Clock,
        tone: 'text-amber-700 dark:text-amber-200',
    },
    {
        label: 'En proceso',
        value: summary.value?.in_progress ?? 0,
        icon: Play,
        tone: 'text-sky-700 dark:text-sky-200',
    },
    {
        label: 'Listas',
        value: summary.value?.done ?? 0,
        icon: CheckCircle2,
        tone: 'text-emerald-700 dark:text-emerald-200',
    },
    {
        label: 'Atrasadas',
        value: summary.value?.overdue ?? 0,
        icon: XCircle,
        tone: 'text-rose-700 dark:text-rose-200',
    },
]);

const requestFilters = computed(() => ({
    ...filters.value,
    search: filters.value.search || undefined,
    status: filters.value.status || undefined,
    assigned_to: filters.value.assigned_to || undefined,
    date_from: filters.value.date_from || undefined,
    date_to: filters.value.date_to || undefined,
}));

const loadWorkOrders = async () => {
    await fetchWorkOrders(requestFilters.value);
};

const applyFilters = () => {
    filters.value.page = 1;
    void loadWorkOrders();
};

const changePage = (page: number) => {
    filters.value.page = page;
    void loadWorkOrders();
};

const transition = async (order: WorkOrder, status: WorkOrderStatus) => {
    transitioningId.value = order.id;

    try {
        await WorkOrdersApiService.transitionWorkOrder(order.id, status);
        await loadWorkOrders();
    } finally {
        transitioningId.value = null;
    }
};

const formatCurrency = (value: unknown): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatDate = (date?: string | null): string => {
    if (!date) {
        return '-';
    }

    return new Date(date).toLocaleDateString('es-PA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const vehicleLabel = (order: WorkOrder): string =>
    order.customer_vehicle?.display_name ||
    order.customer_vehicle?.label ||
    order.vehicle_description ||
    'Vehiculo no registrado';

const newOrder = () => {
    router.visit('/work-orders/create');
};

onMounted(loadWorkOrders);
</script>

<template>
    <Head title="Ordenes de Trabajo" />

    <div
        class="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100"
    >
        <div class="space-y-5 p-4 sm:p-6">
            <div
                class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
            >
                <div>
                    <div
                        class="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-300"
                    >
                        <Wrench class="h-4 w-4" />
                        Taller
                    </div>
                    <h1 class="mt-1 text-2xl font-semibold tracking-normal">
                        Ordenes de Trabajo
                    </h1>
                    <p class="text-sm text-slate-500 dark:text-slate-400">
                        Seguimiento operativo por cliente, vehiculo y mecanico
                        asignado.
                    </p>
                </div>

                <button
                    class="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    @click="newOrder"
                >
                    <Plus class="h-4 w-4" />
                    Nueva orden
                </button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div
                    v-for="kpi in kpis"
                    :key="kpi.label"
                    class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <div class="flex items-center justify-between">
                        <span
                            class="text-xs font-medium text-slate-500 uppercase dark:text-slate-400"
                        >
                            {{ kpi.label }}
                        </span>
                        <component
                            :is="kpi.icon"
                            class="h-4 w-4"
                            :class="kpi.tone"
                        />
                    </div>
                    <div class="mt-2 text-2xl font-semibold">
                        {{ kpi.value }}
                    </div>
                </div>
            </div>

            <div
                class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
                <div
                    class="grid gap-3 md:grid-cols-[1fr_180px_160px_160px_auto]"
                >
                    <label class="relative">
                        <Search
                            class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            v-model="filters.search"
                            class="h-10 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950"
                            placeholder="Buscar folio, cliente, VIN o vehiculo"
                            @keyup.enter="applyFilters"
                        />
                    </label>
                    <select
                        v-model="filters.status"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950"
                        @change="applyFilters"
                    >
                        <option
                            v-for="status in statusOptions"
                            :key="status.value"
                            :value="status.value"
                        >
                            {{ status.label }}
                        </option>
                    </select>
                    <input
                        v-model="filters.date_from"
                        type="date"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950"
                        @change="applyFilters"
                    />
                    <input
                        v-model="filters.date_to"
                        type="date"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950"
                        @change="applyFilters"
                    />
                    <button
                        class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        @click="applyFilters"
                    >
                        <Filter class="h-4 w-4" />
                        Filtrar
                    </button>
                </div>
            </div>

            <div
                v-if="error"
                class="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
                {{ error }}
            </div>

            <div
                class="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
                <div
                    v-if="loading"
                    class="flex items-center justify-center py-16 text-sm text-slate-500"
                >
                    Cargando ordenes...
                </div>

                <div
                    v-else-if="workOrders.length === 0"
                    class="flex flex-col items-center justify-center py-16 text-center"
                >
                    <Wrench
                        class="h-10 w-10 text-slate-300 dark:text-slate-600"
                    />
                    <p class="mt-3 text-sm font-semibold">
                        No hay ordenes con estos filtros.
                    </p>
                    <button
                        class="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                        @click="newOrder"
                    >
                        Crear orden
                    </button>
                </div>

                <div v-else class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"
                    >
                        <thead
                            class="bg-slate-100/80 text-xs text-slate-500 uppercase dark:bg-slate-950 dark:text-slate-400"
                        >
                            <tr>
                                <th class="px-4 py-3 text-left font-semibold">
                                    Folio
                                </th>
                                <th class="px-4 py-3 text-left font-semibold">
                                    Cliente / Vehiculo
                                </th>
                                <th class="px-4 py-3 text-left font-semibold">
                                    Mecanico
                                </th>
                                <th class="px-4 py-3 text-left font-semibold">
                                    Entrega
                                </th>
                                <th class="px-4 py-3 text-right font-semibold">
                                    Total
                                </th>
                                <th class="px-4 py-3 text-left font-semibold">
                                    Estado
                                </th>
                                <th class="px-4 py-3 text-right font-semibold">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-slate-100 dark:divide-slate-800"
                        >
                            <tr
                                v-for="order in workOrders"
                                :key="order.id"
                                class="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            >
                                <td class="px-4 py-3 align-top">
                                    <Link
                                        :href="`/work-orders/${order.id}`"
                                        class="font-mono font-semibold text-sky-700 hover:underline dark:text-sky-300"
                                    >
                                        {{ order.folio }}
                                    </Link>
                                    <div class="mt-1 text-xs text-slate-500">
                                        {{
                                            order.warehouse?.name ??
                                            `Sucursal #${order.warehouse_id}`
                                        }}
                                    </div>
                                </td>
                                <td class="px-4 py-3 align-top">
                                    <div class="flex items-start gap-2">
                                        <UserRound
                                            class="mt-0.5 h-4 w-4 text-slate-400"
                                        />
                                        <div>
                                            <div class="font-medium">
                                                {{
                                                    order.customer?.name ??
                                                    'Cliente rapido'
                                                }}
                                            </div>
                                            <div
                                                class="mt-1 flex items-center gap-1 text-xs text-slate-500"
                                            >
                                                <Car class="h-3.5 w-3.5" />
                                                {{ vehicleLabel(order) }}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 align-top text-slate-600 dark:text-slate-300"
                                >
                                    {{ order.assignee?.name ?? 'Sin asignar' }}
                                </td>
                                <td class="px-4 py-3 align-top">
                                    <div
                                        class="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"
                                    >
                                        <CalendarDays
                                            class="h-4 w-4 text-slate-400"
                                        />
                                        {{
                                            formatDate(
                                                order.estimated_delivery_at,
                                            )
                                        }}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 text-right align-top font-semibold"
                                >
                                    {{ formatCurrency(order.total_amount) }}
                                </td>
                                <td class="px-4 py-3 align-top">
                                    <span
                                        class="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
                                        :class="statusClasses[order.status]"
                                    >
                                        {{ statusLabels[order.status] }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 align-top">
                                    <div class="flex justify-end gap-2">
                                        <button
                                            v-for="nextStatus in order.available_transitions"
                                            :key="nextStatus"
                                            class="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                            :disabled="
                                                transitioningId === order.id
                                            "
                                            @click="
                                                transition(order, nextStatus)
                                            "
                                        >
                                            {{ statusLabels[nextStatus] }}
                                        </button>
                                        <Link
                                            :href="`/work-orders/${order.id}`"
                                            class="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                        >
                                            <Eye class="h-3.5 w-3.5" />
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div
                v-if="lastPage > 1"
                class="flex items-center justify-between text-sm text-slate-500"
            >
                <span
                    >Pagina {{ currentPage }} de {{ lastPage }} ·
                    {{ total }} registros</span
                >
                <div class="flex gap-2">
                    <button
                        class="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
                        :disabled="currentPage <= 1"
                        @click="changePage(currentPage - 1)"
                    >
                        Anterior
                    </button>
                    <button
                        class="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
                        :disabled="currentPage >= lastPage"
                        @click="changePage(currentPage + 1)"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
