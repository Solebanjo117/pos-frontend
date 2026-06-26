<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    Calendar,
    ChevronDown,
    ChevronRight,
    RefreshCw,
    Users,
    Warehouse as WarehouseIcon,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { CustomersApiService } from '@/services/customers';
import { InventoryApiService } from '@/services/inventory';
import { ReportsApiService } from '@/services/reports';
import type { BreadcrumbItem } from '@/types';
import type {
    CustomerReferenceReport,
    CustomerReferenceReportRow,
} from '@/types/report';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/customer-references' },
    { title: 'Clientes y referencias', href: '/reports/customer-references' },
];

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const filters = ref({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    warehouse_id: null as number | null,
    customer_id: null as number | null,
});

const report = ref<CustomerReferenceReport | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const warehouses = ref<any[]>([]);
const customers = ref<Array<{ id: number; name: string; code?: string }>>([]);
const expandedRows = ref<Set<number>>(new Set());

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos' },
    ...customers.value.map((customer) => ({
        value: customer.id,
        label: `${customer.name}${customer.code ? ` · ${customer.code}` : ''}`,
    })),
]);

const rows = computed(() => report.value?.data ?? []);
const summary = computed(
    () =>
        report.value?.summary ?? {
            direct_revenue: 0,
            referred_revenue: 0,
            combined_revenue: 0,
            customers_count: 0,
        },
);

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value || 0);

const fetchReport = async () => {
    loading.value = true;
    error.value = null;

    try {
        report.value = await ReportsApiService.getCustomerReferences(
            filters.value,
        );
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'No se pudo cargar el reporte de referencias';
    } finally {
        loading.value = false;
    }
};

const loadFilters = async () => {
    const [warehouseList, customerResponse] = await Promise.all([
        InventoryApiService.getWarehouses(),
        CustomersApiService.getCustomers({}, 1, 200),
    ]);

    warehouses.value = warehouseList;
    customers.value = customerResponse.data.data;
};

const toggleRow = (row: CustomerReferenceReportRow) => {
    const next = new Set(expandedRows.value);
    if (next.has(row.customer_id)) {
        next.delete(row.customer_id);
    } else {
        next.add(row.customer_id);
    }
    expandedRows.value = next;
};

const openOrder = (orderId: number) => {
    router.visit(`/sales-orders/${orderId}`);
};

onMounted(async () => {
    await loadFilters();
    await fetchReport();
});
</script>

<template>
    <Head title="Clientes y referencias" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-4 p-4">
            <div
                class="flex flex-col gap-3 border-b border-gray-200 pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-border"
            >
                <div>
                    <h1
                        class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                        <Users :size="26" class="text-cyan-600" />
                        Clientes y referencias
                    </h1>
                    <div
                        class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                    >
                        <span class="inline-flex items-center gap-1">
                            <Calendar :size="14" />
                            {{ filters.date_from }} - {{ filters.date_to }}
                        </span>
                        <span class="inline-flex items-center gap-1">
                            <WarehouseIcon :size="14" />
                            {{
                                warehouses.find(
                                    (warehouse) =>
                                        warehouse.id === filters.warehouse_id,
                                )?.name || 'Todas'
                            }}
                        </span>
                    </div>
                </div>

                <div
                    class="grid gap-2 rounded-lg border border-gray-200 bg-white p-2 md:grid-cols-5 dark:border-border dark:bg-card"
                >
                    <input
                        v-model="filters.date_from"
                        type="date"
                        class="h-10 rounded-md border border-gray-300 px-3 text-sm dark:border-border dark:bg-muted"
                    />
                    <input
                        v-model="filters.date_to"
                        type="date"
                        class="h-10 rounded-md border border-gray-300 px-3 text-sm dark:border-border dark:bg-muted"
                    />
                    <SearchableSelect
                        v-model="filters.warehouse_id"
                        :options="warehouseOptions"
                        placeholder="Sucursal"
                    />
                    <SearchableSelect
                        v-model="filters.customer_id"
                        :options="customerOptions"
                        placeholder="Cliente"
                    />
                    <button
                        type="button"
                        class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
                        :disabled="loading"
                        @click="fetchReport"
                    >
                        <RefreshCw :size="16" />
                        Actualizar
                    </button>
                </div>
            </div>

            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700"
            >
                {{ error }}
            </div>

            <section class="grid gap-3 md:grid-cols-4">
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-sm text-gray-500">Compras propias</p>
                    <p class="mt-2 font-mono text-2xl font-semibold">
                        {{ formatCurrency(summary.direct_revenue) }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-sm text-gray-500">Ventas referidas</p>
                    <p
                        class="mt-2 font-mono text-2xl font-semibold text-cyan-700"
                    >
                        {{ formatCurrency(summary.referred_revenue) }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-sm text-gray-500">Total combinado</p>
                    <p
                        class="mt-2 font-mono text-2xl font-semibold text-emerald-700"
                    >
                        {{ formatCurrency(summary.combined_revenue) }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-sm text-gray-500">Clientes</p>
                    <p class="mt-2 font-mono text-2xl font-semibold">
                        {{ summary.customers_count }}
                    </p>
                </div>
            </section>

            <section
                class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[860px] text-sm">
                        <thead
                            class="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase dark:border-border dark:bg-muted"
                        >
                            <tr>
                                <th class="px-4 py-3 text-left">Cliente</th>
                                <th class="px-4 py-3 text-right">
                                    Compras propias
                                </th>
                                <th class="px-4 py-3 text-right">
                                    Ventas referidas
                                </th>
                                <th class="px-4 py-3 text-right">
                                    Total combinado
                                </th>
                                <th class="px-4 py-3 text-right">Ventas</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template
                                v-for="row in rows"
                                :key="row.customer_id"
                            >
                                <tr
                                    class="border-b border-gray-100 dark:border-border/60"
                                >
                                    <td class="px-4 py-3">
                                        <button
                                            type="button"
                                            class="inline-flex items-center gap-2 font-medium text-gray-900 hover:underline dark:text-white"
                                            @click="toggleRow(row)"
                                        >
                                            <ChevronDown
                                                v-if="
                                                    expandedRows.has(
                                                        row.customer_id,
                                                    )
                                                "
                                                :size="16"
                                            />
                                            <ChevronRight v-else :size="16" />
                                            {{ row.customer_name }}
                                        </button>
                                        <p class="pl-6 text-xs text-gray-500">
                                            {{ row.customer_code }}
                                        </p>
                                    </td>
                                    <td class="px-4 py-3 text-right font-mono">
                                        {{ formatCurrency(row.direct_revenue) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-mono text-cyan-700"
                                    >
                                        {{
                                            formatCurrency(row.referred_revenue)
                                        }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-mono font-semibold text-emerald-700"
                                    >
                                        {{
                                            formatCurrency(row.combined_revenue)
                                        }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        {{ row.orders_count }} propias /
                                        {{ row.referred_orders_count }}
                                        referidas
                                    </td>
                                </tr>
                                <tr
                                    v-if="expandedRows.has(row.customer_id)"
                                    class="border-b border-gray-100 bg-gray-50 dark:border-border/60 dark:bg-muted/40"
                                >
                                    <td colspan="5" class="px-8 py-3">
                                        <div class="grid gap-3 lg:grid-cols-2">
                                            <div>
                                                <h3
                                                    class="mb-2 text-xs font-semibold text-gray-500 uppercase"
                                                >
                                                    Compras propias
                                                </h3>
                                                <button
                                                    v-for="order in row.direct_orders"
                                                    :key="order.id"
                                                    type="button"
                                                    class="flex w-full justify-between rounded-md px-2 py-1.5 text-left hover:bg-white dark:hover:bg-card"
                                                    @click="openOrder(order.id)"
                                                >
                                                    <span>
                                                        {{ order.order_number }}
                                                        · {{ order.date }}
                                                    </span>
                                                    <span class="font-mono">
                                                        {{
                                                            formatCurrency(
                                                                order.total,
                                                            )
                                                        }}
                                                    </span>
                                                </button>
                                                <p
                                                    v-if="
                                                        row.direct_orders
                                                            .length === 0
                                                    "
                                                    class="text-sm text-gray-500"
                                                >
                                                    Sin compras propias
                                                </p>
                                            </div>
                                            <div>
                                                <h3
                                                    class="mb-2 text-xs font-semibold text-gray-500 uppercase"
                                                >
                                                    Ventas referidas
                                                </h3>
                                                <button
                                                    v-for="order in row.referred_orders"
                                                    :key="order.id"
                                                    type="button"
                                                    class="flex w-full justify-between rounded-md px-2 py-1.5 text-left hover:bg-white dark:hover:bg-card"
                                                    @click="openOrder(order.id)"
                                                >
                                                    <span>
                                                        {{ order.order_number }}
                                                        ·
                                                        {{
                                                            order.customer_name
                                                        }}
                                                    </span>
                                                    <span class="font-mono">
                                                        {{
                                                            formatCurrency(
                                                                order.total,
                                                            )
                                                        }}
                                                    </span>
                                                </button>
                                                <p
                                                    v-if="
                                                        row.referred_orders
                                                            .length === 0
                                                    "
                                                    class="text-sm text-gray-500"
                                                >
                                                    Sin ventas referidas
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                            <tr v-if="!loading && rows.length === 0">
                                <td
                                    colspan="5"
                                    class="px-4 py-10 text-center text-gray-500"
                                >
                                    Sin datos para este periodo
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </AppLayout>
</template>
