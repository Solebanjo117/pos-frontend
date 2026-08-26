<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { PackageSearch, Package, CheckCircle, X } from 'lucide-vue-next';
import { ref, onMounted, onUnmounted } from 'vue';
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue';
import SalesQueueCard from '@/components/Queues/SalesQueueCard.vue';
import {
    useWarehouseQueue,
    type WarehouseOrder,
} from '@/composables/useWarehouseQueue';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';

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

// ── Order detail preview (does NOT mark as prepared) ──
const detailOrder = ref<WarehouseOrder | null>(null);
const detailTab = ref<'summary' | 'products'>('summary');

const openOrderDetail = (order: WarehouseOrder) => {
    detailOrder.value = order;
    detailTab.value = 'summary';
};

const closeOrderDetail = () => {
    detailOrder.value = null;
};

// ── Reuse existing ProductDetailModal (loaded by id) ──
const selectedProductForModal = ref<any>(null);

const openProductDetail = async (productId: number | null) => {
    if (!productId) return;
    try {
        const { data } = await apiClient.get(`/products/${productId}`);
        selectedProductForModal.value = data.data ?? data;
    } catch {
        /* silent */
    }
};

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
            <SalesQueueCard
                v-for="order in orders"
                :key="order.id"
                :document-number="order.order_number"
                :seller-name="order.user?.name"
                :elapsed="timeAgo(order.sent_to_warehouse_at, now)"
                :customer-name="order.customer?.name || 'Público General'"
                :items="
                    order.items.map((item) => ({
                        id: item.id,
                        product_name: item.is_custom_line
                            ? item.custom_description
                            : item.product?.name,
                        quantity: item.quantity,
                    }))
                "
                @open-document="router.visit(`/sales-orders/${order.id}`)"
                @open="openOrderDetail(order)"
            >
                <template #action>
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
                </template>
            </SalesQueueCard>
        </div>
    </div>

    <!-- Order detail preview (Resumen | Productos) — does NOT mark as prepared -->
    <div
        v-if="detailOrder"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeOrderDetail"
    >
        <div
            class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-border dark:bg-card"
        >
            <div
                class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-border"
            >
                <div>
                    <h2
                        class="text-lg font-bold text-gray-900 uppercase dark:text-white"
                    >
                        {{ detailOrder.order_number }}
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ detailOrder.customer?.name || 'Público General' }}
                    </p>
                </div>
                <button
                    type="button"
                    class="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-muted"
                    @click="closeOrderDetail"
                >
                    <X :size="18" />
                </button>
            </div>

            <!-- Local tabs -->
            <div
                class="flex gap-1 border-b border-gray-100 px-5 dark:border-border"
            >
                <button
                    type="button"
                    class="border-b-2 px-3 py-2 text-sm font-medium transition-colors"
                    :class="
                        detailTab === 'summary'
                            ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    "
                    @click="detailTab = 'summary'"
                >
                    Resumen
                </button>
                <button
                    type="button"
                    class="border-b-2 px-3 py-2 text-sm font-medium transition-colors"
                    :class="
                        detailTab === 'products'
                            ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    "
                    @click="detailTab = 'products'"
                >
                    Productos ({{ detailOrder.items.length }})
                </button>
            </div>

            <div class="flex-1 overflow-y-auto px-5 py-4">
                <!-- Resumen -->
                <div v-if="detailTab === 'summary'" class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400"
                            >Cliente</span
                        >
                        <span class="font-medium">{{
                            detailOrder.customer?.name || 'Público General'
                        }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400"
                            >Responsable</span
                        >
                        <span class="font-medium">{{
                            detailOrder.user?.name ?? 'Sistema'
                        }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400"
                            >En espera</span
                        >
                        <span class="font-medium">{{
                            timeAgo(detailOrder.sent_to_warehouse_at, now)
                        }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400"
                            >Productos</span
                        >
                        <span class="font-medium">{{
                            detailOrder.items.length
                        }}</span>
                    </div>
                </div>

                <!-- Productos -->
                <div v-else class="space-y-1.5">
                    <button
                        v-for="item in detailOrder.items"
                        :key="item.id"
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-left text-sm transition hover:bg-gray-50 disabled:cursor-default dark:border-border dark:hover:bg-muted/30"
                        :disabled="item.is_custom_line || !item.product_id"
                        @click="openProductDetail(item.product_id)"
                    >
                        <div class="flex min-w-0 items-start gap-2">
                            <Package
                                :size="16"
                                class="mt-0.5 shrink-0 text-gray-400"
                            />
                            <div class="min-w-0">
                                <p
                                    class="font-medium text-gray-800 dark:text-gray-200"
                                >
                                    {{
                                        item.is_custom_line
                                            ? item.custom_description ||
                                              'Línea personalizada'
                                            : item.product?.name || 'Producto'
                                    }}
                                </p>
                                <p
                                    class="text-xs text-gray-500 dark:text-gray-400"
                                >
                                    <span
                                        v-if="
                                            item.variant?.sku ||
                                            item.product?.sku_base
                                        "
                                    >
                                        SKU:
                                        {{
                                            item.variant?.sku ||
                                            item.product?.sku_base
                                        }}
                                    </span>
                                    <span v-if="item.variant?.brand?.name">
                                        · {{ item.variant.brand.name }}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <span
                            class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                        >
                            x{{ item.quantity }}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Reuse existing product detail modal -->
    <ProductDetailModal
        v-if="selectedProductForModal"
        :product="selectedProductForModal"
        @close="selectedProductForModal = null"
        @view-alternative="(p: any) => (selectedProductForModal = p)"
    />
</template>
