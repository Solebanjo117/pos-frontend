<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSuppliers } from '@/composables/useSuppliers'
import { Search, Plus, Pencil, Trash2, Building2, Package, Upload } from 'lucide-vue-next'
import Pagination from '@/components/Pagination.vue'
import type { SupplierFilters } from '@/types/supplier'

const { suppliers, loading, error, pagination, fetchSuppliers, deleteSupplier } = useSuppliers()

const filters = ref<SupplierFilters>({
    search: '',
    status: undefined,
    per_page: 15,
})

const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
]

async function loadSuppliers(page: number = 1) {
    const cleanFilters = { ...filters.value, page }
    if (!cleanFilters.status) delete cleanFilters.status
    if (!cleanFilters.search) delete cleanFilters.search
    await fetchSuppliers(cleanFilters)
}

async function handlePageChange(page: number) {
    await loadSuppliers(page)
}

async function handleDelete(id: number) {
    if (!confirm('¿Estás seguro de eliminar este proveedor?')) return
    try {
        await deleteSupplier(id)
        await loadSuppliers()
    } catch (e) {
        // Error handled in composable
    }
}

onMounted(async () => {
    await loadSuppliers()
})
</script>

<template>
    <Head title="Proveedores" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Proveedores</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gestiona tus proveedores y su información de contacto
                    </p>
                </div>
                <Link
                    href="/suppliers/create"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition"
                >
                    <Plus :size="20" />
                    Nuevo Proveedor
                </Link>
                <Link
                    href="/suppliers/import"
                    class="inline-flex items-center gap-2 px-4 py-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30 text-emerald-700 rounded-lg transition"
                >
                    <Upload :size="20" />
                    Importar
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
                                placeholder="Nombre, contacto, email..."
                                class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
                                @input="() => loadSuppliers(1)"
                            />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estado</label>
                        <select
                            v-model="filters.status"
                            class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
                            @change="() => loadSuppliers(1)"
                        >
                            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </select>
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
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proveedor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contacto</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teléfono</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Productos</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                            <tr v-if="loading">
                                <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                                    <div class="flex items-center justify-center gap-2">
                                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 dark:border-primary"></div>
                                        Cargando...
                                    </div>
                                </td>
                            </tr>
                            <tr v-else-if="suppliers.length === 0">
                                <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <Building2 class="mx-auto mb-3 text-gray-300" :size="48" />
                                    <p>No se encontraron proveedores</p>
                                </td>
                            </tr>
                            <tr v-for="s in suppliers" :key="s.id" class="hover:bg-gray-50 dark:hover:bg-muted/50/50 transition">
                                <td class="px-6 py-4">
                                    <Link :href="`/suppliers/${s.id}`" class="text-indigo-600 dark:text-primary dark:text-indigo-400 hover:underline font-medium">
                                        {{ s.name }}
                                    </Link>
                                    <p v-if="s.email" class="text-sm text-gray-500 dark:text-gray-400">{{ s.email }}</p>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{{ s.contact_name || '—' }}</td>
                                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{{ s.phone || '—' }}</td>
                                <td class="px-6 py-4 text-center">
                                    <span class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                        <Package :size="14" />
                                        {{ s.products_count || 0 }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span
                                        :class="[
                                            'px-2 py-1 text-xs font-semibold rounded-full',
                                            s.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-400',
                                        ]"
                                    >
                                        {{ s.status === 'active' ? 'Activo' : 'Inactivo' }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <Link :href="`/suppliers/${s.id}/edit`" class="p-2 text-gray-400 hover:text-indigo-600 dark:text-primary transition">
                                            <Pencil :size="16" />
                                        </Link>
                                        <button @click="handleDelete(s.id)" class="p-2 text-gray-400 hover:text-red-600 transition">
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
