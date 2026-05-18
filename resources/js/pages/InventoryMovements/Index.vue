<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import {
    ArrowLeftRight,
    Boxes,
    FileText,
    PackageMinus,
    PackagePlus,
    RefreshCw,
    Search,
    Warehouse,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useInventoryMovements } from '@/composables/useInventoryMovements';
import { usePosSettings } from '@/composables/usePosSettings';
import apiClient from '@/services/api/client';
import { type BreadcrumbItem } from '@/types';
import type {
    InventoryMovement,
    InventoryMovementFilters,
} from '@/types/inventory-movement';

interface WarehouseOption {
    id: number;
    name: string;
    code?: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Movimientos', href: '/inventory-movements' },
];

const {
    movements,
    fetchMovements,
    loading,
    error,
    currentPage,
    lastPage,
    total,
} = useInventoryMovements();
const {
    isSingleWarehouseMode,
    fetchSettings,
    currentWarehouseId,
    initWarehouse,
} = usePosSettings();

const filters = ref<InventoryMovementFilters>({
    search: '',
    movement_type: undefined,
    warehouse_id: undefined,
    date_from: '',
    date_to: '',
});
const warehouses = ref<WarehouseOption[]>([]);

const showWarehouseColumns = computed(
    () => !isSingleWarehouseMode() && !filters.value.warehouse_id,
);
const tableColspan = computed(() => (showWarehouseColumns.value ? 9 : 7));
const warehouseFilterModel = computed<number | string | null>({
    get: () => filters.value.warehouse_id ?? null,
    set: (value) => {
        filters.value.warehouse_id = value ? Number(value) : undefined;
    },
});
const warehouseFilterOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
        sublabel: warehouse.code ?? undefined,
    })),
]);
const activeFilterCount = computed(() => {
    return [
        filters.value.search,
        filters.value.movement_type,
        filters.value.warehouse_id,
        filters.value.date_from,
        filters.value.date_to,
    ].filter(Boolean).length;
});
const movementStats = computed(() => {
    const pageMovements = movements.value;

    return {
        entries: pageMovements.filter(
            (movement) => movement.movement_type === 'in',
        ).length,
        exits: pageMovements.filter(
            (movement) => movement.movement_type === 'out',
        ).length,
        transfers: pageMovements.filter(
            (movement) => movement.movement_type === 'transfer',
        ).length,
        units: pageMovements.reduce(
            (sum, movement) => sum + Number(movement.quantity || 0),
            0,
        ),
    };
});

onMounted(async () => {
    await Promise.all([initWarehouse(), fetchSettings(), fetchWarehouses()]);

    if (currentWarehouseId.value) {
        filters.value.warehouse_id = currentWarehouseId.value;
    }

    await fetchMovements(filters.value);
});

async function fetchWarehouses(): Promise<void> {
    try {
        const { data } = await apiClient.get('/warehouses');
        warehouses.value = data.data ?? [];
    } catch (err) {
        console.error('Warehouses fetch error:', err);
    }
}

function applyFilters(): void {
    fetchMovements(filters.value, 1);
}

function clearFilters(): void {
    filters.value = {
        search: '',
        movement_type: undefined,
        warehouse_id: currentWarehouseId.value || undefined,
        date_from: '',
        date_to: '',
    };
    fetchMovements(filters.value, 1);
}

function refreshMovements(): void {
    fetchMovements(filters.value, currentPage.value);
}

function goToPage(page: number): void {
    fetchMovements(filters.value, page);
}

function viewMovement(id: number): void {
    router.visit(`/inventory-movements/${id}`);
}

function viewProduct(id: number): void {
    router.visit(`/products/${id}`);
}

function openReference(movement: InventoryMovement): void {
    const href = referenceHref(movement);

    if (href) {
        router.visit(href);
    }
}

function referenceHref(movement: InventoryMovement): string | null {
    if (!movement.reference_id) {
        return null;
    }

    const routes: Record<string, string> = {
        purchase: `/purchase-orders/${movement.reference_id}`,
        purchase_order: `/purchase-orders/${movement.reference_id}`,
        sale: `/sales-orders/${movement.reference_id}`,
        sales_order: `/sales-orders/${movement.reference_id}`,
        transfer: `/inventory-transfers/${movement.reference_id}`,
    };

    return movement.reference_type
        ? (routes[movement.reference_type] ?? null)
        : null;
}

function referenceLabel(type?: string | null): string {
    const labels: Record<string, string> = {
        purchase: 'OC',
        purchase_order: 'OC',
        adjustment: 'Ajuste',
        return: 'Devolucion',
        sales_return: 'Devolucion venta',
        waste: 'Merma',
        transfer: 'Transferencia',
        sale: 'Venta',
        sales_order: 'Venta',
        manual_inbound: 'Entrada manual',
        manual_adjustment: 'Ajuste manual',
        opening_balance: 'Apertura',
        supply_list: 'Abastecimiento',
    };

    return type ? (labels[type] ?? type) : '-';
}

function movementDetail(movement: InventoryMovement): {
    primary: string;
    secondary: string;
} {
    if (movement.reference_type === 'waste' && movement.reason) {
        return {
            primary: `Merma: ${movement.reason}`,
            secondary: movement.notes ?? '',
        };
    }

    const refLabel = referenceLabel(movement.reference_type);
    const refId = movement.reference_id ? ` #${movement.reference_id}` : '';

    return {
        primary: refLabel === '-' ? '' : `${refLabel}${refId}`,
        secondary: movement.notes ?? '',
    };
}

function movementTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        in: 'Entrada',
        out: 'Salida',
        transfer: 'Transferencia',
    };

    return labels[type] ?? type;
}

function movementTypeClass(type: string): string {
    const colors: Record<string, string> = {
        in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        out: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
        transfer:
            'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    };

    return (
        colors[type] ??
        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    );
}

function formatDate(dateString?: string | null): string {
    if (!dateString) {
        return '-';
    }

    return new Intl.DateTimeFormat('es-MX', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(dateString));
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: 2,
    }).format(Number(value || 0));
}
</script>

<template>
    <Head title="Movimientos de inventario" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <div
                class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:flex-row lg:items-start lg:justify-between dark:border-border dark:bg-card"
            >
                <div class="min-w-0">
                    <h1
                        class="text-xl font-semibold text-gray-950 dark:text-white"
                    >
                        Movimientos de inventario
                    </h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Historial de entradas, salidas, transferencias y mermas.
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2 text-xs">
                        <span
                            class="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-muted dark:text-gray-200"
                        >
                            {{ total }} movimientos
                        </span>
                        <span
                            v-if="activeFilterCount"
                            class="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                        >
                            {{ activeFilterCount }} filtros activos
                        </span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                        @click="refreshMovements"
                    >
                        <RefreshCw class="h-4 w-4" />
                        Refrescar
                    </button>
                    <a
                        href="/inventory-movements/inbound/create"
                        class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        <PackagePlus class="h-4 w-4" />
                        Entrada
                    </a>
                    <a
                        href="/inventory-movements/outbound/create"
                        class="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950"
                    >
                        <PackageMinus class="h-4 w-4" />
                        Salida
                    </a>
                    <a
                        v-if="!isSingleWarehouseMode()"
                        href="/inventory-movements/transfer/create"
                        class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                    >
                        <ArrowLeftRight class="h-4 w-4" />
                        Transferencia
                    </a>
                </div>
            </div>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                    >
                        <PackagePlus class="h-4 w-4 text-emerald-600" />
                        Entradas pagina
                    </div>
                    <p
                        class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white"
                    >
                        {{ movementStats.entries }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                    >
                        <PackageMinus class="h-4 w-4 text-red-600" />
                        Salidas pagina
                    </div>
                    <p
                        class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white"
                    >
                        {{ movementStats.exits }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                    >
                        <ArrowLeftRight class="h-4 w-4 text-blue-600" />
                        Transferencias pagina
                    </div>
                    <p
                        class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white"
                    >
                        {{ movementStats.transfers }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                    >
                        <Boxes class="h-4 w-4 text-indigo-600" />
                        Unidades pagina
                    </div>
                    <p
                        class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white"
                    >
                        {{ formatNumber(movementStats.units) }}
                    </p>
                </div>
            </div>

            <div
                class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <div
                    class="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_1fr_0.8fr_0.8fr_auto]"
                >
                    <div>
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Buscar
                        </label>
                        <div class="relative">
                            <Search
                                class="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-gray-400"
                            />
                            <input
                                v-model="filters.search"
                                type="text"
                                placeholder="Producto, SKU o variante"
                                class="w-full rounded-md border border-gray-300 py-2 pr-3 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                                @keyup.enter="applyFilters"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Tipo
                        </label>
                        <select
                            v-model="filters.movement_type"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="undefined">Todos</option>
                            <option value="in">Entrada</option>
                            <option value="out">Salida</option>
                            <option
                                v-if="!isSingleWarehouseMode()"
                                value="transfer"
                            >
                                Transferencia
                            </option>
                        </select>
                    </div>

                    <div v-if="!isSingleWarehouseMode()">
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

                    <div>
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Desde
                        </label>
                        <input
                            v-model="filters.date_from"
                            type="date"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                        >
                            Hasta
                        </label>
                        <input
                            v-model="filters.date_to"
                            type="date"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div class="flex items-end gap-2">
                        <button
                            type="button"
                            class="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            @click="applyFilters"
                        >
                            Filtrar
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                            @click="clearFilters"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            <div
                v-if="loading"
                class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-border dark:bg-card dark:text-gray-300"
            >
                Cargando movimientos...
            </div>

            <div
                v-else-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
                {{ error }}
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
                                    v-if="showWarehouseColumns"
                                    class="px-4 py-3"
                                >
                                    Almacen origen
                                </th>
                                <th
                                    v-if="showWarehouseColumns"
                                    class="px-4 py-3"
                                >
                                    Almacen destino
                                </th>
                                <th class="px-4 py-3 text-right">Cantidad</th>
                                <th class="px-4 py-3">Referencia</th>
                                <th class="px-4 py-3">Proveedor</th>
                                <th class="px-4 py-3 text-right">Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="movement in movements"
                                :key="movement.id"
                                class="border-t border-gray-100 hover:bg-gray-50 dark:border-border dark:hover:bg-muted/40"
                            >
                                <td
                                    class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300"
                                >
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
                                        type="button"
                                        class="text-left font-medium text-blue-600 hover:underline dark:text-primary"
                                        @click="
                                            viewProduct(movement.product.id)
                                        "
                                    >
                                        {{ movement.product.name }}
                                    </button>
                                    <div
                                        class="font-mono text-xs text-gray-500"
                                    >
                                        {{
                                            movement.variant?.sku ||
                                            movement.product.sku ||
                                            '-'
                                        }}
                                    </div>
                                    <div
                                        v-if="movement.product_batch"
                                        class="mt-1 font-mono text-xs text-gray-500"
                                    >
                                        Lote
                                        {{
                                            movement.product_batch
                                                .batch_number || '-'
                                        }}
                                    </div>
                                </td>
                                <td
                                    v-if="showWarehouseColumns"
                                    class="px-4 py-3 text-gray-700 dark:text-gray-200"
                                >
                                    <div class="flex items-center gap-2">
                                        <Warehouse
                                            class="h-3.5 w-3.5 text-gray-400"
                                        />
                                        {{ movement.warehouse.name }}
                                    </div>
                                </td>
                                <td
                                    v-if="showWarehouseColumns"
                                    class="px-4 py-3 text-gray-700 dark:text-gray-200"
                                >
                                    {{
                                        movement.destination_warehouse?.name ||
                                        '-'
                                    }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right font-semibold text-gray-950 dark:text-white"
                                >
                                    {{ formatNumber(movement.quantity) }}
                                </td>
                                <td class="max-w-xs px-4 py-3">
                                    <button
                                        v-if="referenceHref(movement)"
                                        type="button"
                                        class="text-left font-medium text-blue-600 hover:underline dark:text-primary"
                                        @click="openReference(movement)"
                                    >
                                        {{ movementDetail(movement).primary }}
                                    </button>
                                    <div
                                        v-else
                                        class="font-medium text-gray-950 dark:text-white"
                                    >
                                        {{
                                            movementDetail(movement).primary ||
                                            '-'
                                        }}
                                    </div>
                                    <div
                                        v-if="
                                            movementDetail(movement).secondary
                                        "
                                        class="truncate text-xs text-gray-500"
                                        :title="
                                            movementDetail(movement).secondary
                                        "
                                    >
                                        {{ movementDetail(movement).secondary }}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 text-gray-600 dark:text-gray-300"
                                >
                                    {{ movement.supplier?.name || '-' }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        class="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-primary"
                                        @click="viewMovement(movement.id)"
                                    >
                                        <FileText class="h-4 w-4" />
                                        Detalle
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="movements.length === 0">
                                <td
                                    :colspan="tableColspan"
                                    class="px-4 py-10 text-center text-sm text-gray-500"
                                >
                                    No hay movimientos registrados.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div
                    v-if="total > 0"
                    class="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-border"
                >
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                        Pagina {{ currentPage }} de {{ lastPage }} &middot;
                        {{ total }} movimientos
                    </p>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            :disabled="currentPage === 1"
                            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                            @click="goToPage(currentPage - 1)"
                        >
                            Anterior
                        </button>
                        <button
                            type="button"
                            :disabled="currentPage === lastPage"
                            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                            @click="goToPage(currentPage + 1)"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
