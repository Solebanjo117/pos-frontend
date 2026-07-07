<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { ExpenseBreakdown } from '@/types/report';

const props = defineProps<{
    sales: number;
    cogs: number;
    netIncome: number;
    netProfit: number;
    expenseBreakdown: ExpenseBreakdown | null;
    currencyFormatter: (value: number) => string;
}>();

const expensesOpen = ref(true);
const grossProfit = computed(() => props.sales - props.cogs);
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
                    <td
                        class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                        Sales
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-emerald-600 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-emerald-400 dark:hover:bg-slate-800"
                            @click="selectMetric('sales', 'Sales', sales)"
                        >
                            {{ currencyFormatter(sales) }}
                        </button>
                    </td>
                </tr>
                <tr>
                    <td
                        class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                        COGS
                    </td>
                    <td class="px-3 py-2 text-right">
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-rose-600 transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-rose-400 dark:hover:bg-slate-800"
                            @click="selectMetric('cogs', 'COGS', cogs)"
                        >
                            {{ currencyFormatter(-cogs) }}
                        </button>
                    </td>
                </tr>
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
