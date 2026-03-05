<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useBrands } from '@/composables/useBrands'
import { useToast } from '@/composables/useToast'
import { Search, Plus, Pencil, Trash2, Tag } from 'lucide-vue-next'
import Pagination from '@/components/Pagination.vue'
import type { BrandFilters } from '@/types/brand'

const { brands, loading, error, pagination, fetchBrands, deleteBrand } = useBrands()
const toast = useToast()

const filters = ref<BrandFilters>({
    search: '',
    per_page: 15,
})

async function loadBrands(page: number = 1) {
    const cleanFilters = { ...filters.value, page }
    if (!cleanFilters.search) delete cleanFilters.search
    await fetchBrands(cleanFilters)
}

async function handlePageChange(page: number) {
    await loadBrands(page)
}

async function handleDelete(id: number) {
    if (!confirm('¿Estás seguro de eliminar esta marca?')) return
    try {
        await deleteBrand(id)
        toast.success('Marca eliminada correctamente')
        await loadBrands()
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al eliminar la marca')
    }
}

onMounted(async () => {
    await loadBrands()
})
</script>

<template>
    <Head title="Marcas" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Marcas</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gestiona las marcas de productos
                    </p>
                </div>
                <Link
                    href="/brands/create"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition"
                >
                    <Plus :size="20" />
                    Nueva Marca
                </Link>
            </div>

            <!-- Filters -->
            <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buscar</label>
                        <div class="relative">
                            <Search class="absolute left-3 top-2.5 text-gray-400" :size="18" />
                            <input
                                v-model="filters.search"
                                type="text"
                                placeholder="Nombre de marca..."
                                class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
                                @input="() => loadBrands(1)"
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
            <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Marca</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sitio Web</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Productos</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                            <tr v-if="loading">
                                <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                                    <div class="flex items-center justify-center gap-2">
                                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 dark:border-primary"></div>
                                        Cargando...
                                    </div>
                                </td>
                            </tr>
                            <tr v-else-if="brands.length === 0">
                                <td colspan="5" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <Tag class="mx-auto mb-3 text-gray-300" :size="48" />
                                    <p>No se encontraron marcas</p>
                                </td>
                            </tr>
                            <tr v-for="b in brands" :key="b.id" class="hover:bg-gray-50 dark:hover:bg-muted/50/50 transition">
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-3">
                                        <img 
                                            v-if="b.logo_url" 
                                            :src="b.logo_url" 
                                            :alt="b.name"
                                            class="w-10 h-10 object-contain bg-gray-100 dark:bg-muted rounded"
                                        />
                                        <div>
                                            <p class="text-indigo-600 dark:text-primary dark:text-indigo-400 hover:underline font-medium">
                                                {{ b.name }}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                    {{ b.description || '—' }}
                                </td>
                                <td class="px-6 py-4 text-sm">
                                    <a 
                                        v-if="b.website" 
                                        :href="b.website" 
                                        target="_blank" 
                                        class="text-blue-600 dark:text-primary hover:underline dark:text-blue-400"
                                    >
                                        {{ b.website }}
                                    </a>
                                    <span v-else class="text-gray-500">—</span>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                        {{ b.product_variants_count || 0 }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <Link :href="`/brands/${b.id}/edit`" class="p-2 text-gray-400 hover:text-indigo-600 dark:text-primary transition">
                                            <Pencil :size="16" />
                                        </Link>
                                        <button @click="handleDelete(b.id)" class="p-2 text-gray-400 hover:text-red-600 transition">
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <Pagination 
                    v-if="pagination && pagination.last_page > 1" 
                    :pagination="pagination"
                    :loading="loading"
                    @page-change="handlePageChange"
                />
            </div>
        </div>
    </AppLayout>
</template>
