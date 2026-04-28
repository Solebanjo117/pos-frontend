import { ref } from 'vue'
import { suppliersService } from '@/services/suppliers'
import { brandsService } from '@/services/brands'
import type { Supplier, SupplierFilters, CreateSupplierData, UpdateSupplierData } from '@/types/supplier'

type BrandOption = { id: number; name: string }

export function useSuppliers() {
    const suppliers = ref<Supplier[]>([])
    const supplier = ref<Supplier | null>(null)
    const supplierProducts = ref<any[]>([])
    const supplierBrands = ref<BrandOption[]>([])
    const availableBrands = ref<BrandOption[]>([])
    const loadingBrands = ref(false)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const pagination = ref<any>(null)

    // Fetch all suppliers
    async function fetchSuppliers(filters?: SupplierFilters) {
        loading.value = true
        error.value = null
        try {
            const response = await suppliersService.getAll(filters)
            suppliers.value = response.data
            pagination.value = {
                current_page: response.current_page,
                last_page: response.last_page,
                per_page: response.per_page,
                total: response.total,
            }
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar proveedores'
            console.error('Error fetching suppliers:', e)
        } finally {
            loading.value = false
        }
    }

    // Fetch all active suppliers (for dropdowns)
    async function fetchActiveSuppliers() {
        try {
            const data = await suppliersService.getAllActive()
            return data as Supplier[]
        } catch (e: any) {
            console.error('Error fetching active suppliers:', e)
            return []
        }
    }

    // Fetch single supplier
    async function fetchSupplierById(id: number) {
        loading.value = true
        error.value = null
        try {
            const response = await suppliersService.getById(id)
            supplier.value = response.data
            supplierProducts.value = response.products || []
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar proveedor'
            console.error('Error fetching supplier:', e)
        } finally {
            loading.value = false
        }
    }

    // Create supplier
    async function createSupplier(data: CreateSupplierData) {
        loading.value = true
        error.value = null
        try {
            const created = await suppliersService.create(data)
            return created
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al crear proveedor'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Update supplier
    async function updateSupplier(id: number, data: UpdateSupplierData) {
        loading.value = true
        error.value = null
        try {
            const updated = await suppliersService.update(id, data)
            supplier.value = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al actualizar proveedor'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Delete supplier
    async function deleteSupplier(id: number) {
        loading.value = true
        error.value = null
        try {
            await suppliersService.delete(id)
            suppliers.value = suppliers.value.filter(s => s.id !== id)
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al eliminar proveedor'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Fetch brands associated with a supplier
    async function fetchSupplierBrands(id: number) {
        loadingBrands.value = true
        try {
            supplierBrands.value = await suppliersService.getBrands(id)
        } catch (e: any) {
            console.error('Error fetching supplier brands:', e)
            supplierBrands.value = []
        } finally {
            loadingBrands.value = false
        }
    }

    // Fetch all active brands for selection dropdown
    async function fetchAvailableBrands() {
        try {
            availableBrands.value = await brandsService.getAllActive()
        } catch (e: any) {
            console.error('Error fetching available brands:', e)
            availableBrands.value = []
        }
    }

    // Attach a brand to a supplier
    async function attachBrandToSupplier(supplierId: number, brandId: number) {
        try {
            await suppliersService.attachBrand(supplierId, brandId)
            await fetchSupplierBrands(supplierId)
        } catch (e: any) {
            console.error('Error attaching brand:', e)
            throw e
        }
    }

    // Detach a brand from a supplier
    async function detachBrandFromSupplier(supplierId: number, brandId: number) {
        try {
            await suppliersService.detachBrand(supplierId, brandId)
            supplierBrands.value = supplierBrands.value.filter(b => b.id !== brandId)
        } catch (e: any) {
            console.error('Error detaching brand:', e)
            throw e
        }
    }

    return {
        suppliers,
        supplier,
        supplierProducts,
        supplierBrands,
        availableBrands,
        loadingBrands,
        loading,
        error,
        pagination,
        fetchSuppliers,
        fetchActiveSuppliers,
        fetchSupplierById,
        createSupplier,
        updateSupplier,
        deleteSupplier,
        fetchSupplierBrands,
        fetchAvailableBrands,
        attachBrandToSupplier,
        detachBrandFromSupplier,
    }
}
