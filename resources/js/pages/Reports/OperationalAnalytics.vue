<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { RefreshCw, Search } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import {
    formatCurrency,
    formatDateInputValue,
    formatReportDateTime,
} from '@/utils/formatters';

type ReportKey = 'sales-by-product' | 'purchases-by-supplier' | 'credit-notes' | 'valued-inventory';
type Column = { key: string; label: string; type?: 'money' | 'number' | 'datetime' };

const props = defineProps<{ reportKey: ReportKey }>();
defineOptions({ layout: AppLayout });

const configs: Record<ReportKey, { title: string; description: string; columns: Column[]; totalKeys: string[] }> = {
    'sales-by-product': {
        title: 'Ventas por producto',
        description: 'Unidades, devoluciones, venta neta, costo y utilidad por articulo.',
        columns: [
            { key: 'sku', label: 'SKU' }, { key: 'product_name', label: 'Producto' },
            { key: 'quantity_sold', label: 'Vendido', type: 'number' }, { key: 'quantity_returned', label: 'Devuelto', type: 'number' },
            { key: 'net_sales', label: 'Venta neta', type: 'money' }, { key: 'cost', label: 'Costo', type: 'money' }, { key: 'profit', label: 'Utilidad', type: 'money' },
        ],
        totalKeys: ['net_sales', 'cost', 'profit'],
    },
    'purchases-by-supplier': {
        title: 'Compras por proveedor',
        description: 'Ordenes recibidas, total comprado, pagado y saldo pendiente.',
        columns: [
            { key: 'supplier_name', label: 'Proveedor' }, { key: 'orders_count', label: 'Ordenes', type: 'number' },
            { key: 'purchases_total', label: 'Compras', type: 'money' }, { key: 'paid_total', label: 'Pagado', type: 'money' }, { key: 'payable_total', label: 'CxP', type: 'money' },
        ],
        totalKeys: ['purchases_total', 'paid_total', 'payable_total'],
    },
    'credit-notes': {
        title: 'Notas de credito',
        description: 'Resoluciones de devolucion, CxC, reembolsos y saldos a favor.',
        columns: [
            { key: 'credit_note_number', label: 'Nota' }, { key: 'order_number', label: 'Factura' }, { key: 'customer_name', label: 'Cliente' },
            { key: 'issued_at', label: 'Fecha y hora', type: 'datetime' }, { key: 'receivable_amount', label: 'CxC', type: 'money' },
            { key: 'refund_amount', label: 'Reembolso', type: 'money' }, { key: 'store_credit_amount', label: 'Saldo a favor', type: 'money' }, { key: 'total_amount', label: 'Total', type: 'money' },
        ],
        totalKeys: ['total_amount', 'receivable_amount', 'refund_amount', 'store_credit_amount'],
    },
    'valued-inventory': {
        title: 'Inventario valorizado',
        description: 'Existencia disponible y valor real de los lotes FIFO abiertos.',
        columns: [
            { key: 'sku', label: 'SKU' }, { key: 'product_name', label: 'Producto' }, { key: 'warehouse_name', label: 'Almacen' },
            { key: 'quantity_available', label: 'Cantidad', type: 'number' }, { key: 'average_cost', label: 'Costo promedio', type: 'money' }, { key: 'inventory_value', label: 'Valor', type: 'money' },
        ],
        totalKeys: ['inventory_value'],
    },
};

const config = computed(() => configs[props.reportKey]);
const today = formatDateInputValue();
const filters = ref({ date_from: today, date_to: today, search: '', per_page: 25, page: 1 });
const rows = ref<Record<string, unknown>[]>([]);
const summary = ref<Record<string, number>>({});
const meta = ref({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
const loading = ref(false);
const error = ref<string | null>(null);

function display(row: Record<string, unknown>, column: Column): string {
    const value = row[column.key];
    if (column.type === 'money') return formatCurrency(Number(value ?? 0));
    if (column.type === 'datetime') return formatReportDateTime(String(value ?? ''));
    if (column.type === 'number') return Number(value ?? 0).toLocaleString('es-PA');
    return String(value ?? '-');
}

async function load(page = 1) {
    loading.value = true;
    error.value = null;
    filters.value.page = page;
    try {
        const params: Record<string, unknown> = { ...filters.value };
        if (props.reportKey === 'valued-inventory') delete params.date_from;
        const response = await apiClient.get(`/reports/${props.reportKey}`, { params });
        rows.value = response.data.data ?? [];
        summary.value = response.data.summary ?? {};
        meta.value = response.data.meta ?? meta.value;
    } catch (exception: any) {
        error.value = exception.response?.data?.message || 'No se pudo cargar el reporte.';
    } finally {
        loading.value = false;
    }
}

onMounted(() => load());
</script>

<template>
    <Head :title="config.title" />
    <div class="space-y-4">
        <header><h1 class="text-2xl font-bold">{{ config.title }}</h1><p class="mt-1 text-sm text-muted-foreground">{{ config.description }}</p></header>
        <form class="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-[1fr_150px_150px_110px_auto]" @submit.prevent="load(1)">
            <label class="relative"><Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input v-model="filters.search" type="search" placeholder="Buscar" class="h-10 w-full rounded-md border bg-background pr-3 pl-9 text-sm" /></label>
            <input v-if="reportKey !== 'valued-inventory'" v-model="filters.date_from" type="date" class="h-10 rounded-md border bg-background px-3 text-sm" />
            <input v-model="filters.date_to" type="date" class="h-10 rounded-md border bg-background px-3 text-sm" />
            <select v-model.number="filters.per_page" class="h-10 rounded-md border bg-background px-2 text-sm" @change="load(1)"><option v-for="size in [10, 25, 50, 100]" :key="size" :value="size">{{ size }} filas</option></select>
            <button type="submit" class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-semibold text-white" :disabled="loading"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" /> Actualizar</button>
        </form>
        <div v-if="error" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div v-for="key in config.totalKeys" :key="key" class="rounded-md border bg-card p-3"><p class="text-xs font-semibold uppercase text-muted-foreground">{{ config.columns.find((column) => column.key === key)?.label ?? key }}</p><p class="mt-1 font-mono text-lg font-bold">{{ formatCurrency(summary[key] ?? 0) }}</p></div></div>
        <div class="overflow-hidden rounded-md border bg-card">
            <div class="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground"><span>{{ meta.total }} resultados</span><span>Pagina {{ meta.current_page }} de {{ meta.last_page }}</span></div>
            <div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th v-for="column in config.columns" :key="column.key" class="px-4 py-2 text-left" :class="{ 'text-right': column.type === 'money' || column.type === 'number' }">{{ column.label }}</th></tr></thead><tbody class="divide-y"><tr v-for="(row, index) in rows" :key="String(row.id ?? `${meta.current_page}-${index}`)"><td v-for="column in config.columns" :key="column.key" class="px-4 py-2" :class="{ 'text-right font-mono': column.type === 'money' || column.type === 'number' }">{{ display(row, column) }}</td></tr><tr v-if="!loading && !rows.length"><td :colspan="config.columns.length" class="px-4 py-10 text-center text-muted-foreground">No hay datos para los filtros seleccionados.</td></tr></tbody></table></div>
            <div class="flex items-center justify-between border-t px-4 py-3"><button type="button" class="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">Anterior</button><span class="text-xs text-muted-foreground">{{ meta.total }} resultados</span><button type="button" class="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40" :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Siguiente</button></div>
        </div>
    </div>
</template>
