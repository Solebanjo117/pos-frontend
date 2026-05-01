<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import ProductSearchModal from '@/components/POS/ProductSearchModal.vue';
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue';
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue';
import { supplyListService, type SupplyListItem } from '@/services/supply-list';
import { useProducts } from '@/composables/useProducts';
import { useSuppliers } from '@/composables/useSuppliers';
import { usePosSettings } from '@/composables/usePosSettings';
import { useToast } from '@/composables/useToast';
import {
    Trash2,
    ArrowRight,
    AlertTriangle,
    CheckCircle2,
    Save,
    Filter,
    X as XIcon,
    Download,
    TrendingDown,
    Search,
    CalendarDays,
    Warehouse,
} from 'lucide-vue-next';
import {
    smartReorderService,
    type LowStockStats,
} from '@/services/smart-reorder';

// LL-001: AppLayout for all page-level components
defineOptions({ layout: AppLayout });

const toast = useToast();
const { fetchActiveSuppliers } = useSuppliers();
const { currentWarehouseId, initWarehouse } = usePosSettings();
const {
    products: productList,
    fetchProducts,
    total: totalProducts,
    hasNextPage,
    loading: productsLoading,
    fetchMoreProducts,
} = useProducts();

const items = ref<SupplyListItem[]>([]);
const suppliers = ref<any[]>([]);
const loading = ref(false);
const converting = ref(false);
const importing = ref(false);
const error = ref<string | null>(null);
const conversionResult = ref<{ message: string; orders_created: any[] } | null>(
    null,
);
const savingItemId = ref<number | null>(null);
const lowStockStats = ref<LowStockStats | null>(null);
const supplyDate = ref(new Date().toISOString().slice(0, 10));

// Filters
const selectedSupplierFilter = ref<number | null>(null);

// POS-style search state
const searchQuery = ref('');
const showSearchModal = ref(false);
const showQuickPurchaseModal = ref(false);
const selectedProductForPurchase = ref<any>(null);
const selectedProductForDetail = ref<any>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const handleSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        if (searchQuery.value.length >= 2) {
            await fetchProducts({ search: searchQuery.value, per_page: 30 });
            showSearchModal.value = true;
        }
    }, 300);
};

const handleSearchFocus = async () => {
    if (searchQuery.value.length >= 2) {
        await fetchProducts({ search: searchQuery.value, per_page: 30 });
        showSearchModal.value = true;
    }
};

const handleProductSelected = (product: any) => {
    selectedProductForPurchase.value = product;
    showSearchModal.value = false;
    showQuickPurchaseModal.value = true;
};

const handleQuickPurchaseSuccess = async () => {
    showQuickPurchaseModal.value = false;
    selectedProductForPurchase.value = null;
    searchQuery.value = '';
    await loadItems();
    toast.success('Producto agregado a la OC diaria');
};

// Filtered items based on supplier filter
const filteredItems = computed(() => {
    if (selectedSupplierFilter.value === null) {
        return items.value;
    }
    // null supplier filter shows items without supplier
    if (selectedSupplierFilter.value === 0) {
        return items.value.filter((i) => !i.supplier_id);
    }
    return items.value.filter(
        (i) => i.supplier_id === selectedSupplierFilter.value,
    );
});

const hasItemsWithoutSupplier = computed(() =>
    items.value.some((i) => !i.supplier_id),
);

const requestContext = computed(() => ({
    warehouse_id: currentWarehouseId.value,
    supply_date: supplyDate.value,
}));

const currentWarehouseName = computed(
    () =>
        items.value.find((i) => i.warehouse)?.warehouse?.name ||
        (currentWarehouseId.value
            ? `Almacen #${currentWarehouseId.value}`
            : 'Sin almacen'),
);

const preAppliedTotal = computed(() =>
    items.value.reduce(
        (sum, item) => sum + Number(item.stock_added_qty || 0),
        0,
    ),
);

// Compute totals for footer (based on filtered items)
const totals = computed(() => {
    return {
        subtotal: filteredItems.value.reduce(
            (sum, i) => sum + (i.subtotal || 0),
            0,
        ),
        tax: filteredItems.value.reduce(
            (sum, i) => sum + (i.tax_amount || 0),
            0,
        ),
        total: filteredItems.value.reduce((sum, i) => sum + (i.total || 0), 0),
    };
});

// Supplier stats for filter display
const supplierStats = computed(() => {
    const stats = new Map<number | null, { name: string; count: number }>();

    items.value.forEach((item) => {
        const supplierId = item.supplier_id || null;
        const existing = stats.get(supplierId);

        if (existing) {
            existing.count++;
        } else {
            stats.set(supplierId, {
                name: item.supplier?.name || 'Sin proveedor',
                count: 1,
            });
        }
    });

    return Array.from(stats.entries()).map(([id, data]) => ({
        id: id === null ? 0 : id, // Use 0 for "no supplier"
        name: data.name,
        count: data.count,
    }));
});

// Supplier options for SearchableSelect in table
const supplierOptions = computed(() => {
    const opts = [{ value: null as number | null, label: 'Sin proveedor' }];
    if (suppliers.value) {
        opts.push(
            ...suppliers.value.map((s) => ({ value: s.id, label: s.name })),
        );
    }
    return opts;
});

function normalizeTaxRate(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
}

async function loadItems() {
    loading.value = true;
    error.value = null;
    try {
        const loadedItems = await supplyListService.getItems(
            requestContext.value,
        );
        items.value = loadedItems.map((item) => ({
            ...item,
            tax_rate: normalizeTaxRate(item.tax_rate),
        }));
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al cargar la lista';
    } finally {
        loading.value = false;
    }
}

async function handleUpdateItem(item: SupplyListItem) {
    savingItemId.value = item.id;
    try {
        const normalizedTaxRate = normalizeTaxRate(item.tax_rate);
        item.tax_rate = normalizedTaxRate;

        const updated = await supplyListService.updateItem(item.id, {
            supplier_id: item.supplier_id,
            warehouse_id: requestContext.value.warehouse_id,
            supply_date: requestContext.value.supply_date,
            quantity_needed: item.quantity_needed,
            unit_cost: item.unit_cost,
            tax_rate: normalizedTaxRate,
            sale_price: item.sale_price,
            notes: item.notes ?? undefined,
        });
        // Update local item with computed fields
        const idx = items.value.findIndex((i) => i.id === item.id);
        if (idx !== -1) {
            items.value[idx] = { ...items.value[idx], ...updated };
        }
        toast.success('Guardado');
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al guardar');
    } finally {
        savingItemId.value = null;
    }
}

async function handleRemove(id: number) {
    if (!confirm('¿Eliminar este ítem de la lista?')) return;
    try {
        await supplyListService.removeItem(id, requestContext.value);
        await loadItems();
        toast.success('Ítem eliminado');
    } catch (e) {
        toast.error('Error al eliminar');
    }
}

async function handleConvert() {
    const itemsToConvert =
        selectedSupplierFilter.value !== null
            ? filteredItems.value
            : items.value;
    const supplierName =
        selectedSupplierFilter.value !== null
            ? supplierStats.value.find(
                  (s) => s.id === selectedSupplierFilter.value,
              )?.name || 'seleccionado'
            : 'todos los proveedores';

    if (itemsToConvert.length === 0) {
        return toast.error('No hay ítems para convertir');
    }

    if (
        !confirm(
            `¿Convertir ${itemsToConvert.length} ítems de ${supplierName} en órdenes de compra?`,
        )
    )
        return;

    converting.value = true;
    conversionResult.value = null;
    error.value = null;
    try {
        // If filtering by supplier, send only those item IDs
        const result =
            selectedSupplierFilter.value !== null
                ? await supplyListService.convertFiltered(
                      itemsToConvert.map((i) => i.id),
                      requestContext.value,
                  )
                : await supplyListService.convert(requestContext.value);

        conversionResult.value = result;
        selectedSupplierFilter.value = null; // Reset filter
        await loadItems();
        toast.success('Conversión completada');
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al convertir la lista';
    } finally {
        converting.value = false;
    }
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

// Debounced auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(item: SupplyListItem) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => handleUpdateItem(item), 800);
}

// Import low stock products
async function handleImportLowStock() {
    if (importing.value) return;

    importing.value = true;
    error.value = null;
    try {
        const result = await supplyListService.importLowStock(
            requestContext.value.warehouse_id,
            requestContext.value.supply_date,
        );

        if (result.imported_count > 0) {
            toast.success(`${result.imported_count} producto(s) importado(s)`);
            await loadItems();
        } else if (result.skipped_count > 0) {
            toast.info(
                `Todos los productos ya están en la lista (${result.skipped_count} omitidos)`,
            );
        } else {
            toast.info('No hay productos con stock bajo para importar');
        }

        // Refresh stats
        await loadLowStockStats();
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al importar productos';
        toast.error('Error al importar productos con stock bajo');
    } finally {
        importing.value = false;
    }
}

// Load low stock stats
async function loadLowStockStats() {
    try {
        lowStockStats.value = await smartReorderService.getStats();
    } catch (e) {
        // Silently fail - stats are optional
    }
}

onMounted(async () => {
    await initWarehouse();
    suppliers.value = await fetchActiveSuppliers();
    // No longer loading all products upfront - search is now on-demand

    await Promise.all([loadItems(), loadLowStockStats()]);
});
</script>

<template>
    <Head title="OC Diaria" />

    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                    OC Diaria
                </h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Busca productos para agregar, edita inline y convierte en
                    Órdenes de Compra.
                </p>
            </div>
            <div class="flex items-center gap-3">
                <Link
                    href="/purchase-orders"
                    class="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                >
                    Órdenes de Compra
                </Link>
                <button
                    @click="handleImportLowStock"
                    :disabled="importing"
                    class="inline-flex items-center gap-2 rounded-lg border border-orange-500 px-4 py-2 text-orange-600 transition hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    :class="{ 'cursor-wait opacity-50': importing }"
                >
                    <Download
                        :size="18"
                        :class="{ 'animate-bounce': importing }"
                    />
                    {{ importing ? 'Importando...' : 'Importar Stock Bajo' }}
                    <span
                        v-if="lowStockStats?.total_items"
                        class="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    >
                        {{ lowStockStats.total_items }}
                    </span>
                </button>
                <button
                    @click="handleConvert"
                    :disabled="filteredItems.length === 0 || converting"
                    class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <ArrowRight :size="18" />
                    <span v-if="selectedSupplierFilter !== null">
                        {{
                            converting
                                ? 'Convirtiendo...'
                                : `Convertir ${filteredItems.length} ítem${filteredItems.length !== 1 ? 's' : ''}`
                        }}
                    </span>
                    <span v-else>
                        {{ converting ? 'Convirtiendo...' : 'Convertir Todo' }}
                    </span>
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <div
                    class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                >
                    <Warehouse :size="15" />
                    Almacen
                </div>
                <p
                    class="mt-2 text-sm font-semibold text-gray-900 dark:text-white"
                >
                    {{ currentWarehouseName }}
                </p>
            </div>
            <label
                class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <span
                    class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                >
                    <CalendarDays :size="15" />
                    Fecha OC
                </span>
                <input
                    v-model="supplyDate"
                    type="date"
                    class="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                    @change="loadItems"
                />
            </label>
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <p
                    class="text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                >
                    Items pendientes
                </p>
                <p
                    class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                >
                    {{ items.length }}
                </p>
            </div>
            <div
                class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/20"
            >
                <p
                    class="text-xs font-semibold text-amber-700 uppercase dark:text-amber-300"
                >
                    Stock preaplicado
                </p>
                <p
                    class="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-200"
                >
                    {{ preAppliedTotal }}
                </p>
            </div>
        </div>

        <!-- Search Bar for adding products -->
        <div
            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
        >
            <div class="flex items-center gap-4">
                <div class="relative max-w-xl flex-1">
                    <Search
                        class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
                        :size="20"
                    />
                    <input
                        ref="searchInputRef"
                        v-model="searchQuery"
                        type="text"
                        placeholder="Buscar producto para agregar a la lista... (mínimo 2 caracteres)"
                        class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-4 pl-10 text-gray-900 placeholder-gray-400 transition-shadow focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white dark:focus:ring-primary"
                        @input="handleSearchInput"
                        @focus="handleSearchFocus"
                        @keydown.escape="searchQuery = ''"
                    />
                </div>
                <p class="text-xs text-gray-400">
                    💡 Escribe para buscar, haz clic en un producto para
                    agregarlo
                </p>
            </div>
        </div>

        <!-- Low Stock Stats Card -->
        <div
            v-if="
                lowStockStats &&
                lowStockStats.total_items > 0 &&
                items.length === 0
            "
            class="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20"
        >
            <div class="flex items-start gap-3">
                <div class="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                    <TrendingDown
                        :size="20"
                        class="text-orange-600 dark:text-orange-400"
                    />
                </div>
                <div class="flex-1">
                    <p
                        class="text-sm font-semibold text-orange-700 dark:text-orange-400"
                    >
                        {{ lowStockStats.total_items }} producto(s) con stock
                        bajo detectados
                    </p>
                    <p
                        class="mt-1 text-xs text-orange-600 dark:text-orange-500"
                    >
                        <span
                            v-if="lowStockStats.critical_stock > 0"
                            class="font-bold"
                            >{{ lowStockStats.critical_stock }} críticos (stock
                            0)</span
                        >
                        <span
                            v-if="
                                lowStockStats.critical_stock > 0 &&
                                lowStockStats.low_stock > 0
                            "
                        >
                            ·
                        </span>
                        <span v-if="lowStockStats.low_stock > 0"
                            >{{ lowStockStats.low_stock }} bajo mínimo</span
                        >
                        <span v-if="lowStockStats.without_supplier > 0">
                            · {{ lowStockStats.without_supplier }} sin
                            proveedor</span
                        >
                    </p>
                </div>
                <button
                    @click="handleImportLowStock"
                    :disabled="importing"
                    class="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
                >
                    {{ importing ? 'Importando...' : 'Importar ahora' }}
                </button>
            </div>
        </div>

        <!-- Supplier Filter Badges -->
        <div v-if="items.length > 0" class="flex flex-wrap items-center gap-2">
            <div
                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
            >
                <Filter :size="16" />
                <span class="font-medium">Filtrar por proveedor:</span>
            </div>
            <button
                @click="selectedSupplierFilter = null"
                :class="[
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    selectedSupplierFilter === null
                        ? 'bg-indigo-600 text-white dark:bg-primary'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted/70',
                ]"
            >
                Todos ({{ items.length }})
            </button>
            <button
                v-for="stat in supplierStats"
                :key="stat.id"
                @click="selectedSupplierFilter = stat.id"
                :class="[
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    selectedSupplierFilter === stat.id
                        ? 'bg-indigo-600 text-white dark:bg-primary'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted/70',
                ]"
            >
                <span>{{ stat.name }}</span>
                <span
                    class="rounded bg-black/10 px-1.5 py-0.5 text-xs dark:bg-white/10"
                    >{{ stat.count }}</span
                >
            </button>
        </div>

        <!-- Warning: items without supplier -->
        <div
            v-if="hasItemsWithoutSupplier && items.length > 0"
            class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
        >
            <AlertTriangle
                :size="18"
                class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <p class="text-sm text-amber-700 dark:text-amber-400">
                Hay ítems <strong>sin proveedor asignado</strong>. Al convertir,
                se creará una OC adicional sin proveedor que deberás editar
                manualmente.
            </p>
        </div>

        <!-- Conversion result -->
        <div
            v-if="conversionResult"
            class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
        >
            <div class="mb-3 flex items-center gap-2">
                <CheckCircle2
                    :size="18"
                    class="text-green-600 dark:text-green-400"
                />
                <p
                    class="text-sm font-semibold text-green-700 dark:text-green-400"
                >
                    {{ conversionResult.message }}
                </p>
            </div>
            <div class="space-y-1">
                <Link
                    v-for="po in conversionResult.orders_created"
                    :key="po.id"
                    :href="`/purchase-orders/${po.id}`"
                    class="flex items-center gap-2 text-sm text-indigo-600 hover:underline dark:text-primary"
                >
                    <ArrowRight :size="14" />
                    {{ po.po_number }} — {{ po.supplier }} ({{
                        po.items_count
                    }}
                    ítems)
                </Link>
            </div>
        </div>

        <!-- Error -->
        <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
        >
            <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>

        <!-- Table -->
        <div
            class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
        >
            <div v-if="loading" class="p-12 text-center text-gray-500">
                <div
                    class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
                ></div>
                Cargando...
            </div>
            <div
                v-else-if="filteredItems.length === 0"
                class="p-12 text-center text-gray-400"
            >
                <Filter :size="48" class="mx-auto mb-3 opacity-40" />
                <p>No hay ítems que coincidan con el filtro seleccionado.</p>
                <button
                    @click="selectedSupplierFilter = null"
                    class="mt-3 text-sm text-indigo-600 hover:underline dark:text-primary"
                >
                    Ver todos los ítems
                </button>
            </div>
            <div v-else class="overflow-x-auto">
                <table
                    class="min-w-full divide-y divide-gray-200 dark:divide-border"
                >
                    <thead class="bg-gray-50 dark:bg-background">
                        <tr>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                                Producto
                            </th>
                            <th
                                class="w-64 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                                Proveedor
                            </th>
                            <th
                                class="w-24 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                            >
                                Cantidad
                            </th>
                            <th
                                class="w-24 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                            >
                                Stock POS
                            </th>
                            <th
                                class="w-28 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                            >
                                Costo Unit.
                            </th>
                            <th
                                class="w-20 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                            >
                                ITBM %
                            </th>
                            <th
                                class="w-28 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                            >
                                Subtotal
                            </th>
                            <th
                                class="w-28 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                            >
                                Total
                            </th>
                            <th
                                class="w-28 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                            >
                                P. Venta
                            </th>
                            <th
                                class="w-40 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                                Notas
                            </th>
                            <th
                                class="w-16 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                            ></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr
                            v-for="item in filteredItems"
                            :key="item.id"
                            class="transition hover:bg-gray-50 dark:hover:bg-muted/30"
                        >
                            <!-- Producto (read-only) -->
                            <td class="px-4 py-2">
                                <p
                                    class="text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{ item.product?.name ?? '—' }}
                                </p>
                                <p class="font-mono text-xs text-gray-400">
                                    {{ item.product?.sku_base ?? '' }}
                                </p>
                                <p
                                    v-if="item.variant"
                                    class="text-xs text-indigo-500"
                                >
                                    {{ item.variant.sku }}
                                </p>
                            </td>
                            <!-- Proveedor (editable select) -->
                            <td class="w-64 px-4 py-2">
                                <SearchableSelect
                                    :model-value="item.supplier_id"
                                    :options="supplierOptions"
                                    @update:model-value="
                                        (val) => {
                                            item.supplier_id = val as
                                                | number
                                                | null;
                                            debouncedSave(item);
                                        }
                                    "
                                />
                            </td>
                            <!-- Cantidad (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.quantity_needed"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-right text-sm dark:border-border dark:bg-muted dark:text-white"
                                />
                            </td>
                            <td
                                class="px-4 py-2 text-right text-sm font-semibold text-amber-600 dark:text-amber-300"
                            >
                                {{ Number(item.stock_added_qty || 0) }}
                            </td>
                            <!-- Costo Unitario (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.unit_cost"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-right text-sm dark:border-border dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- ITBM % (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.tax_rate"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-right text-sm dark:border-border dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- Subtotal (computed, read-only) -->
                            <td
                                class="px-4 py-2 text-right font-mono text-sm text-gray-600 dark:text-gray-300"
                            >
                                {{
                                    formatCurrency(
                                        item.quantity_needed * item.unit_cost,
                                    )
                                }}
                            </td>
                            <!-- Total con ITBM (computed, read-only) -->
                            <td
                                class="px-4 py-2 text-right font-mono text-sm font-semibold text-gray-900 dark:text-white"
                            >
                                {{
                                    formatCurrency(
                                        item.quantity_needed *
                                            item.unit_cost *
                                            (1 + item.tax_rate / 100),
                                    )
                                }}
                            </td>
                            <!-- Precio Venta (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.sale_price"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-right text-sm dark:border-border dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- Notas (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model="item.notes"
                                    @input="debouncedSave(item)"
                                    type="text"
                                    placeholder="..."
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- Acciones -->
                            <td class="px-4 py-2 text-center">
                                <div
                                    class="flex items-center justify-center gap-1"
                                >
                                    <span
                                        v-if="savingItemId === item.id"
                                        class="text-xs text-indigo-500"
                                    >
                                        <Save
                                            :size="14"
                                            class="animate-pulse"
                                        />
                                    </span>
                                    <button
                                        @click="handleRemove(item.id)"
                                        class="rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 :size="15" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <!-- Footer with totals -->
                    <tfoot class="bg-gray-100 dark:bg-muted">
                        <tr class="font-semibold">
                            <td
                                colspan="6"
                                class="px-4 py-3 text-right text-sm text-gray-600 uppercase dark:text-gray-300"
                            >
                                Totales:
                            </td>
                            <td
                                class="px-4 py-3 text-right font-mono text-sm text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(totals.subtotal) }}
                            </td>
                            <td
                                class="px-4 py-3 text-right font-mono text-sm text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(totals.total) }}
                            </td>
                            <td colspan="3"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div
                v-if="filteredItems.length > 0"
                class="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-2 text-xs text-gray-400 dark:border-border dark:bg-muted"
            >
                <span class="tracking-widest uppercase">
                    {{ filteredItems.length }} de {{ items.length }}
                    {{ items.length === 1 ? 'ítem' : 'ítems' }}
                    <span
                        v-if="selectedSupplierFilter !== null"
                        class="font-medium text-indigo-600 dark:text-primary"
                    >
                        (Filtrado)
                    </span>
                </span>
                <button
                    v-if="selectedSupplierFilter !== null"
                    @click="selectedSupplierFilter = null"
                    class="flex items-center gap-1 text-indigo-600 hover:underline dark:text-primary"
                >
                    <XIcon :size="12" />
                    Limpiar filtro
                </button>
            </div>
        </div>
    </div>

    <!-- Product Search Modal (POS-style) -->
    <ProductSearchModal
        :show="showSearchModal"
        :products="productList"
        :search-query="searchQuery"
        :total-count="totalProducts"
        :has-more="hasNextPage"
        :loading-more="productsLoading"
        context="supply-list"
        :show-quick-purchase-action="false"
        @close="showSearchModal = false"
        @product-selected="handleProductSelected"
        @load-more="fetchMoreProducts"
    />

    <!-- Quick Purchase Modal (for adding to supply list) -->
    <QuickPurchaseModal
        v-if="selectedProductForPurchase"
        :is-open="showQuickPurchaseModal"
        :product="selectedProductForPurchase"
        :show-quick-purchase-action="false"
        @close="
            showQuickPurchaseModal = false;
            selectedProductForPurchase = null;
        "
        @success="handleQuickPurchaseSuccess"
    />

    <!-- Product Detail Modal -->
    <ProductDetailModal
        v-if="selectedProductForDetail"
        :product="selectedProductForDetail"
        @close="selectedProductForDetail = null"
    />
</template>
