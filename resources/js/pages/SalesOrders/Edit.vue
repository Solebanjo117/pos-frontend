<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useSalesOrders } from '@/composables/useSalesOrders';
import { useProducts } from '@/composables/useProducts';
import { useWarehouses } from '@/composables/useWarehouses';
import { useCustomers } from '@/composables/useCustomers';
import { CustomersApiService } from '@/services/customers';
import { useStoreSettings } from '@/composables/useStoreSettings';
import apiClient from '@/services/api/client';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-vue-next';
import type { UpdateSalesOrderData } from '@/types/sales-order';
import type { CustomerVehicle } from '@/types/customer';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

defineOptions({ layout: AppLayout });

const props = defineProps<{
    id: number;
}>();

const {
    currentSalesOrder,
    updateSalesOrder,
    fetchSalesOrderById,
    loading,
    error,
} = useSalesOrders();
const { products, fetchProducts } = useProducts();
const { warehouses, fetchWarehouses } = useWarehouses();
const { customers, fetchCustomers } = useCustomers();
const {
    fetchSettings: fetchStoreSettings,
    defaultTaxRate,
    resolveTaxRate,
} = useStoreSettings();

const users = ref<{ id: number; name: string }[]>([]);
const fetchUsers = async () => {
    try {
        const res = await apiClient.get('/users');
        users.value = res.data.data ?? res.data ?? [];
    } catch (e) {
        console.error('Error loading users', e);
    }
};

const form = ref<UpdateSalesOrderData>({
    customer_id: undefined,
    customer_vehicle_id: null,
    referred_by_customer_id: null,
    date: '',
    discount_amount: 0,
    shipping_cost: 0,
    payment_method: undefined,
    notes: '',
    items: [],
});
const customerVehicles = ref<CustomerVehicle[]>([]);

const newItem = ref({
    product_id: 0,
    warehouse_id: 0,
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_percent: defaultTaxRate(),
    seller_id: undefined as number | undefined,
});

const normalizeTaxPercent = (value: unknown): number => {
    return resolveTaxRate(value);
};

const productSalePrice = (product: any): number => {
    return Number(
        product.pricing?.current_sale_price ??
            product.pricing?.base_price ??
            product.default_variant?.current_sale_price ??
            product.default_variant?.base_price ??
            0,
    );
};

const productSearch = ref('');
const filteredProducts = computed(() => {
    if (!productSearch.value) return products.value.slice(0, 10);
    return products.value
        .filter(
            (p) =>
                p.name
                    .toLowerCase()
                    .includes(productSearch.value.toLowerCase()) ||
                p.sku_base
                    .toLowerCase()
                    .includes(productSearch.value.toLowerCase()),
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
const customerVehicleOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Sin carro' },
    ...customerVehicles.value
        .filter((vehicle) => vehicle.status === 'active')
        .map((vehicle) => ({
            value: vehicle.id,
            label: `${vehicle.label || vehicle.display_name} · VIN ${vehicle.vin}`,
        })),
]);
const referralCustomerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Sin referencia' },
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
const customerVehicleModel = computed<number | null>({
    get: () => form.value.customer_vehicle_id ?? null,
    set: (value) => {
        form.value.customer_vehicle_id = value === null ? null : Number(value);
    },
});
const referredByCustomerModel = computed<number | null>({
    get: () => form.value.referred_by_customer_id ?? null,
    set: (value) => {
        form.value.referred_by_customer_id =
            value === null ? null : Number(value);
    },
});

const loadCustomerVehicles = async (
    customerId?: number,
    resetSelection = true,
) => {
    customerVehicles.value = [];
    if (resetSelection) {
        form.value.customer_vehicle_id = null;
    }

    if (!customerId) return;

    const response = await CustomersApiService.getVehicles(customerId);
    customerVehicles.value = response.data.data;
};

watch(
    () => form.value.customer_id,
    (customerId) => {
        loadCustomerVehicles(customerId);
    },
);

const canEdit = computed(() => {
    return (
        currentSalesOrder.value?.status === 'draft' ||
        currentSalesOrder.value?.status === 'pending'
    );
});

const calculateItemTotal = (item: any) => {
    const subtotal = item.quantity * item.unit_price;
    const discount = subtotal * ((item.discount_percent || 0) / 100);
    const taxable = subtotal - discount;
    const tax = taxable * ((item.tax_percent || 0) / 100);
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
        unit_price: newItem.value.unit_price || productSalePrice(product),
        discount_percent: newItem.value.discount_percent,
        tax_percent: normalizeTaxPercent(newItem.value.tax_percent),
        seller_id: newItem.value.seller_id,
    });

    newItem.value = {
        product_id: 0,
        warehouse_id: 0,
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_percent: defaultTaxRate(),
        seller_id: undefined,
    };
    productSearch.value = '';
};

const removeItem = (index: number) => {
    form.value.items?.splice(index, 1);
};

const selectProduct = (product: any) => {
    newItem.value.product_id = product.id;
    newItem.value.unit_price = productSalePrice(product);
    productSearch.value = product.name;
};

const handleSubmit = async () => {
    if (!canEdit.value) {
        alert('Solo se pueden editar órdenes en estado borrador o pendiente');
        return;
    }

    if (!form.value.items || form.value.items.length === 0) {
        alert('Agrega al menos un producto');
        return;
    }

    try {
        await updateSalesOrder(props.id, form.value);
        router.visit(`/sales-orders/${props.id}`);
    } catch (err) {
        console.error('Error:', err);
    }
};

onMounted(async () => {
    await Promise.all([
        fetchSalesOrderById(props.id),
        fetchProducts({ per_page: 100 }),
        fetchWarehouses(),
        fetchCustomers(),
        fetchUsers(),
        fetchStoreSettings(),
    ]);

    newItem.value.tax_percent = defaultTaxRate();

    if (currentSalesOrder.value) {
        form.value = {
            customer_id: currentSalesOrder.value.customer_id,
            customer_vehicle_id:
                currentSalesOrder.value.customer_vehicle_id ?? null,
            referred_by_customer_id:
                currentSalesOrder.value.referred_by_customer_id ?? null,
            date: currentSalesOrder.value.date,
            discount_amount: currentSalesOrder.value.discount_amount,
            shipping_cost: currentSalesOrder.value.shipping_cost,
            payment_method: currentSalesOrder.value.payment_method,
            notes: currentSalesOrder.value.notes,
            items: currentSalesOrder.value.items.map((item) => ({
                product_id: item.product_id,
                warehouse_id: item.warehouse_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_percent: item.discount_percent,
                tax_percent: normalizeTaxPercent(item.tax_percent),
                seller_id: item.seller_id,
            })),
        };
        await loadCustomerVehicles(currentSalesOrder.value.customer_id, false);
        form.value.customer_vehicle_id =
            currentSalesOrder.value.customer_vehicle_id ?? null;
    }
});
</script>

<template>
    <Head :title="`Editar ${currentSalesOrder?.order_number || 'Orden'}`" />

    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center gap-4">
            <button
                @click="router.visit(`/sales-orders/${props.id}`)"
                class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-muted/50"
            >
                <ArrowLeft :size="24" />
            </button>
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                    Editar {{ currentSalesOrder?.order_number }}
                </h1>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                    Modifica los detalles de la orden
                </p>
            </div>
        </div>

        <!-- Error / Warning -->
        <div
            v-if="error"
            class="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
            {{ error }}
        </div>

        <div
            v-if="!canEdit"
            class="rounded-lg bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
        >
            ⚠️ Solo se pueden editar órdenes en estado borrador o pendiente.
        </div>

        <form
            v-if="currentSalesOrder"
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

                <div
                    class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5"
                >
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Cliente</label
                        >
                        <SearchableSelect
                            v-model="customerModel"
                            :options="customerOptions"
                            :disabled="!canEdit"
                            placeholder="Sin cliente"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Carro</label
                        >
                        <SearchableSelect
                            v-model="customerVehicleModel"
                            :options="customerVehicleOptions"
                            :disabled="!canEdit || !form.customer_id"
                            placeholder="Sin carro"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Referido por / Mecánico</label
                        >
                        <SearchableSelect
                            v-model="referredByCustomerModel"
                            :options="referralCustomerOptions"
                            :disabled="!canEdit"
                            placeholder="Sin referencia"
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
                            :disabled="!canEdit"
                            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
                        />
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
                        :disabled="!canEdit"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
                    />
                </div>
            </div>

            <!-- Add Items (only if can edit) -->
            <div
                v-if="canEdit"
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
                                    {{ product.sku_base }} - ${{
                                        productSalePrice(product)
                                    }}
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
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Vendedor
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
                                    Total
                                </th>
                                <th
                                    v-if="canEdit"
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
                                <td class="px-6 py-4">
                                    <select
                                        v-model="item.seller_id"
                                        :disabled="!canEdit"
                                        class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
                                    >
                                        <option :value="undefined">—</option>
                                        <option
                                            v-for="user in users"
                                            :key="user.id"
                                            :value="user.id"
                                        >
                                            {{ user.name }}
                                        </option>
                                    </select>
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
                                    class="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    ${{ calculateItemTotal(item).toFixed(2) }}
                                </td>
                                <td v-if="canEdit" class="px-6 py-4 text-right">
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
                                :disabled="!canEdit"
                                class="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
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
                                :disabled="!canEdit"
                                class="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
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
                    @click="router.visit(`/sales-orders/${props.id}`)"
                    class="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                >
                    Cancelar
                </button>
                <button
                    v-if="canEdit"
                    type="submit"
                    :disabled="
                        loading || !form.items || form.items.length === 0
                    "
                    class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:bg-gray-400 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Save :size="18" />
                    {{ loading ? 'Guardando...' : 'Actualizar Orden' }}
                </button>
            </div>
        </form>
    </div>
</template>
