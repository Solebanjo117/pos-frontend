import { ref } from 'vue'
import apiClient from '@/services/api/client'

export interface ProductAttribute {
    id: number
    product_id: number
    variant_id?: number | null
    name: string
    value: string
    unit?: string | null
}

export function useProductAttributes(productId: number, variantId?: number | null) {
    const attributes = ref<ProductAttribute[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Fetch attributes — scoped to product-level OR variant-level
    const fetchAttributes = async () => {
        loading.value = true
        error.value = null
        try {
            const params: Record<string, any> = {}
            if (variantId) params.variant_id = variantId
            const response = await apiClient.get(`/products/${productId}/attributes`, { params })
            attributes.value = response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error loading attributes'
        } finally {
            loading.value = false
        }
    }

    // Add a new attribute, optionally scoped to a variant
    const addAttribute = async (name: string, value: string, unit?: string) => {
        loading.value = true
        error.value = null
        try {
            const payload: Record<string, any> = { product_id: productId, name, value, unit }
            if (variantId) payload.variant_id = variantId
            const response = await apiClient.post('/product-attributes', payload)

            attributes.value.push(response.data.data)
            return response.data.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error adding attribute'
            throw err
        } finally {
            loading.value = false
        }
    }

    // Update an attribute
    const updateAttribute = async (id: number, data: Partial<{ name: string, value: string, unit: string }>) => {
        const index = attributes.value.findIndex(a => a.id === id)
        if (index !== -1) {
            const original = { ...attributes.value[index] }
            Object.assign(attributes.value[index], data)

            try {
                await apiClient.put(`/product-attributes/${id}`, data)
            } catch (err: any) {
                attributes.value[index] = original
                error.value = err.response?.data?.message || 'Error updating attribute'
                throw err
            }
        }
    }

    // Remove an attribute
    const removeAttribute = async (attributeId: number) => {
        const originalList = [...attributes.value]
        attributes.value = attributes.value.filter(a => a.id !== attributeId)

        try {
            await apiClient.delete(`/product-attributes/${attributeId}`)
        } catch (err: any) {
            attributes.value = originalList
            error.value = err.response?.data?.message || 'Error removing attribute'
            alert('Failed to remove attribute')
        }
    }

    return {
        attributes,
        loading,
        error,
        fetchAttributes,
        addAttribute,
        updateAttribute,
        removeAttribute
    }
}
