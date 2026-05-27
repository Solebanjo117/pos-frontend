<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Head } from '@inertiajs/vue3';
import {
    Printer,
    AlertCircle,
    FileText,
    Calendar,
    CreditCard,
    Banknote,
    Wallet,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Receipt,
    ArrowDown,
    ArrowUp,
    Minus,
    Box,
    DollarSign,
    BarChart3,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { useReports } from '@/composables/useReports';
import { useWarehouses } from '@/composables/useWarehouses';
import { useUsers } from '@/composables/useUsers';
import { usePosSettings } from '@/composables/usePosSettings';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/z-report' },
    { title: 'Cierre de Caja', href: '/reports/z-report' },
];

const { zReport, loading, error, fetchZReport, exportZReport } = useReports();
const { warehouses, fetchWarehouses } = useWarehouses();
const { users, fetchUsers } = useUsers();
const { currentWarehouseId, initWarehouse } = usePosSettings();

const selectedDate = ref(new Date().toISOString().split('T')[0]);
const selectedWarehouseId = ref<number | undefined>(undefined);
const selectedUserId = ref<number | undefined>(undefined);
const exporting = ref(false);

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
    get: () => selectedWarehouseId.value ?? null,
    set: (value) => {
        selectedWarehouseId.value = value === null ? undefined : Number(value);
    },
});

const userFilterModel = computed<number | null>({
    get: () => selectedUserId.value ?? null,
    set: (value) => {
        selectedUserId.value = value === null ? undefined : Number(value);
    },
});

onMounted(async () => {
    await initWarehouse();
    if (warehouses.value.length === 0) {
        await fetchWarehouses();
    }
    if (users.value.length === 0) {
        await fetchUsers();
    }
    selectedWarehouseId.value = currentWarehouseId.value || undefined;
    await fetchZReport(
        selectedDate.value,
        selectedWarehouseId.value,
        selectedUserId.value,
    );
});

const applyDate = async () => {
    if (!selectedDate.value) return;
    await fetchZReport(
        selectedDate.value,
        selectedWarehouseId.value,
        selectedUserId.value,
    );
};

const handleExport = async () => {
    exporting.value = true;
    try {
        await exportZReport(
            selectedDate.value,
            selectedWarehouseId.value,
            selectedUserId.value,
        );
    } finally {
        exporting.value = false;
    }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(value || 0);
};

const activeWarehouseName = computed(() => {
    if (!selectedWarehouseId.value) {
        return 'Todas las sucursales';
    }

    return (
        warehouses.value.find(
            (warehouse) => warehouse.id === selectedWarehouseId.value,
        )?.name ?? 'Sucursal seleccionada'
    );
});

const activeUserName = computed(() => {
    if (!selectedUserId.value) {
        return 'Todos los cajeros';
    }

    return (
        users.value.find((user) => user.id === selectedUserId.value)?.name ??
        'Cajero seleccionado'
    );
});

const cashDifference = computed(() =>
    Number(zReport.value?.cash_drawer?.difference || 0),
);

const differenceTone = computed(() => {
    if (cashDifference.value > 0) {
        return 'text-emerald-700 dark:text-emerald-300';
    }

    if (cashDifference.value < 0) {
        return 'text-red-700 dark:text-red-300';
    }

    return 'text-gray-900 dark:text-white';
});

const profitColor = computed(() => {
    const gp = zReport.value?.gross_profit ?? 0;
    return gp >= 0 ? 'emerald' : 'red';
});
</script>

<template>
    <Head title="Cierre de Caja (Z-Report)" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-6 p-4">
            <!-- Header -->
            <div
                class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between dark:border-border dark:bg-card"
            >
                <div>
                    <h1
                        class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                        <Receipt :size="24" class="text-indigo-500" />
                        Cierre de caja
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ selectedDate }} · {{ activeWarehouseName }} ·
                        {{ activeUserName }}
                    </p>
                </div>
                <button
                    @click="handleExport"
                    :disabled="exporting || loading || !zReport"
                    class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                    <Printer :size="16" />
                    Imprimir Z-Report
                </button>
            </div>

            <!-- Error -->
            <div
                v-if="error"
                class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
            >
                <AlertCircle :size="20" />
                {{ error }}
            </div>

            <!-- Filters -->
            <div
                class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
            >
                <div class="flex flex-col items-end gap-4 sm:flex-row">
                    <div>
                        <label
                            class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            <Calendar :size="12" class="mr-1 inline" /> Fecha
                            del Cierre
                        </label>
                        <input
                            v-model="selectedDate"
                            type="date"
                            @change="applyDate"
                            class="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>
                    <div>
                        <label
                            class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Sucursal
                        </label>
                        <SearchableSelect
                            v-model="warehouseFilterModel"
                            :options="warehouseOptions"
                            placeholder="Todas"
                            class="w-40"
                            @update:model-value="applyDate"
                        />
                    </div>
                    <div>
                        <label
                            class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Cajero / Usuario
                        </label>
                        <SearchableSelect
                            v-model="userFilterModel"
                            :options="userOptions"
                            placeholder="Todos"
                            class="w-44"
                            @update:model-value="applyDate"
                        />
                    </div>
                    <button
                        @click="applyDate"
                        class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        <RefreshCw :size="16" />
                        Cargar
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-16">
                <div
                    class="flex items-center gap-3 text-gray-500 dark:text-gray-400"
                >
                    <RefreshCw :size="20" class="animate-spin" />
                    Cargando Z-Report...
                </div>
            </div>

            <template v-else-if="zReport">
                <!-- ============================== -->
                <!-- SECTION A: ARQUEO DE EFECTIVO  -->
                <!-- ============================== -->
                <div
                    class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                >
                    <h3
                        class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        <Wallet :size="20" class="text-green-500" />
                        Arqueo de Efectivo
                    </h3>
                    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                        <!-- Fondo de Apertura -->
                        <div
                            class="rounded-lg border-l-4 border-gray-400 bg-gray-50 p-4 dark:bg-muted/50"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                            >
                                <Banknote :size="14" />
                                Fondo de Apertura
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        zReport.cash_drawer?.opening_amount ||
                                            0,
                                    )
                                }}
                            </p>
                        </div>
                        <!-- Ventas en Efectivo -->
                        <div
                            class="rounded-lg border-l-4 border-green-500 bg-green-50 p-4 dark:bg-green-900/20"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
                            >
                                <ArrowUp :size="14" />
                                Entradas (Efectivo)
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-green-700 dark:text-green-300"
                            >
                                +
                                {{
                                    formatCurrency(
                                        zReport.cash_drawer?.cash_sales || 0,
                                    )
                                }}
                            </p>
                        </div>
                        <!-- Devoluciones en Efectivo -->
                        <div
                            class="rounded-lg border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-900/20"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
                            >
                                <ArrowDown :size="14" />
                                Salidas (Devoluciones)
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-red-700 dark:text-red-300"
                            >
                                -
                                {{
                                    formatCurrency(
                                        zReport.cash_drawer?.cash_refunds || 0,
                                    )
                                }}
                            </p>
                        </div>
                        <!-- Efectivo Esperado -->
                        <div
                            class="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-4 dark:bg-indigo-900/20"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 dark:text-primary"
                            >
                                <DollarSign :size="14" />
                                Efectivo Esperado
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-300"
                            >
                                {{
                                    formatCurrency(
                                        zReport.cash_drawer?.expected_cash || 0,
                                    )
                                }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border-l-4 border-gray-500 bg-gray-50 p-4 dark:bg-muted/50"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                            >
                                <Wallet :size="14" />
                                Contado / Cerrado
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        zReport.cash_drawer?.declared_cash ||
                                            zReport.cash_drawer
                                                ?.closing_amount ||
                                            0,
                                    )
                                }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border-l-4 border-slate-500 bg-slate-50 p-4 dark:bg-muted/50"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                            >
                                <Minus :size="14" />
                                Diferencia
                            </div>
                            <p
                                class="mt-1 text-xl font-bold"
                                :class="differenceTone"
                            >
                                {{ cashDifference > 0 ? '+' : ''
                                }}{{ formatCurrency(cashDifference) }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                {{ zReport.cash_drawer?.sessions_count || 0 }}
                                cierres
                            </p>
                        </div>
                    </div>

                    <!-- Cash Movements (Retiros / Ingresos extra) -->
                    <div
                        v-if="
                            (zReport.cash_drawer?.cash_movements_in || 0) > 0 ||
                            (zReport.cash_drawer?.cash_movements_out || 0) > 0
                        "
                        class="mt-3 grid gap-3 sm:grid-cols-2"
                    >
                        <div
                            v-if="
                                (zReport.cash_drawer?.cash_movements_in || 0) >
                                0
                            "
                            class="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-900/20"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                            >
                                <ArrowUp :size="14" />
                                Ingresos Extra (Mov. Caja)
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300"
                            >
                                +
                                {{
                                    formatCurrency(
                                        zReport.cash_drawer
                                            ?.cash_movements_in || 0,
                                    )
                                }}
                            </p>
                        </div>
                        <div
                            v-if="
                                (zReport.cash_drawer?.cash_movements_out || 0) >
                                0
                            "
                            class="rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4 dark:bg-orange-900/20"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400"
                            >
                                <ArrowDown :size="14" />
                                Salidas / Retiros (Mov. Caja)
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-orange-700 dark:text-orange-300"
                            >
                                -
                                {{
                                    formatCurrency(
                                        zReport.cash_drawer
                                            ?.cash_movements_out || 0,
                                    )
                                }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="zReport.by_user?.length"
                        class="mt-5 overflow-x-auto rounded-lg border border-gray-200 dark:border-border"
                    >
                        <table class="w-full">
                            <thead class="bg-gray-50 dark:bg-muted">
                                <tr>
                                    <th
                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
                                    >
                                        Cajero
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
                                    >
                                        Cierres
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
                                    >
                                        Esperado
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
                                    >
                                        Contado
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
                                    >
                                        Diferencia
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-gray-200 dark:divide-border"
                            >
                                <tr
                                    v-for="row in zReport.by_user"
                                    :key="row.user_id"
                                    class="hover:bg-gray-50 dark:hover:bg-muted/50"
                                >
                                    <td
                                        class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white"
                                    >
                                        {{ row.user_name || 'Sin usuario' }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300"
                                    >
                                        {{ row.sessions_count }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300"
                                    >
                                        {{ formatCurrency(row.expected_cash) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300"
                                    >
                                        {{
                                            formatCurrency(
                                                row.declared_cash ||
                                                    row.closing_amount ||
                                                    0,
                                            )
                                        }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm font-semibold"
                                        :class="
                                            row.difference > 0
                                                ? 'text-emerald-700 dark:text-emerald-300'
                                                : row.difference < 0
                                                  ? 'text-red-700 dark:text-red-300'
                                                  : 'text-gray-900 dark:text-white'
                                        "
                                    >
                                        {{ row.difference > 0 ? '+' : ''
                                        }}{{ formatCurrency(row.difference) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ====================================== -->
                <!-- SECTION B: ESTADO DE RESULTADOS DIARIO -->
                <!-- ====================================== -->
                <div
                    class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                >
                    <h3
                        class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        <BarChart3 :size="20" class="text-blue-500" />
                        Estado de Resultados del Día
                    </h3>

                    <!-- Top Row: Revenue breakdown -->
                    <div class="mb-4 grid gap-4 sm:grid-cols-4">
                        <!-- Ventas Brutas -->
                        <div
                            class="rounded-xl border-l-4 border-blue-500 bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-muted/50 dark:ring-gray-600"
                        >
                            <p
                                class="text-sm font-medium text-gray-500 dark:text-gray-400"
                            >
                                Ventas Brutas
                            </p>
                            <p
                                class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(zReport.total_sales) }}
                            </p>
                            <p class="mt-0.5 text-xs text-gray-400">
                                {{ zReport.orders_count }} transacciones
                            </p>
                        </div>
                        <!-- Devoluciones -->
                        <div
                            class="rounded-xl border-l-4 border-orange-500 bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-muted/50 dark:ring-gray-600"
                        >
                            <p
                                class="text-sm font-medium text-gray-500 dark:text-gray-400"
                            >
                                Devoluciones
                            </p>
                            <p
                                class="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400"
                            >
                                {{ formatCurrency(zReport.refunds) }}
                            </p>
                        </div>
                        <!-- Descuentos -->
                        <div
                            class="rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-muted/50 dark:ring-gray-600"
                        >
                            <p
                                class="text-sm font-medium text-gray-500 dark:text-gray-400"
                            >
                                Descuentos
                            </p>
                            <p
                                class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400"
                            >
                                {{ formatCurrency(zReport.total_discounts) }}
                            </p>
                        </div>
                        <!-- Ventas Netas -->
                        <div
                            class="rounded-xl border-l-4 border-emerald-500 bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-muted/50 dark:ring-gray-600"
                        >
                            <p
                                class="text-sm font-medium text-gray-500 dark:text-gray-400"
                            >
                                Ventas Netas
                            </p>
                            <p
                                class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400"
                            >
                                {{ formatCurrency(zReport.net_sales) }}
                            </p>
                        </div>
                    </div>

                    <!-- Bottom Row: COGS + Gross Profit + Ticket Avg -->
                    <div class="grid gap-4 sm:grid-cols-3">
                        <div class="rounded-lg bg-gray-50 p-4 dark:bg-muted/30">
                            <div
                                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                            >
                                <Box :size="14" />
                                Costo de Mercancía (COGS)
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-red-600 dark:text-red-400"
                            >
                                {{ formatCurrency(zReport.cogs) }}
                            </p>
                        </div>
                        <div class="rounded-lg bg-gray-50 p-4 dark:bg-muted/30">
                            <div
                                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                            >
                                <TrendingUp :size="14" />
                                Utilidad Bruta
                            </div>
                            <p
                                class="mt-1 text-xl font-bold"
                                :class="
                                    profitColor === 'emerald'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-red-600 dark:text-red-400'
                                "
                            >
                                {{ formatCurrency(zReport.gross_profit) }}
                            </p>
                        </div>
                        <div class="rounded-lg bg-gray-50 p-4 dark:bg-muted/30">
                            <div
                                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                            >
                                <Receipt :size="14" />
                                Ticket Promedio
                            </div>
                            <p
                                class="mt-1 text-xl font-bold text-indigo-600 dark:text-indigo-400 dark:text-primary"
                            >
                                {{ formatCurrency(zReport.average_ticket) }}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- ====================================== -->
                <!-- SECTION C: DESGLOSE POR MÉTODO DE PAGO -->
                <!-- ====================================== -->
                <div
                    class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700"
                >
                    <div
                        class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-border"
                    >
                        <h3
                            class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            <CreditCard :size="20" class="text-violet-500" />
                            Desglose por Método de Pago
                        </h3>
                        <span
                            class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-muted dark:text-gray-300"
                        >
                            {{ zReport.orders_count }} transacciones
                        </span>
                    </div>

                    <div class="space-y-3 p-5">
                        <!-- Efectivo -->
                        <div
                            class="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-muted/30"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="rounded-lg bg-green-100 p-2 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                                >
                                    <Banknote :size="18" />
                                </div>
                                <div>
                                    <p
                                        class="font-medium text-gray-900 dark:text-white"
                                    >
                                        Efectivo
                                    </p>
                                    <p
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Total recibido en caja
                                    </p>
                                </div>
                            </div>
                            <span
                                class="text-xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        zReport.by_payment_method?.['cash'] ||
                                            0,
                                    )
                                }}
                            </span>
                        </div>

                        <!-- Tarjeta / Transferencia -->
                        <div
                            class="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-muted/30"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 dark:text-primary"
                                >
                                    <CreditCard :size="18" />
                                </div>
                                <div>
                                    <p
                                        class="font-medium text-gray-900 dark:text-white"
                                    >
                                        Tarjeta / Transferencia
                                    </p>
                                    <p
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Pagos electrónicos
                                    </p>
                                </div>
                            </div>
                            <span
                                class="text-xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        (zReport.by_payment_method?.['card'] ||
                                            0) +
                                            (zReport.by_payment_method?.[
                                                'transfer'
                                            ] || 0),
                                    )
                                }}
                            </span>
                        </div>

                        <!-- Crédito -->
                        <div
                            class="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-muted/30"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="rounded-lg bg-orange-100 p-2 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
                                >
                                    <FileText :size="18" />
                                </div>
                                <div>
                                    <p
                                        class="font-medium text-gray-900 dark:text-white"
                                    >
                                        Crédito
                                    </p>
                                    <p
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Cuentas por cobrar
                                    </p>
                                </div>
                            </div>
                            <span
                                class="text-xl font-bold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        zReport.by_payment_method?.['credit'] ||
                                            0,
                                    )
                                }}
                            </span>
                        </div>

                        <!-- Other methods -->
                        <div
                            v-for="(
                                amount, method
                            ) in zReport.by_payment_method"
                            :key="method"
                            v-show="
                                ![
                                    'cash',
                                    'card',
                                    'transfer',
                                    'credit',
                                ].includes(String(method))
                            "
                            class="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-muted/30"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                                >
                                    <FileText :size="18" />
                                </div>
                                <p
                                    class="font-medium text-gray-900 capitalize dark:text-white"
                                >
                                    {{ method || 'Desconocido' }}
                                </p>
                            </div>
                            <span
                                class="text-xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(amount) }}
                            </span>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
