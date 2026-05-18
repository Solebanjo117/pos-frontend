import { computed, onUnmounted, ref } from 'vue';
import apiClient from '@/services/api/client';

export interface PendingReceiptOrder {
    id: number;
    po_number: string;
    status: 'sent' | 'partial' | string;
    supplier?: { id: number; name: string } | null;
    items: Array<{
        id: number;
        quantity_ordered: number;
        quantity_received: number;
        product?: { id: number; name: string } | null;
    }>;
}

export function usePurchaseOrderQueue() {
    const orders = ref<PendingReceiptOrder[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchPending() {
        try {
            loading.value = true;
            const res = await apiClient.get('/purchase-orders/pending-receipt');
            orders.value = res.data.data ?? [];
            error.value = null;
        } catch (e: any) {
            error.value =
                e.response?.data?.message || 'Error al cargar cola de pedidos';
        } finally {
            loading.value = false;
        }
    }

    function startPolling(intervalMs = 30000) {
        fetchPending();
        pollingInterval = setInterval(fetchPending, intervalMs);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    const count = computed(() => orders.value.length);

    onUnmounted(() => stopPolling());

    return {
        orders,
        loading,
        error,
        count,
        fetchPending,
        startPolling,
        stopPolling,
    };
}
