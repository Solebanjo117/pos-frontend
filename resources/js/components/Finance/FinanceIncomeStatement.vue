<script setup lang="ts">
import type { ExpenseBreakdown } from '@/types/report';

defineProps<{
    sales: number;
    cogs: number;
    netIncome: number;
    netProfit: number;
    expenseBreakdown: ExpenseBreakdown | null;
    currencyFormatter: (value: number) => string;
}>();
</script>

<template>
    <div
        class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
        <table class="min-w-full text-xs tabular-nums">
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                    <td
                        class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                        Sales
                    </td>
                    <td
                        class="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                        {{ currencyFormatter(sales) }}
                    </td>
                </tr>
                <tr>
                    <td
                        class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                        COGS
                    </td>
                    <td
                        class="px-3 py-2 text-right font-semibold text-rose-600 dark:text-rose-400"
                    >
                        -{{ currencyFormatter(cogs) }}
                    </td>
                </tr>
                <tr class="bg-slate-50 dark:bg-slate-900">
                    <td
                        class="px-3 py-2 font-bold text-slate-900 dark:text-slate-100"
                    >
                        Net Income
                    </td>
                    <td
                        class="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100"
                    >
                        {{ currencyFormatter(netIncome) }}
                    </td>
                </tr>
                <tr>
                    <td
                        class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                        Net Expenses
                    </td>
                    <td
                        class="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-400"
                    >
                        -{{ currencyFormatter(expenseBreakdown?.total ?? 0) }}
                    </td>
                </tr>
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
                    <td
                        class="px-3 py-1.5 text-right text-slate-500 tabular-nums dark:text-slate-400"
                    >
                        {{ currencyFormatter(item.amount) }}
                    </td>
                </tr>
                <tr
                    v-if="expenseBreakdown?.other"
                    class="bg-slate-50/50 dark:bg-slate-900/40"
                >
                    <td
                        class="px-3 py-1.5 pl-6 text-slate-500 dark:text-slate-400"
                    >
                        {{ expenseBreakdown.other.label }}
                    </td>
                    <td
                        class="px-3 py-1.5 text-right text-slate-500 tabular-nums dark:text-slate-400"
                    >
                        {{ currencyFormatter(expenseBreakdown.other.amount) }}
                    </td>
                </tr>
                <tr class="bg-indigo-50 dark:bg-indigo-950/30">
                    <td
                        class="px-3 py-2 font-bold text-indigo-900 dark:text-indigo-100"
                    >
                        Net Profit
                    </td>
                    <td
                        class="px-3 py-2 text-right font-bold text-indigo-700 tabular-nums dark:text-indigo-300"
                    >
                        {{ currencyFormatter(netProfit) }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
