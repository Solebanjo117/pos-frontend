import apiClient from '@/services/api/client';

export type WorkOrderStatus =
    | 'pending'
    | 'in_progress'
    | 'done'
    | 'delivered'
    | 'cancelled';

export interface WorkOrderCustomer {
    id: number;
    code?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    current_balance?: number | string | null;
}

export interface WorkOrderVehicle {
    id: number;
    vin: string | null;
    label: string | null;
    display_name?: string | null;
    model?: {
        id: number;
        name: string;
        make?: { id: number; name: string } | null;
    } | null;
    chassis?: { id: number; code: string; name?: string | null } | null;
    engine?: {
        id: number;
        engine_code: string;
        displacement?: string | null;
    } | null;
}

export interface WorkOrderItem {
    id: number;
    product_id: number;
    variant_id: number | null;
    warehouse_id: number;
    quantity: number;
    unit_price: number | string;
    notes: string | null;
    product?: { id: number; sku_base?: string | null; name: string } | null;
    variant?: {
        id: number;
        sku?: string | null;
        brand?: { id: number; name: string } | null;
    } | null;
    warehouse?: { id: number; name: string } | null;
}

export interface WorkOrder {
    id: number;
    folio: string;
    customer_id: number | null;
    customer_vehicle_id: number | null;
    warehouse_id: number;
    created_by: number;
    assigned_to: number | null;
    status: WorkOrderStatus;
    vehicle_description: string | null;
    notes: string | null;
    labour_cost: number | string;
    estimated_delivery_at: string | null;
    created_at: string;
    updated_at: string;
    total_parts: number;
    total_labour: number;
    total_amount: number;
    available_transitions: WorkOrderStatus[];
    customer?: WorkOrderCustomer | null;
    customer_vehicle?: WorkOrderVehicle | null;
    warehouse?: { id: number; code?: string | null; name: string } | null;
    creator?: { id: number; name: string } | null;
    assignee?: {
        id: number;
        name: string;
        email?: string | null;
        role?: string | null;
    } | null;
    items?: WorkOrderItem[];
}

export interface WorkOrderSummary {
    total: number;
    pending: number;
    in_progress: number;
    done: number;
    delivered: number;
    cancelled: number;
    overdue: number;
}

export interface WorkOrderFilters {
    status?: string;
    warehouse_id?: number | string;
    customer_id?: number | string;
    customer_vehicle_id?: number | string;
    assigned_to?: number | string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
}

export interface WorkOrderPayload {
    customer_id?: number | null;
    customer_vehicle_id?: number | null;
    warehouse_id?: number | null;
    assigned_to?: number | null;
    vehicle_description?: string | null;
    notes?: string | null;
    labour_cost?: number;
    estimated_delivery_at?: string | null;
    items?: Array<{
        product_id: number;
        variant_id?: number | null;
        warehouse_id: number;
        quantity: number;
        unit_price: number;
        notes?: string | null;
    }>;
}

export interface WorkOrdersResponse {
    data: WorkOrder[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
    meta?: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    summary?: WorkOrderSummary;
}

export const WorkOrdersApiService = {
    async getWorkOrders(filters: WorkOrderFilters = {}) {
        const response = await apiClient.get<WorkOrdersResponse>(
            '/work-orders',
            {
                params: filters,
            },
        );
        return response.data;
    },

    async getWorkOrder(id: number) {
        const response = await apiClient.get<WorkOrder>(`/work-orders/${id}`);
        return response.data;
    },

    async createWorkOrder(payload: WorkOrderPayload) {
        const response = await apiClient.post<{
            data: WorkOrder;
            message: string;
        }>('/work-orders', payload);
        return response.data;
    },

    async updateWorkOrder(id: number, payload: WorkOrderPayload) {
        const response = await apiClient.put<{
            data: WorkOrder;
            message: string;
        }>(`/work-orders/${id}`, payload);
        return response.data;
    },

    async transitionWorkOrder(id: number, status: WorkOrderStatus) {
        const response = await apiClient.post<{
            data: WorkOrder;
            message: string;
        }>(`/work-orders/${id}/transition`, { status });
        return response.data;
    },

    async deleteWorkOrder(id: number) {
        const response = await apiClient.delete<{ message: string }>(
            `/work-orders/${id}`,
        );
        return response.data;
    },
};
