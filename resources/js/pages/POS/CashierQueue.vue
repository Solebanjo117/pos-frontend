<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    Banknote,
    Clock3,
    Eye,
    Inbox,
    ReceiptText,
    RefreshCw,
    RotateCcw,
    Route,
    ShoppingCart,
    X,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import TransactionTraceDrawer from '@/components/Traceability/TransactionTraceDrawer.vue';
import {
    useCashierQueue,
    type CashierQueueEntry,
} from '@/composables/useCashierQueue';
import { usePOS } from '@/composables/usePOS';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { queueEntryKind, type QueueEntryKind } from '@/utils/cashierQueue';
import {
    formatCurrency,
    formatReportDateTime,
    roundMoney,
} from '@/utils/formatters';

defineOptions({ layout: AppLayout });

const {
    entries,
    count,
    loading,
    error,
    fetchPending,
    startPolling,
    stopPolling,
    timeAgo,
    openEntry,
    completeEntry,
    cancelEntry,
    removeSaleFromQueue,
} = useCashierQueue();
const { loadQuoteAsSession } = usePOS();

const now = ref(Date.now());
const processingId = ref<number | null>(null);
const notice = ref<{ title: string; message: string } | null>(null);
const removeEntry = ref<CashierQueueEntry | null>(null);
const settlementEntry = ref<CashierQueueEntry | null>(null);
const cancellationEntry = ref<CashierQueueEntry | null>(null);
const cancellationReason = ref('');
const traceEntryId = ref<number | null>(null);
const traceOpen = ref(false);

interface QuoteSummary {
    id: number;
    quote_number: string;
    customer_name: string;
    seller_name?: string | null;
    notes?: string | null;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total: number;
    created_at?: string | null;
    items: Array<{
        id: number;
        product_name: string;
        sku?: string | null;
        brand?: string | null;
        quantity: number;
        unit_price: number;
        subtotal: number;
        total: number;
    }>;
}

const summaryEntry = ref<QuoteSummary | null>(null);
const summaryLoading = ref(false);

function saleQueueTimestamp(entry: CashierQueueEntry): number {
    for (const value of [entry.scheduled_for, entry.source.created_at]) {
        if (!value) continue;
        const timestamp = Date.parse(value);
        if (Number.isFinite(timestamp)) return timestamp;
    }

    return 0;
}

// ── Sales split into a table; expenses/returns keep their existing cards ──
const saleEntries = computed(() =>
    entries.value
        .filter((entry) => kindOf(entry) === 'sale')
        .slice()
        .sort(
            (a, b) =>
                saleQueueTimestamp(b) - saleQueueTimestamp(a) || b.id - a.id,
        ),
);
const otherEntries = computed(() =>
    entries.value.filter((entry) => kindOf(entry) !== 'sale'),
);

const settlement = ref({
    final_amount: 0,
    payment_method: 'cash',
    reference_number: '',
    variance_reason: '',
});
const paymentMethods = ref<
    Array<{ code: string; name: string; requires_reference?: boolean }>
>([]);
let clockInterval: ReturnType<typeof setInterval> | null = null;

const kindOf = (entry: CashierQueueEntry | null): QueueEntryKind | null =>
    entry ? queueEntryKind(entry.entry_type) : null;

const typeLabels: Record<QueueEntryKind, string> = {
    sale: 'Venta',
    expense: 'Gasto',
    return: 'Devolucion',
    cashIn: 'Agregar efectivo',
    cashOut: 'Retirar efectivo',
    funding: 'Funding',
};

const typeIcons: Record<QueueEntryKind, typeof ShoppingCart> = {
    sale: ShoppingCart,
    expense: ReceiptText,
    return: RotateCcw,
    cashIn: Banknote,
    cashOut: Banknote,
    funding: Banknote,
};

const labelOf = (entry: CashierQueueEntry): string => {
    const kind = kindOf(entry);
    return kind ? typeLabels[kind] : entry.entry_type;
};

const iconOf = (entry: CashierQueueEntry): typeof ShoppingCart => {
    const kind = kindOf(entry);
    return kind ? typeIcons[kind] : ReceiptText;
};

const actionLabel = (entry: CashierQueueEntry): string => {
    const kind = kindOf(entry);
    if (kind === 'return') return 'Liquidar devolución';
    if (kind === 'expense')
        return entry.fixed_cash_amount ? 'Confirmar gasto' : 'Pagar gasto';
    return 'Confirmar movimiento';
};

const requiresReference = computed(
    () =>
        paymentMethods.value.find(
            (method) => method.code === settlement.value.payment_method,
        )?.requires_reference ?? false,
);

const hasVariance = computed(() => {
    if (!settlementEntry.value || kindOf(settlementEntry.value) !== 'expense')
        return false;
    return (
        roundMoney(settlement.value.final_amount) !==
        roundMoney(settlementEntry.value.estimated_amount)
    );
});

async function loadPaymentMethods(context: 'supplier_payments' | 'returns') {
    try {
        const response = await apiClient.get('/payment-methods', {
            params: { context, real_money: 1 },
        });
        paymentMethods.value = response.data ?? [];
    } catch {
        paymentMethods.value = [
            { code: 'cash', name: 'Efectivo' },
            { code: 'transfer', name: 'Transferencia' },
            { code: 'card', name: 'Tarjeta' },
        ];
    }
}

const isReturnSettlement = computed(
    () => kindOf(settlementEntry.value) === 'return',
);
const isFixedCashSettlement = computed(
    () => settlementEntry.value?.fixed_cash_amount === true,
);
const returnNeedsMoney = computed(
    () =>
        isReturnSettlement.value &&
        Number(settlementEntry.value?.source.money_refund_amount ?? 0) > 0,
);
const settlementTitle = computed(() => {
    if (isReturnSettlement.value) return 'Liquidar devolución';
    if (isFixedCashSettlement.value && settlementEntry.value)
        return labelOf(settlementEntry.value);
    return 'Pagar gasto';
});

onMounted(async () => {
    startPolling(15000);
    clockInterval = setInterval(() => (now.value = Date.now()), 1000);
    await loadPaymentMethods('supplier_payments');
});

onUnmounted(() => {
    stopPolling();
    if (clockInterval) clearInterval(clockInterval);
});

function loadQuoteIntoPos(quote: any): void {
    loadQuoteAsSession({
        id: quote.id,
        quote_number: quote.quote_number,
        customer_id: quote.customer?.id ?? null,
        seller_id: quote.user?.id ?? null,
        notes: quote.notes ?? null,
        items: (quote.items ?? []).map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            variant_id: item.variant_id ?? null,
            warehouse_id: item.warehouse_id ?? null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            tax_percent: item.tax_percent,
            subtotal: item.subtotal,
            tax_amount: item.tax_amount,
            total: item.total,
            is_custom_line: item.is_custom_line ?? false,
            custom_description: item.custom_description ?? null,
            variant: item.variant ?? null,
        })),
    });
    router.visit('/pos');
}

async function processEntry(entry: CashierQueueEntry) {
    processingId.value = entry.id;
    try {
        await openEntry(entry.id);
        if (kindOf(entry) === 'sale') {
            try {
                const response = await apiClient.post(
                    `/sales-quotes/${entry.source.id}/open-at-cashier`,
                );
                loadQuoteIntoPos(response.data.data);
            } catch (exception: any) {
                const data = exception.response?.data;
                if (
                    exception.response?.status === 422 &&
                    data?.requires_session &&
                    data?.data
                ) {
                    loadQuoteIntoPos(data.data);
                } else {
                    throw exception;
                }
            }
            return;
        }

        const kind = kindOf(entry);
        if (!entry.fixed_cash_amount) {
            await loadPaymentMethods(
                kind === 'return' ? 'returns' : 'supplier_payments',
            );
        }
        settlementEntry.value = entry;
        settlement.value = {
            final_amount: roundMoney(
                kind === 'return'
                    ? Number(entry.source.money_refund_amount ?? 0)
                    : entry.estimated_amount,
            ),
            payment_method: entry.fixed_cash_amount
                ? 'cash'
                : (kind === 'return'
                      ? entry.source.refund_method
                      : entry.source.planned_payment_method) ||
                  paymentMethods.value[0]?.code ||
                  '',
            reference_number: entry.source.reference_number || '',
            variance_reason: '',
        };
    } catch (exception: any) {
        notice.value = {
            title: 'No se pudo abrir el registro',
            message:
                exception.response?.data?.message ||
                'El registro ya no esta disponible en Caja.',
        };
    } finally {
        processingId.value = null;
    }
}

async function startCharge(entry: CashierQueueEntry) {
    if (processingId.value !== null) return;
    processingId.value = entry.id;
    try {
        await openEntry(entry.id);
        const response = await apiClient.post(
            `/sales-quotes/${entry.source.id}/open-at-cashier`,
        );
        loadQuoteIntoPos(response.data.data);
    } catch (exception: any) {
        const data = exception.response?.data;
        if (
            exception.response?.status === 422 &&
            data?.requires_session &&
            data?.data
        ) {
            // No open register: fall back to the POS so the cashier can open Caja.
            loadQuoteIntoPos(data.data);
            return;
        }
        notice.value = {
            title: 'No se pudo abrir la venta',
            message:
                data?.message || 'El registro ya no esta disponible en Caja.',
        };
    } finally {
        processingId.value = null;
    }
}

async function viewOrder(entry: CashierQueueEntry) {
    if (summaryLoading.value) return;

    summaryLoading.value = true;
    summaryEntry.value = null;
    try {
        const response = await apiClient.get(
            `/sales-quotes/${entry.source.id}/summary`,
        );
        summaryEntry.value = response.data.data;
    } catch (exception: any) {
        notice.value = {
            title: 'No se pudo cargar el pedido',
            message:
                exception.response?.data?.message ||
                'Intenta nuevamente en unos segundos.',
        };
    } finally {
        summaryLoading.value = false;
    }
}

async function settleExpense() {
    if (!settlementEntry.value) return;
    if (
        !isFixedCashSettlement.value &&
        hasVariance.value &&
        !settlement.value.variance_reason.trim()
    ) {
        notice.value = {
            title: 'Motivo requerido',
            message:
                'Explique la diferencia entre el monto estimado y el monto final.',
        };
        return;
    }
    if (
        !isFixedCashSettlement.value &&
        returnNeedsMoney.value &&
        !settlement.value.payment_method
    ) {
        notice.value = {
            title: 'Metodo requerido',
            message:
                'Seleccione el metodo que Caja utilizara para el reembolso.',
        };
        return;
    }
    if (
        !isFixedCashSettlement.value &&
        requiresReference.value &&
        (!isReturnSettlement.value || returnNeedsMoney.value) &&
        !settlement.value.reference_number.trim()
    ) {
        notice.value = {
            title: 'Referencia requerida',
            message: 'Este metodo de pago requiere una referencia.',
        };
        return;
    }

    processingId.value = settlementEntry.value.id;
    try {
        const wasReturn = isReturnSettlement.value;
        const wasFixedCash = isFixedCashSettlement.value;
        const fixedKind = kindOf(settlementEntry.value);
        const payload = wasFixedCash
            ? {}
            : wasReturn && !returnNeedsMoney.value
              ? {
                    reference_number: settlement.value.reference_number || null,
                    variance_reason: null,
                }
              : settlement.value;
        await completeEntry(settlementEntry.value.id, payload);
        settlementEntry.value = null;
        notice.value = wasFixedCash
            ? {
                  title: 'Movimiento confirmado',
                  message:
                      fixedKind === 'funding'
                          ? 'El efectivo y la aportación de capital quedaron vinculados.'
                          : 'El movimiento de efectivo quedó registrado en la sesión.',
              }
            : wasReturn
              ? {
                    title: 'Devolucion liquidada',
                    message:
                        'La nota de credito y su resolucion financiera quedaron registradas.',
                }
              : {
                    title: 'Gasto pagado',
                    message:
                        'El pago, el movimiento y su asiento quedaron registrados.',
                };
    } catch (exception: any) {
        notice.value = {
            title: 'No se pudo completar',
            message:
                exception.response?.data?.message ||
                'Revise el monto, el metodo y la sesion de Caja.',
        };
    } finally {
        processingId.value = null;
    }
}

async function cancelCashRequest(): Promise<void> {
    if (
        !cancellationEntry.value ||
        !cancellationReason.value.trim() ||
        processingId.value !== null
    )
        return;
    processingId.value = cancellationEntry.value.id;
    try {
        await cancelEntry(
            cancellationEntry.value.id,
            cancellationReason.value.trim(),
        );
        cancellationEntry.value = null;
        cancellationReason.value = '';
        notice.value = {
            title: 'Solicitud cancelada',
            message: 'No se registró ningún movimiento de efectivo.',
        };
    } catch (exception: any) {
        notice.value = {
            title: 'No se pudo cancelar',
            message:
                exception.response?.data?.message ||
                'La solicitud permanece en la cola.',
        };
    } finally {
        processingId.value = null;
    }
}

async function confirmRemove() {
    if (!removeEntry.value || processingId.value !== null) return;
    const entry = removeEntry.value;
    processingId.value = entry.id;
    try {
        await removeSaleFromQueue(entry.source.id);
        removeEntry.value = null;
        notice.value = {
            title: 'Cotizacion quitada de la cola',
            message:
                'La cotizacion sigue disponible y podra enviarse a Caja nuevamente.',
        };
    } catch (exception: any) {
        notice.value = {
            title: 'No se pudo remover',
            message:
                exception.response?.data?.message ||
                'La venta permanece en la cola.',
        };
    } finally {
        processingId.value = null;
    }
}
</script>

<template>
    <Head title="Cola de Caja" />

    <div class="space-y-5">
        <header class="flex items-center justify-between gap-4">
            <div>
                <h1
                    class="flex items-center gap-2 text-2xl font-bold text-foreground"
                >
                    <Inbox class="h-6 w-6 text-sky-600" />
                    Cola de Caja
                    <span
                        v-if="count"
                        class="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800"
                    >
                        {{ count }}
                    </span>
                </h1>
                <p class="mt-1 text-sm text-muted-foreground">
                    Ventas por cobrar, gastos por pagar y reembolsos pendientes.
                </p>
            </div>
            <button
                type="button"
                class="rounded-md border p-2 text-muted-foreground hover:bg-muted"
                title="Actualizar"
                @click="fetchPending"
            >
                <RefreshCw
                    class="h-4 w-4"
                    :class="{ 'animate-spin': loading }"
                />
            </button>
        </header>

        <div
            v-if="loading && !entries.length"
            class="py-14 text-center text-sm text-muted-foreground"
        >
            Cargando cola...
        </div>
        <div
            v-else-if="error"
            class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
            {{ error }}
        </div>
        <div
            v-else-if="!entries.length"
            class="rounded-md border bg-card py-14 text-center"
        >
            <Inbox class="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p class="font-medium">No hay movimientos pendientes</p>
            <p class="mt-1 text-sm text-muted-foreground">
                Los registros enviados a Caja apareceran aqui.
            </p>
        </div>

        <template v-else>
            <!-- Ventas: tabla compacta de Caja -->
            <div
                v-if="saleEntries.length"
                data-test="sales-queue-table"
                class="overflow-hidden rounded-md border bg-card"
            >
                <div class="hidden overflow-x-auto md:block">
                    <table class="w-full text-sm">
                        <thead
                            class="border-b bg-muted/40 text-xs text-muted-foreground"
                        >
                            <tr>
                                <th class="px-4 py-2 text-left font-medium">
                                    Fecha / Hora
                                </th>
                                <th class="px-4 py-2 text-left font-medium">
                                    N.º factura
                                </th>
                                <th class="px-4 py-2 text-left font-medium">
                                    Cliente
                                </th>
                                <th class="px-4 py-2 text-right font-medium">
                                    Monto
                                </th>
                                <th class="px-4 py-2 text-left font-medium">
                                    Vendedor
                                </th>
                                <th class="px-4 py-2 text-left font-medium">
                                    Tiempo
                                </th>
                                <th class="px-4 py-2 text-right font-medium">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="entry in saleEntries"
                                :key="entry.id"
                                data-test="sales-queue-row"
                                class="border-b last:border-0 hover:bg-muted/20"
                            >
                                <td
                                    class="px-4 py-2 whitespace-nowrap text-muted-foreground"
                                >
                                    {{
                                        formatReportDateTime(
                                            entry.source.created_at ??
                                                entry.scheduled_for,
                                        )
                                    }}
                                </td>
                                <td class="px-4 py-2 font-medium">
                                    {{ entry.source.document_number }}
                                </td>
                                <td class="px-4 py-2">
                                    {{ entry.source.party }}
                                </td>
                                <td
                                    class="px-4 py-2 text-right font-mono font-semibold"
                                >
                                    {{ formatCurrency(entry.estimated_amount) }}
                                </td>
                                <td class="px-4 py-2 text-muted-foreground">
                                    {{ entry.source.seller_name || '—' }}
                                </td>
                                <td class="px-4 py-2">
                                    <span
                                        class="flex items-center gap-1 text-xs font-semibold text-amber-600 tabular-nums"
                                    >
                                        <Clock3 class="h-3.5 w-3.5" />
                                        {{ timeAgo(entry.scheduled_for, now) }}
                                    </span>
                                </td>
                                <td class="px-4 py-2 text-right">
                                    <div
                                        data-test="sale-actions"
                                        class="flex items-center justify-end gap-1"
                                    >
                                        <button
                                            type="button"
                                            class="rounded-md border p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                                            :disabled="summaryLoading"
                                            title="Ver pedido"
                                            aria-label="Ver pedido"
                                            @click="viewOrder(entry)"
                                        >
                                            <Eye class="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            class="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            :disabled="processingId !== null"
                                            title="Cobrar"
                                            @click="startCharge(entry)"
                                        >
                                            <span
                                                v-if="processingId === entry.id"
                                                class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                                            />
                                            <Banknote v-else class="h-4 w-4" />
                                            {{
                                                processingId === entry.id
                                                    ? 'Abriendo...'
                                                    : 'Cobrar'
                                            }}
                                        </button>
                                        <button
                                            type="button"
                                            class="rounded-md border p-1 text-muted-foreground transition hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/30"
                                            title="Rastrear"
                                            aria-label="Rastrear"
                                            @click="
                                                traceEntryId = entry.id;
                                                traceOpen = true;
                                            "
                                        >
                                            <Route class="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            class="rounded-md border p-1 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                            :disabled="processingId !== null"
                                            title="Quitar de cola"
                                            aria-label="Quitar de cola"
                                            @click="removeEntry = entry"
                                        >
                                            <X class="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="divide-y md:hidden">
                    <article
                        v-for="entry in saleEntries"
                        :key="entry.id"
                        data-test="sales-queue-mobile-row"
                        class="space-y-3 p-4"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-semibold">
                                    {{ entry.source.document_number }}
                                </p>
                                <p
                                    class="truncate text-sm text-muted-foreground"
                                >
                                    {{ entry.source.party }}
                                </p>
                            </div>
                            <strong class="shrink-0 font-mono text-sm">
                                {{ formatCurrency(entry.estimated_amount) }}
                            </strong>
                        </div>
                        <div
                            class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
                        >
                            <span>{{ entry.source.seller_name || '—' }}</span>
                            <span
                                class="flex items-center gap-1 text-amber-600"
                            >
                                <Clock3 class="h-3.5 w-3.5" />
                                {{ timeAgo(entry.scheduled_for, now) }}
                            </span>
                            <span class="basis-full">
                                {{
                                    formatReportDateTime(
                                        entry.source.created_at ??
                                            entry.scheduled_for,
                                    )
                                }}
                            </span>
                        </div>
                        <div
                            data-test="sale-mobile-actions"
                            class="grid grid-cols-4 gap-2"
                        >
                            <button
                                type="button"
                                class="flex min-w-0 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs text-muted-foreground"
                                :disabled="summaryLoading"
                                title="Ver pedido"
                                @click="viewOrder(entry)"
                            >
                                <Eye class="h-4 w-4" />
                                <span>Ver</span>
                            </button>
                            <button
                                type="button"
                                class="flex min-w-0 flex-col items-center gap-1 rounded-md bg-sky-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                :disabled="processingId !== null"
                                title="Cobrar"
                                @click="startCharge(entry)"
                            >
                                <span
                                    v-if="processingId === entry.id"
                                    class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                                />
                                <Banknote v-else class="h-4 w-4" />
                                <span>Cobrar</span>
                            </button>
                            <button
                                type="button"
                                class="flex min-w-0 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs text-muted-foreground"
                                title="Rastrear"
                                @click="
                                    traceEntryId = entry.id;
                                    traceOpen = true;
                                "
                            >
                                <Route class="h-4 w-4" />
                                <span>Rastrear</span>
                            </button>
                            <button
                                type="button"
                                class="flex min-w-0 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs text-muted-foreground disabled:opacity-50"
                                :disabled="processingId !== null"
                                title="Quitar de cola"
                                @click="removeEntry = entry"
                            >
                                <X class="h-4 w-4" />
                                <span>Quitar</span>
                            </button>
                        </div>
                    </article>
                </div>
            </div>

            <!-- Gastos y devoluciones: tarjetas (sin cambios funcionales) -->
            <div
                v-if="otherEntries.length"
                class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
                <article
                    v-for="entry in otherEntries"
                    :key="entry.id"
                    class="flex min-h-60 flex-col rounded-md border bg-card"
                >
                    <div
                        class="flex items-start justify-between border-b px-4 py-3"
                    >
                        <div class="flex min-w-0 items-center gap-2">
                            <component
                                :is="iconOf(entry)"
                                class="h-4 w-4 shrink-0 text-sky-600"
                            />
                            <div class="min-w-0">
                                <p class="truncate text-sm font-semibold">
                                    {{ entry.source.document_number }}
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    {{ labelOf(entry) }}
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span
                                class="flex items-center gap-1 text-xs text-amber-600"
                            >
                                <Clock3 class="h-3.5 w-3.5" />
                                {{ timeAgo(entry.scheduled_for, now) }}
                            </span>
                            <button
                                type="button"
                                class="rounded p-1 text-muted-foreground hover:bg-sky-50 hover:text-sky-700"
                                title="Ver trazabilidad"
                                @click="
                                    traceEntryId = entry.id;
                                    traceOpen = true;
                                "
                            >
                                <Route class="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div class="flex-1 space-y-3 px-4 py-3 text-sm">
                        <div>
                            <p class="text-xs text-muted-foreground">
                                {{
                                    entry.source.requested_by
                                        ? 'Solicitado por'
                                        : 'Cliente / beneficiario'
                                }}
                            </p>
                            <p class="font-medium">
                                {{
                                    entry.source.requested_by?.name ??
                                    entry.source.party
                                }}
                            </p>
                        </div>
                        <div>
                            <p class="text-xs text-muted-foreground">
                                Concepto
                            </p>
                            <p>{{ entry.source.description }}</p>
                        </div>
                        <div v-if="entry.source.category">
                            <p class="text-xs text-muted-foreground">
                                Categoría
                            </p>
                            <p>{{ entry.source.category }}</p>
                        </div>
                        <div v-if="entry.source.notes">
                            <p class="text-xs text-muted-foreground">Notas</p>
                            <p class="line-clamp-2">{{ entry.source.notes }}</p>
                        </div>
                        <div
                            class="flex items-end justify-between border-t pt-3"
                        >
                            <span class="text-xs text-muted-foreground"
                                >Monto estimado</span
                            >
                            <strong class="font-mono text-lg">{{
                                formatCurrency(entry.estimated_amount)
                            }}</strong>
                        </div>
                    </div>

                    <div class="flex gap-2 border-t bg-muted/30 px-4 py-3">
                        <button
                            v-if="entry.can_cancel"
                            type="button"
                            class="rounded-md border px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                            @click="cancellationEntry = entry"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            class="flex flex-1 items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                            :disabled="processingId === entry.id"
                            @click="processEntry(entry)"
                        >
                            <component :is="iconOf(entry)" class="h-4 w-4" />
                            {{ actionLabel(entry) }}
                        </button>
                    </div>
                </article>
            </div>
        </template>
    </div>

    <TransactionTraceDrawer
        :open="traceOpen"
        type="cashier_queue_entry"
        :id="traceEntryId"
        @close="traceOpen = false"
    />

    <div
        v-if="settlementEntry"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
        <form
            class="w-full max-w-lg rounded-md border bg-card shadow-xl"
            @submit.prevent="settleExpense"
        >
            <div class="border-b px-5 py-4">
                <h2 class="font-semibold">
                    {{ settlementTitle }}
                    {{ settlementEntry.source.document_number }}
                </h2>
                <p class="mt-1 text-sm text-muted-foreground">
                    {{
                        isReturnSettlement ? 'Resolucion aprobada' : 'Estimado'
                    }}: {{ formatCurrency(settlementEntry.estimated_amount) }}
                </p>
            </div>
            <div class="grid gap-4 px-5 py-4 sm:grid-cols-2">
                <div
                    v-if="isFixedCashSettlement"
                    class="space-y-3 sm:col-span-2"
                >
                    <div
                        class="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2"
                    >
                        <div>
                            <span class="block text-xs text-muted-foreground"
                                >Tipo</span
                            ><strong>{{ labelOf(settlementEntry) }}</strong>
                        </div>
                        <div>
                            <span class="block text-xs text-muted-foreground"
                                >Método</span
                            ><strong>Efectivo</strong>
                        </div>
                        <div v-if="settlementEntry.source.category">
                            <span class="block text-xs text-muted-foreground"
                                >Categoría</span
                            ><strong>{{
                                settlementEntry.source.category
                            }}</strong>
                        </div>
                        <div>
                            <span class="block text-xs text-muted-foreground"
                                >Monto fijo</span
                            ><strong>{{
                                formatCurrency(settlementEntry.estimated_amount)
                            }}</strong>
                        </div>
                    </div>
                    <p class="text-sm text-muted-foreground">
                        El monto no puede cambiarse. Para corregirlo, cancela
                        esta solicitud y crea otra.
                    </p>
                </div>
                <div
                    v-if="isReturnSettlement"
                    class="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:col-span-2 sm:grid-cols-3"
                >
                    <div>
                        <span class="block text-xs text-muted-foreground"
                            >Reembolso</span
                        ><strong>{{
                            formatCurrency(
                                settlementEntry.source.money_refund_amount,
                            )
                        }}</strong>
                    </div>
                    <div>
                        <span class="block text-xs text-muted-foreground"
                            >Reducir CxC</span
                        ><strong>{{
                            formatCurrency(
                                settlementEntry.source
                                    .receivable_applied_amount,
                            )
                        }}</strong>
                    </div>
                    <div>
                        <span class="block text-xs text-muted-foreground"
                            >Saldo a favor</span
                        ><strong>{{
                            formatCurrency(
                                settlementEntry.source.store_credit_amount,
                            )
                        }}</strong>
                    </div>
                </div>
                <label
                    v-if="!isReturnSettlement && !isFixedCashSettlement"
                    class="space-y-1 text-sm"
                >
                    <span>Monto final</span>
                    <input
                        v-model.number="settlement.final_amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        class="w-full rounded-md border bg-background px-3 py-2"
                    />
                </label>
                <label
                    v-if="
                        !isFixedCashSettlement &&
                        (!isReturnSettlement || returnNeedsMoney)
                    "
                    class="space-y-1 text-sm"
                >
                    <span>Metodo de pago</span>
                    <select
                        v-model="settlement.payment_method"
                        :required="returnNeedsMoney || !isReturnSettlement"
                        class="w-full rounded-md border bg-background px-3 py-2"
                    >
                        <option
                            v-for="method in paymentMethods"
                            :key="method.code"
                            :value="method.code"
                        >
                            {{ method.name }}
                        </option>
                    </select>
                </label>
                <label
                    v-if="
                        !isFixedCashSettlement &&
                        (!isReturnSettlement || returnNeedsMoney)
                    "
                    class="space-y-1 text-sm sm:col-span-2"
                >
                    <span>Referencia{{ requiresReference ? ' *' : '' }}</span>
                    <input
                        v-model="settlement.reference_number"
                        type="text"
                        class="w-full rounded-md border bg-background px-3 py-2"
                    />
                </label>
                <label
                    v-if="hasVariance"
                    class="space-y-1 text-sm sm:col-span-2"
                >
                    <span>Motivo de diferencia *</span>
                    <textarea
                        v-model="settlement.variance_reason"
                        rows="2"
                        required
                        class="w-full rounded-md border bg-background px-3 py-2"
                    />
                </label>
            </div>
            <div class="flex justify-end gap-2 border-t px-5 py-4">
                <button
                    v-if="isFixedCashSettlement"
                    type="button"
                    class="mr-auto rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 dark:text-red-300"
                    @click="
                        cancellationEntry = settlementEntry;
                        settlementEntry = null;
                    "
                >
                    Cancelar solicitud
                </button>
                <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-sm"
                    @click="settlementEntry = null"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    class="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
                    :disabled="processingId === settlementEntry.id"
                >
                    {{
                        isFixedCashSettlement
                            ? 'Confirmar movimiento'
                            : isReturnSettlement
                              ? 'Confirmar liquidacion'
                              : 'Confirmar pago'
                    }}
                </button>
            </div>
        </form>
    </div>

    <div
        v-if="cancellationEntry"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
        <form
            class="w-full max-w-md rounded-md border bg-card shadow-xl"
            @submit.prevent="cancelCashRequest"
        >
            <div class="border-b px-5 py-4">
                <h2 class="font-semibold">Cancelar solicitud</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                    No se registrará ningún movimiento de efectivo. Para
                    corregir el monto, crea otra solicitud.
                </p>
            </div>
            <label class="block space-y-1 px-5 py-4 text-sm">
                <span>Motivo *</span>
                <textarea
                    v-model="cancellationReason"
                    rows="3"
                    maxlength="500"
                    required
                    class="w-full rounded-md border bg-background px-3 py-2"
                />
            </label>
            <div class="flex justify-end gap-2 border-t px-5 py-4">
                <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-sm"
                    @click="
                        cancellationEntry = null;
                        cancellationReason = '';
                    "
                >
                    Volver
                </button>
                <button
                    type="submit"
                    :disabled="
                        !cancellationReason.trim() || processingId !== null
                    "
                    class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                    Cancelar solicitud
                </button>
            </div>
        </form>
    </div>

    <div
        v-if="removeEntry"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
        <div class="w-full max-w-md rounded-md border bg-card shadow-xl">
            <div class="border-b px-5 py-4">
                <h2 class="font-semibold">Quitar de cola</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                    La cotizacion no sera eliminada y podra enviarse nuevamente
                    a Caja mas adelante.
                </p>
            </div>
            <div class="px-5 py-4 text-sm">
                {{ removeEntry.source.document_number }}
            </div>
            <div class="flex justify-end gap-2 border-t px-5 py-4">
                <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-sm"
                    data-test="cancel-remove"
                    @click="removeEntry = null"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                    data-test="confirm-remove"
                    :disabled="processingId !== null"
                    @click="confirmRemove"
                >
                    Quitar de cola
                </button>
            </div>
        </div>
    </div>

    <!-- Resumen del pedido (solo lectura) -->
    <div
        v-if="summaryEntry || summaryLoading"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-order-summary-title"
    >
        <div
            class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-md border bg-card shadow-xl"
        >
            <div class="flex items-start justify-between border-b px-5 py-4">
                <div>
                    <h2 id="queue-order-summary-title" class="font-semibold">
                        Pedido {{ summaryEntry?.quote_number ?? '' }}
                    </h2>
                    <p
                        v-if="summaryEntry"
                        class="mt-1 text-sm text-muted-foreground"
                    >
                        {{ summaryEntry.customer_name }}
                        <span v-if="summaryEntry.seller_name">
                            · Vendedor: {{ summaryEntry.seller_name }}</span
                        >
                    </p>
                </div>
                <button
                    type="button"
                    class="rounded p-1 text-muted-foreground hover:bg-muted"
                    title="Cerrar resumen"
                    aria-label="Cerrar resumen"
                    @click="summaryEntry = null"
                >
                    <X class="h-4 w-4" />
                </button>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-4">
                <div
                    v-if="summaryLoading"
                    class="py-10 text-center text-sm text-muted-foreground"
                >
                    Cargando pedido...
                </div>
                <div v-else-if="summaryEntry" class="space-y-3">
                    <article
                        v-for="item in summaryEntry.items"
                        :key="item.id"
                        class="grid grid-cols-[1fr_auto] gap-3 border-b pb-3 text-sm last:border-0"
                    >
                        <div class="min-w-0">
                            <p class="font-medium">{{ item.product_name }}</p>
                            <p class="text-xs text-muted-foreground">
                                SKU: {{ item.sku || '—' }}
                                <span v-if="item.brand">
                                    · {{ item.brand }}</span
                                >
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ item.quantity }} ×
                                {{ formatCurrency(item.unit_price) }}
                            </p>
                        </div>
                        <strong class="font-mono text-sm">
                            {{ formatCurrency(item.subtotal) }}
                        </strong>
                    </article>
                </div>
            </div>
            <div
                v-if="summaryEntry"
                class="space-y-1 border-t px-5 py-4 text-sm"
            >
                <div class="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span class="font-mono">{{
                        formatCurrency(summaryEntry.subtotal)
                    }}</span>
                </div>
                <div
                    v-if="summaryEntry.discount_amount > 0"
                    class="flex justify-between text-muted-foreground"
                >
                    <span>Descuento</span>
                    <span class="font-mono"
                        >-{{
                            formatCurrency(summaryEntry.discount_amount)
                        }}</span
                    >
                </div>
                <div class="flex justify-between text-muted-foreground">
                    <span>ITBMS</span>
                    <span class="font-mono">{{
                        formatCurrency(summaryEntry.tax_amount)
                    }}</span>
                </div>
                <div class="flex justify-between pt-1 text-base font-bold">
                    <span>Total</span>
                    <span class="font-mono">{{
                        formatCurrency(summaryEntry.total)
                    }}</span>
                </div>
            </div>
        </div>
    </div>

    <div
        v-if="notice"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
    >
        <div class="w-full max-w-md rounded-md border bg-card shadow-xl">
            <div class="px-5 py-4">
                <h2 class="font-semibold">{{ notice.title }}</h2>
                <p class="mt-2 text-sm text-muted-foreground">
                    {{ notice.message }}
                </p>
            </div>
            <div class="flex justify-end border-t px-5 py-4">
                <button
                    type="button"
                    class="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
                    @click="notice = null"
                >
                    Entendido
                </button>
            </div>
        </div>
    </div>
</template>
