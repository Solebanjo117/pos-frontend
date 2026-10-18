<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { onMounted, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import apiClient from '@/services/api/client';
import { validateFinancialReportDates } from '@/utils/financialReport';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';
import { downloadMoneyReport, reportPeriod } from '@/utils/moneyReports';
import CashDepositPanel from './CashDepositPanel.vue';
import ReportPeriod from './ReportPeriod.vue';

const props = withDefaults(
    defineProps<{
        reportMode?: boolean;
        initialFilters?: {
            date_from: string;
            date_to: string;
            warehouse_id: number | null;
        };
    }>(),
    {
        reportMode: false,
    },
);
const emit = defineEmits<{
    'cash-deposited': [];
    'filters-applied': [
        filters: {
            date_from: string;
            date_to: string;
            warehouse_id: number | null;
        },
    ];
}>();
const { isAdmin, isManager } = useAuth();
const filterOptions = ref<{
    methods: any[];
    operators: any[];
    sessions: any[];
    warehouses: any[];
}>({ methods: [], operators: [], sessions: [], warehouses: [] });
const filters = ref({
    warehouse_id: props.initialFilters?.warehouse_id
        ? String(props.initialFilters.warehouse_id)
        : '',
    scope: 'sales',
    date_from:
        props.initialFilters?.date_from ??
        (props.reportMode ? reportPeriod().date_from : ''),
    date_to:
        props.initialFilters?.date_to ??
        (props.reportMode ? reportPeriod().date_to : ''),
    method: '',
    pos_session_id: '',
    user_id: '',
    pending_account: false,
});
const appliedFilters = ref<Record<string, unknown>>({});
const rows = ref<any[]>([]);
const summary = ref<any[]>([]);
const warnings = ref<string[]>([]);
const accounts = ref<Array<{ endpoint_id: number; name: string }>>([]);
const accountSelection = ref<Record<string, number>>({});
const availability = ref<any>(null);
const page = ref(1);
const lastPage = ref(1);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const reconciliation = ref({ amount: 0, cutoff_at: '', reason: '' });
let requestVersion = 0;
async function load(preserveAvailability = false) {
    if (props.reportMode) {
        const validation = validateFinancialReportDates(
            filters.value.date_from,
            filters.value.date_to,
        );
        if (validation) {
            error.value = validation;
            return;
        }
    }
    const version = ++requestVersion;
    rows.value = [];
    summary.value = [];
    if (!preserveAvailability) availability.value = null;
    loading.value = true;
    error.value = null;
    const params = Object.fromEntries(
        Object.entries({
            ...filters.value,
            pending_account: filters.value.pending_account ? 1 : undefined,
            page: page.value,
        }).filter(([, value]) => value !== '' && value !== undefined),
    );
    try {
        const [movements, totals, cash] = await Promise.all([
            apiClient.get('/cash/payment-movements', { params }),
            apiClient.get('/cash/payment-summary', { params }),
            apiClient.get('/cash/availability', {
                params: {
                    warehouse_id: filters.value.warehouse_id || undefined,
                },
            }),
        ]);
        if (version !== requestVersion) return;
        rows.value = movements.data.data;
        warnings.value = movements.data.warnings || [];
        filterOptions.value = movements.data.filter_options;
        lastPage.value = movements.data.last_page;
        summary.value = totals.data.data;
        availability.value = cash.data.data;
        appliedFilters.value = { ...params };
        emit('filters-applied', {
            date_from: String(params.date_from || ''),
            date_to: String(params.date_to || ''),
            warehouse_id: Number(availability.value.warehouse_id) || null,
        });
    } catch (exception: any) {
        if (version !== requestVersion) return;
        error.value =
            exception.response?.data?.message ||
            'No se pudieron cargar los movimientos.';
    } finally {
        if (version === requestVersion) loading.value = false;
    }
}
async function download(format: 'csv' | 'xlsx') {
    try {
        await downloadMoneyReport(
            'payment-methods',
            format,
            appliedFilters.value,
        );
    } catch {
        error.value = 'No se pudo exportar el reporte.';
    }
}
function afterDeposit(): void {
    emit('cash-deposited');
    void load(true);
}
async function assign(row: any) {
    const id = accountSelection.value[`${row.scope}-${row.id}`];
    if (!id) return;
    saving.value = true;
    error.value = null;
    try {
        await apiClient.post(`/cash/payments/${row.scope}/${row.id}/account`, {
            financial_account_id: id,
            warehouse_id: availability.value.warehouse_id,
        });
        await load();
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo asignar la cuenta.';
    } finally {
        saving.value = false;
    }
}
async function reconcile() {
    saving.value = true;
    error.value = null;
    try {
        await apiClient.post('/cash/reconciliation', {
            ...reconciliation.value,
            warehouse_id: availability.value.warehouse_id,
            cutoff_at: new Date(reconciliation.value.cutoff_at).toISOString(),
        });
        await load();
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo registrar la conciliación.';
    } finally {
        saving.value = false;
    }
}
function documentUrl(row: any): string | null {
    if (row.return_id) return `/returns/${row.return_id}`;
    if (row.scope === 'sales') return `/sales-orders/${row.document_id}`;
    if (row.scope === 'purchases') return `/purchase-orders/${row.document_id}`;
    return null;
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
        page.value = 1;
        void load();
    },
    { deep: true },
);
onMounted(async () => {
    await load();
    if (isManager.value) {
        try {
            accounts.value = (
                await apiClient.get('/money-accounts/options', {
                    params: { type: 'bank', purpose: 'settlement' },
                })
            ).data.data;
        } catch {
            error.value = 'No se pudieron cargar las cuentas para asignación.';
        }
    }
});
</script>

<template>
    <main class="space-y-4 p-4 md:p-6">
        <header class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-xl font-semibold">
                    {{
                        reportMode
                            ? 'Cobros por método'
                            : 'Movimientos por método'
                    }}
                </h1>
                <p class="text-sm text-muted-foreground">
                    Cobros y devoluciones por sus pagos reales. El neto cobrado
                    no es utilidad ni saldo disponible.
                </p>
            </div>
            <div class="text-right">
                <span class="text-xs text-muted-foreground"
                    >Efectivo disponible de la sucursal</span
                >
                <p class="font-mono font-semibold">
                    {{
                        availability?.initialized
                            ? formatCurrency(availability.balance)
                            : 'Saldo sin inicializar'
                    }}
                </p>
            </div>
        </header>
        <p
            v-if="error"
            role="alert"
            class="rounded-md border border-red-300 p-3 text-sm text-red-600"
        >
            {{ error }}
        </p>
        <p
            v-for="warning in warnings"
            :key="warning"
            role="status"
            class="rounded-md border border-amber-300 p-3 text-sm text-amber-800"
        >
            {{ warning }}
        </p>
        <form
            class="flex flex-wrap items-end gap-3 rounded-md border p-3"
            @submit.prevent="
                page = 1;
                load();
            "
        >
            <label class="text-xs"
                >Sucursal<select
                    v-model="filters.warehouse_id"
                    class="mt-1 block rounded-md border bg-background p-2"
                >
                    <option value="">Sucursal activa</option>
                    <option
                        v-for="warehouse in filterOptions.warehouses"
                        :key="warehouse.id"
                        :value="warehouse.id"
                    >
                        {{ warehouse.name }}
                    </option>
                </select></label
            ><label v-if="!reportMode" class="text-xs"
                >Operación<select
                    v-model="filters.scope"
                    class="mt-1 block rounded-md border bg-background p-2"
                >
                    <option value="sales">Ventas y devoluciones</option>
                    <option value="operations">Gastos y aportaciones</option>
                    <option value="purchases">Pagos de compras</option>
                </select></label
            >
            <ReportPeriod
                v-if="reportMode"
                v-model:from="filters.date_from"
                v-model:to="filters.date_to"
            />
            <label v-if="!reportMode" class="text-xs"
                >Desde<input
                    v-model="filters.date_from"
                    type="date"
                    class="mt-1 block rounded-md border bg-background p-2"
            /></label>
            <label v-if="!reportMode" class="text-xs"
                >Hasta<input
                    v-model="filters.date_to"
                    type="date"
                    class="mt-1 block rounded-md border bg-background p-2"
            /></label>
            <label class="text-xs"
                >Método<select
                    v-model="filters.method"
                    class="mt-1 block rounded-md border bg-background p-2"
                >
                    <option value="">Todos</option>
                    <option
                        v-for="method in filterOptions.methods"
                        :key="method.code"
                        :value="method.code"
                    >
                        {{ method.name || method.code }}
                    </option>
                </select></label
            >
            <label class="text-xs"
                >Sesión<select
                    v-model="filters.pos_session_id"
                    class="mt-1 block rounded-md border bg-background p-2"
                >
                    <option value="">Todas</option>
                    <option
                        v-for="session in filterOptions.sessions"
                        :key="session.id"
                        :value="session.id"
                    >
                        Caja #{{ session.id }}
                    </option>
                </select></label
            >
            <label class="text-xs"
                >Operador<select
                    v-model="filters.user_id"
                    class="mt-1 block rounded-md border bg-background p-2"
                >
                    <option value="">Todos</option>
                    <option
                        v-for="operator in filterOptions.operators"
                        :key="operator.id"
                        :value="operator.id"
                    >
                        {{ operator.name }}
                    </option>
                </select></label
            >
            <label class="flex items-center gap-2 text-sm"
                ><input
                    v-model="filters.pending_account"
                    type="checkbox"
                />Pendientes de cuenta</label
            >
            <button
                :disabled="loading"
                class="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
                Consultar
            </button>
        </form>
        <p v-if="reportMode" class="text-sm text-muted-foreground">
            Solo incluye dinero efectivamente cobrado o reembolsado.
            <Link href="/reports/credit-notes" class="text-primary"
                >Consultar notas de crédito y saldos a favor</Link
            >.
        </p>
        <div v-if="reportMode" class="flex justify-end gap-3 text-sm">
            <button class="text-primary" @click="download('csv')">CSV</button
            ><button class="text-primary" @click="download('xlsx')">
                Excel
            </button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article
                v-for="item in summary"
                :key="item.method"
                class="rounded-md border p-3 text-sm"
            >
                <h2 class="font-semibold">
                    {{ item.method_name || item.method }}
                </h2>
                <p>
                    {{ filters.scope === 'sales' ? 'Cobros' : 'Entradas' }}:
                    {{ formatCurrency(Number(item.incoming)) }}
                </p>
                <p>
                    {{
                        filters.scope === 'sales' ? 'Devoluciones' : 'Salidas'
                    }}: {{ formatCurrency(Number(item.outgoing)) }}
                </p>
                <p class="mt-1 font-semibold">
                    Neto: {{ formatCurrency(Number(item.net)) }}
                </p>
            </article>
        </div>
        <CashDepositPanel
            v-if="
                isManager &&
                availability?.warehouse_id &&
                appliedFilters.date_from &&
                appliedFilters.date_to
            "
            :warehouse-id="Number(availability.warehouse_id)"
            :date-from="String(appliedFilters.date_from)"
            :date-to="String(appliedFilters.date_to)"
            @deposited="afterDeposit"
        />
        <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
                <thead class="bg-muted">
                    <tr>
                        <th class="p-3 text-left">Documento / fecha</th>
                        <th class="p-3 text-left">Método / referencia</th>
                        <th class="p-3 text-left">Cuenta</th>
                        <th class="p-3 text-left">Responsable</th>
                        <th class="p-3 text-right">Importe</th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    <tr v-for="row in rows" :key="`${row.scope}-${row.id}`">
                        <td class="p-3">
                            <Link
                                v-if="documentUrl(row)"
                                :href="documentUrl(row)!"
                                class="font-medium text-primary"
                                >{{ row.document_number }}</Link
                            ><span v-else
                                >{{
                                    row.scope === 'receipts'
                                        ? row.document_number
                                        : row.document_number.includes(
                                                'Expense',
                                            )
                                          ? 'Gasto'
                                          : 'Aportación'
                                }}
                                #{{ row.document_id }}</span
                            >
                            <p class="text-xs text-muted-foreground">
                                {{
                                    formatReportDateTime(
                                        row.business_datetime || row.created_at,
                                    )
                                }}
                            </p>
                        </td>
                        <td class="p-3">
                            {{ row.method_name || row.method }}
                            <p class="text-xs text-muted-foreground">
                                {{ row.reference_number || '—' }}
                            </p>
                        </td>
                        <td class="p-3">
                            <template
                                v-if="
                                    row.liquidity_bucket === 'bank' &&
                                    !row.financial_account_id
                                "
                                ><span class="text-amber-700"
                                    >Pendiente de asignar cuenta</span
                                >
                                <div v-if="isManager" class="mt-1 flex gap-2">
                                    <select
                                        v-model="
                                            accountSelection[
                                                `${row.scope}-${row.id}`
                                            ]
                                        "
                                        class="max-w-48 rounded border bg-background p-1"
                                    >
                                        <option
                                            v-for="account in accounts"
                                            :key="account.endpoint_id"
                                            :value="account.endpoint_id"
                                        >
                                            {{ account.name }}
                                        </option></select
                                    ><button
                                        :disabled="
                                            saving ||
                                            !accountSelection[
                                                `${row.scope}-${row.id}`
                                            ]
                                        "
                                        class="text-primary"
                                        @click="assign(row)"
                                    >
                                        Asignar
                                    </button>
                                </div></template
                            ><span v-else>{{ row.account_name || '—' }}</span>
                        </td>
                        <td class="p-3">{{ row.user_name || '—' }}</td>
                        <td class="p-3 text-right font-mono">
                            {{ formatCurrency(Number(row.amount)) }}
                        </td>
                    </tr>
                    <tr v-if="!rows.length">
                        <td
                            colspan="5"
                            class="p-6 text-center text-muted-foreground"
                        >
                            {{
                                loading
                                    ? 'Cargando…'
                                    : 'Sin movimientos para estos filtros.'
                            }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="flex justify-end gap-3 text-sm">
            <button
                :disabled="page <= 1 || loading"
                @click="
                    page--;
                    load();
                "
            >
                Anterior</button
            ><span>{{ page }} / {{ lastPage }}</span
            ><button
                :disabled="page >= lastPage || loading"
                @click="
                    page++;
                    load();
                "
            >
                Siguiente
            </button>
        </div>
        <form
            v-if="isAdmin && availability && !availability.initialized"
            class="space-y-3 rounded-md border p-4"
            @submit.prevent="reconcile"
        >
            <h2 class="font-semibold">Conciliar efectivo inicial</h2>
            <p class="text-sm text-muted-foreground">
                Confirme el efectivo real de la sucursal a la fecha de corte.
                Este saldo solo se registra una vez.
            </p>
            <div class="flex flex-wrap gap-3">
                <label class="text-sm"
                    >Saldo real<input
                        v-model.number="reconciliation.amount"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        class="mt-1 block rounded border bg-background p-2" /></label
                ><label class="text-sm"
                    >Fecha de corte<input
                        v-model="reconciliation.cutoff_at"
                        type="datetime-local"
                        required
                        class="mt-1 block rounded border bg-background p-2" /></label
                ><label class="flex-1 text-sm"
                    >Motivo / referencia<input
                        v-model="reconciliation.reason"
                        required
                        maxlength="1000"
                        class="mt-1 block w-full rounded border bg-background p-2"
                /></label>
            </div>
            <button
                :disabled="saving"
                class="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
                Confirmar saldo conciliado
            </button>
        </form>
        <Link
            v-if="isAdmin && availability?.initialized"
            href="/finance/accounting/adjustments"
            class="text-sm text-primary"
            >Registrar ajuste de efectivo</Link
        >
    </main>
</template>
