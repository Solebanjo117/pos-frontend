<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { Plus, Save } from 'lucide-vue-next';
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
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { financialTransfersService } from '@/services/financial-transfers';
import type { BreadcrumbItem } from '@/types';
import type { FinancialAccount } from '@/types/financial-transfer';
import { formatCurrency } from '@/utils/formatters';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cuentas financieras' }];
const accounts = ref<FinancialAccount[]>([]);
const ledgerAccounts = ref<Array<{ id: number; code: string; name: string }>>(
    [],
);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const dialogOpen = ref(false);
const editing = ref<FinancialAccount | null>(null);
const form = ref({
    name: '',
    type: 'bank',
    masked_number: '',
    currency: 'USD',
    opening_balance: 0,
    allow_negative_balance: false,
    is_active: true,
    ledger_account_id: null as number | null,
});
const typeOptions: SelectOption[] = [
    { value: 'bank', label: 'Banco' },
    { value: 'petty_cash', label: 'Caja chica' },
    { value: 'other', label: 'Otra cuenta' },
];
const ledgerOptions = computed<SelectOption[]>(() =>
    ledgerAccounts.value.map((account) => ({
        value: account.id,
        label: `${account.code} · ${account.name}`,
    })),
);

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        [accounts.value, ledgerAccounts.value] = await Promise.all([
            financialTransfersService.accounts(),
            financialTransfersService.ledgerAccounts(),
        ]);
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'No se pudieron cargar las cuentas.';
    } finally {
        loading.value = false;
    }
}

function openCreate(): void {
    editing.value = null;
    form.value = {
        name: '',
        type: 'bank',
        masked_number: '',
        currency: 'USD',
        opening_balance: 0,
        allow_negative_balance: false,
        is_active: true,
        ledger_account_id: ledgerAccounts.value[0]?.id ?? null,
    };
    dialogOpen.value = true;
}

function openEdit(account: FinancialAccount): void {
    editing.value = account;
    form.value = {
        name: account.name,
        type: account.type,
        masked_number: account.masked_number || '',
        currency: account.currency,
        opening_balance: Number(account.opening_balance),
        allow_negative_balance: account.allow_negative_balance,
        is_active: account.is_active,
        ledger_account_id: account.ledger_account_id,
    };
    dialogOpen.value = true;
}

async function save(): Promise<void> {
    if (!form.value.name.trim() || !form.value.ledger_account_id) return;
    saving.value = true;
    error.value = null;
    try {
        if (editing.value) {
            await financialTransfersService.updateAccount(editing.value.id, {
                ...form.value,
                opening_balance: undefined,
            });
        } else {
            await financialTransfersService.createAccount(form.value);
        }
        dialogOpen.value = false;
        await load();
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'No se pudo guardar la cuenta.';
    } finally {
        saving.value = false;
    }
}

onMounted(load);
</script>

<template>
    <Head title="Cuentas financieras" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <PageShell
            title="Cuentas financieras"
            description="Bancos, caja chica y otras cuentas disponibles para movimientos de tesorería."
            constrained
        >
            <template #actions>
                <Button @click="openCreate">
                    <Plus class="size-4" />
                    Nueva cuenta
                </Button>
            </template>
            <div
                v-if="error"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
                {{ error }}
            </div>
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <button
                    v-for="account in accounts"
                    :key="account.id"
                    type="button"
                    class="rounded-xl border bg-card p-5 text-left transition-colors hover:bg-accent/40 disabled:cursor-default"
                    :disabled="account.is_legacy"
                    @click="openEdit(account)"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="font-semibold">{{ account.name }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{
                                    account.masked_number ||
                                    account.ledger_account?.code
                                }}
                            </p>
                        </div>
                        <Badge
                            :variant="
                                account.is_active ? 'default' : 'secondary'
                            "
                        >
                            {{ account.is_active ? 'Activa' : 'Inactiva' }}
                        </Badge>
                    </div>
                    <p class="mt-5 text-2xl font-semibold tabular-nums">
                        {{ formatCurrency(account.current_balance) }}
                    </p>
                    <p
                        v-if="account.is_legacy"
                        class="mt-2 text-xs text-muted-foreground"
                    >
                        Cuenta protegida de compatibilidad histórica
                    </p>
                </button>
            </div>
            <p v-if="loading" class="text-center text-sm text-muted-foreground">
                Cargando cuentas…
            </p>
        </PageShell>

        <Dialog v-model:open="dialogOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {{
                            editing
                                ? 'Editar cuenta'
                                : 'Nueva cuenta financiera'
                        }}
                    </DialogTitle>
                    <DialogDescription>
                        El saldo inicial solo puede definirse al crear la
                        cuenta.
                    </DialogDescription>
                </DialogHeader>
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                        <label class="mb-1.5 block text-sm font-medium"
                            >Nombre</label
                        >
                        <input
                            v-model="form.name"
                            maxlength="120"
                            class="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                        />
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium"
                            >Tipo</label
                        >
                        <SearchableSelect
                            v-model="form.type"
                            :options="typeOptions"
                        />
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium"
                            >Número enmascarado</label
                        >
                        <input
                            v-model="form.masked_number"
                            maxlength="80"
                            placeholder="•••• 1234"
                            class="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                        />
                    </div>
                    <div v-if="!editing">
                        <label class="mb-1.5 block text-sm font-medium"
                            >Saldo inicial</label
                        >
                        <input
                            v-model.number="form.opening_balance"
                            type="number"
                            step="0.01"
                            class="h-10 w-full rounded-lg border bg-background px-3 text-right text-sm"
                        />
                    </div>
                    <div :class="{ 'sm:col-span-2': editing }">
                        <label class="mb-1.5 block text-sm font-medium"
                            >Cuenta contable</label
                        >
                        <SearchableSelect
                            v-model="form.ledger_account_id"
                            :options="ledgerOptions"
                        />
                    </div>
                    <label class="flex items-center gap-2 text-sm">
                        <input
                            v-model="form.allow_negative_balance"
                            type="checkbox"
                            class="rounded border-input"
                        />
                        Permitir saldo negativo
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                        <input
                            v-model="form.is_active"
                            type="checkbox"
                            class="rounded border-input"
                        />
                        Cuenta activa
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="dialogOpen = false"
                        >Cancelar</Button
                    >
                    <Button
                        :disabled="
                            saving ||
                            !form.name.trim() ||
                            !form.ledger_account_id
                        "
                        @click="save"
                    >
                        <Save class="size-4" />
                        {{ saving ? 'Guardando…' : 'Guardar' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
