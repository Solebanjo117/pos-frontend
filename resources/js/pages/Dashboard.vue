<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    ArcElement,
    Chart as ChartJS,
    Legend,
    Tooltip,
    type ChartOptions,
} from 'chart.js';
import {
    AlertTriangle,
    ArrowRight,
    Banknote,
    BarChart3,
    CalendarDays,
    ChevronDown,
    CircleDollarSign,
    CreditCard,
    DollarSign,
    FileText,
    GitCompare,
    Package,
    Receipt,
    TrendingDown,
    TrendingUp,
    Users,
    Warehouse as WarehouseIcon,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { Doughnut } from 'vue-chartjs';
import SalesChart from '@/components/dashboard/SalesChart.vue';
import PageShell from '@/components/PageShell.vue';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/composables/useDashboard';
import { usePosSettings } from '@/composables/usePosSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import { dashboard } from '@/routes';
import WarehousesApiService from '@/services/warehouses';
import { type BreadcrumbItem } from '@/types';
import type {
    DashboardFinancialKpi,
    DashboardLatestTransaction,
    DashboardPaymentMethod,
    DashboardTopClient,
} from '@/types/dashboard';
import type { Warehouse } from '@/types/warehouse';

ChartJS.register(ArcElement, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

const {
    stats,
    chartData,
    topProducts,
    lowStockProducts,
    financial,
    loading,
    error,
    fetchDashboardData,
} = useDashboard();

const { currentWarehouseId, initWarehouse } = usePosSettings();

const selectedPeriod = ref('month');
const selectedWarehouseId = ref<number | null>(null);
const compare = ref(true);
const dateFrom = ref('');
const dateTo = ref('');
const initializing = ref(true);
const warehouses = ref<Warehouse[]>([]);

const periodOptions = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'quarter', label: 'Trimestre' },
    { value: 'year', label: 'Año' },
    { value: 'custom', label: 'Custom' },
];

const kpiIcons = {
    total_revenue: DollarSign,
    accounts_receivable: FileText,
    net_profit: TrendingUp,
    cogs_expenses: TrendingDown,
    cash_collected: Banknote,
    inventory_value: Package,
    pending_orders: Receipt,
    low_stock_items: AlertTriangle,
};

const toneClasses: Record<string, string> = {
    blue: 'border-blue-500/40 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    orange: 'border-orange-500/40 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
    emerald:
        'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    red: 'border-red-500/40 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    green: 'border-green-500/40 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
    indigo: 'border-indigo-500/40 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
    sky: 'border-sky-500/40 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    amber: 'border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
};

const financialKpis = computed(() => financial.value?.kpis ?? []);
const paymentMethods = computed(() => financial.value?.payment_methods ?? []);
const topClients = computed(() => financial.value?.top_clients ?? []);
const latestTransactions = computed(
    () => financial.value?.latest_transactions ?? [],
);
const alerts = computed(() => financial.value?.alerts ?? []);
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

const paymentChartData = computed(() => ({
    labels: paymentMethods.value.map((method) => method.label),
    datasets: [
        {
            data: paymentMethods.value.map((method) => method.amount),
            backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#38bdf8'],
            borderWidth: 0,
            hoverOffset: 6,
        },
    ],
}));

const paymentChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            callbacks: {
                label: (context) =>
                    `${context.label}: ${formatCurrency(Number(context.raw) || 0)}`,
            },
        },
    },
}));

const loadDashboard = async () => {
    await fetchDashboardData({
        warehouse_id: selectedWarehouseId.value,
        period: selectedPeriod.value,
        date_from: selectedPeriod.value === 'custom' ? dateFrom.value : '',
        date_to: selectedPeriod.value === 'custom' ? dateTo.value : '',
        compare: compare.value,
    });
};

const loadWarehouses = async () => {
    try {
        warehouses.value = await WarehousesApiService.getAllWarehouses();
    } catch {
        warehouses.value = [];
    }
};

const navigateTo = (path?: string | null) => {
    if (path) {
        router.visit(path);
    }
};

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatDate = (value?: string | null): string => {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleDateString('es-PA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const deltaLabel = (kpi: DashboardFinancialKpi): string => {
    if (!kpi.comparison || kpi.comparison.delta_percentage === null) {
        return 'Sin comparativo';
    }

    const sign = kpi.comparison.delta_percentage > 0 ? '+' : '';
    return `${sign}${kpi.comparison.delta_percentage}% vs periodo anterior`;
};

const deltaIsPositive = (kpi: DashboardFinancialKpi): boolean =>
    Number(kpi.comparison?.delta_percentage ?? 0) >= 0;

const transactionTitle = (transaction: DashboardLatestTransaction): string =>
    transaction.customer_name ||
    transaction.reference ||
    transaction.label ||
    'Transaccion';

const clientProgress = (client: DashboardTopClient): string => {
    const max = topClients.value[0]?.total_revenue || 1;
    return `${Math.max(8, Math.round((client.total_revenue / max) * 100))}%`;
};

onMounted(async () => {
    await Promise.all([initWarehouse(), loadWarehouses()]);
    selectedWarehouseId.value = currentWarehouseId.value ?? null;
    await loadDashboard();
    initializing.value = false;
});

watch([selectedPeriod, selectedWarehouseId, compare], async () => {
    if (!initializing.value && selectedPeriod.value !== 'custom') {
        await loadDashboard();
    }
});
</script>

<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <PageShell
            title="Resumen Financiero"
            description="Ingresos, caja, credito, utilidad y alertas operativas en tiempo real."
            content-class="mx-auto max-w-[1600px]"
        >
            <template #actions>
                <div
                    class="flex flex-wrap items-center justify-end gap-2 text-sm"
                >
                    <button
                        type="button"
                        class="inline-flex h-9 items-center gap-2 rounded-md border px-3 font-medium transition"
                        :class="
                            compare
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200'
                                : 'border-border bg-background text-muted-foreground hover:bg-accent'
                        "
                        @click="compare = !compare"
                    >
                        <GitCompare class="size-4" />
                        Comparar
                    </button>

                    <label
                        class="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground"
                    >
                        <WarehouseIcon class="size-4 text-indigo-500" />
                        <select
                            v-model.number="selectedWarehouseId"
                            class="bg-transparent text-sm font-medium text-foreground outline-none"
                        >
                            <option :value="null">Todas</option>
                            <option
                                v-for="warehouse in warehouses"
                                :key="warehouse.id"
                                :value="warehouse.id"
                            >
                                {{ warehouse.name }}
                            </option>
                        </select>
                        <ChevronDown class="size-3" />
                    </label>

                    <div
                        class="inline-flex overflow-hidden rounded-md border bg-background"
                    >
                        <button
                            v-for="option in periodOptions"
                            :key="option.value"
                            type="button"
                            class="h-9 px-3 text-sm font-medium transition"
                            :class="
                                selectedPeriod === option.value
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            "
                            @click="selectedPeriod = option.value"
                        >
                            {{ option.label }}
                        </button>
                    </div>
                </div>
            </template>

            <section
                v-if="selectedPeriod === 'custom'"
                class="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
            >
                <label class="space-y-1 text-sm">
                    <span class="text-xs font-semibold text-muted-foreground"
                        >Desde</span
                    >
                    <input
                        v-model="dateFrom"
                        type="date"
                        class="h-9 rounded-md border bg-background px-3 text-sm"
                    />
                </label>
                <label class="space-y-1 text-sm">
                    <span class="text-xs font-semibold text-muted-foreground"
                        >Hasta</span
                    >
                    <input
                        v-model="dateTo"
                        type="date"
                        class="h-9 rounded-md border bg-background px-3 text-sm"
                    />
                </label>
                <button
                    type="button"
                    class="h-9 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
                    @click="loadDashboard"
                >
                    Aplicar
                </button>
            </section>

            <section
                class="mb-5 flex flex-col gap-3 rounded-lg border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="flex size-11 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                    >
                        <CircleDollarSign class="size-6" />
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-foreground">
                            {{ activeWarehouseName }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Periodo:
                            {{ formatDate(financial?.period.date_from) }} -
                            {{ formatDate(financial?.period.date_to) }}
                        </p>
                    </div>
                </div>
                <div
                    class="inline-flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-300"
                >
                    <span
                        class="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                    />
                    En vivo con datos reales
                </div>
            </section>

            <section
                v-if="initializing || loading"
                class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
                <Skeleton
                    v-for="item in 8"
                    :key="item"
                    class="h-36 rounded-lg"
                />
            </section>

            <section
                v-else-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
                {{ error }}
            </section>

            <template v-else>
                <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <button
                        v-for="kpi in financialKpis"
                        :key="kpi.key"
                        type="button"
                        class="group min-w-0 rounded-lg border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        :class="toneClasses[kpi.tone] ?? toneClasses.blue"
                        @click="navigateTo(kpi.route)"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p
                                    class="text-xs font-semibold tracking-wide uppercase opacity-75"
                                >
                                    {{ kpi.label }}
                                </p>
                                <p
                                    class="mt-2 text-2xl font-bold break-words text-foreground"
                                >
                                    {{ kpi.formatted_value }}
                                </p>
                            </div>
                            <div
                                class="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/70 dark:bg-slate-950/50"
                            >
                                <component
                                    :is="
                                        kpiIcons[
                                            kpi.key as keyof typeof kpiIcons
                                        ] ?? BarChart3
                                    "
                                    class="size-5"
                                />
                            </div>
                        </div>
                        <div
                            class="mt-3 flex items-center justify-between gap-2 text-xs"
                        >
                            <span
                                class="inline-flex items-center gap-1 font-semibold"
                                :class="
                                    deltaIsPositive(kpi)
                                        ? 'text-emerald-600 dark:text-emerald-300'
                                        : 'text-red-600 dark:text-red-300'
                                "
                            >
                                <component
                                    :is="
                                        deltaIsPositive(kpi)
                                            ? TrendingUp
                                            : TrendingDown
                                    "
                                    class="size-3.5"
                                />
                                {{ deltaLabel(kpi) }}
                            </span>
                            <ArrowRight
                                class="size-4 opacity-0 transition group-hover:opacity-70"
                            />
                        </div>
                    </button>
                </section>

                <section
                    class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
                >
                    <article class="rounded-lg border bg-card p-4 shadow-sm">
                        <div
                            class="mb-3 flex items-center justify-between gap-3"
                        >
                            <div>
                                <h2 class="font-semibold text-foreground">
                                    Ingresos, COGS y utilidad
                                </h2>
                                <p class="text-sm text-muted-foreground">
                                    Tendencia financiera del periodo filtrado.
                                </p>
                            </div>
                            <CalendarDays
                                class="size-5 text-muted-foreground"
                            />
                        </div>
                        <div class="h-80">
                            <SalesChart
                                :data="chartData"
                                :period="selectedPeriod"
                            />
                        </div>
                    </article>

                    <article class="rounded-lg border bg-card p-4 shadow-sm">
                        <div
                            class="mb-3 flex items-center justify-between gap-3"
                        >
                            <div>
                                <h2 class="font-semibold text-foreground">
                                    Métodos de pago
                                </h2>
                                <p class="text-sm text-muted-foreground">
                                    Cobros reales, no crédito pendiente.
                                </p>
                            </div>
                            <CreditCard class="size-5 text-muted-foreground" />
                        </div>
                        <div
                            class="grid gap-4 sm:grid-cols-[180px_1fr] xl:grid-cols-1"
                        >
                            <div class="relative h-52">
                                <Doughnut
                                    v-if="paymentMethods.length > 0"
                                    :data="paymentChartData"
                                    :options="paymentChartOptions"
                                />
                                <div
                                    v-else
                                    class="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
                                >
                                    Sin cobros.
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div
                                    v-for="method in paymentMethods"
                                    :key="method.method"
                                    class="space-y-1"
                                >
                                    <div
                                        class="flex items-center justify-between text-sm"
                                    >
                                        <span class="font-medium">{{
                                            method.label
                                        }}</span>
                                        <span class="tabular-nums">{{
                                            formatCurrency(method.amount)
                                        }}</span>
                                    </div>
                                    <div class="h-2 rounded-full bg-muted">
                                        <div
                                            class="h-full rounded-full bg-indigo-500"
                                            :style="{
                                                width: `${method.percentage}%`,
                                            }"
                                        />
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {{ method.percentage }}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </article>
                </section>

                <section class="mt-6 grid gap-6 xl:grid-cols-3">
                    <article class="rounded-lg border bg-card p-4 shadow-sm">
                        <div
                            class="mb-4 flex items-center justify-between gap-3"
                        >
                            <div>
                                <h2 class="font-semibold text-foreground">
                                    Top 5 clientes
                                </h2>
                                <p class="text-sm text-muted-foreground">
                                    Facturación y pendiente por cliente.
                                </p>
                            </div>
                            <Users class="size-5 text-muted-foreground" />
                        </div>
                        <div class="space-y-4">
                            <button
                                v-for="client in topClients"
                                :key="client.customer_id"
                                type="button"
                                class="w-full rounded-md border bg-background p-3 text-left transition hover:bg-accent"
                                @click="navigateTo(client.route)"
                            >
                                <div
                                    class="flex items-center justify-between gap-3"
                                >
                                    <span
                                        class="min-w-0 truncate text-sm font-semibold"
                                        >{{ client.name }}</span
                                    >
                                    <span
                                        class="text-sm font-bold tabular-nums"
                                        >{{
                                            formatCurrency(client.total_revenue)
                                        }}</span
                                    >
                                </div>
                                <div class="mt-2 h-2 rounded-full bg-muted">
                                    <div
                                        class="h-full rounded-full bg-emerald-500"
                                        :style="{
                                            width: clientProgress(client),
                                        }"
                                    />
                                </div>
                                <div
                                    class="mt-2 flex items-center justify-between text-xs text-muted-foreground"
                                >
                                    <span
                                        >{{
                                            client.orders_count
                                        }}
                                        facturas</span
                                    >
                                    <span
                                        >Pendiente
                                        {{
                                            formatCurrency(
                                                client.pending_amount,
                                            )
                                        }}</span
                                    >
                                </div>
                            </button>
                            <p
                                v-if="topClients.length === 0"
                                class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
                            >
                                Sin clientes en este periodo.
                            </p>
                        </div>
                    </article>

                    <article class="rounded-lg border bg-card p-4 shadow-sm">
                        <div
                            class="mb-4 flex items-center justify-between gap-3"
                        >
                            <div>
                                <h2 class="font-semibold text-foreground">
                                    Últimas transacciones
                                </h2>
                                <p class="text-sm text-muted-foreground">
                                    Cobros recientes del periodo.
                                </p>
                            </div>
                            <Receipt class="size-5 text-muted-foreground" />
                        </div>
                        <div class="space-y-3">
                            <button
                                v-for="transaction in latestTransactions"
                                :key="transaction.id"
                                type="button"
                                class="group grid w-full grid-cols-[1fr_auto] gap-3 rounded-md border bg-background p-3 text-left transition hover:bg-accent"
                                @click="navigateTo(transaction.route)"
                            >
                                <div class="min-w-0">
                                    <p
                                        class="truncate text-sm font-semibold text-foreground"
                                    >
                                        {{ transactionTitle(transaction) }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ transaction.reference }} ·
                                        {{ transaction.label }} ·
                                        {{
                                            formatDate(transaction.occurred_at)
                                        }}
                                    </p>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm font-bold tabular-nums">
                                        {{ formatCurrency(transaction.amount) }}
                                    </p>
                                    <ArrowRight
                                        class="mt-1 ml-auto size-3 opacity-0 transition group-hover:opacity-70"
                                    />
                                </div>
                            </button>
                            <p
                                v-if="latestTransactions.length === 0"
                                class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
                            >
                                Sin transacciones recientes.
                            </p>
                        </div>
                    </article>

                    <div class="space-y-6">
                        <article
                            class="rounded-lg border bg-card p-4 shadow-sm"
                        >
                            <h2 class="font-semibold text-foreground">
                                Alertas
                            </h2>
                            <div class="mt-4 space-y-3">
                                <button
                                    v-for="alert in alerts"
                                    :key="alert.type"
                                    type="button"
                                    class="flex w-full items-center justify-between gap-3 rounded-md border bg-background p-3 text-left transition hover:bg-accent"
                                    @click="navigateTo(alert.route)"
                                >
                                    <div class="flex items-center gap-3">
                                        <AlertTriangle
                                            class="size-5 text-amber-500"
                                        />
                                        <span class="text-sm font-medium">{{
                                            alert.label
                                        }}</span>
                                    </div>
                                    <span class="font-bold tabular-nums">{{
                                        alert.value
                                    }}</span>
                                </button>
                                <p
                                    v-if="alerts.length === 0"
                                    class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
                                >
                                    Sin alertas activas.
                                </p>
                            </div>
                        </article>

                        <article
                            class="rounded-lg border bg-card p-4 shadow-sm"
                        >
                            <h2 class="font-semibold text-foreground">
                                Accesos financieros
                            </h2>
                            <div class="mt-4 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    class="rounded-md border bg-background p-3 text-sm font-semibold transition hover:bg-accent"
                                    @click="navigateTo('/reports/financial')"
                                >
                                    Finanzas
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md border bg-background p-3 text-sm font-semibold transition hover:bg-accent"
                                    @click="navigateTo('/ar')"
                                >
                                    CxC
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md border bg-background p-3 text-sm font-semibold transition hover:bg-accent"
                                    @click="navigateTo('/reports/z-report')"
                                >
                                    Caja
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md border bg-background p-3 text-sm font-semibold transition hover:bg-accent"
                                    @click="
                                        navigateTo('/reports/sales-by-client')
                                    "
                                >
                                    Clientes
                                </button>
                            </div>
                        </article>
                    </div>
                </section>

                <section class="mt-6 grid gap-6 lg:grid-cols-2">
                    <article class="rounded-lg border bg-card p-4 shadow-sm">
                        <h2 class="font-semibold text-foreground">
                            Productos más vendidos
                        </h2>
                        <div class="mt-4 space-y-3">
                            <div
                                v-for="product in topProducts"
                                :key="product.name"
                                class="flex items-center justify-between gap-3 rounded-md bg-background p-3 text-sm"
                            >
                                <span class="min-w-0 truncate">{{
                                    product.name
                                }}</span>
                                <span class="font-semibold tabular-nums">{{
                                    product.sales
                                }}</span>
                            </div>
                        </div>
                    </article>

                    <article class="rounded-lg border bg-card p-4 shadow-sm">
                        <h2 class="font-semibold text-foreground">
                            Stock bajo
                        </h2>
                        <div class="mt-4 space-y-3">
                            <div
                                v-for="product in lowStockProducts"
                                :key="`${product.product_id}-${product.sku}`"
                                class="flex items-center justify-between gap-3 rounded-md bg-background p-3 text-sm"
                            >
                                <span class="min-w-0 truncate">{{
                                    product.name
                                }}</span>
                                <span
                                    class="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300"
                                >
                                    {{ product.stock }} uds
                                </span>
                            </div>
                        </div>
                    </article>
                </section>
            </template>
        </PageShell>
    </AppLayout>
</template>
