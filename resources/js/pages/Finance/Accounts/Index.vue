<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { Lock, Pencil, Plus, Save } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import ReportPeriod from '@/components/Finance/ReportPeriod.vue';
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
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';

import { reportPeriod, reportParams } from '@/utils/moneyReports';
const accountFilters = ref({
    search: '',
    type: '',
    status: '',
    sort_by: 'name',
    sort_direction: 'asc',
    page: 1,
});
const accountMeta = ref({ last_page: 1, total: 0 });
const currencyTotals = ref<any[]>([]);
const movementAccount = ref<FinancialAccount | null>(null);
const movementFilters = ref({ ...reportPeriod(), page: 1, search: '' });
const movements = ref<any>({ data: [], last_page: 1, summary: {} });
const movementsLoading = ref(false);
async function loadMovements(account = movementAccount.value) {
    if (!account) return;
    movementAccount.value = account;
    movementsLoading.value = true;
    error.value = null;
    try {
        movements.value = await financialTransfersService.accountMovements(
            account.id,
            reportParams(movementFilters.value),
        );
    } catch {
        error.value = 'No se pudieron cargar los movimientos de la cuenta.';
    } finally {
        movementsLoading.value = false;
    }
}
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
    institution_name: '',
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

/** Leyenda visible para las cuentas protegidas por compatibilidad histórica. */
const LEGACY_LEGEND = 'Cuenta protegida de compatibilidad histórica';

function typeLabel(type: FinancialAccount['type']): string {
    return (
        typeOptions.find((option) => option.value === type)?.label ??
        'Otra cuenta'
    );
}

function ledgerLabel(account: FinancialAccount): string {
    if (!account.ledger_account) return '—';
    return `${account.ledger_account.code} · ${account.ledger_account.name}`;
}

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        const [result, ledgers] = await Promise.all([
            financialTransfersService.accountsReport(
                reportParams(accountFilters.value),
            ),
            financialTransfersService.ledgerAccounts(),
        ]);
        accounts.value = result.data;
        ledgerAccounts.value = ledgers;
        accountMeta.value = result;
        currencyTotals.value = result.totals_by_currency;
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
        institution_name: '',
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
        institution_name: account.institution_name || '',
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
            <form
                class="flex flex-wrap items-end gap-3 rounded-lg border p-3"
                @submit.prevent="
                    accountFilters.page = 1;
                    load();
                "
            >
                <label class="text-xs"
                    >Buscar<input
                        v-model="accountFilters.search"
                        placeholder="Cuenta, institución o número"
                        class="mt-1 block rounded border bg-background p-2"
                /></label>
                <label class="text-xs"
                    >Tipo<select
                        v-model="accountFilters.type"
                        class="mt-1 block rounded border bg-background p-2"
                    >
                        <option value="">Todos</option>
                        <option
                            v-for="option in typeOptions"
                            :key="String(option.value)"
                            :value="option.value"
                        >
                            {{ option.label }}
                        </option>
                    </select></label
                >
                <label class="text-xs"
                    >Estado<select
                        v-model="accountFilters.status"
                        class="mt-1 block rounded border bg-background p-2"
                    >
                        <option value="">Todos</option>
                        <option value="active">Activas</option>
                        <option value="inactive">Inactivas</option>
                    </select></label
                >
                <label class="text-xs"
                    >Orden<select
                        v-model="accountFilters.sort_by"
                        class="mt-1 block rounded border bg-background p-2"
                    >
                        <option value="name">Nombre</option>
                        <option value="type">Tipo</option>
                        <option value="current_balance">Saldo</option>
                        <option value="created_at">Registro</option>
                    </select></label
                >
                <select
                    v-model="accountFilters.sort_direction"
                    aria-label="Dirección de orden"
                    class="rounded border bg-background p-2 text-sm"
                >
                    <option value="asc">Ascendente</option>
                    <option value="desc">Descendente</option></select
                ><Button :disabled="loading">Consultar</Button>
            </form>
            <div class="flex flex-wrap gap-3">
                <span
                    v-for="total in currencyTotals"
                    :key="total.currency"
                    class="rounded border p-3 text-sm"
                    >{{ total.currency }} ·
                    {{
                        formatCurrency(Number(total.balance), {
                            currency: total.currency,
                        })
                    }}</span
                >
            </div>
            <div class="overflow-hidden rounded-xl border bg-card">
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[56rem] text-sm">
                        <thead
                            class="bg-muted/50 text-xs text-muted-foreground uppercase"
                        >
                            <tr>
                                <th class="px-3 py-2 text-left">Nombre</th>
                                <th class="px-3 py-2 text-left">Tipo</th>
                                <th class="px-3 py-2 text-left">Institución</th>
                                <th class="px-3 py-2 text-left">Número</th>
                                <th class="px-3 py-2 text-left">
                                    Cuenta contable
                                </th>
                                <th class="px-3 py-2 text-left">Moneda</th>
                                <th class="px-3 py-2 text-right">Saldo</th>
                                <th class="px-3 py-2 text-left">Estado</th>
                                <th class="px-3 py-2 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                            <tr
                                v-for="account in accounts"
                                :key="account.id"
                                class="hover:bg-muted/30"
                            >
                                <td class="px-3 py-2">
                                    <p class="font-medium">
                                        {{ account.name }}
                                    </p>
                                    <p
                                        v-if="account.is_legacy"
                                        class="mt-0.5 text-xs text-muted-foreground"
                                    >
                                        {{ LEGACY_LEGEND }}
                                    </p>
                                </td>
                                <td class="px-3 py-2 text-muted-foreground">
                                    {{ typeLabel(account.type) }}
                                </td>
                                <td class="px-3 py-2 text-muted-foreground">
                                    {{ account.institution_name || '—' }}
                                </td>
                                <td
                                    class="px-3 py-2 font-mono text-xs text-muted-foreground"
                                >
                                    {{ account.masked_number || '—' }}
                                </td>
                                <td class="px-3 py-2 text-muted-foreground">
                                    {{ ledgerLabel(account) }}
                                </td>
                                <td class="px-3 py-2">
                                    {{ account.currency }}
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <span class="font-semibold tabular-nums">
                                        {{
                                            formatCurrency(
                                                account.current_balance,
                                                { currency: account.currency },
                                            )
                                        }}
                                    </span>
                                    <span
                                        v-if="account.allow_negative_balance"
                                        class="mt-0.5 block text-xs text-muted-foreground"
                                    >
                                        Admite saldo negativo
                                    </span>
                                </td>
                                <td class="px-3 py-2">
                                    <div
                                        class="flex flex-wrap items-center gap-1"
                                    >
                                        <Badge
                                            :variant="
                                                account.is_active
                                                    ? 'default'
                                                    : 'secondary'
                                            "
                                        >
                                            {{
                                                account.is_active
                                                    ? 'Activa'
                                                    : 'Inactiva'
                                            }}
                                        </Badge>
                                        <Badge
                                            v-if="account.is_legacy"
                                            variant="outline"
                                            :title="LEGACY_LEGEND"
                                        >
                                            <Lock class="size-3" />
                                            Protegida
                                        </Badge>
                                    </div>
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <button
                                        class="mr-3 text-primary"
                                        @click="
                                            movementFilters.page = 1;
                                            loadMovements(account);
                                        "
                                    >
                                        Movimientos
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        :disabled="account.is_legacy"
                                        :title="
                                            account.is_legacy
                                                ? LEGACY_LEGEND
                                                : 'Editar cuenta'
                                        "
                                        @click="openEdit(account)"
                                    >
                                        <Pencil class="size-4" />
                                        Editar
                                    </Button>
                                </td>
                            </tr>
                            <tr v-if="!loading && accounts.length === 0">
                                <td
                                    colspan="9"
                                    class="px-3 py-10 text-center text-sm text-muted-foreground"
                                >
                                    Aún no hay cuentas financieras registradas.
                                </td>
                            </tr>
                            <tr v-if="loading">
                                <td
                                    colspan="9"
                                    class="px-3 py-10 text-center text-sm text-muted-foreground"
                                >
                                    Cargando cuentas…
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="flex justify-end gap-4 text-sm">
                <span>{{ accountMeta.total }} cuentas</span
                ><button
                    :disabled="loading || accountFilters.page <= 1"
                    @click="
                        accountFilters.page--;
                        load();
                    "
                >
                    Anterior</button
                ><span
                    >{{ accountFilters.page }} /
                    {{ accountMeta.last_page }}</span
                ><button
                    :disabled="
                        loading || accountFilters.page >= accountMeta.last_page
                    "
                    @click="
                        accountFilters.page++;
                        load();
                    "
                >
                    Siguiente
                </button>
            </div>
            <section
                v-if="movementAccount"
                class="space-y-3 rounded-lg border p-4"
            >
                <header class="flex justify-between">
                    <h2 class="font-semibold">
                        Movimientos · {{ movementAccount.name }} ·
                        {{ movementAccount.currency }}
                    </h2>
                    <button
                        class="text-sm text-primary"
                        @click="movementAccount = null"
                    >
                        Cerrar
                    </button>
                </header>
                <form
                    class="flex flex-wrap items-end gap-3"
                    @submit.prevent="
                        movementFilters.page = 1;
                        loadMovements();
                    "
                >
                    <ReportPeriod
                        v-model:from="movementFilters.date_from"
                        v-model:to="movementFilters.date_to"
                    /><label class="text-xs"
                        >Referencia<input
                            v-model="movementFilters.search"
                            class="mt-1 block rounded border bg-background p-2" /></label
                    ><Button :disabled="movementsLoading">Consultar</Button>
                </form>
                <p class="text-sm">
                    Entradas:
                    {{
                        formatCurrency(
                            Number(movements.summary?.incoming || 0),
                            { currency: movementAccount.currency },
                        )
                    }}
                    · Salidas:
                    {{
                        formatCurrency(
                            Number(movements.summary?.outgoing || 0),
                            { currency: movementAccount.currency },
                        )
                    }}
                </p>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm whitespace-nowrap">
                        <thead class="bg-muted">
                            <tr>
                                <th class="p-2 text-left">
                                    Registro / fecha comercial
                                </th>
                                <th class="p-2 text-left">
                                    Origen / referencia
                                </th>
                                <th class="p-2 text-left">Responsable</th>
                                <th class="p-2 text-right">Importe</th>
                                <th class="p-2 text-right">Saldo posterior</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            <tr v-for="row in movements.data" :key="row.id">
                                <td class="p-2">
                                    {{ formatReportDateTime(row.created_at) }}
                                    <p class="text-xs">
                                        {{
                                            formatReportDateTime(
                                                row.business_datetime,
                                            )
                                        }}
                                    </p>
                                </td>
                                <td class="p-2">
                                    <Link
                                        v-if="row.document_url"
                                        :href="row.document_url"
                                        class="text-primary"
                                        >{{
                                            row.reference || `#${row.source_id}`
                                        }}</Link
                                    ><span v-else>{{
                                        row.reference || row.source_type
                                    }}</span>
                                    <p class="text-xs">{{ row.notes }}</p>
                                </td>
                                <td class="p-2">
                                    {{ row.creator?.name || '—' }}
                                </td>
                                <td class="p-2 text-right font-mono">
                                    {{ row.direction === 'out' ? '−' : '+'
                                    }}{{
                                        formatCurrency(Number(row.amount), {
                                            currency: movementAccount.currency,
                                        })
                                    }}
                                </td>
                                <td class="p-2 text-right font-mono">
                                    {{
                                        formatCurrency(
                                            Number(row.balance_after),
                                            {
                                                currency:
                                                    movementAccount.currency,
                                            },
                                        )
                                    }}
                                </td>
                            </tr>
                            <tr v-if="!movements.data.length">
                                <td colspan="5" class="p-5 text-center">
                                    {{
                                        movementsLoading
                                            ? 'Cargando…'
                                            : 'Sin movimientos.'
                                    }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="flex justify-end gap-4 text-sm">
                    <button
                        :disabled="
                            movementsLoading || movementFilters.page <= 1
                        "
                        @click="
                            movementFilters.page--;
                            loadMovements();
                        "
                    >
                        Anterior</button
                    ><span
                        >{{ movementFilters.page }} /
                        {{ movements.last_page }}</span
                    ><button
                        :disabled="
                            movementsLoading ||
                            movementFilters.page >= movements.last_page
                        "
                        @click="
                            movementFilters.page++;
                            loadMovements();
                        "
                    >
                        Siguiente
                    </button>
                </div>
            </section>
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
                    <div v-if="form.type === 'bank'">
                        <label class="mb-1.5 block text-sm font-medium"
                            >Banco o institución</label
                        >
                        <input
                            v-model="form.institution_name"
                            maxlength="120"
                            placeholder="Banco General"
                            class="h-10 w-full rounded-lg border bg-background px-3 text-sm"
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
                            (form.type === 'bank' &&
                                (!form.institution_name.trim() ||
                                    !form.masked_number.trim())) ||
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
