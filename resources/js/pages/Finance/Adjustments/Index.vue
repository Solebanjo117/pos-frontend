<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import { Eye, Plus, RefreshCw, Search } from 'lucide-vue-next';
import { nextTick, onMounted, ref } from 'vue';
import FinanceAdjustmentModal from '@/components/Finance/FinanceAdjustmentModal.vue';
import PageShell from '@/components/PageShell.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/AppLayout.vue';
import { financialAdjustmentsService } from '@/services/financial-adjustments';
import type { BreadcrumbItem } from '@/types';
import type { FinancialAdjustment } from '@/types/financial-adjustment';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Finanzas', href: '/finance' },
    { title: 'Contabilidad' },
    { title: 'Historial de ajustes' },
];
const rows = ref<FinancialAdjustment[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const modalOpen = ref(false);
const initialType = ref<FinancialAdjustment['type'] | null>(null);
const initialCustomerId = ref<number | null>(null);
const page = ref(1);
const lastPage = ref(1);
const total = ref(0);
const filters = ref({
    search: '',
    type: '',
    status: '',
    date_from: '',
    date_to: '',
});

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        const response = await financialAdjustmentsService.list({
            ...filters.value,
            page: page.value,
            per_page: 25,
        });
        rows.value = response.data;
        lastPage.value = response.meta.last_page;
        total.value = response.meta.total;
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'No se pudo cargar el historial de ajustes.';
    } finally {
        loading.value = false;
    }
}
function applyFilters(): void {
    page.value = 1;
    void load();
}
function changePage(next: number): void {
    page.value = next;
    void load();
}
function accountName(row: FinancialAdjustment): string {
    return (
        row.financial_account?.name ||
        row.affected_ledger_account?.name ||
        (row.pos_session
            ? `Caja #${row.pos_session.id}`
            : row.product?.name || 'Registro heredado')
    );
}
function submitted(adjustment: FinancialAdjustment): void {
    router.visit(`/finance/accounting/adjustments/${adjustment.id}`);
}
onMounted(async () => {
    const params = new URLSearchParams(window.location.search);
    const requestedType = params.get('type');
    const allowedTypes: FinancialAdjustment['type'][] = [
        'cash',
        'bank',
        'inventory',
        'sales',
        'purchases',
        'expenses',
        'investment',
        'accounts_receivable',
        'accounts_payable',
        'manual_correction',
    ];
    if (
        requestedType &&
        allowedTypes.includes(requestedType as FinancialAdjustment['type'])
    ) {
        initialType.value = requestedType as FinancialAdjustment['type'];
    }
    const customerId = Number(params.get('customer_id'));
    initialCustomerId.value =
        Number.isInteger(customerId) && customerId > 0 ? customerId : null;
    if (params.get('create') === '1') {
        await nextTick();
        modalOpen.value = true;
    }
    void load();
});
</script>

<template>
    <Head title="Historial de ajustes" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <PageShell
            title="Historial de ajustes"
            description="Correcciones financieras inmutables con contrapartida, asiento y trazabilidad."
            constrained
            content-class="max-w-[1600px]"
        >
            <template #actions>
                <Button variant="outline" :disabled="loading" @click="load"
                    ><RefreshCw
                        class="size-4"
                        :class="{ 'animate-spin': loading }"
                    />Actualizar</Button
                >
                <Button @click="modalOpen = true"
                    ><Plus class="size-4" />Nuevo ajuste</Button
                >
            </template>

            <div
                v-if="error"
                role="alert"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
                {{ error }}
            </div>
            <form
                class="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)_auto]"
                @submit.prevent="applyFilters"
            >
                <Input
                    v-model="filters.search"
                    placeholder="Folio, motivo o referencia"
                    aria-label="Buscar ajustes"
                />
                <select
                    v-model="filters.type"
                    class="h-10 rounded-md border bg-background px-3 text-sm"
                    aria-label="Tipo de ajuste"
                >
                    <option value="">Todos los tipos</option>
                    <option value="cash">Efectivo</option>
                    <option value="bank">Banco</option>
                    <option value="inventory">Inventario</option>
                    <option value="sales">Ventas</option>
                    <option value="purchases">Compras</option>
                    <option value="expenses">Gastos</option>
                    <option value="investment">Inversión</option>
                    <option value="accounts_receivable">
                        Cuentas por cobrar
                    </option>
                    <option value="accounts_payable">Cuentas por pagar</option>
                    <option value="manual_correction">Manual</option>
                </select>
                <select
                    v-model="filters.status"
                    class="h-10 rounded-md border bg-background px-3 text-sm"
                    aria-label="Estado"
                >
                    <option value="">Todos los estados</option>
                    <option value="completed">Completado</option>
                    <option value="reversed">Reversado</option>
                </select>
                <Input
                    v-model="filters.date_from"
                    type="date"
                    aria-label="Fecha desde"
                />
                <Input
                    v-model="filters.date_to"
                    type="date"
                    aria-label="Fecha hasta"
                />
                <Button type="submit"><Search class="size-4" />Filtrar</Button>
            </form>

            <div class="rounded-xl border bg-card">
                <div
                    class="flex items-center justify-between border-b px-4 py-3 text-sm"
                >
                    <span class="font-medium">{{ total }} ajuste(s)</span
                    ><span class="text-muted-foreground"
                        >Página {{ page }} de {{ lastPage }}</span
                    >
                </div>
                <div
                    v-if="loading && rows.length === 0"
                    class="p-12 text-center text-sm text-muted-foreground"
                >
                    Cargando ajustes…
                </div>
                <div v-else-if="rows.length === 0" class="p-12 text-center">
                    <p class="font-medium">No hay ajustes para estos filtros</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Los ajustes confirmados aparecerán aquí con su folio y
                        asiento.
                    </p>
                </div>

                <div v-else class="hidden overflow-x-auto md:block">
                    <table class="w-full min-w-[1280px] text-sm">
                        <thead
                            class="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase"
                        >
                            <tr>
                                <th class="px-3 py-3">Fecha y hora</th>
                                <th class="px-3 py-3">Número</th>
                                <th class="px-3 py-3">Tipo</th>
                                <th class="px-3 py-3">Cuenta afectada</th>
                                <th class="px-3 py-3">Contrapartida</th>
                                <th class="px-3 py-3">Movimiento</th>
                                <th class="px-3 py-3 text-right">Monto</th>
                                <th class="px-3 py-3">Motivo / notas</th>
                                <th class="px-3 py-3">Usuario</th>
                                <th class="px-3 py-3">Estado</th>
                                <th class="px-3 py-3 text-right">Detalle</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            <tr
                                v-for="row in rows"
                                :key="row.id"
                                class="hover:bg-muted/30"
                            >
                                <td class="px-3 py-3 whitespace-nowrap">
                                    {{
                                        formatReportDateTime(
                                            row.business_datetime,
                                        )
                                    }}
                                </td>
                                <td class="px-3 py-3 font-semibold">
                                    {{ row.folio }}
                                </td>
                                <td class="px-3 py-3">{{ row.type_label }}</td>
                                <td class="px-3 py-3">
                                    {{ accountName(row) }}
                                </td>
                                <td class="px-3 py-3">
                                    {{
                                        row.counterparty_ledger_account?.name ||
                                        'Sin datos heredados'
                                    }}
                                </td>
                                <td class="px-3 py-3">
                                    {{
                                        row.direction === 'increase'
                                            ? 'Aumento'
                                            : 'Disminución'
                                    }}
                                </td>
                                <td
                                    class="px-3 py-3 text-right font-semibold tabular-nums"
                                >
                                    {{ formatCurrency(row.amount) }}
                                </td>
                                <td class="max-w-56 px-3 py-3">
                                    <p class="truncate font-medium">
                                        {{ row.reason }}
                                    </p>
                                    <p
                                        v-if="row.notes"
                                        class="truncate text-xs text-muted-foreground"
                                    >
                                        {{ row.notes }}
                                    </p>
                                </td>
                                <td class="px-3 py-3">
                                    {{ row.user?.name || 'Usuario heredado' }}
                                </td>
                                <td class="px-3 py-3">
                                    <Badge
                                        :variant="
                                            row.status === 'completed'
                                                ? 'default'
                                                : 'secondary'
                                        "
                                        >{{
                                            row.status === 'completed'
                                                ? 'Completado'
                                                : 'Reversado'
                                        }}</Badge
                                    >
                                </td>
                                <td class="px-3 py-3 text-right">
                                    <Button as-child size="icon" variant="ghost"
                                        ><Link
                                            :href="`/finance/accounting/adjustments/${row.id}`"
                                            :aria-label="`Ver ${row.folio}`"
                                            ><Eye class="size-4" /></Link
                                    ></Button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-if="rows.length" class="divide-y md:hidden">
                    <article
                        v-for="row in rows"
                        :key="row.id"
                        class="space-y-3 p-4"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <Link
                                    :href="`/finance/accounting/adjustments/${row.id}`"
                                    class="font-semibold text-primary"
                                    >{{ row.folio }}</Link
                                >
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{
                                        formatReportDateTime(
                                            row.business_datetime,
                                        )
                                    }}
                                </p>
                            </div>
                            <Badge
                                :variant="
                                    row.status === 'completed'
                                        ? 'default'
                                        : 'secondary'
                                "
                                >{{
                                    row.status === 'completed'
                                        ? 'Completado'
                                        : 'Reversado'
                                }}</Badge
                            >
                        </div>
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p class="text-xs text-muted-foreground">
                                    Tipo
                                </p>
                                <p class="font-medium">{{ row.type_label }}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-muted-foreground">
                                    Monto
                                </p>
                                <p class="font-semibold">
                                    {{ formatCurrency(row.amount) }}
                                </p>
                            </div>
                            <div class="col-span-2">
                                <p class="text-xs text-muted-foreground">
                                    Cuenta afectada
                                </p>
                                <p class="font-medium">
                                    {{ accountName(row) }}
                                </p>
                            </div>
                            <div class="col-span-2">
                                <p class="text-xs text-muted-foreground">
                                    Motivo
                                </p>
                                <p>{{ row.reason }}</p>
                            </div>
                        </div>
                    </article>
                </div>
                <div
                    v-if="lastPage > 1"
                    class="flex items-center justify-end gap-2 border-t p-3"
                >
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="page <= 1 || loading"
                        @click="changePage(page - 1)"
                        >Anterior</Button
                    ><Button
                        size="sm"
                        variant="outline"
                        :disabled="page >= lastPage || loading"
                        @click="changePage(page + 1)"
                        >Siguiente</Button
                    >
                </div>
            </div>
        </PageShell>
        <FinanceAdjustmentModal
            v-model:open="modalOpen"
            :initial-type="initialType"
            :initial-customer-id="initialCustomerId"
            @submitted="submitted"
        />
    </AppLayout>
</template>
