<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { onMounted, ref, watch } from 'vue';
import apiClient from '@/services/api/client';
import { validateFinancialReportDates } from '@/utils/financialReport';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';
import {
    downloadMoneyReport,
    reportParams,
    reportPeriod,
} from '@/utils/moneyReports';
import ReportPeriod from './ReportPeriod.vue';
const props = defineProps<{
    initialFilters?: {
        date_from: string;
        date_to: string;
        warehouse_id: number | null;
    };
}>();
const emit = defineEmits<{
    'filters-applied': [
        filters: {
            date_from: string;
            date_to: string;
            warehouse_id: number | null;
        },
    ];
}>();
const filters = ref({
    ...reportPeriod(),
    date_from: props.initialFilters?.date_from ?? reportPeriod().date_from,
    date_to: props.initialFilters?.date_to ?? reportPeriod().date_to,
    mode: 'current',
    as_of: props.initialFilters?.date_to ?? reportPeriod().date_to,
    warehouse_id: props.initialFilters?.warehouse_id
        ? String(props.initialFilters.warehouse_id)
        : '',
    method: '',
    user_id: '',
    pos_session_id: '',
    kind: '',
    search: '',
    page: 1,
});
const appliedFilters = ref({ ...filters.value });
const result = ref<any>({
    data: [],
    summary: {},
    categories: [],
    meta: {},
    warnings: [],
});
const options = ref<any>({
    warehouses: [],
    methods: [],
    operators: [],
    sessions: [],
});
const banks = ref<any[]>([]);
const bankError = ref('');
const loading = ref(false);
const error = ref('');
let requestVersion = 0;
const kinds: Record<string, string> = {
    sale: 'Cobros',
    return: 'Devoluciones',
    funding: 'Aportaciones',
    expense: 'Gastos',
    purchase: 'Compras',
    transfer: 'Transferencias',
    adjustment: 'Ajustes',
};
async function load(reset = false) {
    const validation = validateFinancialReportDates(
        filters.value.date_from,
        filters.value.date_to,
    );
    if (validation) {
        error.value = validation;
        return;
    }
    const version = ++requestVersion;
    if (reset) filters.value.page = 1;
    loading.value = true;
    const requestedFilters = { ...filters.value };
    error.value = '';
    try {
        const [cash, accounts] = await Promise.allSettled([
            apiClient.get('/reports/cash-position', {
                params: reportParams(requestedFilters),
            }),
            apiClient.get('/money-accounts/options', {
                params: { type: 'bank', purpose: 'settlement' },
            }),
        ]);
        if (version !== requestVersion) return;
        if (accounts.status === 'fulfilled') {
            banks.value = accounts.value.data.data;
            bankError.value = '';
        } else {
            banks.value = [];
            bankError.value =
                'No se pudieron actualizar los saldos bancarios. Consulte de nuevo.';
        }
        if (cash.status === 'rejected') throw cash.reason;
        result.value = cash.value.data;
        appliedFilters.value = requestedFilters;
        emit('filters-applied', {
            date_from: requestedFilters.date_from,
            date_to: requestedFilters.date_to,
            warehouse_id:
                Number(result.value.summary.warehouse_id) ||
                Number(requestedFilters.warehouse_id) ||
                null,
        });
    } catch (e: any) {
        if (version !== requestVersion) return;
        error.value =
            e.response?.data?.message || 'No se pudo consultar el efectivo.';
    } finally {
        if (version === requestVersion) loading.value = false;
    }
}
async function download(format: 'csv' | 'xlsx') {
    try {
        await downloadMoneyReport(
            'cash-position',
            format,
            appliedFilters.value,
        );
    } catch {
        error.value = 'No se pudo exportar el reporte.';
    }
}
function page(delta: number) {
    filters.value.page += delta;
    void load();
}
watch(
    () => props.initialFilters,
    (value) => {
        if (!value) return;
        const warehouse = value.warehouse_id ? String(value.warehouse_id) : '';
        if (
            filters.value.date_from === value.date_from &&
            filters.value.date_to === value.date_to &&
            filters.value.warehouse_id === warehouse
        )
            return;
        Object.assign(filters.value, {
            date_from: value.date_from,
            date_to: value.date_to,
            warehouse_id: warehouse,
        });
        void load(true);
    },
    { deep: true },
);
onMounted(async () => {
    await load();
    try {
        const payments = await apiClient.get('/cash/payment-movements', {
            params: { per_page: 1 },
        });
        options.value = payments.data.filter_options;
    } catch {
        error.value =
            'El efectivo se cargó, pero no se pudieron obtener los filtros o las cuentas bancarias.';
    }
});
</script>
<template>
    <section class="space-y-4">
        <header class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h2 class="text-lg font-semibold">Efectivo y bancos</h2>
                <p class="text-sm text-muted-foreground">
                    Saldo conciliado y movimientos efectivos. Los depósitos
                    conservan el historial de cobros y no cambian la utilidad.
                </p>
            </div>
            <div class="flex gap-3 text-sm">
                <button class="text-primary" @click="download('csv')">
                    CSV</button
                ><button class="text-primary" @click="download('xlsx')">
                    Excel</button
                ><Link
                    v-if="
                        result.summary.initialized &&
                        result.summary.closing_balance != null
                    "
                    class="text-primary"
                    :href="`/finance/transfers/create?from_warehouse_id=${result.summary.warehouse_id}`"
                    >Transferir a banco</Link
                ><Link v-else href="/cash/payments" class="text-primary">{{
                    result.summary.initialized
                        ? 'Revisar conciliación'
                        : 'Conciliar saldo inicial'
                }}</Link>
            </div>
        </header>
        <form
            class="flex flex-wrap items-end gap-3 rounded-lg border p-3"
            @submit.prevent="load(true)"
        >
            <label class="text-xs"
                >Consulta<select
                    v-model="filters.mode"
                    aria-label="Consulta"
                    class="mt-1 block rounded border bg-background p-2"
                >
                    <option value="current">Disponible actual</option>
                    <option value="as_of">Saldo al cierre de una fecha</option>
                    <option value="period">Movimientos del período</option>
                </select></label
            >
            <label class="text-xs"
                >Sucursal<select
                    v-model="filters.warehouse_id"
                    class="mt-1 block rounded border bg-background p-2"
                >
                    <option value="">Sucursal activa</option>
                    <option
                        v-for="w in options.warehouses"
                        :key="w.id"
                        :value="w.id"
                    >
                        {{ w.name }}
                    </option>
                </select></label
            >
            <ReportPeriod
                v-model:from="filters.date_from"
                v-model:to="filters.date_to"
            />
            <label v-if="filters.mode === 'as_of'" class="text-xs"
                >Fecha de cierre<input
                    v-model="filters.as_of"
                    type="date"
                    required
                    :max="reportPeriod().date_to"
                    class="mt-1 block rounded border bg-background p-2"
            /></label>
            <p class="w-full text-xs text-muted-foreground">
                El rango filtra el historial en todos los modos. «Disponible
                actual» muestra el efectivo conciliado hasta ahora, aunque el
                rango sea histórico. Los bancos muestran sus saldos actuales.
            </p>
            <details class="w-full">
                <summary class="cursor-pointer text-sm text-primary">
                    Filtrar detalle (no cambia el saldo total de la sucursal)
                </summary>
                <div class="mt-3 flex flex-wrap gap-3">
                    <label class="text-xs"
                        >Tipo<select
                            v-model="filters.kind"
                            class="mt-1 block rounded border bg-background p-2"
                        >
                            <option value="">Todos</option>
                            <option
                                v-for="(name, key) in kinds"
                                :key="key"
                                :value="key"
                            >
                                {{ name }}
                            </option>
                        </select></label
                    ><label class="text-xs"
                        >Método<select
                            v-model="filters.method"
                            class="mt-1 block rounded border bg-background p-2"
                        >
                            <option value="">Todos</option>
                            <option
                                v-for="m in options.methods"
                                :key="m.code"
                                :value="m.code"
                            >
                                {{ m.name }}
                            </option>
                        </select></label
                    ><label class="text-xs"
                        >Operador<select
                            v-model="filters.user_id"
                            class="mt-1 block rounded border bg-background p-2"
                        >
                            <option value="">Todos</option>
                            <option
                                v-for="u in options.operators"
                                :key="u.id"
                                :value="u.id"
                            >
                                {{ u.name }}
                            </option>
                        </select></label
                    ><label class="text-xs"
                        >Sesión<select
                            v-model="filters.pos_session_id"
                            class="mt-1 block rounded border bg-background p-2"
                        >
                            <option value="">Todas</option>
                            <option
                                v-for="s in options.sessions"
                                :key="s.id"
                                :value="s.id"
                            >
                                Caja #{{ s.id }}
                            </option>
                        </select></label
                    ><label class="text-xs"
                        >Referencia / documento<input
                            v-model="filters.search"
                            class="mt-1 block rounded border bg-background p-2"
                    /></label>
                </div>
            </details>
            <button
                :disabled="loading"
                class="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
                Consultar
            </button>
        </form>
        <p v-if="error" role="alert" class="text-sm text-destructive">
            {{ error }}
        </p>
        <p
            v-for="warning in result.warnings"
            :key="warning"
            class="rounded border border-amber-400 p-3 text-sm"
        >
            {{ warning }}
        </p>
        <p
            v-if="result.summary.initialized === false"
            class="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
        >
            Para conocer el efectivo físico disponible, un administrador debe
            confirmar el conteo inicial y su fecha de corte en Caja. Los cobros
            históricos pueden haberse gastado o depositado y no equivalen a ese
            saldo. Las entradas y salidas de abajo corresponden al historial del
            rango seleccionado.
        </p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article
                v-for="(name, key) in {
                    opening_balance: 'Saldo al inicio del rango',
                    incoming: 'Entradas del rango',
                    outgoing: 'Salidas del rango',
                    closing_balance:
                        appliedFilters.mode === 'current'
                            ? 'Efectivo disponible'
                            : 'Saldo al cierre',
                }"
                :key="key"
                class="rounded-lg border p-3"
            >
                <p class="text-xs text-muted-foreground">{{ name }}</p>
                <p class="font-mono text-lg font-semibold">
                    {{
                        result.summary[key] == null
                            ? 'No disponible'
                            : formatCurrency(Number(result.summary[key]))
                    }}
                </p>
            </article>
        </div>
        <p class="text-xs text-muted-foreground">
            Corte efectivo:
            {{ formatReportDateTime(result.summary.effective_as_of) }}. El saldo
            disponible se calcula desde la conciliación. El historial puede
            incluir documentos anteriores al libro o al corte y no equivale a
            efectivo disponible.
        </p>
        <div class="flex flex-wrap gap-3">
            <span
                v-for="item in result.categories"
                :key="item.kind"
                class="rounded border px-3 py-2 text-sm"
                >{{ kinds[item.kind] || item.kind }}: +{{
                    formatCurrency(Number(item.incoming))
                }}
                / −{{ formatCurrency(Number(item.outgoing)) }}</span
            >
        </div>
        <div class="space-y-1">
            <h3 class="font-semibold">Historial de efectivo</h3>
            <p class="text-sm text-muted-foreground">
                Documentos originales y movimientos del libro en el rango
                seleccionado. Cada operación se muestra una sola vez.
            </p>
        </div>
        <div class="overflow-x-auto rounded-lg border">
            <table class="w-full text-sm whitespace-nowrap">
                <thead class="bg-muted">
                    <tr>
                        <th class="p-3 text-left">Fecha efectiva / registro</th>
                        <th class="p-3 text-left">Operación / referencia</th>
                        <th class="p-3 text-left">Responsable</th>
                        <th class="p-3 text-right">Importe</th>
                        <th class="p-3 text-right">Saldo acumulado</th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    <tr v-for="row in result.data" :key="row.row_key || row.id">
                        <td class="p-3">
                            {{
                                formatReportDateTime(
                                    row.effective_at ||
                                        row.business_datetime ||
                                        row.occurred_at,
                                )
                            }}
                            <p
                                v-if="
                                    row.business_datetime &&
                                    row.business_datetime !== row.occurred_at
                                "
                                class="text-xs text-muted-foreground"
                            >
                                Registro:
                                {{ formatReportDateTime(row.occurred_at) }}
                            </p>
                        </td>
                        <td class="p-3">
                            <Link
                                v-if="row.document_url"
                                :href="row.document_url"
                                class="text-primary"
                                >{{ kinds[row.kind] || row.kind }} ·
                                {{ row.reference || `#${row.source_id}` }}</Link
                            ><span v-else
                                >{{ kinds[row.kind] || row.kind }} ·
                                {{ row.reference }}</span
                            >
                            <p class="text-xs text-muted-foreground">
                                {{ row.description }}
                                {{
                                    row.source_line_key === 'reversal'
                                        ? ' · Reversión'
                                        : ''
                                }}
                            </p>
                            <p
                                v-if="row.origin && row.origin !== 'ledger'"
                                class="text-xs text-amber-700 dark:text-amber-300"
                            >
                                Documento histórico · sin registro en libro.
                                Sucursal identificada desde su documento o
                                sesión. No calcula el saldo disponible.
                            </p>
                            <p
                                v-else-if="
                                    row.included_in_cash_balance === false
                                "
                                class="text-xs text-muted-foreground"
                            >
                                Saldo no verificable para este registro.
                            </p>
                        </td>
                        <td class="p-3">{{ row.user_name || '—' }}</td>
                        <td class="p-3 text-right font-mono">
                            {{ formatCurrency(Number(row.amount)) }}
                        </td>
                        <td class="p-3 text-right font-mono">
                            {{
                                row.balance == null
                                    ? 'No disponible'
                                    : formatCurrency(Number(row.balance))
                            }}
                        </td>
                    </tr>
                    <tr v-if="!result.data.length">
                        <td
                            colspan="5"
                            class="p-6 text-center text-muted-foreground"
                        >
                            {{
                                loading
                                    ? 'Cargando…'
                                    : 'Sin registros de efectivo para este rango y filtros de detalle.'
                            }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p
            v-if="
                !result.data.length &&
                result.history_summary?.records_in_range === 0 &&
                result.history_summary?.outside_range_records
            "
            class="text-sm text-muted-foreground"
        >
            Hay {{ result.history_summary.outside_range_records }} registros en
            otras fechas. Amplíe el rango para consultar su historial.
        </p>
        <footer class="flex justify-end gap-4 text-sm">
            <span>{{ result.meta.total || 0 }} movimientos</span
            ><button :disabled="loading || filters.page <= 1" @click="page(-1)">
                Anterior</button
            ><span
                >{{ result.meta.current_page || 1 }} /
                {{ result.meta.last_page || 1 }}</span
            ><button
                :disabled="loading || filters.page >= result.meta.last_page"
                @click="page(1)"
            >
                Siguiente
            </button>
        </footer>
        <h3 class="font-semibold">
            Cuentas bancarias · saldos actuales consolidados
        </h3>
        <p class="text-sm text-muted-foreground">
            Los saldos se muestran por cuenta. Los cobros de Yappy o tarjeta
            pueden llegar a una misma cuenta; no son saldos independientes. Esta
            sección no representa el saldo bancario histórico del período.
        </p>
        <div class="overflow-x-auto rounded-lg border">
            <table class="w-full text-sm">
                <thead class="bg-muted">
                    <tr>
                        <th class="p-3 text-left">Cuenta</th>
                        <th class="p-3 text-left">Número</th>
                        <th class="p-3 text-left">Moneda</th>
                        <th class="p-3 text-right">Saldo actual</th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    <tr v-for="bank in banks" :key="bank.endpoint_id">
                        <td class="p-3">{{ bank.name }}</td>
                        <td class="p-3">{{ bank.masked_number || '—' }}</td>
                        <td class="p-3">{{ bank.currency }}</td>
                        <td class="p-3 text-right font-mono">
                            {{
                                formatCurrency(Number(bank.balance), {
                                    currency: bank.currency,
                                })
                            }}
                        </td>
                    </tr>
                    <tr v-if="!banks.length">
                        <td
                            colspan="4"
                            class="p-4 text-center text-muted-foreground"
                        >
                            {{
                                bankError ||
                                'No hay cuentas bancarias disponibles. Configure una cuenta concreta para registrar depósitos.'
                            }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>
