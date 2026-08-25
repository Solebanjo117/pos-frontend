<script setup lang="ts">
import { AlertCircle, LoaderCircle, X } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { financialTransfersService } from '@/services/financial-transfers';
import type {
    FinancialDocument,
    FinancialDocumentMode,
} from '@/types/financial-document';
import type { MoneyAccountOption } from '@/types/financial-transfer';
import { formatCurrency } from '@/utils/formatters';
import { createIdempotencyKey } from '@/utils/idempotency';

const props = defineProps<{
    open: boolean;
    mode: FinancialDocumentMode;
    document: FinancialDocument | null;
    loading?: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    close: [];
    submit: [
        payload: {
            amount: number;
            method: string;
            reference_number?: string;
            notes?: string;
            paid_at?: string;
            pos_session_id?: number;
            financial_account_id?: number;
            idempotency_key: string;
            applications: Array<{ document_id: number; amount: number }>;
        },
    ];
}>();

const { methods, fetchMethods } = usePaymentMethods();
const accounts = ref<MoneyAccountOption[]>([]);
const amount = ref(0);
const method = ref<string | null>(null);
const accountKey = ref<string | null>(null);
const reference = ref('');
const notes = ref('');
const paidAt = ref(new Date().toISOString().slice(0, 10));
const localError = ref<string | null>(null);
const idempotencyKey = ref(createIdempotencyKey());

const title = computed(() =>
    props.mode === 'payable' ? 'Registrar pago' : 'Registrar cobro',
);
const selectedMethod = computed(() =>
    methods.value.find((item) => item.code === method.value),
);
const needsCashSession = computed(
    () =>
        method.value === 'cash' ||
        selectedMethod.value?.liquidity_bucket === 'cash',
);
const availableAccounts = computed(() =>
    accounts.value.filter((account) =>
        needsCashSession.value
            ? account.endpoint_type === 'pos_session'
            : account.endpoint_type === 'financial_account',
    ),
);
const methodOptions = computed<SelectOption[]>(() =>
    methods.value.map((item) => ({ value: item.code, label: item.name })),
);
const accountOptions = computed<SelectOption[]>(() =>
    availableAccounts.value.map((account) => ({
        value: `${account.endpoint_type}:${account.endpoint_id}`,
        label: account.name,
        sublabel: `${account.masked_number ?? account.account_type} · ${formatCurrency(account.balance)}`,
    })),
);
const selectedAccount = computed(() =>
    accounts.value.find(
        (account) =>
            `${account.endpoint_type}:${account.endpoint_id}` ===
            accountKey.value,
    ),
);

const reset = (): void => {
    amount.value = Number(props.document?.balance ?? 0);
    method.value = methods.value[0]?.code ?? null;
    accountKey.value = null;
    reference.value = '';
    notes.value = '';
    paidAt.value = new Date().toISOString().slice(0, 10);
    localError.value = null;
    idempotencyKey.value = createIdempotencyKey();
};

const loadOptions = async (): Promise<void> => {
    await fetchMethods(
        props.mode === 'payable' ? 'supplier_payments' : 'customer_receipts',
        true,
    );
    accounts.value = await financialTransfersService.options(
        undefined,
        'settlement',
    );
    reset();
};

watch(
    () => props.open,
    async (open) => {
        if (open) {
            await loadOptions();
        }
    },
);

watch(method, () => {
    if (
        selectedAccount.value &&
        !availableAccounts.value.some(
            (account) =>
                account.endpoint_type ===
                    selectedAccount.value?.endpoint_type &&
                account.endpoint_id === selectedAccount.value?.endpoint_id,
        )
    ) {
        accountKey.value = null;
    }
});

onMounted(() => {
    if (props.open) {
        loadOptions();
    }
});

const submit = (): void => {
    localError.value = null;
    if (!props.document || !method.value) {
        localError.value = 'Selecciona un método de pago.';
        return;
    }
    if (!selectedAccount.value) {
        localError.value = needsCashSession.value
            ? 'Selecciona una sesión de caja abierta.'
            : 'Selecciona una cuenta financiera.';
        return;
    }
    if (
        amount.value <= 0 ||
        amount.value > Number(props.document.balance) + 0.01
    ) {
        localError.value =
            'El monto debe ser mayor a cero y no exceder el saldo.';
        return;
    }

    emit('submit', {
        idempotency_key: idempotencyKey.value,
        amount: Number(amount.value),
        method: method.value,
        reference_number: reference.value || undefined,
        notes: notes.value || undefined,
        paid_at: paidAt.value || undefined,
        pos_session_id:
            selectedAccount.value.endpoint_type === 'pos_session'
                ? selectedAccount.value.endpoint_id
                : undefined,
        financial_account_id:
            selectedAccount.value.endpoint_type === 'financial_account'
                ? selectedAccount.value.endpoint_id
                : undefined,
        applications: [
            { document_id: props.document.id, amount: Number(amount.value) },
        ],
    });
};
</script>

<template>
    <div
        v-if="open && document"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
    >
        <form
            class="w-full max-w-xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card"
            role="dialog"
            aria-modal="true"
            @submit.prevent="submit"
        >
            <div
                class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-border"
            >
                <div>
                    <h2 class="text-lg font-bold">{{ title }}</h2>
                    <p class="text-sm text-gray-500">
                        {{ document.document_number }} ·
                        {{ document.party.name }}
                    </p>
                </div>
                <button
                    type="button"
                    class="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-muted"
                    aria-label="Cerrar"
                    :disabled="loading"
                    @click="emit('close')"
                >
                    <X :size="18" />
                </button>
            </div>

            <div class="space-y-4 p-5">
                <div
                    class="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-muted/50"
                >
                    <span class="text-sm text-gray-500">Saldo pendiente</span>
                    <strong class="text-xl">{{
                        formatCurrency(document.balance)
                    }}</strong>
                </div>

                <div
                    v-if="localError || error"
                    class="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                >
                    <AlertCircle :size="16" class="mt-0.5 shrink-0" />
                    {{ localError || error }}
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                    <label class="space-y-1">
                        <span
                            class="text-xs font-semibold text-gray-500 uppercase"
                            >Monto</span
                        >
                        <input
                            v-model.number="amount"
                            type="number"
                            min="0.01"
                            :max="document.balance"
                            step="0.01"
                            class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-border dark:bg-background"
                        />
                    </label>
                    <label class="space-y-1">
                        <span
                            class="text-xs font-semibold text-gray-500 uppercase"
                            >Fecha</span
                        >
                        <input
                            v-model="paidAt"
                            type="date"
                            class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-border dark:bg-background"
                        />
                    </label>
                    <div class="space-y-1">
                        <span
                            class="text-xs font-semibold text-gray-500 uppercase"
                            >Método</span
                        >
                        <SearchableSelect
                            v-model="method"
                            :options="methodOptions"
                            placeholder="Selecciona un método"
                        />
                    </div>
                    <div class="space-y-1">
                        <span
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            {{
                                needsCashSession
                                    ? 'Sesión de caja'
                                    : mode === 'payable'
                                      ? 'Cuenta de origen'
                                      : 'Cuenta de destino'
                            }}
                        </span>
                        <SearchableSelect
                            v-model="accountKey"
                            :options="accountOptions"
                            placeholder="Selecciona una cuenta"
                        />
                    </div>
                    <label class="space-y-1 sm:col-span-2">
                        <span
                            class="text-xs font-semibold text-gray-500 uppercase"
                            >Referencia</span
                        >
                        <input
                            v-model="reference"
                            class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-border dark:bg-background"
                            maxlength="100"
                        />
                    </label>
                    <label class="space-y-1 sm:col-span-2">
                        <span
                            class="text-xs font-semibold text-gray-500 uppercase"
                            >Notas</span
                        >
                        <textarea
                            v-model="notes"
                            rows="3"
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-background"
                            maxlength="500"
                        />
                    </label>
                </div>
            </div>

            <div
                class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-border"
            >
                <button
                    type="button"
                    class="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-border"
                    :disabled="loading"
                    @click="emit('close')"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    :disabled="loading"
                >
                    <LoaderCircle
                        v-if="loading"
                        :size="16"
                        class="animate-spin"
                    />
                    {{ title }}
                </button>
            </div>
        </form>
    </div>
</template>
