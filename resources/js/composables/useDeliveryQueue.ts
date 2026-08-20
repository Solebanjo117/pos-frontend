import { computed, onUnmounted, ref } from 'vue';
import apiClient from '@/services/api/client';
import { formatDuration } from '@/utils/formatters';

export interface DeliveryOrder {
    id: number;
    order_number: string;
    status: string;
    prepared_at: string;
    customer?: { id: number; name: string } | null;
    user?: { id: number; name: string } | null;
    items: Array<{
        id: number;
        product_id: number;
        product?: { id: number; name: string } | null;
        quantity: number;
    }>;
}

export function useDeliveryQueue() {
    const orders = ref<DeliveryOrder[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchPending() {
        try {
            loading.value = true;
            const res = await apiClient.get('/sales-orders/pending-delivery');
            orders.value = res.data.data ?? [];
            error.value = null;
        } catch (e: any) {
            error.value =
                e.response?.data?.message || 'Error al cargar cola de entrega';
        } finally {
            loading.value = false;
        }
    }

    function startPolling(intervalMs = 20000) {
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

    async function markAsDelivered(orderId: number): Promise<boolean> {
        try {
            await apiClient.post(`/sales-orders/${orderId}/complete`);
            await fetchPending();
            return true;
        } catch (e: any) {
            console.error('Error al marcar orden como entregada:', e);
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
        markAsDelivered,
    };
}
