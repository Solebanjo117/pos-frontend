import { ref } from 'vue';
import { posService, type PosSettings } from '@/services/api/pos';

const settings = ref<PosSettings | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

// Shared warehouse state (singleton)
const CURRENT_WAREHOUSE_KEY = 'pos_current_warehouse_id';
const currentWarehouseId = ref<number | null>(null);

export function usePosSettings() {
    const fetchSettings = async () => {
        // Return cached settings if already loaded
        if (settings.value) {
            return settings.value;
        }

        loading.value = true;
        error.value = null;

        try {
            settings.value = await posService.getSettings();
            return settings.value;
        } catch (err: any) {
            error.value =
                err.message || 'Error al cargar configuración del POS';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const isSingleWarehouseMode = () => {
        return settings.value?.single_warehouse_mode ?? false;
    };

    const getDefaultWarehouse = () => {
        return settings.value?.default_warehouse ?? null;
    };

    const getDefaultWarehouseId = () => {
        return settings.value?.default_warehouse_id ?? null;
    };

    // ==========================================
    // Multi-Warehouse State (Backend + Local Persistence)
    // ==========================================

    // Load warehouse state on init
    const initWarehouse = async () => {
        // Try to fetch from backend first (source of truth)
        try {
            const context = await posService.getWarehouseContext();

            if (context.current_warehouse_id) {
                currentWarehouseId.value = context.current_warehouse_id;
                localStorage.setItem(
                    CURRENT_WAREHOUSE_KEY,
                    String(context.current_warehouse_id),
                );
                return;
            }

            // Single-warehouse mode explicitly defines the only warehouse to select.
            const allowed = context.allowed_warehouses ?? [];
            const posSettings = await fetchSettings();
            const defaultId = posSettings.default_warehouse_id;
            if (
                posSettings.single_warehouse_mode &&
                defaultId &&
                allowed.some((warehouse) => warehouse.id === defaultId)
            ) {
                await posService.setWarehouseContext(defaultId);
                currentWarehouseId.value = defaultId;
                localStorage.setItem(CURRENT_WAREHOUSE_KEY, String(defaultId));
                return;
            }
            // Require an explicit choice when no active warehouse is set.
            currentWarehouseId.value = null;
            localStorage.removeItem(CURRENT_WAREHOUSE_KEY);
            error.value =
                'No tienes una sucursal asignada. Solicita la asignación a un administrador.';
            return;
        } catch (err: any) {
            if (err.response?.status !== 401) {
                console.warn(
                    'Failed to fetch warehouse context from backend:',
                    err.message,
                );
            }
            currentWarehouseId.value = null;
            localStorage.removeItem(CURRENT_WAREHOUSE_KEY);
            error.value =
                'No se pudo verificar la sucursal activa. Inténtalo de nuevo.';
        }
    };

    const setWarehouse = async (id: number) => {
        currentWarehouseId.value = id;
        localStorage.setItem(CURRENT_WAREHOUSE_KEY, String(id));

        // Persist to backend for server-side filtering
        try {
            await posService.setWarehouseContext(id);
        } catch (err) {
            console.error(
                'Failed to persist warehouse context to backend:',
                err,
            );
            // Continue anyway - localStorage will work as fallback
        }
    };

    const isClientMode = () => {
        return settings.value?.client_mode ?? false;
    };

    return {
        settings,
        loading,
        error,
        fetchSettings,
        isSingleWarehouseMode,
        isClientMode,
        getDefaultWarehouse,
        getDefaultWarehouseId,
        // Warehouse context
        currentWarehouseId,
        setWarehouse,
        initWarehouse,
    };
}
