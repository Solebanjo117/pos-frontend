<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Link } from '@inertiajs/vue3';
import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    Clock,
    CreditCard,
    Minus,
    Printer,
    Receipt,
    TrendingDown,
    TrendingUp,
    User,
    Warehouse,
    X,
} from 'lucide-vue-next';
import type {
    CashMovementRecord,
    PosSessionRecord,
    SessionSalesOrder,
} from '@/services/posSessions';
import { usePaymentMethods } from '@/composables/usePaymentMethods';

interface ReconciliationRow {
    code: string;
    label?: string;
    start_adds: number;
    payments: number;
    withdrawals: number;
    expected_total: number;
    declared_total?: number;
    difference?: number;
    is_countable?: boolean;
    is_informational?: boolean;
}

interface DenominationRow {
    id: string;
    label: string;
    unitValue: number;
    packValue: number;
}

const DENOM_ROWS: DenominationRow[] = [
    { id: '100', label: '$100', unitValue: 100, packValue: 10000 },
    { id: '50', label: '$50', unitValue: 50, packValue: 5000 },
    { id: '20', label: '$20', unitValue: 20, packValue: 2000 },
    { id: '10', label: '$10', unitValue: 10, packValue: 1000 },
    { id: '5', label: '$5', unitValue: 5, packValue: 500 },
    { id: '1', label: '$1', unitValue: 1, packValue: 100 },
    { id: '1.00', label: '$1.00 moneda', unitValue: 1, packValue: 25 },
    { id: '0.50', label: '$0.50', unitValue: 0.5, packValue: 10 },
    { id: '0.25', label: '$0.25', unitValue: 0.25, packValue: 10 },
    { id: '0.10', label: '$0.10', unitValue: 0.1, packValue: 5 },
    { id: '0.05', label: '$0.05', unitValue: 0.05, packValue: 2 },
    { id: '0.01', label: '$0.01', unitValue: 0.01, packValue: 0.5 },
];

const props = defineProps<{
    session: PosSessionRecord | null;
    salesOrders: SessionSalesOrder[];
    cashMovements: CashMovementRecord[];
    loading: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const { fetchMethods, getMethodName } = usePaymentMethods();

onMounted(fetchMethods);

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

const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Sin hora';

    return new Date(dateStr).toLocaleTimeString('es-MX', {
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

const summary = computed(() => props.session?.closing_details?.summary ?? null);
const denominations = computed<Record<string, number | string> | null>(
    () => props.session?.closing_details?.denominations ?? null,
);

const reconciliationRows = computed<ReconciliationRow[]>(() => {
    const rows =
        summary.value?.reconciliation_rows ??
        props.session?.closing_details?.reconciliation_rows;

    if (Array.isArray(rows) && rows.length > 0) {
        return rows as ReconciliationRow[];
    }

    if (!summary.value) return [];

    const electronicBreakdown = summary.value.electronic_breakdown ?? {};
    const rowsFromSummary: ReconciliationRow[] = [
        {
            code: 'cash',
            label: getMethodName('cash'),
            start_adds:
                moneyValue(summary.value.opening_amount) +
                moneyValue(summary.value.cash_movements_in),
            payments: moneyValue(summary.value.cash_sales),
            withdrawals: -moneyValue(summary.value.cash_movements_out),
            expected_total: moneyValue(summary.value.expected_cash),
            declared_total: moneyValue(summary.value.declared_cash),
            difference: moneyValue(summary.value.difference),
            is_countable: true,
            is_informational: false,
        },
    ];

    Object.entries(electronicBreakdown).forEach(([code, amount]) => {
        rowsFromSummary.push({
            code,
            label: getMethodName(code),
            start_adds: 0,
            payments: moneyValue(amount),
            withdrawals: 0,
            expected_total: moneyValue(amount),
            declared_total: 0,
            difference: 0,
            is_countable: true,
            is_informational: false,
        });
    });

    return rowsFromSummary;
});

const countableRows = computed(() =>
    reconciliationRows.value.filter((row) => !row.is_informational),
);
const informationalRows = computed(() =>
    reconciliationRows.value.filter((row) => row.is_informational),
);
const cashRow = computed(
    () => reconciliationRows.value.find((row) => row.code === 'cash') ?? null,
);

const expectedTotal = computed(() =>
    moneyValue(
        summary.value?.expected_total ??
            countableRows.value.reduce(
                (total, row) => total + moneyValue(row.expected_total),
                0,
            ),
    ),
);
const declaredTotal = computed(() =>
    moneyValue(
        summary.value?.declared_total ??
            countableRows.value.reduce(
                (total, row) => total + moneyValue(row.declared_total),
                0,
            ),
    ),
);
const totalDifference = computed(() =>
    moneyValue(
        summary.value?.total_difference ??
            declaredTotal.value - expectedTotal.value,
    ),
);
const totalSales = computed(() =>
    moneyValue(
        summary.value?.total_sales ??
            countableRows.value.reduce(
                (total, row) => total + Math.max(0, moneyValue(row.payments)),
                0,
            ),
    ),
);

const differenceTone = computed<'surplus' | 'missing' | 'balanced'>(() => {
    if (totalDifference.value > 0.005) return 'surplus';
    if (totalDifference.value < -0.005) return 'missing';

    return 'balanced';
});

const differenceLabel = computed(() => {
    if (differenceTone.value === 'surplus') return 'Sobrante';
    if (differenceTone.value === 'missing') return 'Faltante';

    return 'Cuadra';
});

const differenceClass = computed(() => {
    if (differenceTone.value === 'surplus')
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800';
    if (differenceTone.value === 'missing')
        return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800';

    return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border';
});

const denomData = computed(() => {
    if (!denominations.value) return [];

    const rows = DENOM_ROWS.map((denomination) => {
        const unitCount = moneyValue(
            denominations.value?.[`unit_${denomination.id}`],
        );
        const packCount = moneyValue(
            denominations.value?.[`pack_${denomination.id}`],
        );
        const subtotal =
            unitCount * denomination.unitValue +
            packCount * denomination.packValue;

        return {
            ...denomination,
            unitCount,
            packCount,
            subtotal,
        };
    }).filter(
        (denomination) =>
            denomination.unitCount > 0 || denomination.packCount > 0,
    );

    const extra = moneyValue(denominations.value.extra);
    if (extra > 0) {
        rows.push({
            id: 'extra',
            label: 'Extra',
            unitValue: extra,
            packValue: 0,
            unitCount: 1,
            packCount: 0,
            subtotal: extra,
        });
    }

    return rows;
});

const totalDenominations = computed(() =>
    denomData.value.reduce(
        (total, denomination) => total + denomination.subtotal,
        0,
    ),
);

const movementLabel = (movement: CashMovementRecord): string =>
    movement.type === 'in' ? 'Ingreso' : 'Retiro';

const movementClass = (movement: CashMovementRecord): string =>
    movement.type === 'in'
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-red-700 dark:text-red-300';

const paymentMethodLabel = (method: string): string => getMethodName(method);

const statusLabel = (status: string): string => {
    const map: Record<string, string> = {
        completed: 'Completada',
        confirmed: 'Confirmada',
        processing: 'En proceso',
        draft: 'Borrador',
        cancelled: 'Cancelada',
    };

    return map[status] || status;
};

const handlePrint = () => {
    window.print();
};
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0"
        @click.self="emit('close')"
    >
        <div
            class="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-card print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:shadow-none"
        >
            <header
                class="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-border dark:bg-card/95 print:static print:bg-white print:px-0 print:pt-0 print:pb-3"
            >
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h2
                            class="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white print:text-base"
                        >
                            <Receipt
                                :size="21"
                                class="text-slate-500 print:hidden"
                            />
                            Cierre de caja
                        </h2>
                        <span
                            v-if="session"
                            class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border"
                        >
                            Sesión #{{ session.id }}
                        </span>
                        <span
                            v-if="summary"
                            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1"
                            :class="differenceClass"
                        >
                            <TrendingUp
                                v-if="differenceTone === 'surplus'"
                                :size="13"
                            />
                            <TrendingDown
                                v-else-if="differenceTone === 'missing'"
                                :size="13"
                            />
                            <Minus v-else :size="13" />
                            {{ differenceLabel }}
                        </span>
                    </div>
                    <div
                        v-if="session"
                        class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 print:text-slate-700"
                    >
                        <span class="inline-flex items-center gap-1">
                            <User :size="13" class="print:hidden" />
                            {{ session.user?.name || 'Sin cajero' }}
                        </span>
                        <span class="inline-flex items-center gap-1">
                            <Warehouse :size="13" class="print:hidden" />
                            {{ session.warehouse?.name || 'General' }}
                        </span>
                        <span class="inline-flex items-center gap-1">
                            <Clock :size="13" class="print:hidden" />
                            {{
                                formatDuration(
                                    session.opened_at,
                                    session.closed_at,
                                )
                            }}
                        </span>
                    </div>
                </div>

                <div class="flex items-center gap-2 print:hidden">
                    <button
                        type="button"
                        class="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                        @click="handlePrint"
                    >
                        <Printer :size="16" />
                        Imprimir
                    </button>
                    <button
                        type="button"
                        class="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-muted"
                        @click="emit('close')"
                    >
                        <X :size="20" />
                    </button>
                </div>
            </header>

            <div
                v-if="loading"
                class="flex min-h-80 items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400"
            >
                Cargando detalle del cierre...
            </div>

            <main
                v-else-if="session"
                class="min-h-0 flex-1 overflow-y-auto p-5 print:overflow-visible print:p-0"
            >
                <section
                    class="hidden border-b border-slate-300 pb-3 text-center print:block"
                >
                    <h1 class="text-lg font-black tracking-wide uppercase">
                        Reporte de cierre de caja
                    </h1>
                    <p class="text-sm font-semibold">
                        {{ session.warehouse?.name || 'General' }}
                    </p>
                    <p class="text-xs text-slate-600">
                        Sesión #{{ session.id }} - Cajero:
                        {{ session.user?.name || 'Sin cajero' }}
                    </p>
                </section>

                <section
                    class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-5 print:gap-2"
                >
                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card print:shadow-none"
                    >
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Total esperado
                        </p>
                        <p
                            class="mt-1 text-xl font-bold text-slate-950 tabular-nums dark:text-white print:text-sm"
                        >
                            {{ formatCurrency(expectedTotal) }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card print:shadow-none"
                    >
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Total declarado
                        </p>
                        <p
                            class="mt-1 text-xl font-bold text-slate-950 tabular-nums dark:text-white print:text-sm"
                        >
                            {{ formatCurrency(declaredTotal) }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card print:shadow-none"
                    >
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Diferencia
                        </p>
                        <p
                            class="mt-1 text-xl font-bold tabular-nums print:text-sm"
                            :class="
                                differenceTone === 'missing'
                                    ? 'text-red-700 dark:text-red-300'
                                    : differenceTone === 'surplus'
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : 'text-slate-950 dark:text-white'
                            "
                        >
                            {{ totalDifference > 0 ? '+' : ''
                            }}{{ formatCurrency(totalDifference) }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card print:shadow-none"
                    >
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Efectivo esperado
                        </p>
                        <p
                            class="mt-1 text-xl font-bold text-slate-950 tabular-nums dark:text-white print:text-sm"
                        >
                            {{
                                formatCurrency(
                                    cashRow?.expected_total ??
                                        summary?.expected_cash,
                                )
                            }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card print:shadow-none"
                    >
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Ventas cobradas
                        </p>
                        <p
                            class="mt-1 text-xl font-bold text-slate-950 tabular-nums dark:text-white print:text-sm"
                        >
                            {{ formatCurrency(totalSales) }}
                        </p>
                    </div>
                </section>

                <section
                    class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] print:mt-3 print:grid-cols-2 print:gap-3"
                >
                    <div class="space-y-4 print:space-y-3">
                        <div
                            class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-border dark:bg-muted/50"
                            >
                                <h3
                                    class="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase dark:text-slate-300"
                                >
                                    <CreditCard
                                        :size="14"
                                        class="print:hidden"
                                    />
                                    Conciliación por método
                                </h3>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm print:text-[10px]">
                                    <thead>
                                        <tr
                                            class="border-b border-slate-200 text-xs text-slate-500 uppercase dark:border-border"
                                        >
                                            <th
                                                class="px-4 py-2 text-left font-bold"
                                            >
                                                Método
                                            </th>
                                            <th
                                                class="px-4 py-2 text-right font-bold"
                                            >
                                                Inicio + ingresos
                                            </th>
                                            <th
                                                class="px-4 py-2 text-right font-bold"
                                            >
                                                Pagos
                                            </th>
                                            <th
                                                class="px-4 py-2 text-right font-bold"
                                            >
                                                Retiros
                                            </th>
                                            <th
                                                class="px-4 py-2 text-right font-bold"
                                            >
                                                Esperado
                                            </th>
                                            <th
                                                class="px-4 py-2 text-right font-bold"
                                            >
                                                Declarado
                                            </th>
                                            <th
                                                class="px-4 py-2 text-right font-bold"
                                            >
                                                Diferencia
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-slate-100 dark:divide-border/60"
                                    >
                                        <tr
                                            v-for="row in countableRows"
                                            :key="row.code"
                                        >
                                            <td class="px-4 py-2">
                                                <div
                                                    class="font-semibold text-slate-950 dark:text-white"
                                                >
                                                    {{
                                                        row.label ||
                                                        paymentMethodLabel(
                                                            row.code,
                                                        )
                                                    }}
                                                </div>
                                                <div
                                                    class="font-mono text-[11px] text-slate-400 uppercase"
                                                >
                                                    {{ row.code }}
                                                </div>
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right text-slate-600 tabular-nums dark:text-slate-300"
                                            >
                                                {{
                                                    formatCurrency(
                                                        row.start_adds,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right text-slate-600 tabular-nums dark:text-slate-300"
                                            >
                                                {{
                                                    formatCurrency(row.payments)
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right text-slate-600 tabular-nums dark:text-slate-300"
                                            >
                                                {{
                                                    formatCurrency(
                                                        row.withdrawals,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right font-semibold text-slate-950 tabular-nums dark:text-white"
                                            >
                                                {{
                                                    formatCurrency(
                                                        row.expected_total,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right font-semibold text-slate-950 tabular-nums dark:text-white"
                                            >
                                                {{
                                                    formatCurrency(
                                                        row.declared_total ?? 0,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right font-bold tabular-nums"
                                                :class="
                                                    moneyValue(row.difference) <
                                                    -0.005
                                                        ? 'text-red-700 dark:text-red-300'
                                                        : moneyValue(
                                                                row.difference,
                                                            ) > 0.005
                                                          ? 'text-emerald-700 dark:text-emerald-300'
                                                          : 'text-slate-500 dark:text-slate-400'
                                                "
                                            >
                                                {{
                                                    moneyValue(row.difference) >
                                                    0
                                                        ? '+'
                                                        : ''
                                                }}{{
                                                    formatCurrency(
                                                        row.difference ?? 0,
                                                    )
                                                }}
                                            </td>
                                        </tr>
                                        <tr v-if="countableRows.length === 0">
                                            <td
                                                colspan="7"
                                                class="px-4 py-6 text-center text-slate-500"
                                            >
                                                No hay datos de conciliación.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div
                            v-if="informationalRows.length > 0"
                            class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-border dark:bg-muted/50"
                            >
                                <h3
                                    class="text-xs font-bold text-slate-600 uppercase dark:text-slate-300"
                                >
                                    Métodos informativos
                                </h3>
                            </div>
                            <table class="w-full text-sm print:text-[10px]">
                                <tbody
                                    class="divide-y divide-slate-100 dark:divide-border/60"
                                >
                                    <tr
                                        v-for="row in informationalRows"
                                        :key="row.code"
                                    >
                                        <td
                                            class="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200"
                                        >
                                            {{
                                                row.label ||
                                                paymentMethodLabel(row.code)
                                            }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right font-bold text-slate-950 tabular-nums dark:text-white"
                                        >
                                            {{
                                                formatCurrency(
                                                    row.expected_total,
                                                )
                                            }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div
                            class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-border dark:bg-muted/50"
                            >
                                <h3
                                    class="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase dark:text-slate-300"
                                >
                                    <Receipt :size="14" class="print:hidden" />
                                    Ventas del turno ({{ salesOrders.length }})
                                </h3>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm print:text-[10px]">
                                    <thead>
                                        <tr
                                            class="border-b border-slate-200 text-xs text-slate-500 uppercase dark:border-border"
                                        >
                                            <th
                                                class="px-4 py-2 text-left font-bold"
                                            >
                                                Folio
                                            </th>
                                            <th
                                                class="px-4 py-2 text-left font-bold"
                                            >
                                                Hora
                                            </th>
                                            <th
                                                class="px-4 py-2 text-left font-bold"
                                            >
                                                Cliente
                                            </th>
                                            <th
                                                class="px-4 py-2 text-left font-bold"
                                            >
                                                Pago
                                            </th>
                                            <th
                                                class="px-4 py-2 text-left font-bold"
                                            >
                                                Estado
                                            </th>
                                            <th
                                                class="px-4 py-2 text-right font-bold"
                                            >
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-slate-100 dark:divide-border/60"
                                    >
                                        <tr
                                            v-for="order in salesOrders"
                                            :key="order.id"
                                        >
                              <td
                                  class="px-4 py-2 font-mono text-xs font-semibold text-slate-950 dark:text-white"
                              >
                                  <Link
                                      :href="`/sales-orders/${order.id}`"
                                      class="text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300 print:text-slate-950 print:no-underline"
                                      title="Ver venta"
                                  >
                                      {{ order.order_number }}
                                  </Link>
                              </td>
                                            <td
                                                class="px-4 py-2 text-xs text-slate-600 dark:text-slate-300"
                                            >
                                                {{
                                                    formatTime(order.created_at)
                                                }}
                                            </td>
                                            <td
                                                class="px-4 py-2 text-slate-600 dark:text-slate-300"
                                            >
                                  <Link
                                      v-if="order.customer_id"
                                      :href="`/customers/${order.customer_id}`"
                                      class="text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300 print:text-slate-600 print:no-underline"
                                      title="Ver cliente"
                                  >
                                      {{
                                          order.customer?.name ||
                                          'Cliente registrado'
                                      }}
                                  </Link>
                                  <span v-else>Público General</span>
                              </td>
                                            <td class="px-4 py-2">
                                                <span
                                                    class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-muted dark:text-slate-300"
                                                >
                                                    {{
                                                        paymentMethodLabel(
                                                            order.payment_method,
                                                        )
                                                    }}
                                                </span>
                                            </td>
                                            <td
                                                class="px-4 py-2 text-xs text-slate-600 dark:text-slate-300"
                                            >
                                                {{ statusLabel(order.status) }}
                                            </td>
                                            <td
                                                class="px-4 py-2 text-right font-bold text-slate-950 tabular-nums dark:text-white"
                                            >
                                                {{
                                                    formatCurrency(order.total)
                                                }}
                                            </td>
                                        </tr>
                                        <tr v-if="salesOrders.length === 0">
                                            <td
                                                colspan="6"
                                                class="px-4 py-6 text-center text-slate-500"
                                            >
                                                No se registraron ventas en esta
                                                sesión.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <aside class="space-y-4 print:space-y-3">
                        <div
                            class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-border dark:bg-muted/50"
                            >
                                <h3
                                    class="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase dark:text-slate-300"
                                >
                                    <Banknote :size="14" class="print:hidden" />
                                    Arqueo de denominaciones
                                </h3>
                            </div>
                            <table
                                v-if="denomData.length > 0"
                                class="w-full text-sm print:text-[10px]"
                            >
                                <thead>
                                    <tr
                                        class="border-b border-slate-200 text-xs text-slate-500 uppercase dark:border-border"
                                    >
                                        <th
                                            class="px-4 py-2 text-left font-bold"
                                        >
                                            Denominación
                                        </th>
                                        <th
                                            class="px-4 py-2 text-center font-bold"
                                        >
                                            Sueltas
                                        </th>
                                        <th
                                            class="px-4 py-2 text-center font-bold"
                                        >
                                            Fajos
                                        </th>
                                        <th
                                            class="px-4 py-2 text-right font-bold"
                                        >
                                            Subtotal
                                        </th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-slate-100 dark:divide-border/60"
                                >
                                    <tr
                                        v-for="denomination in denomData"
                                        :key="denomination.id"
                                    >
                                        <td
                                            class="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200"
                                        >
                                            {{ denomination.label }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-center font-mono text-slate-600 dark:text-slate-300"
                                        >
                                            {{ denomination.unitCount || '-' }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-center font-mono text-slate-600 dark:text-slate-300"
                                        >
                                            {{ denomination.packCount || '-' }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right font-bold text-slate-950 tabular-nums dark:text-white"
                                        >
                                            {{
                                                formatCurrency(
                                                    denomination.subtotal,
                                                )
                                            }}
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr
                                        class="border-t border-slate-300 bg-slate-50 dark:bg-muted/50"
                                    >
                                        <td
                                            colspan="3"
                                            class="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase dark:text-slate-300"
                                        >
                                            Total contado
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right font-black text-slate-950 tabular-nums dark:text-white"
                                        >
                                            {{
                                                formatCurrency(
                                                    totalDenominations,
                                                )
                                            }}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div
                                v-else
                                class="p-5 text-center text-sm text-slate-500 dark:text-slate-400"
                            >
                                No se registró conteo de denominaciones.
                            </div>
                        </div>

                        <div
                            class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                        >
                            <h3
                                class="mb-3 flex items-center gap-2 text-xs font-bold text-slate-600 uppercase dark:text-slate-300"
                            >
                                <Clock :size="14" class="print:hidden" />
                                Datos del turno
                            </h3>
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between gap-4">
                                    <span
                                        class="text-slate-500 dark:text-slate-400"
                                        >Apertura</span
                                    >
                                    <span
                                        class="text-right font-semibold text-slate-950 dark:text-white"
                                        >{{
                                            formatDate(session.opened_at)
                                        }}</span
                                    >
                                </div>
                                <div class="flex justify-between gap-4">
                                    <span
                                        class="text-slate-500 dark:text-slate-400"
                                        >Cierre</span
                                    >
                                    <span
                                        class="text-right font-semibold text-slate-950 dark:text-white"
                                        >{{
                                            formatDate(session.closed_at)
                                        }}</span
                                    >
                                </div>
                                <div class="flex justify-between gap-4">
                                    <span
                                        class="text-slate-500 dark:text-slate-400"
                                        >Fondo inicial</span
                                    >
                                    <span
                                        class="font-semibold text-slate-950 tabular-nums dark:text-white"
                                        >{{
                                            formatCurrency(
                                                session.opening_amount,
                                            )
                                        }}</span
                                    >
                                </div>
                            </div>
                        </div>

                        <div
                            class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-border dark:bg-muted/50"
                            >
                                <h3
                                    class="text-xs font-bold text-slate-600 uppercase dark:text-slate-300"
                                >
                                    Movimientos de caja
                                </h3>
                            </div>
                            <div
                                v-if="cashMovements.length > 0"
                                class="divide-y divide-slate-100 dark:divide-border/60"
                            >
                                <div
                                    v-for="movement in cashMovements"
                                    :key="movement.id"
                                    class="px-4 py-3"
                                >
                                    <div
                                        class="flex items-start justify-between gap-3"
                                    >
                                        <div>
                                            <p
                                                class="text-sm font-semibold text-slate-950 dark:text-white"
                                            >
                                                {{ movement.reason }}
                                            </p>
                                            <p
                                                class="text-xs text-slate-500 dark:text-slate-400"
                                            >
                                                {{ movementLabel(movement) }} -
                                                {{
                                                    formatTime(
                                                        movement.created_at,
                                                    )
                                                }}
                                            </p>
                                            <p
                                                v-if="movement.notes"
                                                class="mt-1 text-xs text-slate-500 dark:text-slate-400"
                                            >
                                                {{ movement.notes }}
                                            </p>
                                        </div>
                                        <span
                                            class="shrink-0 text-sm font-bold tabular-nums"
                                            :class="movementClass(movement)"
                                        >
                                            {{
                                                movement.type === 'in'
                                                    ? '+'
                                                    : '-'
                                            }}{{
                                                formatCurrency(movement.amount)
                                            }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div
                                v-else
                                class="p-5 text-center text-sm text-slate-500 dark:text-slate-400"
                            >
                                No hubo ingresos extra ni retiros.
                            </div>
                        </div>

                        <div
                            v-if="session.notes"
                            class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                        >
                            <h3
                                class="mb-1 flex items-center gap-2 text-xs font-bold uppercase"
                            >
                                <AlertCircle :size="14" class="print:hidden" />
                                Nota del cierre
                            </h3>
                            <p class="text-sm">{{ session.notes }}</p>
                        </div>
                    </aside>
                </section>

                <section
                    class="hidden print:mt-8 print:grid print:grid-cols-2 print:gap-16"
                >
                    <div
                        class="border-t border-slate-400 pt-1 text-center text-[10px] text-slate-600"
                    >
                        Firma del cajero
                    </div>
                    <div
                        class="border-t border-slate-400 pt-1 text-center text-[10px] text-slate-600"
                    >
                        Firma del supervisor
                    </div>
                </section>
            </main>
        </div>
    </div>
</template>

<style>
@media print {
    body * {
        visibility: hidden;
    }

    .fixed.inset-0,
    .fixed.inset-0 * {
        visibility: visible;
    }

    .fixed.inset-0 {
        position: absolute;
        inset: 0;
    }

    @page {
        size: letter;
        margin: 0.5cm;
    }
}
</style>
