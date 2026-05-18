<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardList,
    PackageSearch,
    Warehouse,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import AsyncProductCombobox from '@/components/AsyncProductCombobox.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import apiClient from '@/services/api/client';
import { usePosSettings } from '@/composables/usePosSettings';

interface Variant {
    id: number;
    sku: string;
    name?: string | null;
    brand?: {
        name?: string | null;
    } | null;
}

interface WarehouseOption {
    id: number;
    name: string;
}

interface WasteEntry {
    id: number;
    product_name: string;
    sku: string;
    brand: string;
    warehouse: string;
    quantity: number;
    reason: string;
    notes: string | null;
    user: string | null;
    date: string;
}

const selectedProductId = ref<number | null>(null);
const selectedProduct = ref<any>(null);
const selectedVariant = ref<Variant | null>(null);
const variants = ref<Variant[]>([]);
const warehouses = ref<WarehouseOption[]>([]);
const warehouseId = ref<number | null>(null);
const quantity = ref(1);
const reason = ref('');
const notes = ref('');
const submitting = ref(false);
const successMsg = ref('');
const errorMsg = ref('');
const availableStock = ref<number | null>(null);
const history = ref<WasteEntry[]>([]);
const historyLoading = ref(false);

const reasons = [
    'Danado',
    'Caducado',
    'Robo / Perdida',
    'Uso interno',
    'Error de inventario',
    'Otro',
];

const { currentWarehouseId, initWarehouse } = usePosSettings();

const warehouseOptions = computed<SelectOption[]>(() =>
    warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
);

const selectedWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === warehouseId.value),
);

const selectedReasonLabel = computed(() => reason.value || '-');

const quantityExceedsStock = computed(
    () =>
        availableStock.value !== null &&
        Number(quantity.value || 0) > availableStock.value,
);

const estimatedRemaining = computed(() => {
    if (availableStock.value === null) {
        return null;
    }

    return availableStock.value - Number(quantity.value || 0);
});

const canPreview = computed(
    () =>
        Boolean(selectedVariant.value && warehouseId.value) &&
        quantity.value > 0,
);

const canSubmit = computed(
    () =>
        Boolean(selectedVariant.value && warehouseId.value && reason.value) &&
        quantity.value >= 1 &&
        !quantityExceedsStock.value &&
        !submitting.value,
);

async function fetchWarehouses(): Promise<void> {
    const { data } = await apiClient.get('/warehouses');
    warehouses.value = data.data ?? [];
}

async function fetchHistory(): Promise<void> {
    historyLoading.value = true;

    try {
        const params: Record<string, number> = {};

        if (warehouseId.value) {
            params.warehouse_id = warehouseId.value;
        }

        const { data } = await apiClient.get('/inventory/waste', { params });
        history.value = data.data ?? [];
    } finally {
        historyLoading.value = false;
    }
}

async function onProductSelected(product: any): Promise<void> {
    selectedProduct.value = product;
    selectedVariant.value = null;
    availableStock.value = null;
    variants.value = [];

    if (!product) {
        return;
    }

    const { data } = await apiClient.get(`/products/${product.id}/variants`);
    variants.value = data.data ?? [];

    if (variants.value.length === 1) {
        selectedVariant.value = variants.value[0];
        await fetchStock();
    }
}

async function fetchStock(): Promise<void> {
    if (!selectedVariant.value || !warehouseId.value) {
        availableStock.value = null;
        return;
    }

    try {
        const { data } = await apiClient.get('/inventory', {
            params: {
                variant_id: selectedVariant.value.id,
                warehouse_id: warehouseId.value,
                per_page: 1,
            },
        });
        const row = (data.data ?? []).find(
            (inventoryRow: any) =>
                inventoryRow.variant_id === selectedVariant.value?.id &&
                inventoryRow.warehouse_id === warehouseId.value,
        );
        availableStock.value = Number(
            row?.stock_available ?? row?.quantity_available ?? 0,
        );
    } catch {
        availableStock.value = null;
    }
}

async function handleSubmit(): Promise<void> {
    successMsg.value = '';
    errorMsg.value = '';

    if (!canSubmit.value || !selectedVariant.value || !warehouseId.value) {
        errorMsg.value = 'Completa los datos requeridos antes de registrar.';
        return;
    }

    submitting.value = true;

    try {
        const { data } = await apiClient.post('/inventory/waste', {
            variant_id: selectedVariant.value.id,
            warehouse_id: warehouseId.value,
            quantity: quantity.value,
            reason: reason.value,
            notes: notes.value || null,
        });

        successMsg.value = `Merma registrada. Stock restante: ${data.remaining}`;
        resetForm();
        await fetchHistory();
    } catch (error: any) {
        errorMsg.value =
            error.response?.data?.message || 'Error al registrar la merma.';
    } finally {
        submitting.value = false;
    }
}

function resetForm(): void {
    selectedProductId.value = null;
    selectedProduct.value = null;
    selectedVariant.value = null;
    variants.value = [];
    quantity.value = 1;
    reason.value = '';
    notes.value = '';
    availableStock.value = null;
}

function variantLabel(variant?: Variant | null): string {
    if (!variant) {
        return '-';
    }

    const brand = variant.brand?.name;
    const name = variant.name;

    return [brand, name, variant.sku].filter(Boolean).join(' / ');
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-PA', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

onMounted(async () => {
    await Promise.all([fetchWarehouses(), initWarehouse()]);

    if (
        currentWarehouseId.value &&
        warehouses.value.some(
            (warehouse) => warehouse.id === currentWarehouseId.value,
        )
    ) {
        warehouseId.value = currentWarehouseId.value;
    } else {
        warehouseId.value = warehouses.value[0]?.id ?? null;
    }

    await fetchHistory();
});
</script>

<template>
    <Head title="Registro de mermas" />

    <AppLayout>
        <div class="space-y-5 p-4">
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
                <div>
                    <h1
                        class="text-2xl font-semibold text-gray-950 dark:text-white"
                    >
                        Registro de mermas
                    </h1>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Descuenta stock por dano, perdida, caducidad o ajuste
                        fisico.
                    </p>
                </div>
                <a
                    href="/inventory"
                    class="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-border dark:text-gray-100 dark:hover:bg-muted"
                >
                    Volver a inventario
                </a>
            </div>

            <div
                v-if="successMsg"
                class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
                <div class="flex items-center gap-2">
                    <CheckCircle2 class="h-4 w-4" />
                    {{ successMsg }}
                </div>
            </div>
            <div
                v-if="errorMsg"
                class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
            >
                <div class="flex items-center gap-2">
                    <AlertTriangle class="h-4 w-4" />
                    {{ errorMsg }}
                </div>
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
                <section
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 px-4 py-3 dark:border-border"
                    >
                        <h2
                            class="text-base font-semibold text-gray-950 dark:text-white"
                        >
                            Registrar merma
                        </h2>
                    </div>

                    <div class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                        <div class="lg:col-span-2">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Producto
                            </label>
                            <AsyncProductCombobox
                                v-model="selectedProductId"
                                placeholder="Buscar producto por nombre o SKU"
                                @select="onProductSelected"
                            />
                        </div>

                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Variante
                            </label>
                            <select
                                v-model="selectedVariant"
                                class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                @change="fetchStock"
                            >
                                <option :value="null" disabled>
                                    Selecciona variante
                                </option>
                                <option
                                    v-for="variant in variants"
                                    :key="variant.id"
                                    :value="variant"
                                >
                                    {{ variantLabel(variant) }}
                                </option>
                            </select>
                        </div>

                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Almacen
                            </label>
                            <SearchableSelect
                                v-model="warehouseId"
                                :options="warehouseOptions"
                                @update:model-value="fetchStock"
                            />
                        </div>

                        <div>
                            <label
                                class="mb-1 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                <span>Cantidad</span>
                                <span
                                    v-if="availableStock !== null"
                                    class="text-xs font-normal text-gray-500"
                                >
                                    Disponible: {{ availableStock }}
                                </span>
                            </label>
                            <input
                                v-model.number="quantity"
                                type="number"
                                min="1"
                                :max="availableStock ?? undefined"
                                class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            />
                            <p
                                v-if="quantityExceedsStock"
                                class="mt-1 text-xs text-red-600 dark:text-red-300"
                            >
                                La cantidad supera el stock disponible.
                            </p>
                        </div>

                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Motivo
                            </label>
                            <select
                                v-model="reason"
                                class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option value="" disabled>
                                    Selecciona motivo
                                </option>
                                <option
                                    v-for="reasonOption in reasons"
                                    :key="reasonOption"
                                    :value="reasonOption"
                                >
                                    {{ reasonOption }}
                                </option>
                            </select>
                        </div>

                        <div class="lg:col-span-2">
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Notas
                            </label>
                            <textarea
                                v-model="notes"
                                rows="3"
                                placeholder="Detalle opcional para auditoria"
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                    </div>
                </section>

                <aside
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 px-4 py-3 dark:border-border"
                    >
                        <h2
                            class="text-base font-semibold text-gray-950 dark:text-white"
                        >
                            Impacto estimado
                        </h2>
                    </div>

                    <div class="space-y-4 p-4">
                        <div
                            v-if="!canPreview"
                            class="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-border"
                        >
                            Selecciona producto, variante, almacen y cantidad
                            para revisar el impacto antes de registrar.
                        </div>

                        <dl v-else class="space-y-3 text-sm">
                            <div class="flex items-start justify-between gap-3">
                                <dt class="text-gray-500">Producto</dt>
                                <dd
                                    class="text-right font-medium text-gray-950 dark:text-white"
                                >
                                    {{ selectedProduct?.name || '-' }}
                                </dd>
                            </div>
                            <div class="flex items-start justify-between gap-3">
                                <dt class="text-gray-500">Variante</dt>
                                <dd
                                    class="text-right font-medium text-gray-950 dark:text-white"
                                >
                                    {{ variantLabel(selectedVariant) }}
                                </dd>
                            </div>
                            <div class="flex items-start justify-between gap-3">
                                <dt class="text-gray-500">Almacen</dt>
                                <dd
                                    class="text-right font-medium text-gray-950 dark:text-white"
                                >
                                    {{ selectedWarehouse?.name || '-' }}
                                </dd>
                            </div>
                            <div class="grid grid-cols-3 gap-2">
                                <div
                                    class="rounded-md bg-gray-50 p-3 text-center dark:bg-muted/50"
                                >
                                    <p class="text-xs text-gray-500">
                                        Disponible
                                    </p>
                                    <p
                                        class="mt-1 text-lg font-semibold text-gray-950 dark:text-white"
                                    >
                                        {{ availableStock ?? '-' }}
                                    </p>
                                </div>
                                <div
                                    class="rounded-md bg-red-50 p-3 text-center dark:bg-red-950/20"
                                >
                                    <p class="text-xs text-red-600">
                                        Descuento
                                    </p>
                                    <p
                                        class="mt-1 text-lg font-semibold text-red-700 dark:text-red-300"
                                    >
                                        -{{ quantity || 0 }}
                                    </p>
                                </div>
                                <div
                                    class="rounded-md bg-gray-50 p-3 text-center dark:bg-muted/50"
                                >
                                    <p class="text-xs text-gray-500">
                                        Restante
                                    </p>
                                    <p
                                        class="mt-1 text-lg font-semibold"
                                        :class="
                                            estimatedRemaining !== null &&
                                            estimatedRemaining < 0
                                                ? 'text-red-700 dark:text-red-300'
                                                : 'text-gray-950 dark:text-white'
                                        "
                                    >
                                        {{ estimatedRemaining ?? '-' }}
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-start justify-between gap-3">
                                <dt class="text-gray-500">Motivo</dt>
                                <dd
                                    class="text-right font-medium text-gray-950 dark:text-white"
                                >
                                    {{ selectedReasonLabel }}
                                </dd>
                            </div>
                        </dl>

                        <button
                            type="button"
                            :disabled="!canSubmit"
                            class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            @click="handleSubmit"
                        >
                            <AlertTriangle class="h-4 w-4" />
                            {{
                                submitting
                                    ? 'Registrando...'
                                    : 'Registrar merma'
                            }}
                        </button>
                    </div>
                </aside>
            </div>

            <section
                class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div
                    class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-border"
                >
                    <div class="flex items-center gap-2">
                        <ClipboardList
                            class="h-4 w-4 text-gray-500 dark:text-gray-400"
                        />
                        <h2
                            class="text-base font-semibold text-gray-950 dark:text-white"
                        >
                            Historial reciente
                        </h2>
                    </div>
                    <button
                        type="button"
                        class="text-sm font-medium text-blue-600 hover:underline dark:text-primary"
                        @click="fetchHistory"
                    >
                        Refrescar
                    </button>
                </div>

                <div v-if="historyLoading" class="px-4 py-10 text-center">
                    <PackageSearch class="mx-auto h-8 w-8 text-gray-400" />
                    <p class="mt-2 text-sm text-gray-500">Cargando...</p>
                </div>

                <div
                    v-else-if="history.length === 0"
                    class="px-4 py-10 text-center"
                >
                    <PackageSearch class="mx-auto h-8 w-8 text-gray-400" />
                    <p class="mt-2 text-sm text-gray-500">
                        No hay mermas registradas.
                    </p>
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="min-w-full text-left text-sm">
                        <thead
                            class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase dark:bg-muted dark:text-gray-300"
                        >
                            <tr>
                                <th class="px-4 py-3">Producto</th>
                                <th class="px-4 py-3">Variante / SKU</th>
                                <th class="px-4 py-3">Almacen</th>
                                <th class="px-4 py-3 text-right">Cantidad</th>
                                <th class="px-4 py-3">Motivo</th>
                                <th class="px-4 py-3">Usuario</th>
                                <th class="px-4 py-3">Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="entry in history"
                                :key="entry.id"
                                class="border-t border-gray-100 dark:border-border"
                            >
                                <td class="px-4 py-3">
                                    <div
                                        class="font-medium text-gray-950 dark:text-white"
                                    >
                                        {{ entry.product_name }}
                                    </div>
                                </td>
                                <td class="px-4 py-3">
                                    <div
                                        class="font-medium text-gray-900 dark:text-white"
                                    >
                                        {{ entry.brand }}
                                    </div>
                                    <div
                                        class="font-mono text-xs text-gray-500"
                                    >
                                        {{ entry.sku }}
                                    </div>
                                </td>
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-2">
                                        <Warehouse
                                            class="h-4 w-4 text-gray-400"
                                        />
                                        {{ entry.warehouse }}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 text-right font-semibold text-red-700 dark:text-red-300"
                                >
                                    -{{ entry.quantity }}
                                </td>
                                <td class="px-4 py-3">
                                    {{ entry.reason }}
                                </td>
                                <td class="px-4 py-3">
                                    {{ entry.user ?? '-' }}
                                </td>
                                <td class="px-4 py-3 text-xs">
                                    {{ formatDate(entry.date) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </AppLayout>
</template>
