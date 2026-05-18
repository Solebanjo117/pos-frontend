<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    usePurchaseOrderQueue,
    type PendingReceiptOrder,
} from '@/composables/usePurchaseOrderQueue';
import { ArrowRight, ClipboardCheck, Factory } from 'lucide-vue-next';

defineOptions({ layout: AppLayout });

const { orders, count, loading, error, startPolling, stopPolling } =
    usePurchaseOrderQueue();

onMounted(() => {
    startPolling(30000);
});

onUnmounted(() => {
    stopPolling();
});

const pendingQty = (order: PendingReceiptOrder): number => {
    return order.items.reduce((sum, item) => {
        const pending =
            (item.quantity_ordered ?? 0) - (item.quantity_received ?? 0);
        return sum + Math.max(0, pending);
    }, 0);
};

const goToReceive = (id: number) => {
    router.visit(`/purchase-orders/${id}/receive`);
};
</script>

<template>
    <Head title="Cola Pedidos" />

    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1
                    class="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white"
                >
                    <ClipboardCheck
                        class="h-8 w-8 text-blue-600 dark:text-blue-400"
                    />
                    Cola Pedidos
                    <span
                        v-if="count > 0"
                        class="inline-flex items-center justify-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                        {{ count }}
                    </span>
                </h1>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Ordenes de compra enviadas o parciales, pendientes de
                    recepcion
                </p>
            </div>
        </div>

        <div
            v-if="loading && orders.length === 0"
            class="py-16 text-center text-gray-500"
        >
            <div
                class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
            ></div>
            Cargando pedidos pendientes...
        </div>

        <div
            v-else-if="error"
            class="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-900/20"
        >
            <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            <button
                @click="startPolling(30000)"
                class="mt-3 text-sm text-red-700 underline dark:text-red-300"
            >
                Reintentar
            </button>
        </div>

        <div
            v-else-if="orders.length === 0"
            class="rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-border dark:bg-card"
        >
            <ClipboardCheck
                class="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600"
            />
            <h3
                class="mb-1 text-lg font-semibold text-gray-700 dark:text-gray-300"
            >
                Sin pedidos pendientes
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
                No hay ordenes de compra por recibir en este momento.
            </p>
        </div>

        <div v-else class="space-y-3">
            <div
                v-for="order in orders"
                :key="order.id"
                class="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 md:flex-row md:items-center md:justify-between dark:border-border dark:bg-card"
            >
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <span
                            class="text-sm font-bold text-blue-700 uppercase dark:text-blue-400"
                            >{{ order.po_number }}</span
                        >
                        <span
                            class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-muted dark:text-gray-300"
                            >{{ order.status }}</span
                        >
                    </div>

                    <div
                        class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300"
                    >
                        <span class="inline-flex items-center gap-1.5">
                            <Factory :size="15" class="text-gray-400" />
                            {{ order.supplier?.name || 'Proveedor sin nombre' }}
                        </span>
                        <span
                            class="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                            Pendiente: {{ pendingQty(order) }}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    @click="goToReceive(order.id)"
                >
                    Ir a Recepcion
                    <ArrowRight :size="16" />
                </button>
            </div>
        </div>
    </div>
</template>
