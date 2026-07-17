<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { RefreshCw } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import type { BreadcrumbItem } from '@/types';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';

interface RecentRecord {
    type: string;
    document: string;
    description: string;
    amount: number;
    occurred_at: string | null;
    href: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Registros', href: '/records' },
];
const loading = ref(false);
const error = ref<string | null>(null);
const rows = ref<RecentRecord[]>([]);

async function loadRecent() {
    loading.value = true;
    error.value = null;

    try {
        const [sales, movements, expenses] = await Promise.all([
            apiClient.get('/sales-orders', { params: { per_page: 5 } }),
            apiClient.get('/inventory-movements', { params: { per_page: 5 } }),
            apiClient.get('/operational-expenses', { params: { per_page: 5 } }),
        ]);

        rows.value = [
            ...(sales.data.data ?? []).map((order: any) => ({
                type: 'Venta',
                document: order.order_number,
                description: order.customer?.name || 'Público general',
                amount: Number(order.total ?? 0),
                occurred_at: order.created_at,
                href: `/sales-orders/${order.id}`,
            })),
            ...(expenses.data.data ?? []).map((expense: any) => ({
                type: 'Gasto',
                document: `G-${expense.id}`,
                description: expense.party?.name || expense.category_label,
                amount: -Number(expense.amount ?? 0),
                occurred_at: expense.created_at,
                href: '/operational-expenses',
            })),
            ...(movements.data.data ?? []).map((movement: any) => ({
                type: 'Inventario',
                document: `${movement.reference_type || 'MOV'}-${movement.reference_id || movement.id}`,
                description: movement.product?.name || 'Artículo',
                amount: 0,
                occurred_at: movement.created_at,
                href: `/inventory-movements/${movement.id}`,
            })),
        ]
            .sort(
                (a, b) =>
                    new Date(b.occurred_at || 0).getTime() -
                    new Date(a.occurred_at || 0).getTime(),
            )
            .slice(0, 12);
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo cargar la actividad reciente.';
    } finally {
        loading.value = false;
    }
}

onMounted(loadRecent);
</script>

<template>
    <Head title="Registros" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="records">
            <template #actions>
                <Button
                    variant="outline"
                    size="icon"
                    title="Actualizar"
                    :disabled="loading"
                    @click="loadRecent"
                >
                    <RefreshCw
                        class="size-4"
                        :class="{ 'animate-spin': loading }"
                    />
                    <span class="sr-only">Actualizar registros</span>
                </Button>
            </template>

            <template #overview>
                <Alert v-if="error">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>

                <section class="overflow-hidden rounded-lg border bg-card">
                    <div class="border-b px-4 py-3">
                        <h2 class="text-sm font-semibold">
                            Actividad reciente
                        </h2>
                    </div>
                    <div v-if="rows.length" class="divide-y">
                        <Link
                            v-for="row in rows"
                            :key="`${row.type}-${row.document}`"
                            :href="row.href"
                            class="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 md:grid-cols-[100px_1fr_1fr_auto]"
                        >
                            <span
                                class="text-xs font-semibold text-muted-foreground uppercase"
                            >
                                {{ row.type }}
                            </span>
                            <div>
                                <p class="font-mono font-semibold">
                                    {{ row.document }}
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    {{ formatReportDateTime(row.occurred_at) }}
                                </p>
                            </div>
                            <span class="truncate">{{ row.description }}</span>
                            <strong v-if="row.amount" class="font-mono">
                                {{ formatCurrency(row.amount) }}
                            </strong>
                            <span v-else>—</span>
                        </Link>
                    </div>
                    <p
                        v-else
                        class="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                        Sin actividad reciente.
                    </p>
                </section>
            </template>
        </ModuleHubLayout>
    </AppLayout>
</template>
