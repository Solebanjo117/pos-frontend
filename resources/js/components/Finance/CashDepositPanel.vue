<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';
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
import apiClient from '@/services/api/client';
import type { MoneyAccountOption } from '@/types/financial-transfer';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';

const props = defineProps<{
    warehouseId: number;
    dateFrom: string;
    dateTo: string;
}>();
const emit = defineEmits<{ deposited: [] }>();
const { isAdmin } = useAuth();
type Source = {
    id: number;
    scope: 'sales' | 'receipts';
    document_number: string;
    amount: number | string;
    deposited: number | string;
    remaining: number | string;
    business_datetime: string;
    requires_reconciliation?: boolean;
};
const expanded = ref(false);
const loading = ref(false);
const saving = ref(false);
const confirmationOpen = ref(false);
const sources = ref<Source[]>([]);
const banks = ref<MoneyAccountOption[]>([]);
const amounts = ref<Record<string, number>>({});
const bankId = ref<number | ''>('');
const reference = ref('');
const effectiveAt = ref('');
const availability = ref<{ initialized: boolean; balance: number | null }>({
    initialized: false,
    balance: null,
});
const warehouseName = ref('');
const currency = ref('');
const warnings = ref<string[]>([]);
const summary = ref({
    collected: 0,
    deposited: 0,
    remaining: 0,
    blocked_remaining: 0,
    available_for_deposit: 0,
});
const error = ref('');
const success = ref<{ id: number; folio: string } | null>(null);
const page = ref(1);
const lastPage = ref(1);
let requestVersion = 0;
let lastPayload = '';
let idempotencyKey = '';
const key = (source: Source) => `${source.scope}-${source.id}`;
const allocations = computed(() =>
    sources.value
        .filter((source) => Number(amounts.value[key(source)]) > 0)
        .map((source) => ({
            scope: source.scope,
            id: source.id,
            amount: Number(amounts.value[key(source)]),
        })),
);
const totalCents = computed(() =>
    allocations.value.reduce(
        (sum, item) => sum + Math.round(item.amount * 100),
        0,
    ),
);
const selectedBank = computed(() =>
    banks.value.find((bank) => bank.endpoint_id === Number(bankId.value)),
);
const invalidAmount = computed(() =>
    sources.value.some((source) => {
        const amount = Number(amounts.value[key(source)] || 0);
        return (
            !Number.isFinite(amount) ||
            amount < 0 ||
            amount > Number(source.remaining) ||
            (amount > 0 && source.requires_reconciliation) ||
            Math.abs(amount - Math.round(amount * 100) / 100) > 0.000001
        );
    }),
);
const canSubmit = computed(
    () =>
        !loading.value &&
        !saving.value &&
        availability.value.initialized &&
        availability.value.balance !== null &&
        totalCents.value > 0 &&
        totalCents.value <= Math.round(availability.value.balance * 100) &&
        !invalidAmount.value &&
        !!selectedBank.value,
);

async function load(): Promise<void> {
    const version = ++requestVersion;
    loading.value = true;
    error.value = '';
    sources.value = [];
    amounts.value = {};
    bankId.value = '';
    try {
        const [result, options] = await Promise.all([
            apiClient.get('/cash/deposit-sources', {
                params: {
                    warehouse_id: props.warehouseId,
                    date_from: props.dateFrom,
                    date_to: props.dateTo,
                    page: page.value,
                },
            }),
            apiClient.get('/money-accounts/options', {
                params: { type: 'bank', purpose: 'transfer' },
            }),
        ]);
        if (version !== requestVersion) return;
        sources.value = result.data.data;
        availability.value = result.data.availability;
        warehouseName.value = result.data.warehouse.name;
        currency.value = result.data.currency;
        warnings.value = result.data.warnings || [];
        summary.value = result.data.summary;
        lastPage.value = result.data.meta.last_page;
        banks.value = options.data.data.filter(
            (bank: MoneyAccountOption) =>
                bank.account_type === 'bank' &&
                bank.currency === currency.value,
        );
    } catch (exception: any) {
        if (version === requestVersion)
            error.value =
                exception.response?.data?.message ||
                'No se pudieron consultar los cobros pendientes de depositar.';
    } finally {
        if (version === requestVersion) loading.value = false;
    }
}
async function toggle(): Promise<void> {
    expanded.value = !expanded.value;
    if (expanded.value) await load();
}
async function deposit(): Promise<void> {
    if (!canSubmit.value) return;
    const payload = {
        warehouse_id: props.warehouseId,
        financial_account_id: Number(bankId.value),
        date_from: props.dateFrom,
        date_to: props.dateTo,
        amount: totalCents.value / 100,
        allocations: allocations.value,
        reference: reference.value || null,
        business_datetime:
            isAdmin.value && effectiveAt.value
                ? new Date(effectiveAt.value).toISOString()
                : null,
    };
    const signature = JSON.stringify(payload);
    if (signature !== lastPayload) {
        lastPayload = signature;
        idempotencyKey = crypto.randomUUID();
    }
    saving.value = true;
    error.value = '';
    try {
        const result = await apiClient.post('/cash/deposits', {
            ...payload,
            idempotency_key: idempotencyKey,
        });
        success.value = {
            id: result.data.data.id,
            folio: result.data.data.folio,
        };
        lastPayload = '';
        confirmationOpen.value = false;
        emit('deposited');
        await load();
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo confirmar el depósito. Puede reintentar con la misma selección.';
        confirmationOpen.value = false;
    } finally {
        saving.value = false;
    }
}
watch(
    () => [props.warehouseId, props.dateFrom, props.dateTo],
    () => {
        confirmationOpen.value = false;
        success.value = null;
        page.value = 1;
        if (expanded.value && !saving.value) void load();
    },
);
</script>

<template>
    <section class="space-y-4 rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h2 class="font-semibold">Depositar cobros a banco</h2>
                <p class="text-sm text-muted-foreground">
                    Seleccione cobros del rango y asigne un importe parcial o
                    total. El pendiente de depositar puede haberse gastado.
                </p>
            </div>
            <Button
                variant="outline"
                :disabled="saving || !dateFrom || !dateTo"
                @click="toggle"
                >{{
                    expanded ? 'Cerrar selección' : 'Seleccionar cobros'
                }}</Button
            >
        </div>
        <p v-if="success" role="status" class="text-sm text-emerald-700">
            Depósito {{ success.folio }} registrado.
            <Link :href="`/finance/transfers/${success.id}`" class="underline"
                >Ver detalle y reversa</Link
            >
        </p>
        <template v-if="expanded">
            <p v-if="error" role="alert" class="text-sm text-destructive">
                {{ error }}
            </p>
            <p
                v-for="warning in warnings"
                :key="warning"
                role="status"
                class="rounded-md border border-amber-300 p-3 text-sm text-amber-800"
            >
                {{ warning }}
            </p>
            <div class="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                    <p class="text-muted-foreground">
                        Cobros del rango · {{ dateFrom }} a {{ dateTo }}
                    </p>
                    <p class="font-mono font-semibold">
                        {{ formatCurrency(Number(summary.collected)) }}
                    </p>
                </div>
                <div>
                    <p class="text-muted-foreground">
                        Pendiente habilitado para depositar
                    </p>
                    <p class="font-mono font-semibold">
                        {{
                            formatCurrency(
                                Number(
                                    summary.available_for_deposit ??
                                        summary.remaining,
                                ),
                            )
                        }}
                    </p>
                    <p
                        v-if="Number(summary.blocked_remaining) > 0"
                        class="text-xs text-amber-800"
                    >
                        {{ formatCurrency(Number(summary.blocked_remaining)) }}
                        requiere conciliación histórica.
                    </p>
                </div>
                <div>
                    <p class="text-muted-foreground">
                        Efectivo físico · {{ warehouseName }}
                    </p>
                    <p class="font-mono font-semibold">
                        {{
                            availability.initialized &&
                            availability.balance !== null
                                ? formatCurrency(availability.balance)
                                : 'Saldo sin inicializar'
                        }}
                    </p>
                </div>
            </div>
            <p
                v-if="!loading && !banks.length"
                role="alert"
                class="text-sm text-amber-800"
            >
                Configure una cuenta bancaria activa en {{ currency }} para
                registrar depósitos.
            </p>
            <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                    <thead class="bg-muted">
                        <tr>
                            <th class="p-3 text-left">
                                Cobro / fecha efectiva
                            </th>
                            <th class="p-3 text-right">Cobrado</th>
                            <th class="p-3 text-right">Depositado</th>
                            <th class="p-3 text-right">Pendiente</th>
                            <th class="p-3 text-left">Depositar ahora</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <tr v-for="source in sources" :key="key(source)">
                            <td class="p-3">
                                {{ source.document_number }}
                                <p class="text-xs text-muted-foreground">
                                    {{
                                        formatReportDateTime(
                                            source.business_datetime,
                                        )
                                    }}
                                </p>
                            </td>
                            <td class="p-3 text-right font-mono">
                                {{ formatCurrency(Number(source.amount)) }}
                            </td>
                            <td class="p-3 text-right font-mono">
                                {{ formatCurrency(Number(source.deposited)) }}
                            </td>
                            <td class="p-3 text-right font-mono">
                                <span
                                    v-if="source.requires_reconciliation"
                                    class="text-xs text-amber-800"
                                    >Requiere conciliación</span
                                >
                                <span v-else>{{
                                    formatCurrency(Number(source.remaining))
                                }}</span>
                            </td>
                            <td class="p-3">
                                <div class="flex gap-2">
                                    <input
                                        v-model.number="amounts[key(source)]"
                                        :aria-label="`Depositar ${source.document_number}`"
                                        type="number"
                                        min="0"
                                        :max="Number(source.remaining)"
                                        step="0.01"
                                        :disabled="
                                            saving ||
                                            source.requires_reconciliation ||
                                            Number(source.remaining) <= 0
                                        "
                                        class="w-28 rounded-md border bg-background p-2"
                                    /><Button
                                        variant="outline"
                                        size="sm"
                                        :disabled="
                                            saving ||
                                            source.requires_reconciliation ||
                                            Number(source.remaining) <= 0
                                        "
                                        @click="
                                            amounts[key(source)] = Number(
                                                source.remaining,
                                            )
                                        "
                                        >Todo</Button
                                    >
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!sources.length">
                            <td
                                colspan="5"
                                class="p-5 text-center text-muted-foreground"
                            >
                                {{
                                    loading
                                        ? 'Consultando cobros…'
                                        : 'No hay cobros en efectivo en este rango.'
                                }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div
                v-if="lastPage > 1"
                class="flex items-center justify-end gap-3 text-sm"
            >
                <Button
                    variant="outline"
                    :disabled="page <= 1 || loading || saving"
                    @click="
                        page--;
                        load();
                    "
                    >Anterior</Button
                ><span>{{ page }} / {{ lastPage }}</span
                ><Button
                    variant="outline"
                    :disabled="page >= lastPage || loading || saving"
                    @click="
                        page++;
                        load();
                    "
                    >Siguiente</Button
                >
            </div>
            <p class="text-xs text-muted-foreground">
                La selección corresponde a la página visible. Cada cobro
                conserva su pendiente al consultar otros rangos.
                <Link href="/finance/transfers" class="underline"
                    >Historial de depósitos y transferencias</Link
                >
            </p>
            <div class="flex flex-wrap items-end gap-3">
                <label class="text-sm"
                    >Banco de destino<select
                        v-model="bankId"
                        :disabled="saving"
                        aria-label="Banco de destino"
                        class="mt-1 block rounded-md border bg-background p-2"
                    >
                        <option value="">Seleccione una cuenta</option>
                        <option
                            v-for="bank in banks"
                            :key="bank.endpoint_id"
                            :value="bank.endpoint_id"
                        >
                            {{ bank.name }} · {{ bank.currency }}
                        </option>
                    </select></label
                >
                <label class="text-sm"
                    >Referencia<input
                        v-model="reference"
                        :disabled="saving"
                        maxlength="120"
                        class="mt-1 block rounded-md border bg-background p-2"
                /></label>
                <label v-if="isAdmin" class="text-sm"
                    >Fecha efectiva (opcional)<input
                        v-model="effectiveAt"
                        :disabled="saving"
                        type="datetime-local"
                        class="mt-1 block rounded-md border bg-background p-2"
                /></label>
                <div class="ml-auto text-right">
                    <p class="text-sm text-muted-foreground">Seleccionado</p>
                    <p class="font-mono font-semibold">
                        {{ formatCurrency(totalCents / 100) }}
                    </p>
                </div>
                <Button :disabled="!canSubmit" @click="confirmationOpen = true"
                    >Revisar depósito</Button
                >
            </div>
            <p
                v-if="
                    invalidAmount ||
                    (availability.balance !== null &&
                        totalCents > Math.round(availability.balance * 100))
                "
                role="alert"
                class="text-sm text-destructive"
            >
                Revise los importes: no pueden superar el pendiente por cobro ni
                el efectivo físico disponible.
            </p>
        </template>
        <Dialog v-model:open="confirmationOpen"
            ><DialogContent
                @escape-key-down="saving && $event.preventDefault()"
                @interact-outside="saving && $event.preventDefault()"
                ><DialogHeader
                    ><DialogTitle>Confirmar depósito</DialogTitle
                    ><DialogDescription
                        >Se reducirá el efectivo de {{ warehouseName }} y
                        aumentará {{ selectedBank?.name }} por
                        {{ formatCurrency(totalCents / 100) }} ({{ currency }}).
                        Los cobros originales conservarán sus
                        importes.</DialogDescription
                    ></DialogHeader
                >
                <p class="text-sm">
                    {{ allocations.length }} cobro(s) del {{ dateFrom }} al
                    {{ dateTo }}. Fecha efectiva:
                    {{
                        effectiveAt
                            ? formatReportDateTime(
                                  new Date(effectiveAt).toISOString(),
                              )
                            : 'Momento de confirmación'
                    }}.
                </p>
                <DialogFooter
                    ><Button
                        variant="outline"
                        :disabled="saving"
                        @click="confirmationOpen = false"
                        >Cancelar</Button
                    ><Button :disabled="!canSubmit" @click="deposit">{{
                        saving ? 'Registrando…' : 'Confirmar depósito'
                    }}</Button></DialogFooter
                ></DialogContent
            ></Dialog
        >
    </section>
</template>
