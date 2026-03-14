import { ref } from 'vue'
import { purchaseOrdersService } from '@/services/purchase-orders'
import type {
    PurchaseOrder,
    PurchaseOrderFilters,
    PurchaseOrderStatistics,
    CreatePurchaseOrderData,
    UpdatePurchaseOrderData,
    ReceiveItemsData,
} from '@/types/purchase-order'

export function usePurchaseOrders() {
    const purchaseOrders = ref<PurchaseOrder[]>([])
    const purchaseOrder = ref<PurchaseOrder | null>(null)
    const statistics = ref<PurchaseOrderStatistics | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const pagination = ref<any>(null)

    // Fetch all purchase orders
    async function fetchPurchaseOrders(filters?: PurchaseOrderFilters) {
        loading.value = true
        error.value = null
        try {
            const response = await purchaseOrdersService.getAll(filters)
            purchaseOrders.value = response.data
            pagination.value = {
                current_page: response.current_page,
                last_page: response.last_page,
                per_page: response.per_page,
                total: response.total,
            }
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar órdenes de compra'
            console.error('Error fetching purchase orders:', e)
        } finally {
            loading.value = false
        }
    }

    // Fetch single purchase order
    async function fetchPurchaseOrderById(id: number) {
        loading.value = true
        error.value = null
        try {
            const response = await purchaseOrdersService.getById(id)
            purchaseOrder.value = response.data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar orden de compra'
            console.error('Error fetching purchase order:', e)
        } finally {
            loading.value = false
        }
    }

    // Create purchase order
    async function createPurchaseOrder(data: CreatePurchaseOrderData) {
        loading.value = true
        error.value = null
        try {
            const created = await purchaseOrdersService.create(data)
            return created
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al crear orden de compra'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Quick receive (Backorder)
    async function quickReceivePurchaseOrder(data: any) {
        loading.value = true
        error.value = null
        try {
            const created = await purchaseOrdersService.quickReceive(data)
            return created
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al procesar abastecimiento rápido'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Update purchase order
    async function updatePurchaseOrder(id: number, data: UpdatePurchaseOrderData) {
        loading.value = true
        error.value = null
        try {
            const updated = await purchaseOrdersService.update(id, data)
            purchaseOrder.value = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al actualizar orden de compra'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Delete purchase order
    async function deletePurchaseOrder(id: number) {
        loading.value = true
        error.value = null
        try {
            await purchaseOrdersService.delete(id)
            purchaseOrders.value = purchaseOrders.value.filter(po => po.id !== id)
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al eliminar orden de compra'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Send purchase order
    async function sendPurchaseOrder(id: number) {
        loading.value = true
        error.value = null
        try {
            const updated = await purchaseOrdersService.send(id)
            purchaseOrder.value = updated
            // Update in list
            const idx = purchaseOrders.value.findIndex(po => po.id === id)
            if (idx >= 0) purchaseOrders.value[idx] = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al enviar orden de compra'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Receive items
    async function receiveItems(id: number, data: ReceiveItemsData) {
        loading.value = true
        error.value = null
        try {
            const updated = await purchaseOrdersService.receive(id, data)
            purchaseOrder.value = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al recibir mercancía'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Cancel purchase order
    async function cancelPurchaseOrder(id: number) {
        loading.value = true
        error.value = null
        try {
            const updated = await purchaseOrdersService.cancel(id)
            purchaseOrder.value = updated
            const idx = purchaseOrders.value.findIndex(po => po.id === id)
            if (idx >= 0) purchaseOrders.value[idx] = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cancelar orden de compra'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Fetch statistics
    async function fetchStatistics(filters?: { date_from?: string; date_to?: string }) {
        try {
            statistics.value = await purchaseOrdersService.getStatistics(filters)
        } catch (e: any) {
            console.error('Error fetching PO statistics:', e)
        }
    }

    return {
        purchaseOrders,
        purchaseOrder,
        statistics,
        loading,
        error,
        pagination,
        fetchPurchaseOrders,
        fetchPurchaseOrderById,
        createPurchaseOrder,
        updatePurchaseOrder,
        deletePurchaseOrder,
        sendPurchaseOrder,
        receiveItems,
        cancelPurchaseOrder,
        fetchStatistics,
        quickReceivePurchaseOrder,
    }
}
