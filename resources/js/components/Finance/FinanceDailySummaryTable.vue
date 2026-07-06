<script setup lang="ts">
import type { DailyFinancialRow } from '@/types/report';
import { formatReportDate } from '@/utils/formatters';

defineProps<{
    rows: DailyFinancialRow[];
    totals: Record<string, number>;
    currencyFormatter: (value: number) => string;
}>();

const emit = defineEmits<{
    select: [
        payload: {
            date: string;
            key: string;
            label: string;
            metric: string;
            value: number;
        },
    ];
}>();

const columns: Array<{
    key: string;
    label: string;
    metric: string;
}> = [
    { key: 'sales_total', label: 'Ventas', metric: 'sales' },
    { key: 'sales_collected', label: 'Cobrado', metric: 'payments_received' },
    { key: 'sales_pending', label: 'CxC', metric: 'receivable' },
    { key: 'cogs', label: 'COGS', metric: 'cogs' },
    { key: 'inventory', label: 'Inventario', metric: 'inventory' },
    { key: 'purchase', label: 'Compras', metric: 'purchases' },
    { key: 'purchase_paid', label: 'Pagado', metric: 'supplier_payments' },
    { key: 'purchase_pending', label: 'CxP', metric: 'payable' },
    { key: 'expenses', label: 'Gastos', metric: 'expenses' },
    { key: 'net_profit', label: 'Profit', metric: 'profit' },
];

const rowValue = (row: DailyFinancialRow, key: string): number =>
    Number(row[key as keyof DailyFinancialRow] ?? 0);

const selectCell = (
    row: DailyFinancialRow,
    column: (typeof columns)[number],
): void => {
    emit('select', {
        date: row.date,
        key: column.key,
        label: column.label,
        metric: column.metric,
        value: rowValue(row, column.key),
    });
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
                        {{ formatReportDate(row.date) }}
                    </td>
                    <td
                        v-for="col in columns"
                        :key="col.key"
                        class="px-2 py-1 text-right text-slate-600 dark:text-slate-400"
                        :class="{
                            'text-emerald-600 dark:text-emerald-400':
                                col.key === 'net_profit' &&
                                rowValue(row, col.key) > 0,
                            'text-rose-600 dark:text-rose-400':
                                col.key === 'net_profit' &&
                                rowValue(row, col.key) < 0,
                        }"
                    >
                        <button
                            type="button"
                            class="w-full rounded px-1 py-0.5 text-right transition hover:bg-slate-100 hover:text-slate-950 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-50"
                            :title="`Ver detalle de ${col.label} ${formatReportDate(row.date)}`"
                            @click="selectCell(row, col)"
                        >
                            {{ currencyFormatter(rowValue(row, col.key)) }}
                        </button>
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
