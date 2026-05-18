<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useBrands } from '@/composables/useBrands';
import { useToast } from '@/composables/useToast';
import { Search, Plus, Pencil, Trash2, Tag, Upload } from 'lucide-vue-next';
import Pagination from '@/components/Pagination.vue';
import type { BrandFilters } from '@/types/brand';

const { brands, loading, error, pagination, fetchBrands, deleteBrand } =
    useBrands();
const toast = useToast();

const filters = ref<BrandFilters>({
    search: '',
    per_page: 15,
});

async function loadBrands(page: number = 1) {
    const cleanFilters = { ...filters.value, page };
    if (!cleanFilters.search) delete cleanFilters.search;
    await fetchBrands(cleanFilters);
}

async function handlePageChange(page: number) {
    await loadBrands(page);
}

async function handleDelete(id: number) {
    if (!confirm('¿Estás seguro de eliminar esta marca?')) return;
    try {
        await deleteBrand(id);
        toast.success('Marca eliminada correctamente');
        await loadBrands();
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al eliminar la marca');
    }
}

onMounted(async () => {
    await loadBrands();
});
</script>

<template>
    <Head title="Marcas" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Marcas
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gestiona las marcas de productos
                    </p>
                </div>
                <Link
                    href="/brands/create"
                    class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Plus :size="20" />
                    Nueva Marca
                </Link>
                <Link
                    href="/brands/import"
                    class="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                >
                    <Upload :size="20" />
                    Importar
                </Link>
            </div>

            <!-- Filters -->
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Buscar</label
                        >
                        <div class="relative">
                            <Search
                                class="absolute top-2.5 left-3 text-gray-400"
                                :size="18"
                            />
                            <input
                                v-model="filters.search"
                                type="text"
                                placeholder="Nombre de marca..."
                                class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                @input="() => loadBrands(1)"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
            >
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Table -->
            <div
                class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Marca
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Descripción
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Sitio Web
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Productos
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                        >
                            <tr v-if="loading">
                                <td
                                    colspan="5"
                                    class="px-6 py-12 text-center text-gray-500"
                                >
                                    <div
                                        class="flex items-center justify-center gap-2"
                                    >
                                        <div
                                            class="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
                                        ></div>
                                        Cargando...
                                    </div>
                                </td>
                            </tr>
                            <tr v-else-if="brands.length === 0">
                                <td
                                    colspan="5"
                                    class="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                                >
                                    <Tag
                                        class="mx-auto mb-3 text-gray-300"
                                        :size="48"
                                    />
                                    <p>No se encontraron marcas</p>
                                </td>
                            </tr>
                            <tr
                                v-for="b in brands"
                                :key="b.id"
                                class="dark:hover:bg-muted/50/50 transition hover:bg-gray-50"
                            >
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-3">
                                        <img
                                            v-if="b.logo_url"
                                            :src="b.logo_url"
                                            :alt="b.name"
                                            class="h-10 w-10 rounded bg-gray-100 object-contain dark:bg-muted"
                                        />
                                        <div>
                                            <Link
                                                :href="`/brands/${b.id}/edit`"
                                                class="font-medium text-indigo-600 hover:underline dark:text-indigo-400 dark:text-primary"
                                            >
                                                {{ b.name }}
                                            </Link>
                                        </div>
                                    </div>
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ b.description || '—' }}
                                </td>
                                <td class="px-6 py-4 text-sm">
                                    <a
                                        v-if="b.website"
                                        :href="b.website"
                                        target="_blank"
                                        class="text-blue-600 hover:underline dark:text-blue-400 dark:text-primary"
                                    >
                                        {{ b.website }}
                                    </a>
                                    <span v-else class="text-gray-500">—</span>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span
                                        class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        {{ b.product_variants_count || 0 }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div
                                        class="flex items-center justify-end gap-2"
                                    >
                                        <Link
                                            :href="`/brands/${b.id}/edit`"
                                            class="p-2 text-gray-400 transition hover:text-indigo-600 dark:text-primary"
                                        >
                                            <Pencil :size="16" />
                                        </Link>
                                        <button
                                            @click="handleDelete(b.id)"
                                            class="p-2 text-gray-400 transition hover:text-red-600"
                                        >
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
