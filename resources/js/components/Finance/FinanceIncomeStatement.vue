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
                        {{ currencyFormatter(-cogs) }}
                    </td>
                </tr>
                <tr>
                    <td
                        class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                        Gross Profit
                    </td>
                    <td
                        class="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100"
                    >
                        {{ currencyFormatter(grossProfit) }}
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
                    <td
                        class="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-400"
                    >
                        {{ currencyFormatter(-expenseTotal) }}
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
                        <td
                            class="px-3 py-1.5 text-right text-slate-500 tabular-nums dark:text-slate-400"
                        >
                            {{ currencyFormatter(item.amount) }}
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
