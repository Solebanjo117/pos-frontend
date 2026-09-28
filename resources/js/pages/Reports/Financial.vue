<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    AlertCircle,
    BarChart3,
    Clock,
    FileText,
    Layers,
    PiggyBank,
    RefreshCw,
    Scale,
    ShoppingCart,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import BusinessDatetimeEditor from '@/components/BusinessDatetimeEditor.vue';
import CapitalMovementModal from '@/components/Finance/CapitalMovementModal.vue';
import CashPaymentsReport from '@/components/Finance/CashPaymentsReport.vue';
import CashPositionReport from '@/components/Finance/CashPositionReport.vue';
import FinanceAdvancedAccountingPanel from '@/components/Finance/FinanceAdvancedAccountingPanel.vue';
import FinanceBalanceSheet from '@/components/Finance/FinanceBalanceSheet.vue';
import FinanceDailySummaryTable from '@/components/Finance/FinanceDailySummaryTable.vue';
import FinanceIncomeStatement from '@/components/Finance/FinanceIncomeStatement.vue';
import FinanceKpiRow from '@/components/Finance/FinanceKpiRow.vue';
import FinanceReportShell from '@/components/Finance/FinanceReportShell.vue';
import FinancialDrilldownDrawer from '@/components/Finance/FinancialDrilldownDrawer.vue';
import SalesLinesReport from '@/components/Finance/SalesLinesReport.vue';
import TraceableCell from '@/components/Traceability/TraceableCell.vue';
import TransactionTraceDrawer from '@/components/Traceability/TransactionTraceDrawer.vue';
import { Button } from '@/components/ui/button';
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useReports } from '@/composables/useReports';
import { useStoreSettings } from '@/composables/useStoreSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';
import type { CreditDocument } from '@/types/report';
import type { TransactionTraceNode } from '@/types/transaction-trace';
import {
    buildBalanceSheetUrl,
    buildFinancialReportUrl,
    financialReportFilterKey,
    financialReportRequestDecision,
    validateBalanceSheetDate,
    validateFinancialReportDates,
} from '@/utils/financialReport';
import { formatCurrency } from '@/utils/formatters';

type ReportTab =
    | 'summary'
    | 'balance'
    | 'income'
    | 'credits'
    | 'investment'
    | 'line_profitability'
    | 'sales'
    | 'collections'
    | 'cash';
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
    capitalMovements,
    error,
    fetchIncomeStatement,
    fetchDailySummary,
    fetchBalanceSheet,
    fetchFinancialDrilldown,
    fetchFinancialAdvancedStatus,
    storeCapitalMovement,
    fetchCapitalMovements,
} = useReports();
const { currentWarehouseId, initWarehouse } = usePosSettings();
const { fetchSettings: fetchStoreSettings } = useStoreSettings();

const reportTabKeys: ReportTab[] = [
    'summary',
    'balance',
    'income',
    'credits',
    'investment',
    'line_profitability',
    'sales',
    'collections',
    'cash',
];

const initialUrlParams = new URLSearchParams(window.location.search);
const initialTabParam = initialUrlParams.get('tab') as ReportTab | null;
const activeTab = ref<ReportTab>(
    initialTabParam && reportTabKeys.includes(initialTabParam)
        ? initialTabParam
        : initialUrlParams.has('as_of')
          ? 'balance'
          : 'summary',
);
const activeMode = ref<ReportMode>('basic');
const standaloneReport = computed(() =>
    ['sales', 'line_profitability', 'collections', 'cash'].includes(
        activeTab.value,
    ),
);
const capitalMovementOpen = ref(false);
const capitalMovementType = ref<'in' | 'out'>('in');
const capitalMovementSubmitting = ref(false);
const capitalMovementError = ref<string | null>(null);
const drilldownOpen = ref(false);
const transactionTraceOpen = ref(false);
const transactionTraceNode = ref<TransactionTraceNode | null>(null);
const drilldownLoading = ref(false);
const drilldownPerPage = ref(25);
const reportsLoading = ref(false);
const balanceLoading = ref(false);
const reportReloadQueued = ref(false);
const activeReportRequestKey = ref<string | null>(null);
const dateValidationError = ref<string | null>(null);
const selectedKpi = ref<{
    key: string;
    label: string;
    value: number;
    metric?: string;
    expense_category?: string | null;
    expense_group?: string | null;
} | null>(null);
const activeDrilldownFilters = ref<DrilldownFilters | null>(null);

const panamaToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(new Date());
const initialDateFrom = initialUrlParams.get('date_from') || panamaToday;
const initialDateTo = initialUrlParams.get('date_to') || panamaToday;
const balanceAsOf = ref(
    initialUrlParams.get('as_of') || initialDateTo || panamaToday,
);
const filters = ref({
    date_from: initialDateFrom,
    date_to: initialDateTo,
    warehouse_id: null as number | null,
});

const tabs: Array<{ key: ReportTab; label: string; icon: any }> = [
    { key: 'summary', label: 'Resumen Diario', icon: BarChart3 },
    { key: 'balance', label: 'Balance Sheet', icon: Scale },
    { key: 'income', label: 'Income Statement', icon: FileText },
    { key: 'credits', label: 'Creditos', icon: Clock },
    { key: 'investment', label: 'Capital', icon: PiggyBank },
    {
        key: 'line_profitability',
        label: 'Rentabilidad por linea',
        icon: Layers,
    },
    { key: 'sales', label: 'Ventas', icon: ShoppingCart },
    { key: 'collections', label: 'Cobros por método', icon: ShoppingCart },
    { key: 'cash', label: 'Efectivo y bancos', icon: PiggyBank },
];

const kpis = computed(() => {
    const totals = dailySummary.value?.totals ?? {};
    const credits = incomeStatementReport.value?.credit_balances;
    const statement = incomeStatementReport.value?.reconciliation;

    return [
        {
            key: 'inventory',
            label: 'Inventario',
            value: totals.inventory ?? 0,
            metric: 'inventory',
            detail: 'Saldo al cierre',
        },
        {
            key: 'sales',
            label: 'Ventas',
            value: statement?.net_sales_ex_tax ?? 0,
            metric: 'sales',
            detail: 'Periodo, sin ITBMS',
        },
        {
            key: 'sales_collected',
            label: 'Cobrado',
            value: totals.sales_collected ?? 0,
            metric: 'payments_received',
            detail: 'Cobros del periodo',
        },
        {
            key: 'receivable',
            label: 'CxC',
            value:
                totals.accounts_receivable ??
                credits?.accounts_receivable?.total_open_balance ??
                0,
            metric: 'receivable',
            detail: 'Saldo al cierre',
        },
        {
            key: 'cogs',
            label: 'Costo',
            value: statement?.net_cogs ?? 0,
            metric: 'cogs',
            detail: 'Costo neto del periodo',
        },
        {
            key: 'purchase',
            label: 'Compras',
            value: totals.purchase ?? 0,
            metric: 'purchases',
            detail: 'Compras del periodo',
        },
        {
            key: 'purchase_paid',
            label: 'Pagado',
            value: totals.purchase_paid ?? 0,
            metric: 'supplier_payments',
            detail: 'Pagos del periodo',
        },
        {
            key: 'payable',
            label: 'CxP',
            value:
                totals.accounts_payable ??
                credits?.accounts_payable?.total_open_balance ??
                0,
            metric: 'payable',
            detail: 'Saldo al cierre',
        },
        {
            key: 'expenses',
            label: 'Gastos',
            value: statement?.operational_expenses ?? 0,
            metric: 'expenses',
            detail: 'Gastos reconocidos',
        },
        {
            key: 'profit',
            label: 'Profit',
            value: statement?.net_income ?? 0,
            metric: 'profit',
            detail: 'Igual a Net Income',
        },
    ];
});

const warningLabels: Record<string, string> = {
    inventory_historical_value_uses_current_fifo_lot_availability:
        'Inventario historico estimado con disponibilidad FIFO actual.',
};

const financeWarnings = computed(() =>
    [
        ...(activeTab.value === 'balance'
            ? []
            : (dailySummary.value?.warnings ?? [])),
        ...(activeTab.value === 'balance'
            ? (balanceSheet.value?.warnings ?? [])
            : []),
        ...(incomeStatementReport.value?.warnings ?? []).map(
            (warning) => warning.message,
        ),
    ].filter((warning, index, all) => all.indexOf(warning) === index),
);

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
    const credits = incomeStatementReport.value?.credit_balances;

    return [
        {
            key: 'receivable',
            title: 'Cuentas por cobrar',
            href: '/ar',
            description: 'Cobros y abonos se operan desde /ar.',
            total: credits?.accounts_receivable?.total_open_balance ?? 0,
            count: credits?.accounts_receivable?.open_documents_count ?? 0,
            documents: credits?.accounts_receivable?.documents ?? [],
        },
        {
            key: 'payable',
            title: 'Cuentas por pagar',
            href: '/accounts-payable',
            description:
                'Pagos a proveedores se operan desde /accounts-payable.',
            total: credits?.accounts_payable?.total_open_balance ?? 0,
            count: credits?.accounts_payable?.open_documents_count ?? 0,
            documents: credits?.accounts_payable?.documents ?? [],
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

const creditDocumentNode = (
    document: CreditDocument,
): TransactionTraceNode => ({
    type: document.document_type,
    id: document.id,
    label: document.document_number,
    number: document.document_number,
    href: null,
    can_view: true,
    restricted: false,
    traceable: true,
});

const inspectTransaction = (node: TransactionTraceNode): void => {
    transactionTraceNode.value = node;
    transactionTraceOpen.value = true;
};

const loadReports = async (): Promise<void> => {
    const validationMessage = validateFinancialReportDates(
        filters.value.date_from,
        filters.value.date_to,
    );
    if (validationMessage) {
        dateValidationError.value = validationMessage;
        return;
    }

    dateValidationError.value = null;
    const requestedKey = financialReportFilterKey(filters.value);

    if (reportsLoading.value) {
        if (
            financialReportRequestDecision(
                activeReportRequestKey.value,
                requestedKey,
            ) === 'queue'
        ) {
            reportReloadQueued.value = true;
        }
        return;
    }

    reportsLoading.value = true;

    try {
        do {
            reportReloadQueued.value = false;
            const requestFilters = { ...filters.value };
            activeReportRequestKey.value =
                financialReportFilterKey(requestFilters);
            const requests: Array<() => Promise<unknown>> = [
                () => fetchDailySummary(requestFilters),
                () => fetchFinancialAdvancedStatus(),
                () =>
                    fetchIncomeStatement({
                        ...requestFilters,
                        basis: 'accrual_operational',
                        compare: 'none',
                    }),
                () => fetchBalanceSheet({ as_of: balanceAsOf.value }),
                () => fetchCapitalMovements(requestFilters),
            ];
            const results: PromiseSettledResult<unknown>[] = [];

            // Keep requests sequential. Besides protecting the shared PHP
            // worker pool, this avoids Windows file-cache lock collisions in
            // Laravel's rate limiter when the frontend proxy is in use.
            for (const request of requests) {
                results.push(...(await Promise.allSettled([request()])));
            }

            const failed = results.filter(
                (result) => result.status === 'rejected',
            );
            if (failed.length > 0 && !error.value) {
                error.value =
                    'Algunos datos financieros no se pudieron cargar. Revisa la conexión o reduce el rango de fechas e intenta de nuevo.';
            }
        } while (reportReloadQueued.value);
    } finally {
        reportsLoading.value = false;
        activeReportRequestKey.value = null;
    }
};

const selectTab = (tab: ReportTab): void => {
    activeTab.value = tab;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
    );
};

const applyBalanceDate = async (): Promise<void> => {
    const validationMessage = validateBalanceSheetDate(balanceAsOf.value);
    if (validationMessage) {
        dateValidationError.value = validationMessage;
        return;
    }

    dateValidationError.value = null;
    window.history.replaceState(
        window.history.state,
        '',
        buildBalanceSheetUrl(window.location.href, balanceAsOf.value),
    );
    balanceLoading.value = true;
    try {
        await fetchBalanceSheet({ as_of: balanceAsOf.value });
    } finally {
        balanceLoading.value = false;
    }
};

const applyDateRange = async (): Promise<void> => {
    const validationMessage = validateFinancialReportDates(
        filters.value.date_from,
        filters.value.date_to,
    );
    if (validationMessage) {
        dateValidationError.value = validationMessage;
        return;
    }

    dateValidationError.value = null;
    window.history.replaceState(
        window.history.state,
        '',
        buildFinancialReportUrl(window.location.href, filters.value),
    );
    await loadReports();
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
    activeDrilldownFilters.value = overrideFilters ??
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
            per_page: drilldownPerPage.value,
        });
    } finally {
        drilldownLoading.value = false;
    }
};

const changeDrilldownPage = (page: number): void => {
    if (!selectedKpi.value) return;
    void openDrilldown(selectedKpi.value, page, activeDrilldownFilters.value);
};

const changeDrilldownPerPage = (perPage: number): void => {
    if (![10, 25, 50, 100].includes(perPage) || !selectedKpi.value) return;

    drilldownPerPage.value = perPage;
    void openDrilldown(selectedKpi.value, 1, activeDrilldownFilters.value);
};

const openKpiDrilldown = (kpi: {
    key?: string;
    label: string;
    value: number;
    metric?: string;
    expense_category?: string | null;
    expense_group?: string | null;
}): void => {
    const isBalanceMetric = kpi.metric?.startsWith('balance_') ?? false;
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
            date_from: isBalanceMetric
                ? balanceAsOf.value
                : filters.value.date_from,
            date_to: isBalanceMetric
                ? balanceAsOf.value
                : filters.value.date_to,
            warehouse_id: isBalanceMetric ? null : filters.value.warehouse_id,
            expense_category: kpi.expense_category,
            expense_group: kpi.expense_group,
        },
    );
};

const openDailySummaryDrilldown = (payload: {
    date?: string;
    key: string;
    label: string;
    metric: string;
    value: number;
}): void => {
    const dateFrom = payload.date ?? filters.value.date_from;
    const dateTo = payload.date ?? filters.value.date_to;
    void openDrilldown(
        {
            key: payload.key,
            label: payload.date
                ? `${payload.label} ${payload.date}`
                : payload.label,
            value: payload.value,
            metric: payload.metric,
        },
        1,
        {
            date_from: dateFrom,
            date_to: dateTo,
            warehouse_id: filters.value.warehouse_id,
        },
    );
};

const openCapitalMovement = (type: 'in' | 'out') => {
    capitalMovementType.value = type;
    capitalMovementError.value = null;
    capitalMovementOpen.value = true;
};

const submitCapitalMovement = async (payload: {
    movement_type: 'in' | 'out';
    amount: number;
    reason: string;
    movement_date: string;
    notes: string;
    idempotency_key: string;
}) => {
    if (capitalMovementSubmitting.value) return;
    capitalMovementSubmitting.value = true;
    capitalMovementError.value = null;
    try {
        await storeCapitalMovement({
            ...payload,
            warehouse_id: filters.value.warehouse_id,
        });
        await loadReports();
        capitalMovementOpen.value = false;
    } catch (err: any) {
        capitalMovementError.value =
            err.response?.data?.message ||
            'No se pudo registrar el movimiento de capital.';
    } finally {
        capitalMovementSubmitting.value = false;
    }
};

const updateCapitalMovementBusinessDatetime = (
    movementId: number,
    businessDatetime: string | null,
): void => {
    const movement = capitalMovements.value.find(
        (item) => item.id === movementId,
    );
    if (movement) {
        movement.business_datetime = businessDatetime;
    }
};

onMounted(async () => {
    // Resolve report context first (lightweight), tolerating failures
    // so a single error here never throws out of the mounted hook.
    const setup = await Promise.allSettled([
        fetchStoreSettings(),
        initWarehouse(),
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
                :subtitle="
                    standaloneReport
                        ? 'Filtros y totales propios de cada consulta'
                        : activeMode === 'basic' && activeTab === 'balance'
                          ? `Balance al ${balanceAsOf} · Consolidado`
                          : `${filters.date_from} - ${filters.date_to}`
                "
                :icon="BarChart3"
            >
                <div class="space-y-3">
                    <div
                        v-if="
                            !standaloneReport &&
                            !(activeMode === 'basic' && activeTab === 'balance')
                        "
                        class="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                        <DateRangeInput
                            v-model:from="filters.date_from"
                            v-model:to="filters.date_to"
                            label="Rango de fechas"
                            class="min-w-0 flex-1 md:max-w-xl"
                        />
                        <button
                            type="button"
                            class="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="reportsLoading"
                            @click="applyDateRange"
                        >
                            <RefreshCw
                                :size="15"
                                :class="{ 'animate-spin': reportsLoading }"
                            />
                            {{
                                reportsLoading
                                    ? 'Actualizando...'
                                    : 'Actualizar'
                            }}
                        </button>
                    </div>

                    <div
                        v-else-if="!standaloneReport"
                        class="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                        <label class="w-full sm:min-w-48 sm:flex-1 md:max-w-sm">
                            <span
                                class="mb-1 block text-xs font-semibold text-slate-600 uppercase dark:text-slate-300"
                            >
                                Balance al
                            </span>
                            <input
                                v-model="balanceAsOf"
                                type="date"
                                class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <div
                            class="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 sm:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        >
                            Consolidado
                        </div>
                        <button
                            type="button"
                            class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            :disabled="balanceLoading"
                            @click="applyBalanceDate"
                        >
                            <RefreshCw
                                :size="15"
                                :class="{ 'animate-spin': balanceLoading }"
                            />
                            {{
                                balanceLoading
                                    ? 'Actualizando...'
                                    : 'Actualizar'
                            }}
                        </button>
                    </div>

                    <div
                        v-if="dateValidationError || error"
                        role="alert"
                        class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                    >
                        <AlertCircle :size="18" />
                        {{ dateValidationError || error }}
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

            <div v-if="activeMode === 'basic'" class="space-y-3">
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
                            @click="selectTab(tab.key)"
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
                        :reconciliation="
                            incomeStatementReport?.reconciliation ?? null
                        "
                        :sections="incomeStatementReport?.sections ?? []"
                        :currency-formatter="formatCurrency"
                        @select="openKpiDrilldown"
                    />

                    <SalesLinesReport
                        v-if="activeTab === 'line_profitability'"
                        initial-group="brand"
                    />

                    <SalesLinesReport
                        v-if="activeTab === 'sales'"
                        initial-group="line"
                    /><CashPaymentsReport
                        v-if="activeTab === 'collections'"
                        report-mode
                    /><CashPositionReport v-if="activeTab === 'cash'" />

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
                                                <TraceableCell
                                                    :node="
                                                        creditDocumentNode(
                                                            document,
                                                        )
                                                    "
                                                    @inspect="
                                                        inspectTransaction
                                                    "
                                                />
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
                        v-if="activeTab === 'balance'"
                        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                        <div>
                            <h3 class="text-sm font-semibold">
                                Historial de ajustes
                            </h3>
                            <p
                                class="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                            >
                                Consulte folios, asientos, efectos operativos y
                                reversiones en la fuente central.
                            </p>
                        </div>
                        <Button as-child size="sm" variant="outline">
                            <Link href="/finance/accounting/adjustments"
                                >Abrir historial</Link
                            >
                        </Button>
                    </div>
                </div>
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
            @per-page="changeDrilldownPerPage"
            @drilldown="openKpiDrilldown"
        />
        <TransactionTraceDrawer
            :open="transactionTraceOpen"
            :type="transactionTraceNode?.type"
            :id="transactionTraceNode?.id"
            @close="transactionTraceOpen = false"
        />

        <CapitalMovementModal
            v-model:open="capitalMovementOpen"
            :default-type="capitalMovementType"
            :warehouse-id="filters.warehouse_id"
            :loading="capitalMovementSubmitting"
            :error="capitalMovementError"
            @submit="submitCapitalMovement"
        />
    </AppLayout>
</template>
