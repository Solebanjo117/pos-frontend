<script setup lang="ts">
import type { BalanceSheetReport } from '@/types/report';

defineProps<{
    data: BalanceSheetReport | null;
    currencyFormatter: (value: number) => string;
}>();

const emit = defineEmits<{
    select: [payload: { metric: string; label: string; value: number }];
}>();

const amount = (value: number | null | undefined): number => Number(value ?? 0);
const selectMetric = (metric: string, label: string, value: number): void =>
    emit('select', { metric, label, value });

const rowClass =
    'rounded px-1 text-right font-semibold tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:hover:bg-slate-800';
</script>

<template>
    <div class="space-y-3">
        <div class="grid gap-3 lg:grid-cols-3">
            <section class="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <h3 class="mb-2 text-xs font-bold text-slate-500 uppercase">Activos</h3>
                <div class="space-y-1 text-xs">
                    <div v-for="item in [
                        { metric: 'cash', label: 'Cash', value: data?.assets.cash },
                        { metric: 'bank', label: 'Banco', value: data?.assets.bank },
                        { metric: 'receivable', label: 'CxC', value: data?.assets.accounts_receivable },
                        { metric: 'inventory_bridge', label: 'Inventario', value: data?.assets.inventory },
                    ]" :key="item.metric" class="flex justify-between gap-3">
                        <span class="text-slate-600 dark:text-slate-400">{{ item.label }}</span>
                        <button type="button" :class="rowClass" @click="selectMetric(item.metric, item.label, amount(item.value))">
                            {{ currencyFormatter(amount(item.value)) }}
                        </button>
                    </div>
                    <div class="mt-2 flex justify-between border-t pt-1 font-bold dark:border-slate-800">
                        <span>Total Activos</span>
                        <button type="button" :class="rowClass" @click="selectMetric('assets', 'Activos', amount(data?.totals.total_assets))">
                            {{ currencyFormatter(data?.totals.total_assets ?? 0) }}
                        </button>
                    </div>
                </div>
            </section>

            <section class="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <h3 class="mb-2 text-xs font-bold text-slate-500 uppercase">Pasivos</h3>
                <div class="space-y-1 text-xs">
                    <div v-for="item in [
                        { metric: 'payable', label: 'CxP', value: data?.liabilities.accounts_payable },
                        { metric: 'customer_credits', label: 'Saldos a favor', value: data?.liabilities.customer_credits },
                        { metric: 'pending_refunds', label: 'Reembolsos pendientes', value: data?.liabilities.pending_refunds },
                    ]" :key="item.metric" class="flex justify-between gap-3">
                        <span class="text-slate-600 dark:text-slate-400">{{ item.label }}</span>
                        <button type="button" :class="rowClass" @click="selectMetric(item.metric, item.label, amount(item.value))">
                            {{ currencyFormatter(amount(item.value)) }}
                        </button>
                    </div>
                    <div class="mt-2 flex justify-between border-t pt-1 font-bold dark:border-slate-800">
                        <span>Total Pasivos</span>
                        <button type="button" :class="rowClass" @click="selectMetric('liabilities', 'Pasivos', amount(data?.totals.total_liabilities))">
                            {{ currencyFormatter(data?.totals.total_liabilities ?? 0) }}
                        </button>
                    </div>
                </div>
            </section>

            <section class="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <h3 class="mb-2 text-xs font-bold text-slate-500 uppercase">Patrimonio</h3>
                <div class="space-y-1 text-xs">
                    <div v-for="item in [
                        { metric: 'investment', label: 'Capital aportado', value: data?.equity.contributed_capital },
                        { metric: 'profit', label: 'Utilidad del periodo', value: data?.equity.period_profit },
                        { metric: 'retained_earnings', label: 'Resultados acumulados', value: data?.equity.retained_earnings },
                    ]" :key="item.metric" class="flex justify-between gap-3">
                        <span class="text-slate-600 dark:text-slate-400">{{ item.label }}</span>
                        <button type="button" :class="rowClass" @click="selectMetric(item.metric, item.label, amount(item.value))">
                            {{ currencyFormatter(amount(item.value)) }}
                        </button>
                    </div>
                    <div class="mt-2 flex justify-between border-t pt-1 font-bold dark:border-slate-800">
                        <span>Total Patrimonio</span>
                        <button type="button" :class="rowClass" @click="selectMetric('equity', 'Patrimonio', amount(data?.totals.total_equity))">
                            {{ currencyFormatter(data?.totals.total_equity ?? 0) }}
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <div class="flex flex-col gap-2 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-xs dark:border-indigo-800 dark:bg-indigo-950/30 sm:flex-row sm:items-center sm:justify-between">
            <span class="font-bold text-indigo-900 dark:text-indigo-100">Activos = Pasivos + Patrimonio</span>
            <div class="flex flex-wrap items-center gap-4 tabular-nums">
                <span>{{ currencyFormatter(data?.totals.total_assets ?? 0) }}</span>
                <span>=</span>
                <span>{{ currencyFormatter(data?.totals.liabilities_and_equity ?? 0) }}</span>
                <span :class="amount(data?.totals.reconciliation_difference) === 0 ? 'text-emerald-700' : 'text-red-600'">
                    Diferencia {{ currencyFormatter(data?.totals.reconciliation_difference ?? 0) }}
                </span>
            </div>
        </div>
    </div>
</template>
