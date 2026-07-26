<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { Plus, RefreshCw } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import PageShell from '@/components/PageShell.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/AppLayout.vue';
import { financialTransfersService } from '@/services/financial-transfers';
import type { BreadcrumbItem } from '@/types';
import type { FinancialTransfer } from '@/types/financial-transfer';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Transferencias' }];
const transfers = ref<FinancialTransfer[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadTransfers(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        const response = await financialTransfersService.list();
        transfers.value = response.data;
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'No se pudieron cargar las transferencias.';
    } finally {
        loading.value = false;
    }
}

onMounted(loadTransfers);
</script>

<template>
    <Head title="Transferencias entre cuentas" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <PageShell
            title="Transferencias entre cuentas"
            description="Historial inmutable de movimientos entre cajas y cuentas financieras."
            constrained
            content-class="max-w-7xl"
        >
            <template #actions>
                <Button
                    variant="outline"
                    :disabled="loading"
                    @click="loadTransfers"
                >
                    <RefreshCw
                        class="size-4"
                        :class="{ 'animate-spin': loading }"
                    />
                    Actualizar
                </Button>
                <Button as-child>
                    <Link href="/finance/transfers/create">
                        <Plus class="size-4" />
                        Nueva transferencia
                    </Link>
                </Button>
            </template>

            <div
                v-if="error"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
                {{ error }}
            </div>
            <div class="overflow-hidden rounded-xl border bg-card">
                <div
                    v-if="loading && transfers.length === 0"
                    class="p-10 text-center text-sm text-muted-foreground"
                >
                    Cargando transferencias…
                </div>
                <div
                    v-else-if="transfers.length === 0"
                    class="p-10 text-center"
                >
                    <p class="font-medium">Todavía no hay transferencias</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                        La primera operación aparecerá aquí con su folio y
                        trazabilidad.
                    </p>
                </div>
                <div v-else class="overflow-x-auto">
                    <table class="w-full min-w-[760px] text-sm">
                        <thead
                            class="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase"
                        >
                            <tr>
                                <th class="px-4 py-3">Folio / fecha</th>
                                <th class="px-4 py-3">Desde</th>
                                <th class="px-4 py-3">Hacia</th>
                                <th class="px-4 py-3">Estado</th>
                                <th class="px-4 py-3 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            <tr
                                v-for="transfer in transfers"
                                :key="transfer.id"
                                class="hover:bg-muted/30"
                            >
                                <td class="px-4 py-3">
                                    <Link
                                        :href="`/finance/transfers/${transfer.id}`"
                                        class="font-semibold text-primary hover:underline"
                                    >
                                        {{ transfer.folio }}
                                    </Link>
                                    <p
                                        class="mt-0.5 text-xs text-muted-foreground"
                                    >
                                        {{
                                            formatReportDateTime(
                                                transfer.business_datetime,
                                            )
                                        }}
                                    </p>
                                </td>
                                <td class="px-4 py-3">
                                    {{ transfer.from_account.name }}
                                </td>
                                <td class="px-4 py-3">
                                    {{ transfer.to_account.name }}
                                </td>
                                <td class="px-4 py-3">
                                    <Badge
                                        :variant="
                                            transfer.status === 'completed'
                                                ? 'default'
                                                : 'secondary'
                                        "
                                    >
                                        {{
                                            transfer.status === 'completed'
                                                ? 'Completada'
                                                : 'Reversada'
                                        }}
                                    </Badge>
                                </td>
                                <td
                                    class="px-4 py-3 text-right font-semibold tabular-nums"
                                >
                                    {{ formatCurrency(transfer.amount) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </PageShell>
    </AppLayout>
</template>
