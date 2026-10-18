<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { ArrowRight, CheckCircle2, Paperclip, Repeat2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import PageShell from '@/components/PageShell.vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useAuth } from '@/composables/useAuth';
import AppLayout from '@/layouts/AppLayout.vue';
import { financialTransfersService } from '@/services/financial-transfers';
import type { BreadcrumbItem } from '@/types';
import type {
    FinancialAccountType,
    MoneyAccountOption,
} from '@/types/financial-transfer';
import {
    moneyEndpointKey,
    validateTransferSelection,
} from '@/utils/financialTransferForm';
import { formatCurrency } from '@/utils/formatters';
import { createIdempotencyKey } from '@/utils/idempotency';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Transferencias', href: '/finance/transfers' },
    { title: 'Nueva transferencia' },
];
const { isAdmin } = useAuth();
const accountTypes: SelectOption[] = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'bank', label: 'Banco' },
    { value: 'petty_cash', label: 'Caja chica' },
    { value: 'other', label: 'Otra cuenta' },
];
const localDatetime = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

let requestedWarehouse =
    Number(
        new URLSearchParams(window.location.search).get('from_warehouse_id'),
    ) || null;
const form = ref({
    from_type: (requestedWarehouse ? 'cash' : 'bank') as FinancialAccountType,
    from_key: null as string | null,
    to_type: 'bank' as FinancialAccountType,
    to_key: null as string | null,
    amount: 0,
    business_datetime: localDatetime(),
    reference: '',
    notes: '',
    receipt: null as File | null,
});
const fromAccounts = ref<MoneyAccountOption[]>([]);
const toAccounts = ref<MoneyAccountOption[]>([]);
const loadingFrom = ref(false);
const loadingTo = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const confirmOpen = ref(false);
const transferKey = ref<string | null>(null);
watch(
    form,
    () => {
        transferKey.value = null;
    },
    { deep: true, flush: 'sync' },
);

const optionKey = moneyEndpointKey;
const selectOptions = (options: MoneyAccountOption[]): SelectOption[] =>
    options.map((option) => ({
        value: optionKey(option),
        label: option.name,
        sublabel:
            option.initialized === false
                ? 'Saldo sin inicializar · Caja / Movimientos por método'
                : `${option.masked_number ? `${option.masked_number} · ` : ''}${formatCurrency(option.balance)}`,
    }));
const fromOptions = computed(() => selectOptions(fromAccounts.value));
const toOptions = computed(() => selectOptions(toAccounts.value));
const selectedFrom = computed(() =>
    fromAccounts.value.find(
        (option) => optionKey(option) === form.value.from_key,
    ),
);
const selectedTo = computed(() =>
    toAccounts.value.find((option) => optionKey(option) === form.value.to_key),
);
const insufficientBalance = computed(
    () =>
        selectedFrom.value !== undefined &&
        !selectedFrom.value.allow_negative_balance &&
        Number(form.value.amount) > Number(selectedFrom.value.balance),
);
const canSubmit = computed(
    () =>
        validateTransferSelection(
            selectedFrom.value,
            selectedTo.value,
            Number(form.value.amount),
        ) === null && !saving.value,
);

async function loadSide(side: 'from' | 'to'): Promise<void> {
    const type = side === 'from' ? form.value.from_type : form.value.to_type;
    const loading = side === 'from' ? loadingFrom : loadingTo;
    loading.value = true;
    try {
        const options = await financialTransfersService.options(
            type,
            'transfer',
        );
        if (side === 'from') {
            fromAccounts.value = options;
            const requested = options.find(
                (option) =>
                    option.endpoint_type === 'warehouse_cash' &&
                    option.endpoint_id === requestedWarehouse,
            );
            form.value.from_key = requested ? optionKey(requested) : null;
            requestedWarehouse = null;
        } else {
            toAccounts.value = options;
            form.value.to_key = null;
        }
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'No se pudieron cargar las cuentas.';
    } finally {
        loading.value = false;
    }
}

watch(
    () => form.value.from_type,
    () => void loadSide('from'),
    {
        immediate: true,
    },
);
watch(
    () => form.value.to_type,
    () => void loadSide('to'),
    {
        immediate: true,
    },
);

function selectReceipt(event: Event): void {
    form.value.receipt = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function openConfirmation(): void {
    error.value = null;
    const validationError = validateTransferSelection(
        selectedFrom.value,
        selectedTo.value,
        Number(form.value.amount),
    );
    if (validationError) {
        error.value = validationError;
        return;
    }
    confirmOpen.value = true;
}

async function submit(): Promise<void> {
    if (!selectedFrom.value || !selectedTo.value || saving.value) return;
    saving.value = true;
    error.value = null;
    try {
        const transfer = await financialTransfersService.create({
            idempotency_key: (transferKey.value ??= createIdempotencyKey()),
            from_endpoint_type: selectedFrom.value.endpoint_type,
            from_endpoint_id: selectedFrom.value.endpoint_id,
            to_endpoint_type: selectedTo.value.endpoint_type,
            to_endpoint_id: selectedTo.value.endpoint_id,
            amount: Number(form.value.amount),
            business_datetime: isAdmin.value
                ? new Date(form.value.business_datetime).toISOString()
                : undefined,
            reference: form.value.reference.trim(),
            notes: form.value.notes.trim(),
            receipt: form.value.receipt,
        });
        confirmOpen.value = false;
        router.visit(`/finance/transfers/${transfer.id}`);
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'No se pudo completar la transferencia.';
        confirmOpen.value = false;
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Head title="Nueva transferencia" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <PageShell
            title="Transferencia entre cuentas"
            description="Mueve fondos sin alterar ventas, compras, gastos ni resultados."
            constrained
            content-class="max-w-5xl"
        >
            <div
                v-if="error"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                role="alert"
            >
                {{ error }}
            </div>

            <form class="space-y-6" @submit.prevent="openConfirmation">
                <div class="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
                    <section class="space-y-4 rounded-xl border bg-card p-5">
                        <div>
                            <p
                                class="text-xs font-semibold text-muted-foreground uppercase"
                            >
                                Desde
                            </p>
                            <h2 class="mt-1 font-semibold">Cuenta de origen</h2>
                        </div>
                        <div>
                            <label class="mb-1.5 block text-sm font-medium">
                                Tipo de cuenta
                            </label>
                            <SearchableSelect
                                v-model="form.from_type"
                                :options="accountTypes"
                                aria-label="Tipo de cuenta de origen"
                            />
                        </div>
                        <div>
                            <label class="mb-1.5 block text-sm font-medium">
                                Cuenta
                            </label>
                            <SearchableSelect
                                v-model="form.from_key"
                                :options="fromOptions"
                                :loading="loadingFrom"
                                placeholder="Selecciona la cuenta de origen"
                                aria-label="Cuenta de origen"
                            />
                        </div>
                        <div class="rounded-lg bg-muted/50 p-4">
                            <p class="text-xs text-muted-foreground">
                                Saldo disponible
                            </p>
                            <p class="mt-1 text-2xl font-semibold tabular-nums">
                                {{
                                    selectedFrom
                                        ? formatCurrency(selectedFrom.balance)
                                        : '—'
                                }}
                            </p>
                        </div>
                    </section>

                    <div class="flex items-center justify-center">
                        <span
                            class="flex size-10 rotate-90 items-center justify-center rounded-full border bg-background text-muted-foreground lg:rotate-0"
                            aria-hidden="true"
                        >
                            <ArrowRight class="size-5" />
                        </span>
                    </div>

                    <section class="space-y-4 rounded-xl border bg-card p-5">
                        <div>
                            <p
                                class="text-xs font-semibold text-muted-foreground uppercase"
                            >
                                Hacia
                            </p>
                            <h2 class="mt-1 font-semibold">
                                Cuenta de destino
                            </h2>
                        </div>
                        <div>
                            <label class="mb-1.5 block text-sm font-medium">
                                Tipo de cuenta
                            </label>
                            <SearchableSelect
                                v-model="form.to_type"
                                :options="accountTypes"
                                aria-label="Tipo de cuenta de destino"
                            />
                        </div>
                        <div>
                            <label class="mb-1.5 block text-sm font-medium">
                                Cuenta
                            </label>
                            <SearchableSelect
                                v-model="form.to_key"
                                :options="toOptions"
                                :loading="loadingTo"
                                placeholder="Selecciona la cuenta de destino"
                                aria-label="Cuenta de destino"
                            />
                        </div>
                        <div class="rounded-lg bg-muted/50 p-4">
                            <p class="text-xs text-muted-foreground">
                                Saldo actual
                            </p>
                            <p class="mt-1 text-2xl font-semibold tabular-nums">
                                {{
                                    selectedTo
                                        ? formatCurrency(selectedTo.balance)
                                        : '—'
                                }}
                            </p>
                        </div>
                    </section>
                </div>

                <section
                    class="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2"
                >
                    <div>
                        <label
                            for="transfer-amount"
                            class="mb-1.5 block text-sm font-medium"
                        >
                            Monto
                        </label>
                        <input
                            id="transfer-amount"
                            v-model.number="form.amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            class="h-10 w-full rounded-lg border bg-background px-3 text-right text-lg font-semibold tabular-nums focus:ring-2 focus:ring-ring focus:outline-none"
                        />
                        <p
                            v-if="insufficientBalance"
                            class="mt-1 text-xs text-destructive"
                        >
                            El monto supera el saldo disponible.
                        </p>
                    </div>
                    <div v-if="isAdmin">
                        <label
                            for="transfer-date"
                            class="mb-1.5 block text-sm font-medium"
                        >
                            Fecha y hora operativa
                        </label>
                        <input
                            id="transfer-date"
                            v-model="form.business_datetime"
                            type="datetime-local"
                            class="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            for="transfer-reference"
                            class="mb-1.5 block text-sm font-medium"
                        >
                            Referencia
                        </label>
                        <input
                            id="transfer-reference"
                            v-model="form.reference"
                            maxlength="120"
                            placeholder="ACH, confirmación o referencia interna"
                            class="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            for="transfer-receipt"
                            class="mb-1.5 block text-sm font-medium"
                        >
                            Comprobante opcional
                        </label>
                        <label
                            for="transfer-receipt"
                            class="flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground hover:bg-accent"
                        >
                            <Paperclip class="size-4" />
                            <span class="truncate">
                                {{
                                    form.receipt?.name ||
                                    'PDF o imagen, máximo 10 MB'
                                }}
                            </span>
                        </label>
                        <input
                            id="transfer-receipt"
                            type="file"
                            class="sr-only"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            @change="selectReceipt"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label
                            for="transfer-notes"
                            class="mb-1.5 block text-sm font-medium"
                        >
                            Notas
                        </label>
                        <textarea
                            id="transfer-notes"
                            v-model="form.notes"
                            rows="3"
                            maxlength="2000"
                            class="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                        />
                    </div>
                </section>

                <div
                    class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
                >
                    <Button
                        type="button"
                        variant="outline"
                        @click="router.visit('/finance/transfers')"
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" :disabled="!canSubmit">
                        <Repeat2 class="size-4" />
                        Revisar transferencia
                    </Button>
                </div>
            </form>
        </PageShell>

        <Dialog v-model:open="confirmOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirmar transferencia</DialogTitle>
                    <DialogDescription>
                        Esta operación se completará inmediatamente y luego solo
                        podrá reversarse por un administrador.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
                    <div class="flex justify-between gap-4">
                        <span class="text-muted-foreground">Desde</span>
                        <span class="text-right font-medium">{{
                            selectedFrom?.name
                        }}</span>
                    </div>
                    <div class="flex justify-between gap-4">
                        <span class="text-muted-foreground">Hacia</span>
                        <span class="text-right font-medium">{{
                            selectedTo?.name
                        }}</span>
                    </div>
                    <div class="flex justify-between gap-4 border-t pt-3">
                        <span class="font-medium">Monto</span>
                        <span class="text-lg font-semibold tabular-nums">
                            {{ formatCurrency(form.amount) }}
                        </span>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="confirmOpen = false">
                        Volver
                    </Button>
                    <Button :disabled="saving" @click="submit">
                        <CheckCircle2 class="size-4" />
                        {{ saving ? 'Transfiriendo…' : 'Confirmar' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
