<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import {
    AlertCircle,
    BarChart3,
    Clock,
    FileText,
    Landmark,
    RefreshCw,
    Scale,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import CapitalMovementModal from '@/components/Finance/CapitalMovementModal.vue';
import BusinessDatetimeEditor from '@/components/BusinessDatetimeEditor.vue';
import FinanceAdjustmentModal from '@/components/Finance/FinanceAdjustmentModal.vue';
import FinanceAdvancedAccountingPanel from '@/components/Finance/FinanceAdvancedAccountingPanel.vue';
import FinanceBalanceSheet from '@/components/Finance/FinanceBalanceSheet.vue';
import FinanceDailySummaryTable from '@/components/Finance/FinanceDailySummaryTable.vue';
import FinanceIncomeStatement from '@/components/Finance/FinanceIncomeStatement.vue';
import FinanceKpiRow from '@/components/Finance/FinanceKpiRow.vue';
import FinanceReportShell from '@/components/Finance/FinanceReportShell.vue';
import FinancialDrilldownDrawer from '@/components/Finance/FinancialDrilldownDrawer.vue';
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useReports } from '@/composables/useReports';
import { useStoreSettings } from '@/composables/useStoreSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import { InventoryApiService } from '@/services/inventory';
import type { BreadcrumbItem } from '@/types';
import type { ExpenseBreakdown, FinancialAdjustmentType } from '@/types/report';
import { formatCurrency } from '@/utils/formatters';

type DatePreset = 'today' | 'week' | 'month' | 'custom';
type ReportTab = 'summary' | 'balance' | 'income' | 'credits' | 'investment';
type ReportMode = 'basic' | 'advanced';
type DrilldownFilters = {
    date_from: string;
    date_to: string;
    warehouse_id: number | null;
    expense_category?: string | null;
    expense_group?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/financial' },
    { title: 'Finanzas y Rentabilidad', href: '/reports/financial' },
];

const {
    incomeStatementReport,
    dailySummary,
    balanceSheet,
    financialDrilldown,
    financialAdvancedStatus,
    adjustments,
    capitalMovements,
    loading,
    error,
    fetchIncomeStatement,
    fetchDailySummary,
    fetchBalanceSheet,
    fetchFinancialDrilldown,
    fetchFinancialAdvancedStatus,
    storeAdjustment,
    fetchAdjustments,
    storeCapitalMovement,
    fetchCapitalMovements,
} = useReports();
const { currentWarehouseId, initWarehouse } = usePosSettings();
const { fetchSettings: fetchStoreSettings } = useStoreSettings();

const warehouses = ref<any[]>([]);
const activePreset = ref<DatePreset>('month');
const activeTab = ref<ReportTab>('summary');
const activeMode = ref<ReportMode>('basic');
const adjustmentOpen = ref(false);
const adjustmentType = ref<FinancialAdjustmentType>('cash');
const capitalMovementOpen = ref(false);
const capitalMovementType = ref<'in' | 'out'>('in');
const drilldownOpen = ref(false);
const drilldownLoading = ref(false);
const selectedKpi = ref<{
    key: string;
    label: string;
    value: number;
    metric?: string;
    expense_category?: string | null;
    expense_group?: string | null;
} | null>(null);
const activeDrilldownFilters = ref<DrilldownFilters | null>(null);

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const filters = ref({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    warehouse_id: null as number | null,
});

const tabs: Array<{ key: ReportTab; label: string; icon: any }> = [
    { key: 'summary', label: 'Resumen Diario', icon: BarChart3 },
    { key: 'balance', label: 'Balance Sheet', icon: Scale },
    { key: 'income', label: 'Income Statement', icon: FileText },
    { key: 'credits', label: 'Creditos', icon: Clock },
    { key: 'investment', label: 'Inversion', icon: Landmark },
];
const datePresets: Array<{ key: DatePreset; label: string }> = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'custom', label: 'Manual' },
];

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const selectedWarehouseLabel = computed(() => {
    if (!filters.value.warehouse_id) return 'Todas las sucursales';
    return (
        warehouses.value.find(
            (warehouse) => warehouse.id === filters.value.warehouse_id,
        )?.name ?? `Sucursal #${filters.value.warehouse_id}`
    );
});

const kpis = computed(() => {
    const totals = dailySummary.value?.totals ?? {};
    const credits = incomeStatementReport.value?.credit_balances ?? {};

    return [
        {
            key: 'inventory',
            label: 'Inventario',
            value: totals.inventory ?? 0,
            metric: 'inventory',
        },
        {
            key: 'sales',
            label: 'Ventas',
            value: totals.sales_total ?? totals.sales ?? 0,
            metric: 'sales',
        },
        {
            key: 'sales_collected',
            label: 'Cobrado',
            value: totals.sales_collected ?? 0,
            metric: 'payments_received',
        },
        {
            key: 'receivable',
            label: 'CxC',
            value:
                totals.accounts_receivable ??
                credits.accounts_receivable?.total_open_balance ??
                0,
            metric: 'receivable',
        },
        {
            key: 'cogs',
            label: 'COGS',
            value: totals.cogs ?? 0,
            metric: 'cogs',
        },
        {
            key: 'purchase',
            label: 'Compras',
            value: totals.purchase ?? 0,
            metric: 'purchases',
        },
        {
            key: 'purchase_paid',
            label: 'Pagado',
            value: totals.purchase_paid ?? 0,
            metric: 'supplier_payments',
        },
        {
            key: 'payable',
            label: 'CxP',
            value:
                totals.accounts_payable ??
                credits.accounts_payable?.total_open_balance ??
                0,
            metric: 'payable',
        },
        {
            key: 'expenses',
            label: 'Gastos',
            value: totals.expenses ?? 0,
            metric: 'expenses',
        },
        {
            key: 'profit',
            label: 'Profit',
            value: totals.net_profit ?? totals.profit ?? 0,
            metric: 'profit',
        },
    ];
});

const warningLabels: Record<string, string> = {
    inventory_historical_value_uses_current_fifo_lot_availability:
        'Inventario historico estimado con disponibilidad FIFO actual.',
};

const financeWarnings = computed(() =>
    [
        ...(dailySummary.value?.warnings ?? []),
        ...(balanceSheet.value?.warnings ?? []),
    ].filter((warning, index, all) => all.indexOf(warning) === index),
);

const incomeSummary = computed(() => incomeStatementReport.value?.summary);
const expenseBreakdown = computed<ExpenseBreakdown | null>(
    () => incomeStatementReport.value?.expense_breakdown ?? null,
);

const topExpenses = computed(() => {
    const breakdown = expenseBreakdown.value;
    if (!breakdown) return [];
    return [...breakdown.items, breakdown.other]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
});

const investmentTotals = computed(() => {
    const totals = dailySummary.value?.totals ?? {};

    return {
        investmentIn: totals.investment_in ?? 0,
        investmentOut: totals.investment_out ?? 0,
        netInvestment: totals.net_investment ?? totals.investment ?? 0,
        closingCash: totals.closing_cash ?? totals.cash ?? 0,
    };
});

const creditSections = computed(() => {
    const credits = incomeStatementReport.value?.credit_balances ?? {};

    return [
        {
            key: 'receivable',
            title: 'Cuentas por cobrar',
            href: '/ar',
            description: 'Cobros y abonos se operan desde /ar.',
            total: credits.accounts_receivable?.total_open_balance ?? 0,
            count: credits.accounts_receivable?.open_documents_count ?? 0,
            documents: credits.accounts_receivable?.documents ?? [],
        },
        {
            key: 'payable',
            title: 'Cuentas por pagar',
            href: '/accounts-payable',
            description: 'Pagos a proveedores se operan desde /accounts-payable.',
            total: credits.accounts_payable?.total_open_balance ?? 0,
            count: credits.accounts_payable?.open_documents_count ?? 0,
            documents: credits.accounts_payable?.documents ?? [],
        },
    ];
});

const formatCreditDate = (value?: string | null): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('es-PA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
};

const loadWarehouses = async (): Promise<void> => {
    try {
        warehouses.value = await InventoryApiService.getWarehouses();
    } catch (err) {
        console.error('Error loading warehouses:', err);
        warehouses.value = [];
    }
};

const loadReports = async (): Promise<void> => {
    if (!filters.value.date_from || !filters.value.date_to) return;

    // Heavy report endpoints are proxied to the backend and can be slow on
    // wide date ranges. Use allSettled so one failing/timed-out report does
    // not break the whole Finance page, and surface a single soft error.
    const results = await Promise.allSettled([
        fetchDailySummary(filters.value),
        fetchIncomeStatement({
            ...filters.value,
            basis: 'cash',
            compare: 'none',
        }),
        fetchBalanceSheet(filters.value),
        fetchAdjustments(filters.value),
        fetchCapitalMovements(filters.value),
        fetchFinancialAdvancedStatus(),
    ]);

    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0 && !error.value) {
        error.value =
            'Algunos datos financieros no se pudieron cargar. Revisa la conexión o reduce el rango de fechas e intenta de nuevo.';
    }
};

const openDrilldown = async (
    kpi: {
        key: string;
        label: string;
        value: number;
        metric?: string;
        expense_category?: string | null;
        expense_group?: string | null;
    },
    page = 1,
    overrideFilters: DrilldownFilters | null = null,
): Promise<void> => {
    selectedKpi.value = kpi;
    activeDrilldownFilters.value =
        overrideFilters ??
        activeDrilldownFilters.value ?? {
            date_from: filters.value.date_from,
            date_to: filters.value.date_to,
            warehouse_id: filters.value.warehouse_id,
            expense_category: kpi.expense_category,
            expense_group: kpi.expense_group,
        };
    drilldownOpen.value = true;
    drilldownLoading.value = true;

    try {
        await fetchFinancialDrilldown({
            metric: kpi.metric ?? kpi.key,
            ...activeDrilldownFilters.value,
            page,
            per_page: 25,
        });
    } finally {
        drilldownLoading.value = false;
    }
};

const changeDrilldownPage = (page: number): void => {
    if (!selectedKpi.value) return;
    void openDrilldown(selectedKpi.value, page, activeDrilldownFilters.value);
};

const openKpiDrilldown = (
    kpi: {
        key?: string;
        label: string;
        value: number;
        metric?: string;
        expense_category?: string | null;
        expense_group?: string | null;
    },
): void => {
    void openDrilldown(
        {
            key: kpi.key ?? kpi.metric ?? kpi.label,
            label: kpi.label,
            value: kpi.value,
            metric: kpi.metric,
            expense_category: kpi.expense_category,
            expense_group: kpi.expense_group,
        },
        1,
        {
            date_from: filters.value.date_from,
            date_to: filters.value.date_to,
            warehouse_id: filters.value.warehouse_id,
            expense_category: kpi.expense_category,
            expense_group: kpi.expense_group,
        },
    );
};

const openDailySummaryDrilldown = (payload: {
    date: string;
    key: string;
    label: string;
    metric: string;
    value: number;
}): void => {
    void openDrilldown(
        {
            key: payload.key,
            label: `${payload.label} ${payload.date}`,
            value: payload.value,
            metric: payload.metric,
        },
        1,
        {
            date_from: payload.date,
            date_to: payload.date,
            warehouse_id: filters.value.warehouse_id,
        },
    );
};

const setPreset = (preset: DatePreset): void => {
    activePreset.value = preset;
    const now = new Date();

    if (preset === 'today') {
        filters.value.date_from = now.toISOString().split('T')[0];
        filters.value.date_to = now.toISOString().split('T')[0];
    }

    if (preset === 'week') {
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        filters.value.date_from = monday.toISOString().split('T')[0];
        filters.value.date_to = now.toISOString().split('T')[0];
    }

    if (preset === 'month') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        filters.value.date_from = first.toISOString().split('T')[0];
        filters.value.date_to = now.toISOString().split('T')[0];
    }

    void loadReports();
};

const openAdjustment = (type: FinancialAdjustmentType) => {
    adjustmentType.value = type;
    adjustmentOpen.value = true;
};

const submitAdjustment = async (payload: {
    type: FinancialAdjustmentType;
    amount: number;
    reason: string;
    adjustment_date: string;
    notes: string;
}) => {
    await storeAdjustment({
        ...payload,
        warehouse_id: filters.value.warehouse_id,
    });
    await loadReports();
};

const updateAdjustmentBusinessDatetime = (
    adjustmentId: number,
    businessDatetime: string | null,
): void => {
    const adjustment = adjustments.value.find((item) => item.id === adjustmentId);
    if (adjustment) {
        adjustment.business_datetime = businessDatetime;
    }
};

const openCapitalMovement = (type: 'in' | 'out') => {
    capitalMovementType.value = type;
    capitalMovementOpen.value = true;
};

const submitCapitalMovement = async (payload: {
    movement_type: 'in' | 'out';
    amount: number;
    reason: string;
    movement_date: string;
    notes: string;
}) => {
    await storeCapitalMovement({
        ...payload,
        warehouse_id: filters.value.warehouse_id,
    });
    await loadReports();
};

const updateCapitalMovementBusinessDatetime = (
    movementId: number,
    businessDatetime: string | null,
): void => {
    const movement = capitalMovements.value.find((item) => item.id === movementId);
    if (movement) {
        movement.business_datetime = businessDatetime;
    }
};

onMounted(async () => {
    // Resolve warehouse context + list first (lightweight), tolerating failures
    // so a single error here never throws out of the mounted hook.
    const setup = await Promise.allSettled([
        fetchStoreSettings(),
        initWarehouse(),
        loadWarehouses(),
    ]);
    if (setup.some((result) => result.status === 'rejected') && !error.value) {
        error.value =
            'No se pudo cargar la configuración de sucursales. Mostrando datos disponibles.';
    }

    filters.value.warehouse_id = currentWarehouseId.value;
    await loadReports();
});

watch(currentWarehouseId, (value) => {
    if (value && value !== filters.value.warehouse_id) {
        filters.value.warehouse_id = value;
        void loadReports();
    }
});
</script>

<template>
    <Head title="Finanzas y Rentabilidad" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-3 p-4">
            <FinanceReportShell
                eyebrow="Reportes"
                title="Finanzas y Rentabilidad"
                :subtitle="`${filters.date_from} - ${filters.date_to} · ${selectedWarehouseLabel}`"
                :icon="BarChart3"
            >
                <template #actions>
                    <button
                        class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                        @click="loadReports"
                    >
                        <RefreshCw
                            :size="16"
                            :class="{ 'animate-spin': loading }"
                        />
                        Actualizar
                    </button>
                </template>

                <div class="space-y-3">
                    <div
                        class="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-5 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                        <div class="md:col-span-2">
                            <label
                                class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                            >
                                Periodo
                            </label>
                            <div
                                class="grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                            >
                                <button
                                    v-for="preset in datePresets"
                                    :key="preset.key"
                                    class="px-3 py-2 text-xs font-medium transition"
                                    :class="
                                        activePreset === preset.key
                                            ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                                    "
                                    @click="setPreset(preset.key)"
                                >
                                    {{ preset.label }}
                                </button>
                            </div>
                        </div>
                        <DateRangeInput
                            v-model:from="filters.date_from"
                            v-model:to="filters.date_to"
                            label="Rango"
                            class="md:col-span-2"
                            @change="loadReports"
                        />
                        <div>
                            <label
                                class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                            >
                                Sucursal
                            </label>
                            <SearchableSelect
                                v-model="filters.warehouse_id"
                                :options="warehouseOptions"
                                placeholder="Todas"
                                @update:model-value="loadReports"
                            />
                        </div>
                    </div>

                    <div
                        v-if="error"
                        class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                    >
                        <AlertCircle :size="18" />
                        {{ error }}
                    </div>

                    <div
                        v-if="financeWarnings.length"
                        class="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                        <div
                            v-for="warning in financeWarnings"
                            :key="warning"
                            class="flex items-center gap-2"
                        >
                            <AlertCircle :size="15" />
                            {{ warningLabels[warning] ?? warning }}
                        </div>
                    </div>

                    <div
                        class="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                    >
                        <button
                            class="px-3 py-2 text-xs font-semibold transition"
                            :class="
                                activeMode === 'basic'
                                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                            "
                            @click="activeMode = 'basic'"
                        >
                            Basico
                        </button>
                        <button
                            class="px-3 py-2 text-xs font-semibold transition"
                            :class="
                                activeMode === 'advanced'
                                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                            "
                            @click="activeMode = 'advanced'"
                        >
                            Avanzado
                        </button>
                    </div>
                </div>
            </FinanceReportShell>

            <FinanceKpiRow
                :kpis="kpis"
                :currency-formatter="formatCurrency"
                @select="openKpiDrilldown"
            />

            <div
                v-if="activeMode === 'basic'"
                class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]"
            >
                <div class="space-y-3">
                    <nav class="flex flex-wrap gap-2">
                        <button
                            v-for="tab in tabs"
                            :key="tab.key"
                            class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition"
                            :class="
                                activeTab === tab.key
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'
                            "
                            @click="activeTab = tab.key"
                        >
                            <component :is="tab.icon" :size="16" />
                            {{ tab.label }}
                        </button>
                    </nav>

                    <FinanceDailySummaryTable
                        v-if="activeTab === 'summary'"
                        :rows="dailySummary?.rows ?? []"
                        :totals="dailySummary?.totals ?? {}"
                        :currency-formatter="formatCurrency"
                        @select="openDailySummaryDrilldown"
                    />

                    <FinanceBalanceSheet
                        v-if="activeTab === 'balance'"
                        :data="balanceSheet"
                        :currency-formatter="formatCurrency"
                        @select="openKpiDrilldown"
                    />

                    <FinanceIncomeStatement
                        v-if="activeTab === 'income'"
                        :sales="incomeSummary?.total_revenue ?? 0"
                        :cogs="incomeSummary?.total_cogs ?? 0"
                        :net-income="incomeSummary?.net_profit ?? 0"
                        :net-profit="incomeSummary?.net_profit ?? 0"
                        :expense-breakdown="expenseBreakdown"
                        :currency-formatter="formatCurrency"
                        @select="openKpiDrilldown"
                    />

                    <div
                        v-if="activeTab === 'credits'"
                        class="grid gap-3 xl:grid-cols-2"
                    >
                        <section
                            v-for="section in creditSections"
                            :key="section.key"
                            class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                        >
                            <div
                                class="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800"
                            >
                                <div>
                                    <h3
                                        class="text-xs font-semibold text-slate-900 dark:text-slate-100"
                                    >
                                        {{ section.title }}
                                    </h3>
                                    <p class="text-[11px] text-slate-500">
                                        {{ section.count }} documentos abiertos
                                    </p>
                                    <p
                                        class="mt-0.5 max-w-64 text-[11px] text-slate-400"
                                    >
                                        {{ section.description }}
                                    </p>
                                </div>
                                <div class="text-right">
                                    <button
                                        type="button"
                                        class="rounded px-1 text-sm font-bold text-indigo-600 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-indigo-400 dark:hover:bg-slate-800"
                                        @click="
                                            openKpiDrilldown({
                                                key: section.key,
                                                label: section.title,
                                                value: section.total,
                                                metric: section.key,
                                            })
                                        "
                                    >
                                        {{ formatCurrency(section.total) }}
                                    </button>
                                    <a
                                        :href="section.href"
                                        class="text-[11px] font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                                    >
                                        Ver detalle
                                    </a>
                                </div>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="min-w-full text-xs tabular-nums">
                                    <thead
                                        class="bg-slate-50 dark:bg-slate-900"
                                    >
                                        <tr>
                                            <th
                                                class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                            >
                                                Documento
                                            </th>
                                            <th
                                                class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                            >
                                                Cuenta
                                            </th>
                                            <th
                                                class="px-3 py-1.5 text-right font-semibold text-slate-500 uppercase dark:text-slate-400"
                                            >
                                                Saldo
                                            </th>
                                            <th
                                                class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                            >
                                                Vence
                                            </th>
                                            <th
                                                class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                            >
                                                Estado
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-slate-100 dark:divide-slate-800"
                                    >
                                        <tr
                                            v-for="document in section.documents.slice(
                                                0,
                                                8,
                                            )"
                                            :key="`${section.key}-${document.document_type}-${document.id}`"
                                            class="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                        >
                                            <td class="px-3 py-2">
                                                <p
                                                    class="font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                    {{
                                                        document.document_number
                                                    }}
                                                </p>
                                                <p
                                                    class="text-[11px] text-slate-500"
                                                >
                                                    {{
                                                        formatCreditDate(
                                                            document.date,
                                                        )
                                                    }}
                                                </p>
                                            </td>
                                            <td
                                                class="px-3 py-2 text-slate-600 dark:text-slate-400"
                                            >
                                                {{
                                                    document.account_name ||
                                                    'N/A'
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {{
                                                    formatCurrency(
                                                        document.amount_due,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-slate-600 dark:text-slate-400"
                                            >
                                                {{
                                                    formatCreditDate(
                                                        document.due_date,
                                                    )
                                                }}
                                            </td>
                                            <td class="px-3 py-2">
                                                <span
                                                    class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                >
                                                    {{ document.status }}
                                                </span>
                                            </td>
                                        </tr>
                                        <tr
                                            v-if="
                                                section.documents.length === 0
                                            "
                                        >
                                            <td
                                                colspan="5"
                                                class="px-3 py-6 text-center text-slate-400"
                                            >
                                                Sin creditos abiertos en el
                                                periodo
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    <div v-if="activeTab === 'investment'" class="space-y-3">
                        <div class="grid gap-3 md:grid-cols-4">
                            <button
                                type="button"
                                class="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                                @click="
                                    openKpiDrilldown({
                                        key: 'investment_in',
                                        label: 'Aportes',
                                        value: investmentTotals.investmentIn,
                                        metric: 'investment_in',
                                    })
                                "
                            >
                                <p
                                    class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Aportes
                                </p>
                                <p
                                    class="mt-1 text-lg font-bold text-emerald-600 tabular-nums dark:text-emerald-400"
                                >
                                    {{
                                        formatCurrency(
                                            investmentTotals.investmentIn,
                                        )
                                    }}
                                </p>
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                                @click="
                                    openKpiDrilldown({
                                        key: 'investment_out',
                                        label: 'Retiros',
                                        value: investmentTotals.investmentOut,
                                        metric: 'investment_out',
                                    })
                                "
                            >
                                <p
                                    class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Retiros
                                </p>
                                <p
                                    class="mt-1 text-lg font-bold text-rose-600 tabular-nums dark:text-rose-400"
                                >
                                    {{
                                        formatCurrency(
                                            investmentTotals.investmentOut,
                                        )
                                    }}
                                </p>
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                                @click="
                                    openKpiDrilldown({
                                        key: 'investment',
                                        label: 'Inversion neta',
                                        value: investmentTotals.netInvestment,
                                        metric: 'investment',
                                    })
                                "
                            >
                                <p
                                    class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Neto
                                </p>
                                <p
                                    class="mt-1 text-lg font-bold text-indigo-600 tabular-nums dark:text-indigo-400"
                                >
                                    {{
                                        formatCurrency(
                                            investmentTotals.netInvestment,
                                        )
                                    }}
                                </p>
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                                @click="
                                    openKpiDrilldown({
                                        key: 'cash',
                                        label: 'Cash cierre',
                                        value: investmentTotals.closingCash,
                                        metric: 'cash',
                                    })
                                "
                            >
                                <p
                                    class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Cash cierre
                                </p>
                                <p
                                    class="mt-1 text-lg font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                >
                                    {{
                                        formatCurrency(
                                            investmentTotals.closingCash,
                                        )
                                    }}
                                </p>
                            </button>
                        </div>

                        <div
                            class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                        >
                            <div
                                class="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800"
                            >
                                <h3
                                    class="text-xs font-semibold text-slate-900 dark:text-slate-100"
                                >
                                    Historial de inversion
                                </h3>
                                <div class="flex gap-2">
                                    <button
                                        class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                                        @click="openCapitalMovement('in')"
                                    >
                                        Aporte
                                    </button>
                                    <button
                                        class="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                        @click="openCapitalMovement('out')"
                                    >
                                        Retiro
                                    </button>
                                </div>
                            </div>
                            <table class="min-w-full text-xs tabular-nums">
                                <thead class="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th
                                            class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                        >
                                            Fecha
                                        </th>
                                        <th
                                            class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                        >
                                            Tipo
                                        </th>
                                        <th
                                            class="px-3 py-1.5 text-right font-semibold text-slate-500 uppercase dark:text-slate-400"
                                        >
                                            Monto
                                        </th>
                                        <th
                                            class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                        >
                                            Motivo
                                        </th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-slate-100 dark:divide-slate-800"
                                >
                                    <tr
                                        v-for="movement in capitalMovements"
                                        :key="movement.id"
                                        class="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                    >
                                        <td
                                            class="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                                        >
                                            {{ movement.movement_date }}
                                            <BusinessDatetimeEditor
                                                class="mt-1"
                                                compact
                                                record-type="capital_movement"
                                                :record-id="movement.id"
                                                :created-at="
                                                    movement.created_at ??
                                                    movement.movement_date
                                                "
                                                :business-datetime="
                                                    movement.business_datetime
                                                "
                                                @updated="
                                                    (value) =>
                                                        updateCapitalMovementBusinessDatetime(
                                                            movement.id,
                                                            value,
                                                        )
                                                "
                                            />
                                        </td>
                                        <td
                                            class="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                                        >
                                            {{ movement.movement_type_label }}
                                        </td>
                                        <td
                                            class="px-3 py-1.5 text-right font-semibold tabular-nums"
                                            :class="
                                                movement.movement_type === 'in'
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-rose-600 dark:text-rose-400'
                                            "
                                        >
                                            {{
                                                formatCurrency(movement.amount)
                                            }}
                                        </td>
                                        <td
                                            class="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                                        >
                                            {{ movement.reason }}
                                        </td>
                                    </tr>
                                    <tr v-if="!capitalMovements.length">
                                        <td
                                            colspan="4"
                                            class="px-3 py-6 text-center text-slate-400"
                                        >
                                            Sin movimientos de inversion en el
                                            periodo
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div
                        v-if="activeTab === 'balance' && adjustments.length"
                        class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                    >
                        <div
                            class="border-b border-slate-200 px-3 py-2 dark:border-slate-800"
                        >
                            <h3
                                class="text-xs font-semibold text-slate-900 dark:text-slate-100"
                            >
                                Historial de Ajustes
                            </h3>
                        </div>
                        <table class="min-w-full text-xs tabular-nums">
                            <thead class="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th
                                        class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Fecha
                                    </th>
                                    <th
                                        class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Tipo
                                    </th>
                                    <th
                                        class="px-3 py-1.5 text-right font-semibold text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Monto
                                    </th>
                                    <th
                                        class="px-3 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Motivo
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-slate-100 dark:divide-slate-800"
                            >
                                <tr
                                    v-for="adj in adjustments"
                                    :key="adj.id"
                                    class="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                >
                                    <td
                                        class="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                                    >
                                        {{ adj.adjustment_date }}
                                        <BusinessDatetimeEditor
                                            class="mt-1"
                                            compact
                                            record-type="financial_adjustment"
                                            :record-id="adj.id"
                                            :created-at="
                                                adj.created_at ??
                                                adj.adjustment_date
                                            "
                                            :business-datetime="
                                                adj.business_datetime
                                            "
                                            @updated="
                                                (value) =>
                                                    updateAdjustmentBusinessDatetime(
                                                        adj.id,
                                                        value,
                                                    )
                                            "
                                        />
                                    </td>
                                    <td
                                        class="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                                    >
                                        {{ adj.type_label }}
                                    </td>
                                    <td
                                        class="px-3 py-1.5 text-right font-semibold text-slate-900 dark:text-slate-100"
                                        :class="{
                                            'text-emerald-600 dark:text-emerald-400':
                                                adj.amount > 0,
                                            'text-rose-600 dark:text-rose-400':
                                                adj.amount < 0,
                                        }"
                                    >
                                        {{ formatCurrency(adj.amount) }}
                                    </td>
                                    <td
                                        class="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                                    >
                                        {{ adj.reason }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside class="space-y-3">
                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                        <h3
                            class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Balance Rapido
                        </h3>
                        <div class="space-y-1 text-xs">
                            <div class="flex justify-between">
                                <span class="text-slate-600 dark:text-slate-400"
                                    >Activos</span
                                >
                                <span
                                    class="font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                                    >{{
                                        formatCurrency(
                                            balanceSheet?.totals.total_assets ??
                                                0,
                                        )
                                    }}</span
                                >
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-600 dark:text-slate-400"
                                    >Pasivos</span
                                >
                                <span
                                    class="font-semibold text-amber-600 tabular-nums dark:text-amber-400"
                                    >{{
                                        formatCurrency(
                                            balanceSheet?.totals
                                                .total_liabilities ?? 0,
                                        )
                                    }}</span
                                >
                            </div>
                            <div
                                class="mt-1 flex justify-between border-t border-slate-200 pt-1 dark:border-slate-800"
                            >
                                <span
                                    class="font-bold text-slate-900 dark:text-slate-100"
                                    >Balance</span
                                >
                                <span
                                    class="font-bold text-indigo-600 tabular-nums dark:text-indigo-400"
                                    >{{
                                        formatCurrency(
                                            balanceSheet?.totals.balance ?? 0,
                                        )
                                    }}</span
                                >
                            </div>
                        </div>
                    </div>

                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                        <h3
                            class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Top Gastos
                        </h3>
                        <div class="space-y-1 text-xs">
                            <div
                                v-for="item in topExpenses"
                                :key="item.label"
                                class="flex justify-between"
                            >
                                <span
                                    class="text-slate-600 dark:text-slate-400"
                                    >{{ item.label }}</span
                                >
                                <span
                                    class="text-slate-900 tabular-nums dark:text-slate-100"
                                    >{{ formatCurrency(item.amount) }}</span
                                >
                            </div>
                            <div
                                v-if="!topExpenses.length"
                                class="py-2 text-center text-slate-400"
                            >
                                Sin gastos en el periodo
                            </div>
                        </div>
                    </div>

                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                        <h3
                            class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Ajustes
                        </h3>
                        <div class="space-y-1.5">
                            <button
                                class="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
                                @click="openAdjustment('cash')"
                            >
                                Ajustar Cash
                            </button>
                            <button
                                class="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                @click="openAdjustment('bank')"
                            >
                                Ajustar Banco
                            </button>
                            <button
                                class="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                @click="openAdjustment('inventory')"
                            >
                                Ajustar Inventario
                            </button>
                        </div>
                    </div>

                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                        <h3
                            class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Inversion
                        </h3>
                        <div class="space-y-1.5">
                            <button
                                class="w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                                @click="openCapitalMovement('in')"
                            >
                                Registrar Aporte
                            </button>
                            <button
                                class="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                @click="openCapitalMovement('out')"
                            >
                                Registrar Retiro
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            <FinanceAdvancedAccountingPanel
                v-else
                :filters="filters"
                :status="financialAdvancedStatus"
                :currency-formatter="formatCurrency"
            />
        </div>

        <FinancialDrilldownDrawer
            :open="drilldownOpen"
            :report="financialDrilldown"
            :loading="drilldownLoading"
            :currency-formatter="formatCurrency"
            @close="drilldownOpen = false"
            @page="changeDrilldownPage"
            @drilldown="openKpiDrilldown"
        />

        <FinanceAdjustmentModal
            v-model:open="adjustmentOpen"
            :default-type="adjustmentType"
            :warehouse-id="filters.warehouse_id"
            @submit="submitAdjustment"
        />
        <CapitalMovementModal
            v-model:open="capitalMovementOpen"
            :default-type="capitalMovementType"
            :warehouse-id="filters.warehouse_id"
            @submit="submitCapitalMovement"
        />
    </AppLayout>
</template>
