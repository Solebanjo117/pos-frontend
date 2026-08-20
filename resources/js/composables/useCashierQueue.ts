import { computed, onUnmounted, ref } from 'vue';
import apiClient from '@/services/api/client';
import type { QueueEntryWireType } from '@/utils/cashierQueue';
import { formatDuration } from '@/utils/formatters';

export type CashierQueueType = QueueEntryWireType;

export interface CashierQueueSource {
    id: number;
    document_number: string;
    description: string;
    party: string;
    amount: number;
    seller_name?: string | null;
    notes?: string | null;
    planned_payment_method?: string | null;
    reference_number?: string | null;
    refund_method?: string | null;
    money_refund_amount?: number;
    receivable_applied_amount?: number;
    store_credit_amount?: number;
}

export interface CashierQueueEntry {
    id: number;
    entry_type: CashierQueueType;
    status: 'pending' | 'opened' | 'completed' | 'cancelled';
    warehouse_id: number | null;
    warehouse?: { id: number; name: string } | null;
    estimated_amount: number;
    final_amount: number | null;
    scheduled_for: string | null;
    opened_by: number | null;
    opened_at: string | null;
    source: CashierQueueSource;
}

export function useCashierQueue() {
    const entries = ref<CashierQueueEntry[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchPending() {
        if (loading.value) return;

        try {
            loading.value = true;
            const response = await apiClient.get('/cashier-queue', {
                params: { per_page: 100 },
            });
            entries.value = response.data.data ?? [];
            error.value = null;
        } catch (exception: any) {
            error.value =
                exception.response?.data?.message || 'Error al cargar la cola';
        } finally {
            loading.value = false;
        }
    }

    async function openEntry(entryId: number): Promise<CashierQueueEntry> {
        const response = await apiClient.post(`/cashier-queue/${entryId}/open`);
        await fetchPending();
        return response.data.data;
    }

    async function completeEntry(
        entryId: number,
        payload: {
            final_amount?: number;
            payment_method?: string;
            reference_number?: string | null;
            variance_reason?: string | null;
        },
    ): Promise<CashierQueueEntry> {
        const response = await apiClient.post(
            `/cashier-queue/${entryId}/complete`,
            payload,
        );
        await fetchPending();
        return response.data.data;
    }

    async function removeSaleFromQueue(sourceId: number): Promise<void> {
        await apiClient.delete(`/sales-quotes/${sourceId}/cashier-queue`);
        await fetchPending();
    }

    function startPolling(intervalMs = 15000) {
        stopPolling();
        void fetchPending();
        pollingInterval = setInterval(fetchPending, intervalMs);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    function timeAgo(dateString: string | null, nowMs: number): string {
        if (!dateString) return 'Ahora';
        return formatDuration(dateString, new Date(nowMs)) || 'Ahora';
    }

    const count = computed(() => entries.value.length);

    onUnmounted(stopPolling);

    return {
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
    };
}
