import { ref } from 'vue'
import { posService, type PosSettings } from '@/services/api/pos'

const settings = ref<PosSettings | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

export function usePosSettings() {
    const fetchSettings = async () => {
        // Return cached settings if already loaded
        if (settings.value) {
            return settings.value
        }

        loading.value = true
        error.value = null

        try {
            settings.value = await posService.getSettings()
            return settings.value
        } catch (err: any) {
            error.value = err.message || 'Error al cargar configuración del POS'
            throw err
        } finally {
            loading.value = false
        }
    }

    const isSingleWarehouseMode = () => {
        return settings.value?.single_warehouse_mode ?? false
    }

    const getDefaultWarehouse = () => {
        return settings.value?.default_warehouse ?? null
    }

    const getDefaultWarehouseId = () => {
        return settings.value?.default_warehouse_id ?? null
    }

    // ==========================================
    // Multi-Warehouse State (Backend + Local Persistence)
    // ==========================================
    const CURRENT_WAREHOUSE_KEY = 'pos_current_warehouse_id'

    const currentWarehouseId = ref<number | null>(null)

    // Load warehouse state on init
    const initWarehouse = async () => {
        // Try to fetch from backend first (source of truth)
        try {
            const context = await posService.getWarehouseContext()

            if (context.current_warehouse_id) {
                currentWarehouseId.value = context.current_warehouse_id
                localStorage.setItem(CURRENT_WAREHOUSE_KEY, String(context.current_warehouse_id))
                return
            }

            // Backend returned null for current_warehouse_id — pick first allowed warehouse
            const allowed = context.allowed_warehouses ?? []
            if (allowed.length > 0) {
                const firstId = allowed[0].id
                currentWarehouseId.value = firstId
                localStorage.setItem(CURRENT_WAREHOUSE_KEY, String(firstId))
                try { await posService.setWarehouseContext(firstId) } catch { }
                return
            }

            // User has no warehouses assigned at all — leave as null
            currentWarehouseId.value = null
            localStorage.removeItem(CURRENT_WAREHOUSE_KEY)
            return
        } catch (err: any) {
            // If 401, silently fall back
            if (err.response?.status !== 401) {
                console.warn('Failed to fetch warehouse context from backend:', err.message)
            }
        }

        // Fallback to localStorage (backend was unreachable)
        const stored = localStorage.getItem(CURRENT_WAREHOUSE_KEY)
        if (stored) {
            currentWarehouseId.value = Number(stored)
            // Try to sync — if 403 the stored warehouse is not allowed, clear it
            try {
                await posService.setWarehouseContext(Number(stored))
            } catch (err: any) {
                if (err.response?.status === 403) {
                    localStorage.removeItem(CURRENT_WAREHOUSE_KEY)
                    currentWarehouseId.value = null
                }
            }
        }
        // Do NOT default to warehouse 1 — the user may not have access to it
    }

    const setWarehouse = async (id: number) => {
        currentWarehouseId.value = id
        localStorage.setItem(CURRENT_WAREHOUSE_KEY, String(id))

        // Persist to backend for server-side filtering
        try {
            await posService.setWarehouseContext(id)
        } catch (err) {
            console.error('Failed to persist warehouse context to backend:', err)
            // Continue anyway - localStorage will work as fallback
        }
    }

    const isClientMode = () => {
        return settings.value?.client_mode ?? false
    }

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
        initWarehouse
    }
}
