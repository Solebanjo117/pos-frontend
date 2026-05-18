import { ref } from 'vue';
import type { Ref } from 'vue';
import WarehousesApiService from '@/services/warehouses';
import type {
    Warehouse,
    WarehouseFilters,
    CreateWarehouseRequest,
    UpdateWarehouseRequest,
} from '@/types/warehouse';

export function useWarehouses() {
    const warehouses: Ref<Warehouse[]> = ref([]);
    const currentWarehouse: Ref<Warehouse | null> = ref(null);
    const loading: Ref<boolean> = ref(false);
    const error: Ref<string | null> = ref(null);

    // Pagination
    const currentPage: Ref<number> = ref(1);
    const lastPage: Ref<number> = ref(1);
    const total: Ref<number> = ref(0);
    const perPage: Ref<number> = ref(20);

    /**
     * Fetch warehouses with filters and pagination
     */
    const fetchWarehouses = async (
        filters: WarehouseFilters = {},
        page = 1,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await WarehousesApiService.getWarehouses(
                filters,
                page,
                perPage.value,
            );
            warehouses.value = response.data || [];
            currentPage.value = response.meta?.current_page || 1;
            lastPage.value = response.meta?.last_page || 1;
            total.value = response.meta?.total || 0;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar almacenes';
            console.error('Error fetching warehouses:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch single warehouse by ID
     */
    const fetchWarehouse = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            currentWarehouse.value =
                await WarehousesApiService.getWarehouseById(id);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar almacén';
            console.error('Error fetching warehouse:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Create new warehouse
     */
    const createWarehouse = async (data: CreateWarehouseRequest) => {
        loading.value = true;
        error.value = null;

        try {
            const newWarehouse =
                await WarehousesApiService.createWarehouse(data);
            warehouses.value.unshift(newWarehouse);
            return newWarehouse;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al crear almacén';
            console.error('Error creating warehouse:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Update warehouse
     */
    const updateWarehouse = async (
        id: number,
        data: UpdateWarehouseRequest,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const updatedWarehouse = await WarehousesApiService.updateWarehouse(
                id,
                data,
            );
            const index = warehouses.value.findIndex((w) => w.id === id);
            if (index !== -1) {
                warehouses.value[index] = updatedWarehouse;
            }
            currentWarehouse.value = updatedWarehouse;
            return updatedWarehouse;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al actualizar almacén';
            console.error('Error updating warehouse:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Delete warehouse
     */
    const deleteWarehouse = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            await WarehousesApiService.deleteWarehouse(id);
            warehouses.value = warehouses.value.filter((w) => w.id !== id);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al eliminar almacén';
            console.error('Error deleting warehouse:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Go to next page
     */
    const nextPage = (filters: WarehouseFilters = {}) => {
        if (currentPage.value < lastPage.value) {
            fetchWarehouses(filters, currentPage.value + 1);
        }
    };

    /**
     * Go to previous page
     */
    const prevPage = (filters: WarehouseFilters = {}) => {
        if (currentPage.value > 1) {
            fetchWarehouses(filters, currentPage.value - 1);
        }
    };

    return {
        warehouses,
        currentWarehouse,
        loading,
        error,
        currentPage,
        lastPage,
        total,
        perPage,
        fetchWarehouses,
        fetchWarehouse,
        createWarehouse,
        updateWarehouse,
        deleteWarehouse,
        nextPage,
        prevPage,
    };
}
