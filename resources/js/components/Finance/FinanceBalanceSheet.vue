<script setup lang="ts">
import {
    AlertTriangle,
    CheckCircle2,
    Landmark,
    ShieldAlert,
} from 'lucide-vue-next';
import { computed } from 'vue';
import type { BalanceSheetReport } from '@/types/report';

const props = defineProps<{
    data: BalanceSheetReport | null;
    currencyFormatter: (value: number) => string;
}>();

const emit = defineEmits<{
    select: [payload: { metric: string; label: string; value: number }];
}>();

const amount = (value: number | null | undefined): number => Number(value ?? 0);
const selectMetric = (metric: string, label: string, value: number): void =>
    emit('select', { metric: `balance_${metric}`, label, value });

const status = computed(() => {
    if (props.data?.status === 'ready') {
        return {
            label: 'Conciliado',
            description: 'Libro mayor y controles disponibles conciliados.',
            icon: CheckCircle2,
            class: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
        };
    }
    if (props.data?.status === 'unbalanced') {
        return {
            label: 'No balanceado',
            description: 'La ecuación contable presenta una diferencia real.',
            icon: ShieldAlert,
            class: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
        };
    }

    return {
        label: 'Requiere conciliación',
        description: 'Hay fuentes o saldos de control pendientes de verificar.',
        icon: AlertTriangle,
        class: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    };
});

const rowClass =
    'min-w-24 rounded px-1.5 py-0.5 text-right font-semibold tabular-nums transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:hover:bg-slate-800';
</script>

<template>
    <div class="space-y-3">
        <div
            class="flex flex-col gap-2 rounded-lg border p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
            :class="status.class"
            role="status"
        >
            <div class="flex items-center gap-2">
                <component :is="status.icon" :size="17" aria-hidden="true" />
                <div>
                    <p class="font-bold">{{ status.label }}</p>
                    <p class="opacity-80">{{ status.description }}</p>
                </div>
            </div>
            <div class="flex items-center gap-2 font-semibold">
                <Landmark :size="16" aria-hidden="true" />
                Consolidado · Balance al {{ data?.as_of ?? '—' }}
            </div>
        </div>

        <div class="grid gap-3 lg:grid-cols-3">
            <section
                class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            >
                <h3 class="mb-2 text-xs font-bold text-slate-500 uppercase">
                    Activos
                </h3>
                <div class="space-y-1.5 text-xs">
                    <div
                        v-for="item in [
                            {
                                metric: 'cash',
                                label: 'Efectivo',
                                value: data?.assets.cash,
                            },
                            {
                                metric: 'bank',
                                label: 'Banco',
                                value: data?.assets.bank,
                            },
                            {
                                metric: 'receivable',
                                label: 'CxC',
                                value: data?.assets.accounts_receivable,
                            },
                            {
                                metric: 'inventory',
                                label: 'Inventario',
                                value: data?.assets.inventory,
                            },
                            {
                                metric: 'assets',
                                label: 'Otros activos',
                                value: data?.assets.other_assets,
                            },
                        ].filter(
                            (item) =>
                                item.label !== 'Otros activos' ||
                                amount(item.value) !== 0,
                        )"
                        :key="`${item.metric}-${item.label}`"
                        class="flex items-center justify-between gap-3"
                    >
                        <span class="text-slate-600 dark:text-slate-400">{{
                            item.label
                        }}</span>
                        <button
                            type="button"
                            :class="rowClass"
                            @click="
                                selectMetric(
                                    item.metric,
                                    item.label,
                                    amount(item.value),
                                )
                            "
                        >
                            {{ currencyFormatter(amount(item.value)) }}
                        </button>
                    </div>
                    <div
                        class="mt-2 flex justify-between border-t pt-2 font-bold dark:border-slate-800"
                    >
                        <span>Total Activos</span>
                        <button
                            type="button"
                            :class="rowClass"
                            @click="
                                selectMetric(
                                    'assets',
                                    'Activos',
                                    amount(data?.totals.total_assets),
                                )
                            "
                        >
                            {{
                                currencyFormatter(
                                    data?.totals.total_assets ?? 0,
                                )
                            }}
                        </button>
                    </div>
                </div>
            </section>

            <section
                class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            >
                <h3 class="mb-2 text-xs font-bold text-slate-500 uppercase">
                    Pasivos
                </h3>
                <div class="space-y-1.5 text-xs">
                    <div
                        v-for="item in [
                            {
                                metric: 'payable',
                                label: 'CxP',
                                value: data?.liabilities.accounts_payable,
                            },
                            {
                                metric: 'customer_credits',
                                label: 'Saldos a favor',
                                value: data?.liabilities.customer_credits,
                            },
                            {
                                metric: 'pending_refunds',
                                label: 'Reembolsos pendientes',
                                value: data?.liabilities.pending_refunds,
                            },
                            {
                                metric: 'liabilities',
                                label: 'Otros pasivos',
                                value: data?.liabilities.other_liabilities,
                            },
                        ].filter(
                            (item) =>
                                item.label !== 'Otros pasivos' ||
                                amount(item.value) !== 0,
                        )"
                        :key="`${item.metric}-${item.label}`"
                        class="flex items-center justify-between gap-3"
                    >
                        <span class="text-slate-600 dark:text-slate-400">{{
                            item.label
                        }}</span>
                        <button
                            type="button"
                            :class="rowClass"
                            @click="
                                selectMetric(
                                    item.metric,
                                    item.label,
                                    amount(item.value),
                                )
                            "
                        >
                            {{ currencyFormatter(amount(item.value)) }}
                        </button>
                    </div>
                    <div
                        class="mt-2 flex justify-between border-t pt-2 font-bold dark:border-slate-800"
                    >
                        <span>Total Pasivos</span>
                        <button
                            type="button"
                            :class="rowClass"
                            @click="
                                selectMetric(
                                    'liabilities',
                                    'Pasivos',
                                    amount(data?.totals.total_liabilities),
                                )
                            "
                        >
                            {{
                                currencyFormatter(
                                    data?.totals.total_liabilities ?? 0,
                                )
                            }}
                        </button>
                    </div>
                </div>
            </section>

            <section
                class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            >
                <h3 class="mb-2 text-xs font-bold text-slate-500 uppercase">
                    Patrimonio
                </h3>
                <div class="space-y-1.5 text-xs">
                    <div
                        v-for="item in [
                            {
                                metric: 'investment',
                                label: 'Capital aportado',
                                value: data?.equity.contributed_capital,
                            },
                            {
                                metric: 'profit',
                                label: 'Utilidad del periodo',
                                value: data?.equity.period_profit,
                            },
                            {
                                metric: 'retained_earnings',
                                label: 'Resultados acumulados',
                                value: data?.equity.retained_earnings,
                            },
                            {
                                metric: 'equity',
                                label: 'Otro patrimonio',
                                value: data?.equity.other_equity,
                            },
                        ].filter(
                            (item) =>
                                item.label !== 'Otro patrimonio' ||
                                amount(item.value) !== 0,
                        )"
                        :key="`${item.metric}-${item.label}`"
                        class="flex items-center justify-between gap-3"
                    >
                        <span class="text-slate-600 dark:text-slate-400">{{
                            item.label
                        }}</span>
                        <button
                            type="button"
                            :class="[
                                rowClass,
                                item.metric === 'profit' &&
                                amount(item.value) < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : '',
                            ]"
                            @click="
                                selectMetric(
                                    item.metric,
                                    item.label,
                                    amount(item.value),
                                )
                            "
                        >
                            {{ currencyFormatter(amount(item.value)) }}
                        </button>
                    </div>
                    <div
                        class="mt-2 flex justify-between border-t pt-2 font-bold dark:border-slate-800"
                    >
                        <span>Total Patrimonio</span>
                        <button
                            type="button"
                            :class="rowClass"
                            @click="
                                selectMetric(
                                    'equity',
                                    'Patrimonio',
                                    amount(data?.totals.total_equity),
                                )
                            "
                        >
                            {{
                                currencyFormatter(
                                    data?.totals.total_equity ?? 0,
                                )
                            }}
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <section
            v-if="data?.bank_accounts?.length"
            class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
        >
            <div class="mb-2 flex items-center gap-2">
                <Landmark
                    :size="16"
                    class="text-slate-500"
                    aria-hidden="true"
                />
                <h3 class="text-xs font-bold text-slate-500 uppercase">
                    Cuentas bancarias
                </h3>
            </div>
            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div
                    v-for="account in data.bank_accounts"
                    :key="account.id"
                    class="rounded-md border border-slate-200 p-2.5 text-xs dark:border-slate-800"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="truncate font-semibold">
                                {{ account.name }}
                            </p>
                            <p class="truncate text-slate-500">
                                {{
                                    account.institution_name ||
                                    'Sin institución'
                                }}
                                <span v-if="account.masked_number">
                                    · {{ account.masked_number }}</span
                                >
                            </p>
                        </div>
                        <span
                            class="font-bold tabular-nums"
                            :class="
                                account.balance < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-900 dark:text-slate-100'
                            "
                        >
                            {{ currencyFormatter(account.balance) }}
                        </span>
                    </div>
                    <p
                        v-if="account.balance < 0"
                        class="mt-1 text-[11px] text-rose-600 dark:text-rose-400"
                    >
                        {{
                            account.allow_negative_balance
                                ? 'Sobregiro permitido'
                                : 'Saldo negativo no autorizado'
                        }}
                    </p>
                </div>
            </div>
        </section>

        <section
            class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            aria-labelledby="balance-reconciliation-title"
        >
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
                <div>
                    <h3
                        id="balance-reconciliation-title"
                        class="text-sm font-bold"
                    >
                        Activos = Pasivos + Patrimonio
                    </h3>
                    <p class="text-xs text-slate-500">
                        La diferencia se muestra sin crear partidas de
                        patrimonio artificiales.
                    </p>
                </div>
                <div
                    class="grid grid-cols-2 gap-x-5 gap-y-1 text-xs tabular-nums sm:grid-cols-4"
                >
                    <span class="text-slate-500">Activos</span>
                    <strong class="text-right">{{
                        currencyFormatter(data?.totals.total_assets ?? 0)
                    }}</strong>
                    <span class="text-slate-500">Pasivo + Patrimonio</span>
                    <strong class="text-right">{{
                        currencyFormatter(
                            data?.totals.liabilities_and_equity ?? 0,
                        )
                    }}</strong>
                    <span class="text-slate-500">Trial Balance</span>
                    <strong class="text-right">{{
                        currencyFormatter(
                            data?.reconciliation.trial_balance.difference ?? 0,
                        )
                    }}</strong>
                    <span class="text-slate-500">Diferencia</span>
                    <strong
                        class="text-right"
                        :class="
                            amount(data?.totals.reconciliation_difference) === 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                        "
                    >
                        {{
                            currencyFormatter(
                                data?.totals.reconciliation_difference ?? 0,
                            )
                        }}
                    </strong>
                </div>
            </div>

            <div
                v-if="data?.reconciliation.control_accounts?.length"
                class="mt-3 grid gap-2 md:grid-cols-2"
            >
                <div
                    v-for="control in data.reconciliation.control_accounts"
                    :key="control.key"
                    class="rounded-md bg-slate-50 p-2.5 text-xs dark:bg-slate-900"
                >
                    <div class="flex items-center justify-between gap-3">
                        <span class="font-semibold">{{ control.label }}</span>
                        <span
                            :class="
                                Math.abs(control.difference) < 0.005
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                            "
                        >
                            Diferencia
                            {{ currencyFormatter(control.difference) }}
                        </span>
                    </div>
                    <p class="mt-1 text-slate-500">
                        Mayor {{ currencyFormatter(control.ledger_balance) }} ·
                        Submódulo
                        {{ currencyFormatter(control.subledger_balance) }}
                    </p>
                </div>
            </div>
        </section>
    </div>
</template>
