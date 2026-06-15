<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import {
    ArrowLeft,
    CalendarDays,
    Car,
    Edit,
    Package,
    Play,
    UserRound,
    Wrench,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    WorkOrdersApiService,
    type WorkOrder,
    type WorkOrderStatus,
} from '@/services/workOrders';

defineOptions({ layout: AppLayout });

const props = defineProps<{
    workOrderId: number | string;
}>();

const order = ref<WorkOrder | null>(null);
const loading = ref(false);
const transitioning = ref(false);
const error = ref<string | null>(null);

const statusLabels: Record<WorkOrderStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En proceso',
    done: 'Lista',
    delivered: 'Entregada',
    cancelled: 'Cancelada',
};

const title = computed(() =>
    order.value ? `Orden ${order.value.folio}` : 'Orden de trabajo',
);

const vehicleLabel = computed(
    () =>
        order.value?.customer_vehicle?.display_name ||
        order.value?.customer_vehicle?.label ||
        order.value?.vehicle_description ||
        'Vehiculo no registrado',
);

const loadOrder = async () => {
    loading.value = true;
    error.value = null;

    try {
        order.value = await WorkOrdersApiService.getWorkOrder(
            Number(props.workOrderId),
        );
    } catch (err: any) {
        error.value =
            err.response?.data?.message ?? 'No se pudo cargar la orden.';
    } finally {
        loading.value = false;
    }
};

const transition = async (status: WorkOrderStatus) => {
    if (!order.value) {
        return;
    }

    transitioning.value = true;

    try {
        await WorkOrdersApiService.transitionWorkOrder(order.value.id, status);
        await loadOrder();
    } finally {
        transitioning.value = false;
    }
};

const formatCurrency = (value: unknown): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatDate = (date?: string | null): string => {
    if (!date) {
        return '-';
    }

    return new Date(date).toLocaleDateString('es-PA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

onMounted(loadOrder);
</script>

<template>
    <Head :title="title" />

    <div
        class="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100"
    >
        <div class="space-y-5 p-4 sm:p-6">
            <Link
                href="/work-orders"
                class="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
                <ArrowLeft class="h-4 w-4" />
                Volver a ordenes
            </Link>

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
                Cargando orden...
            </div>

            <template v-else-if="order">
                <section
                    class="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <div
                        class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
                    >
                        <div>
                            <div
                                class="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300"
                            >
                                <Wrench class="h-4 w-4" />
                                {{
                                    order.warehouse?.name ??
                                    `Sucursal #${order.warehouse_id}`
                                }}
                            </div>
                            <h1 class="mt-1 text-2xl font-semibold">
                                {{ order.folio }}
                            </h1>
                            <p class="mt-1 text-sm text-slate-500">
                                {{ order.notes || 'Sin notas internas.' }}
                            </p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button
                                v-for="status in order.available_transitions"
                                :key="status"
                                class="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                                :disabled="transitioning"
                                @click="transition(status)"
                            >
                                <Play class="h-4 w-4" />
                                {{ statusLabels[status] }}
                            </button>
                            <Link
                                :href="`/work-orders/${order.id}/edit`"
                                class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                <Edit class="h-4 w-4" />
                                Editar
                            </Link>
                        </div>
                    </div>
                </section>

                <div class="grid gap-5 xl:grid-cols-[1fr_360px]">
                    <div class="space-y-5">
                        <section
                            class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <h2 class="font-semibold">Repuestos consumidos</h2>
                            <div class="mt-4 overflow-x-auto">
                                <table
                                    class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"
                                >
                                    <thead
                                        class="text-xs text-slate-500 uppercase"
                                    >
                                        <tr>
                                            <th class="px-3 py-2 text-left">
                                                Producto
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Cantidad
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Precio
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-slate-100 dark:divide-slate-800"
                                    >
                                        <tr
                                            v-for="item in order.items ?? []"
                                            :key="item.id"
                                        >
                                            <td class="px-3 py-3">
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <Package
                                                        class="h-4 w-4 text-slate-400"
                                                    />
                                                    <div>
                                                        <div
                                                            class="font-medium"
                                                        >
                                                            {{
                                                                item.product
                                                                    ?.name ??
                                                                `Producto #${item.product_id}`
                                                            }}
                                                        </div>
                                                        <div
                                                            class="text-xs text-slate-500"
                                                        >
                                                            {{
                                                                item.product
                                                                    ?.sku_base ??
                                                                item.variant
                                                                    ?.sku ??
                                                                '-'
                                                            }}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="px-3 py-3 text-right">
                                                {{ item.quantity }}
                                            </td>
                                            <td class="px-3 py-3 text-right">
                                                {{
                                                    formatCurrency(
                                                        item.unit_price,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-3 text-right font-semibold"
                                            >
                                                {{
                                                    formatCurrency(
                                                        Number(
                                                            item.unit_price,
                                                        ) *
                                                            Number(
                                                                item.quantity,
                                                            ),
                                                    )
                                                }}
                                            </td>
                                        </tr>
                                        <tr v-if="!order.items?.length">
                                            <td
                                                colspan="4"
                                                class="px-3 py-8 text-center text-slate-500"
                                            >
                                                Sin repuestos registrados.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    <aside class="space-y-5">
                        <section
                            class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <h2 class="font-semibold">Resumen</h2>
                            <dl class="mt-4 space-y-3 text-sm">
                                <div class="flex justify-between gap-3">
                                    <dt class="text-slate-500">Estado</dt>
                                    <dd class="font-semibold">
                                        {{ statusLabels[order.status] }}
                                    </dd>
                                </div>
                                <div class="flex justify-between gap-3">
                                    <dt class="text-slate-500">Partes</dt>
                                    <dd class="font-semibold">
                                        {{ formatCurrency(order.total_parts) }}
                                    </dd>
                                </div>
                                <div class="flex justify-between gap-3">
                                    <dt class="text-slate-500">Mano de obra</dt>
                                    <dd class="font-semibold">
                                        {{ formatCurrency(order.total_labour) }}
                                    </dd>
                                </div>
                                <div
                                    class="border-t border-slate-200 pt-3 text-base dark:border-slate-800"
                                >
                                    <div class="flex justify-between gap-3">
                                        <dt class="text-slate-500">
                                            Total operativo
                                        </dt>
                                        <dd class="font-bold">
                                            {{
                                                formatCurrency(
                                                    order.total_amount,
                                                )
                                            }}
                                        </dd>
                                    </div>
                                </div>
                            </dl>
                        </section>

                        <section
                            class="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <h2 class="font-semibold">Cliente y vehiculo</h2>
                            <div class="mt-4 space-y-4 text-sm">
                                <div class="flex gap-3">
                                    <UserRound class="h-5 w-5 text-slate-400" />
                                    <div>
                                        <div class="font-medium">
                                            {{
                                                order.customer?.name ??
                                                'Cliente rapido'
                                            }}
                                        </div>
                                        <div class="text-slate-500">
                                            {{
                                                order.customer?.phone ??
                                                order.customer?.email ??
                                                '-'
                                            }}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-3">
                                    <Car class="h-5 w-5 text-slate-400" />
                                    <div>
                                        <div class="font-medium">
                                            {{ vehicleLabel }}
                                        </div>
                                        <div class="text-slate-500">
                                            {{
                                                order.customer_vehicle?.vin ??
                                                '-'
                                            }}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-3">
                                    <Wrench class="h-5 w-5 text-slate-400" />
                                    <div>
                                        <div class="font-medium">
                                            {{
                                                order.assignee?.name ??
                                                'Sin asignar'
                                            }}
                                        </div>
                                        <div class="text-slate-500">
                                            Mecanico / responsable
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-3">
                                    <CalendarDays
                                        class="h-5 w-5 text-slate-400"
                                    />
                                    <div>
                                        <div class="font-medium">
                                            {{
                                                formatDate(
                                                    order.estimated_delivery_at,
                                                )
                                            }}
                                        </div>
                                        <div class="text-slate-500">
                                            Entrega estimada
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </aside>
                </div>
            </template>
        </div>
    </div>
</template>
