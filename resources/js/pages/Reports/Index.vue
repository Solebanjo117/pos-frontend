<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { RefreshCw } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import NavigationCenter from '@/components/NavigationCenter.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { reportCenterGroups } from '@/navigation/centers';
import apiClient from '@/services/api/client';
import {
    formatCurrency,
    formatDateInputValue,
    formatReportDateTime,
} from '@/utils/formatters';

defineOptions({ layout: AppLayout });

const today = formatDateInputValue();
const dateFrom = ref(today);
const dateTo = ref(today);
const loading = ref(false);
const error = ref<string | null>(null);
const cards = ref([
    { label: 'Venta neta', value: 0 },
    { label: 'Compras recibidas', value: 0 },
    { label: 'Gastos', value: 0 },
    { label: 'Notas de credito', value: 0, count: true },
]);
const recent = ref<Array<{ document: string; party: string; amount: number; occurred_at: string | null }>>([]);

async function loadOverview() {
    loading.value = true;
    error.value = null;
    const params = { date_from: dateFrom.value, date_to: dateTo.value, per_page: 10 };
    try {
        const sales = await apiClient.get('/reports/sales-by-product', { params });
        const purchases = await apiClient.get('/reports/purchases-by-supplier', { params });
        const expenses = await apiClient.get('/operational-expenses', { params });
        const notes = await apiClient.get('/reports/credit-notes', { params });
        cards.value = [
            { label: 'Venta neta', value: Number(sales.data.summary?.net_sales ?? 0) },
            { label: 'Compras recibidas', value: Number(purchases.data.summary?.purchases_total ?? 0) },
            { label: 'Gastos', value: Number(expenses.data.summary?.total_amount ?? 0) },
            { label: 'Notas de credito', value: Number(notes.data.summary?.count ?? 0), count: true },
        ];
        recent.value = (notes.data.data ?? []).slice(0, 6).map((note: any) => ({
            document: note.credit_note_number,
            party: note.customer_name || 'Sin cliente',
            amount: Number(note.total_amount ?? 0),
            occurred_at: note.issued_at ?? null,
        }));
    } catch (exception: any) {
        error.value = exception.response?.data?.message || 'No se pudo cargar el resumen de reportes.';
    } finally {
        loading.value = false;
    }
}

onMounted(loadOverview);
</script>

<template>
    <Head title="Centro de reportes" />
    <div class="space-y-5">
        <header>
            <h1 class="text-2xl font-bold">Centro de reportes</h1>
            <p class="mt-1 text-sm text-muted-foreground">Reportes disponibles, agrupados por operación.</p>
        </header>
        <form class="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3" @submit.prevent="loadOverview">
            <label class="text-xs font-semibold text-muted-foreground">Desde<input v-model="dateFrom" type="date" class="mt-1 block h-9 rounded-md border bg-background px-2 text-sm font-normal text-foreground" /></label>
            <label class="text-xs font-semibold text-muted-foreground">Hasta<input v-model="dateTo" type="date" class="mt-1 block h-9 rounded-md border bg-background px-2 text-sm font-normal text-foreground" /></label>
            <button type="submit" class="inline-flex h-9 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-semibold text-white" :disabled="loading"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />Actualizar</button>
        </form>
        <p v-if="error" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div v-for="card in cards" :key="card.label" class="rounded-md border bg-card p-3"><p class="text-xs font-semibold uppercase text-muted-foreground">{{ card.label }}</p><p class="mt-1 font-mono text-xl font-bold">{{ card.count ? card.value : formatCurrency(card.value) }}</p></div></div>
        <section class="overflow-hidden rounded-md border bg-card">
            <div class="border-b px-4 py-3"><h2 class="text-sm font-semibold">Notas de credito recientes</h2></div>
            <div v-if="recent.length" class="divide-y"><a v-for="row in recent" :key="row.document" href="/reports/credit-notes" class="grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 text-sm hover:bg-muted/40"><div><p class="font-mono font-semibold">{{ row.document }}</p><p class="text-xs text-muted-foreground">{{ formatReportDateTime(row.occurred_at) }}</p></div><span class="truncate">{{ row.party }}</span><strong class="font-mono">{{ formatCurrency(row.amount) }}</strong></a></div>
            <p v-else class="px-4 py-6 text-center text-sm text-muted-foreground">Sin movimientos en el rango.</p>
        </section>
        <NavigationCenter :groups="reportCenterGroups" />
    </div>
</template>
