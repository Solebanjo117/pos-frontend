<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { useSuppliers } from '@/composables/useSuppliers';
import { usePosSettings } from '@/composables/usePosSettings';
import { Save, Plus, Trash2, Search, Package } from 'lucide-vue-next';
import type {
    CreatePurchaseOrderData,
    PurchaseOrderCandidateItem,
    PurchaseOrderCandidateSource,
    PurchaseOrderWarning,
} from '@/types/purchase-order';
import apiClient from '@/services/api/client';
import { purchaseOrdersService } from '@/services/purchase-orders';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import PurchaseOrderSection from '@/components/PurchaseOrders/PurchaseOrderSection.vue';
import PurchaseOrderToolbar from '@/components/PurchaseOrders/PurchaseOrderToolbar.vue';

const props = defineProps<{ purchaseOrderId?: number }>();

const {
    loading,
    error,
    createPurchaseOrder,
    updatePurchaseOrder,
    fetchPurchaseOrderById,
    purchaseOrder,
} = usePurchaseOrders();
const { fetchActiveSuppliers } = useSuppliers();
const {
    fetchSettings,
    initWarehouse,
    currentWarehouseId,
    getDefaultWarehouseId,
} = usePosSettings();

const isEditing = computed(() => !!props.purchaseOrderId);

const suppliers = ref<any[]>([]);
const warehouses = ref<any[]>([]);
const productSearch = ref('');
const searchResults = ref<any[]>([]);
const searchingProducts = ref(false);
const entryMode = ref<'manual' | 'list'>('manual');
const candidateSource = ref<PurchaseOrderCandidateSource>('low_stock');
const candidateSupplyDate = ref(new Date().toISOString().split('T')[0]);
const candidateRows = ref<
    Array<
        PurchaseOrderCandidateItem & {
            selected: boolean;
            quantity: number;
            cost: number;
        }
    >
>([]);
const loadingCandidates = ref(false);
const candidateError = ref<string | null>(null);
const supplierWarnings = ref<PurchaseOrderWarning[]>([]);

const form = ref<CreatePurchaseOrderData>({
    supplier_id: 0,
    warehouse_id: 0,
    supplier_invoice_number: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    tax_amount: 0,
    shipping_cost: 0,
    notes: '',
    source_supply_list_item_ids: [],
    items: [],
});

const subtotal = computed(() =>
    form.value.items.reduce(
        (sum, item: any) =>
            sum +
            item.quantity_ordered *
                (item.units_per_package ?? 1) *
                item.unit_cost,
        0,
    ),
);
const total = computed(
    () =>
        subtotal.value +
        (form.value.tax_amount || 0) +
        (form.value.shipping_cost || 0),
);

const supplierOptions = computed<SelectOption[]>(() => [
    { value: 0, label: 'Selecciona un proveedor' },
    ...suppliers.value.map((s) => ({ value: s.id, label: s.name })),
]);

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: 0, label: 'Selecciona un almacén' },
    ...warehouses.value.map((w) => ({ value: w.id, label: w.name })),
]);

const selectedCandidateCount = computed(
    () => candidateRows.value.filter((row) => row.selected).length,
);

const toolbarTitle = computed(() =>
    isEditing.value
        ? `PO: ${purchaseOrder.value?.po_number || props.purchaseOrderId}`
        : 'Nueva OC individual',
);

const toolbarSubtitle = computed(() => {
    const supplier = suppliers.value.find(
        (item) => Number(item.id) === Number(form.value.supplier_id),
    )?.name;
    const warehouse = warehouses.value.find(
        (item) => Number(item.id) === Number(form.value.warehouse_id),
    )?.name;

    return [supplier, warehouse, `$${total.value.toFixed(2)}`]
        .filter(Boolean)
        .join(' | ');
});

const canLoadCandidates = computed(
    () => !!form.value.supplier_id && !!form.value.warehouse_id,
);

function supplierRelationFor(row: any) {
    const supplierId = Number(form.value.supplier_id);
    if (!supplierId || !Array.isArray(row.suppliers)) {
        return null;
    }

    return row.suppliers.find(
        (supplier: any) => Number(supplier.id) === supplierId,
    );
}

function preselectCurrentWarehouse() {
    if (isEditing.value || form.value.warehouse_id) {
        return;
    }

    const resolvedWarehouseId =
        currentWarehouseId.value ?? getDefaultWarehouseId() ?? null;

    if (
        resolvedWarehouseId &&
        warehouses.value.some(
            (warehouse) => Number(warehouse.id) === Number(resolvedWarehouseId),
        )
    ) {
        form.value.warehouse_id = Number(resolvedWarehouseId);
    }
}

function candidateKey(row: {
    product_id: number;
    variant_id?: number | null;
}): string {
    return `${row.variant_id ?? 'nv'}|${row.product_id}`;
}

async function searchProducts() {
    if (productSearch.value.length < 2) {
        searchResults.value = [];
        return;
    }
    searchingProducts.value = true;
    try {
        const { data } = await apiClient.get('/products', {
            params: {
                search: productSearch.value,
                per_page: 20,
                with_variants: true,
            },
        });
        const products: any[] = data.data || [];
        const query = productSearch.value.toLowerCase();

        // Flatten products → variants, one entry per variant
        // Then keep only variants whose own fields match the search term
        const variantRows: any[] = [];
        for (const product of products) {
            const variants = product.variants?.length
                ? product.variants
                : product.default_variant
                  ? [product.default_variant]
                  : [];
            for (const variant of variants) {
                const brandName =
                    variant.brand?.name || product.brand?.name || '';
                const sku = variant.sku || product.sku || '';
                const supplierRelation = supplierRelationFor(variant);

                // Only include this variant if it directly matches the query
                const matches =
                    product.name.toLowerCase().includes(query) ||
                    sku.toLowerCase().includes(query) ||
                    brandName.toLowerCase().includes(query);

                if (!matches) continue;

                variantRows.push({
                    variant_id: variant.id,
                    product_id: product.id,
                    product_name: product.name,
                    sku,
                    brand_name: brandName,
                    suppliers: variant.suppliers ?? [],
                    is_supplied_by_selected_supplier: !!supplierRelation,
                    supplier_lead_time_days:
                        supplierRelation?.lead_time_days ?? null,
                    supplier_minimum_order_quantity:
                        supplierRelation?.minimum_order_quantity ?? null,
                    cost:
                        supplierRelation?.supplier_cost ??
                        variant.pricing?.cost ??
                        product.pricing?.cost ??
                        0,
                });
            }
        }
        searchResults.value = variantRows;
    } catch (e) {
        searchResults.value = [];
    } finally {
        searchingProducts.value = false;
    }
}

function addProduct(row: any) {
    // row is already a flat variant object from searchResults
    if (
        form.value.items.find((i: any) => candidateKey(i) === candidateKey(row))
    )
        return;

    if (
        form.value.supplier_id &&
        !row.is_supplied_by_selected_supplier &&
        !confirm(
            'Esta variante no está vinculada al proveedor seleccionado. Puedes continuar, pero la OC quedará con una advertencia. ¿Deseas agregarla?',
        )
    ) {
        return;
    }

    form.value.items.push({
        product_id: row.product_id,
        variant_id: row.variant_id,
        quantity_ordered: row.supplier_minimum_order_quantity || 1,
        units_per_package: 1,
        unit_cost: row.cost || 0,
        notes: '',
        // Extra display fields (not sent to API)
        _name: row.product_name,
        _sku: row.sku,
        _brand: row.brand_name,
    } as any);
    productSearch.value = '';
    searchResults.value = [];
}

function removeItem(index: number) {
    const [removed] = form.value.items.splice(index, 1) as any[];
    const sourceIds = [
        ...(removed?._source_supply_list_item_ids ?? []),
        removed?._source_supply_list_item_id,
    ].filter(Boolean);

    if (sourceIds.length && form.value.source_supply_list_item_ids) {
        form.value.source_supply_list_item_ids =
            form.value.source_supply_list_item_ids.filter(
                (id) => !sourceIds.includes(id),
            );
    }
}

async function loadCandidateRows() {
    if (!canLoadCandidates.value) {
        candidateError.value = 'Selecciona proveedor y almacen primero';
        return;
    }

    loadingCandidates.value = true;
    candidateError.value = null;
    candidateRows.value = [];

    try {
        const rows = await purchaseOrdersService.getSupplierCandidates({
            supplier_id: Number(form.value.supplier_id),
            warehouse_id: Number(form.value.warehouse_id),
            source: candidateSource.value,
            supply_date:
                candidateSource.value === 'daily'
                    ? candidateSupplyDate.value
                    : undefined,
        });

        candidateRows.value = rows.map((row) => ({
            ...row,
            selected: false,
            quantity: row.suggested_quantity || 1,
            cost: Number(row.unit_cost || 0),
        }));
    } catch (e: any) {
        candidateError.value =
            e.response?.data?.message || 'Error al cargar el listado';
    } finally {
        loadingCandidates.value = false;
    }
}

function toggleAllCandidates(checked: boolean) {
    candidateRows.value = candidateRows.value.map((row) => ({
        ...row,
        selected: checked,
    }));
}

function addSelectedCandidates() {
    const selected = candidateRows.value.filter((row) => row.selected);

    selected.forEach((row) => {
        const existing = form.value.items.find(
            (item: any) => candidateKey(item) === candidateKey(row),
        ) as any;

        if (existing) {
            existing.quantity_ordered += Math.max(1, Number(row.quantity || 1));
            if (!existing.unit_cost && row.cost) {
                existing.unit_cost = row.cost;
            }

            if (row.source_supply_list_item_id) {
                existing._source_supply_list_item_ids = [
                    ...(existing._source_supply_list_item_ids ?? []),
                    row.source_supply_list_item_id,
                ].filter(
                    (id: number, index: number, ids: number[]) =>
                        ids.indexOf(id) === index,
                );
            }
        } else {
            form.value.items.push({
                product_id: row.product_id,
                variant_id: row.variant_id ?? null,
                quantity_ordered: Math.max(1, Number(row.quantity || 1)),
                units_per_package: 1,
                unit_cost: Number(row.cost || 0),
                notes: row.notes || '',
                _name: row.product_name,
                _sku: row.sku || 'N/A',
                _brand: '',
                _source_supply_list_item_id: row.source_supply_list_item_id,
                _source_supply_list_item_ids: row.source_supply_list_item_id
                    ? [row.source_supply_list_item_id]
                    : [],
            } as any);
        }

        if (row.source_supply_list_item_id) {
            const ids = form.value.source_supply_list_item_ids ?? [];
            if (!ids.includes(row.source_supply_list_item_id)) {
                form.value.source_supply_list_item_ids = [
                    ...ids,
                    row.source_supply_list_item_id,
                ];
            }
        }
    });

    candidateRows.value = candidateRows.value.map((row) =>
        row.selected ? { ...row, selected: false } : row,
    );
}

async function handleSubmit() {
    supplierWarnings.value = [];

    if (!form.value.supplier_id || !form.value.warehouse_id) {
        alert('Selecciona proveedor y almacén');
        return;
    }

    if (form.value.items.length === 0) {
        alert('Agrega al menos un producto');
        return;
    }
    try {
        const payload = {
            ...form.value,
            items: form.value.items.map((item: any) => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity_ordered: item.quantity_ordered,
                units_per_package: item.units_per_package || 1,
                unit_cost: item.unit_cost,
                notes: item.notes || '',
            })),
        };

        if (isEditing.value && props.purchaseOrderId) {
            const updated = await updatePurchaseOrder(
                props.purchaseOrderId,
                payload,
            );
            router.visit(`/purchase-orders/${updated.id}`);
        } else {
            const created = await createPurchaseOrder(payload);
            supplierWarnings.value = created.warnings ?? [];

            if (supplierWarnings.value.length) {
                alert(
                    supplierWarnings.value
                        .map((warning) => warning.message)
                        .join('\n'),
                );
            }

            router.visit(`/purchase-orders/${created.data.id}`);
        }
    } catch (e) {}
}

onMounted(async () => {
    // Load suppliers and warehouses
    await fetchSettings();
    await initWarehouse();
    suppliers.value = await fetchActiveSuppliers();
    try {
        const { data } = await apiClient.get('/warehouses');
        warehouses.value = data.data || data || [];
        preselectCurrentWarehouse();
    } catch (e) {
        console.error('Error loading warehouses', e);
    }

    // If editing, load existing purchase order
    if (isEditing.value && props.purchaseOrderId) {
        await fetchPurchaseOrderById(props.purchaseOrderId);

        if (purchaseOrder.value) {
            // Populate form with existing data
            form.value = {
                supplier_id: purchaseOrder.value.supplier_id,
                warehouse_id: purchaseOrder.value.warehouse_id,
                supplier_invoice_number:
                    purchaseOrder.value.supplier_invoice_number || '',
                order_date: purchaseOrder.value.order_date,
                expected_date: purchaseOrder.value.expected_date || '',
                tax_amount: Number(purchaseOrder.value.tax_amount) || 0,
                shipping_cost: Number(purchaseOrder.value.shipping_cost) || 0,
                notes: purchaseOrder.value.notes || '',
                source_supply_list_item_ids: [],
                items: purchaseOrder.value.items.map((item: any) => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity_ordered: item.quantity_ordered,
                    units_per_package: item.units_per_package || 1,
                    unit_cost: Number(item.unit_cost),
                    notes: item.notes || '',
                    // Extra display fields
                    _name:
                        item.variant?.product?.name ||
                        item.product?.name ||
                        'Producto',
                    _sku: item.variant?.sku || item.product?.sku || 'N/A',
                    _brand: item.variant?.brand?.name || '',
                })),
            };
        }
    }
});
</script>

<template>
    <Head
        :title="isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'"
    />
    <AppLayout>
        <PurchaseOrderToolbar
            :title="toolbarTitle"
            :subtitle="toolbarSubtitle"
            status-label="Borrador"
            :total="`$${total.toFixed(2)}`"
        >
            <template #actions>
                <Link
                    href="/purchase-orders"
                    class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                >
                    Cancelar
                </Link>
                <button
                    type="submit"
                    form="purchase-order-form"
                    :disabled="loading || form.items.length === 0"
                    class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Save :size="16" />
                    {{ loading ? 'Guardando...' : 'Guardar cambios' }}
                </button>
            </template>
        </PurchaseOrderToolbar>

        <div class="mx-auto max-w-7xl space-y-4 p-3">
            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
            >
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <form
                id="purchase-order-form"
                @submit.prevent="handleSubmit"
                @keydown.enter="
                    (e: KeyboardEvent) => {
                        if ((e.target as HTMLElement)?.tagName === 'INPUT')
                            e.preventDefault();
                    }
                "
                class="space-y-6"
            >
                <!-- Order Info -->
                <PurchaseOrderSection
                    title="Datos de la orden"
                    subtitle="Proveedor, almacen, factura y notas"
                    default-open
                >
                    <div class="p-4">
                        <h2
                            class="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            Información del Pedido
                        </h2>
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Proveedor *</label
                                >
                                <SearchableSelect
                                    v-model="form.supplier_id"
                                    :options="supplierOptions"
                                    placeholder="Selecciona un proveedor"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Almacén destino *</label
                                >
                                <SearchableSelect
                                    v-model="form.warehouse_id"
                                    :options="warehouseOptions"
                                    placeholder="Selecciona un almacén"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Fecha del Pedido</label
                                >
                                <input
                                    v-model="form.order_date"
                                    type="date"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Factura proveedor</label
                                >
                                <input
                                    v-model="form.supplier_invoice_number"
                                    type="text"
                                    maxlength="100"
                                    placeholder="Ej: ASD1221"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Fecha Esperada</label
                                >
                                <input
                                    v-model="form.expected_date"
                                    type="date"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div class="md:col-span-2">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Notas</label
                                >
                                <textarea
                                    v-model="form.notes"
                                    rows="2"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                ></textarea>
                            </div>
                        </div>
                    </div>
                </PurchaseOrderSection>

                <!-- Products -->
                <PurchaseOrderSection
                    title="Articulos"
                    subtitle="Metodo manual o listado de abastecimiento"
                    :count="form.items.length"
                    default-open
                >
                    <div class="p-4">
                        <h2
                            class="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            Productos
                        </h2>

                        <div
                            v-if="!isEditing"
                            class="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-border dark:bg-muted/30"
                        >
                            <button
                                type="button"
                                @click="entryMode = 'manual'"
                                :class="[
                                    'rounded-md px-4 py-2 text-sm font-medium transition',
                                    entryMode === 'manual'
                                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-card dark:text-primary'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                                ]"
                            >
                                Manual
                            </button>
                            <button
                                type="button"
                                @click="entryMode = 'list'"
                                :class="[
                                    'rounded-md px-4 py-2 text-sm font-medium transition',
                                    entryMode === 'list'
                                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-card dark:text-primary'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                                ]"
                            >
                                Listado
                            </button>
                        </div>

                        <!-- Product Search -->
                        <div
                            v-if="entryMode === 'manual' || isEditing"
                            class="relative mb-4"
                        >
                            <div class="relative">
                                <Search
                                    class="absolute top-2.5 left-3 text-gray-400"
                                    :size="18"
                                />
                                <input
                                    v-model="productSearch"
                                    type="text"
                                    placeholder="Buscar producto por nombre o SKU..."
                                    class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    @input="searchProducts"
                                />
                            </div>
                            <!-- Search Results Dropdown -->
                            <div
                                v-if="searchResults.length"
                                class="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card"
                            >
                                <button
                                    v-for="row in searchResults"
                                    :key="row.variant_id"
                                    type="button"
                                    @click="addProduct(row)"
                                    class="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50 dark:border-border dark:hover:bg-muted/50"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="truncate text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            {{ row.product_name }}
                                        </p>
                                        <p
                                            class="text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            <span
                                                v-if="row.brand_name"
                                                class="mr-1.5 font-semibold text-indigo-600 dark:text-indigo-400 dark:text-primary"
                                                >{{ row.brand_name }}</span
                                            >
                                            <span class="font-mono">{{
                                                row.sku
                                            }}</span>
                                            <span
                                                v-if="
                                                    form.supplier_id &&
                                                    row.is_supplied_by_selected_supplier
                                                "
                                                class="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                                            >
                                                Suministrado
                                            </span>
                                            <span
                                                v-else-if="form.supplier_id"
                                                class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                                            >
                                                No vinculado
                                            </span>
                                        </p>
                                    </div>
                                    <span
                                        class="ml-4 shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300"
                                        >${{
                                            Number(row.cost).toFixed(2)
                                        }}</span
                                    >
                                </button>
                            </div>
                        </div>

                        <div
                            v-else
                            class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted/20"
                        >
                            <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div>
                                    <label
                                        class="mb-1 block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                                        >Origen</label
                                    >
                                    <select
                                        v-model="candidateSource"
                                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    >
                                        <option value="low_stock">
                                            Stock bajo
                                        </option>
                                        <option value="daily">OC diaria</option>
                                    </select>
                                </div>
                                <div v-if="candidateSource === 'daily'">
                                    <label
                                        class="mb-1 block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                                        >Fecha OC diaria</label
                                    >
                                    <input
                                        v-model="candidateSupplyDate"
                                        type="date"
                                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <div class="flex items-end gap-2 md:col-span-2">
                                    <button
                                        type="button"
                                        @click="loadCandidateRows"
                                        :disabled="
                                            loadingCandidates ||
                                            !canLoadCandidates
                                        "
                                        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                                    >
                                        <Search :size="16" />
                                        {{
                                            loadingCandidates
                                                ? 'Cargando...'
                                                : 'Cargar listado'
                                        }}
                                    </button>
                                    <p
                                        v-if="!canLoadCandidates"
                                        class="text-xs text-amber-600 dark:text-amber-300"
                                    >
                                        Selecciona proveedor y almacen.
                                    </p>
                                </div>
                            </div>

                            <div
                                v-if="candidateError"
                                class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                            >
                                {{ candidateError }}
                            </div>

                            <div
                                v-if="candidateRows.length"
                                class="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                            >
                                <table
                                    class="min-w-full divide-y divide-gray-200 dark:divide-border"
                                >
                                    <thead
                                        class="bg-gray-50 dark:bg-background"
                                    >
                                        <tr>
                                            <th class="px-3 py-2 text-left">
                                                <input
                                                    type="checkbox"
                                                    :checked="
                                                        selectedCandidateCount ===
                                                        candidateRows.length
                                                    "
                                                    @change="
                                                        toggleAllCandidates(
                                                            (
                                                                $event.target as HTMLInputElement
                                                            ).checked,
                                                        )
                                                    "
                                                />
                                            </th>
                                            <th
                                                class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                            >
                                                Producto
                                            </th>
                                            <th
                                                class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                            >
                                                Stock
                                            </th>
                                            <th
                                                class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                            >
                                                Cantidad
                                            </th>
                                            <th
                                                class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                            >
                                                Costo
                                            </th>
                                            <th
                                                class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                            >
                                                Notas
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-gray-200 dark:divide-border"
                                    >
                                        <tr
                                            v-for="row in candidateRows"
                                            :key="row.id"
                                            class="hover:bg-gray-50 dark:hover:bg-muted/30"
                                        >
                                            <td class="px-3 py-2">
                                                <input
                                                    v-model="row.selected"
                                                    type="checkbox"
                                                />
                                            </td>
                                            <td class="px-3 py-2">
                                                <p
                                                    class="text-sm font-medium text-gray-900 dark:text-white"
                                                >
                                                    {{ row.product_name }}
                                                </p>
                                                <p
                                                    class="font-mono text-xs text-gray-500"
                                                >
                                                    {{ row.sku || 'N/A' }}
                                                </p>
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right text-sm text-gray-600 dark:text-gray-300"
                                            >
                                                {{ row.current_stock ?? '-' }}
                                            </td>
                                            <td class="px-3 py-2">
                                                <input
                                                    v-model.number="
                                                        row.quantity
                                                    "
                                                    type="number"
                                                    min="1"
                                                    class="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                />
                                            </td>
                                            <td class="px-3 py-2">
                                                <input
                                                    v-model.number="row.cost"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    class="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                />
                                            </td>
                                            <td
                                                class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
                                            >
                                                {{ row.notes || '-' }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div
                                    class="flex justify-end border-t border-gray-200 p-3 dark:border-border"
                                >
                                    <button
                                        type="button"
                                        @click="addSelectedCandidates"
                                        :disabled="selectedCandidateCount === 0"
                                        class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                                    >
                                        <Plus :size="16" />
                                        Agregar seleccionados
                                    </button>
                                </div>
                            </div>

                            <div
                                v-else-if="!loadingCandidates"
                                class="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-border dark:text-gray-400"
                            >
                                Carga un listado para seleccionar piezas del
                                proveedor.
                            </div>
                        </div>

                        <!-- Items Table -->
                        <div v-if="form.items.length" class="overflow-x-auto">
                            <table
                                class="min-w-full divide-y divide-gray-200 dark:divide-border"
                            >
                                <thead class="bg-gray-50 dark:bg-background">
                                    <tr>
                                        <th
                                            class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                        >
                                            Producto
                                        </th>
                                        <th
                                            class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                        >
                                            Paquetes
                                        </th>
                                        <th
                                            class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                            title="Unidades por paquete"
                                        >
                                            Und/Paq
                                        </th>
                                        <th
                                            class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                        >
                                            Total Und.
                                        </th>
                                        <th
                                            class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                        >
                                            Costo Unit.
                                        </th>
                                        <th
                                            class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                        >
                                            Subtotal
                                        </th>
                                        <th class="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-gray-200 dark:divide-border"
                                >
                                    <tr
                                        v-for="(item, idx) in form.items"
                                        :key="idx"
                                    >
                                        <td class="px-4 py-2">
                                            <p
                                                class="text-sm font-medium text-gray-900 dark:text-white"
                                            >
                                                {{ (item as any)._name }}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                <span
                                                    v-if="(item as any)._brand"
                                                    class="mr-1 font-medium text-indigo-600 dark:text-indigo-400 dark:text-primary"
                                                    >{{
                                                        (item as any)._brand
                                                    }}</span
                                                >
                                                {{ (item as any)._sku }}
                                            </p>
                                        </td>
                                        <td class="px-4 py-2">
                                            <input
                                                v-model.number="
                                                    item.quantity_ordered
                                                "
                                                type="number"
                                                min="1"
                                                class="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                            />
                                        </td>
                                        <td class="px-4 py-2">
                                            <input
                                                v-model.number="
                                                    (item as any)
                                                        .units_per_package
                                                "
                                                type="number"
                                                min="1"
                                                title="Unidades por paquete"
                                                class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                            />
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right text-sm font-medium text-gray-600 dark:text-gray-300"
                                        >
                                            {{
                                                item.quantity_ordered *
                                                ((item as any)
                                                    .units_per_package || 1)
                                            }}
                                        </td>
                                        <td class="px-4 py-2">
                                            <input
                                                v-model.number="item.unit_cost"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                class="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                            />
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            ${{
                                                (
                                                    item.quantity_ordered *
                                                    ((item as any)
                                                        .units_per_package ||
                                                        1) *
                                                    item.unit_cost
                                                ).toFixed(2)
                                            }}
                                        </td>
                                        <td class="px-4 py-2 text-right">
                                            <button
                                                type="button"
                                                @click="removeItem(idx)"
                                                class="p-1 text-gray-400 transition hover:text-red-600"
                                            >
                                                <Trash2 :size="16" />
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="py-8 text-center text-gray-400">
                            <Package class="mx-auto mb-2" :size="36" />
                            <p class="text-sm">
                                Busca y agrega productos al pedido
                            </p>
                        </div>
                    </div>
                </PurchaseOrderSection>

                <!-- Totals & Submit -->
                <PurchaseOrderSection
                    title="Costos"
                    subtitle="Impuestos, envio y total de la orden"
                    default-open
                >
                    <div class="p-4">
                        <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Impuestos</label
                                >
                                <input
                                    v-model.number="form.tax_amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Envío</label
                                >
                                <input
                                    v-model.number="form.shipping_cost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div class="flex flex-col items-end justify-end">
                                <p
                                    class="text-sm text-gray-500 dark:text-gray-400"
                                >
                                    Subtotal: ${{ subtotal.toFixed(2) }}
                                </p>
                                <p
                                    class="text-xl font-bold text-gray-900 dark:text-white"
                                >
                                    Total: ${{ total.toFixed(2) }}
                                </p>
                            </div>
                        </div>

                        <div
                            class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-border"
                        >
                            <Link
                                href="/purchase-orders"
                                class="rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                            >
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                :disabled="loading || form.items.length === 0"
                                class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Save :size="18" />
                                {{
                                    loading
                                        ? isEditing
                                            ? 'Actualizando...'
                                            : 'Creando...'
                                        : isEditing
                                          ? 'Actualizar Orden'
                                          : 'Crear Orden de Compra'
                                }}
                            </button>
                        </div>
                    </div>
                </PurchaseOrderSection>
            </form>
        </div>
    </AppLayout>
</template>
