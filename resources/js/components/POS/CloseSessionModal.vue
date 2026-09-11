<script setup lang="ts">
import { AlertCircle, Calculator, RotateCcw, Send, X } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { formatCurrency, roundMoney } from '@/utils/formatters';
import type { PosSession, PosSessionSummary } from '../../types/pos-session';

interface CashDenomination {
    id: string;
    label: string;
    value: number;
}

interface ReconciliationRow {
    code: string;
    label: string;
    start_adds: number;
    payments: number;
    withdrawals: number;
    expected_total: number;
    declared_total?: number;
    difference?: number;
    is_countable?: boolean;
    is_informational?: boolean;
}

const CASH_DENOMINATIONS: CashDenomination[] = [
    { id: '100', label: '$100', value: 100 },
    { id: '50', label: '$50', value: 50 },
    { id: '20', label: '$20', value: 20 },
    { id: '10', label: '$10', value: 10 },
    { id: '5', label: '$5', value: 5 },
    { id: '1', label: '$1', value: 1 },
    { id: '0.25', label: '25c', value: 0.25 },
    { id: '0.10', label: '10c', value: 0.1 },
    { id: '0.05', label: '5c', value: 0.05 },
    { id: '0.01', label: '1c', value: 0.01 },
];

const props = defineProps<{
    show: boolean;
    session: PosSession | null;
    summary: PosSessionSummary | null;
    loading?: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    (
        e: 'submit',
        amount: number,
        notes?: string,
        closingDetails?: Record<string, any>,
    ): void;
    (e: 'close'): void;
}>();

const { methods, fetchMethods } = usePaymentMethods();

const cashCounts = reactive<Record<string, number>>(
    CASH_DENOMINATIONS.reduce<Record<string, number>>(
        (acc, denomination) => ({
            ...acc,
            [`unit_${denomination.id}`]: 0,
        }),
        {},
    ),
);
const payments = reactive<Record<string, number>>({});
const extraCash = ref(0);
const notes = ref('');
const submitted = ref(false);

const summaryData = computed(
    () =>
        props.summary as
            | (PosSessionSummary & {
                  expected_total?: number;
                  total_difference?: number;
                  reconciliation_rows?: ReconciliationRow[];
              })
            | null,
);

const money = (value: number): number => roundMoney(value);

const normalizeCount = (value: string): number => {
    const parsed = Math.floor(Number(value));

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeMoney = (value: string): number => {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? money(parsed) : 0;
};

const normalizeSignedMoney = (value: string): number => {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? money(parsed) : 0;
};

const existingRows = computed<ReconciliationRow[]>(() => {
    const rows = summaryData.value?.reconciliation_rows;

    return Array.isArray(rows) ? rows : [];
});

const fallbackRows = computed<ReconciliationRow[]>(() => {
    const electronicBreakdown = summaryData.value?.electronic_breakdown ?? {};
    const methodCodes = new Set<string>([
        ...methods.value.map((method) => method.code),
        ...Object.keys(electronicBreakdown),
    ]);
    methodCodes.delete('cash');

    const rows: ReconciliationRow[] = [
        {
            code: 'cash',
            label: 'Efectivo',
            start_adds:
                Number(summaryData.value?.opening_amount ?? 0) +
                Number(summaryData.value?.cash_movements_in ?? 0),
            payments: Number(summaryData.value?.cash_sales ?? 0),
            withdrawals: -Number(summaryData.value?.cash_movements_out ?? 0),
            expected_total: Number(
                summaryData.value?.expected_cash ??
                    props.session?.expected_amount ??
                    0,
            ),
        },
    ];

    methodCodes.forEach((code) => {
        const method = methods.value.find((item) => item.code === code);
        const expected = Number(electronicBreakdown[code] ?? 0);

        rows.push({
            code,
            label: method?.name ?? code,
            start_adds: 0,
            payments: expected,
            withdrawals: 0,
            expected_total: expected,
        });
    });

    return rows;
});

const reconciliationRows = computed<ReconciliationRow[]>(() =>
    existingRows.value.length ? existingRows.value : fallbackRows.value,
);

const cashRow = computed<ReconciliationRow>(
    () =>
        reconciliationRows.value.find((row) => row.code === 'cash') ??
        fallbackRows.value[0],
);

const paymentRows = computed<ReconciliationRow[]>(() =>
    reconciliationRows.value.filter(
        (row) => row.code !== 'cash' && !row.is_informational,
    ),
);

const informationalRows = computed<ReconciliationRow[]>(() =>
    reconciliationRows.value.filter((row) => row.is_informational),
);

const totalCashCounted = computed(() =>
    money(
        CASH_DENOMINATIONS.reduce((total, denomination) => {
            return (
                total +
                (cashCounts[`unit_${denomination.id}`] || 0) *
                    denomination.value
            );
        }, 0) + extraCash.value,
    ),
);

const totalElectronicCounted = computed(() =>
    money(
        paymentRows.value.reduce(
            (total, row) => total + Number(payments[row.code] || 0),
            0,
        ),
    ),
);

const totalCounted = computed(() =>
    money(totalCashCounted.value + totalElectronicCounted.value),
);

const totalExpected = computed(() =>
    money(
        reconciliationRows.value
            .filter((row) => !row.is_informational)
            .reduce((total, row) => total + Number(row.expected_total || 0), 0),
    ),
);

const difference = computed(() =>
    money(totalCounted.value - totalExpected.value),
);
const isBalanced = computed(() => Math.abs(difference.value) < 0.01);
const isMissing = computed(() => difference.value < -0.005);
const isSurplus = computed(() => difference.value > 0.005);
const requiresNotes = computed(() => !isBalanced.value);

const handleCashCountChange = (id: string, value: string): void => {
    cashCounts[id] = normalizeCount(value);
};

const handleExtraCashChange = (value: string): void => {
    extraCash.value = normalizeMoney(value);
};

const handlePaymentChange = (code: string, value: string): void => {
    payments[code] = normalizeSignedMoney(value);
};

const handleClear = (): void => {
    CASH_DENOMINATIONS.forEach((denomination) => {
        cashCounts[`unit_${denomination.id}`] = 0;
    });
    paymentRows.value.forEach((row) => {
        payments[row.code] = 0;
    });
    extraCash.value = 0;
    notes.value = '';
};

const handleSubmit = (): void => {
    if (
        props.loading ||
        submitted.value ||
        (requiresNotes.value && !notes.value.trim())
    ) {
        return;
    }

    submitted.value = true;
    const paymentMethodCounts = paymentRows.value.reduce<
        Record<string, number>
    >((counts, row) => {
        counts[row.code] = Number(payments[row.code] || 0);

        return counts;
    }, {});

    const closingDetails: Record<string, any> = {
        denominations: {
            ...cashCounts,
            extra: extraCash.value,
        },
        payment_method_counts: paymentMethodCounts,
        electronic_payments: paymentMethodCounts,
    };

    emit('submit', totalCashCounted.value, notes.value, closingDetails);
};

const close = (): void => {
    handleClear();
    submitted.value = false;
    emit('close');
};

watch(
    () => props.show,
    async (visible) => {
        if (visible) {
            handleClear();
            submitted.value = false;
            await fetchMethods();
        }
    },
    { immediate: true },
);

watch(
    () => props.loading,
    (loading) => {
        if (!loading) submitted.value = false;
    },
);

watch(
    paymentRows,
    (rows) => {
        rows.forEach((row) => {
            if (!(row.code in payments)) {
                payments[row.code] = 0;
            }
        });
    },
    { immediate: true },
);
</script>

<template>
    <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 text-slate-900"
    >
        <div
            class="flex max-h-[calc(100vh-32px)] w-[min(1180px,calc(100vw-32px))] flex-col overflow-hidden bg-white shadow-2xl"
        >
            <header
                class="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="flex h-7 w-7 items-center justify-center rounded-md bg-slate-950 text-white"
                    >
                        <Calculator :size="16" />
                    </div>
                    <h1 class="text-sm font-bold text-slate-950">
                        Arqueo de Cierre
                    </h1>
                </div>

                <div class="flex items-center gap-4 text-xs text-slate-500">
                    <span v-if="session">Sesión #{{ session.id }}</span>
                    <button
                        type="button"
                        class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        @click="close"
                    >
                        <X :size="18" />
                    </button>
                </div>
            </header>

            <div
                v-if="error"
                class="mx-5 mt-3 flex items-center gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
            >
                <AlertCircle :size="15" />
                <span>{{ error }}</span>
            </div>

            <main
                class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-3"
            >
                <table
                    class="w-full table-fixed border-collapse border border-slate-300 text-xs"
                >
                    <colgroup>
                        <col class="w-[15%]" />
                        <col class="w-[12%]" />
                        <col class="w-[12%]" />
                        <col class="w-[12%]" />
                        <col class="w-[15%]" />
                        <col class="w-[34%]" />
                    </colgroup>
                    <thead>
                        <tr class="bg-slate-50 text-[11px] text-slate-700">
                            <th
                                class="border border-slate-300 px-2 py-2 text-left font-bold"
                            >
                                Tipo
                            </th>
                            <th
                                class="border border-slate-300 px-2 py-2 text-right font-bold"
                            >
                                Inicio + Ingresos
                            </th>
                            <th
                                class="border border-slate-300 px-2 py-2 text-right font-bold"
                            >
                                Pagos
                            </th>
                            <th
                                class="border border-slate-300 px-2 py-2 text-right font-bold"
                            >
                                Retiros
                            </th>
                            <th
                                class="border border-slate-300 px-2 py-2 text-right font-bold"
                            >
                                Total esperado
                            </th>
                            <th
                                class="border border-slate-300 px-2 py-2 text-right font-bold"
                            >
                                Conteo de cierre
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="h-[340px] align-top">
                            <td class="border border-slate-300 px-2 py-2">
                                <div class="font-bold text-slate-950">
                                    Efectivo
                                </div>
                                <div
                                    class="mt-0.5 text-[10px] font-semibold text-slate-400 uppercase"
                                >
                                    CASH
                                </div>
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(cashRow.start_adds) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(cashRow.payments) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(cashRow.withdrawals) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-bold text-slate-950"
                            >
                                {{ formatCurrency(cashRow.expected_total) }}
                            </td>
                            <td class="border border-slate-300 px-2 py-2">
                                <div
                                    class="ml-auto w-full max-w-[150px] min-w-0 space-y-0.5"
                                >
                                    <div
                                        v-for="denomination in CASH_DENOMINATIONS"
                                        :key="denomination.id"
                                        class="grid min-w-0 grid-cols-[46px_minmax(0,1fr)] items-center gap-2"
                                    >
                                        <label
                                            :for="`cash-${denomination.id}`"
                                            class="text-right text-[11px] font-bold text-slate-600"
                                        >
                                            {{ denomination.label }} x
                                        </label>
                                        <input
                                            :id="`cash-${denomination.id}`"
                                            type="number"
                                            min="0"
                                            step="1"
                                            :value="
                                                cashCounts[
                                                    `unit_${denomination.id}`
                                                ] || ''
                                            "
                                            class="h-6 min-w-0 border border-slate-300 px-2 text-right text-xs font-semibold outline-none focus:border-slate-500"
                                            @input="
                                                handleCashCountChange(
                                                    `unit_${denomination.id}`,
                                                    (
                                                        $event.target as HTMLInputElement
                                                    ).value,
                                                )
                                            "
                                        />
                                    </div>

                                    <div
                                        class="grid min-w-0 grid-cols-[46px_minmax(0,1fr)] items-center gap-2 pt-1"
                                    >
                                        <label
                                            for="cash-extra"
                                            class="text-right text-[11px] font-bold text-slate-600"
                                        >
                                            Extra
                                        </label>
                                        <div
                                            class="flex h-6 border border-slate-300"
                                        >
                                            <span
                                                class="flex w-8 items-center justify-center border-r border-slate-300 text-xs font-bold text-slate-500"
                                            >
                                                $
                                            </span>
                                            <input
                                                id="cash-extra"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                :value="extraCash || ''"
                                                class="min-w-0 flex-1 px-2 text-right text-xs font-semibold outline-none focus:bg-slate-50"
                                                @input="
                                                    handleExtraCashChange(
                                                        (
                                                            $event.target as HTMLInputElement
                                                        ).value,
                                                    )
                                                "
                                            />
                                        </div>
                                    </div>

                                    <div
                                        class="grid min-w-0 grid-cols-[46px_minmax(0,1fr)] items-center gap-2 pt-1"
                                    >
                                        <span
                                            class="text-right text-[11px] font-bold text-slate-700"
                                        >
                                            Total
                                        </span>
                                        <div
                                            class="flex h-6 border border-slate-300 bg-slate-50"
                                        >
                                            <span
                                                class="flex w-8 items-center justify-center border-r border-slate-300 text-xs font-bold text-slate-500"
                                            >
                                                $
                                            </span>
                                            <div
                                                class="flex min-w-0 flex-1 items-center justify-end px-2 text-xs font-bold text-slate-950"
                                            >
                                                {{
                                                    totalCashCounted.toFixed(2)
                                                }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <tr
                            v-for="row in paymentRows"
                            :key="row.code"
                            class="h-11"
                        >
                            <td class="border border-slate-300 px-2 py-2">
                                <div class="font-bold text-slate-950">
                                    {{ row.label }}
                                </div>
                                <div
                                    class="mt-0.5 text-[10px] font-semibold text-slate-400 uppercase"
                                >
                                    {{ row.code }}
                                </div>
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(row.start_adds) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(row.payments) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(row.withdrawals) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-bold text-slate-950"
                            >
                                {{ formatCurrency(row.expected_total) }}
                            </td>
                            <td class="border border-slate-300 px-2 py-2">
                                <div
                                    class="ml-auto flex h-8 w-full max-w-36 min-w-0 border border-slate-300"
                                >
                                    <span
                                        class="flex w-8 items-center justify-center border-r border-slate-300 text-xs font-bold text-slate-500"
                                    >
                                        $
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        :value="payments[row.code] || ''"
                                        class="min-w-0 flex-1 px-2 text-right text-sm font-bold outline-none focus:bg-slate-50"
                                        @input="
                                            handlePaymentChange(
                                                row.code,
                                                (
                                                    $event.target as HTMLInputElement
                                                ).value,
                                            )
                                        "
                                    />
                                </div>
                            </td>
                        </tr>
                        <tr
                            v-for="row in informationalRows"
                            :key="`info-${row.code}`"
                            class="h-11 bg-slate-50"
                        >
                            <td class="border border-slate-300 px-2 py-2">
                                <div class="font-bold text-slate-950">
                                    {{ row.label }}
                                </div>
                                <div
                                    class="mt-0.5 text-[10px] font-semibold text-slate-400 uppercase"
                                >
                                    {{ row.code }} - informativo
                                </div>
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(row.start_adds) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(row.payments) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-semibold"
                            >
                                {{ formatCurrency(row.withdrawals) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-right font-bold text-slate-950"
                            >
                                {{ formatCurrency(row.expected_total) }}
                            </td>
                            <td
                                class="border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-500"
                            >
                                No se cuenta en cierre
                            </td>
                        </tr>
                    </tbody>
                </table>
            </main>

            <footer
                class="grid shrink-0 grid-cols-[minmax(0,1fr)_250px] gap-4 border-t border-slate-300 bg-white px-5 py-3"
            >
                <div class="flex min-w-0 flex-wrap items-end gap-2">
                    <button
                        type="button"
                        :disabled="
                            loading ||
                            submitted ||
                            (requiresNotes && !notes.trim())
                        "
                        class="inline-flex h-9 items-center gap-2 border border-slate-300 bg-slate-50 px-3 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="handleSubmit"
                    >
                        <Send :size="14" />
                        <span v-if="loading">Enviando...</span>
                        <span v-else>Enviar conteos</span>
                    </button>
                    <button
                        type="button"
                        class="h-9 border border-slate-400 bg-white px-5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        @click="close"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        class="inline-flex h-9 items-center gap-2 border border-slate-400 bg-white px-5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        @click="handleClear"
                    >
                        <RotateCcw :size="14" />
                        Limpiar
                    </button>

                    <div
                        v-if="requiresNotes"
                        class="ml-2 flex max-w-lg min-w-[260px] flex-1 flex-col"
                    >
                        <label
                            for="closing-notes"
                            class="mb-1 text-[11px] font-bold text-red-600"
                        >
                            Justificación obligatoria
                        </label>
                        <textarea
                            id="closing-notes"
                            v-model="notes"
                            rows="2"
                            class="w-full resize-none border border-red-200 bg-red-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-red-400"
                            :placeholder="
                                isMissing
                                    ? 'Explique el motivo del faltante...'
                                    : 'Explique el motivo del sobrante...'
                            "
                        />
                    </div>
                </div>

                <div class="border border-slate-200">
                    <div
                        class="flex justify-between border-b border-slate-200 px-3 py-2"
                    >
                        <span class="text-xs font-bold text-slate-500"
                            >Total esperado</span
                        >
                        <span class="text-xs font-bold text-slate-950">
                            {{ formatCurrency(totalExpected) }}
                        </span>
                    </div>
                    <div
                        class="flex justify-between border-b border-slate-200 px-3 py-2"
                    >
                        <span class="text-xs font-bold text-slate-500"
                            >Total contado</span
                        >
                        <span class="text-xs font-bold text-slate-950">
                            {{ formatCurrency(totalCounted) }}
                        </span>
                    </div>
                    <div class="flex justify-between px-3 py-2">
                        <span class="text-xs font-bold text-slate-500"
                            >Diferencia</span
                        >
                        <span
                            class="text-xs font-bold"
                            :class="{
                                'text-green-600': isBalanced,
                                'text-red-600': !isBalanced,
                            }"
                        >
                            {{ difference > 0 ? '+' : ''
                            }}{{ formatCurrency(difference) }}
                        </span>
                    </div>
                    <div v-if="!isBalanced" class="flex justify-end px-3 pb-2">
                        <span
                            class="bg-red-100 px-2 py-1 text-[10px] font-black text-red-700"
                        >
                            {{ isSurplus ? 'SOBRANTE' : 'FALTANTE' }}
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    </div>
</template>
