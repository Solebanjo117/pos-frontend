import { ref } from 'vue';
import type { Ref } from 'vue';
import InventoryMovementsApiService from '@/services/inventory-movements';
import type {
    InventoryMovement,
    InventoryMovementFilters,
    CreateInboundMovementRequest,
    CreateOutboundMovementRequest,
    CreateTransferMovementRequest,
} from '@/types/inventory-movement';

export function useInventoryMovements() {
    const movements: Ref<InventoryMovement[]> = ref([]);
    const currentMovement: Ref<InventoryMovement | null> = ref(null);
    const loading: Ref<boolean> = ref(false);
    const error: Ref<string | null> = ref(null);

    // Pagination
    const currentPage: Ref<number> = ref(1);
    const lastPage: Ref<number> = ref(1);
    const total: Ref<number> = ref(0);
    const perPage: Ref<number> = ref(20);

    /**
     * Fetch movements with filters and pagination
     */
    const fetchMovements = async (
        filters: InventoryMovementFilters = {},
        page = 1,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await InventoryMovementsApiService.getMovements(
                filters,
                page,
                perPage.value,
            );
            movements.value = response.data || [];
            currentPage.value = response.meta?.current_page || 1;
            lastPage.value = response.meta?.last_page || 1;
            total.value = response.meta?.total || 0;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar movimientos';
            console.error('Error fetching movements:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch single movement by ID
     */
    const fetchMovement = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            currentMovement.value =
                await InventoryMovementsApiService.getMovementById(id);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar movimiento';
            console.error('Error fetching movement:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Record inbound movement
     */
    const recordInbound = async (
        data: CreateInboundMovementRequest,
    ): Promise<InventoryMovement> => {
        loading.value = true;
        error.value = null;

        try {
            const movement =
                await InventoryMovementsApiService.recordInbound(data);
            movements.value.unshift(movement);
            return movement;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al registrar entrada';
            console.error('Error recording inbound:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Record bulk inbound movement
     */
    const recordBulkInbound = async (data: {
        items: CreateInboundMovementRequest[];
    }): Promise<InventoryMovement[]> => {
        loading.value = true;
        error.value = null;

        try {
            const newMovements =
                await InventoryMovementsApiService.recordBulkInbound(data);
            movements.value.unshift(...newMovements);
            return newMovements;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error al registrar entrada masiva';
            console.error('Error recording bulk inbound:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Record outbound movement
     */
    const recordOutbound = async (
        data: CreateOutboundMovementRequest,
    ): Promise<InventoryMovement> => {
        loading.value = true;
        error.value = null;

        try {
            const movement =
                await InventoryMovementsApiService.recordOutbound(data);
            movements.value.unshift(movement);
            return movement;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al registrar salida';
            console.error('Error recording outbound:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Record bulk outbound movement
     */
    const recordBulkOutbound = async (data: {
        items: CreateOutboundMovementRequest[];
    }): Promise<InventoryMovement[]> => {
        loading.value = true;
        error.value = null;

        try {
            const newMovements =
                await InventoryMovementsApiService.recordBulkOutbound(data);
            movements.value.unshift(...newMovements);
            return newMovements;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error al registrar salida masiva';
            console.error('Error recording bulk outbound:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Record transfer movement
     */
    const recordTransfer = async (
        data: CreateTransferMovementRequest,
    ): Promise<InventoryMovement> => {
        loading.value = true;
        error.value = null;

        try {
            const movement =
                await InventoryMovementsApiService.recordTransfer(data);
            movements.value.unshift(movement);
            return movement;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error al registrar transferencia';
            console.error('Error recording transfer:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Get movements by product
     */
    const fetchMovementsByProduct = async (
        productId: number,
        filters: InventoryMovementFilters = {},
        page = 1,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const response =
                await InventoryMovementsApiService.getMovementsByProduct(
                    productId,
                    filters,
                    page,
                    perPage.value,
                );
            movements.value = response.data || [];
            currentPage.value = response.meta?.current_page || 1;
            lastPage.value = response.meta?.last_page || 1;
            total.value = response.meta?.total || 0;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error al cargar movimientos del producto';
            console.error('Error fetching product movements:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Get movements by warehouse
     */
    const fetchMovementsByWarehouse = async (
        warehouseId: number,
        filters: InventoryMovementFilters = {},
        page = 1,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const response =
                await InventoryMovementsApiService.getMovementsByWarehouse(
                    warehouseId,
                    filters,
                    page,
                    perPage.value,
                );
            movements.value = response.data || [];
            currentPage.value = response.meta?.current_page || 1;
            lastPage.value = response.meta?.last_page || 1;
            total.value = response.meta?.total || 0;
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'Error al cargar movimientos del almacén';
            console.error('Error fetching warehouse movements:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Go to next page
     */
    const nextPage = (filters: InventoryMovementFilters = {}) => {
        if (currentPage.value < lastPage.value) {
            fetchMovements(filters, currentPage.value + 1);
        }
    };

    /**
     * Go to previous page
     */
    const prevPage = (filters: InventoryMovementFilters = {}) => {
        if (currentPage.value > 1) {
            fetchMovements(filters, currentPage.value - 1);
        }
    };

    /**
     * Get related movements
     */
    const fetchRelatedMovements = async (
        id: number,
    ): Promise<InventoryMovement[]> => {
        loading.value = true;
        error.value = null;

        try {
            return await InventoryMovementsApiService.getRelatedMovements(id);
        } catch (err: any) {
            console.error('Error fetching related movements:', err);
            // returning empty array on error to not break UI
            return [];
        } finally {
            loading.value = false;
        }
    };

    return {
        movements,
        currentMovement,
        loading,
        error,
        currentPage,
        lastPage,
        total,
        perPage,
        fetchMovements,
        fetchMovement,
        recordInbound,
        recordBulkInbound,
        recordOutbound,
        recordBulkOutbound,
        recordTransfer,
        fetchMovementsByProduct,
        fetchMovementsByWarehouse,
        nextPage,
        prevPage,
        fetchRelatedMovements,
    };
}
