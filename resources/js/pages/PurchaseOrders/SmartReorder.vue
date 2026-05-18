<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    smartReorderService,
    type SupplierLowStock,
    type LowStockStats,
    type CreatedPurchaseOrder,
} from '@/services/smart-reorder';
import {
    PackageX,
    AlertTriangle,
    TrendingDown,
    ShoppingCart,
    Check,
    Minus,
    Plus,
    CheckCircle2,
} from 'lucide-vue-next';
import apiClient from '@/services/api/client';
import { useToast } from '@/composables/useToast';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

const toast = useToast();
const lowStockData = ref<SupplierLowStock[]>([]);
const stats = ref<LowStockStats | null>(null);
const warehouses = ref<any[]>([]);
const selectedWarehouse = ref<number | undefined>(undefined);
const loading = ref(false);
const error = ref<string | null>(null);
const createdOrders = ref<CreatedPurchaseOrder[]>([]);
const showSuccess = ref(false);

const warehouseFilterOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const warehouseFilterModel = computed<number | null>({
    get: () => selectedWarehouse.value ?? null,
    set: (value) => {
        selectedWarehouse.value = value === null ? undefined : Number(value);
    },
});

// Track selected items per supplier
const selectedItems = ref<Record<number, Record<number, boolean>>>({});
const quantities = ref<Record<number, Record<number, number>>>({});

async function loadData() {
    loading.value = true;
    error.value = null;
    try {
        const [lowStock, statsData] = await Promise.all([
            smartReorderService.getLowStock(selectedWarehouse.value),
            smartReorderService.getStats(selectedWarehouse.value),
        ]);
        lowStockData.value = lowStock;
        stats.value = statsData;

        // Initialize selection states
        lowStock.forEach((group) => {
            const supplierId = group.supplier.id;
            if (!selectedItems.value[supplierId]) {
                selectedItems.value[supplierId] = {};
                quantities.value[supplierId] = {};
            }
            group.items.forEach((item) => {
                selectedItems.value[supplierId][item.product_id] = true; // Select all by default
                quantities.value[supplierId][item.product_id] =
                    item.suggested_quantity;
            });
        });
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error loading data';
    } finally {
        loading.value = false;
    }
}

function toggleItem(supplierId: number, productId: number) {
    selectedItems.value[supplierId][productId] =
        !selectedItems.value[supplierId][productId];
}

function toggleAllForSupplier(supplierId: number) {
    const group = lowStockData.value.find((g) => g.supplier.id === supplierId);
    if (!group) return;

    const allSelected = group.items.every(
        (item) => selectedItems.value[supplierId]?.[item.product_id],
    );
    group.items.forEach((item) => {
        selectedItems.value[supplierId][item.product_id] = !allSelected;
    });
}

function adjustQuantity(supplierId: number, productId: number, delta: number) {
    const current = quantities.value[supplierId][productId] || 0;
    quantities.value[supplierId][productId] = Math.max(1, current + delta);
}

const selectedCount = computed(() => {
    let count = 0;
    Object.values(selectedItems.value).forEach((items) => {
        count += Object.values(items).filter(Boolean).length;
    });
    return count;
});

const ordersToCreate = computed(() => {
    const orders: any[] = [];
    lowStockData.value.forEach((group) => {
        const selectedGroupItems = group.items.filter(
            (item) => selectedItems.value[group.supplier.id]?.[item.product_id],
        );

        if (selectedGroupItems.length === 0) return;

        const items = selectedGroupItems.map((item) => ({
            product_id: item.product_id,
            quantity: quantities.value[group.supplier.id][item.product_id],
            unit_cost: item.unit_cost,
        }));

        orders.push({
            supplier_id: group.supplier.id,
            warehouse_id: selectedGroupItems[0].warehouse_id,
            notes: `Generado por Smart Reorder - ${items.length} productos`,
            items,
        });
    });
    return orders;
});

async function handleGenerate() {
    if (ordersToCreate.value.length === 0) {
        toast.error('Selecciona al menos un producto');
        return;
    }

    if (
        !confirm(
            `¿Generar ${ordersToCreate.value.length} órdenes de compra en borrador?`,
        )
    )
        return;

    loading.value = true;
    error.value = null;
    try {
        const result = await smartReorderService.batchCreate(
            ordersToCreate.value,
        );
        createdOrders.value = result;
        showSuccess.value = true;
        toast.success(
            `${result.length} orden(es) de compra creada(s) exitosamente`,
        );

        // Clear selection after success
        selectedItems.value = {};
        quantities.value = {};
        await loadData();
    } catch (e: any) {
        const errorMsg =
            e.response?.data?.message ||
            e.response?.data?.errors ||
            'Error al generar órdenes';
        error.value =
            typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg;
        toast.error('Error al generar órdenes de compra');
    } finally {
        loading.value = false;
    }
}

onMounted(async () => {
    try {
        const { data } = await apiClient.get('/warehouses');
        warehouses.value = data.data || data || [];
    } catch (e) {}
    await loadData();
});
</script>

<template>
    <Head title="Smart Reorder - Reabastecimiento Inteligente" />
    <AppLayout>
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Reabastecimiento Inteligente
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Genera órdenes de compra basadas en puntos de reorden
                    </p>
                </div>
                <Link
                    href="/purchase-orders"
                    class="rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                >
                    Volver
                </Link>
            </div>

            <!-- Stats -->
            <div v-if="stats" class="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30"
                        >
                            <TrendingDown
                                :size="20"
                                class="text-orange-600 dark:text-orange-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ stats.total_items }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Total Bajo Stock
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-red-100 p-2 dark:bg-red-900/30"
                        >
                            <PackageX
                                :size="20"
                                class="text-red-600 dark:text-red-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ stats.critical_stock }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Stock Crítico (0)
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30"
                        >
                            <Check
                                :size="20"
                                class="text-blue-600 dark:text-blue-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ selectedCount }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Seleccionados
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    v-if="stats.without_supplier > 0"
                    class="rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-card"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30"
                        >
                            <AlertTriangle
                                :size="20"
                                class="text-amber-600 dark:text-amber-400"
                            />
                        </div>
                        <div>
                            <p
                                class="text-2xl font-bold text-amber-600 dark:text-amber-400"
                            >
                                {{ stats.without_supplier }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                Sin Proveedor
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Warning: products without supplier -->
            <div
                v-if="stats?.without_supplier > 0"
                class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
            >
                <AlertTriangle
                    :size="18"
                    class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <div>
                    <p class="text-sm text-amber-700 dark:text-amber-400">
                        <strong
                            >{{ stats.without_supplier }} producto(s)</strong
                        >
                        con bajo stock no tienen proveedor asignado.
                    </p>
                    <p class="mt-1 text-xs text-amber-600 dark:text-amber-500">
                        Estos productos no aparecen en Smart Reorder. Asígnales
                        un proveedor en el módulo de Productos para incluirlos.
                    </p>
                </div>
            </div>

            <!-- Filter -->
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="flex items-center gap-4">
                    <label
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >Almacén:</label
                    >
                    <div class="w-72">
                        <SearchableSelect
                            v-model="warehouseFilterModel"
                            :options="warehouseFilterOptions"
                            placeholder="Todos"
                            @update:model-value="loadData"
                        />
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

            <!-- Success Panel -->
            <div
                v-if="showSuccess && createdOrders.length > 0"
                class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
            >
                <div class="mb-3 flex items-center gap-2">
                    <CheckCircle2
                        :size="20"
                        class="text-green-600 dark:text-green-400"
                    />
                    <p
                        class="text-sm font-semibold text-green-700 dark:text-green-400"
                    >
                        {{ createdOrders.length }} orden(es) de compra creada(s)
                        exitosamente
                    </p>
                    <button
                        @click="showSuccess = false"
                        class="ml-auto text-sm text-green-600 hover:text-green-800"
                    >
                        Cerrar
                    </button>
                </div>
                <div class="space-y-2">
                    <Link
                        v-for="po in createdOrders"
                        :key="po.id"
                        :href="`/purchase-orders/${po.id}`"
                        class="flex items-center justify-between rounded border border-green-100 bg-white p-2 transition hover:bg-green-50 dark:border-green-800 dark:bg-card dark:hover:bg-green-900/30"
                    >
                        <div class="flex items-center gap-3">
                            <ShoppingCart :size="16" class="text-green-600" />
                            <span
                                class="text-sm font-medium text-gray-900 dark:text-white"
                                >{{ po.po_number }}</span
                            >
                            <span class="text-xs text-gray-500">{{
                                po.supplier?.name
                            }}</span>
                        </div>
                        <span
                            class="text-sm font-semibold text-gray-900 dark:text-white"
                            >${{ po.total?.toFixed(2) || '0.00' }}</span
                        >
                    </Link>
                </div>
                <div class="mt-3 flex gap-2">
                    <Link
                        href="/purchase-orders"
                        class="text-sm text-indigo-600 hover:underline dark:text-primary"
                    >
                        Ver todas las órdenes →
                    </Link>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-12">
                <div
                    class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
                ></div>
            </div>

            <!-- Grouped by Supplier -->
            <div v-else-if="lowStockData.length" class="space-y-6">
                <div
                    v-for="group in lowStockData"
                    :key="group.supplier.id"
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-border dark:bg-background"
                    >
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                {{ group.supplier.name }}
                            </h3>
                            <p class="text-sm text-gray-500">
                                {{ group.items.length }} productos
                            </p>
                        </div>
                        <button
                            @click="toggleAllForSupplier(group.supplier.id)"
                            class="rounded px-3 py-1 text-sm text-indigo-600 transition hover:bg-indigo-50 dark:text-primary dark:hover:bg-indigo-900/20"
                        >
                            {{
                                group.items.every(
                                    (i) =>
                                        selectedItems[group.supplier.id]?.[
                                            i.product_id
                                        ],
                                )
                                    ? 'Deseleccionar'
                                    : 'Seleccionar'
                            }}
                            Todo
                        </button>
                    </div>
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th class="w-10 px-4 py-2"></th>
                                <th
                                    class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                                >
                                    Stock
                                </th>
                                <th
                                    class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                                >
                                    Mín
                                </th>
                                <th
                                    class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                                >
                                    Almacén
                                </th>
                                <th
                                    class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                >
                                    Costo
                                </th>
                                <th
                                    class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                                >
                                    Cantidad
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 dark:divide-border"
                        >
                            <tr
                                v-for="item in group.items"
                                :key="item.product_id"
                                :class="
                                    selectedItems[group.supplier.id]?.[
                                        item.product_id
                                    ]
                                        ? 'bg-indigo-50 dark:bg-indigo-900/10'
                                        : ''
                                "
                            >
                                <td class="px-4 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        :checked="
                                            selectedItems[group.supplier.id]?.[
                                                item.product_id
                                            ]
                                        "
                                        @change="
                                            toggleItem(
                                                group.supplier.id,
                                                item.product_id,
                                            )
                                        "
                                        class="rounded"
                                    />
                                </td>
                                <td class="px-4 py-3">
                                    <p
                                        class="text-sm font-medium text-gray-900 dark:text-white"
                                    >
                                        {{ item.product.name }}
                                    </p>
                                    <p class="font-mono text-xs text-gray-500">
                                        {{ item.product.sku }}
                                    </p>
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <span
                                        :class="
                                            item.current_stock === 0
                                                ? 'font-bold text-red-600'
                                                : 'text-gray-900 dark:text-white'
                                        "
                                        >{{ item.current_stock }}</span
                                    >
                                </td>
                                <td
                                    class="px-4 py-3 text-center text-sm text-gray-500"
                                >
                                    {{ item.reorder_point }}
                                </td>
                                <td
                                    class="px-4 py-3 text-center text-xs text-gray-500"
                                >
                                    {{ item.warehouse_name }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    ${{ (item.unit_cost || 0).toFixed(2) }}
                                </td>
                                <td class="px-4 py-3">
                                    <div
                                        class="flex items-center justify-center gap-2"
                                    >
                                        <button
                                            @click="
                                                adjustQuantity(
                                                    group.supplier.id,
                                                    item.product_id,
                                                    -1,
                                                )
                                            "
                                            class="p-1 text-gray-400 transition hover:text-gray-600"
                                        >
                                            <Minus :size="16" />
                                        </button>
                                        <input
                                            v-model.number="
                                                quantities[group.supplier.id][
                                                    item.product_id
                                                ]
                                            "
                                            type="number"
                                            min="1"
                                            class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                        />
                                        <button
                                            @click="
                                                adjustQuantity(
                                                    group.supplier.id,
                                                    item.product_id,
                                                    1,
                                                )
                                            "
                                            class="p-1 text-gray-400 transition hover:text-gray-600"
                                        >
                                            <Plus :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div
                v-else
                class="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-border dark:bg-card"
            >
                <AlertTriangle class="mx-auto mb-3 text-green-500" :size="48" />
                <p class="text-gray-600 dark:text-gray-400">
                    ¡Todos los productos tienen stock suficiente!
                </p>
            </div>

            <!-- Floating Action Button -->
            <div v-if="selectedCount > 0" class="fixed right-8 bottom-8 z-50">
                <button
                    @click="handleGenerate"
                    :disabled="loading"
                    class="inline-flex items-center gap-3 rounded-full bg-indigo-600 px-6 py-4 text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <ShoppingCart :size="20" />
                    <span class="font-semibold"
                        >Generar {{ ordersToCreate.length }}
                        {{
                            ordersToCreate.length === 1 ? 'Orden' : 'Órdenes'
                        }}</span
                    >
                </button>
            </div>
        </div>
    </AppLayout>
</template>
