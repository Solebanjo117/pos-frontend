<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { useWarehouses } from '@/composables/useWarehouses';
import WarehousesApiService from '@/services/warehouses';
import type { WarehouseInventoryFilters } from '@/types/warehouse';
import { Pencil } from 'lucide-vue-next';

interface Props {
    warehouseId: number;
}

const props = defineProps<Props>();

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Almacenes', href: '/warehouses' },
    { title: 'Detalle del Almacén', href: `/warehouses/${props.warehouseId}` },
];

const { currentWarehouse, fetchWarehouse, loading, error } = useWarehouses();

// Inventory data
const inventory = ref<any[]>([]);
const inventoryLoading = ref(false);
const inventoryError = ref<string | null>(null);
const inventoryCurrentPage = ref(1);
const inventoryLastPage = ref(1);
const inventoryTotal = ref(0);

// Inventory filters
const inventoryFilters = ref<WarehouseInventoryFilters>({
    search: '',
    low_stock: false,
    out_of_stock: false,
});

// Load warehouse data
onMounted(async () => {
    await fetchWarehouse(props.warehouseId);
    await fetchInventory();
});

// Fetch inventory
const fetchInventory = async (page = 1) => {
    inventoryLoading.value = true;
    inventoryError.value = null;

    try {
        const response = await WarehousesApiService.getWarehouseInventory(
            props.warehouseId,
            inventoryFilters.value,
            page,
        );
        inventory.value = response.data;
        inventoryCurrentPage.value = response.meta.current_page;
        inventoryLastPage.value = response.meta.last_page;
        inventoryTotal.value = response.meta.total;
    } catch (err: any) {
        inventoryError.value =
            err.response?.data?.message || 'Error al cargar inventario';
        console.error('Error fetching inventory:', err);
    } finally {
        inventoryLoading.value = false;
    }
};

// Apply inventory filters
const applyInventoryFilters = () => {
    fetchInventory(1);
};

// Clear inventory filters
const clearInventoryFilters = () => {
    inventoryFilters.value = {
        search: '',
        low_stock: false,
        out_of_stock: false,
    };
    fetchInventory(1);
};

// Get status color
const getStatusColor = (status: string) => {
    return status === 'active'
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        : 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-200';
};

// Get status label
const getStatusLabel = (status: string) => {
    return status === 'active' ? 'Activo' : 'Inactivo';
};

// Format currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(value);
};

// Get stock status
const getStockStatus = (item: any) => {
    if (item.quantity_available === 0) return 'Sin stock';
    if (item.quantity_available <= item.reorder_point) return 'Stock bajo';
    return 'Normal';
};

// Get stock status color
const getStockStatusColor = (item: any) => {
    if (item.quantity_available === 0) return 'text-red-600 dark:text-red-400';
    if (item.quantity_available <= item.reorder_point)
        return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
};
</script>

<template>
    <Head title="Detalle del Almacén" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Loading State -->
            <div v-if="loading" class="py-12 text-center">
                <div
                    class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent dark:border-primary"
                ></div>
                <p class="mt-2 text-gray-800 dark:text-gray-200">
                    Cargando almacén...
                </p>
            </div>

            <!-- Error State -->
            <div
                v-else-if="error"
                class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200"
            >
                <p>{{ error }}</p>
            </div>

            <!-- Warehouse Details -->
            <div v-else-if="currentWarehouse" class="space-y-6">
                <!-- Header -->
                <div class="flex items-center justify-between">
                    <div>
                        <h1
                            class="text-3xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ currentWarehouse.name }}
                        </h1>
                        <p
                            class="mt-1 text-sm text-gray-700 dark:text-gray-300"
                        >
                            Código: {{ currentWarehouse.code }}
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <a
                            :href="`/warehouses/${warehouseId}/edit`"
                            class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            <Pencil class="mr-2 h-4 w-4" /> Editar
                        </a>
                    </div>
                </div>

                <!-- General Info Card -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <h2
                        class="mb-4 text-xl font-semibold text-gray-900 dark:text-white"
                    >
                        Información General
                    </h2>
                    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Ubicación
                            </p>
                            <p
                                class="mt-1 text-base text-gray-900 dark:text-white"
                            >
                                {{ currentWarehouse.location || 'N/A' }}
                            </p>
                        </div>
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Capacidad
                            </p>
                            <p
                                class="mt-1 text-base text-gray-900 dark:text-white"
                            >
                                {{ currentWarehouse.capacity || 'N/A' }}
                            </p>
                        </div>
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Estado
                            </p>
                            <p class="mt-1">
                                <span
                                    :class="
                                        getStatusColor(currentWarehouse.status)
                                    "
                                    class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                                >
                                    {{
                                        getStatusLabel(currentWarehouse.status)
                                    }}
                                </span>
                            </p>
                        </div>
                        <div>
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Uso
                            </p>
                            <p
                                class="mt-1 text-base text-gray-900 dark:text-white"
                            >
                                {{
                                    currentWarehouse.utilization_percentage
                                        ? `${currentWarehouse.utilization_percentage}%`
                                        : 'N/A'
                                }}
                            </p>
                        </div>
                        <div
                            v-if="currentWarehouse.notes"
                            class="md:col-span-2"
                        >
                            <p
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Notas
                            </p>
                            <p
                                class="mt-1 text-base text-gray-900 dark:text-white"
                            >
                                {{ currentWarehouse.notes }}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Statistics Cards -->
                <div class="grid grid-cols-1 gap-6 md:grid-cols-4">
                    <!-- Total Products -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <p
                            class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Total Productos
                        </p>
                        <p
                            class="mt-2 text-3xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ currentWarehouse.total_products || 0 }}
                        </p>
                    </div>

                    <!-- Total Units -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <p
                            class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Total Unidades
                        </p>
                        <p
                            class="mt-2 text-3xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ currentWarehouse.total_units || 0 }}
                        </p>
                    </div>

                    <!-- Total Value -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <p
                            class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Valor Total
                        </p>
                        <p
                            class="mt-2 text-3xl font-bold text-gray-900 dark:text-white"
                        >
                            {{
                                currentWarehouse.total_value
                                    ? formatCurrency(
                                          currentWarehouse.total_value,
                                      )
                                    : '$0.00'
                            }}
                        </p>
                    </div>

                    <!-- Low Stock Products -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <p
                            class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Stock Bajo
                        </p>
                        <p
                            class="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400"
                        >
                            {{ currentWarehouse.low_stock_products || 0 }}
                        </p>
                    </div>
                </div>

                <!-- Inventory Section -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <h2
                        class="mb-4 text-xl font-semibold text-gray-900 dark:text-white"
                    >
                        Inventario del Almacén
                    </h2>

                    <!-- Filters -->
                    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <input
                                v-model="inventoryFilters.search"
                                type="text"
                                placeholder="Buscar producto..."
                                class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white dark:placeholder-gray-400"
                                @keyup.enter="applyInventoryFilters"
                            />
                        </div>
                        <div class="flex items-center gap-4">
                            <label class="flex items-center">
                                <input
                                    v-model="inventoryFilters.low_stock"
                                    type="checkbox"
                                    class="mr-2 rounded border-gray-300 dark:border-border"
                                />
                                <span
                                    class="text-sm text-gray-900 dark:text-gray-100"
                                    >Stock bajo</span
                                >
                            </label>
                            <label class="flex items-center">
                                <input
                                    v-model="inventoryFilters.out_of_stock"
                                    type="checkbox"
                                    class="mr-2 rounded border-gray-300 dark:border-border"
                                />
                                <span
                                    class="text-sm text-gray-900 dark:text-gray-100"
                                    >Sin stock</span
                                >
                            </label>
                        </div>
                        <div class="flex justify-end gap-2">
                            <button
                                @click="applyInventoryFilters"
                                class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                            >
                                Filtrar
                            </button>
                            <button
                                @click="clearInventoryFilters"
                                class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>

                    <!-- Inventory Loading -->
                    <div v-if="inventoryLoading" class="py-8 text-center">
                        <div
                            class="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent dark:border-primary"
                        ></div>
                    </div>

                    <!-- Inventory Error -->
                    <div
                        v-else-if="inventoryError"
                        class="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200"
                    >
                        <p>{{ inventoryError }}</p>
                    </div>

                    <!-- Inventory Table -->
                    <div
                        v-else-if="inventory.length > 0"
                        class="overflow-x-auto"
                    >
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
                                        SKU
                                    </th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                    >
                                        Disponible
                                    </th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                    >
                                        Reservado
                                    </th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                    >
                                        Punto Reorden
                                    </th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-900 uppercase dark:text-white"
                                    >
                                        Estado
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                            >
                                <tr
                                    v-for="item in inventory"
                                    :key="item.id"
                                    class="hover:bg-gray-50 dark:hover:bg-muted/50"
                                >
                                    <td class="px-6 py-4">
                                        <div
                                            class="text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            {{ item.product?.name || 'N/A' }}
                                        </div>
                                        <div
                                            class="text-sm text-gray-700 dark:text-gray-300"
                                        >
                                            {{
                                                item.product?.brand?.name || ''
                                            }}
                                        </div>
                                    </td>
                                    <td
                                        class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                                    >
                                        {{ item.product?.sku || 'N/A' }}
                                    </td>
                                    <td
                                        class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                                    >
                                        {{ item.quantity_available }}
                                    </td>
                                    <td
                                        class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                                    >
                                        {{ item.quantity_reserved || 0 }}
                                    </td>
                                    <td
                                        class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white"
                                    >
                                        {{ item.reorder_point }}
                                    </td>
                                    <td
                                        class="px-6 py-4 text-sm font-medium whitespace-nowrap"
                                        :class="getStockStatusColor(item)"
                                    >
                                        {{ getStockStatus(item) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Pagination -->
                        <div class="mt-4 flex justify-between">
                            <div>
                                <p
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    Mostrando
                                    {{ (inventoryCurrentPage - 1) * 20 + 1 }} a
                                    {{
                                        Math.min(
                                            inventoryCurrentPage * 20,
                                            inventoryTotal,
                                        )
                                    }}
                                    de {{ inventoryTotal }} productos
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <button
                                    @click="
                                        fetchInventory(inventoryCurrentPage - 1)
                                    "
                                    :disabled="inventoryCurrentPage === 1"
                                    class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                                >
                                    Anterior
                                </button>
                                <button
                                    @click="
                                        fetchInventory(inventoryCurrentPage + 1)
                                    "
                                    :disabled="
                                        inventoryCurrentPage ===
                                        inventoryLastPage
                                    "
                                    class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Empty Inventory -->
                    <div v-else class="py-8 text-center">
                        <p class="text-gray-700 dark:text-gray-300">
                            No hay productos en este almacén.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
