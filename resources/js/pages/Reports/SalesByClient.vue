<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import {
    AlertCircle,
    Award,
    BarChart3,
    Calculator,
    Car,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    FileSpreadsheet,
    Filter,
    Package,
    Receipt,
    RefreshCw,
    Search,
    UserCheck,
    Users,
    Wrench,
} from 'lucide-vue-next';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Title,
    Tooltip,
} from 'chart.js';
import { Bar } from 'vue-chartjs';
import AppLayout from '@/layouts/AppLayout.vue';
import FinanceKpiCard from '@/components/Finance/FinanceKpiCard.vue';
import FinanceReportShell from '@/components/Finance/FinanceReportShell.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useWarehouses } from '@/composables/useWarehouses';
import { CustomersApiService } from '@/services/customers';
import { ReportsApiService } from '@/services/reports';
import type { BreadcrumbItem } from '@/types';
import type {
    SalesByClientFilters,
    SalesByClientReport,
    SalesByClientRow,
} from '@/types/report';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
);

interface CustomerOption {
    id: number;
    name: string;
    code?: string | null;
}

type DatePreset = 'month' | 'quarter' | 'year' | 'custom';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reportes', href: '/reports/sales-by-client' },
    { title: 'Ventas por Cliente', href: '/reports/sales-by-client' },
];

const { warehouses, fetchWarehouses } = useWarehouses();
const { currentWarehouseId, initWarehouse } = usePosSettings();

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const report = ref<SalesByClientReport | null>(null);
const customers = ref<CustomerOption[]>([]);
const loading = ref(false);
const exporting = ref<'pdf' | 'excel' | null>(null);
const error = ref<string | null>(null);
const expandedCustomerId = ref<number | null>(null);
const activePreset = ref<DatePreset>('month');
const filters = ref<SalesByClientFilters>({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    warehouse_id: null,
    customer_id: null,
    referred_by_customer_id: null,
    search: '',
    sort_by: 'total_revenue',
    sort_direction: 'desc',
    page: 1,
    per_page: 25,
});

const datePresets: Array<{ key: DatePreset; label: string }> = [
    { key: 'month', label: 'Mes' },
    { key: 'quarter', label: 'Trimestre' },
    { key: 'year', label: 'Ano' },
    { key: 'custom', label: 'Manual' },
];

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos los clientes' },
    ...customers.value.map((customer) => ({
        value: customer.id,
        label: `${customer.code ? `${customer.code} - ` : ''}${customer.name}`,
    })),
]);

const referrerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos los mecanicos' },
    ...customers.value.map((customer) => ({
        value: customer.id,
        label: `${customer.code ? `${customer.code} - ` : ''}${customer.name}`,
    })),
]);

const rows = computed(() => report.value?.data ?? []);
const summary = computed(
    () =>
        report.value?.summary ?? {
            total_revenue: 0,
            orders_count: 0,
            average_ticket: 0,
            active_customers: 0,
            total_paid: 0,
            pending_amount: 0,
            overdue_amount: 0,
        },
);
const meta = computed(
    () =>
        report.value?.meta ?? {
            current_page: 1,
            last_page: 1,
            per_page: 25,
            total: 0,
        },
);

const chartData = computed(() => ({
    labels: (report.value?.top_clients ?? []).map((client) =>
        client.customer_name.length > 22
            ? `${client.customer_name.slice(0, 21)}...`
            : client.customer_name,
    ),
    datasets: [
        {
            label: 'Facturacion',
            data: (report.value?.top_clients ?? []).map(
                (client) => client.total_revenue,
            ),
            backgroundColor: '#6366f1',
            borderRadius: 5,
            borderSkipped: false,
        },
    ],
}));

const chartOptions = computed(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: (context: any) =>
                    `Facturacion: ${formatCurrency(context.raw)}`,
            },
        },
    },
    scales: {
        x: {
            ticks: {
                callback: (value: string | number) =>
                    formatCurrency(Number(value)),
            },
            grid: { color: 'rgba(148,163,184,0.16)' },
        },
        y: {
            grid: { display: false },
        },
    },
}));

const formatCurrency = (value: unknown): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatDate = (value?: string | null): string => {
    if (!value) {
        return '-';
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString('es-PA');
};

const statusClass = (status: SalesByClientRow['status']): string => {
    if (status === 'vencido') {
        return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30';
    }

    if (status === 'pendiente') {
        return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30';
    }

    return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30';
};

const setPreset = (preset: DatePreset): void => {
    activePreset.value = preset;
    const now = new Date();

    if (preset === 'month') {
        filters.value.date_from = new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString()
            .split('T')[0];
    }

    if (preset === 'quarter') {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        filters.value.date_from = new Date(now.getFullYear(), quarterStart, 1)
            .toISOString()
            .split('T')[0];
    }

    if (preset === 'year') {
        filters.value.date_from = new Date(now.getFullYear(), 0, 1)
            .toISOString()
            .split('T')[0];
    }

    if (preset !== 'custom') {
        filters.value.date_to = now.toISOString().split('T')[0];
        filters.value.page = 1;
        void loadReport();
    }
};

const loadCustomers = async (): Promise<void> => {
    const response = await CustomersApiService.getCustomers({}, 1, 300);
    customers.value = response.data.data ?? [];
};

const loadReport = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
        report.value = await ReportsApiService.getSalesByClient({
            ...filters.value,
            search: filters.value.search || undefined,
        });
        if (
            !rows.value.some(
                (row) => row.customer_id === expandedCustomerId.value,
            )
        ) {
            expandedCustomerId.value = null;
        }
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo cargar ventas por cliente.';
    } finally {
        loading.value = false;
    }
};

const exportReport = async (format: 'pdf' | 'excel'): Promise<void> => {
    exporting.value = format;

    try {
        const blob = await ReportsApiService.exportSalesByClient(
            format,
            filters.value,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ventas-por-cliente.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo exportar el reporte.';
    } finally {
        exporting.value = null;
    }
};

const changePage = (page: number): void => {
    filters.value.page = Math.max(1, Math.min(page, meta.value.last_page));
    void loadReport();
};

const toggleRow = (row: SalesByClientRow): void => {
    expandedCustomerId.value =
        expandedCustomerId.value === row.customer_id ? null : row.customer_id;
};

const applyFilters = (): void => {
    filters.value.page = 1;
    void loadReport();
};

let searchTimeout: ReturnType<typeof setTimeout> | undefined;
const onSearch = (): void => {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(applyFilters, 300);
};

onMounted(async () => {
    await initWarehouse();
    if (warehouses.value.length === 0) {
        await fetchWarehouses();
    }
    await loadCustomers();
    filters.value.warehouse_id = currentWarehouseId.value;
    await loadReport();
});
</script>

<template>
    <Head title="Ventas por Cliente" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <FinanceReportShell
                eyebrow="Reporte comercial"
                title="Ventas por Cliente"
                subtitle="Facturacion por cliente y mecanico asignado - Referencias cruzadas"
                :icon="Users"
            >
                <template #actions>
                    <button
                        type="button"
                        :disabled="Boolean(exporting) || loading"
                        class="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
                        @click="exportReport('pdf')"
                    >
                        <Download :size="16" />
                        PDF
                    </button>
                    <button
                        type="button"
                        :disabled="Boolean(exporting) || loading"
                        class="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
                        @click="exportReport('excel')"
                    >
                        <FileSpreadsheet :size="16" />
                        Excel
                    </button>
                </template>

                <div
                    class="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-6 dark:border-slate-800 dark:bg-slate-900/60"
                >
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Desde
                        </label>
                        <input
                            v-model="filters.date_from"
                            type="date"
                            class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            @change="applyFilters"
                        />
                    </div>
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Hasta
                        </label>
                        <input
                            v-model="filters.date_to"
                            type="date"
                            class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            @change="applyFilters"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Periodo
                        </label>
                        <div
                            class="grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                        >
                            <button
                                v-for="preset in datePresets"
                                :key="preset.key"
                                type="button"
                                class="px-3 py-2 text-xs font-medium"
                                :class="
                                    activePreset === preset.key
                                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                                "
                                @click="setPreset(preset.key)"
                            >
                                {{ preset.label }}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Cliente
                        </label>
                        <SearchableSelect
                            v-model="filters.customer_id"
                            :options="customerOptions"
                            placeholder="Todos"
                            @update:model-value="applyFilters"
                        />
                    </div>
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Sucursal
                        </label>
                        <SearchableSelect
                            v-model="filters.warehouse_id"
                            :options="warehouseOptions"
                            placeholder="Todas"
                            @update:model-value="applyFilters"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Mecanico / Referido
                        </label>
                        <SearchableSelect
                            v-model="filters.referred_by_customer_id"
                            :options="referrerOptions"
                            placeholder="Todos"
                            @update:model-value="applyFilters"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Buscar
                        </label>
                        <div class="relative">
                            <Search
                                class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                v-model="filters.search"
                                type="search"
                                placeholder="Cliente, factura o referido..."
                                class="h-10 w-full rounded-md border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                @input="onSearch"
                            />
                        </div>
                    </div>
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        >
                            Orden
                        </label>
                        <select
                            v-model="filters.sort_by"
                            class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            @change="applyFilters"
                        >
                            <option value="total_revenue">Total</option>
                            <option value="orders_count">Facturas</option>
                            <option value="total_paid">Cobrado</option>
                            <option value="pending_amount">Pendiente</option>
                            <option value="customer_name">Cliente</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button
                            type="button"
                            class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"
                            @click="applyFilters"
                        >
                            <Filter :size="16" />
                            Aplicar
                        </button>
                    </div>
                </div>
            </FinanceReportShell>

            <div
                v-if="error"
                class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
            >
                <AlertCircle :size="18" class="mt-0.5 shrink-0" />
                {{ error }}
            </div>

            <div class="grid gap-3 md:grid-cols-3">
                <FinanceKpiCard
                    label="Total Facturado"
                    :value="formatCurrency(summary.total_revenue)"
                    :detail="`${summary.orders_count} facturas`"
                    accent="sky"
                    :icon="Receipt"
                />
                <FinanceKpiCard
                    label="Ticket Promedio"
                    :value="formatCurrency(summary.average_ticket)"
                    :detail="`${summary.active_customers} clientes activos`"
                    accent="indigo"
                    :icon="Calculator"
                />
                <FinanceKpiCard
                    label="Clientes Activos"
                    :value="String(summary.active_customers)"
                    :detail="`Pendiente ${formatCurrency(summary.pending_amount)}`"
                    accent="emerald"
                    :icon="UserCheck"
                />
            </div>

            <section
                class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
                <header
                    class="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                >
                    <div>
                        <h2
                            class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                        >
                            Detalle por Cliente
                        </h2>
                        <p class="text-xs text-slate-500 dark:text-slate-400">
                            Mostrando {{ rows.length }} de
                            {{ meta.total }} clientes
                        </p>
                    </div>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                        @click="loadReport"
                    >
                        <RefreshCw
                            :size="16"
                            :class="{ 'animate-spin': loading }"
                        />
                        Actualizar
                    </button>
                </header>

                <div
                    v-if="loading && !report"
                    class="py-16 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                    <RefreshCw :size="20" class="mx-auto mb-3 animate-spin" />
                    Cargando ventas por cliente...
                </div>

                <div v-else class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-slate-200 dark:divide-slate-800"
                    >
                        <thead class="bg-slate-50 dark:bg-slate-900/80">
                            <tr>
                                <th
                                    class="w-12 px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    #
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Cliente
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Mecanico
                                </th>
                                <th
                                    class="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Facturas
                                </th>
                                <th
                                    class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Total
                                </th>
                                <th
                                    class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Ultimo Pago
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Metodo
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                >
                                    Estado
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-slate-100 dark:divide-slate-800"
                        >
                            <template
                                v-for="(row, index) in rows"
                                :key="row.customer_id"
                            >
                                <tr
                                    class="cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-500/5"
                                    :class="{
                                        'bg-indigo-50/70 dark:bg-indigo-500/10':
                                            expandedCustomerId ===
                                            row.customer_id,
                                    }"
                                    @click="toggleRow(row)"
                                >
                                    <td
                                        class="px-4 py-3 text-center text-xs text-slate-500 tabular-nums"
                                    >
                                        {{
                                            (meta.current_page - 1) *
                                                meta.per_page +
                                            index +
                                            1
                                        }}
                                    </td>
                                    <td class="px-4 py-3">
                                        <div class="flex items-center gap-3">
                                            <div
                                                class="flex size-9 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                                            >
                                                {{ row.initials }}
                                            </div>
                                            <div class="min-w-0">
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <Link
                                                        :href="`/customers/${row.customer_id}`"
                                                        class="truncate text-sm font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                                                        @click.stop
                                                    >
                                                        {{ row.customer_name }}
                                                    </Link>
                                                    <ChevronRight
                                                        :size="14"
                                                        class="text-slate-400 transition"
                                                        :class="{
                                                            'rotate-90':
                                                                expandedCustomerId ===
                                                                row.customer_id,
                                                        }"
                                                    />
                                                </div>
                                                <p
                                                    class="text-xs text-slate-500 dark:text-slate-400"
                                                >
                                                    {{
                                                        row.customer_code ||
                                                        'Sin codigo'
                                                    }}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td
                                        class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300"
                                    >
                                        <span
                                            v-if="row.referred_by_customer_name"
                                            class="inline-flex items-center gap-1"
                                        >
                                            <Wrench :size="13" />
                                            {{ row.referred_by_customer_name }}
                                        </span>
                                        <span v-else class="text-slate-400"
                                            >-</span
                                        >
                                    </td>
                                    <td
                                        class="px-4 py-3 text-center text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                                    >
                                        {{ row.orders_count }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right text-sm font-bold text-slate-950 tabular-nums dark:text-slate-50"
                                    >
                                        {{ formatCurrency(row.total_revenue) }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <div
                                            class="text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-300"
                                        >
                                            {{
                                                formatCurrency(
                                                    row.last_payment_amount,
                                                )
                                            }}
                                        </div>
                                        <div
                                            class="text-xs text-slate-500 dark:text-slate-400"
                                        >
                                            {{
                                                formatDate(
                                                    row.last_payment_date,
                                                )
                                            }}
                                        </div>
                                    </td>
                                    <td class="px-4 py-3">
                                        <span
                                            class="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                        >
                                            {{
                                                row.dominant_payment_method_label
                                            }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3">
                                        <span
                                            class="inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1"
                                            :class="statusClass(row.status)"
                                        >
                                            {{ row.status_label }}
                                        </span>
                                    </td>
                                </tr>
                                <tr
                                    v-if="
                                        expandedCustomerId === row.customer_id
                                    "
                                >
                                    <td
                                        colspan="8"
                                        class="bg-slate-50 p-0 dark:bg-slate-900/60"
                                    >
                                        <div
                                            class="grid gap-4 p-4 xl:grid-cols-2"
                                        >
                                            <section
                                                class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                                            >
                                                <header
                                                    class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100"
                                                >
                                                    Historial de Facturas
                                                </header>
                                                <div class="overflow-x-auto">
                                                    <table
                                                        class="min-w-full divide-y divide-slate-100 dark:divide-slate-800"
                                                    >
                                                        <tbody>
                                                            <tr
                                                                v-for="invoice in row
                                                                    .details
                                                                    .invoices"
                                                                :key="
                                                                    invoice.id
                                                                "
                                                            >
                                                                <td
                                                                    class="px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
                                                                >
                                                                    {{
                                                                        invoice.order_number
                                                                    }}
                                                                </td>
                                                                <td
                                                                    class="px-4 py-2 text-xs text-slate-500"
                                                                >
                                                                    {{
                                                                        formatDate(
                                                                            invoice.date,
                                                                        )
                                                                    }}
                                                                </td>
                                                                <td
                                                                    class="px-4 py-2 text-right text-xs text-slate-700 tabular-nums dark:text-slate-300"
                                                                >
                                                                    {{
                                                                        formatCurrency(
                                                                            invoice.total,
                                                                        )
                                                                    }}
                                                                </td>
                                                                <td
                                                                    class="px-4 py-2 text-right text-xs text-emerald-600 tabular-nums"
                                                                >
                                                                    {{
                                                                        formatCurrency(
                                                                            invoice.amount_paid,
                                                                        )
                                                                    }}
                                                                </td>
                                                                <td
                                                                    class="px-4 py-2 text-right text-xs text-amber-600 tabular-nums"
                                                                >
                                                                    {{
                                                                        formatCurrency(
                                                                            invoice.pending_amount,
                                                                        )
                                                                    }}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </section>

                                            <section
                                                class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                                            >
                                                <header
                                                    class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100"
                                                >
                                                    Items Comprados
                                                </header>
                                                <div
                                                    class="grid gap-2 p-4 sm:grid-cols-2"
                                                >
                                                    <div
                                                        v-for="item in row
                                                            .details.items"
                                                        :key="`${item.product_id}-${item.variant_id}-${item.name}`"
                                                        class="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70"
                                                    >
                                                        <Package
                                                            :size="16"
                                                            class="shrink-0 text-indigo-500"
                                                        />
                                                        <div
                                                            class="min-w-0 flex-1"
                                                        >
                                                            <p
                                                                class="truncate text-xs font-semibold text-slate-900 dark:text-slate-100"
                                                            >
                                                                {{ item.name }}
                                                            </p>
                                                            <p
                                                                class="text-[11px] text-slate-500"
                                                            >
                                                                {{
                                                                    item.quantity
                                                                }}
                                                                uds -
                                                                {{
                                                                    item.sku ||
                                                                    'Sin SKU'
                                                                }}
                                                            </p>
                                                        </div>
                                                        <span
                                                            class="text-xs font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                                        >
                                                            {{
                                                                formatCurrency(
                                                                    item.total,
                                                                )
                                                            }}
                                                        </span>
                                                    </div>
                                                    <p
                                                        v-if="
                                                            row.details.items
                                                                .length === 0
                                                        "
                                                        class="text-sm text-slate-500"
                                                    >
                                                        Sin items para este
                                                        periodo.
                                                    </p>
                                                </div>
                                            </section>

                                            <section class="xl:col-span-2">
                                                <div
                                                    class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    <Car :size="14" />
                                                    Vehiculos del Cliente
                                                </div>
                                                <div
                                                    class="flex gap-3 overflow-x-auto pb-1"
                                                >
                                                    <div
                                                        v-for="vehicle in row
                                                            .details.vehicles"
                                                        :key="vehicle.id"
                                                        class="min-w-56 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                                                    >
                                                        <p
                                                            class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                        >
                                                            {{ vehicle.name }}
                                                        </p>
                                                        <p
                                                            class="mt-1 font-mono text-xs text-slate-500"
                                                        >
                                                            VIN:
                                                            {{
                                                                vehicle.vin ||
                                                                '-'
                                                            }}
                                                        </p>
                                                    </div>
                                                    <p
                                                        v-if="
                                                            row.details.vehicles
                                                                .length === 0
                                                        "
                                                        class="text-sm text-slate-500"
                                                    >
                                                        Sin vehiculos
                                                        registrados.
                                                    </p>
                                                </div>
                                            </section>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                            <tr v-if="rows.length === 0">
                                <td
                                    colspan="8"
                                    class="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                                >
                                    No hay ventas por cliente para los filtros
                                    seleccionados.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <footer
                    class="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                >
                    <span class="text-xs text-slate-500 dark:text-slate-400">
                        Pagina {{ meta.current_page }} de {{ meta.last_page }}
                    </span>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            :disabled="meta.current_page <= 1"
                            class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                            @click="changePage(meta.current_page - 1)"
                        >
                            <ChevronLeft :size="15" />
                        </button>
                        <button
                            type="button"
                            :disabled="meta.current_page >= meta.last_page"
                            class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                            @click="changePage(meta.current_page + 1)"
                        >
                            <ChevronRight :size="15" />
                        </button>
                    </div>
                </footer>
            </section>

            <div class="grid gap-4 xl:grid-cols-[360px_1fr]">
                <section class="space-y-3">
                    <div
                        class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
                    >
                        <Wrench :size="16" class="text-violet-500" />
                        Resumen por Mecanico
                    </div>
                    <article
                        v-for="(referrer, index) in report?.by_referrer ?? []"
                        :key="referrer.customer_id ?? referrer.customer_name"
                        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div
                                    class="flex size-9 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-xs font-bold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
                                >
                                    {{ referrer.initials }}
                                </div>
                                <div>
                                    <p
                                        class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                    >
                                        {{ referrer.customer_name }}
                                    </p>
                                    <p class="text-xs text-slate-500">
                                        {{ referrer.clients_count }} clientes -
                                        #{{ index + 1 }} ranking
                                    </p>
                                </div>
                            </div>
                            <span
                                v-if="index === 0"
                                class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                            >
                                <Award :size="11" />
                                TOP
                            </span>
                        </div>
                        <div class="mt-4 flex items-end justify-between gap-3">
                            <div>
                                <p class="text-[11px] text-slate-500">
                                    Facturado
                                </p>
                                <p
                                    class="text-lg font-bold text-slate-950 tabular-nums dark:text-slate-50"
                                >
                                    {{ formatCurrency(referrer.total_revenue) }}
                                </p>
                            </div>
                            <div class="text-right">
                                <p class="text-[11px] text-slate-500">
                                    Comision ref.
                                </p>
                                <p
                                    class="text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-300"
                                >
                                    {{ formatCurrency(referrer.commission) }}
                                </p>
                            </div>
                        </div>
                    </article>
                    <div
                        v-if="(report?.by_referrer ?? []).length === 0"
                        class="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950"
                    >
                        Sin ventas con mecanico/referido.
                    </div>
                </section>

                <section
                    class="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                    <header
                        class="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
                    >
                        <BarChart3 :size="17" class="text-indigo-500" />
                        <h3
                            class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                        >
                            Top 10 Clientes por Facturacion
                        </h3>
                    </header>
                    <div class="h-80 p-4">
                        <Bar :data="chartData" :options="chartOptions" />
                    </div>
                </section>
            </div>
        </div>
    </AppLayout>
</template>
