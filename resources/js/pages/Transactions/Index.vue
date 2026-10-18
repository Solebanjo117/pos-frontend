<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import {
    ArrowRight,
    FileText,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    XCircle,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { usePosSettings } from '@/composables/usePosSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import { posService } from '@/services/api/pos';
import { SalesQuotesApiService } from '@/services/sales-quotes';
import { transactionsService } from '@/services/transactions';
import type {
    TransactionFilters,
    TransactionListResponse,
    TransactionRow,
} from '@/types/transaction-list';

defineOptions({ layout: AppLayout });

const page = usePage();
const initialQuery = new URLSearchParams(page.url.split('?')[1] ?? '');
const role = computed(
    () => (page.props.auth?.user as { role?: string } | undefined)?.role,
);
const canCreateQuote = computed(() =>
    ['admin', 'manager', 'seller'].includes(role.value ?? ''),
);
const { currentWarehouseId, initWarehouse } = usePosSettings();
const filters = ref({
    type:
        initialQuery.get('type') === 'order' ||
        initialQuery.get('type') === 'quote'
            ? (initialQuery.get('type') as 'order' | 'quote')
            : ('all' as 'all' | 'order' | 'quote'),
    status: '',
    status_group: '',
    search: '',
    date_from: '',
    date_to: '',
});
const result = ref<TransactionListResponse | null>(null);
const loading = ref(false);
const error = ref('');
const currentPage = ref(1);
const selectedWarehouseId = ref<number | null>(null);
const allowedWarehouses = ref<Array<{ id: number; name: string }>>([]);

const rows = computed(() => result.value?.data ?? []);
const metrics = computed(() => result.value?.metrics);
const statuses = computed(() => [
    ...(filters.value.type !== 'quote'
        ? [
              { value: 'order:draft', label: 'OV · Borrador' },
              { value: 'order:pending', label: 'OV · Pendiente' },
              { value: 'order:confirmed', label: 'OV · Confirmada' },
              { value: 'order:processing', label: 'OV · En proceso' },
              { value: 'order:completed', label: 'OV · Completada' },
              { value: 'order:cancelled', label: 'OV · Cancelada' },
          ]
        : []),
    ...(filters.value.type !== 'order'
        ? [
              { value: 'quote:draft', label: 'Cotización · Borrador' },
              { value: 'quote:sent', label: 'Cotización · Enviada' },
              {
                  value: 'quote:sent_to_deposit',
                  label: 'Cotización · En depósito',
              },
              { value: 'quote:sent_to_cashier', label: 'Cotización · En Caja' },
              { value: 'quote:accepted', label: 'Cotización · Aceptada' },
              { value: 'quote:collected', label: 'Cotización · Cobrada' },
              {
                  value: 'quote:converted',
                  label: 'Cotización · Convertida a OV',
              },
              { value: 'quote:rejected', label: 'Cotización · Rechazada' },
              { value: 'quote:expired', label: 'Cotización · Expirada' },
          ]
        : []),
]);

const money = (value: string | number) =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value));

const dateLabel = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-');
    return [day, month, year].join('/');
};

const documentUrl = (row: TransactionRow) =>
    row.type === 'order'
        ? '/sales-orders/' + row.id
        : '/sales-quotes/' + row.id;

const editUrl = (row: TransactionRow) =>
    row.type === 'order'
        ? '/sales-orders/' + row.id + '/edit'
        : '/quotes/' + row.id + '/edit';

const statusClass = (row: TransactionRow) => {
    if (['cancelled', 'rejected', 'expired'].includes(row.status))
        return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
    if (['completed', 'collected', 'converted'].includes(row.status))
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
};

async function load(nextPage = currentPage.value) {
    loading.value = true;
    error.value = '';
    try {
        const params: TransactionFilters = {
            type: filters.value.type,
            status: filters.value.status || undefined,
            status_group:
                (filters.value
                    .status_group as TransactionFilters['status_group']) ||
                undefined,
            search: filters.value.search.trim() || undefined,
            date_from: filters.value.date_from || undefined,
            date_to: filters.value.date_to || undefined,
            warehouse_id:
                (role.value === 'admin'
                    ? selectedWarehouseId.value
                    : currentWarehouseId.value) ?? undefined,
            page: nextPage,
            per_page: 15,
        };
        result.value = await transactionsService.list(params);
        currentPage.value = result.value.current_page;
        const query = new URLSearchParams();
        if (filters.value.type !== 'all') query.set('type', filters.value.type);
        if (role.value === 'admin' && selectedWarehouseId.value)
            query.set('warehouse_id', String(selectedWarehouseId.value));
        if (filters.value.status) query.set('status', filters.value.status);
        if (filters.value.status_group)
            query.set('status_group', filters.value.status_group);
        if (filters.value.search.trim())
            query.set('search', filters.value.search.trim());
        if (filters.value.date_from)
            query.set('date_from', filters.value.date_from);
        if (filters.value.date_to) query.set('date_to', filters.value.date_to);
        if (currentPage.value > 1) query.set('page', String(currentPage.value));
        window.history.replaceState(
            window.history.state,
            '',
            '/transactions' + (query.size ? '?' + query : ''),
        );
    } catch (cause: any) {
        error.value =
            cause.response?.data?.message ||
            'No se pudieron cargar las transacciones.';
    } finally {
        loading.value = false;
    }
}

function applyFilters() {
    load(1);
}

function setType(type: 'all' | 'order' | 'quote') {
    filters.value.type = type;
    filters.value.status = '';
    load(1);
}

async function transition(
    row: TransactionRow,
    action: 'send-to-deposit' | 'send-to-cashier',
) {
    const prompt =
        action === 'send-to-deposit'
            ? '¿Enviar esta cotización a Depósito?'
            : '¿Enviar esta cotización a Caja?';
    if (!confirm(prompt)) return;
    try {
        await SalesQuotesApiService.transition(row.id, action);
        await load();
    } catch (cause: any) {
        error.value =
            cause.response?.data?.message ||
            'No se pudo actualizar la cotización.';
    }
}

async function convert(row: TransactionRow) {
    if (
        !confirm(
            '¿Convertir esta cotización en orden de venta? Se descontará inventario.',
        )
    )
        return;
    try {
        await SalesQuotesApiService.convert(row.id, {
            payment_method: 'cash',
            payment_status: 'pending',
        });
        await load();
    } catch (cause: any) {
        error.value =
            cause.response?.data?.message ||
            'No se pudo convertir la cotización.';
    }
}

async function deleteQuote(row: TransactionRow) {
    if (
        !confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.')
    )
        return;
    try {
        await SalesQuotesApiService.delete(row.id);
        await load();
    } catch (cause: any) {
        error.value =
            cause.response?.data?.message ||
            'No se pudo eliminar la cotización.';
    }
}

onMounted(async () => {
    filters.value.status = initialQuery.get('status') ?? '';
    filters.value.status_group = initialQuery.get('status_group') ?? '';
    filters.value.search = initialQuery.get('search') ?? '';
    filters.value.date_from = initialQuery.get('date_from') ?? '';
    filters.value.date_to = initialQuery.get('date_to') ?? '';
    currentPage.value = Number(initialQuery.get('page') ?? 1) || 1;
    await initWarehouse();
    selectedWarehouseId.value = currentWarehouseId.value;
    if (role.value === 'admin') {
        try {
            const context = await posService.getWarehouseContext();
            allowedWarehouses.value = context.allowed_warehouses ?? [];
            const requestedWarehouseId = Number(
                initialQuery.get('warehouse_id'),
            );
            if (
                allowedWarehouses.value.some(
                    (warehouse) => warehouse.id === requestedWarehouseId,
                )
            ) {
                selectedWarehouseId.value = requestedWarehouseId;
            }
        } catch (cause: any) {
            error.value =
                cause.response?.data?.message ||
                'No se pudieron cargar las sucursales.';
        }
    }
    await load();
});
</script>

<template>
    <Head title="Transacciones" />
    <div class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h1 class="text-2xl font-semibold text-foreground">
                    Transacciones
                </h1>
                <p class="text-sm text-muted-foreground">
                    Órdenes y cotizaciones en un solo historial
                </p>
            </div>
            <div class="flex flex-wrap gap-2">
                <Link
                    v-if="canCreateQuote"
                    href="/quotes/create"
                    class="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                    <Plus :size="16" /> Nueva cotización
                </Link>
            </div>
        </div>

        <div v-if="metrics" class="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <div
                v-for="metric in [
                    {
                        label: 'Transacciones',
                        value: metrics.total_transactions,
                    },
                    { label: 'Órdenes', value: metrics.orders },
                    { label: 'Cotizaciones sin orden', value: metrics.quotes },
                    { label: 'Pendientes', value: metrics.pending },
                    {
                        label: 'Importe en órdenes',
                        value: money(metrics.order_amount),
                    },
                    {
                        label: 'Importe en cotizaciones',
                        value: money(metrics.quote_amount),
                    },
                ]"
                :key="metric.label"
                class="rounded-lg border border-border bg-card px-3 py-2"
            >
                <p class="text-xs text-muted-foreground">{{ metric.label }}</p>
                <p class="text-lg font-semibold tabular-nums">
                    {{ metric.value }}
                </p>
            </div>
        </div>

        <div class="rounded-lg border border-border bg-card">
            <div
                class="flex flex-wrap gap-1 border-b border-border px-3 pt-2"
                aria-label="Tipo de transacción"
            >
                <button
                    v-for="option in [
                        { value: 'all', label: 'Todas' },
                        { value: 'order', label: 'Órdenes' },
                        { value: 'quote', label: 'Cotizaciones' },
                    ] as const"
                    :key="option.value"
                    type="button"
                    class="border-b-2 px-3 py-2 text-sm font-medium"
                    :class="
                        filters.type === option.value
                            ? 'border-emerald-600 text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    "
                    @click="setType(option.value)"
                >
                    {{ option.label }}
                </button>
            </div>
            <form
                class="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6"
                @submit.prevent="applyFilters"
            >
                <label class="relative sm:col-span-2">
                    <Search
                        :size="16"
                        class="pointer-events-none absolute top-2.5 left-3 text-muted-foreground"
                    />
                    <input
                        v-model="filters.search"
                        type="search"
                        placeholder="Folio o cliente"
                        aria-label="Buscar por folio o cliente"
                        class="w-full rounded-md border border-border bg-background py-2 pr-3 pl-9 text-sm"
                    />
                </label>
                <select
                    v-if="role === 'admin' && allowedWarehouses.length > 0"
                    v-model.number="selectedWarehouseId"
                    aria-label="Sucursal"
                    class="rounded-md border border-border bg-background px-2 py-2 text-sm"
                >
                    <option :value="null">Seleccionar sucursal</option>
                    <option
                        v-for="warehouse in allowedWarehouses"
                        :key="warehouse.id"
                        :value="warehouse.id"
                    >
                        {{ warehouse.name }}
                    </option>
                </select>
                <select
                    v-model="filters.status_group"
                    aria-label="Grupo de estados"
                    class="rounded-md border border-border bg-background px-2 py-2 text-sm"
                >
                    <option value="">Todos los grupos</option>
                    <option value="pending">Pendientes</option>
                    <option value="completed">Finalizadas</option>
                    <option value="cancelled">Canceladas</option>
                </select>
                <select
                    v-model="filters.status"
                    aria-label="Estado específico"
                    class="rounded-md border border-border bg-background px-2 py-2 text-sm"
                >
                    <option value="">Cualquier estado</option>
                    <option
                        v-for="option in statuses"
                        :key="option.value"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </option>
                </select>
                <input
                    v-model="filters.date_from"
                    type="date"
                    aria-label="Fecha inicial"
                    class="rounded-md border border-border bg-background px-2 py-2 text-sm"
                />
                <div class="flex gap-2">
                    <input
                        v-model="filters.date_to"
                        type="date"
                        aria-label="Fecha final"
                        class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm"
                    />
                    <button
                        type="submit"
                        class="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-85"
                    >
                        Aplicar
                    </button>
                </div>
            </form>
        </div>

        <p
            v-if="error"
            role="alert"
            class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
            {{ error }}
        </p>

        <div class="overflow-x-auto rounded-lg border border-border bg-card">
            <table class="w-full min-w-[920px] text-sm">
                <thead
                    class="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground"
                >
                    <tr>
                        <th scope="col" class="px-3 py-2">Documento</th>
                        <th scope="col" class="px-3 py-2">Cliente</th>
                        <th scope="col" class="px-3 py-2">Fecha</th>
                        <th scope="col" class="px-3 py-2">Tipo</th>
                        <th scope="col" class="px-3 py-2">Estado</th>
                        <th scope="col" class="px-3 py-2 text-right">Total</th>
                        <th scope="col" class="px-3 py-2 text-right">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-border">
                    <tr v-if="loading">
                        <td
                            colspan="7"
                            class="px-3 py-8 text-center text-muted-foreground"
                        >
                            Cargando transacciones…
                        </td>
                    </tr>
                    <tr v-else-if="rows.length === 0">
                        <td
                            colspan="7"
                            class="px-3 py-8 text-center text-muted-foreground"
                        >
                            No hay transacciones para estos filtros.
                        </td>
                    </tr>
                    <tr
                        v-for="row in loading ? [] : rows"
                        :key="row.key"
                        class="hover:bg-muted/30"
                    >
                        <td class="px-3 py-2">
                            <Link
                                :href="documentUrl(row)"
                                class="font-medium text-primary hover:underline"
                                >{{ row.number }}</Link
                            >
                            <div
                                v-if="row.linked_quote"
                                class="text-xs text-muted-foreground"
                            >
                                De
                                <Link
                                    :href="
                                        '/sales-quotes/' + row.linked_quote.id
                                    "
                                    class="text-primary hover:underline"
                                    >{{ row.linked_quote.number }}</Link
                                >
                                · {{ row.linked_quote.status_label }}
                            </div>
                        </td>
                        <td class="px-3 py-2">
                            {{ row.customer_name || 'Sin cliente' }}
                            <div
                                v-if="row.seller_name"
                                class="text-xs text-muted-foreground"
                            >
                                Vendedor: {{ row.seller_name }}
                            </div>
                        </td>
                        <td class="px-3 py-2 tabular-nums">
                            {{ dateLabel(row.date) }}
                        </td>
                        <td class="px-3 py-2">
                            {{ row.type === 'order' ? 'Orden' : 'Cotización' }}
                        </td>
                        <td class="px-3 py-2">
                            <span
                                class="inline-flex rounded-full px-2 py-1 text-xs font-medium"
                                :class="statusClass(row)"
                                >{{ row.status_label }}</span
                            >
                            <span
                                v-if="row.payment_status"
                                class="ml-1 text-xs text-muted-foreground"
                                >Pago: {{ row.payment_status }}</span
                            >
                        </td>
                        <td
                            class="px-3 py-2 text-right font-semibold tabular-nums"
                        >
                            {{ money(row.total) }}
                            <div
                                v-if="
                                    row.amount_due !== null &&
                                    Number(row.amount_due) > 0
                                "
                                class="text-xs font-normal text-amber-700 dark:text-amber-300"
                            >
                                Saldo: {{ money(row.amount_due) }}
                            </div>
                        </td>
                        <td class="px-3 py-2">
                            <div
                                class="flex items-center justify-end gap-1 whitespace-nowrap"
                            >
                                <Link
                                    :href="documentUrl(row)"
                                    class="rounded p-1.5 text-primary hover:bg-muted"
                                    title="Ver detalle"
                                    :aria-label="'Ver ' + row.number"
                                    ><FileText :size="17"
                                /></Link>
                                <Link
                                    v-if="
                                        row.actions.includes(
                                            'continue_quote',
                                        ) && row.linked_quote
                                    "
                                    :href="
                                        '/sales-quotes/' + row.linked_quote.id
                                    "
                                    class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                                    ><ArrowRight :size="15" /> Continuar</Link
                                >
                                <Link
                                    v-if="row.actions.includes('edit')"
                                    :href="editUrl(row)"
                                    class="rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
                                    title="Editar"
                                    :aria-label="'Editar ' + row.number"
                                    ><Pencil :size="17"
                                /></Link>
                                <button
                                    v-if="
                                        row.actions.includes('send_to_deposit')
                                    "
                                    type="button"
                                    class="rounded px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                                    @click="transition(row, 'send-to-deposit')"
                                >
                                    A depósito
                                </button>
                                <button
                                    v-if="
                                        row.actions.includes('send_to_cashier')
                                    "
                                    type="button"
                                    class="rounded px-2 py-1 text-xs text-sky-700 hover:bg-sky-50"
                                    @click="transition(row, 'send-to-cashier')"
                                >
                                    A Caja
                                </button>
                                <button
                                    v-if="row.actions.includes('convert')"
                                    type="button"
                                    class="rounded px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                                    @click="convert(row)"
                                >
                                    Convertir
                                </button>
                                <Link
                                    v-if="row.actions.includes('return')"
                                    :href="'/returns/orders/' + row.id"
                                    class="rounded p-1.5 text-amber-700 hover:bg-amber-50"
                                    title="Devolución"
                                    :aria-label="'Devolución de ' + row.number"
                                    ><RotateCcw :size="17"
                                /></Link>
                                <Link
                                    v-if="row.actions.includes('cancel')"
                                    :href="
                                        '/sales-orders/' +
                                        row.id +
                                        '?action=cancel'
                                    "
                                    class="rounded p-1.5 text-red-600 hover:bg-red-50"
                                    title="Anulación auditada"
                                    :aria-label="'Anular ' + row.number"
                                    ><XCircle :size="17"
                                /></Link>
                                <button
                                    v-if="row.actions.includes('delete')"
                                    type="button"
                                    class="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                    @click="deleteQuote(row)"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div
            v-if="result && result.total > 0"
            class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
        >
            <span
                >{{ result.total }} transacciones · Página
                {{ result.current_page }} de {{ result.last_page }}</span
            >
            <div class="flex gap-2">
                <button
                    type="button"
                    :disabled="loading || currentPage <= 1"
                    class="rounded border border-border px-3 py-1.5 disabled:opacity-40"
                    @click="load(currentPage - 1)"
                >
                    Anterior
                </button>
                <button
                    type="button"
                    :disabled="loading || currentPage >= result.last_page"
                    class="rounded border border-border px-3 py-1.5 disabled:opacity-40"
                    @click="load(currentPage + 1)"
                >
                    Siguiente
                </button>
            </div>
        </div>
    </div>
</template>
