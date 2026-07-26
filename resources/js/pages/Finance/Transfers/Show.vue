<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { ArrowRight, Download, RotateCcw } from 'lucide-vue-next';
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
import { useAuth } from '@/composables/useAuth';
import AppLayout from '@/layouts/AppLayout.vue';
import { financialTransfersService } from '@/services/financial-transfers';
import type { BreadcrumbItem } from '@/types';
import type { FinancialTransfer } from '@/types/financial-transfer';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';

const props = defineProps<{ transferId: number }>();
const { isAdmin } = useAuth();
const transfer = ref<FinancialTransfer | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const reverseOpen = ref(false);
const reversing = ref(false);
const reason = ref('');
const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Transferencias', href: '/finance/transfers' },
    { title: transfer.value?.folio || 'Detalle' },
]);

async function loadTransfer(): Promise<void> {
    loading.value = true;
    try {
        transfer.value = await financialTransfersService.get(props.transferId);
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'No se pudo cargar la transferencia.';
    } finally {
        loading.value = false;
    }
}

async function reverseTransfer(): Promise<void> {
    if (reason.value.trim().length < 3) return;
    reversing.value = true;
    try {
        const reversal = await financialTransfersService.reverse(
            props.transferId,
            reason.value.trim(),
        );
        window.location.assign(`/finance/transfers/${reversal.id}`);
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'No se pudo reversar la transferencia.';
        reverseOpen.value = false;
    } finally {
        reversing.value = false;
    }
}

onMounted(loadTransfer);
</script>

<template>
    <Head :title="transfer?.folio || 'Transferencia'" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <PageShell
            :title="transfer?.folio || 'Detalle de transferencia'"
            description="Registro financiero inmutable y trazable."
            constrained
            content-class="max-w-5xl"
        >
            <template v-if="transfer" #actions>
                <Button v-if="transfer.has_receipt" as-child variant="outline">
                    <a
                        :href="
                            financialTransfersService.receiptUrl(transfer.id)
                        "
                    >
                        <Download class="size-4" />
                        Comprobante
                    </a>
                </Button>
                <Button
                    v-if="
                        isAdmin &&
                        transfer.status === 'completed' &&
                        !transfer.reversal_of
                    "
                    variant="destructive"
                    @click="reverseOpen = true"
                >
                    <RotateCcw class="size-4" />
                    Reversar
                </Button>
            </template>
            <div
                v-if="loading"
                class="p-10 text-center text-sm text-muted-foreground"
            >
                Cargando transferencia…
            </div>
            <div
                v-else-if="error"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
                {{ error }}
            </div>
            <template v-else-if="transfer">
                <section class="rounded-xl border bg-card p-5">
                    <div
                        class="flex flex-wrap items-center justify-between gap-3 border-b pb-4"
                    >
                        <div>
                            <p class="text-xs text-muted-foreground uppercase">
                                Monto transferido
                            </p>
                            <p class="mt-1 text-3xl font-semibold tabular-nums">
                                {{ formatCurrency(transfer.amount) }}
                            </p>
                        </div>
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
                    </div>
                    <div class="grid gap-4 py-6 md:grid-cols-[1fr_auto_1fr]">
                        <div class="rounded-lg bg-muted/40 p-4">
                            <p
                                class="text-xs font-semibold text-muted-foreground uppercase"
                            >
                                Desde
                            </p>
                            <p class="mt-2 font-semibold">
                                {{ transfer.from_account.name }}
                            </p>
                        </div>
                        <div class="flex items-center justify-center">
                            <ArrowRight
                                class="size-5 rotate-90 text-muted-foreground md:rotate-0"
                            />
                        </div>
                        <div class="rounded-lg bg-muted/40 p-4">
                            <p
                                class="text-xs font-semibold text-muted-foreground uppercase"
                            >
                                Hacia
                            </p>
                            <p class="mt-2 font-semibold">
                                {{ transfer.to_account.name }}
                            </p>
                        </div>
                    </div>
                    <dl class="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
                        <div>
                            <dt class="text-muted-foreground">
                                Fecha operativa
                            </dt>
                            <dd class="mt-1 font-medium">
                                {{
                                    formatReportDateTime(
                                        transfer.business_datetime,
                                    )
                                }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">
                                Registrada por
                            </dt>
                            <dd class="mt-1 font-medium">
                                {{ transfer.creator?.name || 'Sistema' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">Referencia</dt>
                            <dd class="mt-1 font-medium">
                                {{ transfer.reference || 'Sin referencia' }}
                            </dd>
                        </div>
                        <div v-if="transfer.reversal_of">
                            <dt class="text-muted-foreground">Revierte</dt>
                            <dd class="mt-1">
                                <Link
                                    :href="`/finance/transfers/${transfer.reversal_of.id}`"
                                    class="font-medium text-primary hover:underline"
                                >
                                    {{ transfer.reversal_of.folio }}
                                </Link>
                            </dd>
                        </div>
                        <div v-if="transfer.reversed_by">
                            <dt class="text-muted-foreground">
                                Reversada mediante
                            </dt>
                            <dd class="mt-1">
                                <Link
                                    :href="`/finance/transfers/${transfer.reversed_by.id}`"
                                    class="font-medium text-primary hover:underline"
                                >
                                    {{ transfer.reversed_by.folio }}
                                </Link>
                            </dd>
                        </div>
                        <div v-if="transfer.notes" class="sm:col-span-2">
                            <dt class="text-muted-foreground">Notas</dt>
                            <dd class="mt-1 whitespace-pre-wrap">
                                {{ transfer.notes }}
                            </dd>
                        </div>
                    </dl>
                </section>
            </template>
        </PageShell>

        <Dialog v-model:open="reverseOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reversar transferencia</DialogTitle>
                    <DialogDescription>
                        Se creará una nueva transferencia contraria con folio
                        propio.
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <label
                        for="reverse-reason"
                        class="mb-1.5 block text-sm font-medium"
                    >
                        Motivo obligatorio
                    </label>
                    <textarea
                        id="reverse-reason"
                        v-model="reason"
                        rows="3"
                        maxlength="500"
                        class="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="reverseOpen = false"
                        >Cancelar</Button
                    >
                    <Button
                        variant="destructive"
                        :disabled="reversing || reason.trim().length < 3"
                        @click="reverseTransfer"
                    >
                        {{ reversing ? 'Reversando…' : 'Confirmar reversa' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
