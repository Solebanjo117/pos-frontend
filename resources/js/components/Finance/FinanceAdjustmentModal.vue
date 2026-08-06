<script setup lang="ts">
import { CheckCircle2, LoaderCircle } from 'lucide-vue-next';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { financialAdjustmentsService } from '@/services/financial-adjustments';
import type {
    AdjustmentOption,
    FinancialAdjustment,
    FinancialAdjustmentDirection,
    FinancialAdjustmentOptions,
    FinancialAdjustmentPayload,
    FinancialAdjustmentType,
} from '@/types/financial-adjustment';
import { formatCurrency } from '@/utils/formatters';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
    (event: 'update:open', value: boolean): void;
    (event: 'submitted', adjustment: FinancialAdjustment): void;
}>();

const localDatetime = (): string => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};
const emptyOptions = (): FinancialAdjustmentOptions => ({
    types: [],
    directions: [],
    pos_sessions: [],
    financial_accounts: [],
    ledger_accounts: [],
    warehouses: [],
    customers: [],
    suppliers: [],
    sales_orders: [],
    purchase_orders: [],
    products: [],
});
const emptyForm = () => ({
    type: 'cash' as FinancialAdjustmentType,
    direction: 'increase' as FinancialAdjustmentDirection,
    amount: 0,
    quantity: 1,
    unit_cost: 0,
    reason: '',
    reference: '',
    notes: '',
    business_datetime: localDatetime(),
    warehouse_id: null as number | null,
    pos_session_id: null as number | null,
    financial_account_id: null as number | null,
    affected_ledger_account_id: null as number | null,
    counterparty_ledger_account_id: null as number | null,
    customer_id: null as number | null,
    sales_order_id: null as number | null,
    supplier_id: null as number | null,
    purchase_order_id: null as number | null,
    product_id: null as number | null,
    variant_id: null as number | null,
    liquidity_kind: 'cash' as 'cash' | 'bank',
});

const options = ref<FinancialAdjustmentOptions>(emptyOptions());
const form = ref(emptyForm());
const loading = ref(false);
const saving = ref(false);
const confirmation = ref(false);
const error = ref<string | null>(null);
const idempotencyKey = ref('');

const asSelect = (items: AdjustmentOption[]): SelectOption[] =>
    items.map((item) => ({
        value: item.value,
        label: item.label,
        sublabel: item.institution_name
            ? `${item.institution_name}${item.masked_number ? ` · ${item.masked_number}` : ''}${item.balance !== undefined ? ` · ${formatCurrency(item.balance)}` : ''}`
            : item.balance !== undefined
              ? `Saldo ${formatCurrency(item.balance)}`
              : undefined,
    }));
const typeOptions = computed(() => asSelect(options.value.types));
const directionOptions = computed(() => asSelect(options.value.directions));
const affectedLedgerOptions = computed(() => {
    const allowedTypes =
        form.value.type === 'sales'
            ? ['income']
            : form.value.type === 'expenses'
              ? ['expense']
              : form.value.type === 'purchases'
                ? ['asset', 'expense']
                : [];
    return asSelect(
        allowedTypes.length
            ? options.value.ledger_accounts.filter((item) =>
                  allowedTypes.includes(item.type || ''),
              )
            : options.value.ledger_accounts,
    );
});
const counterpartyOptions = computed(() =>
    asSelect(
        form.value.type === 'investment'
            ? options.value.ledger_accounts.filter(
                  (item) => item.type === 'equity',
              )
            : options.value.ledger_accounts,
    ),
);
const customerOrders = computed(() =>
    asSelect(
        options.value.sales_orders.filter(
            (item) => item.parent_id === form.value.customer_id,
        ),
    ),
);
const supplierOrders = computed(() =>
    asSelect(
        options.value.purchase_orders.filter(
            (item) => item.parent_id === form.value.supplier_id,
        ),
    ),
);
const selectedProduct = computed(() =>
    options.value.products.find((item) => item.value === form.value.product_id),
);
const variantOptions = computed(() =>
    asSelect(selectedProduct.value?.variants ?? []),
);
const selectedBank = computed(() =>
    options.value.financial_accounts.find(
        (item) => item.value === form.value.financial_account_id,
    ),
);
const selectedAffected = computed(() =>
    options.value.ledger_accounts.find(
        (item) => item.value === form.value.affected_ledger_account_id,
    ),
);
const selectedCounterparty = computed(() =>
    options.value.ledger_accounts.find(
        (item) => item.value === form.value.counterparty_ledger_account_id,
    ),
);
const needsAffectedLedger = computed(() =>
    ['sales', 'purchases', 'expenses', 'manual_correction'].includes(
        form.value.type,
    ),
);
const consultationDestination = computed(() => {
    const destinations: Record<FinancialAdjustmentType, string> = {
        cash: 'Caja y mayor contable',
        bank: 'Cuenta bancaria y mayor contable',
        inventory: 'Inventario, valoración y mayor contable',
        sales: 'Finanzas y Rentabilidad',
        purchases: 'Reportes de compras y mayor contable',
        expenses: 'Gastos y Finanzas y Rentabilidad',
        investment: 'Cuenta de liquidez y patrimonio',
        accounts_receivable: 'Cuenta del cliente y mayor contable',
        accounts_payable: 'Cuenta del proveedor y mayor contable',
        manual_correction: 'Mayor contable',
    };
    return destinations[form.value.type];
});
const canContinue = computed(() => {
    if (
        !form.value.reason.trim() ||
        !form.value.business_datetime ||
        !form.value.counterparty_ledger_account_id
    )
        return false;
    if (form.value.type !== 'inventory' && Number(form.value.amount) <= 0)
        return false;
    if (needsAffectedLedger.value && !form.value.affected_ledger_account_id)
        return false;
    if (
        form.value.affected_ledger_account_id ===
        form.value.counterparty_ledger_account_id
    )
        return false;
    if (form.value.type === 'cash' && !form.value.pos_session_id) return false;
    if (form.value.type === 'bank' && !form.value.financial_account_id)
        return false;
    if (
        form.value.type === 'investment' &&
        !(form.value.liquidity_kind === 'cash'
            ? form.value.pos_session_id
            : form.value.financial_account_id)
    )
        return false;
    if (
        form.value.type === 'inventory' &&
        (!form.value.warehouse_id ||
            !form.value.product_id ||
            Number(form.value.quantity) <= 0 ||
            (form.value.direction === 'increase' &&
                Number(form.value.unit_cost) <= 0))
    )
        return false;
    if (
        form.value.type === 'accounts_receivable' &&
        (!form.value.customer_id || !form.value.sales_order_id)
    )
        return false;
    if (
        form.value.type === 'accounts_payable' &&
        (!form.value.supplier_id || !form.value.purchase_order_id)
    )
        return false;
    return true;
});

watch(
    () => props.open,
    async (open) => {
        if (!open) return;
        form.value = emptyForm();
        confirmation.value = false;
        error.value = null;
        idempotencyKey.value = crypto.randomUUID();
        loading.value = true;
        try {
            options.value = await financialAdjustmentsService.options();
        } catch (err: any) {
            error.value =
                err.response?.data?.message ||
                'No se pudieron cargar las opciones del ajuste.';
        } finally {
            loading.value = false;
        }
    },
);

watch(
    () => form.value.type,
    () => {
        confirmation.value = false;
        form.value.pos_session_id = null;
        form.value.financial_account_id = null;
        form.value.affected_ledger_account_id = null;
        form.value.customer_id = null;
        form.value.sales_order_id = null;
        form.value.supplier_id = null;
        form.value.purchase_order_id = null;
        form.value.product_id = null;
        form.value.variant_id = null;
    },
);
watch(
    () => form.value.customer_id,
    () => (form.value.sales_order_id = null),
);
watch(
    () => form.value.supplier_id,
    () => (form.value.purchase_order_id = null),
);
watch(
    () => form.value.product_id,
    () => (form.value.variant_id = null),
);

async function submit(): Promise<void> {
    if (!canContinue.value || saving.value) return;
    saving.value = true;
    error.value = null;
    const payload: FinancialAdjustmentPayload = {
        idempotency_key: idempotencyKey.value,
        type: form.value.type,
        direction:
            form.value.type === 'manual_correction'
                ? undefined
                : form.value.direction,
        amount:
            form.value.type === 'inventory'
                ? undefined
                : Number(form.value.amount),
        reason: form.value.reason.trim(),
        reference: form.value.reference.trim() || undefined,
        notes: form.value.notes.trim() || undefined,
        business_datetime: form.value.business_datetime,
        counterparty_ledger_account_id: Number(
            form.value.counterparty_ledger_account_id,
        ),
        affected_ledger_account_id: form.value.affected_ledger_account_id,
        warehouse_id: form.value.warehouse_id,
        pos_session_id: form.value.pos_session_id,
        financial_account_id: form.value.financial_account_id,
        customer_id: form.value.customer_id,
        sales_order_id: form.value.sales_order_id,
        supplier_id: form.value.supplier_id,
        purchase_order_id: form.value.purchase_order_id,
        product_id: form.value.product_id,
        variant_id: form.value.variant_id,
        quantity:
            form.value.type === 'inventory'
                ? Number(form.value.quantity)
                : undefined,
        unit_cost:
            form.value.type === 'inventory' &&
            form.value.direction === 'increase'
                ? Number(form.value.unit_cost)
                : undefined,
    };
    try {
        const adjustment = await financialAdjustmentsService.create(payload);
        emit('submitted', adjustment);
        emit('update:open', false);
    } catch (err: any) {
        const validationErrors = err.response?.data?.errors as
            | Record<string, string[]>
            | undefined;
        const firstValidationError = validationErrors
            ? Object.values(validationErrors).flat()[0]
            : undefined;
        error.value =
            err.response?.data?.message ||
            firstValidationError ||
            'No se pudo completar el ajuste.';
        confirmation.value = false;
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
        <DialogContent class="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{{
                    confirmation
                        ? 'Confirmar ajuste'
                        : 'Nuevo ajuste financiero'
                }}</DialogTitle>
                <DialogDescription>
                    {{
                        confirmation
                            ? 'Revise las cuentas y el efecto antes de confirmar.'
                            : 'Registre una corrección trazable sin simular una operación normal.'
                    }}
                </DialogDescription>
            </DialogHeader>

            <div
                v-if="error"
                role="alert"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
                {{ error }}
            </div>
            <div
                v-if="loading"
                class="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
            >
                <LoaderCircle class="size-4 animate-spin" /> Cargando opciones…
            </div>

            <div v-else-if="confirmation" class="space-y-4">
                <div class="rounded-xl border bg-muted/30 p-4">
                    <div class="flex items-start gap-3">
                        <CheckCircle2 class="mt-0.5 size-5 text-primary" />
                        <div>
                            <p class="font-semibold">
                                {{
                                    options.types.find(
                                        (item) => item.value === form.type,
                                    )?.label
                                }}
                            </p>
                            <p class="mt-1 text-sm text-muted-foreground">
                                {{
                                    form.type === 'manual_correction'
                                        ? 'Débito y crédito explícitos'
                                        : options.directions.find(
                                              (item) =>
                                                  item.value === form.direction,
                                          )?.label
                                }}
                            </p>
                        </div>
                    </div>
                </div>
                <dl
                    class="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2"
                >
                    <div>
                        <dt class="text-muted-foreground">Monto</dt>
                        <dd class="mt-1 font-semibold">
                            {{
                                form.type === 'inventory'
                                    ? `${form.quantity} unidad(es) · valoración FIFO`
                                    : formatCurrency(form.amount)
                            }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">Cuenta afectada</dt>
                        <dd class="mt-1 font-semibold">
                            {{
                                selectedBank?.label ||
                                selectedAffected?.label ||
                                'Cuenta operativa seleccionada'
                            }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">Contrapartida</dt>
                        <dd class="mt-1 font-semibold">
                            {{ selectedCounterparty?.label }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">Dónde consultarlo</dt>
                        <dd class="mt-1 font-semibold">
                            {{ consultationDestination }}
                        </dd>
                    </div>
                    <div class="sm:col-span-2">
                        <dt class="text-muted-foreground">Motivo</dt>
                        <dd class="mt-1 font-semibold">{{ form.reason }}</dd>
                    </div>
                </dl>
            </div>

            <div v-else-if="!loading" class="grid gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2">
                    <Label>Tipo de ajuste</Label
                    ><SearchableSelect
                        v-model="form.type"
                        class="mt-1.5"
                        :options="typeOptions"
                        aria-label="Tipo de ajuste"
                    />
                </div>
                <div v-if="form.type !== 'manual_correction'">
                    <Label>Tipo de movimiento</Label
                    ><SearchableSelect
                        v-model="form.direction"
                        class="mt-1.5"
                        :options="directionOptions"
                        aria-label="Tipo de movimiento"
                    />
                </div>
                <div v-if="form.type !== 'inventory'">
                    <Label>Monto</Label
                    ><Input
                        v-model.number="form.amount"
                        class="mt-1.5"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                    />
                </div>

                <div v-if="form.type === 'cash'">
                    <Label>Sesión POS abierta</Label
                    ><SearchableSelect
                        v-model="form.pos_session_id"
                        class="mt-1.5"
                        :options="asSelect(options.pos_sessions)"
                    />
                </div>
                <template v-if="form.type === 'bank'">
                    <div class="sm:col-span-2">
                        <Label>Cuenta bancaria afectada</Label
                        ><SearchableSelect
                            v-model="form.financial_account_id"
                            class="mt-1.5"
                            :options="
                                asSelect(
                                    options.financial_accounts.filter(
                                        (item) => item.type === 'bank',
                                    ),
                                )
                            "
                        />
                    </div>
                    <div
                        v-if="selectedBank"
                        class="rounded-lg bg-muted/40 p-3 text-sm sm:col-span-2"
                    >
                        <span class="font-medium"
                            >{{ selectedBank.institution_name }} ·
                            {{ selectedBank.label }}</span
                        ><span class="text-muted-foreground">
                            · {{ selectedBank.masked_number }} · Saldo
                            {{
                                formatCurrency(selectedBank.balance || 0)
                            }}</span
                        >
                    </div>
                </template>
                <template v-if="form.type === 'investment'">
                    <div>
                        <Label>Cuenta que recibe/entrega</Label
                        ><SearchableSelect
                            v-model="form.liquidity_kind"
                            class="mt-1.5"
                            :options="[
                                { value: 'cash', label: 'Efectivo' },
                                { value: 'bank', label: 'Banco' },
                            ]"
                        />
                    </div>
                    <div v-if="form.liquidity_kind === 'cash'">
                        <Label>Sesión POS</Label
                        ><SearchableSelect
                            v-model="form.pos_session_id"
                            class="mt-1.5"
                            :options="asSelect(options.pos_sessions)"
                        />
                    </div>
                    <div v-else>
                        <Label>Cuenta financiera</Label
                        ><SearchableSelect
                            v-model="form.financial_account_id"
                            class="mt-1.5"
                            :options="
                                asSelect(
                                    options.financial_accounts.filter(
                                        (item) => item.type === 'bank',
                                    ),
                                )
                            "
                        />
                    </div>
                </template>
                <template v-if="form.type === 'inventory'">
                    <div>
                        <Label>Almacén</Label
                        ><SearchableSelect
                            v-model="form.warehouse_id"
                            class="mt-1.5"
                            :options="asSelect(options.warehouses)"
                        />
                    </div>
                    <div>
                        <Label>Producto</Label
                        ><SearchableSelect
                            v-model="form.product_id"
                            class="mt-1.5"
                            :options="asSelect(options.products)"
                        />
                    </div>
                    <div v-if="variantOptions.length">
                        <Label>Variante</Label
                        ><SearchableSelect
                            v-model="form.variant_id"
                            class="mt-1.5"
                            :options="variantOptions"
                            clearable
                        />
                    </div>
                    <div>
                        <Label>Cantidad</Label
                        ><Input
                            v-model.number="form.quantity"
                            class="mt-1.5"
                            type="number"
                            min="1"
                            step="1"
                        />
                    </div>
                    <div v-if="form.direction === 'increase'">
                        <Label>Costo unitario</Label
                        ><Input
                            v-model.number="form.unit_cost"
                            class="mt-1.5"
                            type="number"
                            min="0.0001"
                            step="0.0001"
                        />
                    </div>
                </template>
                <template v-if="form.type === 'accounts_receivable'">
                    <div>
                        <Label>Cliente</Label
                        ><SearchableSelect
                            v-model="form.customer_id"
                            class="mt-1.5"
                            :options="asSelect(options.customers)"
                        />
                    </div>
                    <div>
                        <Label>Venta relacionada</Label
                        ><SearchableSelect
                            v-model="form.sales_order_id"
                            class="mt-1.5"
                            :options="customerOrders"
                            :disabled="!form.customer_id"
                        />
                    </div>
                </template>
                <template v-if="form.type === 'accounts_payable'">
                    <div>
                        <Label>Proveedor</Label
                        ><SearchableSelect
                            v-model="form.supplier_id"
                            class="mt-1.5"
                            :options="asSelect(options.suppliers)"
                        />
                    </div>
                    <div>
                        <Label>Compra relacionada</Label
                        ><SearchableSelect
                            v-model="form.purchase_order_id"
                            class="mt-1.5"
                            :options="supplierOrders"
                            :disabled="!form.supplier_id"
                        />
                    </div>
                </template>
                <div v-if="needsAffectedLedger" class="sm:col-span-2">
                    <Label>{{
                        form.type === 'manual_correction'
                            ? 'Cuenta débito'
                            : 'Cuenta afectada'
                    }}</Label
                    ><SearchableSelect
                        v-model="form.affected_ledger_account_id"
                        class="mt-1.5"
                        :options="affectedLedgerOptions"
                    />
                </div>
                <div class="sm:col-span-2">
                    <Label>{{
                        form.type === 'manual_correction'
                            ? 'Cuenta crédito'
                            : 'Cuenta de contrapartida'
                    }}</Label
                    ><SearchableSelect
                        v-model="form.counterparty_ledger_account_id"
                        class="mt-1.5"
                        :options="counterpartyOptions"
                    />
                </div>
                <div>
                    <Label>Fecha y hora</Label
                    ><Input
                        v-model="form.business_datetime"
                        class="mt-1.5"
                        type="datetime-local"
                    />
                </div>
                <div>
                    <Label>Referencia o documento</Label
                    ><Input
                        v-model="form.reference"
                        class="mt-1.5"
                        maxlength="120"
                        placeholder="Opcional"
                    />
                </div>
                <div class="sm:col-span-2">
                    <Label>Motivo</Label
                    ><Input
                        v-model="form.reason"
                        class="mt-1.5"
                        maxlength="255"
                        placeholder="Explique por qué se requiere la corrección"
                    />
                </div>
                <div class="sm:col-span-2">
                    <Label>Notas</Label
                    ><textarea
                        v-model="form.notes"
                        rows="3"
                        class="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="Detalle adicional, autorización o evidencia"
                    />
                </div>
            </div>

            <DialogFooter>
                <Button
                    variant="outline"
                    :disabled="saving"
                    @click="
                        confirmation
                            ? (confirmation = false)
                            : emit('update:open', false)
                    "
                    >{{ confirmation ? 'Volver' : 'Cancelar' }}</Button
                >
                <Button
                    v-if="!confirmation"
                    :disabled="!canContinue || loading"
                    @click="confirmation = true"
                    >Revisar ajuste</Button
                >
                <Button v-else :disabled="saving" @click="submit"
                    ><LoaderCircle v-if="saving" class="size-4 animate-spin" />
                    Confirmar y registrar</Button
                >
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
