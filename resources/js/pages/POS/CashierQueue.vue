<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    Banknote,
    Clock3,
    Inbox,
    ReceiptText,
    RefreshCw,
    RotateCcw,
    Route,
    ShoppingCart,
    X,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
    useCashierQueue,
    type CashierQueueEntry,
} from '@/composables/useCashierQueue';
import { usePOS } from '@/composables/usePOS';
import AppLayout from '@/layouts/AppLayout.vue';
import TransactionTraceDrawer from '@/components/Traceability/TransactionTraceDrawer.vue';
import apiClient from '@/services/api/client';
import { formatCurrency, roundMoney } from '@/utils/formatters';

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
    removeSaleFromQueue,
} = useCashierQueue();
const { loadQuoteAsSession } = usePOS();

const now = ref(Date.now());
const processingId = ref<number | null>(null);
const notice = ref<{ title: string; message: string } | null>(null);
const removeEntry = ref<CashierQueueEntry | null>(null);
const settlementEntry = ref<CashierQueueEntry | null>(null);
const traceEntryId = ref<number | null>(null);
const traceOpen = ref(false);
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

const typeLabels: Record<CashierQueueEntry['entry_type'], string> = {
    sale: 'Venta',
    expense: 'Gasto',
    return: 'Devolucion',
};

const typeIcons = {
    sale: ShoppingCart,
    expense: ReceiptText,
    return: RotateCcw,
};

const requiresReference = computed(
    () =>
        paymentMethods.value.find(
            (method) => method.code === settlement.value.payment_method,
        )?.requires_reference ?? false,
);

const hasVariance = computed(() => {
    if (
        !settlementEntry.value ||
        settlementEntry.value.entry_type !== 'expense'
    )
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
    () => settlementEntry.value?.entry_type === 'return',
);
const returnNeedsMoney = computed(
    () =>
        isReturnSettlement.value &&
        Number(settlementEntry.value?.source.money_refund_amount ?? 0) > 0,
);
const settlementTitle = computed(() =>
    isReturnSettlement.value ? 'Liquidar devolucion' : 'Pagar gasto',
);

onMounted(async () => {
    startPolling(15000);
    clockInterval = setInterval(() => (now.value = Date.now()), 1000);
    await loadPaymentMethods('supplier_payments');
});

onUnmounted(() => {
    stopPolling();
    if (clockInterval) clearInterval(clockInterval);
});

async function processEntry(entry: CashierQueueEntry) {
    processingId.value = entry.id;
    try {
        await openEntry(entry.id);
        if (entry.entry_type === 'sale') {
            const response = await apiClient.post(
                `/sales-quotes/${entry.source.id}/open-at-cashier`,
            );
            const quote = response.data.data;
            loadQuoteAsSession({
                id: quote.id,
                quote_number: quote.quote_number,
                customer_id: quote.customer?.id ?? null,
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
                    variant: item.variant ?? null,
                })),
            });
            router.visit('/pos');
            return;
        }

        await loadPaymentMethods(
            entry.entry_type === 'return' ? 'returns' : 'supplier_payments',
        );
        settlementEntry.value = entry;
        settlement.value = {
            final_amount: roundMoney(
                entry.entry_type === 'return'
                    ? Number(entry.source.money_refund_amount ?? 0)
                    : entry.estimated_amount,
            ),
            payment_method:
                (entry.entry_type === 'return'
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

async function settleExpense() {
    if (!settlementEntry.value) return;
    if (hasVariance.value && !settlement.value.variance_reason.trim()) {
        notice.value = {
            title: 'Motivo requerido',
            message:
                'Explique la diferencia entre el monto estimado y el monto final.',
        };
        return;
    }
    if (returnNeedsMoney.value && !settlement.value.payment_method) {
        notice.value = {
            title: 'Metodo requerido',
            message:
                'Seleccione el metodo que Caja utilizara para el reembolso.',
        };
        return;
    }
    if (
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
        const payload =
            wasReturn && !returnNeedsMoney.value
                ? {
                      reference_number:
                          settlement.value.reference_number || null,
                      variance_reason: null,
                  }
                : settlement.value;
        await completeEntry(settlementEntry.value.id, payload);
        settlementEntry.value = null;
        notice.value = wasReturn
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

async function confirmRemove() {
    if (!removeEntry.value) return;
    const entry = removeEntry.value;
    removeEntry.value = null;
    processingId.value = entry.id;
    try {
        await removeSaleFromQueue(entry.source.id);
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

        <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article
                v-for="entry in entries"
                :key="entry.id"
                class="flex min-h-60 flex-col rounded-md border bg-card"
            >
                <div
                    class="flex items-start justify-between border-b px-4 py-3"
                >
                    <div class="flex min-w-0 items-center gap-2">
                        <component
                            :is="typeIcons[entry.entry_type]"
                            class="h-4 w-4 shrink-0 text-sky-600"
                        />
                        <div class="min-w-0">
                            <p class="truncate text-sm font-semibold">
                                {{ entry.source.document_number }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                {{ typeLabels[entry.entry_type] }}
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
                        <button
                            v-if="entry.entry_type === 'sale'"
                            type="button"
                            class="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title="Remover de cola"
                            @click="removeEntry = entry"
                        >
                            <X class="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div class="flex-1 space-y-3 px-4 py-3 text-sm">
                    <div>
                        <p class="text-xs text-muted-foreground">
                            Cliente / beneficiario
                        </p>
                        <p class="font-medium">{{ entry.source.party }}</p>
                    </div>
                    <div>
                        <p class="text-xs text-muted-foreground">Concepto</p>
                        <p>{{ entry.source.description }}</p>
                    </div>
                    <div class="flex items-end justify-between border-t pt-3">
                        <span class="text-xs text-muted-foreground"
                            >Monto estimado</span
                        >
                        <strong class="font-mono text-lg">{{
                            formatCurrency(entry.estimated_amount)
                        }}</strong>
                    </div>
                </div>

                <div class="border-t bg-muted/30 px-4 py-3">
                    <button
                        type="button"
                        class="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                        :disabled="processingId === entry.id"
                        @click="processEntry(entry)"
                    >
                        <Banknote class="h-4 w-4" />
                        {{
                            entry.entry_type === 'sale'
                                ? 'Abrir y cobrar'
                                : entry.entry_type === 'return'
                                  ? 'Liquidar devolucion'
                                  : 'Pagar gasto'
                        }}
                    </button>
                </div>
            </article>
        </div>
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
                <label v-if="!isReturnSettlement" class="space-y-1 text-sm">
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
                    v-if="!isReturnSettlement || returnNeedsMoney"
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
                    v-if="!isReturnSettlement || returnNeedsMoney"
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
                        isReturnSettlement
                            ? 'Confirmar liquidacion'
                            : 'Confirmar pago'
                    }}
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
                <h2 class="font-semibold">Remover de la cola</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                    La cotizacion no se eliminara.
                </p>
            </div>
            <div class="px-5 py-4 text-sm">
                {{ removeEntry.source.document_number }}
            </div>
            <div class="flex justify-end gap-2 border-t px-5 py-4">
                <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-sm"
                    @click="removeEntry = null"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                    @click="confirmRemove"
                >
                    Remover
                </button>
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
