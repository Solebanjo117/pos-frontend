<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import {
    ArrowLeft,
    ArrowRightLeft,
    Boxes,
    CalendarClock,
    ClipboardList,
    Hash,
    PackageOpen,
    ReceiptText,
    User,
    Warehouse,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { useInventoryMovements } from '@/composables/useInventoryMovements';
import { type InventoryMovement } from '@/types/inventory-movement';

const props = defineProps<{
    id: string;
}>();

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Movimientos', href: '/inventory-movements' },
    { title: 'Detalle', href: `/inventory-movements/${props.id}` },
];

const {
    currentMovement,
    fetchMovement,
    fetchRelatedMovements,
    loading,
    error,
} = useInventoryMovements();

const relatedMovements = ref<InventoryMovement[]>([]);
const loadingRelated = ref(false);

const fifoLots = computed(() => currentMovement.value?.fifo_lots ?? []);
const fifoAllocations = computed(
    () => currentMovement.value?.fifo_allocations ?? [],
);
const hasFifoTrace = computed(
    () => fifoLots.value.length > 0 || fifoAllocations.value.length > 0,
);
const movementReference = computed(() =>
    referenceMeta(
        currentMovement.value?.reference_type,
        currentMovement.value?.reference_id,
    ),
);

onMounted(async () => {
    await fetchMovement(Number(props.id));

    if (currentMovement.value) {
        loadingRelated.value = true;
        relatedMovements.value = await fetchRelatedMovements(
            currentMovement.value.id,
        );
        loadingRelated.value = false;
    }
});

function movementTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        in: 'Entrada',
        out: 'Salida',
        transfer: 'Transferencia',
    };

    return labels[type] ?? type;
}

function movementTypeClass(type: string): string {
    const classes: Record<string, string> = {
        in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        out: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
        transfer:
            'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    };

    return (
        classes[type] ??
        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    );
}

function sourceLabel(type?: string | null): string {
    const labels: Record<string, string> = {
        manual_inbound: 'Entrada manual',
        manual_adjustment: 'Ajuste manual',
        opening_balance: 'Apertura',
        purchase_order: 'Orden de compra',
        purchase_order_cancelled: 'Cancelacion OC',
        sale: 'Venta',
        sales_return: 'Devolucion venta',
        supply_list: 'Lista de abastecimiento',
        transfer: 'Transferencia',
        waste: 'Merma',
        adjustment: 'Ajuste',
        return: 'Devolucion',
    };

    return type ? (labels[type] ?? type) : '-';
}

function referenceMeta(type?: string | null, id?: number | null) {
    const label = sourceLabel(type);

    if (!type || !id) {
        return { label, value: '-', href: null };
    }

    const routes: Record<string, string> = {
        purchase_order: `/purchase-orders/${id}`,
        purchase: `/purchase-orders/${id}`,
        sale: `/sales-orders/${id}`,
        sales_order: `/sales-orders/${id}`,
        sales_return: `/returns/${id}`,
        transfer: `/inventory-transfers/${id}`,
    };

    return {
        label,
        value: `#${id}`,
        href: routes[type] ?? null,
    };
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

function formatNumber(value?: number | null): string {
    return new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
}

function formatMoney(value?: number | null): string {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value ?? 0));
}

function lotValue(lot: NonNullable<InventoryMovement['fifo_lots']>[number]) {
    return (
        Number(lot.quantity_available ?? 0) * Number(lot.landed_unit_cost ?? 0)
    );
}

function goBack(): void {
    router.visit('/inventory');
}

function viewProduct(id?: number): void {
    if (id) {
        router.visit(`/products/${id}`);
    }
}

function openReference(): void {
    if (movementReference.value.href) {
        router.visit(movementReference.value.href);
    }
}
</script>

<template>
    <Head title="Detalle de movimiento" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <div
                v-if="loading"
                class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-border dark:bg-card dark:text-gray-300"
            >
                Cargando movimiento...
            </div>

            <div
                v-else-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
                {{ error }}
            </div>

            <template v-else-if="currentMovement">
                <div
                    class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:flex-row lg:items-start lg:justify-between dark:border-border dark:bg-card"
                >
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1
                                class="text-xl font-semibold text-gray-950 dark:text-white"
                            >
                                Movimiento #{{ currentMovement.id }}
                            </h1>
                            <span
                                :class="
                                    movementTypeClass(
                                        currentMovement.movement_type,
                                    )
                                "
                                class="rounded-full px-2.5 py-1 text-xs font-semibold"
                            >
                                {{
                                    movementTypeLabel(
                                        currentMovement.movement_type,
                                    )
                                }}
                            </span>
                        </div>
                        <button
                            type="button"
                            class="mt-2 text-left text-sm font-medium text-blue-600 hover:underline dark:text-primary"
                            @click="viewProduct(currentMovement.product?.id)"
                        >
                            {{ currentMovement.product?.name || 'Producto' }}
                        </button>
                        <div
                            class="mt-1 flex flex-wrap gap-3 text-xs text-gray-500"
                        >
                            <span class="font-mono">
                                SKU:
                                {{
                                    currentMovement.variant?.sku ||
                                    currentMovement.product?.sku ||
                                    '-'
                                }}
                            </span>
                            <span>{{
                                formatDate(currentMovement.created_at)
                            }}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                        @click="goBack"
                    >
                        <ArrowLeft class="h-4 w-4" />
                        Volver a inventario
                    </button>
                </div>

                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                        >
                            <Boxes class="h-4 w-4" />
                            Cantidad
                        </div>
                        <p
                            class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white"
                        >
                            {{ formatNumber(currentMovement.quantity) }}
                        </p>
                    </div>

                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                        >
                            <Warehouse class="h-4 w-4" />
                            Almacen origen
                        </div>
                        <p
                            class="mt-2 truncate text-sm font-semibold text-gray-950 dark:text-white"
                        >
                            {{ currentMovement.warehouse?.name || '-' }}
                        </p>
                        <p class="mt-1 font-mono text-xs text-gray-500">
                            {{ currentMovement.warehouse?.code || '-' }}
                        </p>
                    </div>

                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                        >
                            <ArrowRightLeft class="h-4 w-4" />
                            Almacen destino
                        </div>
                        <p
                            class="mt-2 truncate text-sm font-semibold text-gray-950 dark:text-white"
                        >
                            {{
                                currentMovement.destination_warehouse?.name ||
                                '-'
                            }}
                        </p>
                        <p class="mt-1 font-mono text-xs text-gray-500">
                            {{
                                currentMovement.destination_warehouse?.code ||
                                '-'
                            }}
                        </p>
                    </div>

                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                        >
                            <ReceiptText class="h-4 w-4" />
                            Referencia
                        </div>
                        <button
                            v-if="movementReference.href"
                            type="button"
                            class="mt-2 text-left text-sm font-semibold text-blue-600 hover:underline dark:text-primary"
                            @click="openReference"
                        >
                            {{ movementReference.label }}
                            {{ movementReference.value }}
                        </button>
                        <p
                            v-else
                            class="mt-2 text-sm font-semibold text-gray-950 dark:text-white"
                        >
                            {{ movementReference.label }}
                            {{ movementReference.value }}
                        </p>
                    </div>

                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase"
                        >
                            <User class="h-4 w-4" />
                            Usuario
                        </div>
                        <p
                            class="mt-2 truncate text-sm font-semibold text-gray-950 dark:text-white"
                        >
                            {{ currentMovement.user?.name || '-' }}
                        </p>
                    </div>
                </div>

                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 px-4 py-3 dark:border-border"
                    >
                        <h2
                            class="text-sm font-semibold text-gray-950 dark:text-white"
                        >
                            Producto y movimiento
                        </h2>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full text-left text-sm">
                            <thead
                                class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                            >
                                <tr>
                                    <th class="px-4 py-3">Producto</th>
                                    <th class="px-4 py-3">Variante</th>
                                    <th class="px-4 py-3 text-right">
                                        Cantidad
                                    </th>
                                    <th class="px-4 py-3">Motivo</th>
                                    <th class="px-4 py-3">Lote legacy</th>
                                    <th class="px-4 py-3">Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="px-4 py-3">
                                        <button
                                            type="button"
                                            class="text-left font-medium text-blue-600 hover:underline dark:text-primary"
                                            @click="
                                                viewProduct(
                                                    currentMovement.product?.id,
                                                )
                                            "
                                        >
                                            {{
                                                currentMovement.product?.name ||
                                                '-'
                                            }}
                                        </button>
                                        <div
                                            class="font-mono text-xs text-gray-500"
                                        >
                                            {{
                                                currentMovement.product?.sku ||
                                                '-'
                                            }}
                                        </div>
                                    </td>
                                    <td class="px-4 py-3">
                                        <div
                                            class="font-medium text-gray-950 dark:text-white"
                                        >
                                            {{
                                                currentMovement.variant?.sku ||
                                                '-'
                                            }}
                                        </div>
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{
                                            formatNumber(
                                                currentMovement.quantity,
                                            )
                                        }}
                                    </td>
                                    <td class="px-4 py-3">
                                        {{
                                            sourceLabel(currentMovement.reason)
                                        }}
                                    </td>
                                    <td class="px-4 py-3 font-mono text-xs">
                                        {{
                                            currentMovement.product_batch
                                                ?.batch_number || '-'
                                        }}
                                    </td>
                                    <td
                                        class="max-w-md px-4 py-3 text-gray-600 dark:text-gray-300"
                                    >
                                        {{ currentMovement.notes || '-' }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-border"
                    >
                        <div>
                            <h2
                                class="text-sm font-semibold text-gray-950 dark:text-white"
                            >
                                Trazabilidad FIFO
                            </h2>
                            <p class="text-xs text-gray-500">
                                Lotes creados por entradas o lotes consumidos
                                por salidas.
                            </p>
                        </div>
                        <span
                            class="inline-flex items-center gap-2 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-muted dark:text-gray-200"
                        >
                            <PackageOpen class="h-3.5 w-3.5" />
                            {{ fifoLots.length }} lotes &middot;
                            {{ fifoAllocations.length }} asignaciones
                        </span>
                    </div>

                    <div v-if="fifoLots.length" class="overflow-x-auto">
                        <table class="min-w-full text-left text-sm">
                            <thead
                                class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                            >
                                <tr>
                                    <th class="px-4 py-3">Fecha</th>
                                    <th class="px-4 py-3">Origen</th>
                                    <th class="px-4 py-3">Lote</th>
                                    <th class="px-4 py-3 text-right">
                                        Recibido
                                    </th>
                                    <th class="px-4 py-3 text-right">
                                        Disponible
                                    </th>
                                    <th class="px-4 py-3 text-right">
                                        Costo base
                                    </th>
                                    <th class="px-4 py-3 text-right">ITBM</th>
                                    <th class="px-4 py-3 text-right">Misc</th>
                                    <th class="px-4 py-3 text-right">Final</th>
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
                                        {{ sourceLabel(lot.source_type) }}
                                        <span
                                            v-if="lot.source_id"
                                            class="font-mono text-xs text-gray-500"
                                        >
                                            #{{ lot.source_id }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 font-mono text-xs">
                                        {{
                                            lot.batch_number || `LOT-${lot.id}`
                                        }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        {{
                                            formatNumber(lot.received_quantity)
                                        }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{
                                            formatNumber(lot.quantity_available)
                                        }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        {{ formatMoney(lot.unit_cost_base) }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        {{ formatMoney(lot.tax_per_unit) }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        {{ formatMoney(lot.misc_per_unit) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{ formatMoney(lot.landed_unit_cost) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{ formatMoney(lotValue(lot)) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div v-if="fifoAllocations.length" class="overflow-x-auto">
                        <table class="min-w-full text-left text-sm">
                            <thead
                                class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                            >
                                <tr>
                                    <th class="px-4 py-3">Lote</th>
                                    <th class="px-4 py-3">Origen</th>
                                    <th class="px-4 py-3">Fecha entrada</th>
                                    <th class="px-4 py-3 text-right">
                                        Consumido
                                    </th>
                                    <th class="px-4 py-3 text-right">
                                        Costo unit.
                                    </th>
                                    <th class="px-4 py-3 text-right">
                                        Costo total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="allocation in fifoAllocations"
                                    :key="`${allocation.lot_id}-${allocation.quantity}`"
                                    class="border-t border-gray-100 dark:border-border"
                                >
                                    <td class="px-4 py-3 font-mono text-xs">
                                        LOT-{{ allocation.lot_id }}
                                    </td>
                                    <td class="px-4 py-3">
                                        {{
                                            sourceLabel(allocation.source_type)
                                        }}
                                        <span
                                            v-if="allocation.source_id"
                                            class="font-mono text-xs text-gray-500"
                                        >
                                            #{{ allocation.source_id }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-xs">
                                        {{ formatDate(allocation.received_at) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{ formatNumber(allocation.quantity) }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        {{ formatMoney(allocation.unit_cost) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-semibold"
                                    >
                                        {{ formatMoney(allocation.total_cost) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div
                        v-if="!hasFifoTrace"
                        class="px-4 py-10 text-center text-sm text-gray-500"
                    >
                        Este movimiento no tiene trazabilidad FIFO asociada.
                    </div>
                </div>

                <div
                    class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
                >
                    <div
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-200 px-4 py-3 dark:border-border"
                        >
                            <h2
                                class="text-sm font-semibold text-gray-950 dark:text-white"
                            >
                                Movimientos relacionados
                            </h2>
                        </div>
                        <div
                            v-if="loadingRelated"
                            class="px-4 py-6 text-sm text-gray-500"
                        >
                            Cargando relacionados...
                        </div>
                        <div v-else class="overflow-x-auto">
                            <table class="min-w-full text-left text-sm">
                                <thead
                                    class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                                >
                                    <tr>
                                        <th class="px-4 py-3">Movimiento</th>
                                        <th class="px-4 py-3">Producto</th>
                                        <th class="px-4 py-3 text-right">
                                            Cantidad
                                        </th>
                                        <th class="px-4 py-3">Almacen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="movement in relatedMovements"
                                        :key="movement.id"
                                        class="border-t border-gray-100 dark:border-border"
                                    >
                                        <td class="px-4 py-3">
                                            <button
                                                type="button"
                                                class="font-medium text-blue-600 hover:underline dark:text-primary"
                                                @click="
                                                    router.visit(
                                                        `/inventory-movements/${movement.id}`,
                                                    )
                                                "
                                            >
                                                #{{ movement.id }}
                                            </button>
                                        </td>
                                        <td class="px-4 py-3">
                                            {{ movement.product?.name || '-' }}
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
                                            class="px-4 py-3 text-right font-semibold"
                                        >
                                            {{
                                                formatNumber(movement.quantity)
                                            }}
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                movement.warehouse?.name || '-'
                                            }}
                                        </td>
                                    </tr>
                                    <tr v-if="relatedMovements.length === 0">
                                        <td
                                            colspan="4"
                                            class="px-4 py-8 text-center text-sm text-gray-500"
                                        >
                                            No hay movimientos relacionados.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <h2
                            class="text-sm font-semibold text-gray-950 dark:text-white"
                        >
                            Referencia
                        </h2>
                        <dl class="mt-4 space-y-3 text-sm">
                            <div
                                class="flex items-center justify-between gap-4"
                            >
                                <dt
                                    class="flex items-center gap-2 text-gray-500"
                                >
                                    <ClipboardList class="h-4 w-4" />
                                    Tipo
                                </dt>
                                <dd
                                    class="font-medium text-gray-950 dark:text-white"
                                >
                                    {{ movementReference.label }}
                                </dd>
                            </div>
                            <div
                                class="flex items-center justify-between gap-4"
                            >
                                <dt
                                    class="flex items-center gap-2 text-gray-500"
                                >
                                    <Hash class="h-4 w-4" />
                                    ID
                                </dt>
                                <dd
                                    class="font-mono text-gray-950 dark:text-white"
                                >
                                    {{ movementReference.value }}
                                </dd>
                            </div>
                            <div
                                class="flex items-center justify-between gap-4"
                            >
                                <dt
                                    class="flex items-center gap-2 text-gray-500"
                                >
                                    <CalendarClock class="h-4 w-4" />
                                    Fecha
                                </dt>
                                <dd
                                    class="text-right text-gray-950 dark:text-white"
                                >
                                    {{ formatDate(currentMovement.created_at) }}
                                </dd>
                            </div>
                        </dl>
                        <button
                            v-if="movementReference.href"
                            type="button"
                            class="mt-4 inline-flex w-full items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                            @click="openReference"
                        >
                            Abrir referencia
                        </button>
                    </div>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
