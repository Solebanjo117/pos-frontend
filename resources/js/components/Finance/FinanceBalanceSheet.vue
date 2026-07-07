<script setup lang="ts">
import type { BalanceSheetReport } from '@/types/report';

const props = defineProps<{
    data: BalanceSheetReport | null;
    currencyFormatter: (value: number) => string;
}>();

const emit = defineEmits<{
    select: [payload: { metric: string; label: string; value: number }];
}>();

const amount = (value: number | null | undefined): number => Number(value ?? 0);

const selectMetric = (metric: string, label: string, value: number): void => {
    emit('select', { metric, label, value });
};
</script>

<template>
    <div class="space-y-3">
        <div class="grid gap-3 lg:grid-cols-2">
            <div
                class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            >
                <h3
                    class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                    Activos
                </h3>
                <div class="space-y-1 text-xs">
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Cash</span
                        >
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-slate-900 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'cash',
                                    'Cash',
                                    amount(props.data?.assets.cash),
                                )
                            "
                        >
                            {{ currencyFormatter(props.data?.assets.cash ?? 0) }}
                        </button>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Banco</span
                        >
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-slate-900 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'bank',
                                    'Banco',
                                    amount(props.data?.assets.bank),
                                )
                            "
                        >
                            {{ currencyFormatter(props.data?.assets.bank ?? 0) }}
                        </button>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Cash inicial</span
                        >
                        <span
                            class="text-slate-500 tabular-nums dark:text-slate-500"
                            >{{
                                currencyFormatter(
                                    props.data?.assets.cash_initial ?? 0,
                                )
                            }}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Banco inicial</span
                        >
                        <span
                            class="text-slate-500 tabular-nums dark:text-slate-500"
                            >{{
                                currencyFormatter(
                                    props.data?.assets.bank_initial ?? 0,
                                )
                            }}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Inventory</span
                        >
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-slate-900 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'inventory',
                                    'Inventario',
                                    amount(props.data?.assets.inventory),
                                )
                            "
                        >
                            {{ currencyFormatter(props.data?.assets.inventory ?? 0) }}
                        </button>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Inv inicial</span
                        >
                        <span
                            class="text-slate-500 tabular-nums dark:text-slate-500"
                            >{{
                                currencyFormatter(
                                    props.data?.assets.inventory_initial ?? 0,
                                )
                            }}</span
                        >
                    </div>
                    <div
                        class="mt-1 flex justify-between border-t border-slate-200 pt-1 dark:border-slate-800"
                    >
                        <span
                            class="font-bold text-slate-900 dark:text-slate-100"
                            >Total Activos</span
                        >
                        <button
                            type="button"
                            class="rounded px-1 text-right font-bold text-slate-900 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'assets',
                                    'Activos',
                                    amount(props.data?.totals.total_assets),
                                )
                            "
                        >
                            {{
                                currencyFormatter(
                                    props.data?.totals.total_assets ?? 0,
                                )
                            }}
                        </button>
                    </div>
                </div>
            </div>

            <div
                class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            >
                <h3
                    class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                    Pasivos y Creditos
                </h3>
                <div class="space-y-1 text-xs">
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Credito por pagar</span
                        >
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-amber-600 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-amber-400 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'payable',
                                    'Credito por pagar',
                                    amount(
                                        props.data?.liabilities
                                            .accounts_payable,
                                    ),
                                )
                            "
                        >
                            {{
                                currencyFormatter(
                                    props.data?.liabilities.accounts_payable ?? 0,
                                )
                            }}
                        </button>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Credito por cobrar</span
                        >
                        <button
                            type="button"
                            class="rounded px-1 text-right font-semibold text-indigo-600 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-indigo-400 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'receivable',
                                    'Credito por cobrar',
                                    amount(
                                        props.data?.liabilities
                                            .accounts_receivable,
                                    ),
                                )
                            "
                        >
                            {{
                                currencyFormatter(
                                    props.data?.liabilities.accounts_receivable ?? 0,
                                )
                            }}
                        </button>
                    </div>
                    <div
                        class="mt-1 flex justify-between border-t border-slate-200 pt-1 dark:border-slate-800"
                    >
                        <span
                            class="font-bold text-slate-900 dark:text-slate-100"
                            >Total Pasivos</span
                        >
                        <button
                            type="button"
                            class="rounded px-1 text-right font-bold text-slate-900 tabular-nums transition hover:bg-slate-100 focus:ring-1 focus:ring-slate-300 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800"
                            @click="
                                selectMetric(
                                    'liabilities',
                                    'Pasivos',
                                    amount(
                                        props.data?.totals.total_liabilities,
                                    ),
                                )
                            "
                        >
                            {{
                                currencyFormatter(
                                    props.data?.totals.total_liabilities ?? 0,
                                )
                            }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <button
            type="button"
            class="w-full rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-200 focus:outline-none dark:border-indigo-800 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
            @click="
                selectMetric(
                    'equity',
                    'Balance Neto',
                    amount(props.data?.totals.balance),
                )
            "
        >
            <div class="flex items-center justify-between">
                <span
                    class="text-sm font-bold text-indigo-900 dark:text-indigo-100"
                    >Balance Neto</span
                >
                <span
                    class="text-lg font-bold text-indigo-700 tabular-nums dark:text-indigo-300"
                    >{{ currencyFormatter(props.data?.totals.balance ?? 0) }}</span
                >
            </div>
        </button>
    </div>
</template>
