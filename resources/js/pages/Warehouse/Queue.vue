<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    useWarehouseQueue,
    type WarehouseOrder,
} from '@/composables/useWarehouseQueue';
import {
    PackageSearch,
    Clock,
    Package,
    User,
    CheckCircle,
} from 'lucide-vue-next';

defineOptions({ layout: AppLayout });

const {
    orders,
    count,
    loading,
    error,
    timeAgo,
    startPolling,
    stopPolling,
    markAsPrepared,
} = useWarehouseQueue();

// Reactive clock: ticks every second so timeAgo re-renders
const now = ref(Date.now());
let clockInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
    startPolling(15000); // polling every 15s
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

const processingId = ref<number | null>(null);

const handlePrepare = async (order: WarehouseOrder) => {
    const confirmed = confirm(
        `¿Marcar la orden ${order.order_number} como PREPARADA?`,
    );
    if (!confirmed) return;

    processingId.value = order.id;
    try {
        const success = await markAsPrepared(order.id);
        if (!success) {
            alert('Error al marcar la orden como preparada.');
        }
    } finally {
        processingId.value = null;
    }
};

const summarizedProducts = (items: WarehouseOrder['items']) => {
    const maxShow = 4;
    const shown = items.slice(0, maxShow);
    const extra = items.length - maxShow;
    return { shown, extra: extra > 0 ? extra : 0 };
};
</script>

<template>
    <Head title="Preparación en Bodega" />

    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div>
                <h1
                    class="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white"
                >
                    <PackageSearch
                        class="h-8 w-8 text-indigo-600 dark:text-indigo-400"
                    />
                    Preparación en Bodega
                    <span
                        v-if="count > 0"
                        class="inline-flex items-center justify-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-bold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                    >
                        {{ count }}
                    </span>
                </h1>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Órdenes pendientes de agrupar y preparar para su entrega
                </p>
            </div>
        </div>

        <!-- Loading -->
        <div
            v-if="loading && orders.length === 0"
            class="py-16 text-center text-gray-500"
        >
            <div
                class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
            ></div>
            Cargando órdenes pendientes...
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
            <PackageSearch
                class="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600"
            />
            <h3
                class="mb-1 text-lg font-semibold text-gray-700 dark:text-gray-300"
            >
                Bodega al día
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
                No hay órdenes pendientes de preparación en este momento.
            </p>
        </div>

        <!-- Cards Grid -->
        <div
            v-else
            class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
            <div
                v-for="order in orders"
                :key="order.id"
                class="flex h-[420px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow duration-200 hover:shadow-lg dark:border-border dark:bg-card"
            >
                <!-- Card Header -->
                <div
                    class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-border"
                >
                    <div>
                        <span
                            class="cursor-pointer text-sm font-bold text-indigo-700 uppercase hover:underline dark:text-indigo-400"
                            @click="router.visit(`/sales-orders/${order.id}`)"
                            >{{ order.order_number }}</span
                        >
                        <div class="mt-0.5 flex items-center gap-1.5">
                            <User :size="12" class="text-gray-400" />
                            <span
                                class="text-xs text-gray-500 dark:text-gray-400"
                                >{{ order.user?.name ?? 'Sist.' }}</span
                            >
                        </div>
                    </div>
                    <div class="text-right">
                        <div
                            class="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                        >
                            <Clock :size="14" />
                            <span class="text-sm font-semibold tabular-nums">{{
                                timeAgo(order.sent_to_warehouse_at, now)
                            }}</span>
                        </div>
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
                            {{ order.customer?.name || 'Público General' }}
                        </span>
                    </div>

                    <!-- Products summary -->
                    <div class="mt-2 space-y-1.5">
                        <div
                            v-for="item in summarizedProducts(order.items)
                                .shown"
                            :key="item.id"
                            class="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1.5 text-sm dark:bg-muted/30"
                        >
                            <div
                                class="flex items-center gap-2 overflow-hidden"
                            >
                                <Package
                                    :size="14"
                                    class="shrink-0 text-gray-400"
                                />
                                <span
                                    class="truncate font-medium text-gray-700 dark:text-gray-300"
                                >
                                    {{ item.product?.name || 'Producto' }}
                                </span>
                            </div>
                            <span
                                class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                            >
                                x{{ item.quantity }}
                            </span>
                        </div>
                        <p
                            v-if="summarizedProducts(order.items).extra > 0"
                            class="pt-2 text-center text-xs text-gray-400 dark:text-gray-500"
                        >
                            +
                            {{ summarizedProducts(order.items).extra }}
                            producto(s) adicional(es)
                        </p>
                    </div>
                </div>

                <!-- Card Footer -->
                <div
                    class="border-t border-gray-100 bg-gray-50 px-5 py-3 dark:border-border dark:bg-background"
                >
                    <button
                        @click="handlePrepare(order)"
                        :disabled="processingId === order.id"
                        class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <div
                            v-if="processingId === order.id"
                            class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                        ></div>
                        <CheckCircle v-else :size="18" />
                        {{
                            processingId === order.id
                                ? 'Marcando...'
                                : 'Marcar como Preparado'
                        }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
