<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { ref, onMounted, computed } from 'vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useInventory } from '@/composables/useInventory';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import type { InventoryFilters } from '@/types/inventory';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
];

const {
    inventory,
    warehouses,
    pagination,
    loading,
    error,
    fetchInventory,
    fetchWarehouses,
    updateInventory,
} = useInventory();

// Filters
const filters = ref<InventoryFilters>({
    warehouse_id: undefined,
    low_stock: false,
    search: '',
    sort_by: 'product_name',
    sort_order: 'asc',
    per_page: 20,
    page: 1,
});

// Editing state
const editingItem = ref<number | null>(null);
const editForm = ref({
    stock_available: 0,
    reorder_point: 0,
    target_level: 0,
});

onMounted(async () => {
    await fetchWarehouses();
    await fetchInventory(filters.value);
});

const applyFilters = async () => {
    filters.value.page = 1;
    await fetchInventory(filters.value);
};

const changePage = async (page: number) => {
    filters.value.page = page;
    await fetchInventory(filters.value);
};

const startEdit = (item: any) => {
    editingItem.value = item.id;
    editForm.value = {
        stock_available: item.stock_available,
        reorder_point: item.reorder_point,
        target_level: item.target_level,
    };
};

const cancelEdit = () => {
    editingItem.value = null;
};

const saveEdit = async (productId: number, warehouseId: number) => {
    try {
        await updateInventory(productId, warehouseId, editForm.value);
        editingItem.value = null;
    } catch (err) {
        // Error is handled in composable
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'out_of_stock':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'low_stock':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'optimal':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        default:
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'out_of_stock':
            return 'Sin Stock';
        case 'low_stock':
            return 'Stock Bajo';
        case 'optimal':
            return 'Óptimo';
        default:
            return 'Normal';
    }
};

const totalPages = computed(() =>
    Math.ceil(pagination.value.total / pagination.value.per_page),
);

const warehouseFilterOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const warehouseFilterModel = computed<number | null>({
    get: () => filters.value.warehouse_id ?? null,
    set: (value) => {
        filters.value.warehouse_id = value === null ? undefined : Number(value);
    },
});

const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
};
</script>

<template>
    <Head title="Inventario" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-6 flex items-center justify-between">
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Inventario
                    </h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Gestión de stock por almacén
                    </p>
                </div>
                <div>
                    <a
                        href="/inventory/batches"
                        class="text-sm font-medium text-blue-600 hover:underline dark:text-primary"
                    >
                        Ver Inventario de Lotes &rarr;
                    </a>
                </div>
            </div>

            <!-- Filters -->
            <div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-card">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <!-- Search -->
                    <div class="md:col-span-2">
                        <label
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                            >Buscar</label
                        >
                        <input
                            v-model="filters.search"
                            type="text"
                            placeholder="Nombre o SKU del producto..."
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            @keyup.enter="applyFilters"
                        />
                    </div>

                    <!-- Warehouse Filter -->
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                            >Almacén</label
                        >
                        <div class="mt-1">
                            <SearchableSelect
                                v-model="warehouseFilterModel"
                                :options="warehouseFilterOptions"
                                placeholder="Todos"
                                @update:model-value="applyFilters"
                            />
                        </div>
                    </div>

                    <!-- Low Stock Toggle -->
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                            >Filtros</label
                        >
                        <div class="mt-1 flex items-center">
                            <input
                                v-model="filters.low_stock"
                                type="checkbox"
                                class="h-4 w-4 rounded border-gray-300 text-blue-600 dark:text-primary"
                                @change="applyFilters"
                            />
                            <span
                                class="ml-2 text-sm text-gray-900 dark:text-white"
                                >Solo stock bajo</span
                            >
                        </div>
                    </div>
                </div>

                <div class="mt-4 flex justify-end">
                    <button
                        @click="applyFilters"
                        class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        :disabled="loading"
                    >
                        {{ loading ? 'Cargando...' : 'Aplicar Filtros' }}
                    </button>
                </div>
            </div>

            <!-- Error Message -->
            <div
                v-if="error"
                class="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200"
            >
                {{ error }}
            </div>

            <!-- Inventory Table -->
            <div
                class="overflow-hidden rounded-lg bg-white shadow dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-muted">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    SKU / Marca
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Almacén
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Disponible
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Reservado
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Punto Reorden
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Nivel Objetivo
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Estado
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                >
                                    Precio Venta
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
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
                                    colspan="9"
                                    class="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                                >
                                    Cargando inventario...
                                </td>
                            </tr>
                            <tr v-else-if="inventory.length === 0">
                                <td
                                    colspan="9"
                                    class="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                                >
                                    No se encontraron productos
                                </td>
                            </tr>
                            <tr
                                v-else
                                v-for="item in inventory"
                                :key="item.id"
                                class="hover:bg-gray-50 dark:hover:bg-muted/50"
                            >
                                <!-- Product Name -->
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div
                                        class="text-sm font-medium text-gray-900 dark:text-white"
                                    >
                                        {{ item.product_name }}
                                    </div>
                                </td>

                                <!-- SKU / Brand -->
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div
                                        class="text-sm text-gray-900 dark:text-white"
                                    >
                                        {{ item.product_sku }}
                                    </div>
                                    <div
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        {{ item.brand }}
                                    </div>
                                </td>

                                <!-- Warehouse -->
                                <td
                                    class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                                >
                                    {{ item.warehouse_name }}
                                </td>

                                <!-- Stock Available (Editable) -->
                                <td
                                    class="px-6 py-4 text-center whitespace-nowrap"
                                >
                                    <input
                                        v-if="editingItem === item.id"
                                        v-model.number="
                                            editForm.stock_available
                                        "
                                        type="number"
                                        min="0"
                                        class="w-20 rounded border border-gray-300 px-2 py-1 text-center dark:border-border dark:bg-muted dark:text-white"
                                    />
                                    <span
                                        v-else
                                        class="text-sm font-semibold text-gray-900 dark:text-white"
                                    >
                                        {{ item.stock_available }}
                                    </span>
                                </td>

                                <!-- Stock Reserved -->
                                <td
                                    class="px-6 py-4 text-center text-sm whitespace-nowrap text-gray-900 dark:text-white"
                                >
                                    {{ item.stock_reserved }}
                                </td>

                                <!-- Reorder Point (Editable) -->
                                <td
                                    class="px-6 py-4 text-center whitespace-nowrap"
                                >
                                    <input
                                        v-if="editingItem === item.id"
                                        v-model.number="editForm.reorder_point"
                                        type="number"
                                        min="0"
                                        class="w-20 rounded border border-gray-300 px-2 py-1 text-center dark:border-border dark:bg-muted dark:text-white"
                                    />
                                    <span
                                        v-else
                                        class="text-sm text-gray-900 dark:text-white"
                                    >
                                        {{ item.reorder_point }}
                                    </span>
                                </td>

                                <!-- Target Level (Editable) -->
                                <td
                                    class="px-6 py-4 text-center whitespace-nowrap"
                                >
                                    <input
                                        v-if="editingItem === item.id"
                                        v-model.number="editForm.target_level"
                                        type="number"
                                        min="0"
                                        class="w-20 rounded border border-gray-300 px-2 py-1 text-center dark:border-border dark:bg-muted dark:text-white"
                                    />
                                    <span
                                        v-else
                                        class="text-sm text-gray-900 dark:text-white"
                                    >
                                        {{ item.target_level }}
                                    </span>
                                </td>

                                <!-- Status -->
                                <td
                                    class="px-6 py-4 text-center whitespace-nowrap"
                                >
                                    <span
                                        :class="getStatusColor(item.status)"
                                        class="inline-flex rounded-full px-2 text-xs leading-5 font-semibold"
                                    >
                                        {{ getStatusLabel(item.status) }}
                                    </span>
                                </td>

                                <!-- Sale Price -->
                                <td
                                    class="px-6 py-4 text-right whitespace-nowrap"
                                >
                                    <span
                                        class="text-sm font-semibold"
                                        :class="
                                            item.base_price
                                                ? 'text-green-700 dark:text-green-400'
                                                : 'text-gray-400'
                                        "
                                    >
                                        {{ formatCurrency(item.base_price) }}
                                    </span>
                                </td>

                                <!-- Actions -->
                                <td
                                    class="px-6 py-4 text-center text-sm whitespace-nowrap"
                                >
                                    <div
                                        v-if="editingItem === item.id"
                                        class="flex justify-center space-x-2"
                                    >
                                        <button
                                            @click="
                                                saveEdit(
                                                    item.product_id,
                                                    item.warehouse_id,
                                                )
                                            "
                                            class="text-green-600 hover:text-green-900 dark:text-green-400"
                                        >
                                            ✓ Guardar
                                        </button>
                                        <button
                                            @click="cancelEdit"
                                            class="text-red-600 hover:text-red-900 dark:text-red-400"
                                        >
                                            ✕ Cancelar
                                        </button>
                                    </div>
                                    <button
                                        v-else
                                        @click="startEdit(item)"
                                        class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:text-primary"
                                    >
                                        ✎ Editar
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div
                    v-if="inventory.length > 0"
                    class="border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-700 dark:text-gray-300">
                            Mostrando
                            <span class="font-medium">{{
                                (pagination.current_page - 1) *
                                    pagination.per_page +
                                1
                            }}</span>
                            a
                            <span class="font-medium">{{
                                Math.min(
                                    pagination.current_page *
                                        pagination.per_page,
                                    pagination.total,
                                )
                            }}</span>
                            de
                            <span class="font-medium">{{
                                pagination.total
                            }}</span>
                            productos
                        </div>

                        <div class="flex space-x-2">
                            <button
                                @click="changePage(pagination.current_page - 1)"
                                :disabled="pagination.current_page === 1"
                                class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                            >
                                Anterior
                            </button>
                            <button
                                @click="changePage(pagination.current_page + 1)"
                                :disabled="
                                    pagination.current_page ===
                                    pagination.last_page
                                "
                                class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/80"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
