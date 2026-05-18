import { computed, onUnmounted, ref } from 'vue';
import apiClient from '@/services/api/client';

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
        const seconds = Math.floor(
            (nowMs - new Date(dateString).getTime()) / 1000,
        );
        if (seconds < 0) return 'Ahora';
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainMin = minutes % 60;
        return `${hours}h ${remainMin}m`;
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
