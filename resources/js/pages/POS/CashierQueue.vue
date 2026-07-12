<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { Inbox, Clock, ShoppingCart, User, Package, X } from 'lucide-vue-next';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
    useCashierQueue,
    type PendingQuote,
} from '@/composables/useCashierQueue';
import { usePOS } from '@/composables/usePOS';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';

defineOptions({ layout: AppLayout });

const {
    quotes,
    count,
    loading,
    error,
    timeAgo,
    startPolling,
    stopPolling,
    removeFromQueue,
} = useCashierQueue();
const { loadQuoteAsSession } = usePOS();

// Reactive clock: ticks every second so timeAgo re-renders
const now = ref(Date.now());
let clockInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
    startPolling(15000); // page polling: 15 seconds
    clockInterval = setInterval(() => {
        now.value = Date.now();
    }, 1000);
});

onUnmounted(() => {
    stopPolling();
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
});

// Process payment: use exactly the same pattern as openQuoteInPOS in SalesQuotes/Index.vue
const processingId = ref<number | null>(null);
const queueNotice = ref<{ title: string; message: string } | null>(null);
const quoteToRemove = ref<PendingQuote | null>(null);

const processPayment = async (quote: PendingQuote) => {
    processingId.value = quote.id;
    try {
        const res = await apiClient.post(
            `/sales-quotes/${quote.id}/open-at-cashier`,
        );
        const q = res.data.data;
        loadQuoteAsSession({
            id: q.id,
            quote_number: q.quote_number,
            customer_id: q.customer?.id ?? null,
            items: (q.items ?? []).map((item: any) => ({
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
    } catch (e: any) {
        queueNotice.value = {
            title: 'No se pudo abrir en POS',
            message:
                e.response?.data?.message ||
                'Error al cargar la cotizacion en POS',
        };
    } finally {
        processingId.value = null;
    }
};

const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return (
        '$' +
        num.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
};

const removingId = ref<number | null>(null);

const handleRemoveFromQueue = async (quote: PendingQuote) => {
    quoteToRemove.value = quote;
};

const confirmRemoveFromQueue = async () => {
    if (!quoteToRemove.value) return;

    const quote = quoteToRemove.value;
    quoteToRemove.value = null;
    removingId.value = quote.id;
    try {
        const success = await removeFromQueue(quote.id);
        if (!success) {
            queueNotice.value = {
                title: 'No se pudo remover',
                message: 'Error al remover la cotizacion de la cola',
            };
        }
    } catch (e: any) {
        queueNotice.value = {
            title: 'No se pudo remover',
            message: e.response?.data?.message || 'Error al remover de la cola',
        };
    } finally {
        removingId.value = null;
    }
};

const summarizedProducts = (items: PendingQuote['items']) => {
    const maxShow = 3;
    const shown = items.slice(0, maxShow);
    const extra = items.length - maxShow;
    return { shown, extra: extra > 0 ? extra : 0 };
};
</script>

<template>
    <Head title="Cola de Caja" />

    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div>
                <h1
                    class="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white"
                >
                    <Inbox class="h-8 w-8 text-sky-600 dark:text-sky-400" />
                    Cotizaciones en Caja
                    <span
                        v-if="count > 0"
                        class="inline-flex items-center justify-center rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-bold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                    >
                        {{ count }}
                    </span>
                </h1>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Cotizaciones enviadas por vendedores listas para cobrar
                </p>
            </div>
        </div>

        <!-- Loading -->
        <div
            v-if="loading && quotes.length === 0"
            class="py-16 text-center text-gray-500"
        >
            <div
                class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"
            ></div>
            Cargando cotizaciones pendientes...
        </div>

        <!-- Error -->
        <div
            v-else-if="error"
            class="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-900/20"
        >
            <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            <button
                @click="startPolling(15000)"
                class="mt-3 text-sm text-red-700 underline dark:text-red-300"
            >
                Reintentar
            </button>
        </div>

        <!-- Empty State -->
        <div
            v-else-if="count === 0"
            class="rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-border dark:bg-card"
        >
            <Inbox
                class="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600"
            />
            <h3
                class="mb-1 text-lg font-semibold text-gray-700 dark:text-gray-300"
            >
                No hay cotizaciones pendientes
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
                Las cotizaciones enviadas a caja aparecerán aquí
                automáticamente.
            </p>
        </div>

        <!-- Cards Grid -->
        <div
            v-else
            class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
            <div
                v-for="quote in quotes"
                :key="quote.id"
                class="flex h-[420px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow duration-200 hover:shadow-lg dark:border-border dark:bg-card"
            >
                <!-- Card Header -->
                <div
                    class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-border"
                >
                    <div>
                        <span
                            class="text-sm font-bold text-sky-700 uppercase dark:text-sky-400"
                            >{{ quote.quote_number }}</span
                        >
                        <div class="mt-0.5 flex items-center gap-1.5">
                            <User :size="12" class="text-gray-400" />
                            <span
                                class="text-xs text-gray-500 dark:text-gray-400"
                                >{{ quote.user?.name ?? 'Sin vendedor' }}</span
                            >
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <div
                                class="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                            >
                                <Clock :size="14" />
                                <span
                                    class="text-sm font-semibold tabular-nums"
                                    >{{
                                        timeAgo(quote.sent_to_cashier_at, now)
                                    }}</span
                                >
                            </div>
                        </div>
                        <!-- Remove button -->
                        <button
                            @click.stop="handleRemoveFromQueue(quote)"
                            :disabled="removingId === quote.id"
                            class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            title="Remover de cola"
                        >
                            <X :size="18" />
                        </button>
                    </div>
                </div>

                <!-- Card Body -->
                <div class="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    <!-- Customer -->
                    <div class="flex items-center gap-2">
                        <span
                            class="text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                            >Cliente:</span
                        >
                        <span
                            class="text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            {{ quote.customer?.name || 'Público General' }}
                        </span>
                    </div>

                    <!-- Products summary -->
                    <div class="space-y-1.5">
                        <div
                            v-for="item in summarizedProducts(quote.items)
                                .shown"
                            :key="item.product_id"
                            class="flex items-center gap-2 text-sm"
                        >
                            <Package
                                :size="14"
                                class="shrink-0 text-gray-400"
                            />
                            <span
                                class="flex-1 truncate text-gray-700 dark:text-gray-300"
                            >
                                {{ item.product?.name || 'Producto' }}
                            </span>
                            <span
                                class="shrink-0 font-medium text-gray-500 dark:text-gray-400"
                            >
                                x{{ item.quantity }}
                            </span>
                        </div>
                        <p
                            v-if="summarizedProducts(quote.items).extra > 0"
                            class="pl-6 text-xs text-gray-400 dark:text-gray-500"
                        >
                            +{{
                                summarizedProducts(quote.items).extra
                            }}
                            producto{{
                                summarizedProducts(quote.items).extra > 1
                                    ? 's'
                                    : ''
                            }}
                            más
                        </p>
                    </div>

                    <!-- Total -->
                    <div
                        class="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-border"
                    >
                        <span
                            class="text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                            >Total</span
                        >
                        <span
                            class="text-lg font-bold text-gray-900 dark:text-white"
                            >{{ formatCurrency(quote.total) }}</span
                        >
                    </div>
                </div>

                <!-- Card Footer -->
                <div class="bg-gray-50 px-5 py-3 dark:bg-background">
                    <button
                        @click="processPayment(quote)"
                        :disabled="processingId === quote.id"
                        class="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <div
                            v-if="processingId === quote.id"
                            class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                        ></div>
                        <ShoppingCart v-else :size="18" />
                        {{
                            processingId === quote.id
                                ? 'Cargando...'
                                : 'Procesar Pago'
                        }}
                    </button>
                </div>
            </div>
        </div>

        <div
            v-if="quoteToRemove"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
            <div
                class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card"
            >
                <div class="border-b border-gray-200 px-5 py-4 dark:border-border">
                    <h3 class="text-base font-bold text-gray-900 dark:text-white">
                        Remover de cola
                    </h3>
                    <p class="mt-1 text-sm text-gray-500">
                        La cotizacion no se eliminara; solo saldra de la cola de caja.
                    </p>
                </div>
                <div class="space-y-2 px-5 py-4 text-sm">
                    <p class="font-semibold text-gray-900 dark:text-white">
                        {{ quoteToRemove.quote_number }}
                    </p>
                    <p class="text-gray-500">
                        {{ quoteToRemove.customer?.name || 'Publico General' }}
                    </p>
                </div>
                <div
                    class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-border"
                >
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                        @click="quoteToRemove = null"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        @click="confirmRemoveFromQueue"
                    >
                        Remover
                    </button>
                </div>
            </div>
        </div>

        <div
            v-if="queueNotice"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
            <div
                class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card"
            >
                <div class="border-b border-gray-200 px-5 py-4 dark:border-border">
                    <h3 class="text-base font-bold text-gray-900 dark:text-white">
                        {{ queueNotice.title }}
                    </h3>
                    <p class="mt-1 text-sm text-gray-500">
                        {{ queueNotice.message }}
                    </p>
                </div>
                <div
                    class="flex justify-end border-t border-gray-200 px-5 py-4 dark:border-border"
                >
                    <button
                        type="button"
                        class="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                        @click="queueNotice = null"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
