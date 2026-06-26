<script setup lang="ts">
import type { DailyFinancialRow } from '@/types/report';

defineProps<{
    rows: DailyFinancialRow[];
    totals: Record<string, number>;
    currencyFormatter: (value: number) => string;
}>();

const columns: Array<{
    key: string;
    label: string;
}> = [
    { key: 'cash', label: 'Cash cierre' },
    { key: 'inventory', label: 'Inv cierre' },
    { key: 'purchase', label: 'Purchase' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'sales', label: 'Sales' },
    { key: 'cogs', label: 'COGS' },
    { key: 'profit', label: 'Net Profit' },
    { key: 'credit_payable', label: 'C x P' },
    { key: 'credit_receivable', label: 'C x C' },
    { key: 'cogs_credit', label: 'COGS Cr' },
    { key: 'investment', label: 'Invest' },
];

const formatShortDate = (date: string): string => {
    const d = new Date(`${date}T00:00:00`);
    return new Intl.DateTimeFormat('es-PA', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
    }).format(d);
};
</script>

<template>
    <div
        class="overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
        style="max-height: 520px"
    >
        <table class="min-w-full text-xs tabular-nums dark:divide-slate-800">
            <thead class="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                <tr>
                    <th
                        class="px-2 py-1.5 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                    >
                        Fecha
                    </th>
                    <th
                        v-for="col in columns"
                        :key="col.key"
                        class="px-2 py-1.5 text-right font-semibold text-slate-500 uppercase dark:text-slate-400"
                    >
                        {{ col.label }}
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr
                    v-for="row in rows"
                    :key="row.date"
                    class="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                >
                    <td
                        class="px-2 py-1 font-medium whitespace-nowrap text-slate-700 dark:text-slate-300"
                    >
                        {{ formatShortDate(row.date) }}
                    </td>
                    <td
                        v-for="col in columns"
                        :key="col.key"
                        class="px-2 py-1 text-right text-slate-600 dark:text-slate-400"
                        :class="{
                            'text-emerald-600 dark:text-emerald-400':
                                col.key === 'profit' && row[col.key] > 0,
                            'text-rose-600 dark:text-rose-400':
                                col.key === 'profit' && row[col.key] < 0,
                        }"
                    >
                        {{
                            currencyFormatter(
                                row[
                                    col.key as keyof DailyFinancialRow
                                ] as number,
                            )
                        }}
                    </td>
                </tr>
            </tbody>
            <tfoot class="bg-slate-50 font-bold dark:bg-slate-900">
                <tr>
                    <td class="px-2 py-1.5 text-slate-900 dark:text-slate-100">
                        TOTAL
                    </td>
                    <td
                        v-for="col in columns"
                        :key="col.key"
                        class="px-2 py-1.5 text-right text-slate-900 dark:text-slate-100"
                    >
                        {{ currencyFormatter(totals[col.key] ?? 0) }}
                    </td>
                </tr>
            </tfoot>
        </table>
    </div>
</template>
