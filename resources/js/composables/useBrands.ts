import { ref } from 'vue'
import { brandsService } from '@/services/brands'
import type { Brand, BrandFilters, CreateBrandData, UpdateBrandData } from '@/types/brand'

export function useBrands() {
    const brands = ref<Brand[]>([])
    const brand = ref<Brand | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const pagination = ref<any>(null)

    // Fetch all brands
    async function fetchBrands(filters?: BrandFilters) {
        loading.value = true
        error.value = null
        try {
            const response = await brandsService.getAll(filters)
            brands.value = response.data
            pagination.value = {
                current_page: response.current_page,
                last_page: response.last_page,
                per_page: response.per_page,
                total: response.total,
            }
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar marcas'
            console.error('Error fetching brands:', e)
        } finally {
            loading.value = false
        }
    }

    // Fetch all active brands (for dropdowns)
    async function fetchActiveBrands() {
        try {
            const data = await brandsService.getAllActive()
            return data as Brand[]
        } catch (e: any) {
            console.error('Error fetching active brands:', e)
            return []
        }
    }

    // Fetch single brand
    async function fetchBrandById(id: number) {
        loading.value = true
        error.value = null
        try {
            const response = await brandsService.getById(id)
            brand.value = response.data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar marca'
            console.error('Error fetching brand:', e)
        } finally {
            loading.value = false
        }
    }

    // Create brand
    async function createBrand(data: CreateBrandData) {
        loading.value = true
        error.value = null
        try {
            const created = await brandsService.create(data)
            return created
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al crear marca'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Update brand
    async function updateBrand(id: number, data: UpdateBrandData) {
        loading.value = true
        error.value = null
        try {
            const updated = await brandsService.update(id, data)
            brand.value = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al actualizar marca'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Delete brand
    async function deleteBrand(id: number) {
        loading.value = true
        error.value = null
        try {
            await brandsService.delete(id)
            brands.value = brands.value.filter(b => b.id !== id)
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al eliminar marca'
            throw e
        } finally {
            loading.value = false
        }
    }

    return {
        brands,
        brand,
        loading,
        error,
        pagination,
        fetchBrands,
        fetchActiveBrands,
        fetchBrandById,
        createBrand,
        updateBrand,
        deleteBrand,
    }
}
