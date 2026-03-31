import { ref, computed } from 'vue'
import { paymentMethodsService } from '@/services/paymentMethods'
import type { PaymentMethod, CreatePaymentMethodData, UpdatePaymentMethodData } from '@/types/payment-method'

export function usePaymentMethods() {
    const methods = ref<PaymentMethod[]>([])
    const allMethods = ref<PaymentMethod[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Fetch active payment methods (for POS, dropdowns)
    async function fetchMethods() {
        loading.value = true
        error.value = null
        try {
            methods.value = await paymentMethodsService.getActive()
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar métodos de pago'
            console.error('Error fetching payment methods:', e)
        } finally {
            loading.value = false
        }
    }

    // Fetch ALL methods including inactive (admin)
    async function fetchAllMethods() {
        loading.value = true
        error.value = null
        try {
            allMethods.value = await paymentMethodsService.getAll()
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar todos los métodos de pago'
            console.error('Error fetching all payment methods:', e)
        } finally {
            loading.value = false
        }
    }

    // Create payment method
    async function createMethod(data: CreatePaymentMethodData) {
        loading.value = true
        error.value = null
        try {
            const created = await paymentMethodsService.create(data)
            methods.value.push(created)
            allMethods.value.push(created)
            return created
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al crear método de pago'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Update payment method
    async function updateMethod(id: number, data: UpdatePaymentMethodData) {
        loading.value = true
        error.value = null
        try {
            const updated = await paymentMethodsService.update(id, data)
            // Update in both arrays
            const idx = methods.value.findIndex(m => m.id === id)
            if (idx !== -1) methods.value[idx] = updated
            const allIdx = allMethods.value.findIndex(m => m.id === id)
            if (allIdx !== -1) allMethods.value[allIdx] = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al actualizar método de pago'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Archive payment method
    async function archiveMethod(id: number) {
        loading.value = true
        error.value = null
        try {
            await paymentMethodsService.archive(id)
            methods.value = methods.value.filter(m => m.id !== id)
            const allIdx = allMethods.value.findIndex(m => m.id === id)
            if (allIdx !== -1) {
                allMethods.value[allIdx].is_active = false
            }
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al archivar método de pago'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Reorder payment methods
    async function reorderMethods(order: number[]) {
        try {
            await paymentMethodsService.reorder(order)
            // Update local sort_order
            order.forEach((id, index) => {
                const method = methods.value.find(m => m.id === id)
                if (method) method.sort_order = index
                const allMethod = allMethods.value.find(m => m.id === id)
                if (allMethod) allMethod.sort_order = index
            })
            // Re-sort arrays
            methods.value.sort((a, b) => a.sort_order - b.sort_order)
            allMethods.value.sort((a, b) => a.sort_order - b.sort_order)
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al reordenar métodos de pago'
            throw e
        }
    }

    // === Semantic helpers ===

    // Check if method is credit (special logic)
    const isCreditMethod = (code: string) => code === 'credit'

    // Check if method is store_credit (special logic)
    const isStoreCreditMethod = (code: string) => code === 'store_credit'

    // Check if method has special handling (credit or store_credit)
    const isSpecialMethod = (code: string) => isCreditMethod(code) || isStoreCreditMethod(code)

    // Get name by code (for display)
    const getMethodName = (code: string): string => {
        const method = methods.value.find(m => m.code === code)
            || allMethods.value.find(m => m.code === code)
        return method?.name ?? code
    }

    // === Computed helpers ===

    // Standard payment methods (not special)
    const standardMethods = computed(() =>
        methods.value.filter(m => !isSpecialMethod(m.code))
    )

    // Special payment methods (credit, store_credit)
    const specialMethods = computed(() =>
        methods.value.filter(m => isSpecialMethod(m.code))
    )

    // Methods that require cash counting (opening/closing)
    const cashCountMethods = computed(() =>
        methods.value.filter(m => m.requires_cash_count)
    )

    return {
        // State
        methods,
        allMethods,
        loading,
        error,
        // Actions
        fetchMethods,
        fetchAllMethods,
        createMethod,
        updateMethod,
        archiveMethod,
        reorderMethods,
        // Helpers
        isCreditMethod,
        isStoreCreditMethod,
        isSpecialMethod,
        getMethodName,
        // Computed
        standardMethods,
        specialMethods,
        cashCountMethods,
    }
}
