import { ref, onUnmounted, computed } from 'vue';
import apiClient from '@/services/api/client';
import { formatDuration } from '@/utils/formatters';

export interface WarehouseOrder {
    id: number;
    order_number: string;
    customer?: { id: number; name: string } | null;
    user?: { id: number; name: string } | null;
    sent_to_warehouse_at: string;
    items: Array<{
        id: number;
        product_id: number;
        product: { id: number; name: string };
        quantity: number;
    }>;
}

export function useWarehouseQueue() {
    const orders = ref<WarehouseOrder[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchPending() {
        try {
            loading.value = true;
            const res = await apiClient.get(
                '/sales-orders/pending-at-warehouse',
            );
            orders.value = res.data.data;
            error.value = null;
        } catch (e: any) {
            error.value =
                e.response?.data?.message ||
                'Error al cargar órdenes de bodega';
        } finally {
            loading.value = false;
        }
    }

    function startPolling(intervalMs = 15000) {
        fetchPending();
        pollingInterval = setInterval(fetchPending, intervalMs);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    function timeAgo(dateString: string, nowMs: number): string {
        return formatDuration(dateString, new Date(nowMs)) || 'Ahora';
    }

    async function markAsPrepared(orderId: number): Promise<boolean> {
        try {
            await apiClient.post(`/sales-orders/${orderId}/mark-prepared`);
            await fetchPending();
            return true;
        } catch (e: any) {
            console.error('Error al marcar como preparada:', e);
            return false;
        }
    }

    /**
     * Helper que se puede llamar desde OrderDetail.vue
     */
    async function sendToWarehouse(orderId: number): Promise<boolean> {
        try {
            await apiClient.post(`/sales-orders/${orderId}/send-to-warehouse`);
            return true;
        } catch (e: any) {
            console.error('Error al enviar a bodega:', e);
            return false;
        }
    }

    const count = computed(() => orders.value.length);

    onUnmounted(() => stopPolling());

    return {
        orders,
        loading,
        error,
        count,
        timeAgo,
        fetchPending,
        startPolling,
        stopPolling,
        markAsPrepared,
        sendToWarehouse,
    };
}
