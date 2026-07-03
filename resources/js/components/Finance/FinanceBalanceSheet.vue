<script setup lang="ts">
import type { BalanceSheetReport } from '@/types/report';

defineProps<{
    data: BalanceSheetReport | null;
    currencyFormatter: (value: number) => string;
}>();
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
                        <span
                            class="font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                            >{{
                                currencyFormatter(data?.assets.cash ?? 0)
                            }}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Banco</span
                        >
                        <span
                            class="font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                            >{{
                                currencyFormatter(data?.assets.bank ?? 0)
                            }}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Cash inicial</span
                        >
                        <span
                            class="text-slate-500 tabular-nums dark:text-slate-500"
                            >{{
                                currencyFormatter(
                                    data?.assets.cash_initial ?? 0,
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
                                    data?.assets.bank_initial ?? 0,
                                )
                            }}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Inventory</span
                        >
                        <span
                            class="font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                            >{{
                                currencyFormatter(data?.assets.inventory ?? 0)
                            }}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Inv inicial</span
                        >
                        <span
                            class="text-slate-500 tabular-nums dark:text-slate-500"
                            >{{
                                currencyFormatter(
                                    data?.assets.inventory_initial ?? 0,
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
                        <span
                            class="font-bold text-slate-900 tabular-nums dark:text-slate-100"
                            >{{
                                currencyFormatter(
                                    data?.totals.total_assets ?? 0,
                                )
                            }}</span
                        >
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
                        <span
                            class="font-semibold text-amber-600 tabular-nums dark:text-amber-400"
                            >{{
                                currencyFormatter(
                                    data?.liabilities.accounts_payable ?? 0,
                                )
                            }}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400"
                            >Credito por cobrar</span
                        >
                        <span
                            class="font-semibold text-indigo-600 tabular-nums dark:text-indigo-400"
                            >{{
                                currencyFormatter(
                                    data?.liabilities.accounts_receivable ?? 0,
                                )
                            }}</span
                        >
                    </div>
                    <div
                        class="mt-1 flex justify-between border-t border-slate-200 pt-1 dark:border-slate-800"
                    >
                        <span
                            class="font-bold text-slate-900 dark:text-slate-100"
                            >Total Pasivos</span
                        >
                        <span
                            class="font-bold text-slate-900 tabular-nums dark:text-slate-100"
                            >{{
                                currencyFormatter(
                                    data?.totals.total_liabilities ?? 0,
                                )
                            }}</span
                        >
                    </div>
                </div>
            </div>
        </div>

        <div
            class="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30"
        >
            <div class="flex items-center justify-between">
                <span
                    class="text-sm font-bold text-indigo-900 dark:text-indigo-100"
                    >Balance Neto</span
                >
                <span
                    class="text-lg font-bold text-indigo-700 tabular-nums dark:text-indigo-300"
                    >{{ currencyFormatter(data?.totals.balance ?? 0) }}</span
                >
            </div>
        </div>
    </div>
</template>
