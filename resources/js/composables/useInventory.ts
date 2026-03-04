import { ref } from 'vue'
import { InventoryApiService } from '@/services/inventory'
import type {
    InventoryItem,
    Warehouse,
    InventoryFilters,
    UpdateInventoryRequest,
} from '@/types/inventory'

export function useInventory() {
    const loading = ref(false)
    const error = ref<string | null>(null)
    const inventory = ref<InventoryItem[]>([])
    const warehouses = ref<Warehouse[]>([])

    const pagination = ref({
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: 0,
    })

    /**
     * Fetch inventory list
     */
    const fetchInventory = async (filters?: InventoryFilters) => {
        loading.value = true
        error.value = null

        try {
            const response = await InventoryApiService.getInventory(filters)
            inventory.value = response.data
            pagination.value = {
                current_page: response.meta.current_page,
                last_page: response.meta.last_page,
                per_page: response.meta.per_page,
                total: response.meta.total,
            }
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al cargar inventario'
            console.error('Inventory fetch error:', err)
        } finally {
            loading.value = false
        }
    }

    /**
     * Fetch warehouses
     */
    const fetchWarehouses = async () => {
        try {
            warehouses.value = await InventoryApiService.getWarehouses()
        } catch (err: any) {
            console.error('Warehouses fetch error:', err)
        }
    }

    /**
     * Update inventory item
     */
    const updateInventory = async (
        productId: number,
        warehouseId: number,
        data: UpdateInventoryRequest
    ) => {
        loading.value = true
        error.value = null

        try {
            const response = await InventoryApiService.updateInventory(productId, warehouseId, data)

            // Update local data
            const index = inventory.value.findIndex(
                (item) => item.product_id === productId && item.warehouse_id === warehouseId
            )
            if (index !== -1) {
                inventory.value[index] = { ...inventory.value[index], ...response.data }
            }

            return response
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al actualizar inventario'
            console.error('Inventory update error:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    return {
        // State
        loading,
        error,
        inventory,
        warehouses,
        pagination,

        // Methods
        fetchInventory,
        fetchWarehouses,
        updateInventory,
    }
}
