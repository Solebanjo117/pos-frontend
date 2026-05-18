import { ref } from 'vue';
import apiClient from '@/services/api/client';

export interface WorkOrderItem {
    id: number;
    product_id: number;
    variant_id: number | null;
    warehouse_id: number;
    quantity: number;
    unit_price: string;
    notes: string | null;
}

export interface WorkOrder {
    id: number;
    folio: string;
    customer_id: number | null;
    warehouse_id: number;
    created_by: number;
    assigned_to: number | null;
    status: 'pending' | 'in_progress' | 'done' | 'delivered' | 'cancelled';
    vehicle_description: string | null;
    notes: string | null;
    labour_cost: string;
    estimated_delivery_at: string | null;
    created_at: string;
    updated_at: string;
    customer?: { id: number; name: string } | null;
    warehouse?: { id: number; name: string } | null;
    items?: WorkOrderItem[];
}

export interface WorkOrderFilters {
    status?: string;
    warehouse_id?: number;
    search?: string;
    per_page?: number;
    page?: number;
}

export function useWorkOrders() {
    const workOrders = ref<WorkOrder[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const total = ref(0);
    const currentPage = ref(1);
    const lastPage = ref(1);

    const fetchWorkOrders = async (filters: WorkOrderFilters = {}) => {
        loading.value = true;
        error.value = null;
        try {
            const { data } = await apiClient.get('/work-orders', {
                params: filters,
            });
            workOrders.value = data.data ?? data;
            total.value = data.total ?? workOrders.value.length;
            currentPage.value = data.current_page ?? 1;
            lastPage.value = data.last_page ?? 1;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ??
                'Error al cargar órdenes de trabajo';
            console.error('Error fetching work orders:', err);
        } finally {
            loading.value = false;
        }
    };

    const transitionStatus = async (id: number, status: string) => {
        const { data } = await apiClient.post(`/work-orders/${id}/transition`, {
            status,
        });
        return data;
    };

    return {
        workOrders,
        loading,
        error,
        total,
        currentPage,
        lastPage,
        fetchWorkOrders,
        transitionStatus,
    };
}
