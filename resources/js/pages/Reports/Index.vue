<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { RefreshCw } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import ModuleMetric from '@/components/modules/ModuleMetric.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import type { BreadcrumbItem } from '@/types';
import {
    formatCurrency,
    formatDateInputValue,
    formatReportDateTime,
} from '@/utils/formatters';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Reportes', href: '/reports' }];
const today = formatDateInputValue();
const dateFrom = ref(today);
const dateTo = ref(today);
const loading = ref(false);
const error = ref<string | null>(null);
const cards = ref([
    { label: 'Venta neta', value: 0 },
    { label: 'Compras recibidas', value: 0 },
    { label: 'Gastos', value: 0 },
    { label: 'Notas de crédito', value: 0, count: true },
]);
const recent = ref<
    Array<{
        document: string;
        party: string;
        amount: number;
        occurred_at: string | null;
    }>
>([]);

async function loadOverview() {
    loading.value = true;
    error.value = null;
    const params = {
        date_from: dateFrom.value,
        date_to: dateTo.value,
        per_page: 10,
    };

    try {
        const [sales, purchases, expenses, notes] = await Promise.all([
            apiClient.get('/reports/sales-by-product', { params }),
            apiClient.get('/reports/purchases-by-supplier', { params }),
            apiClient.get('/operational-expenses', { params }),
            apiClient.get('/reports/credit-notes', { params }),
        ]);

        cards.value = [
            {
                label: 'Venta neta',
                value: Number(sales.data.summary?.net_sales ?? 0),
            },
            {
                label: 'Compras recibidas',
                value: Number(purchases.data.summary?.purchases_total ?? 0),
            },
            {
                label: 'Gastos',
                value: Number(expenses.data.summary?.total_amount ?? 0),
            },
            {
                label: 'Notas de crédito',
                value: Number(notes.data.summary?.count ?? 0),
                count: true,
            },
        ];
        recent.value = (notes.data.data ?? []).slice(0, 6).map((note: any) => ({
            document: note.credit_note_number,
            party: note.customer_name || 'Sin cliente',
            amount: Number(note.total_amount ?? 0),
            occurred_at: note.issued_at ?? null,
        }));
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo cargar el resumen de reportes.';
    } finally {
        loading.value = false;
    }
}

onMounted(loadOverview);
</script>

<template>
    <Head title="Reportes" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="reports">
            <template #overview>
                <form
                    class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
                    @submit.prevent="loadOverview"
                >
                    <label class="text-xs font-semibold text-muted-foreground">
                        Desde
                        <input
                            v-model="dateFrom"
                            type="date"
                            class="mt-1 block h-9 rounded-md border bg-background px-3 text-sm font-normal text-foreground"
                        />
                    </label>
                    <label class="text-xs font-semibold text-muted-foreground">
                        Hasta
                        <input
                            v-model="dateTo"
                            type="date"
                            class="mt-1 block h-9 rounded-md border bg-background px-3 text-sm font-normal text-foreground"
                        />
                    </label>
                    <Button type="submit" :disabled="loading">
                        <RefreshCw
                            class="size-4"
                            :class="{ 'animate-spin': loading }"
                        />
                        Actualizar
                    </Button>
                </form>

                <Alert v-if="error">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>

                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ModuleMetric
                        v-for="card in cards"
                        :key="card.label"
                        :label="card.label"
                        :value="
                            card.count ? card.value : formatCurrency(card.value)
                        "
                    />
                </div>

                <section class="overflow-hidden rounded-lg border bg-card">
                    <div class="border-b px-4 py-3">
                        <h2 class="text-sm font-semibold">
                            Notas de crédito recientes
                        </h2>
                    </div>
                    <div v-if="recent.length" class="divide-y">
                        <Link
                            v-for="row in recent"
                            :key="row.document"
                            href="/reports/credit-notes"
                            class="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_1fr_auto]"
                        >
                            <div>
                                <p class="font-mono font-semibold">
                                    {{ row.document }}
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    {{ formatReportDateTime(row.occurred_at) }}
                                </p>
                            </div>
                            <span class="truncate">{{ row.party }}</span>
                            <strong class="font-mono">
                                {{ formatCurrency(row.amount) }}
                            </strong>
                        </Link>
                    </div>
                    <p
                        v-else
                        class="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                        Sin movimientos en el rango.
                    </p>
                </section>
            </template>
        </ModuleHubLayout>
    </AppLayout>
</template>
