<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Banknote,
    BarChart3,
    Calendar,
    CreditCard,
    Download,
    FileText,
    Printer,
    Receipt,
    RefreshCw,
    Scale,
    UserRound,
    Wallet,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import FinanceAccountingPanel from '@/components/Finance/FinanceAccountingPanel.vue';
import FinanceKpiCard from '@/components/Finance/FinanceKpiCard.vue';
import FinanceMethodBars from '@/components/Finance/FinanceMethodBars.vue';
import FinanceReportShell from '@/components/Finance/FinanceReportShell.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useReports } from '@/composables/useReports';
import { useUsers } from '@/composables/useUsers';
import { useWarehouses } from '@/composables/useWarehouses';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

interface CashDrawer {
    opening_amount?: number;
    cash_sales?: number;
    cash_refunds?: number;
    cash_movements_in?: number;
    cash_movements_out?: number;
    expected_cash?: number;
    declared_cash?: number;
    closing_amount?: number;
    difference?: number;
    sessions_count?: number;
}

interface UserReconciliation {
    user_id: number;
    user_name?: string | null;
    sessions_count: number;
    opening_amount: number;
    expected_cash: number;
    declared_cash: number;
    closing_amount: number;
    difference: number;
}

interface ZReportPayload {
    date: string;
    total_sales: number;
    total_tax: number;
    total_discounts: number;
    total_shipping: number;
    refunds: number;
    net_sales: number;
    orders_count: number;
    average_ticket: number;
    cogs: number;
    gross_profit: number;
    by_payment_method: Record<string, number>;
    cash_drawer: CashDrawer;
    by_user: UserReconciliation[];
}

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
const selectedWarehouseId = ref<number | undefined>();
const selectedUserId = ref<number | undefined>();
const exporting = ref(false);

const report = computed<ZReportPayload | null>(
    () => (zReport.value as ZReportPayload | null) ?? null,
);

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

const cashDrawer = computed<CashDrawer>(() => report.value?.cash_drawer ?? {});
const cashDifference = computed(() => Number(cashDrawer.value.difference ?? 0));
const declaredCash = computed(() =>
    Number(
        cashDrawer.value.declared_cash ?? cashDrawer.value.closing_amount ?? 0,
    ),
);
const differenceDetail = computed(() => {
    if (cashDifference.value > 0) {
        return 'Sobrante de caja';
    }

    if (cashDifference.value < 0) {
        return 'Faltante de caja';
    }

    return 'Caja conciliada';
});
const grossProfitTone = computed(() =>
    Number(report.value?.gross_profit ?? 0) >= 0 ? 'emerald' : 'rose',
);

const methodLabels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    credit_card: 'Tarjeta',
    debit_card: 'Tarjeta debito',
    transfer: 'Transferencia',
    bank_transfer: 'Transferencia',
    yappy: 'Yappy',
    credit: 'Credito cliente',
    account_credit: 'Credito cliente',
    check: 'Cheque',
};

const paymentMethodRows = computed(() =>
    Object.entries(report.value?.by_payment_method ?? {})
        .filter(([, amount]) => Number(amount) !== 0)
        .map(([method, amount]) => ({
            label: methodLabels[method] ?? method.replaceAll('_', ' '),
            amount: Number(amount),
            detail:
                method === 'credit' || method === 'account_credit'
                    ? 'Cuenta por cobrar; no entra como efectivo'
                    : 'Cobro real registrado',
        })),
);

const cashRows = computed(() => [
    {
        key: 'opening',
        label: 'Fondo de apertura',
        amount: Number(cashDrawer.value.opening_amount ?? 0),
        detail: `${cashDrawer.value.sessions_count ?? 0} sesiones incluidas`,
    },
    {
        key: 'cash_sales',
        label: 'Entradas en efectivo',
        amount: Number(cashDrawer.value.cash_sales ?? 0),
        detail: 'Cobros reales en caja',
    },
    {
        key: 'cash_refunds',
        label: 'Devoluciones en efectivo',
        amount: -Number(cashDrawer.value.cash_refunds ?? 0),
        detail: 'Salidas por devolucion',
    },
    {
        key: 'movements_in',
        label: 'Movimientos de ingreso',
        amount: Number(cashDrawer.value.cash_movements_in ?? 0),
        detail: 'Entradas manuales de caja',
    },
    {
        key: 'movements_out',
        label: 'Movimientos de salida',
        amount: -Number(cashDrawer.value.cash_movements_out ?? 0),
        detail: 'Retiros o salidas manuales',
    },
]);

const statementRows = computed(() => [
    {
        key: 'gross',
        label: 'Ventas brutas cobradas',
        amount: Number(report.value?.total_sales ?? 0),
        detail: `${report.value?.orders_count ?? 0} documentos`,
        type: 'profit',
    },
    {
        key: 'refunds',
        label: 'Devoluciones',
        amount: -Number(report.value?.refunds ?? 0),
        detail: 'Notas y retornos aprobados',
        type: 'expense',
    },
    {
        key: 'discounts',
        label: 'Descuentos',
        amount: -Number(report.value?.total_discounts ?? 0),
        detail: 'Descuentos aplicados en venta',
        type: 'expense',
    },
    {
        key: 'shipping',
        label: 'Envios cobrados',
        amount: Number(report.value?.total_shipping ?? 0),
        detail: 'Ingresos por envio',
        type: 'profit',
    },
    {
        key: 'cogs',
        label: 'Costo de mercancia',
        amount: -Number(report.value?.cogs ?? 0),
        detail: 'Costo de articulos vendidos',
        type: 'expense',
    },
]);

const loadReport = async (): Promise<void> => {
    if (!selectedDate.value) {
        return;
    }

    await fetchZReport(
        selectedDate.value,
        selectedWarehouseId.value,
        selectedUserId.value,
    );
};

const handleExport = async (): Promise<void> => {
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

const formatCurrency = (value: unknown): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatSignedCurrency = (value: unknown): string => {
    const amount = Number(value) || 0;
    return `${amount > 0 ? '+' : ''}${formatCurrency(amount)}`;
};

const differenceClass = (value: unknown): string => {
    const amount = Number(value) || 0;

    if (amount > 0) {
        return 'text-emerald-700 dark:text-emerald-300';
    }

    if (amount < 0) {
        return 'text-rose-700 dark:text-rose-300';
    }

    return 'text-slate-900 dark:text-slate-100';
};

onMounted(async () => {
    await initWarehouse();

    if (warehouses.value.length === 0) {
        await fetchWarehouses();
    }

    if (users.value.length === 0) {
        await fetchUsers();
    }

    selectedWarehouseId.value = currentWarehouseId.value || undefined;
    await loadReport();
});
</script>

<template>
    <Head title="Cierre de Caja (Z-Report)" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <FinanceReportShell
                eyebrow="Cierre diario"
                title="Cierre de Caja / Z-Report"
                :subtitle="`${selectedDate} · ${activeWarehouseName} · ${activeUserName}`"
                :icon="Receipt"
            >
                <template #actions>
                    <button
                        type="button"
                        @click="handleExport"
                        :disabled="exporting || loading || !report"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                    >
                        <Printer :size="16" />
                        {{ exporting ? 'Exportando...' : 'PDF / Imprimir' }}
                    </button>
                </template>

                <div
                    class="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto] dark:border-slate-800 dark:bg-slate-900/60"
                >
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            <Calendar :size="12" class="mr-1 inline" />
                            Fecha
                        </label>
                        <input
                            v-model="selectedDate"
                            type="date"
                            class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-500/20"
                            @change="loadReport"
                        />
                    </div>
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Sucursal
                        </label>
                        <SearchableSelect
                            v-model="warehouseFilterModel"
                            :options="warehouseOptions"
                            placeholder="Todas"
                            @update:model-value="loadReport"
                        />
                    </div>
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Cajero
                        </label>
                        <SearchableSelect
                            v-model="userFilterModel"
                            :options="userOptions"
                            placeholder="Todos"
                            @update:model-value="loadReport"
                        />
                    </div>
                    <div class="flex items-end">
                        <button
                            type="button"
                            @click="loadReport"
                            class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                            <RefreshCw
                                :size="16"
                                :class="{ 'animate-spin': loading }"
                            />
                            Cargar
                        </button>
                    </div>
                </div>
            </FinanceReportShell>

            <div
                v-if="error"
                class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
            >
                <AlertCircle :size="18" class="mt-0.5 shrink-0" />
                {{ error }}
            </div>

            <div
                v-if="loading && !report"
                class="rounded-lg border border-slate-200 bg-white py-14 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
            >
                <RefreshCw :size="20" class="mx-auto mb-3 animate-spin" />
                Cargando cierre de caja...
            </div>

            <template v-else-if="report">
                <div class="grid gap-3 md:grid-cols-5">
                    <FinanceKpiCard
                        label="Ventas netas"
                        :value="formatCurrency(report.net_sales)"
                        :detail="`${report.orders_count} documentos`"
                        accent="indigo"
                        :icon="Receipt"
                    />
                    <FinanceKpiCard
                        label="Efectivo esperado"
                        :value="formatCurrency(cashDrawer.expected_cash ?? 0)"
                        :detail="`${cashDrawer.sessions_count ?? 0} sesiones`"
                        accent="emerald"
                        :icon="Banknote"
                    />
                    <FinanceKpiCard
                        label="Efectivo contado"
                        :value="formatCurrency(declaredCash)"
                        detail="Declarado al cierre"
                        accent="slate"
                        :icon="Wallet"
                    />
                    <FinanceKpiCard
                        label="Diferencia"
                        :value="formatSignedCurrency(cashDifference)"
                        :detail="differenceDetail"
                        :accent="
                            cashDifference < 0
                                ? 'rose'
                                : cashDifference > 0
                                  ? 'amber'
                                  : 'emerald'
                        "
                        :icon="Scale"
                    />
                    <FinanceKpiCard
                        label="Utilidad bruta"
                        :value="formatCurrency(report.gross_profit)"
                        :detail="`Ticket prom. ${formatCurrency(report.average_ticket)}`"
                        :accent="grossProfitTone"
                        :icon="BarChart3"
                    />
                </div>

                <div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <FinanceAccountingPanel
                        title="Arqueo de efectivo"
                        :total="Number(cashDrawer.expected_cash ?? 0)"
                        :rows="cashRows"
                        :icon="Wallet"
                        tone="asset"
                        :currency-formatter="formatCurrency"
                    />

                    <section
                        class="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                        <header
                            class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
                        >
                            <div class="flex items-center gap-2">
                                <Scale
                                    :size="17"
                                    class="text-indigo-600 dark:text-indigo-300"
                                />
                                <h3
                                    class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                >
                                    Conciliacion de caja
                                </h3>
                            </div>
                            <span
                                class="text-sm font-semibold tabular-nums"
                                :class="differenceClass(cashDifference)"
                            >
                                {{ formatSignedCurrency(cashDifference) }}
                            </span>
                        </header>

                        <div class="grid gap-3 p-4 sm:grid-cols-2">
                            <div
                                class="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70"
                            >
                                <p
                                    class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Esperado
                                </p>
                                <p
                                    class="mt-2 text-xl font-semibold text-slate-950 tabular-nums dark:text-slate-50"
                                >
                                    {{
                                        formatCurrency(
                                            cashDrawer.expected_cash ?? 0,
                                        )
                                    }}
                                </p>
                            </div>
                            <div
                                class="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70"
                            >
                                <p
                                    class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Contado
                                </p>
                                <p
                                    class="mt-2 text-xl font-semibold text-slate-950 tabular-nums dark:text-slate-50"
                                >
                                    {{ formatCurrency(declaredCash) }}
                                </p>
                            </div>
                        </div>

                        <div
                            class="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
                        >
                            Los cobros a credito permanecen en cuentas por
                            cobrar; solo los cobros reales alimentan caja.
                        </div>
                    </section>
                </div>

                <div class="grid gap-4 xl:grid-cols-[1fr_420px]">
                    <FinanceAccountingPanel
                        title="Estado de resultados del dia"
                        :total="Number(report.gross_profit ?? 0)"
                        :rows="statementRows"
                        :icon="FileText"
                        tone="profit"
                        :currency-formatter="formatCurrency"
                    />

                    <div class="space-y-4">
                        <FinanceMethodBars
                            :rows="paymentMethodRows"
                            :currency-formatter="formatCurrency"
                        />

                        <section
                            class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                        >
                            <div class="mb-3 flex items-center gap-2">
                                <CreditCard
                                    :size="17"
                                    class="text-amber-600 dark:text-amber-300"
                                />
                                <h3
                                    class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                >
                                    Credito cliente
                                </h3>
                            </div>
                            <p
                                class="text-2xl font-semibold text-slate-950 tabular-nums dark:text-slate-50"
                            >
                                {{
                                    formatCurrency(
                                        (report.by_payment_method?.credit ??
                                            0) +
                                            (report.by_payment_method
                                                ?.account_credit ?? 0),
                                    )
                                }}
                            </p>
                            <p
                                class="mt-1 text-xs text-slate-500 dark:text-slate-400"
                            >
                                Se reporta como cuenta por cobrar, no como
                                efectivo disponible.
                            </p>
                        </section>
                    </div>
                </div>

                <section
                    class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                    <header
                        class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
                    >
                        <div class="flex items-center gap-2">
                            <UserRound
                                :size="17"
                                class="text-slate-600 dark:text-slate-300"
                            />
                            <h3
                                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                            >
                                Conciliacion por cajero
                            </h3>
                        </div>
                        <span
                            class="text-xs text-slate-500 dark:text-slate-400"
                        >
                            {{ report.by_user?.length ?? 0 }} cajeros
                        </span>
                    </header>

                    <div class="overflow-x-auto">
                        <table
                            class="min-w-full divide-y divide-slate-200 dark:divide-slate-800"
                        >
                            <thead class="bg-slate-50 dark:bg-slate-900/80">
                                <tr>
                                    <th
                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Cajero
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Sesiones
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Apertura
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Esperado
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Contado
                                    </th>
                                    <th
                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Diferencia
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-slate-100 dark:divide-slate-800"
                            >
                                <tr
                                    v-for="row in report.by_user"
                                    :key="row.user_id"
                                    class="hover:bg-slate-50 dark:hover:bg-slate-900/70"
                                >
                                    <td
                                        class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100"
                                    >
                                        {{ row.user_name || 'Sin usuario' }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm text-slate-600 tabular-nums dark:text-slate-300"
                                    >
                                        {{ row.sessions_count }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm text-slate-600 tabular-nums dark:text-slate-300"
                                    >
                                        {{ formatCurrency(row.opening_amount) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm text-slate-600 tabular-nums dark:text-slate-300"
                                    >
                                        {{ formatCurrency(row.expected_cash) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm text-slate-600 tabular-nums dark:text-slate-300"
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
                                        class="px-4 py-3 text-right text-sm font-semibold tabular-nums"
                                        :class="differenceClass(row.difference)"
                                    >
                                        {{
                                            formatSignedCurrency(row.difference)
                                        }}
                                    </td>
                                </tr>
                                <tr v-if="!report.by_user?.length">
                                    <td
                                        colspan="6"
                                        class="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        No hay sesiones de caja para los filtros
                                        seleccionados.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <div
                    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-950"
                >
                    <div class="flex items-center gap-3">
                        <ArrowUp
                            :size="16"
                            class="text-emerald-600 dark:text-emerald-300"
                        />
                        <span class="text-slate-600 dark:text-slate-300">
                            Impuestos: {{ formatCurrency(report.total_tax) }}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <ArrowDown
                            :size="16"
                            class="text-rose-600 dark:text-rose-300"
                        />
                        <span class="text-slate-600 dark:text-slate-300">
                            Descuentos:
                            {{ formatCurrency(report.total_discounts) }}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <Download
                            :size="16"
                            class="text-indigo-600 dark:text-indigo-300"
                        />
                        <span class="text-slate-600 dark:text-slate-300">
                            Exportacion PDF funcional conservada.
                        </span>
                    </div>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
