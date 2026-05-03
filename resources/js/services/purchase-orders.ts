import apiClient from './api/client';
import type {
    PurchaseOrder,
    PurchaseOrderFilters,
    PurchaseOrderStatistics,
    CreatePurchaseOrderData,
    UpdatePurchaseOrderData,
    ReceiveItemsData,
    PurchaseOrderCandidateItem,
    PurchaseOrderCandidateSource,
    PurchaseOrderWarning,
} from '@/types/purchase-order';

const BASE_URL = '/purchase-orders';

export const purchaseOrdersService = {
    /**
     * Get all purchase orders with filters
     */
    async getAll(filters?: PurchaseOrderFilters) {
        const { data } = await apiClient.get(BASE_URL, { params: filters });
        return data;
    },

    /**
     * Get single purchase order by ID
     */
    async getById(id: number): Promise<{ data: PurchaseOrder }> {
        const { data } = await apiClient.get(`${BASE_URL}/${id}`);
        return data;
    },

    /**
     * Create new purchase order
     */
    async create(orderData: CreatePurchaseOrderData): Promise<{
        data: PurchaseOrder;
        warnings?: PurchaseOrderWarning[];
    }> {
        const { data } = await apiClient.post(BASE_URL, orderData);
        return {
            data: data.data,
            warnings: data.warnings ?? [],
        };
    },

    /**
     * Candidate items for provider-based list mode.
     */
    async getSupplierCandidates(params: {
        supplier_id: number;
        warehouse_id: number;
        source: PurchaseOrderCandidateSource;
        supply_date?: string;
    }): Promise<PurchaseOrderCandidateItem[]> {
        const { data } = await apiClient.get(
            `${BASE_URL}/supplier-candidates`,
            { params },
        );
        return data.data;
    },

    /**
     * Fast-track create, send and receive purchase order (Backorders) - Legacy
     */
    async quickReceive(orderData: any): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(
            `${BASE_URL}/quick-receive`,
            orderData,
        );
        return data.data;
    },

    /**
     * Quick Purchase v2 - Uses daily global PO system
     */
    async quickPurchase(orderData: any): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(
            `${BASE_URL}/quick-purchase`,
            orderData,
        );
        return data.data;
    },

    /**
     * Reception batch - For POS reception mode
     */
    async receptionBatch(payload: {
        warehouse_id: number;
        items: any[];
    }): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(
            `${BASE_URL}/reception-batch`,
            payload,
        );
        return data.data;
    },

    /**
     * Get or create daily PO for a warehouse
     */
    async getDailyPO(warehouseId: number): Promise<{ data: PurchaseOrder }> {
        const { data } = await apiClient.get(`${BASE_URL}/daily`, {
            params: { warehouse_id: warehouseId },
        });
        return data;
    },

    /**
     * Update existing purchase order
     */
    async update(
        id: number,
        orderData: UpdatePurchaseOrderData,
    ): Promise<PurchaseOrder> {
        const { data } = await apiClient.put(`${BASE_URL}/${id}`, orderData);
        return data.data;
    },

    /**
     * Delete purchase order
     */
    async delete(id: number): Promise<void> {
        await apiClient.delete(`${BASE_URL}/${id}`);
    },

    /**
     * Duplicate purchase order into a new draft
     */
    async duplicate(id: number): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/duplicate`);
        return data.data;
    },

    /**
     * Send purchase order to supplier
     */
    async send(id: number): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/send`);
        return data.data;
    },

    /**
     * Receive items for a purchase order
     */
    async receive(
        id: number,
        receiveData: ReceiveItemsData,
    ): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(
            `${BASE_URL}/${id}/receive`,
            receiveData,
        );
        return data.data;
    },

    /**
     * Cancel purchase order
     */
    async cancel(id: number): Promise<PurchaseOrder> {
        const { data } = await apiClient.post(`${BASE_URL}/${id}/cancel`);
        return data.data;
    },

    /**
     * Get purchase order statistics
     */
    async getStatistics(filters?: {
        date_from?: string;
        date_to?: string;
    }): Promise<PurchaseOrderStatistics> {
        const { data } = await apiClient.get(`${BASE_URL}/statistics`, {
            params: filters,
        });
        return data;
    },
};
