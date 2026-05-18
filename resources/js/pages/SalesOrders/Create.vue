<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useSalesOrders } from '@/composables/useSalesOrders';
import { useProducts } from '@/composables/useProducts';
import { useWarehouses } from '@/composables/useWarehouses';
import { useCustomers } from '@/composables/useCustomers';
import { useStoreSettings } from '@/composables/useStoreSettings';
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-vue-next';
import type { CreateSalesOrderData } from '@/types/sales-order';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

defineOptions({ layout: AppLayout });

const { createSalesOrder, loading, error } = useSalesOrders();
const { products, fetchProducts } = useProducts();
const { warehouses, fetchWarehouses } = useWarehouses();
const { customers, fetchCustomers } = useCustomers();
const {
    fetchSettings: fetchStoreSettings,
    defaultTaxRate,
    resolveTaxRate,
} = useStoreSettings();

// Form data
const form = ref<CreateSalesOrderData>({
    customer_id: undefined,
    date: new Date().toISOString().split('T')[0],
    status: 'draft',
    discount_amount: 0,
    shipping_cost: 0,
    payment_method: undefined,
    notes: '',
    items: [],
});

// New item form
const newItem = ref({
    product_id: 0,
    warehouse_id: 0,
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_percent: defaultTaxRate(),
});

const normalizeTaxPercent = (value: unknown): number => {
    return resolveTaxRate(value);
};

// Search
const productSearch = ref('');
const filteredProducts = computed(() => {
    if (!productSearch.value) return products.value.slice(0, 10);
    return products.value
        .filter(
            (p) =>
                p.name
                    .toLowerCase()
                    .includes(productSearch.value.toLowerCase()) ||
                p.sku.toLowerCase().includes(productSearch.value.toLowerCase()),
        )
        .slice(0, 10);
});

const customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Sin cliente' },
    ...customers.value.map((customer) => ({
        value: customer.id,
        label: customer.name,
    })),
]);

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: 0, label: 'Seleccionar...' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const customerModel = computed<number | null>({
    get: () => form.value.customer_id ?? null,
    set: (value) => {
        form.value.customer_id = value === null ? undefined : Number(value);
    },
});

// Calculations
const calculateItemTotal = (item: any) => {
    const subtotal = item.quantity * item.unit_price;
    const discount = subtotal * (item.discount_percent / 100);
    const taxable = subtotal - discount;
    const tax = taxable * (item.tax_percent / 100);
    return taxable + tax;
};

const orderSubtotal = computed(() => {
    return (
        form.value.items?.reduce((sum, item) => {
            const subtotal = item.quantity * item.unit_price;
            const discount = subtotal * ((item.discount_percent || 0) / 100);
            return sum + (subtotal - discount);
        }, 0) || 0
    );
});

const orderTax = computed(() => {
    return (
        form.value.items?.reduce((sum, item) => {
            const subtotal = item.quantity * item.unit_price;
            const discount = subtotal * ((item.discount_percent || 0) / 100);
            const taxable = subtotal - discount;
            return sum + taxable * ((item.tax_percent || 0) / 100);
        }, 0) || 0
    );
});

const orderTotal = computed(() => {
    return (
        orderSubtotal.value +
        orderTax.value +
        (form.value.shipping_cost || 0) -
        (form.value.discount_amount || 0)
    );
});

// Actions
const addItem = () => {
    if (!newItem.value.product_id || !newItem.value.warehouse_id) {
        alert('Selecciona un producto y almacén');
        return;
    }

    const product = products.value.find(
        (p) => p.id === newItem.value.product_id,
    );
    if (!product) return;

    if (!form.value.items) form.value.items = [];

    form.value.items.push({
        product_id: newItem.value.product_id,
        warehouse_id: newItem.value.warehouse_id,
        quantity: newItem.value.quantity,
        unit_price: newItem.value.unit_price || product.price,
        discount_percent: newItem.value.discount_percent,
        tax_percent: normalizeTaxPercent(newItem.value.tax_percent),
    });

    // Reset
    newItem.value = {
        product_id: 0,
        warehouse_id: 0,
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_percent: defaultTaxRate(),
    };
    productSearch.value = '';
};

const removeItem = (index: number) => {
    form.value.items?.splice(index, 1);
};

const selectProduct = (product: any) => {
    newItem.value.product_id = product.id;
    newItem.value.unit_price = product.price;
    productSearch.value = product.name;
};

const handleSubmit = async () => {
    if (!form.value.items || form.value.items.length === 0) {
        alert('Agrega al menos un producto');
        return;
    }

    try {
        await createSalesOrder(form.value);
        router.visit('/sales-orders');
    } catch (err) {
        console.error('Error:', err);
    }
};

onMounted(async () => {
    await Promise.all([
        fetchProducts({ per_page: 100 }),
        fetchWarehouses({ per_page: 50 }),
        fetchCustomers({ per_page: 100 }),
        fetchStoreSettings(),
    ]);

    newItem.value.tax_percent = defaultTaxRate();
});
</script>

<template>
    <Head title="Nueva Orden de Venta" />

    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center gap-4">
            <button
                @click="router.visit('/sales-orders')"
                class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-muted/50"
            >
                <ArrowLeft :size="24" />
            </button>
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                    Nueva Orden de Venta
                </h1>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                    Crea una nueva orden de venta
                </p>
            </div>
        </div>

        <!-- Error -->
        <div
            v-if="error"
            class="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
            {{ error }}
        </div>

        <form
            @submit.prevent="handleSubmit"
            @keydown.enter="
                (e: KeyboardEvent) => {
                    if ((e.target as HTMLElement)?.tagName === 'INPUT')
                        e.preventDefault();
                }
            "
            class="space-y-6"
        >
            <!-- General Info -->
            <div
                class="rounded-lg border border-gray-200 bg-white p-6 dark:border-border dark:bg-card"
            >
                <h2
                    class="mb-4 text-xl font-semibold text-gray-900 dark:text-white"
                >
                    Información General
                </h2>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Cliente</label
                        >
                        <SearchableSelect
                            v-model="customerModel"
                            :options="customerOptions"
                            placeholder="Sin cliente"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Fecha</label
                        >
                        <input
                            v-model="form.date"
                            type="date"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            required
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Estado</label
                        >
                        <select
                            v-model="form.status"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option value="draft">Borrador</option>
                            <option value="pending">Pendiente</option>
                        </select>
                    </div>
                </div>

                <div class="mt-4">
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >Notas</label
                    >
                    <textarea
                        v-model="form.notes"
                        rows="2"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="Notas adicionales..."
                    />
                </div>
            </div>

            <!-- Add Items -->
            <div
                class="rounded-lg border border-gray-200 bg-white p-6 dark:border-border dark:bg-card"
            >
                <h2
                    class="mb-4 text-xl font-semibold text-gray-900 dark:text-white"
                >
                    Agregar Productos
                </h2>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-6">
                    <div class="relative md:col-span-2">
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Producto</label
                        >
                        <input
                            v-model="productSearch"
                            type="text"
                            placeholder="Buscar producto..."
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        />
                        <div
                            v-if="productSearch && filteredProducts.length > 0"
                            class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-muted"
                        >
                            <button
                                v-for="product in filteredProducts"
                                :key="product.id"
                                type="button"
                                @click="selectProduct(product)"
                                class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-muted"
                            >
                                <div
                                    class="font-medium text-gray-900 dark:text-white"
                                >
                                    {{ product.name }}
                                </div>
                                <div
                                    class="text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {{ product.sku }} - ${{ product.price }}
                                </div>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Almacén</label
                        >
                        <SearchableSelect
                            v-model="newItem.warehouse_id"
                            :options="warehouseOptions"
                            placeholder="Seleccionar..."
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Cantidad</label
                        >
                        <input
                            v-model.number="newItem.quantity"
                            type="number"
                            min="1"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Precio</label
                        >
                        <input
                            v-model.number="newItem.unit_price"
                            type="number"
                            step="0.01"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div class="flex items-end">
                        <button
                            type="button"
                            @click="addItem"
                            class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            <Plus :size="18" />
                            Agregar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div
                v-if="form.items && form.items.length > 0"
                class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div
                    class="border-b border-gray-200 px-6 py-4 dark:border-border"
                >
                    <h2
                        class="text-xl font-semibold text-gray-900 dark:text-white"
                    >
                        Productos ({{ form.items.length }})
                    </h2>
                </div>

                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Almacén
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Cant.
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Precio
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Desc. %
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    ITBMS %
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Total
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Acción
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                        >
                            <tr
                                v-for="(item, index) in form.items"
                                :key="index"
                            >
                                <td
                                    class="px-6 py-4 text-sm text-gray-900 dark:text-white"
                                >
                                    {{
                                        products.find(
                                            (p) => p.id === item.product_id,
                                        )?.name || 'Producto'
                                    }}
                                </td>
                                <td
                                    class="px-6 py-4 text-sm text-gray-900 dark:text-white"
                                >
                                    {{
                                        warehouses.find(
                                            (w) => w.id === item.warehouse_id,
                                        )?.name || 'Almacén'
                                    }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    {{ item.quantity }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    ${{ item.unit_price }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    {{ item.discount_percent }}%
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    {{ item.tax_percent }}%
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    ${{ calculateItemTotal(item).toFixed(2) }}
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <button
                                        type="button"
                                        @click="removeItem(index)"
                                        class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        <Trash2 :size="18" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Totals -->
                <div
                    class="border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-border dark:bg-background"
                >
                    <div class="ml-auto max-w-md space-y-2">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600 dark:text-gray-400"
                                >Subtotal:</span
                            >
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                                >${{ orderSubtotal.toFixed(2) }}</span
                            >
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600 dark:text-gray-400"
                                >Impuestos:</span
                            >
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                                >${{ orderTax.toFixed(2) }}</span
                            >
                        </div>

                        <div
                            class="flex items-center justify-between gap-4 text-sm"
                        >
                            <span class="text-gray-600 dark:text-gray-400"
                                >Descuento:</span
                            >
                            <input
                                v-model.number="form.discount_amount"
                                type="number"
                                step="0.01"
                                min="0"
                                class="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>

                        <div
                            class="flex items-center justify-between gap-4 text-sm"
                        >
                            <span class="text-gray-600 dark:text-gray-400"
                                >Envío:</span
                            >
                            <input
                                v-model.number="form.shipping_cost"
                                type="number"
                                step="0.01"
                                min="0"
                                class="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>

                        <div
                            class="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold dark:border-border"
                        >
                            <span class="text-gray-900 dark:text-white"
                                >Total:</span
                            >
                            <span class="text-gray-900 dark:text-white"
                                >${{ orderTotal.toFixed(2) }}</span
                            >
                        </div>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-4">
                <button
                    type="button"
                    @click="router.visit('/sales-orders')"
                    class="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    :disabled="
                        loading || !form.items || form.items.length === 0
                    "
                    class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:bg-gray-400 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Save :size="18" />
                    {{ loading ? 'Guardando...' : 'Crear Orden' }}
                </button>
            </div>
        </form>
    </div>
</template>
