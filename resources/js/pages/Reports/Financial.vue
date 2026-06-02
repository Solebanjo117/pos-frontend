<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import {
    AlertCircle,
    Banknote,
    BarChart3,
    Calendar,
    CreditCard,
    DollarSign,
    Download,
    FileText,
    Printer,
    RefreshCw,
    Scale,
    TrendingDown,
    TrendingUp,
    Wallet,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import FinanceAccountingPanel from '@/components/Finance/FinanceAccountingPanel.vue';
import FinanceAgingBars from '@/components/Finance/FinanceAgingBars.vue';
import FinanceKpiCard from '@/components/Finance/FinanceKpiCard.vue';
import FinanceMethodBars from '@/components/Finance/FinanceMethodBars.vue';
import FinanceReportShell from '@/components/Finance/FinanceReportShell.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useReports } from '@/composables/useReports';
import { InventoryApiService } from '@/services/inventory';
import type { BreadcrumbItem } from '@/types';
import type { StatementSection } from '@/types/report';

type DatePreset = 'today' | 'week' | 'month' | 'custom';
type ReportTab = 'income' | 'position' | 'credits';
type IncomeBasis = 'cash' | 'accrual_operational';
type PositionMode = 'current_snapshot' | 'as_of';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/financial' },
    { title: 'Finanzas y Rentabilidad', href: '/reports/financial' },
];

const {
    incomeStatementReport,
    financialPositionReport,
    brandProfitabilityReport,
    categoryProfitabilityReport,
    loading,
    error,
    fetchIncomeStatement,
    fetchFinancialPosition,
    fetchBrandProfitability,
    fetchCategoryProfitability,
} = useReports();
const { currentWarehouseId, initWarehouse } = usePosSettings();

const warehouses = ref<any[]>([]);
const activePreset = ref<DatePreset>('month');
const activeTab = ref<ReportTab>('income');
const incomeBasis = ref<IncomeBasis>('cash');
const positionMode = ref<PositionMode>('current_snapshot');

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const filters = ref({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    warehouse_id: null as number | null,
});

const tabs: Array<{ key: ReportTab; label: string; icon: any }> = [
    { key: 'income', label: 'Estado de Resultados', icon: FileText },
    { key: 'position', label: 'Balance General', icon: Scale },
    { key: 'credits', label: 'Creditos', icon: CreditCard },
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
    if (!filters.value.warehouse_id) {
        return 'Todas las sucursales';
    }

    return (
        warehouses.value.find(
            (warehouse) => warehouse.id === filters.value.warehouse_id,
        )?.name ?? `Sucursal #${filters.value.warehouse_id}`
    );
});

const incomeSummary = computed(() => incomeStatementReport.value?.summary);
const positionSummary = computed(() => financialPositionReport.value?.summary);
const creditBalances = computed(
    () =>
        incomeStatementReport.value?.credit_balances ??
        financialPositionReport.value?.credit_balances,
);

const incomeSections = computed<StatementSection[]>(
    () => incomeStatementReport.value?.sections ?? [],
);
const positionSections = computed<StatementSection[]>(
    () => financialPositionReport.value?.sections ?? [],
);

const brandRows = computed(() =>
    (brandProfitabilityReport.value ?? []).slice(0, 5).map((row: any) => ({
        label: row.brand_name ?? row.name ?? 'Sin marca',
        amount: Number(row.revenue ?? row.total_revenue ?? 0),
        detail: `Margen ${formatPercent(Number(row.margin_percentage ?? row.margin ?? 0))}`,
    })),
);

const categoryRows = computed(() =>
    (categoryProfitabilityReport.value ?? []).slice(0, 5).map((row: any) => ({
        label: row.category_name ?? row.name ?? 'Sin categoria',
        amount: Number(row.revenue ?? row.total_revenue ?? 0),
        detail: `Margen ${formatPercent(Number(row.margin_percentage ?? row.margin ?? 0))}`,
    })),
);

const paymentRows = computed(() => [
    {
        label: 'Cuentas por cobrar',
        amount: Number(
            creditBalances.value?.accounts_receivable?.total_open_balance ?? 0,
        ),
        detail: `${creditBalances.value?.accounts_receivable?.open_documents_count ?? 0} documentos abiertos`,
    },
    {
        label: 'Cuentas por pagar',
        amount: Number(
            creditBalances.value?.accounts_payable?.total_open_balance ?? 0,
        ),
        detail: `${creditBalances.value?.accounts_payable?.open_documents_count ?? 0} documentos abiertos`,
    },
]);

const timelineRows = computed(() => {
    const timeline = incomeStatementReport.value?.timeline ?? [];
    const max = Math.max(
        ...timeline.map((row: any) =>
            Math.max(Number(row.revenue || 0), Number(row.cogs || 0)),
        ),
        1,
    );

    return timeline.slice(-8).map((row: any) => ({
        date: row.date,
        revenue: Number(row.revenue || 0),
        cogs: Number(row.cogs || 0),
        profit: Number(row.profit ?? row.gross_profit ?? 0),
        revenuePct: (Number(row.revenue || 0) / max) * 100,
        cogsPct: (Number(row.cogs || 0) / max) * 100,
    }));
});

const loadWarehouses = async (): Promise<void> => {
    warehouses.value = await InventoryApiService.getWarehouses();
};

const loadReports = async (): Promise<void> => {
    if (!filters.value.date_from || !filters.value.date_to) {
        return;
    }

    await Promise.all([
        fetchIncomeStatement({
            ...filters.value,
            basis: incomeBasis.value,
            compare: 'previous_period',
        }),
        fetchFinancialPosition({
            warehouse_id: filters.value.warehouse_id,
            date_to: filters.value.date_to,
            mode: positionMode.value,
        }),
        fetchBrandProfitability(filters.value),
        fetchCategoryProfitability(filters.value),
    ]);
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

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatPercent = (value: number): string =>
    `${(Number(value) || 0).toFixed(2)}%`;

const formatShortDate = (date: string): string =>
    new Intl.DateTimeFormat('es-PA', {
        day: '2-digit',
        month: 'short',
    }).format(new Date(`${date}T00:00:00`));

const sectionTone = (
    section: StatementSection,
): 'asset' | 'liability' | 'profit' | 'expense' | 'neutral' => {
    if (section.rows.some((row) => row.type === 'asset')) {
        return 'asset';
    }

    if (section.rows.some((row) => row.type === 'liability')) {
        return 'liability';
    }

    if (section.rows.some((row) => row.type === 'expense')) {
        return 'expense';
    }

    if (section.rows.some((row) => row.type === 'profit')) {
        return 'profit';
    }

    return 'neutral';
};

onMounted(async () => {
    await Promise.all([initWarehouse(), loadWarehouses()]);
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
        <div class="space-y-5 p-4">
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
                    <button
                        disabled
                        class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600"
                    >
                        <Download :size="16" />
                        Excel
                    </button>
                    <button
                        disabled
                        class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600"
                    >
                        <Printer :size="16" />
                        Imprimir
                    </button>
                </template>

                <div class="space-y-5">
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
                        <div>
                            <label
                                class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                            >
                                <Calendar :size="12" class="mr-1 inline" />
                                Desde
                            </label>
                            <input
                                v-model="filters.date_from"
                                type="date"
                                class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                @change="loadReports"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                            >
                                <Calendar :size="12" class="mr-1 inline" />
                                Hasta
                            </label>
                            <input
                                v-model="filters.date_to"
                                type="date"
                                class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                @change="loadReports"
                            />
                        </div>
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
                        class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                    >
                        <AlertCircle :size="18" />
                        {{ error }}
                    </div>

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
                </div>
            </FinanceReportShell>

            <section v-if="activeTab === 'income'" class="space-y-5">
                <div class="grid gap-3 md:grid-cols-4">
                    <FinanceKpiCard
                        label="Ventas Brutas"
                        :value="
                            formatCurrency(incomeSummary?.total_revenue ?? 0)
                        "
                        detail="Ingresos del periodo"
                        accent="emerald"
                        :icon="TrendingUp"
                    />
                    <FinanceKpiCard
                        label="Costo de Ventas"
                        :value="formatCurrency(incomeSummary?.total_cogs ?? 0)"
                        detail="COGS operativo"
                        accent="amber"
                        :icon="TrendingDown"
                    />
                    <FinanceKpiCard
                        label="Utilidad Neta"
                        :value="formatCurrency(incomeSummary?.net_profit ?? 0)"
                        :detail="`Margen ${formatPercent(incomeSummary?.margin_percentage ?? 0)}`"
                        accent="indigo"
                        :icon="DollarSign"
                    />
                    <FinanceKpiCard
                        label="Gastos Operativos"
                        :value="
                            formatCurrency(
                                incomeSummary?.total_operational_expenses ?? 0,
                            )
                        "
                        :detail="`${incomeSummary?.orders_count ?? 0} ordenes`"
                        accent="rose"
                        :icon="Wallet"
                    />
                </div>

                <div
                    class="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]"
                >
                    <div class="space-y-4">
                        <FinanceAccountingPanel
                            v-for="section in incomeSections"
                            :key="section.key"
                            :title="section.label"
                            :total="section.amount"
                            :rows="section.rows"
                            :tone="sectionTone(section)"
                            :icon="FileText"
                            :currency-formatter="formatCurrency"
                        />
                    </div>

                    <aside class="space-y-4">
                        <div
                            class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                        >
                            <h3
                                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                            >
                                Tendencia del periodo
                            </h3>
                            <div class="mt-4 space-y-3">
                                <div
                                    v-for="row in timelineRows"
                                    :key="row.date"
                                    class="grid grid-cols-[72px_1fr] items-center gap-3"
                                >
                                    <span
                                        class="text-xs text-slate-500 dark:text-slate-400"
                                    >
                                        {{ formatShortDate(row.date) }}
                                    </span>
                                    <div class="space-y-1">
                                        <div
                                            class="h-2 rounded-full bg-slate-100 dark:bg-slate-800"
                                        >
                                            <div
                                                class="h-2 rounded-full bg-emerald-500"
                                                :style="{
                                                    width: `${row.revenuePct}%`,
                                                }"
                                            />
                                        </div>
                                        <div
                                            class="h-2 rounded-full bg-slate-100 dark:bg-slate-800"
                                        >
                                            <div
                                                class="h-2 rounded-full bg-amber-500"
                                                :style="{
                                                    width: `${row.cogsPct}%`,
                                                }"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <FinanceMethodBars
                            :rows="brandRows"
                            :currency-formatter="formatCurrency"
                        />
                        <FinanceMethodBars
                            :rows="categoryRows"
                            :currency-formatter="formatCurrency"
                        />
                    </aside>
                </div>
            </section>

            <section v-if="activeTab === 'position'" class="space-y-5">
                <div class="grid gap-3 md:grid-cols-4">
                    <FinanceKpiCard
                        label="Activos"
                        :value="
                            formatCurrency(positionSummary?.total_assets ?? 0)
                        "
                        detail="Caja, bancos, CxC e inventario"
                        accent="sky"
                        :icon="TrendingUp"
                    />
                    <FinanceKpiCard
                        label="Pasivos"
                        :value="
                            formatCurrency(
                                positionSummary?.total_liabilities ?? 0,
                            )
                        "
                        detail="Cuentas por pagar y obligaciones"
                        accent="amber"
                        :icon="Banknote"
                    />
                    <FinanceKpiCard
                        label="Patrimonio"
                        :value="
                            formatCurrency(
                                positionSummary?.operational_equity ?? 0,
                            )
                        "
                        detail="Balance operativo"
                        accent="emerald"
                        :icon="Scale"
                    />
                    <FinanceKpiCard
                        label="Endeudamiento"
                        :value="
                            formatPercent(
                                ((positionSummary?.total_liabilities ?? 0) /
                                    Math.max(
                                        positionSummary?.total_assets ?? 0,
                                        1,
                                    )) *
                                    100,
                            )
                        "
                        detail="Pasivo / Activo"
                        accent="indigo"
                        :icon="BarChart3"
                    />
                </div>

                <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div class="grid gap-4 lg:grid-cols-2">
                        <FinanceAccountingPanel
                            v-for="section in positionSections"
                            :key="section.key"
                            :title="section.label"
                            :total="section.amount"
                            :rows="section.rows"
                            :tone="sectionTone(section)"
                            :icon="Scale"
                            :currency-formatter="formatCurrency"
                        />
                    </div>
                    <aside class="space-y-4">
                        <FinanceAgingBars
                            :buckets="
                                financialPositionReport?.aging
                                    ?.accounts_receivable
                            "
                            :currency-formatter="formatCurrency"
                        />
                        <FinanceAgingBars
                            :buckets="
                                financialPositionReport?.aging?.accounts_payable
                            "
                            :currency-formatter="formatCurrency"
                        />
                    </aside>
                </div>
            </section>

            <section
                v-if="activeTab === 'credits'"
                class="grid gap-5 xl:grid-cols-[360px_1fr]"
            >
                <aside class="space-y-4">
                    <FinanceKpiCard
                        label="Cuentas por Cobrar"
                        :value="
                            formatCurrency(
                                creditBalances?.accounts_receivable
                                    ?.total_open_balance ?? 0,
                            )
                        "
                        :detail="`${creditBalances?.accounts_receivable?.accounts_count ?? 0} clientes`"
                        accent="indigo"
                        :icon="CreditCard"
                    />
                    <FinanceKpiCard
                        label="Cuentas por Pagar"
                        :value="
                            formatCurrency(
                                creditBalances?.accounts_payable
                                    ?.total_open_balance ?? 0,
                            )
                        "
                        :detail="`${creditBalances?.accounts_payable?.accounts_count ?? 0} proveedores`"
                        accent="amber"
                        :icon="Banknote"
                    />
                    <FinanceMethodBars
                        :rows="paymentRows"
                        :currency-formatter="formatCurrency"
                    />
                    <Link
                        href="/ar"
                        class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                    >
                        Ver cuentas por cobrar
                    </Link>
                </aside>

                <div
                    class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                    <div
                        class="border-b border-slate-200 px-4 py-3 dark:border-slate-800"
                    >
                        <h3
                            class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                        >
                            Documentos abiertos de clientes
                        </h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table
                            class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"
                        >
                            <thead class="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th
                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                    >
                                        Documento
                                    </th>
                                    <th
                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                    >
                                        Cliente
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                    >
                                        Total
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                    >
                                        Pendiente
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                    >
                                        Dias
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-slate-100 dark:divide-slate-800"
                            >
                                <tr
                                    v-for="document in creditBalances
                                        ?.accounts_receivable?.documents ?? []"
                                    :key="`${document.document_type}-${document.id}`"
                                    class="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                >
                                    <td
                                        class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100"
                                    >
                                        {{ document.document_number }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-slate-600 dark:text-slate-300"
                                    >
                                        {{
                                            document.account_name ??
                                            'Sin cliente'
                                        }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-slate-600 tabular-nums dark:text-slate-300"
                                    >
                                        {{ formatCurrency(document.total) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                                    >
                                        {{
                                            formatCurrency(document.amount_due)
                                        }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-slate-500 tabular-nums"
                                    >
                                        {{ document.days_overdue }}
                                    </td>
                                </tr>
                                <tr
                                    v-if="
                                        !creditBalances?.accounts_receivable
                                            ?.documents?.length
                                    "
                                >
                                    <td
                                        colspan="5"
                                        class="px-4 py-10 text-center text-slate-500"
                                    >
                                        Sin documentos abiertos.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    </AppLayout>
</template>
