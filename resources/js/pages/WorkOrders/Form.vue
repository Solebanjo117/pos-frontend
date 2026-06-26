<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import { ArrowLeft, Plus, Save, Trash2, Wrench } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { productsApi } from '@/services/api/products';
import { CustomersApiService } from '@/services/customers';
import UsersApiService, { type User } from '@/services/users';
import WarehousesApiService from '@/services/warehouses';
import {
    WorkOrdersApiService,
    type WorkOrder,
    type WorkOrderPayload,
} from '@/services/workOrders';
import type { Customer, CustomerVehicle } from '@/types/customer';
import type { Warehouse } from '@/types/warehouse';

defineOptions({ layout: AppLayout });

const props = defineProps<{
    workOrderId?: number | string | null;
}>();

const isEdit = computed(() => Boolean(props.workOrderId));
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const workOrder = ref<WorkOrder | null>(null);
const customers = ref<Customer[]>([]);
const vehicles = ref<CustomerVehicle[]>([]);
const warehouses = ref<Warehouse[]>([]);
const users = ref<User[]>([]);
const products = ref<
    Array<{ id: number; name: string; sku_base?: string | null }>
>([]);

const form = ref({
    customer_id: null as number | null,
    customer_vehicle_id: null as number | null,
    warehouse_id: null as number | null,
    assigned_to: null as number | null,
    vehicle_description: '',
    labour_cost: 0,
    estimated_delivery_at: '',
    notes: '',
    items: [
        {
            product_id: null as number | null,
            variant_id: null as number | null,
            warehouse_id: null as number | null,
            quantity: 1,
            unit_price: 0,
            notes: '',
        },
    ],
});

const pageTitle = computed(() =>
    isEdit.value ? 'Editar orden de trabajo' : 'Nueva orden de trabajo',
);

const loadCatalogs = async () => {
    const [
        customersResponse,
        warehouseResponse,
        userResponse,
        productResponse,
    ] = await Promise.all([
        CustomersApiService.getCustomers({ status: 'active' }, 1, 300),
        WarehousesApiService.getAllWarehouses(),
        UsersApiService.getUsers(),
        productsApi.getProducts({ per_page: 100 } as any),
    ]);

    customers.value = customersResponse.data.data;
    warehouses.value = warehouseResponse;
    users.value = userResponse.filter((user) => user.is_active);
    products.value = productResponse.data.map((product: any) => ({
        id: product.id,
        name: product.name,
        sku_base: product.sku_base,
    }));

    if (!form.value.warehouse_id && warehouses.value[0]) {
        form.value.warehouse_id = warehouses.value[0].id;
        form.value.items[0].warehouse_id = warehouses.value[0].id;
    }
};

const loadVehicles = async (customerId: number | null) => {
    vehicles.value = [];

    if (!customerId) {
        form.value.customer_vehicle_id = null;
        return;
    }

    const response = await CustomersApiService.getVehicles(customerId);
    vehicles.value = response.data.data;
};

const loadExisting = async () => {
    if (!props.workOrderId) {
        return;
    }

    workOrder.value = await WorkOrdersApiService.getWorkOrder(
        Number(props.workOrderId),
    );
    form.value = {
        customer_id: workOrder.value.customer_id,
        customer_vehicle_id: workOrder.value.customer_vehicle_id,
        warehouse_id: workOrder.value.warehouse_id,
        assigned_to: workOrder.value.assigned_to,
        vehicle_description: workOrder.value.vehicle_description ?? '',
        labour_cost: Number(workOrder.value.labour_cost) || 0,
        estimated_delivery_at: workOrder.value.estimated_delivery_at
            ? workOrder.value.estimated_delivery_at.slice(0, 10)
            : '',
        notes: workOrder.value.notes ?? '',
        items:
            workOrder.value.items?.map((item) => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                warehouse_id: item.warehouse_id,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                notes: item.notes ?? '',
            })) ?? [],
    };

    await loadVehicles(form.value.customer_id);
};

const applyQueryDefaults = async () => {
    if (isEdit.value) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const customerId = Number(params.get('customer_id')) || null;
    const vehicleId = Number(params.get('customer_vehicle_id')) || null;

    if (customerId) {
        form.value.customer_id = customerId;
        await loadVehicles(customerId);
    }

    if (vehicleId) {
        form.value.customer_vehicle_id = vehicleId;
    }
};

watch(
    () => form.value.customer_id,
    async (customerId) => {
        if (loading.value) {
            return;
        }

        form.value.customer_vehicle_id = null;
        await loadVehicles(customerId);
    },
);

watch(
    () => form.value.warehouse_id,
    (warehouseId) => {
        form.value.items = form.value.items.map((item) => ({
            ...item,
            warehouse_id: item.warehouse_id ?? warehouseId,
        }));
    },
);

const addItem = () => {
    form.value.items.push({
        product_id: null,
        variant_id: null,
        warehouse_id: form.value.warehouse_id,
        quantity: 1,
        unit_price: 0,
        notes: '',
    });
};

const removeItem = (index: number) => {
    form.value.items.splice(index, 1);
};

const buildPayload = (): WorkOrderPayload => ({
    customer_id: form.value.customer_id,
    customer_vehicle_id: form.value.customer_vehicle_id,
    warehouse_id: form.value.warehouse_id,
    assigned_to: form.value.assigned_to,
    vehicle_description: form.value.vehicle_description || null,
    labour_cost: Number(form.value.labour_cost) || 0,
    estimated_delivery_at: form.value.estimated_delivery_at || null,
    notes: form.value.notes || null,
    items: isEdit.value
        ? undefined
        : form.value.items
              .filter((item) => item.product_id && item.warehouse_id)
              .map((item) => ({
                  product_id: Number(item.product_id),
                  variant_id: item.variant_id,
                  warehouse_id: Number(item.warehouse_id),
                  quantity: Number(item.quantity) || 1,
                  unit_price: Number(item.unit_price) || 0,
                  notes: item.notes || null,
              })),
});

const submit = async () => {
    saving.value = true;
    error.value = null;

    try {
        const payload = buildPayload();
        const response = isEdit.value
            ? await WorkOrdersApiService.updateWorkOrder(
                  Number(props.workOrderId),
                  payload,
              )
            : await WorkOrdersApiService.createWorkOrder(payload);

        router.visit(`/work-orders/${response.data.id}`);
    } catch (err: any) {
        error.value =
            err.response?.data?.message ?? 'No se pudo guardar la orden.';
    } finally {
        saving.value = false;
    }
};

onMounted(async () => {
    loading.value = true;

    try {
        await loadCatalogs();
        await loadExisting();
        await applyQueryDefaults();
    } catch (err: any) {
        error.value =
            err.response?.data?.message ?? 'No se pudo cargar el formulario.';
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <Head :title="pageTitle" />

    <div
        class="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100"
    >
        <div class="space-y-5 p-4 sm:p-6">
            <div class="flex items-center justify-between">
                <div>
                    <Link
                        href="/work-orders"
                        class="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                        <ArrowLeft class="h-4 w-4" />
                        Volver
                    </Link>
                    <h1 class="mt-2 text-2xl font-semibold">{{ pageTitle }}</h1>
                </div>
                <button
                    class="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                    :disabled="saving || loading"
                    @click="submit"
                >
                    <Save class="h-4 w-4" />
                    Guardar
                </button>
            </div>

            <div
                v-if="error"
                class="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
                {{ error }}
            </div>

            <div
                v-if="loading"
                class="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"
            >
                Cargando formulario...
            </div>

            <div v-else class="grid gap-5 xl:grid-cols-[1fr_360px]">
                <div class="space-y-5">
                    <section
                        class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div class="mb-4 flex items-center gap-2 font-semibold">
                            <Wrench class="h-4 w-4 text-sky-600" />
                            Datos operativos
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <label class="space-y-1 text-sm">
                                <span class="font-medium">Cliente</span>
                                <select
                                    v-model="form.customer_id"
                                    class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option :value="null">
                                        Cliente rapido / sin registrar
                                    </option>
                                    <option
                                        v-for="customer in customers"
                                        :key="customer.id"
                                        :value="customer.id"
                                    >
                                        {{ customer.name }}
                                    </option>
                                </select>
                            </label>
                            <label class="space-y-1 text-sm">
                                <span class="font-medium"
                                    >Vehiculo del cliente</span
                                >
                                <select
                                    v-model="form.customer_vehicle_id"
                                    class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                                    :disabled="!form.customer_id"
                                >
                                    <option :value="null">
                                        Usar descripcion manual
                                    </option>
                                    <option
                                        v-for="vehicle in vehicles"
                                        :key="vehicle.id"
                                        :value="vehicle.id"
                                    >
                                        {{
                                            vehicle.display_name ||
                                            vehicle.label ||
                                            vehicle.vin ||
                                            `Vehiculo #${vehicle.id}`
                                        }}
                                    </option>
                                </select>
                            </label>
                            <label class="space-y-1 text-sm">
                                <span class="font-medium">Sucursal</span>
                                <select
                                    v-model="form.warehouse_id"
                                    class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option :value="null">Seleccionar</option>
                                    <option
                                        v-for="warehouse in warehouses"
                                        :key="warehouse.id"
                                        :value="warehouse.id"
                                    >
                                        {{ warehouse.name }}
                                    </option>
                                </select>
                            </label>
                            <label class="space-y-1 text-sm">
                                <span class="font-medium"
                                    >Mecanico / asignado</span
                                >
                                <select
                                    v-model="form.assigned_to"
                                    class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option :value="null">Sin asignar</option>
                                    <option
                                        v-for="user in users"
                                        :key="user.id"
                                        :value="user.id"
                                    >
                                        {{ user.name }} · {{ user.role }}
                                    </option>
                                </select>
                            </label>
                            <label class="space-y-1 text-sm">
                                <span class="font-medium"
                                    >Entrega estimada</span
                                >
                                <input
                                    v-model="form.estimated_delivery_at"
                                    type="date"
                                    class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </label>
                            <label class="space-y-1 text-sm">
                                <span class="font-medium">Mano de obra</span>
                                <input
                                    v-model.number="form.labour_cost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </label>
                        </div>
                        <label class="mt-4 block space-y-1 text-sm">
                            <span class="font-medium"
                                >Descripcion del vehiculo / trabajo</span
                            >
                            <textarea
                                v-model="form.vehicle_description"
                                rows="3"
                                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                                placeholder="Ej. Toyota Hilux 2018, cambio de amortiguadores..."
                            />
                        </label>
                        <label class="mt-4 block space-y-1 text-sm">
                            <span class="font-medium">Notas internas</span>
                            <textarea
                                v-model="form.notes"
                                rows="3"
                                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                    </section>

                    <section
                        class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <h2 class="font-semibold">Repuestos</h2>
                                <p class="text-xs text-slate-500">
                                    Se consumen del inventario al crear la
                                    orden.
                                </p>
                            </div>
                            <button
                                v-if="!isEdit"
                                class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"
                                @click="addItem"
                            >
                                <Plus class="h-4 w-4" />
                                Agregar
                            </button>
                        </div>
                        <div
                            v-if="isEdit"
                            class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                        >
                            La edicion de repuestos queda bloqueada para no
                            alterar inventario consumido. Ajusta datos
                            operativos o cancela la orden si necesitas restaurar
                            inventario.
                        </div>
                        <div v-else class="space-y-3">
                            <div
                                v-for="(item, index) in form.items"
                                :key="index"
                                class="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_130px_130px_130px_auto] dark:border-slate-800"
                            >
                                <select
                                    v-model="item.product_id"
                                    class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option :value="null">Producto</option>
                                    <option
                                        v-for="product in products"
                                        :key="product.id"
                                        :value="product.id"
                                    >
                                        {{
                                            product.sku_base
                                                ? `${product.sku_base} · `
                                                : ''
                                        }}{{ product.name }}
                                    </option>
                                </select>
                                <input
                                    v-model.number="item.quantity"
                                    type="number"
                                    min="1"
                                    class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                    placeholder="Cant."
                                />
                                <input
                                    v-model.number="item.unit_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                    placeholder="Precio"
                                />
                                <select
                                    v-model="item.warehouse_id"
                                    class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option
                                        v-for="warehouse in warehouses"
                                        :key="warehouse.id"
                                        :value="warehouse.id"
                                    >
                                        {{ warehouse.name }}
                                    </option>
                                </select>
                                <button
                                    class="rounded-md border border-slate-300 px-3 text-slate-500 hover:text-rose-600 dark:border-slate-700"
                                    @click="removeItem(index)"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                <aside
                    class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <h2 class="font-semibold">Resumen</h2>
                    <dl class="mt-4 space-y-3 text-sm">
                        <div class="flex justify-between">
                            <dt class="text-slate-500">Cliente</dt>
                            <dd class="font-medium">
                                {{
                                    customers.find(
                                        (customer) =>
                                            customer.id === form.customer_id,
                                    )?.name ?? 'Sin cliente'
                                }}
                            </dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-slate-500">Vehiculo</dt>
                            <dd class="max-w-[180px] truncate font-medium">
                                {{
                                    vehicles.find(
                                        (vehicle) =>
                                            vehicle.id ===
                                            form.customer_vehicle_id,
                                    )?.display_name ??
                                    (form.vehicle_description || '-')
                                }}
                            </dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-slate-500">Mecanico</dt>
                            <dd class="font-medium">
                                {{
                                    users.find(
                                        (user) => user.id === form.assigned_to,
                                    )?.name ?? 'Sin asignar'
                                }}
                            </dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-slate-500">Mano de obra</dt>
                            <dd class="font-semibold">
                                ${{ Number(form.labour_cost || 0).toFixed(2) }}
                            </dd>
                        </div>
                    </dl>
                </aside>
            </div>
        </div>
    </div>
</template>
