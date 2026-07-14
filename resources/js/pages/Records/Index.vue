<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { RefreshCw } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import NavigationCenter from '@/components/NavigationCenter.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { recordCenterGroups } from '@/navigation/centers';
import apiClient from '@/services/api/client';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';

defineOptions({ layout: AppLayout });

const loading = ref(false);
const error = ref<string | null>(null);
const rows = ref<Array<{ type: string; document: string; description: string; amount: number; occurred_at: string | null; href: string }>>([]);

async function loadRecent() {
    loading.value = true;
    error.value = null;
    try {
        const sales = await apiClient.get('/sales-orders', { params: { per_page: 5 } });
        const movements = await apiClient.get('/inventory-movements', { params: { per_page: 5 } });
        const expenses = await apiClient.get('/operational-expenses', { params: { per_page: 5 } });
        rows.value = [
            ...(sales.data.data ?? []).map((order: any) => ({ type: 'Venta', document: order.order_number, description: order.customer?.name || 'Publico general', amount: Number(order.total ?? 0), occurred_at: order.created_at, href: `/sales-orders/${order.id}` })),
            ...(expenses.data.data ?? []).map((expense: any) => ({ type: 'Gasto', document: `G-${expense.id}`, description: expense.party?.name || expense.category_label, amount: -Number(expense.amount ?? 0), occurred_at: expense.created_at, href: '/operational-expenses' })),
            ...(movements.data.data ?? []).map((movement: any) => ({ type: 'Inventario', document: `${movement.reference_type || 'MOV'}-${movement.reference_id || movement.id}`, description: movement.product?.name || 'Articulo', amount: 0, occurred_at: movement.created_at, href: `/inventory-movements/${movement.id}` })),
        ].sort((a, b) => new Date(b.occurred_at || 0).getTime() - new Date(a.occurred_at || 0).getTime()).slice(0, 12);
    } catch (exception: any) {
        error.value = exception.response?.data?.message || 'No se pudo cargar la actividad reciente.';
    } finally {
        loading.value = false;
    }
}

onMounted(loadRecent);
</script>

<template>
    <Head title="Registros" />
    <div class="space-y-5">
        <header class="flex items-center justify-between gap-3">
            <div>
            <h1 class="text-2xl font-bold">Registros</h1>
            <p class="mt-1 text-sm text-muted-foreground">Acceso trazable a los movimientos reales del sistema.</p>
            </div>
            <button type="button" class="rounded-md border p-2" title="Actualizar" :disabled="loading" @click="loadRecent"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" /></button>
        </header>
        <p v-if="error" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
        <section class="overflow-hidden rounded-md border bg-card">
            <div class="border-b px-4 py-3"><h2 class="text-sm font-semibold">Actividad reciente</h2></div>
            <div v-if="rows.length" class="divide-y"><a v-for="row in rows" :key="`${row.type}-${row.document}`" :href="row.href" class="grid grid-cols-[100px_1fr_1fr_auto] gap-3 px-4 py-2 text-sm hover:bg-muted/40"><span class="text-xs font-semibold uppercase text-muted-foreground">{{ row.type }}</span><div><p class="font-mono font-semibold">{{ row.document }}</p><p class="text-xs text-muted-foreground">{{ formatReportDateTime(row.occurred_at) }}</p></div><span class="truncate">{{ row.description }}</span><strong v-if="row.amount" class="font-mono">{{ formatCurrency(row.amount) }}</strong><span v-else>-</span></a></div>
            <p v-else class="px-4 py-6 text-center text-sm text-muted-foreground">Sin actividad reciente.</p>
        </section>
        <NavigationCenter :groups="recordCenterGroups" />
    </div>
</template>
