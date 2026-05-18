import { ref, onUnmounted, computed } from 'vue';
import apiClient from '@/services/api/client';

export interface PendingQuote {
    id: number;
    quote_number: string;
    customer?: { id: number; name: string } | null;
    user?: { name: string };
    total: number | string;
    formatted_total: string;
    sent_to_cashier_at: string;
    items: Array<{
        product_id: number;
        product: { name: string };
        variant_id?: number | null;
        warehouse_id?: number | null;
        quantity: number;
        unit_price: number;
        discount_percent: number;
        tax_percent: number;
        subtotal: number;
        tax_amount: number;
        total: number;
        variant?: any;
        product_name?: string;
        product_sku?: string;
    }>;
}

export function useCashierQueue() {
    const quotes = ref<PendingQuote[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchPending() {
        try {
            loading.value = true;
            const res = await apiClient.get('/sales-quotes/pending-at-cashier');
            quotes.value = res.data.data;
            error.value = null;
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar';
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

    /**
     * Tiempo transcurrido en formato legible.
     * Accepts `nowMs` as a reactive param so Vue re-computes when it changes.
     */
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

    async function removeFromQueue(quoteId: number): Promise<boolean> {
        try {
            await apiClient.delete(`/sales-quotes/${quoteId}/cashier-queue`);
            await fetchPending(); // Refresh queue
            return true;
        } catch (e: any) {
            console.error('Error removing from queue:', e);
            return false;
        }
    }

    const count = computed(() => quotes.value.length);

    onUnmounted(() => stopPolling());

    return {
        quotes,
        loading,
        error,
        count,
        timeAgo,
        fetchPending,
        startPolling,
        stopPolling,
        removeFromQueue,
    };
}
