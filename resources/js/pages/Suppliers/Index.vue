<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useSuppliers } from '@/composables/useSuppliers';
import {
    Search,
    Plus,
    Pencil,
    Trash2,
    AlertTriangle,
    Building2,
    Package,
    Upload,
} from 'lucide-vue-next';
import Pagination from '@/components/Pagination.vue';
import { suppliersService } from '@/services/suppliers';
import type {
    SupplierCommercialDashboard,
    SupplierFilters,
} from '@/types/supplier';

const {
    suppliers,
    loading,
    error,
    pagination,
    fetchSuppliers,
    deleteSupplier,
} = useSuppliers();

const filters = ref<SupplierFilters>({
    search: '',
    status: undefined,
    per_page: 15,
});
const commercialDashboard = ref<SupplierCommercialDashboard | null>(null);
const commercialDashboardLoading = ref(false);
const commercialDashboardError = ref<string | null>(null);
const onlyLowStockWithoutSupplier = ref(true);

const productsWithoutSupplier = computed(
    () => commercialDashboard.value?.products_without_supplier ?? [],
);

const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

async function loadSuppliers(page: number = 1) {
    const cleanFilters = { ...filters.value, page };
    if (!cleanFilters.status) delete cleanFilters.status;
    if (!cleanFilters.search) delete cleanFilters.search;
    await fetchSuppliers(cleanFilters);
}

async function loadCommercialDashboard() {
    commercialDashboardLoading.value = true;
    commercialDashboardError.value = null;

    try {
        commercialDashboard.value =
            await suppliersService.getCommercialDashboard({
                only_low_stock: onlyLowStockWithoutSupplier.value,
                per_page: 25,
            });
    } catch (e: any) {
        commercialDashboardError.value =
            e.response?.data?.message ||
            'Error al cargar tablero comercial de proveedores';
    } finally {
        commercialDashboardLoading.value = false;
    }
}

async function handlePageChange(page: number) {
    await loadSuppliers(page);
}

async function handleDelete(id: number) {
    if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;
    try {
        await deleteSupplier(id);
        await loadSuppliers();
    } catch (e) {
        // Error handled in composable
    }
}

onMounted(async () => {
    await Promise.all([loadSuppliers(), loadCommercialDashboard()]);
});
</script>

<template>
    <Head title="Proveedores" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Proveedores
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gestiona tus proveedores y su información de contacto
                    </p>
                </div>
                <Link
                    href="/suppliers/create"
                    class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Plus :size="20" />
                    Nuevo Proveedor
                </Link>
                <Link
                    href="/suppliers/import"
                    class="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                >
                    <Upload :size="20" />
                    Importar
                </Link>
            </div>

            <div
                v-if="commercialDashboard"
                class="grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs font-semibold text-gray-500 uppercase">
                        Proveedores activos
                    </p>
                    <p
                        class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                    >
                        {{ commercialDashboard.summary.suppliers_count }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs font-semibold text-gray-500 uppercase">
                        Vinculos producto
                    </p>
                    <p
                        class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                    >
                        {{
                            commercialDashboard.summary.supplied_variants_count
                        }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
                >
                    <p class="text-xs font-semibold text-amber-700 uppercase">
                        Sin proveedor
                    </p>
                    <p class="mt-2 text-2xl font-bold text-amber-700">
                        {{
                            commercialDashboard.summary
                                .products_without_supplier_count
                        }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20"
                >
                    <p class="text-xs font-semibold text-red-700 uppercase">
                        Bajo stock sin proveedor
                    </p>
                    <p class="mt-2 text-2xl font-bold text-red-700">
                        {{
                            commercialDashboard.summary
                                .low_stock_without_supplier_count
                        }}
                    </p>
                </div>
            </div>

            <div
                v-if="commercialDashboardError"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
            >
                {{ commercialDashboardError }}
            </div>

            <section
                class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    class="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between dark:border-border"
                >
                    <div>
                        <h2
                            class="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"
                        >
                            <AlertTriangle :size="18" class="text-amber-500" />
                            Productos sin proveedor
                        </h2>
                        <p class="text-xs text-gray-500">
                            Variantes sin relacion comercial para abastecer.
                        </p>
                    </div>
                    <label
                        class="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                        <input
                            v-model="onlyLowStockWithoutSupplier"
                            type="checkbox"
                            class="rounded border-gray-300"
                            @change="loadCommercialDashboard"
                        />
                        Solo bajo stock
                    </label>
                </div>
                <div
                    v-if="commercialDashboardLoading"
                    class="p-6 text-sm text-gray-500"
                >
                    Cargando tablero comercial...
                </div>
                <div v-else class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead
                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                        >
                            <tr>
                                <th class="px-3 py-2 text-left">Producto</th>
                                <th class="px-3 py-2 text-left">Marca</th>
                                <th class="px-3 py-2 text-left">Sucursal</th>
                                <th class="px-3 py-2 text-right">Stock</th>
                                <th class="px-3 py-2 text-right">Reorden</th>
                                <th class="px-3 py-2 text-right">Accion</th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <tr v-if="productsWithoutSupplier.length === 0">
                                <td
                                    colspan="6"
                                    class="px-3 py-6 text-center text-gray-500"
                                >
                                    Sin productos pendientes bajo el filtro
                                    actual.
                                </td>
                            </tr>
                            <tr
                                v-for="item in productsWithoutSupplier"
                                :key="`${item.product_id}-${item.variant_id}-${item.warehouse?.id}`"
                                class="hover:bg-gray-50 dark:hover:bg-muted/40"
                            >
                                <td class="px-3 py-2">
                                    <Link
                                        :href="`/products/${item.product_id}`"
                                        class="font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                    >
                                        {{ item.product_name }}
                                    </Link>
                                    <p class="font-mono text-xs text-gray-500">
                                        {{
                                            item.variant_sku ||
                                            item.product_sku ||
                                            '-'
                                        }}
                                    </p>
                                </td>
                                <td class="px-3 py-2 text-gray-600">
                                    {{ item.brand_name || '-' }}
                                </td>
                                <td class="px-3 py-2 text-gray-600">
                                    {{ item.warehouse?.name || '-' }}
                                </td>
                                <td
                                    class="px-3 py-2 text-right font-mono font-semibold"
                                    :class="
                                        item.needs_reorder
                                            ? 'text-red-600'
                                            : 'text-gray-700'
                                    "
                                >
                                    {{ item.quantity_available }}
                                </td>
                                <td class="px-3 py-2 text-right font-mono">
                                    {{ item.reorder_point }} /
                                    {{ item.reorder_quantity }}
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <Link
                                        :href="`/products/${item.product_id}`"
                                        class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200"
                                    >
                                        <Package :size="13" />
                                        Ver producto
                                    </Link>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

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
                                placeholder="Nombre, contacto, email..."
                                class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                @input="() => loadSuppliers(1)"
                            />
                        </div>
                    </div>
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Estado</label
                        >
                        <select
                            v-model="filters.status"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            @change="() => loadSuppliers(1)"
                        >
                            <option
                                v-for="opt in statusOptions"
                                :key="opt.value"
                                :value="opt.value"
                            >
                                {{ opt.label }}
                            </option>
                        </select>
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
                                    Proveedor
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Contacto
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Teléfono
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Productos
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Estado
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
                                    colspan="6"
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
                            <tr v-else-if="suppliers.length === 0">
                                <td
                                    colspan="6"
                                    class="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                                >
                                    <Building2
                                        class="mx-auto mb-3 text-gray-300"
                                        :size="48"
                                    />
                                    <p>No se encontraron proveedores</p>
                                </td>
                            </tr>
                            <tr
                                v-for="s in suppliers"
                                :key="s.id"
                                class="dark:hover:bg-muted/50/50 transition hover:bg-gray-50"
                            >
                                <td class="px-6 py-4">
                                    <Link
                                        :href="`/suppliers/${s.id}`"
                                        class="font-medium text-indigo-600 hover:underline dark:text-indigo-400 dark:text-primary"
                                    >
                                        {{ s.name }}
                                    </Link>
                                    <p
                                        v-if="s.email"
                                        class="text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        {{ s.email }}
                                    </p>
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ s.contact_name || '—' }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {{ s.phone || '—' }}
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span
                                        class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        <Package :size="14" />
                                        {{ s.products_count || 0 }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span
                                        :class="[
                                            'rounded-full px-2 py-1 text-xs font-semibold',
                                            s.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-400',
                                        ]"
                                    >
                                        {{
                                            s.status === 'active'
                                                ? 'Activo'
                                                : 'Inactivo'
                                        }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div
                                        class="flex items-center justify-end gap-2"
                                    >
                                        <Link
                                            :href="`/suppliers/${s.id}/edit`"
                                            class="p-2 text-gray-400 transition hover:text-indigo-600 dark:text-primary"
                                        >
                                            <Pencil :size="16" />
                                        </Link>
                                        <button
                                            @click="handleDelete(s.id)"
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
