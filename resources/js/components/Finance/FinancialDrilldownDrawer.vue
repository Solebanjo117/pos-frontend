<script setup lang="ts">
import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-vue-next';
import type { FinancialDrilldownReport } from '@/types/report';
import { formatReportDateTime } from '@/utils/formatters';

const props = defineProps<{
    open: boolean;
    report: FinancialDrilldownReport | null;
    loading?: boolean;
    currencyFormatter: (value: number) => string;
}>();

const emit = defineEmits<{
    close: [];
    page: [page: number];
    'per-page': [perPage: number];
    drilldown: [
        payload: { key: string; metric: string; label: string; value: number },
    ];
}>();

const perPageOptions = [10, 25, 50, 100];

const changePerPage = (event: Event): void => {
    const perPage = Number((event.target as HTMLSelectElement).value);
    if (perPageOptions.includes(perPage)) {
        emit('per-page', perPage);
    }
};

const warningLabels: Record<string, string> = {
    inventory_historical_value_uses_current_fifo_lot_availability:
        'Inventario historico estimado con disponibilidad FIFO actual.',
    metric_not_supported: 'Este indicador aun no tiene desglose disponible.',
};

const formatCell = (value: unknown, type?: string): string => {
    if (type === 'money') {
        return props.currencyFormatter(Number(value) || 0);
    }

    if (type === 'datetime') {
        return formatReportDateTime(value);
    }

    if (value === null || value === undefined || value === '') {
        return '-';
    }

    return String(value);
};

const canOpenNestedDrilldown = (
    row: Record<string, unknown>,
    columnKey: string,
): boolean =>
    columnKey === 'detail_metric' &&
    typeof row.detail_metric === 'string' &&
    row.detail_metric.trim() !== '';

const openNestedDrilldown = (row: Record<string, unknown>): void => {
    const metric = String(row.detail_metric || '');
    if (!metric) return;

    emit('drilldown', {
        key: metric,
        metric,
        label: String(row.component || row.source || metric),
        value: Number(row.amount || 0),
    });
};
</script>

<template>
    <div
        v-if="open"
        class="fixed inset-0 z-50 bg-slate-950/30"
        @click.self="emit('close')"
    >
        <aside
            class="ml-auto flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
            <header
                class="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
            >
                <div>
                    <p
                        class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                    >
                        Desglose
                    </p>
                    <h2
                        class="text-base font-semibold text-slate-950 dark:text-slate-50"
                    >
                        {{ report?.label ?? 'Detalle financiero' }}
                    </h2>
                    <p
                        class="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                    >
                        Total:
                        <span class="font-semibold tabular-nums">
                            {{ currencyFormatter(report?.total ?? 0) }}
                        </span>
                    </p>
                </div>
                <button
                    class="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                    @click="emit('close')"
                    aria-label="Cerrar desglose"
                >
                    <X :size="17" />
                </button>
            </header>

            <div
                v-if="report?.warnings?.length"
                class="mx-4 mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
                <div
                    v-for="warning in report.warnings"
                    :key="warning"
                    class="flex items-start gap-2"
                >
                    <AlertTriangle :size="15" class="mt-0.5 shrink-0" />
                    <span>{{ warningLabels[warning] ?? warning }}</span>
                </div>
            </div>

            <div
                v-if="!loading && report"
                class="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400"
            >
                <span>
                    {{ report.meta.total }} registros · Pagina
                    {{ report.meta.current_page }} de {{ report.meta.last_page }}
                </span>
                <div class="flex items-center gap-2">
                    <label class="flex items-center gap-1.5">
                        <span>Mostrar</span>
                        <select
                            :value="report.meta.per_page"
                            class="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            aria-label="Registros por pagina"
                            @change="changePerPage"
                        >
                            <option
                                v-for="option in perPageOptions"
                                :key="option"
                                :value="option"
                            >
                                {{ option }}
                            </option>
                        </select>
                    </label>
                    <button
                        class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        :disabled="report.meta.current_page <= 1"
                        aria-label="Pagina anterior"
                        @click="emit('page', report.meta.current_page - 1)"
                    >
                        <ChevronLeft :size="16" />
                    </button>
                    <button
                        class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        :disabled="report.meta.current_page >= report.meta.last_page"
                        aria-label="Pagina siguiente"
                        @click="emit('page', report.meta.current_page + 1)"
                    >
                        <ChevronRight :size="16" />
                    </button>
                </div>
            </div>

            <div class="min-h-0 flex-1 overflow-auto p-4">
                <div
                    v-if="loading"
                    class="rounded-md border border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400"
                >
                    Cargando detalle...
                </div>

                <table
                    v-else-if="report?.rows?.length"
                    class="min-w-full text-xs tabular-nums"
                >
                    <thead class="sticky top-0 bg-slate-50 dark:bg-slate-900">
                        <tr>
                            <th
                                v-for="column in report.columns"
                                :key="column.key"
                                class="px-3 py-2 text-left font-semibold text-slate-500 uppercase dark:text-slate-400"
                                :class="{
                                    'text-right': column.type === 'money',
                                }"
                            >
                                {{ column.label }}
                            </th>
                        </tr>
                    </thead>
                    <tbody
                        class="divide-y divide-slate-100 dark:divide-slate-800"
                    >
                        <tr
                            v-for="row in report.rows"
                            :key="row.id ?? JSON.stringify(row)"
                            class="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                        >
                            <td
                                v-for="column in report.columns"
                                :key="column.key"
                                class="px-3 py-2 text-slate-700 dark:text-slate-300"
                                :class="{
                                    'text-right font-semibold text-slate-950 dark:text-slate-50':
                                        column.type === 'money',
                                }"
                            >
                                <button
                                    v-if="
                                        canOpenNestedDrilldown(row, column.key)
                                    "
                                    type="button"
                                    class="rounded px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700 focus:ring-1 focus:ring-indigo-200 focus:outline-none dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                                    @click="openNestedDrilldown(row)"
                                >
                                    Ver movimientos
                                </button>
                                <span v-else>
                                    {{
                                        formatCell(
                                            row[column.key],
                                            column.type,
                                        )
                                    }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div
                    v-else
                    class="rounded-md border border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400"
                >
                    No hay registros para este indicador en el periodo.
                </div>
            </div>

            <footer
                class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
            >
                <span>
                    {{ report?.meta?.total ?? 0 }} registros · Pagina
                    {{ report?.meta?.current_page ?? 1 }} de
                    {{ report?.meta?.last_page ?? 1 }}
                </span>
                <div class="flex items-center gap-2">
                    <button
                        class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        :disabled="loading || !report || report.meta.current_page <= 1"
                        aria-label="Pagina anterior"
                        @click="
                            emit('page', (report?.meta.current_page ?? 1) - 1)
                        "
                    >
                        <ChevronLeft :size="16" />
                    </button>
                    <span>
                        {{ report?.meta?.current_page ?? 1 }} /
                        {{ report?.meta?.last_page ?? 1 }}
                    </span>
                    <button
                        class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        :disabled="
                            loading ||
                            !report ||
                            report.meta.current_page >= report.meta.last_page
                        "
                        aria-label="Pagina siguiente"
                        @click="
                            emit('page', (report?.meta.current_page ?? 1) + 1)
                        "
                    >
                        <ChevronRight :size="16" />
                    </button>
                </div>
            </footer>
        </aside>
    </div>
</template>
