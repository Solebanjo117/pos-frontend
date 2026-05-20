<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import {
    AlertCircle,
    Box,
    Calendar,
    ChevronDown,
    ChevronRight,
    CreditCard,
    DollarSign,
    ReceiptText,
    RefreshCw,
    Tag,
    TrendingDown,
    TrendingUp,
    Warehouse as WarehouseIcon,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useReports } from '@/composables/useReports';
import { InventoryApiService } from '@/services/inventory';
import { type BreadcrumbItem } from '@/types';
import { type FinancialReport } from '@/types/report';

type DatePreset = 'today' | 'week' | 'month' | 'custom';
type StatementView = 'net_profit' | 'income' | 'expenses' | 'categories';
type StatementTone = 'income' | 'expense' | 'profit' | 'balance' | 'neutral';
type OperationalExpenseCategory =
    FinancialReport['operational_expenses']['by_category'][number];
type FinancialTimelineRow = FinancialReport['timeline'][number];
type VisibleTimelineRow = FinancialTimelineRow & {
    value: number;
    label: string;
};

interface StatementRow {
    key: string;
    label: string;
    amount: number;
    detail?: string;
    tone: StatementTone;
    path?: string;
    children?: StatementRow[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/financial' },
    { title: 'Finanzas y Rentabilidad', href: '/reports/financial' },
];

const {
    financialReport,
    brandProfitabilityReport,
    categoryProfitabilityReport,
    loading,
    error,
    fetchFinancialReport,
    fetchBrandProfitability,
    fetchCategoryProfitability,
} = useReports();

const { currentWarehouseId, initWarehouse } = usePosSettings();

const warehouses = ref<any[]>([]);
const activePreset = ref<DatePreset>('month');
const activeView = ref<StatementView>('net_profit');
const expandedRows = ref<Set<string>>(
    new Set(['income', 'expenses', 'operational-expenses']),
);

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const filters = ref({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    warehouse_id: null as number | null,
});

const statementViews: Array<{ key: StatementView; label: string }> = [
    { key: 'net_profit', label: 'Utilidad neta' },
    { key: 'income', label: 'Ingresos' },
    { key: 'expenses', label: 'Gastos' },
    { key: 'categories', label: 'Categorias' },
];

const loadWarehouses = async () => {
    try {
        warehouses.value = await InventoryApiService.getWarehouses();
    } catch (e) {
        console.error('Failed to load warehouses', e);
    }
};

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const selectedWarehouseLabel = computed(() => {
    if (!filters.value.warehouse_id) {
        return 'Todas las sucursales';
    }

    return (
        warehouses.value.find(
            (warehouse) => warehouse.id === filters.value.warehouse_id,
        )?.name ?? `Sucursal #${filters.value.warehouse_id}`
    );
});

const setPreset = (preset: DatePreset) => {
    activePreset.value = preset;
    const now = new Date();

    switch (preset) {
        case 'today':
            filters.value.date_from = now.toISOString().split('T')[0];
            filters.value.date_to = now.toISOString().split('T')[0];
            break;
        case 'week': {
            const monday = new Date(now);
            monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            filters.value.date_from = monday.toISOString().split('T')[0];
            filters.value.date_to = now.toISOString().split('T')[0];
            break;
        }
        case 'month': {
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            filters.value.date_from = first.toISOString().split('T')[0];
            filters.value.date_to = now.toISOString().split('T')[0];
            break;
        }
        case 'custom':
            break;
    }

    applyFilters();
};

onMounted(async () => {
    await Promise.all([initWarehouse(), loadWarehouses()]);
    filters.value.warehouse_id = currentWarehouseId.value;
    await applyFilters();
});

watch(currentWarehouseId, (val) => {
    if (val && val !== filters.value.warehouse_id) {
        filters.value.warehouse_id = val;
        applyFilters();
    }
});

const applyFilters = async () => {
    if (!filters.value.date_from || !filters.value.date_to) {
        return;
    }

    await Promise.all([
        fetchFinancialReport(filters.value),
        fetchBrandProfitability(filters.value),
        fetchCategoryProfitability(filters.value),
    ]);
};

const onWarehouseChange = () => {
    applyFilters();
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value || 0);

const formatPercent = (value: number) => `${(value || 0).toFixed(2)}%`;

const formatShortDate = (date: string) =>
    new Intl.DateTimeFormat('es-PA', {
        month: 'short',
        day: '2-digit',
    }).format(new Date(`${date}T00:00:00`));

const summary = computed(() => financialReport.value?.summary);

const operationalExpenseCategories = computed<OperationalExpenseCategory[]>(
    () => financialReport.value?.operational_expenses?.by_category || [],
);

const creditBalances = computed(
    () =>
        financialReport.value?.credit_balances ?? {
            accounts_receivable: {
                total_open_balance: 0,
                open_documents_count: 0,
                accounts_count: 0,
            },
            accounts_payable: {
                total_open_balance: 0,
                open_documents_count: 0,
                accounts_count: 0,
            },
        },
);

const reportQuery = computed(() => {
    const query: Record<string, string | number> = {
        date_from: filters.value.date_from,
        date_to: filters.value.date_to,
    };

    if (filters.value.warehouse_id) {
        query.warehouse_id = filters.value.warehouse_id;
    }

    return query;
});

const goToDetail = (
    path: string,
    extra: Record<string, string | number> = {},
) => {
    router.visit(path, {
        data: {
            ...reportQuery.value,
            ...extra,
        },
    });
};

const toggleRow = (key: string) => {
    const next = new Set(expandedRows.value);

    if (next.has(key)) {
        next.delete(key);
    } else {
        next.add(key);
    }

    expandedRows.value = next;
};

const rowToneClass = (tone: StatementTone) => {
    const classes: Record<StatementTone, string> = {
        income: 'text-blue-700 dark:text-blue-300',
        expense: 'text-rose-700 dark:text-rose-300',
        profit: 'text-emerald-700 dark:text-emerald-300',
        balance: 'text-cyan-700 dark:text-cyan-300',
        neutral: 'text-gray-700 dark:text-gray-200',
    };

    return classes[tone];
};

const amountToneClass = (row: StatementRow) => {
    if (row.tone === 'profit') {
        return row.amount >= 0
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-rose-700 dark:text-rose-300';
    }

    return rowToneClass(row.tone);
};

const topMetrics = computed(() => {
    if (!summary.value) {
        return [];
    }

    return [
        {
            label: 'Ingresos cobrados',
            value: summary.value.total_revenue,
            detail: `${summary.value.orders_count} ordenes`,
            icon: DollarSign,
            tone: 'blue',
            path: '/sales-orders',
        },
        {
            label: 'Utilidad bruta',
            value: summary.value.gross_profit,
            detail: `Margen neto ${formatPercent(summary.value.margin_percentage)}`,
            icon: TrendingUp,
            tone: summary.value.gross_profit >= 0 ? 'emerald' : 'rose',
        },
        {
            label: 'Gastos operativos',
            value: summary.value.total_operational_expenses,
            detail: `${operationalExpenseCategories.value.length} categorias`,
            icon: ReceiptText,
            tone: 'amber',
            path: '/operational-expenses',
        },
        {
            label: 'Utilidad neta',
            value: summary.value.net_profit,
            detail: 'Despues de costos y gastos',
            icon: summary.value.net_profit >= 0 ? TrendingUp : TrendingDown,
            tone: summary.value.net_profit >= 0 ? 'emerald' : 'rose',
        },
    ];
});

const incomeRows = computed<StatementRow[]>(() => {
    if (!summary.value) {
        return [];
    }

    return [
        {
            key: 'income',
            label: 'Ingresos',
            amount: summary.value.total_revenue - summary.value.total_refunds,
            detail: 'Ventas cobradas menos devoluciones aprobadas',
            tone: 'income',
            children: [
                {
                    key: 'income-sales',
                    label: 'Ventas cobradas',
                    amount: summary.value.total_revenue,
                    detail: `${summary.value.orders_count} ordenes`,
                    tone: 'income',
                    path: '/sales-orders',
                },
                {
                    key: 'income-refunds',
                    label: 'Devoluciones aprobadas',
                    amount: -summary.value.total_refunds,
                    detail: 'Contra-ingreso del periodo',
                    tone: 'expense',
                },
                {
                    key: 'income-tax',
                    label: 'ITBM cobrado',
                    amount: summary.value.total_tax,
                    detail: 'Dato informativo, no altera utilidad neta',
                    tone: 'neutral',
                },
                {
                    key: 'income-discounts',
                    label: 'Descuentos aplicados',
                    amount: -summary.value.total_discounts,
                    detail: 'Dato informativo del periodo',
                    tone: 'neutral',
                },
            ],
        },
    ];
});

const expenseRows = computed<StatementRow[]>(() => {
    if (!summary.value) {
        return [];
    }

    return [
        {
            key: 'expenses',
            label: 'Gastos',
            amount:
                summary.value.total_cogs +
                summary.value.total_operational_expenses,
            detail: 'Costo de mercancia mas gastos operativos',
            tone: 'expense',
            children: [
                {
                    key: 'expenses-cogs',
                    label: 'Costo de mercancia',
                    amount: summary.value.total_cogs,
                    detail: 'COGS registrado en lineas vendidas',
                    tone: 'expense',
                    path: '/reports/movement-history',
                },
                {
                    key: 'operational-expenses',
                    label: 'Gastos operativos',
                    amount: summary.value.total_operational_expenses,
                    detail: `${operationalExpenseCategories.value.length} categorias`,
                    tone: 'expense',
                    path: '/operational-expenses',
                    children: operationalExpenseCategories.value.map(
                        (category) => ({
                            key: `expense-category-${category.category}`,
                            label: category.label,
                            amount: category.amount,
                            detail: `${category.count} registros`,
                            tone: 'expense',
                            path: '/operational-expenses',
                        }),
                    ),
                },
            ],
        },
    ];
});

const resultRows = computed<StatementRow[]>(() => {
    if (!summary.value) {
        return [];
    }

    return [
        {
            key: 'gross-profit',
            label: 'Utilidad bruta',
            amount: summary.value.gross_profit,
            detail: 'Ingresos cobrados menos costo y devoluciones',
            tone: 'profit',
        },
        {
            key: 'net-profit',
            label: 'Utilidad neta',
            amount: summary.value.net_profit,
            detail: 'Resultado despues de gastos operativos',
            tone: 'profit',
        },
    ];
});

const openBalanceRows = computed<StatementRow[]>(() => [
    {
        key: 'ar-open-balance',
        label: 'Credito cliente',
        amount: creditBalances.value.accounts_receivable.total_open_balance,
        detail: `${creditBalances.value.accounts_receivable.open_documents_count} docs - ${creditBalances.value.accounts_receivable.accounts_count} clientes`,
        tone: 'balance',
        path: '/accounts-receivable',
    },
    {
        key: 'ap-open-balance',
        label: 'Credito compra',
        amount: creditBalances.value.accounts_payable.total_open_balance,
        detail: `${creditBalances.value.accounts_payable.open_documents_count} docs - ${creditBalances.value.accounts_payable.accounts_count} proveedores`,
        tone: 'balance',
        path: '/accounts-payable',
    },
]);

const timelineRows = computed<FinancialTimelineRow[]>(() => {
    const rows = (
        (financialReport.value?.timeline ?? []) as FinancialTimelineRow[]
    ).slice();

    return rows.sort((a: FinancialTimelineRow, b: FinancialTimelineRow) =>
        a.date.localeCompare(b.date),
    );
});

const visibleTimelineRows = computed<VisibleTimelineRow[]>(() => {
    if (activeView.value === 'income') {
        return timelineRows.value.map((day) => ({
            ...day,
            value: day.revenue,
            label: 'Ingresos',
        }));
    }

    if (activeView.value === 'expenses') {
        return timelineRows.value.map((day) => ({
            ...day,
            value: day.cogs + day.operational_expenses,
            label: 'Gastos',
        }));
    }

    return timelineRows.value.map((day) => ({
        ...day,
        value: day.profit,
        label: 'Utilidad neta',
    }));
});

const maxTimelineValue = computed(() => {
    const values = visibleTimelineRows.value.map((day) => Math.abs(day.value));

    return Math.max(...values, 1);
});

const statementColumns = computed(() => {
    if (activeView.value === 'income') {
        return {
            leftTitle: 'Ingresos',
            leftRows: incomeRows.value,
            rightTitle: 'Resultado',
            rightRows: resultRows.value,
        };
    }

    if (activeView.value === 'expenses') {
        return {
            leftTitle: 'Gastos',
            leftRows: expenseRows.value,
            rightTitle: 'Resultado',
            rightRows: resultRows.value,
        };
    }

    if (activeView.value === 'categories') {
        return {
            leftTitle: 'Gastos por categoria',
            leftRows: expenseRows.value[0]?.children?.[1]?.children || [],
            rightTitle: 'Rentabilidad',
            rightRows: resultRows.value,
        };
    }

    return {
        leftTitle: 'Ingresos',
        leftRows: incomeRows.value,
        rightTitle: 'Gastos',
        rightRows: expenseRows.value,
    };
});

const topBrands = computed(() =>
    (brandProfitabilityReport.value || []).slice(0, 5),
);
const topCategories = computed(() =>
    (categoryProfitabilityReport.value || []).slice(0, 5),
);
</script>

<template>
    <Head title="Reporte Financiero" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-4 p-4">
            <div
                class="flex flex-col gap-3 border-b border-gray-200 pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-border"
            >
                <div>
                    <h1
                        class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                        <DollarSign :size="26" class="text-emerald-600" />
                        Estado de resultados
                    </h1>
                    <div
                        class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                    >
                        <span class="inline-flex items-center gap-1">
                            <Calendar :size="14" />
                            {{ filters.date_from }} - {{ filters.date_to }}
                        </span>
                        <span class="text-gray-300 dark:text-gray-600">/</span>
                        <span class="inline-flex items-center gap-1">
                            <WarehouseIcon :size="14" />
                            {{ selectedWarehouseLabel }}
                        </span>
                    </div>
                </div>

                <div
                    class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 xl:flex-row xl:items-end dark:border-border dark:bg-card"
                >
                    <div>
                        <label
                            class="mb-1 block text-[11px] font-semibold text-gray-500 uppercase dark:text-gray-400"
                        >
                            Periodo
                        </label>
                        <div class="flex flex-wrap gap-1">
                            <button
                                v-for="preset in [
                                    { key: 'today', label: 'Hoy' },
                                    { key: 'week', label: 'Semana' },
                                    { key: 'month', label: 'Mes' },
                                    { key: 'custom', label: 'Manual' },
                                ]"
                                :key="preset.key"
                                type="button"
                                class="rounded-md px-3 py-2 text-sm font-medium transition"
                                :class="
                                    activePreset === preset.key
                                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-muted dark:text-gray-300'
                                "
                                @click="setPreset(preset.key as DatePreset)"
                            >
                                {{ preset.label }}
                            </button>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <div>
                            <label
                                class="mb-1 block text-[11px] font-semibold text-gray-500 uppercase dark:text-gray-400"
                            >
                                Desde
                            </label>
                            <input
                                v-model="filters.date_from"
                                type="date"
                                class="h-10 w-36 rounded-md border border-gray-300 px-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                @change="activePreset = 'custom'"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1 block text-[11px] font-semibold text-gray-500 uppercase dark:text-gray-400"
                            >
                                Hasta
                            </label>
                            <input
                                v-model="filters.date_to"
                                type="date"
                                class="h-10 w-36 rounded-md border border-gray-300 px-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                @change="activePreset = 'custom'"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-[11px] font-semibold text-gray-500 uppercase dark:text-gray-400"
                        >
                            Sucursal
                        </label>
                        <SearchableSelect
                            v-model="filters.warehouse_id"
                            :options="warehouseOptions"
                            placeholder="Todas"
                            class="w-44"
                            @update:model-value="onWarehouseChange"
                        />
                    </div>

                    <button
                        v-if="activePreset === 'custom'"
                        type="button"
                        class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
                        @click="applyFilters"
                    >
                        <RefreshCw :size="15" />
                        Aplicar
                    </button>
                </div>
            </div>

            <div
                v-if="error"
                class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
            >
                <AlertCircle :size="20" />
                {{ error }}
            </div>

            <div v-if="loading" class="flex items-center justify-center py-16">
                <div
                    class="flex items-center gap-3 text-gray-500 dark:text-gray-400"
                >
                    <RefreshCw :size="20" class="animate-spin" />
                    Cargando datos financieros...
                </div>
            </div>

            <template v-else-if="financialReport?.summary">
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <button
                        v-for="metric in topMetrics"
                        :key="metric.label"
                        type="button"
                        class="rounded-lg border border-gray-200 bg-white p-4 text-left transition dark:border-border dark:bg-card"
                        :class="
                            metric.path
                                ? 'hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20'
                                : ''
                        "
                        @click="metric.path ? goToDetail(metric.path) : null"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                                >
                                    {{ metric.label }}
                                </p>
                                <p
                                    class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white"
                                >
                                    {{ formatCurrency(metric.value) }}
                                </p>
                            </div>
                            <component
                                :is="metric.icon"
                                :size="22"
                                :class="{
                                    'text-blue-600': metric.tone === 'blue',
                                    'text-emerald-600':
                                        metric.tone === 'emerald',
                                    'text-rose-600': metric.tone === 'rose',
                                    'text-amber-600': metric.tone === 'amber',
                                }"
                            />
                        </div>
                        <p
                            class="mt-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                            {{ metric.detail }}
                        </p>
                    </button>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-border"
                    >
                        <div>
                            <h2
                                class="text-sm font-semibold text-gray-500 uppercase dark:text-gray-400"
                            >
                                Tendencia del periodo
                            </h2>
                            <p
                                class="mt-1 text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                {{
                                    activeView === 'income'
                                        ? 'Ingresos cobrados'
                                        : activeView === 'expenses'
                                          ? 'Costos y gastos'
                                          : 'Utilidad neta diaria'
                                }}
                            </p>
                        </div>

                        <div
                            class="inline-flex w-full overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-1 lg:w-auto dark:border-border dark:bg-muted"
                        >
                            <button
                                v-for="view in statementViews"
                                :key="view.key"
                                type="button"
                                class="rounded px-3 py-1.5 text-sm font-medium whitespace-nowrap transition"
                                :class="
                                    activeView === view.key
                                        ? 'bg-white text-gray-900 shadow-sm dark:bg-background dark:text-white'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
                                "
                                @click="activeView = view.key"
                            >
                                {{ view.label }}
                            </button>
                        </div>
                    </div>

                    <div
                        class="flex h-56 items-end gap-1 overflow-x-auto px-4 pt-6 pb-4"
                    >
                        <div
                            v-for="day in visibleTimelineRows"
                            :key="day.date"
                            class="flex min-w-10 flex-1 flex-col items-center justify-end gap-2"
                            :title="`${formatShortDate(day.date)} · ${day.label}: ${formatCurrency(day.value)}`"
                        >
                            <div
                                class="flex h-40 w-full items-end justify-center border-b border-gray-200 dark:border-border"
                            >
                                <div
                                    class="w-full max-w-8 rounded-t"
                                    :class="
                                        day.value >= 0
                                            ? activeView === 'income'
                                                ? 'bg-blue-500'
                                                : 'bg-emerald-500'
                                            : 'bg-rose-500'
                                    "
                                    :style="{
                                        height: `${Math.max(
                                            8,
                                            (Math.abs(day.value) /
                                                maxTimelineValue) *
                                                150,
                                        )}px`,
                                    }"
                                ></div>
                            </div>
                            <span
                                class="text-[11px] text-gray-500 dark:text-gray-400"
                            >
                                {{ formatShortDate(day.date) }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="grid gap-4 xl:grid-cols-[1fr_1fr]">
                    <section
                        class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-border dark:bg-muted"
                        >
                            <h2
                                class="text-sm font-semibold text-gray-600 uppercase dark:text-gray-300"
                            >
                                {{ statementColumns.leftTitle }}
                            </h2>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full min-w-[520px] text-sm">
                                <tbody>
                                    <template
                                        v-for="row in statementColumns.leftRows"
                                        :key="row.key"
                                    >
                                        <tr
                                            class="border-b border-gray-100 dark:border-border/60"
                                        >
                                            <td class="px-4 py-2">
                                                <button
                                                    v-if="row.children?.length"
                                                    type="button"
                                                    class="mr-1 inline-flex align-middle text-gray-500"
                                                    @click="toggleRow(row.key)"
                                                >
                                                    <ChevronDown
                                                        v-if="
                                                            expandedRows.has(
                                                                row.key,
                                                            )
                                                        "
                                                        :size="15"
                                                    />
                                                    <ChevronRight
                                                        v-else
                                                        :size="15"
                                                    />
                                                </button>
                                                <button
                                                    type="button"
                                                    class="font-medium"
                                                    :class="[
                                                        rowToneClass(row.tone),
                                                        row.path
                                                            ? 'hover:underline'
                                                            : '',
                                                    ]"
                                                    @click="
                                                        row.path
                                                            ? goToDetail(
                                                                  row.path,
                                                              )
                                                            : null
                                                    "
                                                >
                                                    {{ row.label }}
                                                </button>
                                                <p
                                                    v-if="row.detail"
                                                    class="mt-0.5 pl-6 text-xs text-gray-500 dark:text-gray-400"
                                                >
                                                    {{ row.detail }}
                                                </p>
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right font-mono font-semibold"
                                                :class="amountToneClass(row)"
                                            >
                                                {{ formatCurrency(row.amount) }}
                                            </td>
                                        </tr>

                                        <template
                                            v-if="
                                                row.children?.length &&
                                                expandedRows.has(row.key)
                                            "
                                        >
                                            <template
                                                v-for="child in row.children"
                                                :key="child.key"
                                            >
                                                <tr
                                                    class="border-b border-gray-100 bg-gray-50/60 dark:border-border/60 dark:bg-muted/40"
                                                >
                                                    <td class="px-4 py-2 pl-10">
                                                        <button
                                                            v-if="
                                                                child.children
                                                                    ?.length
                                                            "
                                                            type="button"
                                                            class="mr-1 inline-flex align-middle text-gray-500"
                                                            @click="
                                                                toggleRow(
                                                                    child.key,
                                                                )
                                                            "
                                                        >
                                                            <ChevronDown
                                                                v-if="
                                                                    expandedRows.has(
                                                                        child.key,
                                                                    )
                                                                "
                                                                :size="14"
                                                            />
                                                            <ChevronRight
                                                                v-else
                                                                :size="14"
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            class="font-medium"
                                                            :class="[
                                                                rowToneClass(
                                                                    child.tone,
                                                                ),
                                                                child.path
                                                                    ? 'hover:underline'
                                                                    : '',
                                                            ]"
                                                            @click="
                                                                child.path
                                                                    ? goToDetail(
                                                                          child.path,
                                                                      )
                                                                    : null
                                                            "
                                                        >
                                                            {{ child.label }}
                                                        </button>
                                                        <p
                                                            v-if="child.detail"
                                                            class="mt-0.5 pl-5 text-xs text-gray-500 dark:text-gray-400"
                                                        >
                                                            {{ child.detail }}
                                                        </p>
                                                    </td>
                                                    <td
                                                        class="px-4 py-2 text-right font-mono font-semibold"
                                                        :class="
                                                            amountToneClass(
                                                                child,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            formatCurrency(
                                                                child.amount,
                                                            )
                                                        }}
                                                    </td>
                                                </tr>

                                                <tr
                                                    v-for="grandchild in child.children ||
                                                    []"
                                                    v-show="
                                                        expandedRows.has(
                                                            child.key,
                                                        )
                                                    "
                                                    :key="grandchild.key"
                                                    class="border-b border-gray-100 dark:border-border/60"
                                                >
                                                    <td class="px-4 py-2 pl-16">
                                                        <button
                                                            type="button"
                                                            class="font-medium"
                                                            :class="[
                                                                rowToneClass(
                                                                    grandchild.tone,
                                                                ),
                                                                grandchild.path
                                                                    ? 'hover:underline'
                                                                    : '',
                                                            ]"
                                                            @click="
                                                                grandchild.path
                                                                    ? goToDetail(
                                                                          grandchild.path,
                                                                      )
                                                                    : null
                                                            "
                                                        >
                                                            {{
                                                                grandchild.label
                                                            }}
                                                        </button>
                                                        <p
                                                            v-if="
                                                                grandchild.detail
                                                            "
                                                            class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                                                        >
                                                            {{
                                                                grandchild.detail
                                                            }}
                                                        </p>
                                                    </td>
                                                    <td
                                                        class="px-4 py-2 text-right font-mono font-semibold"
                                                        :class="
                                                            amountToneClass(
                                                                grandchild,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            formatCurrency(
                                                                grandchild.amount,
                                                            )
                                                        }}
                                                    </td>
                                                </tr>
                                            </template>
                                        </template>
                                    </template>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section
                        class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-border dark:bg-muted"
                        >
                            <h2
                                class="text-sm font-semibold text-gray-600 uppercase dark:text-gray-300"
                            >
                                {{ statementColumns.rightTitle }}
                            </h2>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full min-w-[420px] text-sm">
                                <tbody>
                                    <tr
                                        v-for="row in statementColumns.rightRows"
                                        :key="row.key"
                                        class="border-b border-gray-100 dark:border-border/60"
                                    >
                                        <td class="px-4 py-3">
                                            <div
                                                class="font-medium"
                                                :class="rowToneClass(row.tone)"
                                            >
                                                {{ row.label }}
                                            </div>
                                            <p
                                                v-if="row.detail"
                                                class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                                            >
                                                {{ row.detail }}
                                            </p>
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right font-mono text-base font-semibold"
                                            :class="amountToneClass(row)"
                                        >
                                            {{ formatCurrency(row.amount) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <section
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="flex flex-col gap-1 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-border"
                    >
                        <div>
                            <h2
                                class="text-sm font-semibold text-gray-600 uppercase dark:text-gray-300"
                            >
                                Saldos abiertos
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Informativo y separado del estado de resultados
                            </p>
                        </div>
                    </div>

                    <div class="grid gap-3 p-4 md:grid-cols-2">
                        <button
                            v-for="row in openBalanceRows"
                            :key="row.key"
                            type="button"
                            class="rounded-lg border border-gray-200 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40 dark:border-border dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20"
                            @click="row.path ? goToDetail(row.path) : null"
                        >
                            <div
                                class="flex items-center justify-between gap-3"
                            >
                                <div>
                                    <p
                                        class="text-sm font-semibold text-gray-900 dark:text-white"
                                    >
                                        {{ row.label }}
                                    </p>
                                    <p
                                        class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        {{ row.detail }}
                                    </p>
                                </div>
                                <CreditCard
                                    v-if="row.key === 'ar-open-balance'"
                                    :size="22"
                                    class="text-cyan-600"
                                />
                                <ReceiptText
                                    v-else
                                    :size="22"
                                    class="text-violet-600"
                                />
                            </div>
                            <p
                                class="mt-3 text-right font-mono text-2xl font-semibold"
                                :class="rowToneClass(row.tone)"
                            >
                                {{ formatCurrency(row.amount) }}
                            </p>
                        </button>
                    </div>
                </section>

                <section class="grid gap-4 xl:grid-cols-2">
                    <div
                        class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-border"
                        >
                            <Tag :size="18" class="text-indigo-600" />
                            <h2
                                class="text-sm font-semibold text-gray-600 uppercase dark:text-gray-300"
                            >
                                Top marcas por rentabilidad
                            </h2>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full min-w-[420px] text-sm">
                                <thead>
                                    <tr
                                        class="border-b border-gray-100 text-xs text-gray-500 uppercase dark:border-border/60"
                                    >
                                        <th class="px-4 py-2 text-left">
                                            Marca
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Ganancia
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Margen
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="brand in topBrands"
                                        :key="
                                            brand.brand_id || brand.brand_name
                                        "
                                        class="border-b border-gray-100 dark:border-border/60"
                                    >
                                        <td class="px-4 py-2 font-medium">
                                            {{ brand.brand_name }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-300"
                                        >
                                            {{ formatCurrency(brand.profit) }}
                                        </td>
                                        <td class="px-4 py-2 text-right">
                                            {{ formatPercent(brand.margin) }}
                                        </td>
                                    </tr>
                                    <tr v-if="!topBrands.length">
                                        <td
                                            colspan="3"
                                            class="px-4 py-8 text-center text-gray-500"
                                        >
                                            Sin datos de marcas para este
                                            periodo
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div
                        class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-border"
                        >
                            <Box :size="18" class="text-amber-600" />
                            <h2
                                class="text-sm font-semibold text-gray-600 uppercase dark:text-gray-300"
                            >
                                Top categorias por rentabilidad
                            </h2>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full min-w-[420px] text-sm">
                                <thead>
                                    <tr
                                        class="border-b border-gray-100 text-xs text-gray-500 uppercase dark:border-border/60"
                                    >
                                        <th class="px-4 py-2 text-left">
                                            Categoria
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Ganancia
                                        </th>
                                        <th class="px-4 py-2 text-right">
                                            Margen
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="category in topCategories"
                                        :key="
                                            category.category_id ||
                                            category.category_name
                                        "
                                        class="border-b border-gray-100 dark:border-border/60"
                                    >
                                        <td class="px-4 py-2 font-medium">
                                            {{ category.category_name }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-300"
                                        >
                                            {{
                                                formatCurrency(category.profit)
                                            }}
                                        </td>
                                        <td class="px-4 py-2 text-right">
                                            {{ formatPercent(category.margin) }}
                                        </td>
                                    </tr>
                                    <tr v-if="!topCategories.length">
                                        <td
                                            colspan="3"
                                            class="px-4 py-8 text-center text-gray-500"
                                        >
                                            Sin datos de categorias para este
                                            periodo
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </template>
        </div>
    </AppLayout>
</template>
