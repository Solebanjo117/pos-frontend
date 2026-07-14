import { ref, computed } from 'vue';
import { salesOrdersService } from '@/services/sales-orders';
import type {
    SalesOrder,
    SalesOrderFilters,
    SalesOrderStatistics,
    CreateSalesOrderData,
    UpdateSalesOrderData,
    AddOrderItemData,
    UpdateOrderItemData,
} from '@/types/sales-order';

export function useSalesOrders() {
    const salesOrders = ref<SalesOrder[]>([]);
    const currentSalesOrder = ref<SalesOrder | null>(null);
    const statistics = ref<SalesOrderStatistics | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const total = ref(0);
    const currentPage = ref(1);
    const perPage = ref(15);

    /**
     * Fetch all sales orders
     */
    const fetchSalesOrders = async (filters?: SalesOrderFilters) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await salesOrdersService.getAll(filters);
            salesOrders.value = response.data;
            total.value = response.total;
            currentPage.value = response.current_page;
            perPage.value = response.per_page;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar órdenes';
            console.error('Error fetching sales orders:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch single sales order by ID
     */
    const fetchSalesOrderById = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            const order = await salesOrdersService.getById(id);
            currentSalesOrder.value = order;
            return order;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar orden';
            console.error('Error fetching sales order:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Create new sales order
     */
    const createSalesOrder = async (orderData: CreateSalesOrderData) => {
        loading.value = true;
        error.value = null;

        try {
            const result = await salesOrdersService.create(orderData);
            const newOrder = result.data;
            salesOrders.value.unshift(newOrder);
            return result;
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al crear orden';
            console.error('Error creating sales order:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Update existing sales order
     */
    const updateSalesOrder = async (
        id: number,
        orderData: UpdateSalesOrderData,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const updatedOrder = await salesOrdersService.update(id, orderData);
            const index = salesOrders.value.findIndex((o) => o.id === id);
            if (index !== -1) {
                salesOrders.value[index] = updatedOrder;
            }
            if (currentSalesOrder.value?.id === id) {
                currentSalesOrder.value = updatedOrder;
            }
            return updatedOrder;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al actualizar orden';
            console.error('Error updating sales order:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Delete sales order
     */
    const deleteSalesOrder = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            await salesOrdersService.delete(id);
            salesOrders.value = salesOrders.value.filter((o) => o.id !== id);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al eliminar orden';
            console.error('Error deleting sales order:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Confirm order
     */
    const confirmSalesOrder = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            const result = await salesOrdersService.confirm(id);
            const confirmedOrder = result.data;
            const index = salesOrders.value.findIndex((o) => o.id === id);
            if (index !== -1) {
                salesOrders.value[index] = confirmedOrder;
            }
            if (currentSalesOrder.value?.id === id) {
                currentSalesOrder.value = confirmedOrder;
            }
            return result;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al confirmar orden';
            console.error('Error confirming sales order:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Complete order
     */
    const completeSalesOrder = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            const completedOrder = await salesOrdersService.complete(id);
            const index = salesOrders.value.findIndex((o) => o.id === id);
            if (index !== -1) {
                salesOrders.value[index] = completedOrder;
            }
            if (currentSalesOrder.value?.id === id) {
                currentSalesOrder.value = completedOrder;
            }
            return completedOrder;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al completar orden';
            console.error('Error completing sales order:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Cancel order
     */
    const cancelSalesOrder = async (
        id: number,
        payload: {
            reason: string;
            refund_method?: string | null;
            notes?: string | null;
        },
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const cancelledOrder = await salesOrdersService.cancel(id, payload);
            const index = salesOrders.value.findIndex((o) => o.id === id);
            if (index !== -1) {
                salesOrders.value[index] = cancelledOrder;
            }
            if (currentSalesOrder.value?.id === id) {
                currentSalesOrder.value = cancelledOrder;
            }
            return cancelledOrder;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cancelar orden';
            console.error('Error cancelling sales order:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Add item to order
     */
    const addItemToOrder = async (
        orderId: number,
        itemData: AddOrderItemData,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const newItem = await salesOrdersService.addItem(orderId, itemData);
            // Refresh current order to get updated totals
            if (currentSalesOrder.value?.id === orderId) {
                await fetchSalesOrderById(orderId);
            }
            return newItem;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al agregar item';
            console.error('Error adding item:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Update order item
     */
    const updateOrderItem = async (
        itemId: number,
        itemData: UpdateOrderItemData,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const updatedItem = await salesOrdersService.updateItem(
                itemId,
                itemData,
            );
            // Refresh current order to get updated totals
            if (currentSalesOrder.value) {
                await fetchSalesOrderById(currentSalesOrder.value.id);
            }
            return updatedItem;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al actualizar item';
            console.error('Error updating item:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Remove item from order
     */
    const removeOrderItem = async (itemId: number) => {
        loading.value = true;
        error.value = null;

        try {
            await salesOrdersService.removeItem(itemId);
            // Refresh current order to get updated totals
            if (currentSalesOrder.value) {
                await fetchSalesOrderById(currentSalesOrder.value.id);
            }
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al eliminar item';
            console.error('Error removing item:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch statistics
     */
    const fetchStatistics = async (filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number;
    }) => {
        loading.value = true;
        error.value = null;

        try {
            const stats = await salesOrdersService.getStatistics(filters);
            statistics.value = stats;
            return stats;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar estadísticas';
            console.error('Error fetching statistics:', err);
        } finally {
            loading.value = false;
        }
    };

    // Computed properties
    const hasSalesOrders = computed(() => salesOrders.value.length > 0);
    const totalPages = computed(() => Math.ceil(total.value / perPage.value));

    return {
        // State
        salesOrders,
        currentSalesOrder,
        statistics,
        loading,
        error,
        total,
        currentPage,
        perPage,

        // Computed
        hasSalesOrders,
        totalPages,

        // Methods
        fetchSalesOrders,
        fetchSalesOrderById,
        createSalesOrder,
        updateSalesOrder,
        deleteSalesOrder,
        confirmSalesOrder,
        completeSalesOrder,
        cancelSalesOrder,
        addItemToOrder,
        updateOrderItem,
        removeOrderItem,
        fetchStatistics,
    };
}
