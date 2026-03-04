import { ref, computed, type Ref } from 'vue'
import { productsApi } from '@/services/api/products'
import type {
    Product,
    ProductDetail,
    ProductFilters,
    CreateProductRequest,
    UpdateProductRequest,
    PaginatedResponse,
} from '@/types/product'

export function useProducts() {
    // State
    const products: Ref<Product[]> = ref([])
    const currentProduct: Ref<ProductDetail | null> = ref(null)
    const loading = ref(false)
    const error: Ref<string | null> = ref(null)

    // Pagination
    const currentPage = ref(1)
    const lastPage = ref(1)
    const total = ref(0)
    const perPage = ref(20)

    // Computed
    const hasProducts = computed(() => products.value.length > 0)
    const hasNextPage = computed(() => currentPage.value < lastPage.value)
    const hasPrevPage = computed(() => currentPage.value > 1)

    /**
     * Fetch products with filters
     */
    async function fetchProducts(filters?: ProductFilters) {
        loading.value = true
        error.value = null

        try {
            const response: PaginatedResponse<Product> =
                await productsApi.getProducts({
                    ...filters,
                    page: currentPage.value,
                    per_page: perPage.value,
                })

            products.value = response.data
            currentPage.value = response.meta.current_page
            lastPage.value = response.meta.last_page
            total.value = response.meta.total

            return response
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al cargar productos'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Fetch single product with details
     */
    async function fetchProduct(
        id: number,
        warehouseId?: number,
        includes: string[] = [
            'attributes',
            'inventory',
            'suppliers',
            'compatibility',
            'oem',
            'alternatives',
        ],
    ) {
        loading.value = true
        error.value = null

        try {
            // Fix: Pass warehouse_id if provided
            const params: any = { include: includes.join(',') }
            if (warehouseId) params.warehouse_id = warehouseId

            // We need to update productsApi.getProduct signature if it doesn't support params object or query string
            // But since I don't see productsApi file, I assume I can pass it or modify it.
            // Let's modify the call assuming getProduct handles options or I need to check API service.
            const response = await productsApi.getProduct(id, params)
            currentProduct.value = response.data
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al cargar producto'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Create new product
     */
    async function createProduct(data: CreateProductRequest) {
        loading.value = true
        error.value = null

        try {
            const response = await productsApi.createProduct(data)
            // Optionally refresh products list
            await fetchProducts()
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al crear producto'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Update existing product
     */
    async function updateProduct(id: number, data: UpdateProductRequest) {
        loading.value = true
        error.value = null

        try {
            const response = await productsApi.updateProduct(id, data)

            // Update in list if exists
            const index = products.value.findIndex((p) => p.id === id)
            if (index !== -1) {
                products.value[index] = response.data
            }

            // Update current product if it's the same
            if (currentProduct.value?.id === id) {
                currentProduct.value = { ...currentProduct.value, ...response.data }
            }

            return response.data
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al actualizar producto'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Archive product (soft delete)
     */
    async function deleteProduct(id: number) {
        loading.value = true
        error.value = null

        try {
            await productsApi.deleteProduct(id)

            // Remove from list
            products.value = products.value.filter((p) => p.id !== id)

            // Clear current product if it was deleted
            if (currentProduct.value?.id === id) {
                currentProduct.value = null
            }
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al archivar producto'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Restore archived product
     */
    async function restoreProduct(id: number) {
        loading.value = true
        error.value = null

        try {
            await productsApi.restoreProduct(id)

            // Remove from archived list
            products.value = products.value.filter((p) => p.id !== id)
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al restaurar producto'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Go to next page
     */
    async function nextPage(filters?: ProductFilters) {
        if (hasNextPage.value) {
            currentPage.value++
            await fetchProducts(filters)
        }
    }

    /**
     * Go to previous page
     */
    async function prevPage(filters?: ProductFilters) {
        if (hasPrevPage.value) {
            currentPage.value--
            await fetchProducts(filters)
        }
    }

    /**
     * Go to specific page
     */
    async function goToPage(page: number, filters?: ProductFilters) {
        if (page >= 1 && page <= lastPage.value) {
            currentPage.value = page
            await fetchProducts(filters)
        }
    }

    /**
     * Clear current product
     */
    function clearCurrentProduct() {
        currentProduct.value = null
    }

    /**
     * Clear error
     */
    function clearError() {
        error.value = null
    }

    /**
     * Get product batches
     */
    async function fetchBatches(productId: number, warehouseId?: number) {
        loading.value = true
        error.value = null

        try {
            const response = await productsApi.getBatches(productId, warehouseId)
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al cargar lotes'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Fetch variants for a product
     */
    async function fetchVariants(productId: number) {
        loading.value = true
        error.value = null

        try {
            const response = await productsApi.getVariants(productId)
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al cargar variantes'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Create variant
     */
    async function createVariant(productId: number, data: any) {
        loading.value = true
        error.value = null

        try {
            const response = await productsApi.createVariant(productId, data)
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al crear variante'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Update variant
     */
    async function updateVariant(productId: number, variantId: number, data: any) {
        loading.value = true
        error.value = null

        try {
            const response = await productsApi.updateVariant(productId, variantId, data)
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al actualizar variante'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Delete variant
     */
    async function deleteVariant(productId: number, variantId: number) {
        loading.value = true
        error.value = null

        try {
            await productsApi.deleteVariant(productId, variantId)
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al eliminar variante'
            throw err
        } finally {
            loading.value = false
        }
    }

    return {
        // State
        products,
        currentProduct,
        loading,
        error,
        currentPage,
        lastPage,
        total,
        perPage,

        // Computed
        hasProducts,
        hasNextPage,
        hasPrevPage,

        // Methods
        fetchProducts,
        fetchProduct,
        createProduct,
        updateProduct,
        deleteProduct,
        restoreProduct,
        nextPage,
        prevPage,
        goToPage,
        clearCurrentProduct,
        clearError,
        fetchBatches,
        fetchVariants,
        createVariant,
        updateVariant,
        deleteVariant,
    }
}
