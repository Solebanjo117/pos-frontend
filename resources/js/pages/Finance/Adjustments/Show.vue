<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import { ArrowRight, RotateCcw } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import PageShell from '@/components/PageShell.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/AppLayout.vue';
import { financialAdjustmentsService } from '@/services/financial-adjustments';
import type { BreadcrumbItem } from '@/types';
import type { FinancialAdjustment } from '@/types/financial-adjustment';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';
import { createIdempotencyKey } from '@/utils/idempotency';

const props = defineProps<{ adjustmentId: number }>();
const adjustment = ref<FinancialAdjustment | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const reverseOpen = ref(false);
const reversing = ref(false);
const reverseReason = ref('');
const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Finanzas', href: '/finance' },
    { title: 'Contabilidad' },
    { title: 'Historial de ajustes', href: '/finance/accounting/adjustments' },
    { title: adjustment.value?.folio || 'Detalle' },
]);
const reportLink = computed(() => {
    if (!adjustment.value) return '/finance/accounting/adjustments';
    if (['sales', 'expenses'].includes(adjustment.value.type))
        return '/reports/financial';
    if (adjustment.value.type === 'purchases')
        return '/reports/purchases-by-supplier';
    if (adjustment.value.type === 'accounts_receivable') return '/ar';
    if (adjustment.value.type === 'accounts_payable')
        return '/accounts-payable';
    if (adjustment.value.type === 'inventory') return '/inventory';
    return '/reports/financial';
});
const canReverse = computed(
    () =>
        adjustment.value?.capabilities?.can_reverse === true &&
        adjustment.value?.status === 'completed' &&
        !adjustment.value.is_legacy &&
        !adjustment.value.reversal_of &&
        !adjustment.value.reversed_by,
);

async function load(): Promise<void> {
    loading.value = true;
    try {
        adjustment.value = await financialAdjustmentsService.get(
            props.adjustmentId,
        );
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'No se pudo cargar el ajuste.';
    } finally {
        loading.value = false;
    }
}
async function reverse(): Promise<void> {
    if (reverseReason.value.trim().length < 3 || reversing.value) return;
    reversing.value = true;
    try {
        const reversal = await financialAdjustmentsService.reverse(
            props.adjustmentId,
            {
                idempotency_key: createIdempotencyKey(),
                reason: reverseReason.value.trim(),
                business_datetime: new Date().toISOString(),
            },
        );
        router.visit(`/finance/accounting/adjustments/${reversal.id}`);
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'No se pudo reversar el ajuste.';
        reverseOpen.value = false;
    } finally {
        reversing.value = false;
    }
}
onMounted(load);
</script>

<template>
    <Head :title="adjustment?.folio || 'Detalle de ajuste'" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <PageShell
            :title="adjustment?.folio || 'Detalle de ajuste'"
            description="Movimiento inmutable, efectos operativos, asiento y auditoría."
            constrained
            content-class="max-w-6xl"
        >
            <template v-if="adjustment" #actions
                ><Button
                    v-if="canReverse"
                    variant="destructive"
                    @click="reverseOpen = true"
                    ><RotateCcw class="size-4" />Revertir ajuste</Button
                ></template
            >
            <div
                v-if="loading"
                class="p-12 text-center text-sm text-muted-foreground"
            >
                Cargando ajuste…
            </div>
            <div
                v-else-if="error && !adjustment"
                role="alert"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
                {{ error }}
            </div>
            <template v-else-if="adjustment">
                <div
                    v-if="error"
                    role="alert"
                    class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                    {{ error }}
                </div>
                <section class="rounded-xl border bg-card p-5">
                    <div
                        class="flex flex-wrap items-start justify-between gap-4 border-b pb-5"
                    >
                        <div>
                            <p
                                class="text-xs font-semibold text-muted-foreground uppercase"
                            >
                                {{ adjustment.type_label }}
                            </p>
                            <p class="mt-2 text-3xl font-semibold tabular-nums">
                                {{ formatCurrency(adjustment.amount) }}
                            </p>
                            <p class="mt-1 text-sm text-muted-foreground">
                                {{
                                    adjustment.direction === 'increase'
                                        ? 'Aumento de saldo'
                                        : 'Disminución de saldo'
                                }}
                            </p>
                        </div>
                        <Badge
                            :variant="
                                adjustment.status === 'completed'
                                    ? 'default'
                                    : 'secondary'
                            "
                            >{{
                                adjustment.status === 'completed'
                                    ? 'Completado'
                                    : 'Reversado'
                            }}</Badge
                        >
                    </div>
                    <div
                        class="grid gap-4 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4"
                    >
                        <div>
                            <p class="text-muted-foreground">Fecha operativa</p>
                            <p class="mt-1 font-medium">
                                {{
                                    formatReportDateTime(
                                        adjustment.business_datetime,
                                    )
                                }}
                            </p>
                        </div>
                        <div>
                            <p class="text-muted-foreground">Zona horaria</p>
                            <p class="mt-1 font-medium">
                                {{ adjustment.timezone }}
                            </p>
                        </div>
                        <div>
                            <p class="text-muted-foreground">Creado por</p>
                            <p class="mt-1 font-medium">
                                {{
                                    adjustment.user?.name || 'Usuario heredado'
                                }}
                            </p>
                        </div>
                        <div>
                            <p class="text-muted-foreground">Referencia</p>
                            <p class="mt-1 font-medium">
                                {{ adjustment.reference || '—' }}
                            </p>
                        </div>
                    </div>
                </section>

                <section class="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
                    <div class="rounded-xl border bg-card p-5">
                        <p
                            class="text-xs font-semibold text-muted-foreground uppercase"
                        >
                            Cuenta afectada
                        </p>
                        <p class="mt-2 font-semibold">
                            {{
                                adjustment.financial_account?.name ||
                                adjustment.affected_ledger_account?.name ||
                                (adjustment.pos_session
                                    ? `Caja #${adjustment.pos_session.id}`
                                    : adjustment.product?.name ||
                                      'Sin datos heredados')
                            }}
                        </p>
                        <p
                            v-if="adjustment.affected_ledger_account"
                            class="mt-1 text-sm text-muted-foreground"
                        >
                            {{ adjustment.affected_ledger_account.code }} ·
                            {{ adjustment.affected_ledger_account.name }}
                        </p>
                    </div>
                    <div class="flex items-center justify-center">
                        <ArrowRight
                            class="size-5 rotate-90 text-muted-foreground md:rotate-0"
                        />
                    </div>
                    <div class="rounded-xl border bg-card p-5">
                        <p
                            class="text-xs font-semibold text-muted-foreground uppercase"
                        >
                            Contrapartida
                        </p>
                        <p class="mt-2 font-semibold">
                            {{
                                adjustment.counterparty_ledger_account?.name ||
                                'No disponible en registro heredado'
                            }}
                        </p>
                        <p
                            v-if="adjustment.counterparty_ledger_account"
                            class="mt-1 text-sm text-muted-foreground"
                        >
                            {{ adjustment.counterparty_ledger_account.code }}
                        </p>
                    </div>
                </section>

                <section class="rounded-xl border bg-card p-5">
                    <h2 class="font-semibold">Motivo y trazabilidad</h2>
                    <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                            <dt class="text-muted-foreground">Motivo</dt>
                            <dd class="mt-1 font-medium">
                                {{ adjustment.reason }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">Notas</dt>
                            <dd class="mt-1 font-medium">
                                {{ adjustment.notes || '—' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">Dirección IP</dt>
                            <dd class="mt-1 font-medium">
                                {{ adjustment.created_ip || 'No registrada' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">
                                Documento relacionado
                            </dt>
                            <dd class="mt-1 font-medium">
                                {{
                                    adjustment.sales_order?.order_number ||
                                    adjustment.purchase_order
                                        ?.supplier_invoice_number ||
                                    adjustment.purchase_order?.po_number ||
                                    '—'
                                }}
                            </dd>
                        </div>
                    </dl>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <Button as-child variant="outline"
                            ><Link :href="reportLink"
                                >Consultar reporte afectado</Link
                            ></Button
                        ><Button
                            v-if="adjustment.reversal_of"
                            as-child
                            variant="outline"
                            ><Link
                                :href="`/finance/accounting/adjustments/${adjustment.reversal_of.id}`"
                                >Ver ajuste original
                                {{ adjustment.reversal_of.folio }}</Link
                            ></Button
                        ><Button
                            v-if="adjustment.reversed_by"
                            as-child
                            variant="outline"
                            ><Link
                                :href="`/finance/accounting/adjustments/${adjustment.reversed_by.id}`"
                                >Ver reversión
                                {{ adjustment.reversed_by.folio }}</Link
                            ></Button
                        >
                    </div>
                </section>

                <section class="overflow-hidden rounded-xl border bg-card">
                    <div class="border-b px-5 py-4">
                        <h2 class="font-semibold">Asiento contable</h2>
                        <p class="mt-1 text-sm text-muted-foreground">
                            Total débito y crédito deben coincidir.
                        </p>
                    </div>
                    <div
                        v-if="adjustment.journal_entry"
                        class="overflow-x-auto"
                    >
                        <table class="w-full min-w-[620px] text-sm">
                            <thead
                                class="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase"
                            >
                                <tr>
                                    <th class="px-4 py-3">Cuenta</th>
                                    <th class="px-4 py-3 text-right">Débito</th>
                                    <th class="px-4 py-3 text-right">
                                        Crédito
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                <tr
                                    v-for="line in adjustment.journal_entry
                                        .lines"
                                    :key="line.id"
                                >
                                    <td class="px-4 py-3 font-medium">
                                        {{ line.ledger_account.code }} ·
                                        {{ line.ledger_account.name }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right tabular-nums"
                                    >
                                        {{ formatCurrency(line.debit) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right tabular-nums"
                                    >
                                        {{ formatCurrency(line.credit) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-else class="p-6 text-sm text-muted-foreground">
                        Registro heredado sin asiento contable vinculado.
                    </p>
                </section>
            </template>
        </PageShell>

        <Dialog v-model:open="reverseOpen"
            ><DialogContent class="sm:max-w-md"
                ><DialogHeader
                    ><DialogTitle>Revertir {{ adjustment?.folio }}</DialogTitle
                    ><DialogDescription
                        >Se creará un ajuste inverso con folio propio. El
                        original no se eliminará.</DialogDescription
                    ></DialogHeader
                >
                <div>
                    <Label>Motivo de reversión</Label
                    ><Input
                        v-model="reverseReason"
                        class="mt-1.5"
                        placeholder="Explique por qué debe revertirse"
                    />
                </div>
                <DialogFooter
                    ><Button
                        variant="outline"
                        :disabled="reversing"
                        @click="reverseOpen = false"
                        >Cancelar</Button
                    ><Button
                        variant="destructive"
                        :disabled="reverseReason.trim().length < 3 || reversing"
                        @click="reverse"
                        >Confirmar reversión</Button
                    ></DialogFooter
                ></DialogContent
            ></Dialog
        >
    </AppLayout>
</template>
