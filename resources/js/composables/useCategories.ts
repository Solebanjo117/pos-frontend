import { ref } from 'vue'
import { categoriesService } from '@/services/categories'
import type { Category, CategoryFilters, CreateCategoryData, UpdateCategoryData } from '@/types/category'

export function useCategories() {
    const categories = ref<Category[]>([])
    const category = ref<Category | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Fetch all categories
    async function fetchCategories(filters?: CategoryFilters) {
        loading.value = true
        error.value = null
        try {
            const data = await categoriesService.getAll(filters)
            categories.value = data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar categorías'
            console.error('Error fetching categories:', e)
        } finally {
            loading.value = false
        }
    }

    // Fetch categories as tree
    async function fetchCategoryTree() {
        loading.value = true
        error.value = null
        try {
            const data = await categoriesService.getTree()
            categories.value = data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar árbol de categorías'
            console.error('Error fetching category tree:', e)
        } finally {
            loading.value = false
        }
    }

    // Fetch categories with parent
    async function fetchCategoriesWithParent() {
        loading.value = true
        error.value = null
        try {
            const data = await categoriesService.getAllWithParent()
            return data as Category[]
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar categorías'
            console.error('Error fetching categories with parent:', e)
            return []
        } finally {
            loading.value = false
        }
    }

    // Fetch single category
    async function fetchCategoryById(id: number) {
        loading.value = true
        error.value = null
        try {
            const data = await categoriesService.getById(id)
            category.value = data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar categoría'
            console.error('Error fetching category:', e)
        } finally {
            loading.value = false
        }
    }

    // Create category
    async function createCategory(data: CreateCategoryData) {
        loading.value = true
        error.value = null
        try {
            const created = await categoriesService.create(data)
            return created
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al crear categoría'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Update category
    async function updateCategory(id: number, data: UpdateCategoryData) {
        loading.value = true
        error.value = null
        try {
            const updated = await categoriesService.update(id, data)
            category.value = updated
            return updated
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al actualizar categoría'
            throw e
        } finally {
            loading.value = false
        }
    }

    // Delete category
    async function deleteCategory(id: number) {
        loading.value = true
        error.value = null
        try {
            await categoriesService.delete(id)
            categories.value = categories.value.filter(c => c.id !== id)
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al eliminar categoría'
            throw e
        } finally {
            loading.value = false
        }
    }

    return {
        categories,
        category,
        loading,
        error,
        fetchCategories,
        fetchCategoryTree,
        fetchCategoriesWithParent,
        fetchCategoryById,
        createCategory,
        updateCategory,
        deleteCategory,
    }
}
