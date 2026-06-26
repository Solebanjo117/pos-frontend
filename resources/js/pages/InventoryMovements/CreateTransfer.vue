<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { ArrowRightLeft, Trash2, Plus } from 'lucide-vue-next';
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import ProductCombobox from '@/components/ProductCombobox.vue';
import ProductVariantPickerModal from '@/components/Products/ProductVariantPickerModal.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useInventoryMovements } from '@/composables/useInventoryMovements';
import { usePosSettings } from '@/composables/usePosSettings';
import { useProducts } from '@/composables/useProducts';
import { useWarehouses } from '@/composables/useWarehouses';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { type BreadcrumbItem } from '@/types';
import type { ProductVariantSelection } from '@/types/product-variant-picker';

interface TransferItem {
    id: string;
    product_id: number | null;
    variant_id: number | null; // Added
    product_batch_id: number | null;
    quantity: number;
    // Helpers
    batches: any[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Movimientos', href: '/inventory-movements' },
    {
        title: 'Nueva Transferencia',
        href: '/inventory-movements/transfer/create',
    },
];

const { recordTransfer, loading, error } = useInventoryMovements(); // Check if bulk transfer exists or just single? Usually single logic or loop.
// Assuming recordTransfer is single, need to check composable. Most likely it's single or there's a bulk endpoint.
// Let's assume bulk payload structure for now as per other pages, but typically transfer is one by one or bulk.
// If composable only has recordTransfer (single), we might need to loop or update composable.
// However, considering the UI likely allows multiple items (since it has addItem), the backend probably supports bulk or we loop.
// Let's check useInventoryMovements from previous context or just assume bulk support in composable or implementing loop.
// Actually, I'll check if I need to update composable or if recordTransfer handles array.
// Ref: InventoryMovementService.recordTransfer is SINGLE.
// So Frontend likely needs to loop or backend needs bulk endpoint.
// For now, I will implement a loop in handleSubmit if bulk not supported, OR I should have updated backend to support bulk transfer.
// But wait, CreateInbound/Outbound use recordBulkInbound/Outbound.
// Does recordBulkTransfer exist?
// PROBABLY NOT.
// I will check useInventoryMovements in a moment.

const { products, fetchProducts, fetchBatches } = useProducts();
const { warehouses, fetchWarehouses } = useWarehouses();

const headerForm = ref({
    warehouse_id: null as number | null, // Origin
    destination_warehouse_id: null as number | null, // Destination
    notes: '',
});

const originWarehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Seleccionar...' },
    ...warehouses.value.map((w) => ({ value: w.id, label: w.name })),
]);

const destinationWarehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Seleccionar...' },
    ...warehouses.value
        .filter((w) => w.id !== headerForm.value.warehouse_id)
        .map((w) => ({ value: w.id, label: w.name })),
]);

const items = ref<TransferItem[]>([]);
const showProductPicker = ref(false);
const pickerProducts = ref<any[]>([]);
const productFilterCategories = ref<Array<{ id: number; name: string }>>([]);
const productFilterBrands = ref<Array<{ id: number; name: string }>>([]);
const pickerTotal = ref(0);
const pickerCurrentPage = ref(1);
const pickerLastPage = ref(1);
const pickerLoading = ref(false);
const pickerLoadingMore = ref(false);
const pickerSearchQuery = ref('');
const pickerFilters = ref<{
    query: string;
    category_ids?: number[];
    brand_ids?: number[];
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort?: string;
}>({ query: '' });
const formErrors = ref<Record<string, string>>({});
const successMessage = ref('');
const globalError = ref<string | null>(null);

const { currentWarehouseId, initWarehouse } = usePosSettings();

onMounted(async () => {
    await Promise.all([
        fetchProducts(),
        fetchWarehouses(),
        initWarehouse(),
        fetchProductFilterOptions(),
    ]);
    // Preselect source warehouse from backend context
    if (currentWarehouseId.value) {
        headerForm.value.warehouse_id = currentWarehouseId.value;
    }
    addItem();
});

const addItem = () => {
    items.value.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        product_id: null,
        variant_id: null,
        product_batch_id: null,
        quantity: 1,
        batches: [],
    });
};

const removeItem = (index: number) => {
    if (items.value.length > 1) {
        items.value.splice(index, 1);
    }
};

const handleProductSelect = async (
    index: number,
    productId: number | null,
    variantId?: number | null,
) => {
    const item = items.value[index];
    item.product_id = productId;
    item.variant_id = variantId || null;
    item.product_batch_id = null;
    item.batches = [];

    if (productId && headerForm.value.warehouse_id) {
        try {
            const allBatches = await fetchBatches(
                productId,
                headerForm.value.warehouse_id,
            );
            item.batches = allBatches;
        } catch (e) {
            console.error('Error fetching batches', e);
        }
    }

    if (index === items.value.length - 1 && productId !== null) {
        nextTick(() => addItem());
    }
};

const fetchPickerProducts = async (append = false) => {
    if (append && pickerCurrentPage.value >= pickerLastPage.value) return;

    if (append) {
        pickerLoadingMore.value = true;
    } else {
        pickerLoading.value = true;
        pickerCurrentPage.value = 1;
    }

    try {
        const page = append ? pickerCurrentPage.value + 1 : 1;
        const filters = pickerFilters.value;
        const { data } = await apiClient.get('/products', {
            params: {
                search: filters.query || undefined,
                category_id: filters.category_ids,
                brand_id: filters.brand_ids,
                min_price: filters.min_price,
                max_price: filters.max_price,
                in_stock: filters.in_stock,
                sort: filters.sort,
                warehouse_id: headerForm.value.warehouse_id || undefined,
                page,
                per_page: 20,
                with_variants: true,
            },
        });

        const rows = data.data || [];
        pickerProducts.value = append
            ? [...pickerProducts.value, ...rows]
            : rows;
        pickerCurrentPage.value = data.meta?.current_page ?? page;
        pickerLastPage.value = data.meta?.last_page ?? page;
        pickerTotal.value = data.meta?.total ?? rows.length;
    } finally {
        pickerLoading.value = false;
        pickerLoadingMore.value = false;
    }
};

const fetchProductFilterOptions = async () => {
    try {
        const [categoriesResponse, brandsResponse] = await Promise.all([
            apiClient.get('/categories'),
            apiClient.get('/brands'),
        ]);

        productFilterCategories.value =
            categoriesResponse.data.data ?? categoriesResponse.data ?? [];
        productFilterBrands.value =
            brandsResponse.data.data ?? brandsResponse.data ?? [];
    } catch (e) {
        productFilterCategories.value = [];
        productFilterBrands.value = [];
    }
};

const openProductPicker = () => {
    showProductPicker.value = true;
    pickerFilters.value = { query: pickerSearchQuery.value };
    fetchPickerProducts();
};

const handlePickerSearch = (filters: typeof pickerFilters.value) => {
    pickerFilters.value = filters;
    pickerSearchQuery.value = filters.query;
    fetchPickerProducts();
};

const addVariantSelections = async (selections: ProductVariantSelection[]) => {
    for (const { product, variant, quantity } of selections) {
        let index = items.value.findIndex((item) => !item.product_id);

        if (index === -1) {
            addItem();
            index = items.value.length - 1;
        }

        await handleProductSelect(index, product.id, variant?.id ?? null);
        items.value[index].quantity = Math.max(1, quantity || 1);
    }

    showProductPicker.value = false;
};

// Watch for origin warehouse change to refresh batches
watch(
    () => headerForm.value.warehouse_id,
    async (newVal) => {
        if (!newVal) {
            items.value.forEach((item) => (item.batches = []));
            return;
        }
        // Refresh batches for all selected products
        for (const item of items.value) {
            if (item.product_id) {
                try {
                    item.batches = await fetchBatches(item.product_id, newVal);
                    item.product_batch_id = null; // Reset selection as batches changed
                } catch (e) {
                    console.error(e);
                }
            }
        }
    },
);

const getProductDetails = (productId: number | null) => {
    if (!productId) return null;
    return products.value.find((p) => p.id === productId);
};

const getStockAvailable = (item: TransferItem) => {
    if (!item.product_id || !headerForm.value.warehouse_id) return null;

    if (item.product_batch_id) {
        const batch = item.batches.find((b) => b.id === item.product_batch_id);
        return batch ? batch.quantity : 0;
    }

    const product = getProductDetails(item.product_id);
    if (!product || !product.inventory) return 0;

    // Check inventory in ORIGIN warehouse
    const inv = product.inventory.find(
        (i) =>
            i.warehouse_id === headerForm.value.warehouse_id &&
            (i.variant_id === item.variant_id ||
                (item.variant_id === null && i.variant_id === null)),
    );

    return inv ? inv.quantity_available : 0;
};

const validateForm = () => {
    formErrors.value = {};
    globalError.value = null;
    let isValid = true;

    if (!headerForm.value.warehouse_id) {
        formErrors.value.warehouse_id = 'El almacén de origen es obligatorio';
        isValid = false;
    }
    if (!headerForm.value.destination_warehouse_id) {
        formErrors.value.destination_warehouse_id =
            'El almacén de destino es obligatorio';
        isValid = false;
    }
    if (
        headerForm.value.warehouse_id &&
        headerForm.value.destination_warehouse_id &&
        headerForm.value.warehouse_id ===
            headerForm.value.destination_warehouse_id
    ) {
        formErrors.value.destination_warehouse_id =
            'Los almacenes deben ser diferentes';
        isValid = false;
    }

    const validItems = items.value.filter((item) => item.product_id !== null);

    if (validItems.length === 0) {
        globalError.value = 'Debe agregar al menos un producto';
        return false;
    }

    validItems.forEach((item) => {
        if (!item.quantity || item.quantity <= 0) {
            formErrors.value[`item_${item.id}_quantity`] = 'Cantidad inválida';
            isValid = false;
        }

        const stock = getStockAvailable(item);
        if (stock !== null && item.quantity > stock) {
            formErrors.value[`item_${item.id}_quantity`] =
                `Excede stock disponible (${stock})`;
            isValid = false;
        }

        // Batch validation if product tracks batches
        const product = getProductDetails(item.product_id);
        if (
            product &&
            product.batch_tracking &&
            item.batches.length > 0 &&
            !item.product_batch_id
        ) {
            formErrors.value[`item_${item.id}_batch`] = 'Seleccione un lote';
            isValid = false;
        }
    });

    return isValid;
};

const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
        const validItems = items.value.filter(
            (item) => item.product_id !== null,
        );

        // Process sequentially since there's likely no bulk endpoint
        // Or if there is, use it. Without checking source, safe assumption is loop for now
        // OR better: check if I can make a bulk service method?
        // Making multiple API calls is slow but safe.
        // Actually, let's assume validItems loop.

        for (const item of validItems) {
            await recordTransfer({
                product_id: item.product_id!,
                variant_id: item.variant_id || undefined, // Added
                warehouse_id: headerForm.value.warehouse_id!,
                destination_warehouse_id:
                    headerForm.value.destination_warehouse_id!,
                quantity: item.quantity,
                notes: headerForm.value.notes,
                product_batch_id: item.product_batch_id || undefined,
            });
        }

        successMessage.value = 'Transferencias registradas exitosamente';
        setTimeout(() => {
            router.visit('/inventory-movements');
        }, 1500);
    } catch (err: any) {
        globalError.value = error.value || 'Error al procesar transferencia';
    }
};

const cancel = () => {
    router.visit('/inventory-movements');
};
</script>

<template>
    <Head title="Nueva Transferencia" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <div class="mx-auto max-w-7xl">
                <!-- Header -->
                <div
                    class="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center"
                >
                    <div>
                        <h1
                            class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white"
                        >
                            <ArrowRightLeft :size="32" />
                            Transferencia entre Almacenes
                        </h1>
                        <p
                            class="mt-1 text-sm text-gray-700 dark:text-gray-300"
                        >
                            Mueve inventario de un almacén a otro.
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            @click="cancel"
                            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            @click="handleSubmit"
                            :disabled="loading"
                            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            {{
                                loading
                                    ? 'Procesando...'
                                    : 'Confirmar Transferencia'
                            }}
                        </button>
                    </div>
                </div>

                <!-- Messages -->
                <div
                    v-if="successMessage"
                    class="mb-4 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900 dark:text-green-200"
                >
                    {{ successMessage }}
                </div>
                <div
                    v-if="error || globalError"
                    class="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200"
                >
                    {{ error || globalError }}
                </div>

                <!-- Main Grid -->
                <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
                    <!-- Sidebar: Config -->
                    <div class="space-y-6 lg:col-span-1">
                        <div
                            class="rounded-lg bg-white p-4 shadow dark:bg-card"
                        >
                            <h2
                                class="mb-4 font-semibold text-gray-900 dark:text-white"
                            >
                                Configuración
                            </h2>
                            <div class="space-y-4">
                                <div>
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
                                        >Origen</label
                                    >
                                    <SearchableSelect
                                        v-model="headerForm.warehouse_id"
                                        :options="originWarehouseOptions"
                                        placeholder="Seleccionar..."
                                    />
                                    <p
                                        v-if="formErrors.warehouse_id"
                                        class="text-xs text-red-600"
                                    >
                                        {{ formErrors.warehouse_id }}
                                    </p>
                                </div>

                                <div class="flex justify-center text-gray-400">
                                    <ArrowRightLeft :size="20" />
                                </div>

                                <div>
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
                                        >Destino</label
                                    >
                                    <SearchableSelect
                                        v-model="
                                            headerForm.destination_warehouse_id
                                        "
                                        :options="destinationWarehouseOptions"
                                        placeholder="Seleccionar..."
                                    />
                                    <p
                                        v-if="
                                            formErrors.destination_warehouse_id
                                        "
                                        class="text-xs text-red-600"
                                    >
                                        {{
                                            formErrors.destination_warehouse_id
                                        }}
                                    </p>
                                </div>

                                <div>
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
                                        >Notas Globales</label
                                    >
                                    <textarea
                                        v-model="headerForm.notes"
                                        rows="3"
                                        class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Items List -->
                    <div class="lg:col-span-3">
                        <div
                            class="flex min-h-[500px] flex-col rounded-lg bg-white p-4 shadow dark:bg-card"
                        >
                            <div class="mb-4 flex items-center justify-between">
                                <h2
                                    class="font-semibold text-gray-900 dark:text-white"
                                >
                                    Items a Transferir ({{ items.length }})
                                </h2>
                                <div class="flex items-center gap-3">
                                    <button
                                        @click="openProductPicker"
                                        type="button"
                                        class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-primary dark:hover:text-blue-400"
                                    >
                                        Buscar variantes
                                    </button>
                                    <button
                                        @click="addItem"
                                        type="button"
                                        class="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:text-primary"
                                    >
                                        <Plus :size="16" /> Agregar Item
                                    </button>
                                </div>
                            </div>

                            <div class="flex-1 overflow-auto">
                                <table
                                    class="min-w-full divide-y divide-gray-200 dark:divide-border"
                                >
                                    <thead class="bg-gray-50 dark:bg-muted">
                                        <tr>
                                            <th
                                                scope="col"
                                                class="w-1/3 px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                                            >
                                                Producto
                                            </th>
                                            <th
                                                scope="col"
                                                class="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                                            >
                                                Lote (Origen)
                                            </th>
                                            <th
                                                scope="col"
                                                class="w-24 px-3 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                                            >
                                                Cant.
                                            </th>
                                            <th
                                                scope="col"
                                                class="relative w-10 px-3 py-3"
                                            >
                                                <span class="sr-only"
                                                    >Actions</span
                                                >
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                                    >
                                        <tr
                                            v-for="(item, index) in items"
                                            :key="item.id"
                                        >
                                            <td class="px-3 py-4 align-top">
                                                <ProductCombobox
                                                    v-model="item.product_id"
                                                    :variant-id="
                                                        item.variant_id
                                                    "
                                                    :products="products"
                                                    placeholder="Buscar por nombre o SKU..."
                                                    :error="
                                                        formErrors[
                                                            `item_${item.id}_product`
                                                        ]
                                                    "
                                                    @selected="
                                                        (prod, variant) =>
                                                            handleProductSelect(
                                                                index,
                                                                prod.id,
                                                                variant?.id,
                                                            )
                                                    "
                                                    @update:variantId="
                                                        (val) =>
                                                            (item.variant_id =
                                                                val)
                                                    "
                                                />
                                                <div
                                                    v-if="item.product_id"
                                                    class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                                >
                                                    {{
                                                        getProductDetails(
                                                            item.product_id,
                                                        )?.brand?.name ||
                                                        'Sin Marca'
                                                    }}
                                                    |
                                                    {{
                                                        getProductDetails(
                                                            item.product_id,
                                                        )?.category?.name ||
                                                        'Sin Cat'
                                                    }}
                                                </div>
                                            </td>
                                            <td class="px-3 py-4 align-top">
                                                <div
                                                    v-if="
                                                        item.batches.length > 0
                                                    "
                                                >
                                                    <select
                                                        v-model="
                                                            item.product_batch_id
                                                        "
                                                        class="w-full rounded-md border-gray-300 py-1 text-sm shadow-sm dark:border-border dark:bg-muted"
                                                        :class="{
                                                            'border-red-500':
                                                                formErrors[
                                                                    `item_${item.id}_batch`
                                                                ],
                                                        }"
                                                    >
                                                        <option :value="null">
                                                            Seleccionar lote...
                                                        </option>
                                                        <option
                                                            v-for="b in item.batches"
                                                            :key="b.id"
                                                            :value="b.id"
                                                        >
                                                            {{ b.batch_number }}
                                                            (Stock:
                                                            {{ b.quantity }})
                                                        </option>
                                                    </select>
                                                </div>
                                                <div
                                                    v-else-if="item.product_id"
                                                    class="mt-2 text-xs text-gray-500 italic"
                                                >
                                                    Sin lotes / FIFO
                                                </div>
                                                <p
                                                    v-if="
                                                        formErrors[
                                                            `item_${item.id}_batch`
                                                        ]
                                                    "
                                                    class="mt-1 text-xs text-red-600"
                                                >
                                                    {{
                                                        formErrors[
                                                            `item_${item.id}_batch`
                                                        ]
                                                    }}
                                                </p>
                                            </td>
                                            <td class="px-3 py-4 align-top">
                                                <input
                                                    v-model.number="
                                                        item.quantity
                                                    "
                                                    type="number"
                                                    min="1"
                                                    :max="
                                                        getStockAvailable(
                                                            item,
                                                        ) || undefined
                                                    "
                                                    class="w-full rounded-md border-gray-300 text-center text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                                    :class="{
                                                        'border-red-500':
                                                            formErrors[
                                                                `item_${item.id}_quantity`
                                                            ],
                                                    }"
                                                />
                                                <p
                                                    v-if="
                                                        getStockAvailable(
                                                            item,
                                                        ) !== null
                                                    "
                                                    class="mt-1 text-center text-[10px] text-gray-500"
                                                >
                                                    Disp:
                                                    {{
                                                        getStockAvailable(item)
                                                    }}
                                                </p>
                                                <p
                                                    v-if="
                                                        formErrors[
                                                            `item_${item.id}_quantity`
                                                        ]
                                                    "
                                                    class="mt-1 text-center text-xs text-red-600"
                                                >
                                                    {{
                                                        formErrors[
                                                            `item_${item.id}_quantity`
                                                        ]
                                                    }}
                                                </p>
                                            </td>
                                            <td
                                                class="px-3 py-4 text-center align-top"
                                            >
                                                <button
                                                    @click="removeItem(index)"
                                                    type="button"
                                                    class="text-red-500 hover:text-red-700"
                                                    title="Eliminar fila"
                                                    :disabled="
                                                        items.length === 1 &&
                                                        !item.product_id
                                                    "
                                                    :class="{
                                                        'cursor-not-allowed opacity-50':
                                                            items.length ===
                                                                1 &&
                                                            !item.product_id,
                                                    }"
                                                >
                                                    <Trash2 :size="18" />
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div
                                class="mt-4 border-t border-gray-200 pt-4 dark:border-border"
                            >
                                <div
                                    class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
                                >
                                    <span>Total Items: {{ items.length }}</span>
                                    <span
                                        >Total Cantidad:
                                        {{
                                            items.reduce(
                                                (acc, item) =>
                                                    acc + (item.quantity || 0),
                                                0,
                                            )
                                        }}</span
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <ProductVariantPickerModal
            :show="showProductPicker"
            :products="pickerProducts"
            :search-query="pickerSearchQuery"
            :total-count="pickerTotal"
            :has-more="pickerCurrentPage < pickerLastPage"
            :loading-more="pickerLoadingMore"
            :loading="pickerLoading"
            :categories="productFilterCategories"
            :brands="productFilterBrands"
            title="Seleccionar variantes para transferencia"
            confirm-label="Agregar a transferencia"
            context="inventory"
            @close="showProductPicker = false"
            @confirm="addVariantSelections"
            @load-more="fetchPickerProducts(true)"
            @search="handlePickerSearch"
        />
    </AppLayout>
</template>
