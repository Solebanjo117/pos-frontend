<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import {
    AlertCircle,
    Banknote,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    Eye,
    Minus,
    Receipt,
    RefreshCw,
    RotateCcw,
    Search,
    TrendingDown,
    TrendingUp,
    User,
    Warehouse,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import {
    PosSessionsApiService,
    type CashMovementRecord,
    type PosSessionRecord,
    type SessionSalesOrder,
} from '@/services/posSessions';
import { useWarehouses } from '@/composables/useWarehouses';
import { useUsers } from '@/composables/useUsers';
import { usePosSettings } from '@/composables/usePosSettings';
import SessionDetailModal from '@/components/POS/SessionDetailModal.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Cierres de Caja', href: '/pos-sessions' },
];

const { warehouses, fetchWarehouses } = useWarehouses();
const { users, fetchUsers } = useUsers();
const { currentWarehouseId, initWarehouse } = usePosSettings();

const sessions = ref<PosSessionRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const pagination = ref({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 15,
});

const filterStatus = ref<string>('closed');
const filterWarehouseId = ref<number | undefined>(undefined);
const filterUserId = ref<number | undefined>(undefined);
const filterDateFrom = ref<string>('');
const filterDateTo = ref<string>('');

const selectedSession = ref<PosSessionRecord | null>(null);
const selectedSalesOrders = ref<SessionSalesOrder[]>([]);
const selectedCashMovements = ref<CashMovementRecord[]>([]);
const showDetailModal = ref(false);
const loadingDetail = ref(false);

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const userOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...users.value.map((user) => ({
        value: user.id,
        label: user.name,
    })),
]);

const warehouseFilterModel = computed<number | null>({
    get: () => filterWarehouseId.value ?? null,
    set: (value) => {
        filterWarehouseId.value = value === null ? undefined : Number(value);
    },
});

const userFilterModel = computed<number | null>({
    get: () => filterUserId.value ?? null,
    set: (value) => {
        filterUserId.value = value === null ? undefined : Number(value);
    },
});

const moneyValue = (value: string | number | null | undefined): number => {
    const parsed =
        typeof value === 'string'
            ? Number.parseFloat(value)
            : Number(value ?? 0);

    return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: string | number | null | undefined): string =>
    new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'USD',
    }).format(moneyValue(value));

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Sin registro';

    return new Date(dateStr).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatDuration = (
    openedAt: string | null | undefined,
    closedAt: string | null | undefined,
): string => {
    if (!openedAt || !closedAt) return 'En curso';

    const diffMinutes = Math.max(
        0,
        Math.round(
            (new Date(closedAt).getTime() - new Date(openedAt).getTime()) /
                60000,
        ),
    );
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} h`;

    return `${hours} h ${minutes} min`;
};

const getSummary = (session: PosSessionRecord) =>
    session.closing_details?.summary ?? null;

const getExpectedTotal = (session: PosSessionRecord): number =>
    moneyValue(
        getSummary(session)?.expected_total ??
            getSummary(session)?.expected_cash ??
            session.expected_amount,
    );

const getDeclaredTotal = (session: PosSessionRecord): number =>
    moneyValue(
        getSummary(session)?.declared_total ??
            getSummary(session)?.declared_cash ??
            session.closing_amount,
    );

const getDifference = (session: PosSessionRecord): number =>
    moneyValue(
        getSummary(session)?.total_difference ??
            getSummary(session)?.difference ??
            getDeclaredTotal(session) - getExpectedTotal(session),
    );

const getDifferenceTone = (
    value: number,
): 'surplus' | 'missing' | 'balanced' => {
    if (value > 0.005) return 'surplus';
    if (value < -0.005) return 'missing';

    return 'balanced';
};

const getDifferenceLabel = (value: number): string => {
    const tone = getDifferenceTone(value);
    if (tone === 'surplus') return 'Sobrante';
    if (tone === 'missing') return 'Faltante';

    return 'Cuadra';
};

const differenceTextClass = (value: number): string => {
    const tone = getDifferenceTone(value);
    if (tone === 'surplus') return 'text-emerald-700 dark:text-emerald-300';
    if (tone === 'missing') return 'text-red-700 dark:text-red-300';

    return 'text-slate-600 dark:text-slate-300';
};

const differenceBadgeClass = (value: number): string => {
    const tone = getDifferenceTone(value);
    if (tone === 'surplus')
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800';
    if (tone === 'missing')
        return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800';

    return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border';
};

const statusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        open: 'Abierta',
        closed: 'Cerrada',
    };

    return labels[status] ?? status;
};

const statusClass = (status: string): string => {
    if (status === 'open')
        return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800';

    return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border';
};

const pageStats = computed(() => {
    const expected = sessions.value.reduce(
        (total, session) => total + getExpectedTotal(session),
        0,
    );
    const declared = sessions.value.reduce(
        (total, session) => total + getDeclaredTotal(session),
        0,
    );
    const difference = sessions.value.reduce(
        (total, session) => total + getDifference(session),
        0,
    );
    const flagged = sessions.value.filter(
        (session) => getDifferenceTone(getDifference(session)) !== 'balanced',
    ).length;

    return {
        count: sessions.value.length,
        expected,
        declared,
        difference,
        flagged,
    };
});

const fetchSessions = async (page: number = 1) => {
    loading.value = true;
    error.value = null;

    try {
        const response = await PosSessionsApiService.list({
            status: filterStatus.value || undefined,
            warehouse_id: filterWarehouseId.value,
            user_id: filterUserId.value,
            date_from: filterDateFrom.value || undefined,
            date_to: filterDateTo.value || undefined,
            page,
            per_page: pagination.value.per_page,
        });
        const paginatedData = response.data;

        sessions.value = paginatedData.data || [];
        pagination.value = {
            current_page: paginatedData.current_page,
            last_page: paginatedData.last_page,
            total: paginatedData.total,
            per_page: paginatedData.per_page,
        };
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'Error al cargar los cierres de caja.';
        console.error('Error fetching sessions:', err);
    } finally {
        loading.value = false;
    }
};

const openDetail = async (session: PosSessionRecord) => {
    loadingDetail.value = true;
    showDetailModal.value = true;
    selectedSession.value = null;
    selectedSalesOrders.value = [];
    selectedCashMovements.value = [];

    try {
        const response = await PosSessionsApiService.show(session.id);
        selectedSession.value = response.data;
        selectedSalesOrders.value = response.sales_orders;
        selectedCashMovements.value =
            response.cash_movements || response.data.cash_movements || [];
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'Error al cargar el detalle del cierre.';
        console.error('Error fetching session detail:', err);
        showDetailModal.value = false;
    } finally {
        loadingDetail.value = false;
    }
};

const closeDetail = () => {
    showDetailModal.value = false;
    selectedSession.value = null;
    selectedSalesOrders.value = [];
    selectedCashMovements.value = [];
};

const applyFilters = () => fetchSessions(1);

const clearFilters = () => {
    filterStatus.value = 'closed';
    filterWarehouseId.value = currentWarehouseId.value || undefined;
    filterUserId.value = undefined;
    filterDateFrom.value = '';
    filterDateTo.value = '';
    fetchSessions(1);
};

const filterByUser = (session: PosSessionRecord) => {
    if (!session.user_id) return;

    filterUserId.value = session.user_id;
    fetchSessions(1);
};

const filterByWarehouse = (session: PosSessionRecord) => {
    if (!session.warehouse_id) return;

    filterWarehouseId.value = session.warehouse_id;
    fetchSessions(1);
};

const filterByStatus = (status: string) => {
    filterStatus.value = status;
    fetchSessions(1);
};

onMounted(async () => {
    await Promise.all([initWarehouse(), fetchWarehouses(), fetchUsers()]);
    filterWarehouseId.value = currentWarehouseId.value || undefined;
    await fetchSessions();
});
</script>

<template>
    <Head title="Cierres de Caja" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <header
                class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
                <div>
                    <div class="flex items-center gap-2">
                        <div
                            class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                        >
                            <Receipt :size="19" />
                        </div>
                        <div>
                            <h1
                                class="text-2xl font-bold text-slate-950 dark:text-white"
                            >
                                Cierres de Caja
                            </h1>
                            <p
                                class="text-sm text-slate-500 dark:text-slate-400"
                            >
                                Conciliación, arqueo y ventas por turno
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    :disabled="loading"
                    class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                    @click="fetchSessions(pagination.current_page)"
                >
                    <RefreshCw
                        :size="16"
                        :class="{ 'animate-spin': loading }"
                    />
                    Refrescar
                </button>
            </header>

            <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Cierres visibles
                        </p>
                        <Receipt :size="16" class="text-slate-400" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ pageStats.count }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ pagination.total }} en total
                    </p>
                </div>

                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Total esperado
                        </p>
                        <Banknote :size="16" class="text-slate-400" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ formatCurrency(pageStats.expected) }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Efectivo y métodos contables
                    </p>
                </div>

                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Total declarado
                        </p>
                        <CreditCard :size="16" class="text-slate-400" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ formatCurrency(pageStats.declared) }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Conteos registrados al cierre
                    </p>
                </div>

                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Diferencia neta
                        </p>
                        <TrendingUp
                            v-if="pageStats.difference > 0"
                            :size="16"
                            class="text-emerald-500"
                        />
                        <TrendingDown
                            v-else-if="pageStats.difference < 0"
                            :size="16"
                            class="text-red-500"
                        />
                        <Minus v-else :size="16" class="text-slate-400" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold tabular-nums"
                        :class="differenceTextClass(pageStats.difference)"
                    >
                        {{ pageStats.difference > 0 ? '+' : ''
                        }}{{ formatCurrency(pageStats.difference) }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ getDifferenceLabel(pageStats.difference) }}
                    </p>
                </div>

                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            Con diferencia
                        </p>
                        <AlertCircle :size="16" class="text-amber-500" />
                    </div>
                    <p
                        class="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ pageStats.flagged }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Sobrantes o faltantes
                    </p>
                </div>
            </section>

            <section
                class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    class="grid gap-3 md:grid-cols-2 xl:grid-cols-[140px_140px_170px_190px_160px_auto] xl:items-end"
                >
                    <div>
                        <label
                            class="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            <Calendar :size="13" />
                            Desde
                        </label>
                        <input
                            v-model="filterDateFrom"
                            type="date"
                            class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 transition outline-none focus:border-slate-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1.5 block text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                            >Hasta</label
                        >
                        <input
                            v-model="filterDateTo"
                            type="date"
                            class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 transition outline-none focus:border-slate-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            <Warehouse :size="13" />
                            Sucursal
                        </label>
                        <SearchableSelect
                            v-model="warehouseFilterModel"
                            :options="warehouseOptions"
                            placeholder="Todas"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                        >
                            <User :size="13" />
                            Cajero
                        </label>
                        <SearchableSelect
                            v-model="userFilterModel"
                            :options="userOptions"
                            placeholder="Todos"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1.5 block text-xs font-bold text-slate-500 uppercase dark:text-slate-400"
                            >Estado</label
                        >
                        <select
                            v-model="filterStatus"
                            class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 transition outline-none focus:border-slate-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option value="">Todos</option>
                            <option value="closed">Cerradas</option>
                            <option value="open">Abiertas</option>
                        </select>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                            @click="applyFilters"
                        >
                            <Search :size="16" />
                            Buscar
                        </button>
                        <button
                            type="button"
                            class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                            @click="clearFilters"
                        >
                            <RotateCcw :size="15" />
                            Limpiar
                        </button>
                    </div>
                </div>
            </section>

            <div
                v-if="error"
                class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            >
                <AlertCircle :size="18" />
                {{ error }}
            </div>

            <div
                class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    v-if="loading"
                    class="flex items-center justify-center py-16 text-sm text-slate-500 dark:text-slate-400"
                >
                    <RefreshCw :size="20" class="mr-2 animate-spin" />
                    Cargando cierres de caja...
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr
                                class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase dark:border-border dark:bg-muted/50 dark:text-slate-400"
                            >
                                <th class="px-4 py-3 text-left font-bold">
                                    Turno
                                </th>
                                <th class="px-4 py-3 text-left font-bold">
                                    Apertura / Cierre
                                </th>
                                <th class="px-4 py-3 text-right font-bold">
                                    Esperado
                                </th>
                                <th class="px-4 py-3 text-right font-bold">
                                    Declarado
                                </th>
                                <th class="px-4 py-3 text-right font-bold">
                                    Diferencia
                                </th>
                                <th class="px-4 py-3 text-center font-bold">
                                    Estado
                                </th>
                                <th class="px-4 py-3 text-right font-bold">
                                    Acción
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-slate-100 dark:divide-border/60"
                        >
                            <tr
                                v-for="session in sessions"
                                :key="session.id"
                                class="transition hover:bg-slate-50 dark:hover:bg-muted/40"
                            >
                                <td class="px-4 py-3">
                                    <button
                                        type="button"
                                        class="font-semibold text-slate-950 underline-offset-2 transition hover:text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white dark:hover:text-indigo-300"
                                        title="Filtrar por cajero"
                                        @click="filterByUser(session)"
                                    >
                                        {{ session.user?.name || 'Sin cajero' }}
                                    </button>
                                    <div
                                        class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                                    >
                                        <button
                                            type="button"
                                            class="inline-flex items-center gap-1 underline-offset-2 transition hover:text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:text-indigo-300"
                                            title="Filtrar por almacén"
                                            @click="filterByWarehouse(session)"
                                        >
                                            <Warehouse :size="12" />
                                            {{
                                                session.warehouse?.name ||
                                                'General'
                                            }}
                                        </button>
                                        <span class="font-mono"
                                            >#{{ session.id }}</span
                                        >
                                    </div>
                                </td>
                                <td class="px-4 py-3">
                                    <div
                                        class="space-y-1 text-xs text-slate-600 dark:text-slate-300"
                                    >
                                        <div class="flex items-center gap-1.5">
                                            <Clock
                                                :size="13"
                                                class="text-slate-400"
                                            />
                                            <span>{{
                                                formatDate(session.opened_at)
                                            }}</span>
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                            <CheckCircle2
                                                :size="13"
                                                class="text-slate-400"
                                            />
                                            <span>{{
                                                formatDate(session.closed_at)
                                            }}</span>
                                        </div>
                                    </div>
                                    <div
                                        class="mt-1 text-[11px] font-semibold text-slate-400 uppercase"
                                    >
                                        {{
                                            formatDuration(
                                                session.opened_at,
                                                session.closed_at,
                                            )
                                        }}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 text-right font-semibold text-slate-700 tabular-nums dark:text-slate-200"
                                >
                                    {{
                                        formatCurrency(
                                            getExpectedTotal(session),
                                        )
                                    }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right font-semibold text-slate-950 tabular-nums dark:text-white"
                                >
                                    {{
                                        formatCurrency(
                                            getDeclaredTotal(session),
                                        )
                                    }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <div
                                        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1"
                                        :class="
                                            differenceBadgeClass(
                                                getDifference(session),
                                            )
                                        "
                                    >
                                        <TrendingUp
                                            v-if="
                                                getDifference(session) > 0.005
                                            "
                                            :size="13"
                                        />
                                        <TrendingDown
                                            v-else-if="
                                                getDifference(session) < -0.005
                                            "
                                            :size="13"
                                        />
                                        <Minus v-else :size="13" />
                                        {{
                                            getDifference(session) > 0
                                                ? '+'
                                                : ''
                                        }}{{
                                            formatCurrency(
                                                getDifference(session),
                                            )
                                        }}
                                    </div>
                                    <div
                                        class="mt-1 text-[11px] font-semibold text-slate-400"
                                    >
                                        {{
                                            getDifferenceLabel(
                                                getDifference(session),
                                            )
                                        }}
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <button
                                        type="button"
                                        class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1"
                                        :class="statusClass(session.status)"
                                        title="Filtrar por estado"
                                        @click="filterByStatus(session.status)"
                                    >
                                        {{ statusLabel(session.status) }}
                                    </button>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                                        @click="openDetail(session)"
                                    >
                                        <Eye :size="14" />
                                        Ver detalle
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="sessions.length === 0">
                                <td
                                    colspan="7"
                                    class="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                                >
                                    No se encontraron cierres de caja con los
                                    filtros seleccionados.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div
                    v-if="!loading && pagination.last_page > 1"
                    class="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-border"
                >
                    <span class="text-slate-500 dark:text-slate-400"
                        >{{ pagination.total }} cierre(s) en total</span
                    >
                    <div class="flex items-center gap-2">
                        <button
                            :disabled="pagination.current_page <= 1"
                            class="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border dark:text-slate-300 dark:hover:bg-muted"
                            @click="fetchSessions(pagination.current_page - 1)"
                        >
                            Anterior
                        </button>
                        <span class="text-slate-600 dark:text-slate-300"
                            >{{ pagination.current_page }} /
                            {{ pagination.last_page }}</span
                        >
                        <button
                            :disabled="
                                pagination.current_page >= pagination.last_page
                            "
                            class="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border dark:text-slate-300 dark:hover:bg-muted"
                            @click="fetchSessions(pagination.current_page + 1)"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <SessionDetailModal
            v-if="showDetailModal"
            :session="selectedSession"
            :sales-orders="selectedSalesOrders"
            :cash-movements="selectedCashMovements"
            :loading="loadingDetail"
            @close="closeDetail"
        />
    </AppLayout>
</template>
