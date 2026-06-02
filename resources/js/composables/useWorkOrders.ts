import { ref } from 'vue';
import {
    WorkOrdersApiService,
    type WorkOrder,
    type WorkOrderFilters,
    type WorkOrderStatus,
    type WorkOrderSummary,
} from '@/services/workOrders';

export type { WorkOrder, WorkOrderFilters, WorkOrderSummary };

export function useWorkOrders() {
    const workOrders = ref<WorkOrder[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const total = ref(0);
    const currentPage = ref(1);
    const lastPage = ref(1);
    const summary = ref<WorkOrderSummary | null>(null);

    const fetchWorkOrders = async (filters: WorkOrderFilters = {}) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await WorkOrdersApiService.getWorkOrders(filters);
            workOrders.value = response.data ?? [];
            total.value =
                response.total ??
                response.meta?.total ??
                workOrders.value.length;
            currentPage.value =
                response.current_page ?? response.meta?.current_page ?? 1;
            lastPage.value =
                response.last_page ?? response.meta?.last_page ?? 1;
            summary.value = response.summary ?? null;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ??
                'Error al cargar ordenes de trabajo';
            console.error('Error fetching work orders:', err);
        } finally {
            loading.value = false;
        }
    };

    const transitionStatus = async (id: number, status: WorkOrderStatus) => {
        return WorkOrdersApiService.transitionWorkOrder(id, status);
    };

    return {
        workOrders,
        loading,
        error,
        total,
        currentPage,
        lastPage,
        summary,
        fetchWorkOrders,
        transitionStatus,
    };
}
