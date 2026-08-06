<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type {
    IncomeStatementReconciliation,
    StatementRow,
    StatementSection,
} from '@/types/report';

const props = defineProps<{
    reconciliation: IncomeStatementReconciliation | null;
    sections?: StatementSection[];
    currencyFormatter: (value: number) => string;
}>();

const emit = defineEmits<{
    select: [
        payload: {
            metric: string;
            label: string;
            value: number;
            expense_category?: string;
        },
    ];
}>();

const salesOpen = ref(true);
const costOpen = ref(true);
const expensesOpen = ref(true);

const finite = (value: unknown): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const emptyReconciliation: IncomeStatementReconciliation = {
    gross_sales_ex_tax: 0,
    discounts: 0,
    returns_ex_tax: 0,
    net_sales_ex_tax: 0,
    tax_collected: 0,
    gross_cogs: 0,
    return_cogs: 0,
    net_cogs: 0,
    gross_profit: 0,
    operational_expenses: 0,
    net_income: 0,
};

const totals = computed<IncomeStatementReconciliation>(() => {
    const source = props.reconciliation ?? emptyReconciliation;

    return Object.fromEntries(
        Object.entries(source).map(([key, value]) => [key, finite(value)]),
    ) as unknown as IncomeStatementReconciliation;
});

const sectionByKey = (key: string): StatementSection | undefined =>
    props.sections?.find((section) => section.key === key);

const salesRows = computed(() =>
    (sectionByKey('income')?.rows ?? []).filter(
        (row) => row.key !== 'net-sales',
    ),
);
const costRows = computed(() =>
    (sectionByKey('cost-of-goods-sold')?.rows ?? []).filter(
        (row) => row.key !== 'net-cogs',
    ),
);
const expenseRows = computed(
    () => sectionByKey('operational-expenses')?.rows ?? [],
);

const netIncomeClass = computed(() => {
    if (totals.value.net_income < 0) {
        return 'text-rose-600 dark:text-rose-400';
    }
    if (totals.value.net_income > 0) {
        return 'text-emerald-600 dark:text-emerald-400';
    }

    return 'text-slate-900 dark:text-slate-100';
});

const statementMetric = (row: StatementRow): string => {
    if (row.key === 'gross-sales') return 'sales_gross';
    if (row.key === 'discounts') return 'sales_discounts';
    if (row.key === 'approved-refunds') return 'sales_returns';
    if (row.key === 'tax-collected') return 'sales_tax';
    if (row.key === 'gross-cogs') return 'cogs_gross';
    if (row.key === 'return-cogs') return 'cogs_returns';
    return row.key.startsWith('operational-expense-')
        ? 'operational_expenses'
        : row.key;
};

const selectRow = (row: StatementRow): void => {
    emit('select', {
        metric: statementMetric(row),
        label: row.label,
        value: finite(row.amount),
        expense_category: row.key.startsWith('operational-expense-')
            ? row.key.replace('operational-expense-', '')
            : undefined,
    });
};

const selectTotal = (metric: string, label: string, value: number): void => {
    emit('select', { metric, label, value });
};
</script>

<template>
    <section
        class="overflow-hidden rounded-lg border border-slate-200 bg-white text-xs tabular-nums dark:border-slate-800 dark:bg-slate-950"
        aria-label="Income Statement"
    >
        <button
            type="button"
            class="flex w-full items-center justify-between gap-4 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:bg-slate-900 dark:hover:bg-slate-800"
            @click="selectTotal('profit', 'Net Income', totals.net_income)"
        >
            <span class="font-bold text-slate-900 dark:text-slate-100">
                Net Income
            </span>
            <span class="font-bold" :class="netIncomeClass">
                {{ currencyFormatter(totals.net_income) }}
            </span>
        </button>

        <div class="border-t border-slate-100 dark:border-slate-800">
            <button
                id="income-statement-sales-trigger"
                type="button"
                class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:hover:bg-slate-900"
                :aria-expanded="salesOpen"
                aria-controls="income-statement-sales-details"
                @click="salesOpen = !salesOpen"
            >
                <span
                    class="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300"
                >
                    <ChevronDown
                        :size="15"
                        class="transition-transform duration-150"
                        :class="{ '-rotate-90': !salesOpen }"
                    />
                    Sales
                </span>
                <span
                    class="font-semibold text-emerald-600 dark:text-emerald-400"
                >
                    {{ currencyFormatter(totals.net_sales_ex_tax) }}
                </span>
            </button>
            <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="-translate-y-1 opacity-0"
                leave-active-class="transition duration-100 ease-in"
                leave-to-class="-translate-y-1 opacity-0"
            >
                <div
                    v-if="salesOpen"
                    id="income-statement-sales-details"
                    role="region"
                    aria-labelledby="income-statement-sales-trigger"
                    class="border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
                >
                    <button
                        v-for="row in salesRows"
                        :key="row.key"
                        type="button"
                        class="flex w-full items-start justify-between gap-4 px-4 py-2 pl-10 text-left transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:hover:bg-slate-800"
                        @click="selectRow(row)"
                    >
                        <span
                            class="min-w-0 text-slate-500 dark:text-slate-400"
                        >
                            <span>{{ row.label }}</span>
                            <span
                                v-if="row.included_in_section_total === false"
                                class="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-600 uppercase dark:bg-slate-700 dark:text-slate-300"
                            >
                                Informativo
                            </span>
                            <span
                                v-if="row.detail"
                                class="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500"
                            >
                                {{ row.detail }}
                            </span>
                        </span>
                        <span
                            class="shrink-0 text-right"
                            :class="
                                row.amount < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-600 dark:text-slate-300'
                            "
                        >
                            {{ currencyFormatter(finite(row.amount)) }}
                        </span>
                    </button>
                    <p
                        v-if="!salesRows.length"
                        class="px-4 py-3 pl-10 text-slate-400"
                    >
                        Sin ventas en el periodo.
                    </p>
                </div>
            </Transition>
        </div>

        <div class="border-t border-slate-100 dark:border-slate-800">
            <button
                id="income-statement-cost-trigger"
                type="button"
                class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:hover:bg-slate-900"
                :aria-expanded="costOpen"
                aria-controls="income-statement-cost-details"
                @click="costOpen = !costOpen"
            >
                <span
                    class="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300"
                >
                    <ChevronDown
                        :size="15"
                        class="transition-transform duration-150"
                        :class="{ '-rotate-90': !costOpen }"
                    />
                    Cost
                </span>
                <span class="font-semibold text-slate-900 dark:text-slate-100">
                    {{ currencyFormatter(totals.net_cogs) }}
                </span>
            </button>
            <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="-translate-y-1 opacity-0"
                leave-active-class="transition duration-100 ease-in"
                leave-to-class="-translate-y-1 opacity-0"
            >
                <div
                    v-if="costOpen"
                    id="income-statement-cost-details"
                    role="region"
                    aria-labelledby="income-statement-cost-trigger"
                    class="border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
                >
                    <button
                        v-for="row in costRows"
                        :key="row.key"
                        type="button"
                        class="flex w-full items-center justify-between gap-4 px-4 py-2 pl-10 text-left transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:hover:bg-slate-800"
                        @click="selectRow(row)"
                    >
                        <span class="text-slate-500 dark:text-slate-400">
                            {{ row.label }}
                        </span>
                        <span
                            :class="
                                row.amount < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-600 dark:text-slate-300'
                            "
                        >
                            {{ currencyFormatter(finite(row.amount)) }}
                        </span>
                    </button>
                    <p
                        v-if="!costRows.length"
                        class="px-4 py-3 pl-10 text-slate-400"
                    >
                        Sin costos en el periodo.
                    </p>
                </div>
            </Transition>
        </div>

        <button
            type="button"
            class="flex w-full items-center justify-between gap-4 border-t border-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:border-slate-800 dark:hover:bg-slate-900"
            @click="
                selectTotal('gross_profit', 'Gross Profit', totals.gross_profit)
            "
        >
            <span class="text-slate-700 dark:text-slate-300">Gross Profit</span>
            <span
                :class="
                    totals.gross_profit < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-slate-100'
                "
            >
                {{ currencyFormatter(totals.gross_profit) }}
            </span>
        </button>

        <div class="border-t border-slate-100 dark:border-slate-800">
            <button
                id="income-statement-expenses-trigger"
                type="button"
                class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:hover:bg-slate-900"
                :aria-expanded="expensesOpen"
                aria-controls="income-statement-expenses-details"
                @click="expensesOpen = !expensesOpen"
            >
                <span
                    class="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300"
                >
                    <ChevronDown
                        :size="15"
                        class="transition-transform duration-150"
                        :class="{ '-rotate-90': !expensesOpen }"
                    />
                    Expenses
                </span>
                <span class="font-semibold text-amber-600 dark:text-amber-400">
                    {{ currencyFormatter(totals.operational_expenses) }}
                </span>
            </button>
            <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="-translate-y-1 opacity-0"
                leave-active-class="transition duration-100 ease-in"
                leave-to-class="-translate-y-1 opacity-0"
            >
                <div
                    v-if="expensesOpen"
                    id="income-statement-expenses-details"
                    role="region"
                    aria-labelledby="income-statement-expenses-trigger"
                    class="border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
                >
                    <button
                        v-for="row in expenseRows"
                        :key="row.key"
                        type="button"
                        class="flex w-full items-start justify-between gap-4 px-4 py-2 pl-10 text-left transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:hover:bg-slate-800"
                        @click="selectRow(row)"
                    >
                        <span
                            class="min-w-0 text-slate-500 dark:text-slate-400"
                        >
                            <span>{{ row.label }}</span>
                            <span
                                v-if="row.detail"
                                class="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500"
                            >
                                {{ row.detail }}
                            </span>
                        </span>
                        <span
                            class="shrink-0 text-slate-600 dark:text-slate-300"
                        >
                            {{ currencyFormatter(finite(row.amount)) }}
                        </span>
                    </button>
                    <p
                        v-if="!expenseRows.length"
                        class="px-4 py-3 pl-10 text-slate-400"
                    >
                        Sin gastos reconocidos en el periodo.
                    </p>
                </div>
            </Transition>
        </div>

        <button
            type="button"
            class="flex w-full items-center justify-between gap-4 border-t border-indigo-100 bg-indigo-50 px-4 py-3 text-left transition hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:ring-inset dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
            @click="selectTotal('profit', 'Net Income', totals.net_income)"
        >
            <span class="font-bold text-indigo-900 dark:text-indigo-100">
                Net Income
            </span>
            <span class="font-bold" :class="netIncomeClass">
                {{ currencyFormatter(totals.net_income) }}
            </span>
        </button>
    </section>
</template>
