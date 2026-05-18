<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
    Check,
    ChevronDown,
    History,
    Pencil,
    RefreshCw,
    X,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { productsApi } from '@/services/api/products';
import type {
    InventoryFifoLot,
    ProductVariant,
    VariantFifoHistory,
    VariantFifoMovement,
} from '@/types/product';

type WarehouseOption = {
    id: number;
    name: string;
    code?: string;
};

type MovementSourceLot = NonNullable<VariantFifoMovement['fifo_lots']>[number];

const props = withDefaults(
    defineProps<{
        productId: number;
        variant: ProductVariant | any;
        warehouses?: WarehouseOption[];
        initialWarehouseId?: number | null;
    }>(),
    {
        warehouses: () => [],
        initialWarehouseId: null,
    },
);

const emit = defineEmits<{
    (e: 'updated'): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const savingLotId = ref<number | null>(null);
const editingLotId = ref<number | null>(null);
const history = ref<VariantFifoHistory | null>(null);
const selectedWarehouseId = ref<number | null>(null);
const activeTab = ref<'lots' | 'purchases' | 'sales'>('lots');
const expandedSaleIds = ref<Set<number>>(new Set());
const lotEditForm = ref({
    received_at: '',
    quantity_available: 0,
    unit_cost_base: 0,
    tax_per_unit: 0,
    misc_per_unit: 0,
    sale_price: 0,
});
const tabs = [
    { key: 'lots', label: 'Lotes disponibles' },
    { key: 'purchases', label: 'Compras' },
    { key: 'sales', label: 'Ventas' },
] as const;

const variantWarehouseOptions = computed<WarehouseOption[]>(() => {
    const mapped =
        props.variant?.inventory
            ?.map((item: any) => item.warehouse)
            .filter(Boolean)
            .map((warehouse: any) => ({
                id: Number(warehouse.id),
                name: warehouse.name,
                code: warehouse.code,
            })) ?? [];

    const all = [...props.warehouses, ...mapped];
    const seen = new Set<number>();

    return all.filter((warehouse) => {
        if (!warehouse?.id || seen.has(Number(warehouse.id))) {
            return false;
        }

        seen.add(Number(warehouse.id));
        return true;
    });
});

const canLoad = computed(() =>
    Boolean(props.productId && props.variant?.id && selectedWarehouseId.value),
);

const selectedWarehouseLabel = computed(() => {
    const warehouse = variantWarehouseOptions.value.find(
        (item) => Number(item.id) === Number(selectedWarehouseId.value),
    );

    return warehouse?.name ?? 'Almacen';
});

const currentSalePrice = computed(() =>
    Number(
        props.variant?.pricing?.base_price ?? props.variant?.base_price ?? 0,
    ),
);

const resolveInitialWarehouse = (): number | null => {
    const options = variantWarehouseOptions.value;
    if (!options.length) {
        return null;
    }

    if (
        props.initialWarehouseId &&
        options.some(
            (item) => Number(item.id) === Number(props.initialWarehouseId),
        )
    ) {
        return Number(props.initialWarehouseId);
    }

    return Number(options[0].id);
};

const loadHistory = async () => {
    if (!canLoad.value) {
        history.value = null;
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        const response = await productsApi.getVariantFifoHistory(
            props.productId,
            Number(props.variant.id),
            {
                warehouse_id: Number(selectedWarehouseId.value),
                per_page: 50,
            },
        );
        history.value = response.data;
        expandedSaleIds.value = new Set();
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'Error al cargar historial de stock';
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (value?: number | null): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value ?? 0));
};

const formatDate = (value?: string | null): string => {
    if (!value) {
        return '-';
    }

    return new Intl.DateTimeFormat('es-PA', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
};

const toDateTimeLocal = (value?: string | null): string => {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000,
    );
    return localDate.toISOString().slice(0, 16);
};

const sourceLabel = (type?: string | null, id?: number | null): string => {
    const labels: Record<string, string> = {
        purchase_order: 'OC',
        manual_inbound: 'Entrada manual',
        opening_balance: 'Saldo inicial',
        transfer: 'Transferencia',
        sale: 'Venta',
        adjustment: 'Ajuste',
        waste: 'Merma',
    };

    const label = type ? (labels[type] ?? type) : 'Movimiento';
    return id ? `${label} #${id}` : label;
};

const purchaseUnitCost = (movement: VariantFifoMovement): number => {
    const lot = movement.fifo_lots?.[0];
    return Number(lot?.unit_cost_base ?? 0);
};

const purchaseAvailableStock = (movement: VariantFifoMovement): number => {
    const lot = movement.fifo_lots?.[0];
    return Number(lot?.quantity_available ?? 0);
};

const editableLotForMovement = (
    movement: VariantFifoMovement,
): (MovementSourceLot & { id: number }) | null => {
    const lot = movement.fifo_lots?.[0];

    if (!lot?.lot_id) {
        return null;
    }

    return {
        ...lot,
        id: lot.lot_id,
    };
};

const startEditingLot = (
    lot: InventoryFifoLot | (MovementSourceLot & { id: number }),
) => {
    editingLotId.value = Number(lot.id);
    lotEditForm.value = {
        received_at: toDateTimeLocal(lot.received_at),
        quantity_available: Number(lot.quantity_available ?? 0),
        unit_cost_base: Number(lot.unit_cost_base ?? 0),
        tax_per_unit: Number(lot.tax_per_unit ?? 0),
        misc_per_unit: Number(lot.misc_per_unit ?? 0),
        sale_price: currentSalePrice.value,
    };
};

const cancelEditingLot = () => {
    editingLotId.value = null;
};

const saveLot = async (lotId: number) => {
    savingLotId.value = lotId;
    error.value = null;

    try {
        await productsApi.updateInventoryLot(lotId, {
            received_at: lotEditForm.value.received_at,
            quantity_available: Number(lotEditForm.value.quantity_available),
            unit_cost_base: Number(lotEditForm.value.unit_cost_base),
            tax_per_unit: Number(lotEditForm.value.tax_per_unit),
            misc_per_unit: Number(lotEditForm.value.misc_per_unit),
            sale_price: Number(lotEditForm.value.sale_price),
        });
        editingLotId.value = null;
        await loadHistory();
        emit('updated');
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'Error al actualizar el lote.';
    } finally {
        savingLotId.value = null;
    }
};

const startEditingMovementLot = (movement: VariantFifoMovement) => {
    const lot = editableLotForMovement(movement);

    if (lot) {
        startEditingLot(lot);
    }
};

const saveMovementLot = async (movement: VariantFifoMovement) => {
    const lot = editableLotForMovement(movement);

    if (lot) {
        await saveLot(lot.id);
    }
};

const purchaseLandedCost = (movement: VariantFifoMovement): number => {
    const lot = movement.fifo_lots?.[0];
    return Number(lot?.landed_unit_cost ?? 0);
};

const saleUnitCost = (movement: VariantFifoMovement): number => {
    const allocations = movement.fifo_allocations ?? [];
    const quantity = allocations.reduce(
        (sum, item) => sum + Number(item.quantity),
        0,
    );
    const total = allocations.reduce(
        (sum, item) => sum + Number(item.total_cost),
        0,
    );

    return quantity > 0 ? total / quantity : 0;
};

const saleTotalCost = (movement: VariantFifoMovement): number => {
    return (movement.fifo_allocations ?? []).reduce(
        (sum, item) => sum + Number(item.total_cost),
        0,
    );
};

const toggleSale = (movementId: number) => {
    const next = new Set(expandedSaleIds.value);
    if (next.has(movementId)) {
        next.delete(movementId);
    } else {
        next.add(movementId);
    }
    expandedSaleIds.value = next;
};

watch(
    () => [
        props.productId,
        props.variant?.id,
        props.initialWarehouseId,
        variantWarehouseOptions.value.length,
    ],
    () => {
        selectedWarehouseId.value = resolveInitialWarehouse();
    },
    { immediate: true },
);

watch(selectedWarehouseId, () => {
    loadHistory();
});

onMounted(() => {
    if (!selectedWarehouseId.value) {
        selectedWarehouseId.value = resolveInitialWarehouse();
    } else {
        loadHistory();
    }
});
</script>

<template>
    <section
        class="rounded-md border border-gray-200 bg-white dark:border-border dark:bg-card"
    >
        <div
            class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-border"
        >
            <div class="flex items-center gap-2">
                <History class="h-4 w-4 text-gray-500" />
                <div>
                    <h3
                        class="text-sm font-semibold text-gray-900 dark:text-white"
                    >
                        Historial de stock
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ variant?.brand?.name || variant?.sku || 'Variante' }}
                        ·
                        {{ selectedWarehouseLabel }}
                    </p>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <select
                    v-model.number="selectedWarehouseId"
                    class="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                >
                    <option
                        v-for="warehouse in variantWarehouseOptions"
                        :key="warehouse.id"
                        :value="warehouse.id"
                    >
                        {{ warehouse.name }}
                    </option>
                </select>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    :disabled="loading || !canLoad"
                    @click="loadHistory"
                >
                    <RefreshCw
                        class="mr-1 h-4 w-4"
                        :class="{ 'animate-spin': loading }"
                    />
                    Reintentar
                </Button>
            </div>
        </div>

        <div v-if="!variant?.id" class="px-4 py-6 text-sm text-gray-500">
            Guarda la variante para consultar su historial de stock.
        </div>

        <div v-else-if="error" class="px-4 py-4">
            <div
                class="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
                <span>{{ error }}</span>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    @click="loadHistory"
                >
                    Reintentar
                </Button>
            </div>
        </div>

        <div v-else>
            <div
                class="grid grid-cols-2 gap-px bg-gray-200 md:grid-cols-6 dark:bg-border"
            >
                <div class="bg-gray-50 px-4 py-3 dark:bg-muted/40">
                    <p
                        class="text-[11px] font-semibold text-gray-500 uppercase"
                    >
                        Stock
                    </p>
                    <p
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        {{ history?.summary.stock_available ?? '-' }}
                    </p>
                </div>
                <div class="bg-gray-50 px-4 py-3 dark:bg-muted/40">
                    <p
                        class="text-[11px] font-semibold text-gray-500 uppercase"
                    >
                        Costo actual
                    </p>
                    <p
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        {{ formatCurrency(history?.summary.fifo_cost_current) }}
                    </p>
                </div>
                <div class="bg-gray-50 px-4 py-3 dark:bg-muted/40">
                    <p
                        class="text-[11px] font-semibold text-gray-500 uppercase"
                    >
                        Valor disp.
                    </p>
                    <p
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        {{ formatCurrency(history?.summary.total_lot_value) }}
                    </p>
                </div>
                <div class="bg-gray-50 px-4 py-3 dark:bg-muted/40">
                    <p
                        class="text-[11px] font-semibold text-gray-500 uppercase"
                    >
                        Lotes
                    </p>
                    <p
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        {{ history?.summary.open_lots_count ?? '-' }}
                    </p>
                </div>
                <div class="bg-gray-50 px-4 py-3 dark:bg-muted/40">
                    <p
                        class="text-[11px] font-semibold text-gray-500 uppercase"
                    >
                        Ultima compra
                    </p>
                    <p
                        class="text-sm font-medium text-gray-900 dark:text-white"
                    >
                        {{ formatDate(history?.summary.last_received_at) }}
                    </p>
                </div>
                <div class="bg-gray-50 px-4 py-3 dark:bg-muted/40">
                    <p
                        class="text-[11px] font-semibold text-gray-500 uppercase"
                    >
                        Ultima venta
                    </p>
                    <p
                        class="text-sm font-medium text-gray-900 dark:text-white"
                    >
                        {{ formatDate(history?.summary.last_sold_at) }}
                    </p>
                </div>
            </div>

            <div
                class="flex gap-1 border-b border-gray-200 px-4 pt-3 dark:border-border"
            >
                <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    type="button"
                    class="-mb-px border-b-2 px-3 py-2 text-sm font-medium"
                    :class="
                        activeTab === tab.key
                            ? 'border-blue-600 text-blue-600 dark:border-primary dark:text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                    "
                    @click="activeTab = tab.key"
                >
                    {{ tab.label }}
                </button>
            </div>

            <div
                v-if="loading"
                class="px-4 py-8 text-center text-sm text-gray-500"
            >
                Cargando historial de stock...
            </div>

            <div v-else class="overflow-x-auto">
                <table
                    v-if="activeTab === 'lots'"
                    class="w-full text-left text-xs text-gray-600 dark:text-gray-300"
                >
                    <thead
                        class="bg-gray-50 text-[11px] text-gray-500 uppercase dark:bg-muted"
                    >
                        <tr>
                            <th class="px-4 py-2">Fecha</th>
                            <th class="px-4 py-2">Origen</th>
                            <th class="px-4 py-2">Lote</th>
                            <th class="px-4 py-2 text-right">Inicial</th>
                            <th class="px-4 py-2 text-right">Disponible</th>
                            <th class="px-4 py-2 text-right">Precio venta</th>
                            <th class="px-4 py-2 text-right">Costo</th>
                            <th class="px-4 py-2 text-right">ITBM</th>
                            <th class="px-4 py-2 text-right">Misc</th>
                            <th class="px-4 py-2 text-right">Final</th>
                            <th class="px-4 py-2 text-right">Valor</th>
                            <th class="px-4 py-2 text-right">Accion</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="lot in history?.lots ?? []"
                            :key="lot.id"
                            class="border-t border-gray-100 dark:border-border"
                        >
                            <td class="px-4 py-2">
                                <input
                                    v-if="editingLotId === lot.id"
                                    v-model="lotEditForm.received_at"
                                    type="datetime-local"
                                    class="h-8 w-40 rounded-md border border-gray-300 px-2 text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{
                                    formatDate(lot.received_at)
                                }}</span>
                            </td>
                            <td class="px-4 py-2">
                                {{
                                    sourceLabel(lot.source_type, lot.source_id)
                                }}
                            </td>
                            <td class="px-4 py-2 font-mono">
                                {{ lot.batch_number || `#${lot.id}` }}
                            </td>
                            <td class="px-4 py-2 text-right">
                                {{ lot.received_quantity }}
                            </td>
                            <td class="px-4 py-2 text-right font-semibold">
                                <input
                                    v-if="editingLotId === lot.id"
                                    v-model.number="
                                        lotEditForm.quantity_available
                                    "
                                    type="number"
                                    min="0"
                                    step="1"
                                    class="h-8 w-20 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{ lot.quantity_available }}</span>
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="editingLotId === lot.id"
                                    v-model.number="lotEditForm.sale_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{
                                    formatCurrency(currentSalePrice)
                                }}</span>
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="editingLotId === lot.id"
                                    v-model.number="lotEditForm.unit_cost_base"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{
                                    formatCurrency(lot.unit_cost_base)
                                }}</span>
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="editingLotId === lot.id"
                                    v-model.number="lotEditForm.tax_per_unit"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{
                                    formatCurrency(lot.tax_per_unit)
                                }}</span>
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="editingLotId === lot.id"
                                    v-model.number="lotEditForm.misc_per_unit"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{
                                    formatCurrency(lot.misc_per_unit)
                                }}</span>
                            </td>
                            <td class="px-4 py-2 text-right font-semibold">
                                {{ formatCurrency(lot.landed_unit_cost) }}
                            </td>
                            <td class="px-4 py-2 text-right font-semibold">
                                {{ formatCurrency(lot.remaining_value) }}
                            </td>
                            <td class="px-4 py-2 text-right">
                                <div class="inline-flex items-center gap-1">
                                    <template v-if="editingLotId === lot.id">
                                        <button
                                            type="button"
                                            class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                            :disabled="savingLotId === lot.id"
                                            title="Guardar"
                                            @click="saveLot(lot.id)"
                                        >
                                            <Check class="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted"
                                            title="Cancelar"
                                            @click="cancelEditingLot"
                                        >
                                            Cancelar
                                        </button>
                                    </template>
                                    <button
                                        v-else
                                        type="button"
                                        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 dark:text-primary dark:hover:bg-primary/10"
                                        title="Editar lote"
                                        @click="startEditingLot(lot)"
                                    >
                                        <Pencil class="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!history?.lots.length">
                            <td
                                colspan="12"
                                class="px-4 py-6 text-center text-gray-500"
                            >
                                No hay lotes disponibles para esta variante.
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table
                    v-else-if="activeTab === 'purchases'"
                    class="w-full text-left text-xs text-gray-600 dark:text-gray-300"
                >
                    <thead
                        class="bg-gray-50 text-[11px] text-gray-500 uppercase dark:bg-muted"
                    >
                        <tr>
                            <th class="px-4 py-2">Fecha</th>
                            <th class="px-4 py-2">Referencia</th>
                            <th class="px-4 py-2">Proveedor</th>
                            <th class="px-4 py-2 text-right">Recibido</th>
                            <th class="px-4 py-2 text-right">Stock disp.</th>
                            <th class="px-4 py-2 text-right">Costo unit.</th>
                            <th class="px-4 py-2 text-right">ITBM</th>
                            <th class="px-4 py-2 text-right">Misc</th>
                            <th class="px-4 py-2 text-right">Costo final</th>
                            <th class="px-4 py-2 text-right">Precio venta</th>
                            <th class="px-4 py-2">Almacen</th>
                            <th class="px-4 py-2 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="movement in history?.purchase_movements ??
                            []"
                            :key="movement.id"
                            class="border-t border-gray-100 dark:border-border"
                        >
                            <td class="px-4 py-2">
                                <input
                                    v-if="
                                        editingLotId ===
                                        editableLotForMovement(movement)?.id
                                    "
                                    v-model="lotEditForm.received_at"
                                    type="datetime-local"
                                    class="h-8 w-40 rounded-md border border-gray-300 px-2 text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>
                                    {{
                                        formatDate(
                                            editableLotForMovement(movement)
                                                ?.received_at ??
                                                movement.created_at,
                                        )
                                    }}
                                </span>
                            </td>
                            <td class="px-4 py-2">
                                {{
                                    sourceLabel(
                                        movement.reference_type,
                                        movement.reference_id,
                                    )
                                }}
                            </td>
                            <td class="px-4 py-2">
                                {{ movement.supplier?.name || '-' }}
                            </td>
                            <td class="px-4 py-2 text-right">
                                {{ movement.quantity }}
                            </td>
                            <td class="px-4 py-2 text-right font-semibold">
                                <input
                                    v-if="
                                        editingLotId ===
                                        editableLotForMovement(movement)?.id
                                    "
                                    v-model.number="
                                        lotEditForm.quantity_available
                                    "
                                    type="number"
                                    min="0"
                                    step="1"
                                    class="h-8 w-20 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{
                                    purchaseAvailableStock(movement)
                                }}</span>
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="
                                        editingLotId ===
                                        editableLotForMovement(movement)?.id
                                    "
                                    v-model.number="lotEditForm.unit_cost_base"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>
                                    {{
                                        formatCurrency(
                                            purchaseUnitCost(movement),
                                        )
                                    }}
                                </span>
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="
                                        editingLotId ===
                                        editableLotForMovement(movement)?.id
                                    "
                                    v-model.number="lotEditForm.tax_per_unit"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>
                                    {{
                                        formatCurrency(
                                            editableLotForMovement(movement)
                                                ?.tax_per_unit ?? 0,
                                        )
                                    }}
                                </span>
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="
                                        editingLotId ===
                                        editableLotForMovement(movement)?.id
                                    "
                                    v-model.number="lotEditForm.misc_per_unit"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>
                                    {{
                                        formatCurrency(
                                            editableLotForMovement(movement)
                                                ?.misc_per_unit ?? 0,
                                        )
                                    }}
                                </span>
                            </td>
                            <td class="px-4 py-2 text-right font-semibold">
                                {{
                                    formatCurrency(purchaseLandedCost(movement))
                                }}
                            </td>
                            <td class="px-4 py-2 text-right">
                                <input
                                    v-if="
                                        editingLotId ===
                                        editableLotForMovement(movement)?.id
                                    "
                                    v-model.number="lotEditForm.sale_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="h-8 w-24 rounded-md border border-gray-300 px-2 text-right text-xs dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span v-else>{{
                                    formatCurrency(currentSalePrice)
                                }}</span>
                            </td>
                            <td class="px-4 py-2">
                                {{ movement.warehouse?.name || '-' }}
                            </td>
                            <td class="px-4 py-2 text-right">
                                <div
                                    v-if="editableLotForMovement(movement)"
                                    class="inline-flex items-center gap-1"
                                >
                                    <template
                                        v-if="
                                            editingLotId ===
                                            editableLotForMovement(movement)?.id
                                        "
                                    >
                                        <button
                                            type="button"
                                            class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                            :disabled="
                                                savingLotId ===
                                                editableLotForMovement(movement)
                                                    ?.id
                                            "
                                            title="Guardar"
                                            @click="saveMovementLot(movement)"
                                        >
                                            Guardar
                                        </button>
                                        <button
                                            type="button"
                                            class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted"
                                            title="Cancelar"
                                            @click="cancelEditingLot"
                                        >
                                            Cancelar
                                        </button>
                                    </template>
                                    <button
                                        v-else
                                        type="button"
                                        class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-primary dark:hover:bg-primary/10"
                                        title="Editar compra"
                                        @click="
                                            startEditingMovementLot(movement)
                                        "
                                    >
                                        Editar
                                    </button>
                                </div>
                                <span
                                    v-else
                                    class="text-[11px] font-medium text-amber-700 dark:text-amber-300"
                                >
                                    Sin lote editable
                                </span>
                            </td>
                        </tr>
                        <tr v-if="!history?.purchase_movements.length">
                            <td
                                colspan="12"
                                class="px-4 py-6 text-center text-gray-500"
                            >
                                No hay compras registradas para esta variante.
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table
                    v-else
                    class="w-full text-left text-xs text-gray-600 dark:text-gray-300"
                >
                    <thead
                        class="bg-gray-50 text-[11px] text-gray-500 uppercase dark:bg-muted"
                    >
                        <tr>
                            <th class="px-4 py-2">Fecha</th>
                            <th class="px-4 py-2">Referencia</th>
                            <th class="px-4 py-2 text-right">Cantidad</th>
                            <th class="px-4 py-2 text-right">Costo actual</th>
                            <th class="px-4 py-2 text-right">Total costo</th>
                            <th class="px-4 py-2">Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template
                            v-for="movement in history?.sale_movements ?? []"
                            :key="movement.id"
                        >
                            <tr
                                class="border-t border-gray-100 dark:border-border"
                            >
                                <td class="px-4 py-2">
                                    {{ formatDate(movement.created_at) }}
                                </td>
                                <td class="px-4 py-2">
                                    {{
                                        sourceLabel(
                                            movement.reference_type,
                                            movement.reference_id,
                                        )
                                    }}
                                </td>
                                <td class="px-4 py-2 text-right">
                                    {{ movement.quantity }}
                                </td>
                                <td class="px-4 py-2 text-right">
                                    {{ formatCurrency(saleUnitCost(movement)) }}
                                </td>
                                <td class="px-4 py-2 text-right font-semibold">
                                    {{
                                        formatCurrency(saleTotalCost(movement))
                                    }}
                                </td>
                                <td class="px-4 py-2">
                                    <button
                                        type="button"
                                        class="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-primary"
                                        @click="toggleSale(movement.id)"
                                    >
                                        Lotes
                                        <ChevronDown
                                            class="h-3.5 w-3.5 transition"
                                            :class="{
                                                'rotate-180':
                                                    expandedSaleIds.has(
                                                        movement.id,
                                                    ),
                                            }"
                                        />
                                    </button>
                                </td>
                            </tr>
                            <tr
                                v-if="expandedSaleIds.has(movement.id)"
                                class="bg-gray-50 dark:bg-muted/30"
                            >
                                <td colspan="6" class="px-4 py-3">
                                    <div class="grid gap-2 md:grid-cols-2">
                                        <div
                                            v-for="allocation in movement.fifo_allocations ??
                                            []"
                                            :key="`${movement.id}-${allocation.lot_id}`"
                                            class="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-border dark:bg-card"
                                        >
                                            <div
                                                class="flex items-center justify-between gap-3 text-xs"
                                            >
                                                <span class="font-mono">
                                                    Lote #{{
                                                        allocation.lot_id
                                                    }}
                                                </span>
                                                <span class="font-semibold">
                                                    {{ allocation.quantity }}
                                                    und.
                                                </span>
                                            </div>
                                            <div
                                                class="mt-1 flex items-center justify-between gap-3 text-[11px] text-gray-500"
                                            >
                                                <span>
                                                    {{
                                                        formatDate(
                                                            allocation.received_at,
                                                        )
                                                    }}
                                                </span>
                                                <span>
                                                    {{
                                                        formatCurrency(
                                                            allocation.unit_cost,
                                                        )
                                                    }}
                                                    /
                                                    {{
                                                        formatCurrency(
                                                            allocation.total_cost,
                                                        )
                                                    }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </template>
                        <tr v-if="!history?.sale_movements.length">
                            <td
                                colspan="6"
                                class="px-4 py-6 text-center text-gray-500"
                            >
                                No hay ventas registradas para esta variante.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>
</template>
