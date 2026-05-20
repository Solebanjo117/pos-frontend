<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import {
    AlertCircle,
    Calendar,
    History,
    Package,
    Search,
    TrendingUp,
    Warehouse,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import apiClient from '@/services/api/client';
import { useAuth } from '@/composables/useAuth';
import { usePosSettings } from '@/composables/usePosSettings';
import { type BreadcrumbItem } from '@/types';

type ViewMode = 'summary' | 'lots' | 'movements';

interface WarehouseOption {
    id: number;
    name: string;
    code?: string;
}

interface InventoryRow {
    id: number;
    product_id: number;
    variant_id: number | null;
    product_name: string;
    product_sku: string;
    variant_sku: string | null;
    brand: string;
    warehouse_id: number;
    warehouse_name: string;
    stock_available: number;
    stock_reserved: number;
    quantity_available: number;
    quantity_reserved: number;
    reorder_point: number;
    reorder_quantity: number;
    status: 'out_of_stock' | 'low_stock' | 'normal' | 'optimal';
    active_lot_id: number | null;
    current_sale_price: number;
    fifo_sale_price_current: number;
    fifo_cost_current: number;
    fifo_stock_value: number;
    open_lots_count: number;
    last_received_at: string | null;
    last_sold_at: string | null;
    base_price: number | null;
}

interface FifoLotRow {
    id: number;
    product_id: number;
    variant_id: number | null;
    warehouse_id: number;
    product_name: string;
    product_sku: string;
    variant_sku: string | null;
    brand: string;
    warehouse_name: string;
    source_type: string | null;
    source_id: number | null;
    batch_number: string | null;
    received_quantity: number;
    quantity_available: number;
    unit_cost_base: number;
    tax_per_unit: number;
    misc_per_unit: number;
    landed_unit_cost: number;
    sale_price: number;
    remaining_value: number;
    received_at: string | null;
}

interface MovementRow {
    id: number;
    movement_type: 'in' | 'out' | 'transfer';
    product?: {
        id: number;
        name: string;
        sku: string;
    };
    variant?: {
        id: number;
        sku: string;
    } | null;
    warehouse?: {
        id: number;
        name: string;
    };
    destination_warehouse?: {
        id: number;
        name: string;
    } | null;
    quantity: number;
    reference_type?: string | null;
    reference_id?: number | null;
    reason?: string | null;
    fifo_allocations?: Array<{
        lot_id: number;
        quantity: number;
        unit_cost: number;
        total_cost: number;
    }>;
    created_at: string;
}

interface Pagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Filters {
    search: string;
    warehouse_id: number | undefined;
    stock_status: string | undefined;
    date_from: string;
    date_to: string;
    movement_type: string | undefined;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
];

const { hasRole } = useAuth();
const { currentWarehouseId, initWarehouse } = usePosSettings();

const viewMode = ref<ViewMode>('summary');
const loading = ref(false);
const error = ref<string | null>(null);
const inventoryRows = ref<InventoryRow[]>([]);
const fifoLots = ref<FifoLotRow[]>([]);
const movements = ref<MovementRow[]>([]);
const warehouses = ref<WarehouseOption[]>([]);

const pagination = ref<Pagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
});

const metrics = ref({
    total_stock: 0,
    total_fifo_value: 0,
    low_stock_count: 0,
    open_lots_count: 0,
    movements_today: 0,
});

const filters = ref<Filters>({
    search: '',
    warehouse_id: undefined,
    stock_status: undefined,
    date_from: '',
    date_to: '',
    movement_type: undefined,
});

const tabs: Array<{ key: ViewMode; label: string }> = [
    { key: 'summary', label: 'Resumen' },
    { key: 'lots', label: 'Lotes' },
    { key: 'movements', label: 'Movimientos' },
];

const showWarehouseColumn = computed(() => !filters.value.warehouse_id);

const lotsColspan = computed(() => (showWarehouseColumn.value ? 13 : 12));
const movementsColspan = computed(() => (showWarehouseColumn.value ? 8 : 6));

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

const canMutateInventory = computed(() =>
    hasRole(['admin', 'manager', 'buyer', 'assistant']),
);

onMounted(async () => {
    await initWarehouse();
    filters.value.warehouse_id = currentWarehouseId.value || undefined;
    await Promise.all([fetchWarehouses(), fetchData(1), fetchMetrics()]);
});

watch(viewMode, async () => {
    await fetchData(1);
});

watch(currentWarehouseId, async (warehouseId) => {
    filters.value.warehouse_id = warehouseId || undefined;
    await Promise.all([fetchData(1), fetchMetrics()]);
});

async function fetchData(page = 1): Promise<void> {
    if (viewMode.value === 'summary') {
        await fetchInventory(page);
        return;
    }

    if (viewMode.value === 'lots') {
        await fetchFifoLots(page);
        return;
    }

    await fetchMovements(page);
}

async function fetchInventory(page = 1): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
        const { data } = await apiClient.get('/inventory', {
            params: {
                page,
                per_page: pagination.value.per_page,
                search: filters.value.search,
                warehouse_id: filters.value.warehouse_id,
                status: filters.value.stock_status,
            },
        });
        inventoryRows.value = data.data;
        pagination.value = data.meta;
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'Error al cargar inventario.';
    } finally {
        loading.value = false;
    }
}

async function fetchFifoLots(page = 1): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
        const { data } = await apiClient.get('/inventory/batches', {
            params: {
                open_lots: 1,
                page,
                per_page: pagination.value.per_page,
                search: filters.value.search,
                warehouse_id: filters.value.warehouse_id,
            },
        });
        fifoLots.value = data.data;
        pagination.value = data.meta;
    } catch (err: any) {
        error.value = err.response?.data?.message || 'Error al cargar lotes.';
    } finally {
        loading.value = false;
    }
}

async function fetchMovements(page = 1): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
        const { data } = await apiClient.get('/inventory-movements', {
            params: {
                page,
                per_page: pagination.value.per_page,
                search: filters.value.search,
                warehouse_id: filters.value.warehouse_id,
                date_from: filters.value.date_from,
                date_to: filters.value.date_to,
                movement_type: filters.value.movement_type,
            },
        });
        movements.value = data.data;
        pagination.value = data.meta;
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'Error al cargar movimientos.';
    } finally {
        loading.value = false;
    }
}

async function fetchMetrics(): Promise<void> {
    try {
        const { data } = await apiClient.get('/inventory/summary', {
            params: {
                warehouse_id: filters.value.warehouse_id,
            },
        });
        metrics.value = data.data;
    } catch (err) {
        console.error('Inventory summary error:', err);
    }
}

async function fetchWarehouses(): Promise<void> {
    try {
        const { data } = await apiClient.get('/warehouses');
        warehouses.value = data.data;
    } catch (err) {
        console.error('Warehouses fetch error:', err);
    }
}

async function applyFilters(): Promise<void> {
    await Promise.all([fetchData(1), fetchMetrics()]);
}

async function clearFilters(): Promise<void> {
    filters.value = {
        search: '',
        warehouse_id: currentWarehouseId.value || undefined,
        stock_status: undefined,
        date_from: '',
        date_to: '',
        movement_type: undefined,
    };
    await Promise.all([fetchData(1), fetchMetrics()]);
}

function setDatePreset(preset: 'today' | 'week' | 'month' | '30days'): void {
    const today = new Date();
    const from = new Date();

    if (preset === 'today') {
        filters.value.date_from = today.toISOString().split('T')[0];
        filters.value.date_to = today.toISOString().split('T')[0];
    }

    if (preset === 'week') {
        from.setDate(today.getDate() - 7);
        filters.value.date_from = from.toISOString().split('T')[0];
        filters.value.date_to = today.toISOString().split('T')[0];
    }

    if (preset === 'month') {
        from.setMonth(today.getMonth() - 1);
        filters.value.date_from = from.toISOString().split('T')[0];
        filters.value.date_to = today.toISOString().split('T')[0];
    }

    if (preset === '30days') {
        from.setDate(today.getDate() - 30);
        filters.value.date_from = from.toISOString().split('T')[0];
        filters.value.date_to = today.toISOString().split('T')[0];
    }

    applyFilters();
}

function goToPage(page: number): void {
    fetchData(page);
}

function viewMovement(id: number): void {
    router.visit(`/inventory-movements/${id}`);
}

function viewInventoryProduct(
    productId: number,
    variantId?: number | null,
    warehouseId?: number | null,
): void {
    const params = new URLSearchParams();

    if (variantId) {
        params.set('variant', String(variantId));
    }

    if (warehouseId) {
        params.set('warehouse_id', String(warehouseId));
    }

    const query = params.toString();
    router.visit(`/inventory/products/${productId}${query ? `?${query}` : ''}`);
}

function historyKey(row: InventoryRow): string {
    return `${row.product_id}:${row.variant_id}:${row.warehouse_id}`;
}

function formatCurrency(value?: number | null): string {
    if (value === null || value === undefined) {
        return '-';
    }

    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value));
}

function formatDate(value?: string | null): string {
    if (!value) {
        return '-';
    }

    return new Intl.DateTimeFormat('es-PA', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

function statusLabel(status: InventoryRow['status']): string {
    return (
        {
            out_of_stock: 'Sin stock',
            low_stock: 'Stock bajo',
            normal: 'Normal',
            optimal: 'Optimo',
        }[status] ?? 'Normal'
    );
}

function statusClass(status: InventoryRow['status']): string {
    return (
        {
            out_of_stock:
                'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
            low_stock:
                'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
            normal: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
            optimal:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        }[status] ?? 'bg-gray-100 text-gray-700'
    );
}

function movementTypeLabel(type: string): string {
    return (
        {
            in: 'Entrada',
            out: 'Salida',
            transfer: 'Transferencia',
        }[type] ?? type
    );
}

function movementTypeClass(type: string): string {
    return (
        {
            in: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
            out: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
            transfer:
                'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
        }[type] ?? 'bg-gray-100 text-gray-700'
    );
}

function sourceLabel(type?: string | null, id?: number | null): string {
    const labels: Record<string, string> = {
        purchase_order: 'OC',
        manual_inbound: 'Entrada manual',
        opening_balance: 'Saldo inicial',
        manual_adjustment: 'Ajuste manual',
        transfer: 'Transferencia',
        sale: 'Venta',
        waste: 'Merma',
    };

    const label = type ? (labels[type] ?? type) : 'Movimiento';
    return id ? `${label} #${id}` : label;
}

function pageItemLabel(): string {
    if (viewMode.value === 'summary') {
        return 'registros';
    }

    if (viewMode.value === 'lots') {
        return 'lotes';
    }

    return 'movimientos';
}
</script>

<template>
    <Head title="Inventario" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
                <div>
                    <h1
                        class="text-2xl font-semibold text-gray-950 dark:text-white"
                    >
                        Inventario
                    </h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Stock operativo, lotes y movimientos por variante.
                    </p>
                </div>

                <div v-if="canMutateInventory" class="flex flex-wrap gap-2">
                    <a
                        href="/inventory/waste"
                        class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                    >
                        <AlertCircle :size="16" />
                        Registrar merma
                    </a>
                    <!--
                        Futuro: habilitar transferencia desde inventario cuando el flujo quede aprobado.
                        <a href="/inventory-movements/transfer/create">Nueva Transferencia</a>
                    -->
                </div>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Stock total
                            </p>
                            <p
                                class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{ metrics.total_stock }}
                            </p>
                        </div>
                        <TrendingUp class="h-7 w-7 text-emerald-600" />
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Valor inventario
                            </p>
                            <p
                                class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{ formatCurrency(metrics.total_fifo_value) }}
                            </p>
                        </div>
                        <Package class="h-7 w-7 text-blue-600" />
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Stock bajo
                            </p>
                            <p
                                class="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-300"
                            >
                                {{ metrics.low_stock_count }}
                            </p>
                        </div>
                        <AlertCircle class="h-7 w-7 text-amber-600" />
                    </div>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Movimientos hoy
                            </p>
                            <p
                                class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white"
                            >
                                {{ metrics.movements_today }}
                            </p>
                        </div>
                        <Calendar class="h-7 w-7 text-indigo-600" />
                    </div>
                </div>
            </div>

            <div
                class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div
                    class="flex flex-wrap gap-1 border-b border-gray-200 px-3 pt-3 dark:border-border"
                >
                    <button
                        v-for="tab in tabs"
                        :key="tab.key"
                        type="button"
                        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
                        :class="
                            viewMode === tab.key
                                ? 'border-blue-600 text-blue-600 dark:border-primary dark:text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                        "
                        @click="viewMode = tab.key"
                    >
                        {{ tab.label }}
                    </button>
                </div>

                <div class="grid grid-cols-1 gap-3 p-4 lg:grid-cols-12">
                    <div class="lg:col-span-3">
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Buscar
                        </label>
                        <div class="relative">
                            <Search
                                class="absolute top-2.5 left-2.5 h-4 w-4 text-gray-400"
                            />
                            <input
                                v-model="filters.search"
                                type="text"
                                placeholder="Producto, SKU, marca o lote"
                                class="w-full rounded-md border border-gray-300 py-2 pr-3 pl-8 text-sm dark:border-border dark:bg-muted dark:text-white"
                                @keyup.enter="applyFilters"
                            />
                        </div>
                    </div>

                    <div class="lg:col-span-2">
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Almacen
                        </label>
                        <SearchableSelect
                            v-model="warehouseFilterModel"
                            :options="warehouseFilterOptions"
                            placeholder="Todos"
                        />
                    </div>

                    <div v-if="viewMode === 'summary'" class="lg:col-span-2">
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Estado
                        </label>
                        <select
                            v-model="filters.stock_status"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="undefined">Todos</option>
                            <option value="out_of_stock">Sin stock</option>
                            <option value="low_stock">Stock bajo</option>
                            <option value="normal">Normal</option>
                            <option value="optimal">Optimo</option>
                        </select>
                    </div>

                    <template v-if="viewMode === 'movements'">
                        <div class="lg:col-span-2">
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Desde
                            </label>
                            <input
                                v-model="filters.date_from"
                                type="date"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                        <div class="lg:col-span-2">
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Hasta
                            </label>
                            <input
                                v-model="filters.date_to"
                                type="date"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                        <div class="lg:col-span-2">
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Tipo
                            </label>
                            <select
                                v-model="filters.movement_type"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option :value="undefined">Todos</option>
                                <option value="in">Entradas</option>
                                <option value="out">Salidas</option>
                                <option value="transfer">Transferencias</option>
                            </select>
                        </div>
                    </template>

                    <div class="flex items-end gap-2 lg:col-span-3">
                        <button
                            type="button"
                            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground"
                            @click="applyFilters"
                        >
                            Filtrar
                        </button>
                        <button
                            type="button"
                            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                            @click="clearFilters"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>

                <div
                    v-if="viewMode === 'movements'"
                    class="flex flex-wrap gap-2 px-4 pb-4"
                >
                    <button
                        type="button"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-200"
                        @click="setDatePreset('today')"
                    >
                        Hoy
                    </button>
                    <button
                        type="button"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-200"
                        @click="setDatePreset('week')"
                    >
                        7 dias
                    </button>
                    <button
                        type="button"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-200"
                        @click="setDatePreset('month')"
                    >
                        Mes
                    </button>
                    <button
                        type="button"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-muted dark:text-gray-200"
                        @click="setDatePreset('30days')"
                    >
                        30 dias
                    </button>
                </div>
            </div>

            <div
                v-if="loading"
                class="rounded-lg border border-gray-200 bg-white py-12 text-center dark:border-border dark:bg-card"
            >
                <div
                    class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"
                ></div>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Cargando inventario...
                </p>
            </div>

            <div
                v-else-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
                {{ error }}
            </div>

            <div
                v-else-if="viewMode === 'summary'"
                class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table class="min-w-full text-left text-sm">
                        <thead
                            class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                        >
                            <tr>
                                <th class="px-4 py-3">Producto</th>
                                <th class="px-4 py-3">Variante</th>
                                <th
                                    v-if="showWarehouseColumn"
                                    class="px-4 py-3"
                                >
                                    Almacen
                                </th>
                                <th class="px-4 py-3 text-right">Disponible</th>
                                <th class="px-4 py-3 text-right">Reservado</th>
                                <th class="px-4 py-3 text-right">
                                    Costo actual
                                </th>
                                <th class="px-4 py-3 text-right">
                                    Precio actual
                                </th>
                                <th class="px-4 py-3 text-right">
                                    Valor inventario
                                </th>
                                <th class="px-4 py-3">Ultimo ingreso</th>
                                <th class="px-4 py-3">Ultima salida</th>
                                <th class="px-4 py-3">Estado</th>
                                <th class="px-4 py-3 text-right">Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template
                                v-for="row in inventoryRows"
                                :key="historyKey(row)"
                            >
                                <tr
                                    class="border-t border-gray-100 dark:border-border"
                                >
                                    <td class="px-4 py-3">
                                        <button
                                            type="button"
                                            class="text-left font-medium text-blue-600 hover:underline dark:text-primary"
                                            @click="
                                                viewInventoryProduct(
                                                    row.product_id,
                                                    row.variant_id,
                                                    row.warehouse_id,
                                                )
                                            "
                                        >
                                            {{ row.product_name }}
                                        </button>
                                        <div
                                            class="font-mono text-xs text-gray-500"
                                        >
                                            {{ row.product_sku }}
                                        </div>
                                    </td>
                                    <td class="px-4 py-3">
                                        <button
                                            type="button"
                                            class="block text-left font-medium text-blue-600 hover:underline disabled:text-gray-900 disabled:no-underline dark:text-primary dark:disabled:text-white"
                                            :disabled="!row.variant_id"
                                            @click="
                                                viewInventoryProduct(
                                                    row.product_id,
                                                    row.variant_id,
                                                    row.warehouse_id,
                                                )
                                            "
                                        >
                                            {{ row.brand }}
                                        </button>
                                        <div
                                            class="font-mono text-xs text-gray-500"
                                        >
                                            {{ row.variant_sku || '-' }}
                                        </div>
                                    </td>
                                    <td
                                        v-if="showWarehouseColumn"
                                        class="px-4 py-3 text-gray-700 dark:text-gray-200"
                                    >
                                        {{ row.warehouse_name }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{ row.quantity_available }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        {{ row.quantity_reserved }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{
                                            formatCurrency(
                                                row.fifo_cost_current,
                                            )
                                        }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{
                                            formatCurrency(
                                                row.current_sale_price ??
                                                    row.fifo_sale_price_current,
                                            )
                                        }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{
                                            formatCurrency(row.fifo_stock_value)
                                        }}
                                    </td>
                                    <td class="px-4 py-3 text-xs">
                                        {{ formatDate(row.last_received_at) }}
                                    </td>
                                    <td class="px-4 py-3 text-xs">
                                        {{ formatDate(row.last_sold_at) }}
                                    </td>
                                    <td class="px-4 py-3">
                                        <span
                                            :class="statusClass(row.status)"
                                            class="rounded-full px-2 py-1 text-xs font-medium"
                                        >
                                            {{ statusLabel(row.status) }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            class="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-primary"
                                            :disabled="!row.variant_id"
                                            @click="
                                                viewInventoryProduct(
                                                    row.product_id,
                                                    row.variant_id,
                                                    row.warehouse_id,
                                                )
                                            "
                                        >
                                            <History class="h-4 w-4" />
                                            Ver movimientos
                                        </button>
                                    </td>
                                </tr>
                            </template>
                            <tr v-if="inventoryRows.length === 0">
                                <td
                                    :colspan="showWarehouseColumn ? 11 : 10"
                                    class="px-4 py-10 text-center text-sm text-gray-500"
                                >
                                    No se encontraron registros de inventario.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div
                v-else-if="viewMode === 'lots'"
                class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table class="min-w-full text-left text-sm">
                        <thead
                            class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                        >
                            <tr>
                                <th class="px-4 py-3">Fecha</th>
                                <th class="px-4 py-3">Producto</th>
                                <th class="px-4 py-3">Variante</th>
                                <th
                                    v-if="showWarehouseColumn"
                                    class="px-4 py-3"
                                >
                                    Almacen
                                </th>
                                <th class="px-4 py-3">Origen</th>
                                <th class="px-4 py-3 text-right">Inicial</th>
                                <th class="px-4 py-3 text-right">Disponible</th>
                                <th class="px-4 py-3 text-right">Costo</th>
                                <th class="px-4 py-3 text-right">ITBM</th>
                                <th class="px-4 py-3 text-right">Misc</th>
                                <th class="px-4 py-3 text-right">Final</th>
                                <th class="px-4 py-3 text-right">Precio</th>
                                <th class="px-4 py-3 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="lot in fifoLots"
                                :key="lot.id"
                                class="border-t border-gray-100 dark:border-border"
                            >
                                <td class="px-4 py-3 text-xs">
                                    {{ formatDate(lot.received_at) }}
                                </td>
                                <td class="px-4 py-3">
                                    <button
                                        type="button"
                                        class="text-left font-medium text-blue-600 hover:underline dark:text-primary"
                                        @click="
                                            viewInventoryProduct(
                                                lot.product_id,
                                                lot.variant_id,
                                                lot.warehouse_id,
                                            )
                                        "
                                    >
                                        {{ lot.product_name }}
                                    </button>
                                    <div
                                        class="font-mono text-xs text-gray-500"
                                    >
                                        {{ lot.product_sku }}
                                    </div>
                                </td>
                                <td class="px-4 py-3">
                                    <button
                                        type="button"
                                        class="text-left text-blue-600 hover:underline dark:text-primary"
                                        :disabled="!lot.variant_id"
                                        @click="
                                            viewInventoryProduct(
                                                lot.product_id,
                                                lot.variant_id,
                                                lot.warehouse_id,
                                            )
                                        "
                                    >
                                        {{ lot.brand }}
                                    </button>
                                    <div
                                        class="font-mono text-xs text-gray-500"
                                    >
                                        {{ lot.variant_sku || '-' }}
                                    </div>
                                </td>
                                <td
                                    v-if="showWarehouseColumn"
                                    class="px-4 py-3"
                                >
                                    {{ lot.warehouse_name }}
                                </td>
                                <td class="px-4 py-3">
                                    {{
                                        sourceLabel(
                                            lot.source_type,
                                            lot.source_id,
                                        )
                                    }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ lot.received_quantity }}
                                </td>
                                <td class="px-4 py-3 text-right font-semibold">
                                    {{ lot.quantity_available }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ formatCurrency(lot.unit_cost_base) }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ formatCurrency(lot.tax_per_unit) }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ formatCurrency(lot.misc_per_unit) }}
                                </td>
                                <td class="px-4 py-3 text-right font-semibold">
                                    {{ formatCurrency(lot.landed_unit_cost) }}
                                </td>
                                <td class="px-4 py-3 text-right font-semibold">
                                    {{ formatCurrency(lot.sale_price) }}
                                </td>
                                <td class="px-4 py-3 text-right font-semibold">
                                    {{ formatCurrency(lot.remaining_value) }}
                                </td>
                            </tr>
                            <tr v-if="fifoLots.length === 0">
                                <td
                                    :colspan="lotsColspan"
                                    class="px-4 py-10 text-center text-sm text-gray-500"
                                >
                                    No hay lotes abiertos.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div
                v-else
                class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table class="min-w-full text-left text-sm">
                        <thead
                            class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                        >
                            <tr>
                                <th class="px-4 py-3">Fecha</th>
                                <th class="px-4 py-3">Tipo</th>
                                <th class="px-4 py-3">Producto</th>
                                <th
                                    v-if="showWarehouseColumn"
                                    class="px-4 py-3"
                                >
                                    Almacen origen
                                </th>
                                <th
                                    v-if="showWarehouseColumn"
                                    class="px-4 py-3"
                                >
                                    Almacen destino
                                </th>
                                <th class="px-4 py-3 text-right">Cantidad</th>
                                <th class="px-4 py-3">Referencia</th>
                                <th class="px-4 py-3 text-right">Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="movement in movements"
                                :key="movement.id"
                                class="border-t border-gray-100 dark:border-border"
                            >
                                <td class="px-4 py-3 text-xs">
                                    {{ formatDate(movement.created_at) }}
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        :class="
                                            movementTypeClass(
                                                movement.movement_type,
                                            )
                                        "
                                        class="rounded-full px-2 py-1 text-xs font-medium"
                                    >
                                        {{
                                            movementTypeLabel(
                                                movement.movement_type,
                                            )
                                        }}
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <button
                                        v-if="movement.product?.id"
                                        type="button"
                                        class="text-left font-medium text-blue-600 hover:underline dark:text-primary"
                                        @click="
                                            viewInventoryProduct(
                                                movement.product.id,
                                                movement.variant?.id,
                                                movement.warehouse?.id,
                                            )
                                        "
                                    >
                                        {{ movement.product?.name || '-' }}
                                    </button>
                                    <div
                                        v-else
                                        class="font-medium text-gray-950 dark:text-white"
                                    >
                                        -
                                    </div>
                                    <div
                                        class="font-mono text-xs text-gray-500"
                                    >
                                        {{
                                            movement.variant?.sku ||
                                            movement.product?.sku ||
                                            '-'
                                        }}
                                    </div>
                                </td>
                                <td
                                    v-if="showWarehouseColumn"
                                    class="px-4 py-3"
                                >
                                    {{ movement.warehouse?.name || '-' }}
                                </td>
                                <td
                                    v-if="showWarehouseColumn"
                                    class="px-4 py-3"
                                >
                                    {{
                                        movement.destination_warehouse?.name ||
                                        '-'
                                    }}
                                </td>
                                <td class="px-4 py-3 text-right font-semibold">
                                    {{ movement.quantity }}
                                </td>
                                <td class="px-4 py-3">
                                    {{
                                        sourceLabel(
                                            movement.reference_type,
                                            movement.reference_id,
                                        )
                                    }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        class="text-sm font-medium text-blue-600 hover:underline dark:text-primary"
                                        @click="viewMovement(movement.id)"
                                    >
                                        Ver detalle
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="movements.length === 0">
                                <td
                                    :colspan="movementsColspan"
                                    class="px-4 py-10 text-center text-sm text-gray-500"
                                >
                                    No hay movimientos registrados.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div
                v-if="pagination.total > pagination.per_page"
                class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-border dark:bg-card"
            >
                <p class="text-sm text-gray-600 dark:text-gray-300">
                    Pagina {{ pagination.current_page }} de
                    {{ pagination.last_page }} · {{ pagination.total }}
                    {{ pageItemLabel() }}
                </p>
                <div class="flex gap-2">
                    <button
                        type="button"
                        :disabled="pagination.current_page === 1"
                        class="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-border"
                        @click="goToPage(pagination.current_page - 1)"
                    >
                        Anterior
                    </button>
                    <button
                        type="button"
                        :disabled="
                            pagination.current_page === pagination.last_page
                        "
                        class="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-border"
                        @click="goToPage(pagination.current_page + 1)"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
