<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type {
    ExpenseBreakdown,
    StatementRow,
    StatementSection,
} from '@/types/report';

const props = defineProps<{
    sales: number;
    cogs: number;
    netIncome: number;
    netProfit: number;
    expenseBreakdown: ExpenseBreakdown | null;
    sections?: StatementSection[];
    currencyFormatter: (value: number) => string;
}>();

const expensesOpen = ref(true);
const salesOpen = ref(true);
const costOpen = ref(true);
const sectionByKey = (key: string): StatementSection | undefined =>
    props.sections?.find((section) => section.key === key);
const salesSection = computed(() => sectionByKey('income'));
const costSection = computed(() => sectionByKey('cost-of-goods-sold'));
const grossSection = computed(() => sectionByKey('gross-profit'));
const salesTotal = computed(() => salesSection.value?.amount ?? props.sales);
const costTotal = computed(() => costSection.value?.amount ?? props.cogs);
const grossProfit = computed(
    () => grossSection.value?.amount ?? salesTotal.value - costTotal.value,
);
const expenseTotal = computed(() => props.expenseBreakdown?.total ?? 0);

const emit = defineEmits<{
    select: [
        payload: {
            metric: string;
            label: string;
            value: number;
            expense_category?: string;
            expense_group?: string;
        },
    ];
}>();

const selectMetric = (
    metric: string,
    label: string,
    value: number,
    extra: { expense_category?: string; expense_group?: string } = {},
): void => {
    emit('select', { metric, label, value, ...extra });
};

const statementMetric = (row: StatementRow): string => {
    if (row.key === 'gross-sales') return 'sales_gross';
    if (row.key === 'discounts') return 'sales_discounts';
    if (row.key === 'approved-refunds') return 'sales_returns';
    if (row.key === 'net-sales') return 'sales_net';
    if (row.key === 'gross-cogs') return 'cogs_gross';
    if (row.key === 'return-cogs') return 'cogs_returns';
    if (row.key === 'net-cogs') return 'cogs_net';
    return row.key.startsWith('operational-expense-')
        ? 'operational_expenses'
        : 'sales_net';
};
</script>

<template>
    <div
        class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
        <table class="min-w-full text-xs tabular-nums">
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr class="bg-slate-50 dark:bg-slate-900">
                    <td
                        class="px-3 py-2 font-bold text-slate-900 dark:text-slate-100"
                    >
                        Net Income
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-bold text-slate-900 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800"
                            @click="
                                selectMetric('profit', 'Net Income', netIncome)
                            "
                        >
                            {{ currencyFormatter(netIncome) }}
                        </button>
                    </td>
                </tr>
                <tr>
                    <td class="px-3 py-2">
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300"
                            @click="salesOpen = !salesOpen"
                        >
                            <ChevronDown
                                :size="14"
                                class="transition-transform"
                                :class="{ '-rotate-90': !salesOpen }"
                            />
                            Sales
                        </button>
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-emerald-600 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-emerald-400 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'sales_net',
                                    'Ventas netas',
                                    salesTotal,
                                )
                            "
                        >
                            {{ currencyFormatter(salesTotal) }}
                        </button>
                    </td>
                </tr>
                <template v-if="salesOpen">
                    <tr
                        v-for="row in salesSection?.rows ?? []"
                        :key="row.key"
                        class="bg-slate-50/50 dark:bg-slate-900/40"
                    >
                        <td
                            class="px-3 py-1.5 pl-6 text-slate-500 dark:text-slate-400"
                        >
                            {{ row.label }}
                        </td>
                        <td class="px-3 py-1.5 text-right">
                            <button
                                type="button"
                                class="rounded px-1 text-right text-slate-500 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800"
                                @click="
                                    selectMetric(
                                        statementMetric(row),
                                        row.label,
                                        row.amount,
                                    )
                                "
                            >
                                {{ currencyFormatter(row.amount) }}
                            </button>
                        </td>
                    </tr>
                </template>
                <tr>
                    <td class="px-3 py-2">
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300"
                            @click="costOpen = !costOpen"
                        >
                            <ChevronDown
                                :size="14"
                                class="transition-transform"
                                :class="{ '-rotate-90': !costOpen }"
                            />
                            Costo
                        </button>
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-rose-600 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-rose-400 dark:hover:bg-slate-800"
                            @click="
                                selectMetric('cogs_net', 'Costo neto', costTotal)
                            "
                        >
                            {{ currencyFormatter(-costTotal) }}
                        </button>
                    </td>
                </tr>
                <template v-if="costOpen">
                    <tr
                        v-for="row in costSection?.rows ?? []"
                        :key="row.key"
                        class="bg-slate-50/50 dark:bg-slate-900/40"
                    >
                        <td
                            class="px-3 py-1.5 pl-6 text-slate-500 dark:text-slate-400"
                        >
                            {{ row.label }}
                        </td>
                        <td class="px-3 py-1.5 text-right">
                            <button
                                type="button"
                                class="rounded px-1 text-right text-slate-500 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800"
                                @click="
                                    selectMetric(
                                        statementMetric(row),
                                        row.label,
                                        row.amount,
                                    )
                                "
                            >
                                {{ currencyFormatter(row.amount) }}
                            </button>
                        </td>
                    </tr>
                </template>
                <tr>
                    <td
                        class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                        Gross Profit
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-slate-900 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'gross_profit',
                                    'Gross Profit',
                                    grossProfit,
                                )
                            "
                        >
                            {{ currencyFormatter(grossProfit) }}
                        </button>
                    </td>
                </tr>
                <tr>
                    <td class="px-3 py-2">
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300"
                            @click="expensesOpen = !expensesOpen"
                        >
                            <ChevronDown
                                :size="14"
                                class="transition-transform"
                                :class="{ '-rotate-90': !expensesOpen }"
                            />
                            Expenses
                        </button>
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-amber-600 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-amber-400 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'operational_expenses',
                                    'Expenses',
                                    expenseTotal,
                                )
                            "
                        >
                            {{ currencyFormatter(-expenseTotal) }}
                        </button>
                    </td>
                </tr>
                <template v-if="expensesOpen">
                    <tr
                        v-for="item in expenseBreakdown?.items ?? []"
                        :key="item.label"
                        class="bg-slate-50/50 dark:bg-slate-900/40"
                    >
                        <td
                            class="px-3 py-1.5 pl-6 text-slate-500 dark:text-slate-400"
                        >
                            {{ item.label }}
                        </td>
                        <td class="px-3 py-1.5 text-right">
                            <button
                                type="button"
                                class="rounded px-1 text-right text-slate-500 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800"
                                @click="
                                    selectMetric(
                                        'operational_expenses',
                                        item.label,
                                        item.amount,
                                        {
                                            expense_category:
                                                item.expense_category,
                                            expense_group: item.expense_group,
                                        },
                                    )
                                "
                            >
                                {{ currencyFormatter(item.amount) }}
                            </button>
                        </td>
                    </tr>
                </template>
                <tr
                    v-if="expensesOpen && expenseBreakdown?.other"
                    class="bg-slate-50/50 dark:bg-slate-900/40"
                >
                    <td
                        class="px-3 py-1.5 pl-6 text-slate-500 dark:text-slate-400"
                    >
                        {{ expenseBreakdown.other.label }}
                    </td>
                    <td class="px-3 py-1.5 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right text-slate-500 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'operational_expenses',
                                    expenseBreakdown.other.label,
                                    expenseBreakdown.other.amount,
                                    {
                                        expense_category:
                                            expenseBreakdown.other
                                                .expense_category,
                                        expense_group:
                                            expenseBreakdown.other
                                                .expense_group,
                                    },
                                )
                            "
                        >
                            {{ currencyFormatter(expenseBreakdown.other.amount) }}
                        </button>
                    </td>
                </tr>
                <tr class="bg-indigo-50 dark:bg-indigo-950/30">
                    <td
                        class="px-3 py-2 font-bold text-indigo-900 dark:text-indigo-100"
                    >
                        Net Profit
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-bold text-indigo-700 tabular-nums transition hover:bg-indigo-100 focus:ring-1 focus:ring-indigo-300 focus:outline-none dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                            @click="
                                selectMetric(
                                    'net_profit',
                                    'Net Profit',
                                    netProfit,
                                )
                            "
                        >
                            {{ currencyFormatter(netProfit) }}
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
