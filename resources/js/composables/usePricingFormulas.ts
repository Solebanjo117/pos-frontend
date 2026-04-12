import { ref } from 'vue'
import apiClient from '@/services/api/client'
import type { PricingFormula } from '@/types/pricing-formula'

export function usePricingFormulas() {
    const formulas = ref<PricingFormula[]>([])
    const activeFormulas = ref<PricingFormula[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const fetchFormulas = async () => {
        loading.value = true
        error.value = null
        try {
            const { data } = await apiClient.get('/pricing-formulas')
            formulas.value = data.data || data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error fetching formulas'
            console.error('fetchFormulas error', e)
        } finally {
            loading.value = false
        }
    }

    const fetchActiveFormulas = async () => {
        loading.value = true
        error.value = null
        try {
            const { data } = await apiClient.get('/pricing-formulas/active')
            activeFormulas.value = data.data || data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error fetching active formulas'
        } finally {
            loading.value = false
        }
    }

    const createFormula = async (payload: Partial<PricingFormula>) => {
        try {
            const { data } = await apiClient.post('/pricing-formulas', payload)
            await fetchFormulas()
            return data.data
        } catch (e: any) {
            throw new Error(e.response?.data?.message || 'Error creating formula')
        }
    }

    const updateFormula = async (id: number, payload: Partial<PricingFormula>) => {
        try {
            const { data } = await apiClient.put(`/pricing-formulas/${id}`, payload)
            await fetchFormulas()
            return data.data
        } catch (e: any) {
            throw new Error(e.response?.data?.message || 'Error updating formula')
        }
    }

    const deleteFormula = async (id: number) => {
        try {
            await apiClient.delete(`/pricing-formulas/${id}`)
            await fetchFormulas()
        } catch (e: any) {
            throw new Error(e.response?.data?.message || 'Error deleting formula')
        }
    }

    const previewFormula = async (formula: string, cost: number, taxRate?: number) => {
        try {
            const { data } = await apiClient.post('/pricing-formulas/preview', {
                formula,
                cost,
                tax_rate: taxRate
            })
            return data
        } catch (e: any) {
            throw new Error(e.response?.data?.message || 'Error previewing formula')
        }
    }

    return {
        formulas,
        activeFormulas,
        loading,
        error,
        fetchFormulas,
        fetchActiveFormulas,
        createFormula,
        updateFormula,
        deleteFormula,
        previewFormula
    }
}
