<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useCategories } from '@/composables/useCategories'
import { Search, Plus, Pencil, Trash2, Folder } from 'lucide-vue-next'
import type { Category } from '@/types/category'

const { categories, loading, error, fetchCategoriesWithParent, deleteCategory } = useCategories()

const searchQuery = ref('')

// Categories with parent info for display
const categoriesWithParent = ref<Category[]>([])

// Compute filtered categories
const filteredCategories = computed(() => {
    if (!searchQuery.value) return categoriesWithParent.value
    
    const query = searchQuery.value.toLowerCase()
    return categoriesWithParent.value.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.parent?.name.toLowerCase().includes(query)
    )
})

async function loadCategories() {
    categoriesWithParent.value = await fetchCategoriesWithParent()
}

function getCategoryDisplayName(category: Category): string {
    if (category.parent) {
        return `${category.parent.name} → ${category.name}`
    }
    return category.name
}

async function handleDelete(id: number) {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return
    try {
        await deleteCategory(id)
        await loadCategories()
    } catch (e) {
        // Error handled in composable
    }
}

onMounted(async () => {
    await loadCategories()
})
</script>

<template>
    <Head title="Categorías" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Categorías</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gestiona las categorías de productos
                    </p>
                </div>
                <Link
                    href="/categories/create"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                    <Plus :size="20" />
                    Nueva Categoría
                </Link>
            </div>

            <!-- Search -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buscar</label>
                        <div class="relative">
                            <Search class="absolute left-3 top-2.5 text-gray-400" :size="18" />
                            <input
                                v-model="searchQuery"
                                type="text"
                                placeholder="Nombre de categoría..."
                                class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Table -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoría</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prioridad</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Productos</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            <tr v-if="loading">
                                <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                                    <div class="flex items-center justify-center gap-2">
                                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                                        Cargando...
                                    </div>
                                </td>
                            </tr>
                            <tr v-else-if="filteredCategories.length === 0">
                                <td colspan="5" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <Folder class="mx-auto mb-3 text-gray-300" :size="48" />
                                    <p>No se encontraron categorías</p>
                                </td>
                            </tr>
                            <tr v-for="cat in filteredCategories" :key="cat.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-3">
                                        <Folder class="text-gray-400" :size="20" />
                                        <div>
                                            <p class="text-indigo-600 dark:text-indigo-400 font-medium">
                                                {{ getCategoryDisplayName(cat) }}
                                            </p>
                                            <p v-if="cat.slug" class="text-xs text-gray-500">{{ cat.slug }}</p>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                    {{ cat.description || '—' }}
                                </td>
                                <td class="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                                    {{ cat.priority ?? 0 }}
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                        {{ cat.products_count || 0 }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <Link :href="`/categories/${cat.id}/edit`" class="p-2 text-gray-400 hover:text-indigo-600 transition">
                                            <Pencil :size="16" />
                                        </Link>
                                        <button @click="handleDelete(cat.id)" class="p-2 text-gray-400 hover:text-red-600 transition">
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
