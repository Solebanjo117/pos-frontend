<script setup lang="ts">
import {
    Banknote,
    CreditCard,
    Wallet,
    X,
    AlertTriangle,
    Gift,
} from 'lucide-vue-next';
import { ref, computed, watch, onMounted } from 'vue';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import type { Customer } from '@/types/customer';
import type {
    PaymentMethod,
    PaymentMethodContext,
} from '@/types/payment-method';
import { formatCurrency, roundMoney } from '@/utils/formatters';

interface Payment {
    method: string;
    amount: number;
    reference_number?: string | null;
    notes?: string | null;
}

interface PaymentFinishMeta {
    reference_number?: string | null;
    notes?: string | null;
    supplier_credit_amount?: number;
}

const { methods, fetchMethods } = usePaymentMethods();

const props = withDefaults(
    defineProps<{
        show: boolean;
        amountToCharge: number;
        mode?: 'sale' | 'purchase';
        customer?: Customer | null;
        shippingCost?: number;
        editMode?: boolean;
        subtotal?: number;
        taxAmount?: number;
        discountAmount?: number;
        title?: string;
        primaryActionLabel?: string;
        cancelLabel?: string;
        showReferenceNumber?: boolean;
        showNotes?: boolean;
        referenceNumberLabel?: string;
        notesLabel?: string;
        loading?: boolean;
        error?: string | null;
        allowPartial?: boolean;
        allowedMethodCodes?: string[];
        includeSupplierCredit?: boolean;
        paymentContext?: PaymentMethodContext;
    }>(),
    {
        mode: 'sale',
        shippingCost: 0,
        editMode: false,
        subtotal: undefined,
        taxAmount: 0,
        discountAmount: 0,
        title: undefined,
        primaryActionLabel: undefined,
        cancelLabel: undefined,
        showReferenceNumber: false,
        showNotes: false,
        referenceNumberLabel: 'Numero de recibo',
        notesLabel: 'Notas',
        loading: false,
        error: null,
        allowPartial: false,
        allowedMethodCodes: undefined,
        includeSupplierCredit: false,
        paymentContext: undefined,
    },
);

const emit = defineEmits<{
    (e: 'finish', payments: Payment[], meta: PaymentFinishMeta): void;
    (e: 'cancel'): void;
}>();

const payments = ref<Record<string, number>>({});
const paymentReferences = ref<Record<string, string>>({});
const paymentNotes = ref<Record<string, string>>({});
const activeMethodCode = ref<string | null>(null);
const referenceNumber = ref('');
const notes = ref('');

const cashDenominations = [100, 50, 20, 10, 5, 1, 0.25];

const isPurchaseMode = computed(() => props.mode === 'purchase');
const resolvedPaymentContext = computed<PaymentMethodContext>(
    () =>
        props.paymentContext ??
        (isPurchaseMode.value ? 'purchase_orders' : 'sales'),
);
const panelTitle = computed(
    () => props.title ?? (isPurchaseMode.value ? 'Registrar pago' : 'PAYMENT'),
);
const primaryLabel = computed(
    () =>
        props.primaryActionLabel ??
        (isPurchaseMode.value ? 'Registrar pago' : 'Finalizar Venta'),
);
const secondaryLabel = computed(
    () =>
        props.cancelLabel ??
        (isPurchaseMode.value ? 'Cancelar' : '< Volver a la Venta'),
);

const effectiveAllowedMethods = computed(() => {
    if (props.allowedMethodCodes?.length) {
        return props.allowedMethodCodes;
    }

    return [];
});

const isAllowedMethod = (code: string): boolean => {
    if (!effectiveAllowedMethods.value.length) {
        return true;
    }

    return effectiveAllowedMethods.value.includes(code);
};

const sortedMethods = computed(() => {
    const seen = new Set<string>();

    return [...methods.value]
        .filter((method) => {
            if (
                !method.code ||
                !method.name ||
                method.is_archived ||
                seen.has(method.code)
            ) {
                return false;
            }

            seen.add(method.code);
            return true;
        })
        .sort((a, b) => {
            const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);

            return order !== 0 ? order : a.name.localeCompare(b.name);
        });
});

const methodIsAvailable = (code: string): boolean =>
    isAllowedMethod(code) &&
    sortedMethods.value.some(
        (method) =>
            method.code === code && method.is_active && !method.is_archived,
    );

const showCashMethod = computed(() => methodIsAvailable('cash'));

watch(
    () => props.show,
    (show) => {
        if (show) {
            fetchMethods(resolvedPaymentContext.value);
            resetPayments();
        }
    },
);

watch(resolvedPaymentContext, () => {
    if (props.show) {
        fetchMethods(resolvedPaymentContext.value);
        resetPayments();
    }
});

onMounted(() => {
    if (props.show) {
        fetchMethods(resolvedPaymentContext.value);
    }
});

const resetPayments = () => {
    payments.value = {};
    paymentReferences.value = {};
    paymentNotes.value = {};
    activeMethodCode.value = null;
    referenceNumber.value = '';
    notes.value = '';
};

const creditAvailable = computed(() => {
    if (!props.customer || isPurchaseMode.value) {
        return 0;
    }

    const limit = props.customer.credit_limit ?? 0;
    const balance = props.customer.current_balance ?? 0;

    return Math.max(0, limit - balance);
});

const creditDueDate = computed(() => {
    if (!props.customer || isPurchaseMode.value) {
        return null;
    }

    const days = Number(props.customer.credit_days ?? 0);

    if (!Number.isFinite(days) || days <= 0) {
        return null;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.floor(days));

    return dueDate.toLocaleDateString('es-PA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
});

const storeCreditAvailable = computed(() => {
    if (!props.customer || isPurchaseMode.value) {
        return 0;
    }

    return props.customer.store_credit ?? 0;
});

const showCreditMethod = computed(
    () => !isPurchaseMode.value && methodIsAvailable('credit'),
);

const creditDisabledReason = computed(() => {
    if (!showCreditMethod.value) {
        return null;
    }

    if (!props.customer) {
        return 'Selecciona un cliente para usar credito.';
    }

    if (creditAvailable.value <= 0) {
        return 'El cliente no tiene credito disponible.';
    }

    return null;
});

const creditCanBeUsed = computed(
    () => showCreditMethod.value && creditDisabledReason.value === null,
);

const showStoreCreditMethod = computed(
    () =>
        !isPurchaseMode.value &&
        Boolean(props.customer) &&
        storeCreditAvailable.value > 0 &&
        methodIsAvailable('store_credit'),
);

const normalizePaymentAmount = (value: unknown): number => {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
        return 0;
    }

    return roundMoney(Math.max(0, amount));
};

const setPaymentAmount = (code: string, value: unknown) => {
    payments.value[code] = normalizePaymentAmount(value);
};

const getPaymentAmount = (code: string): number =>
    normalizePaymentAmount(payments.value[code] ?? 0);

const getPaymentReference = (code: string): string =>
    paymentReferences.value[code] ?? '';

const getPaymentNotes = (code: string): string =>
    paymentNotes.value[code] ?? '';

const setPaymentReference = (code: string, value: string) => {
    paymentReferences.value[code] = value;
};

const setPaymentNotes = (code: string, value: string) => {
    paymentNotes.value[code] = value;
};

watch(creditCanBeUsed, (canUseCredit) => {
    if (!canUseCredit) {
        setPaymentAmount('credit', 0);
        setPaymentNotes('credit', '');
    }
});

const cashAmount = computed({
    get: () => payments.value.cash ?? 0,
    set: (val: number) => {
        setPaymentAmount('cash', val);
    },
});

const creditAmount = computed({
    get: () => payments.value.credit ?? 0,
    set: (val: number) => {
        setPaymentAmount('credit', val);
    },
});

const storeCreditAmount = computed({
    get: () => payments.value.store_credit ?? 0,
    set: (val: number) => {
        setPaymentAmount('store_credit', val);
    },
});

const supplierCreditAmount = computed(
    () => payments.value.supplier_credit ?? 0,
);

const dynamicMethods = computed(() =>
    sortedMethods.value.filter((method) => {
        if (
            !method.is_active ||
            method.is_archived ||
            !method.code ||
            !method.name ||
            !isAllowedMethod(method.code) ||
            method.code === 'cash'
        ) {
            return false;
        }

        if (isPurchaseMode.value) {
            if (
                ['credit', 'store_credit'].includes(method.code) ||
                (method.code === 'supplier_credit' &&
                    !props.includeSupplierCredit)
            ) {
                return false;
            }

            return true;
        }

        return !['credit', 'store_credit', 'supplier_credit'].includes(
            method.code,
        );
    }),
);

const activePaymentCodes = computed(() => {
    const codes = new Set(dynamicMethods.value.map((method) => method.code));

    if (showCashMethod.value) {
        codes.add('cash');
    }

    if (creditCanBeUsed.value) {
        codes.add('credit');
    }

    if (showStoreCreditMethod.value) {
        codes.add('store_credit');
    }

    return codes;
});

const selectableMethods = computed(() =>
    sortedMethods.value.filter((method) => {
        if (method.code === 'cash') {
            return showCashMethod.value;
        }

        if (method.code === 'credit') {
            return showCreditMethod.value;
        }

        if (method.code === 'store_credit') {
            return showStoreCreditMethod.value;
        }

        return dynamicMethods.value.some(
            (dynamicMethod) => dynamicMethod.code === method.code,
        );
    }),
);

const isMethodDisabled = (method: PaymentMethod): boolean =>
    method.code === 'credit' && !creditCanBeUsed.value;

watch(
    selectableMethods,
    (availableMethods) => {
        if (
            activeMethodCode.value &&
            availableMethods.some(
                (method) =>
                    method.code === activeMethodCode.value &&
                    !isMethodDisabled(method),
            )
        ) {
            return;
        }

        activeMethodCode.value =
            availableMethods.find((method) => !isMethodDisabled(method))
                ?.code ??
            availableMethods[0]?.code ??
            null;
    },
    { immediate: true },
);

const activeMethod = computed<PaymentMethod | null>(
    () =>
        selectableMethods.value.find(
            (method) => method.code === activeMethodCode.value,
        ) ?? null,
);

const selectedDynamicMethod = computed<PaymentMethod | null>(() => {
    if (!activeMethod.value) {
        return null;
    }

    return (
        dynamicMethods.value.find(
            (method) => method.code === activeMethod.value?.code,
        ) ?? null
    );
});

const methodBucketLabel = (method: PaymentMethod): string => {
    if (method.code === 'cash' || method.liquidity_bucket === 'cash') {
        return 'Cash';
    }

    if (method.code === 'credit' || method.liquidity_bucket === 'credit') {
        return 'Credito';
    }

    if (
        method.code === 'store_credit' ||
        method.liquidity_bucket === 'store_credit'
    ) {
        return 'Saldo';
    }

    return 'Banco';
};

const totalPaid = computed(() =>
    roundMoney(
        Array.from(activePaymentCodes.value).reduce(
            (sum, code) => sum + getPaymentAmount(code),
            0,
        ),
    ),
);

const remainingToPay = computed(() =>
    roundMoney(Math.max(0, props.amountToCharge - totalPaid.value)),
);

const changeToGive = computed(() => {
    const cashPaid = cashAmount.value;
    const nonCashPaid = totalPaid.value - cashPaid;
    const neededFromCash = props.amountToCharge - nonCashPaid;

    if (cashPaid > neededFromCash && neededFromCash > 0) {
        return roundMoney(cashPaid - neededFromCash);
    }

    return 0;
});

const effectiveCash = computed(() =>
    roundMoney(Math.max(0, cashAmount.value - changeToGive.value)),
);

const canFinish = computed(() => {
    if (props.loading) {
        return false;
    }

    if (props.allowPartial) {
        return totalPaid.value > 0;
    }

    if (totalPaid.value < props.amountToCharge) {
        return false;
    }

    if (!isPurchaseMode.value && creditAmount.value > creditAvailable.value) {
        return false;
    }

    if (
        !isPurchaseMode.value &&
        creditAmount.value > 0 &&
        !creditCanBeUsed.value
    ) {
        return false;
    }

    if (
        !isPurchaseMode.value &&
        storeCreditAmount.value > storeCreditAvailable.value
    ) {
        return false;
    }

    return true;
});

const handleMax = (methodCode: string) => {
    const remaining = remainingToPay.value;

    if (remaining <= 0) {
        return;
    }

    if (methodCode === 'credit') {
        if (!creditCanBeUsed.value) {
            return;
        }

        setPaymentAmount(
            methodCode,
            Math.min(remaining, creditAvailable.value),
        );
    } else if (methodCode === 'store_credit') {
        setPaymentAmount(
            methodCode,
            Math.min(remaining, storeCreditAvailable.value),
        );
    } else {
        setPaymentAmount(methodCode, remaining);
    }
};

const handleDenomination = (amount: number) => {
    cashAmount.value = amount;
};

const handleDynamicPayment = (code: string, value: number) => {
    setPaymentAmount(code, value);
};

const handleFinish = () => {
    const paymentList: Payment[] = [];

    if (effectiveCash.value > 0) {
        paymentList.push({
            method: 'cash',
            amount: roundMoney(effectiveCash.value),
            reference_number: getPaymentReference('cash') || null,
            notes: getPaymentNotes('cash') || null,
        });
    }

    if (creditCanBeUsed.value && creditAmount.value > 0) {
        paymentList.push({
            method: 'credit',
            amount: roundMoney(creditAmount.value),
            reference_number: getPaymentReference('credit') || null,
            notes: getPaymentNotes('credit') || null,
        });
    }

    if (showStoreCreditMethod.value && storeCreditAmount.value > 0) {
        paymentList.push({
            method: 'store_credit',
            amount: roundMoney(storeCreditAmount.value),
            reference_number: getPaymentReference('store_credit') || null,
            notes: getPaymentNotes('store_credit') || null,
        });
    }

    for (const method of dynamicMethods.value) {
        if (isPurchaseMode.value && method.code === 'supplier_credit') {
            continue;
        }

        const amount = payments.value[method.code] ?? 0;

        if (amount > 0) {
            paymentList.push({
                method: method.code,
                amount: getPaymentAmount(method.code),
                reference_number: getPaymentReference(method.code) || null,
                notes: getPaymentNotes(method.code) || null,
            });
        }
    }

    emit('finish', paymentList, {
        reference_number: referenceNumber.value || null,
        notes: notes.value || null,
        supplier_credit_amount: supplierCreditAmount.value,
    });
};

const handleCancel = () => {
    emit('cancel');
};
</script>

<template>
    <Transition name="modal">
        <div
            v-if="show"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
            <div
                class="flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-card"
            >
                <div class="flex flex-1 flex-col overflow-hidden">
                    <div
                        class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-green-600 px-6 py-4 dark:border-border"
                    >
                        <h2 class="text-xl font-bold text-white">
                            {{ panelTitle }}
                        </h2>
                        <button
                            type="button"
                            class="text-white/80 transition-colors hover:text-white"
                            @click="handleCancel"
                        >
                            <X class="h-5 w-5" />
                        </button>
                    </div>

                    <div class="flex-1 space-y-4 overflow-y-auto p-4">
                        <div
                            v-if="error"
                            class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                        >
                            {{ error }}
                        </div>

                        <div
                            v-if="selectableMethods.length > 0"
                            class="grid grid-cols-2 gap-2 md:grid-cols-3"
                        >
                            <button
                                v-for="method in selectableMethods"
                                :key="method.code"
                                type="button"
                                :disabled="isMethodDisabled(method)"
                                class="rounded-md border p-3 text-left transition hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
                                :class="[
                                    activeMethodCode === method.code
                                        ? 'border-green-500 bg-green-50 shadow-sm dark:bg-green-950/30'
                                        : 'border-gray-200 bg-white dark:border-border dark:bg-card',
                                    getPaymentAmount(method.code) > 0 &&
                                    activeMethodCode !== method.code &&
                                    !isMethodDisabled(method)
                                        ? 'border-green-300'
                                        : '',
                                    isMethodDisabled(method)
                                        ? 'cursor-not-allowed opacity-55 hover:border-gray-200 hover:bg-white dark:hover:bg-card'
                                        : '',
                                ]"
                                @click="
                                    !isMethodDisabled(method) &&
                                    (activeMethodCode = method.code)
                                "
                            >
                                <span
                                    class="block truncate text-sm font-semibold text-gray-900 dark:text-white"
                                >
                                    {{ method.name }}
                                </span>
                                <span
                                    class="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"
                                >
                                    {{ methodBucketLabel(method) }}
                                    <span
                                        v-if="method.requires_reference"
                                        class="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                                    >
                                        Ref.
                                    </span>
                                </span>
                                <span
                                    class="mt-1 block text-xs font-semibold"
                                    :class="
                                        getPaymentAmount(method.code) > 0
                                            ? 'text-green-700 dark:text-green-300'
                                            : 'text-muted-foreground/70'
                                    "
                                >
                                    {{
                                        getPaymentAmount(method.code) > 0
                                            ? formatCurrency(
                                                  getPaymentAmount(method.code),
                                              )
                                            : formatCurrency(0)
                                    }}
                                </span>
                                <span
                                    v-if="
                                        method.code === 'credit' &&
                                        creditDisabledReason
                                    "
                                    class="mt-1 block text-[10px] leading-tight text-amber-700 dark:text-amber-300"
                                >
                                    {{ creditDisabledReason }}
                                </span>
                            </button>
                        </div>

                        <div
                            v-else
                            class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                            No hay metodos de pago activos para venta.
                        </div>

                        <div
                            v-if="activeMethodCode === 'cash' && showCashMethod"
                            class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
                        >
                            <div class="mb-3 flex items-center gap-2">
                                <Banknote
                                    class="h-5 w-5 text-green-600 dark:text-green-400"
                                />
                                <span
                                    class="text-sm font-bold text-green-700 uppercase dark:text-green-300"
                                >
                                    Efectivo
                                </span>
                            </div>

                            <div class="mb-3 flex gap-2">
                                <div class="relative flex-1">
                                    <span
                                        class="absolute top-1/2 left-3 -translate-y-1/2 font-bold text-green-600"
                                    >
                                        $
                                    </span>
                                    <input
                                        v-model.number="cashAmount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        class="w-full rounded-md border border-green-300 bg-white py-2.5 pr-3 pl-8 text-right text-lg font-bold text-green-800 focus:ring-2 focus:ring-green-500 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    type="button"
                                    class="rounded-md bg-green-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700"
                                    @click="handleMax('cash')"
                                >
                                    Max
                                </button>
                            </div>

                            <div class="grid grid-cols-7 gap-1.5">
                                <button
                                    v-for="denom in cashDenominations"
                                    :key="denom"
                                    type="button"
                                    class="rounded-md bg-green-100 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-200 dark:bg-green-800/50 dark:text-green-200 dark:hover:bg-green-700"
                                    @click="handleDenomination(denom)"
                                >
                                    {{
                                        denom >= 1
                                            ? `$${denom}`
                                            : `${denom * 100}c`
                                    }}
                                </button>
                            </div>

                            <div
                                v-if="changeToGive > 0"
                                class="mt-3 rounded-md bg-yellow-100 p-2 text-center dark:bg-yellow-900/30"
                            >
                                <span
                                    class="text-sm text-yellow-700 dark:text-yellow-300"
                                >
                                    Cambio:
                                </span>
                                <span
                                    class="text-lg font-bold text-yellow-800 dark:text-yellow-200"
                                >
                                    {{ formatCurrency(changeToGive) }}
                                </span>
                            </div>
                        </div>

                        <div
                            v-if="
                                activeMethodCode === 'credit' &&
                                showCreditMethod
                            "
                            class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
                        >
                            <div class="mb-2 flex items-center gap-2">
                                <CreditCard
                                    class="h-5 w-5 text-amber-600 dark:text-amber-400"
                                />
                                <span
                                    class="text-sm font-bold text-amber-700 uppercase dark:text-amber-300"
                                >
                                    Credito
                                </span>
                                <span
                                    class="ml-auto text-xs text-amber-600 dark:text-amber-400"
                                >
                                    Disponible:
                                    {{ formatCurrency(creditAvailable) }}
                                </span>
                            </div>

                            <div
                                v-if="creditDisabledReason"
                                class="mb-3 rounded-md border border-amber-200 bg-white/70 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
                            >
                                {{ creditDisabledReason }}
                            </div>

                            <div
                                v-else-if="creditDueDate"
                                class="mb-3 rounded-md bg-white/70 p-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-200"
                            >
                                Vencimiento estimado:
                                <span class="font-semibold">
                                    {{ creditDueDate }}
                                </span>
                            </div>

                            <div class="flex gap-2">
                                <div class="relative flex-1">
                                    <span
                                        class="absolute top-1/2 left-3 -translate-y-1/2 font-bold text-amber-600"
                                    >
                                        $
                                    </span>
                                    <input
                                        v-model.number="creditAmount"
                                        type="number"
                                        min="0"
                                        :max="creditAvailable"
                                        :disabled="!creditCanBeUsed"
                                        step="0.01"
                                        class="w-full rounded-md border border-amber-300 bg-white py-2.5 pr-3 pl-8 text-right text-lg font-bold text-amber-800 focus:ring-2 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    type="button"
                                    class="rounded-md bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-700"
                                    :disabled="!creditCanBeUsed"
                                    @click="handleMax('credit')"
                                >
                                    Max
                                </button>
                            </div>

                            <div v-if="creditCanBeUsed" class="mt-3">
                                <label
                                    class="mb-1 block text-sm font-medium text-amber-700 dark:text-amber-300"
                                >
                                    Nota
                                </label>
                                <textarea
                                    :value="getPaymentNotes('credit')"
                                    rows="2"
                                    class="w-full resize-none rounded-md border border-amber-300 bg-white px-3 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
                                    placeholder="Nota opcional para CxC"
                                    @input="
                                        setPaymentNotes(
                                            'credit',
                                            (
                                                $event.target as HTMLTextAreaElement
                                            ).value,
                                        )
                                    "
                                ></textarea>
                            </div>

                            <p
                                v-if="creditAmount > creditAvailable"
                                class="mt-2 flex items-center gap-1 text-xs text-red-600"
                            >
                                <AlertTriangle class="h-3 w-3" />
                                Excede el credito disponible
                            </p>
                        </div>

                        <div
                            v-if="
                                activeMethodCode === 'store_credit' &&
                                showStoreCreditMethod
                            "
                            class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20"
                        >
                            <div class="mb-2 flex items-center gap-2">
                                <Gift
                                    class="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                                />
                                <span
                                    class="text-sm font-bold text-emerald-700 uppercase dark:text-emerald-300"
                                >
                                    Saldo a Favor
                                </span>
                                <span
                                    class="ml-auto text-xs text-emerald-600 dark:text-emerald-400"
                                >
                                    Disponible:
                                    {{ formatCurrency(storeCreditAvailable) }}
                                </span>
                            </div>

                            <div class="flex gap-2">
                                <div class="relative flex-1">
                                    <span
                                        class="absolute top-1/2 left-3 -translate-y-1/2 font-bold text-emerald-600"
                                    >
                                        $
                                    </span>
                                    <input
                                        v-model.number="storeCreditAmount"
                                        type="number"
                                        min="0"
                                        :max="storeCreditAvailable"
                                        step="0.01"
                                        class="w-full rounded-md border border-emerald-300 bg-white py-2.5 pr-3 pl-8 text-right text-lg font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    type="button"
                                    class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                                    @click="handleMax('store_credit')"
                                >
                                    Max
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="selectedDynamicMethod"
                            class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted/50"
                        >
                            <div class="mb-3 flex items-center gap-2">
                                <Wallet
                                    class="h-5 w-5 text-gray-600 dark:text-gray-400"
                                />
                                <span
                                    class="text-sm font-bold text-gray-700 uppercase dark:text-gray-300"
                                >
                                    {{ selectedDynamicMethod.name }}
                                </span>
                                <span
                                    class="ml-auto rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                    {{
                                        methodBucketLabel(selectedDynamicMethod)
                                    }}
                                </span>
                            </div>

                            <div class="space-y-3">
                                <div class="flex items-center gap-2">
                                    <div class="relative flex-1">
                                        <span
                                            class="absolute top-1/2 left-3 -translate-y-1/2 font-bold text-gray-500"
                                        >
                                            $
                                        </span>
                                        <input
                                            :value="
                                                getPaymentAmount(
                                                    selectedDynamicMethod.code,
                                                )
                                            "
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            class="w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-8 text-right text-lg font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                            placeholder="0.00"
                                            @input="
                                                handleDynamicPayment(
                                                    selectedDynamicMethod.code,
                                                    parseFloat(
                                                        (
                                                            $event.target as HTMLInputElement
                                                        ).value,
                                                    ) || 0,
                                                )
                                            "
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                                        @click="
                                            handleMax(
                                                selectedDynamicMethod.code,
                                            )
                                        "
                                    >
                                        Max
                                    </button>
                                </div>

                                <div
                                    v-if="
                                        selectedDynamicMethod.requires_reference
                                    "
                                >
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                        Referencia / autorizacion
                                    </label>
                                    <input
                                        :value="
                                            getPaymentReference(
                                                selectedDynamicMethod.code,
                                            )
                                        "
                                        type="text"
                                        class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                        placeholder="Ej: autorizacion, ACH, recibo"
                                        @input="
                                            setPaymentReference(
                                                selectedDynamicMethod.code,
                                                (
                                                    $event.target as HTMLInputElement
                                                ).value,
                                            )
                                        "
                                    />
                                </div>

                                <div
                                    v-if="
                                        selectedDynamicMethod.code === 'other'
                                    "
                                >
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                        Notas
                                    </label>
                                    <textarea
                                        :value="
                                            getPaymentNotes(
                                                selectedDynamicMethod.code,
                                            )
                                        "
                                        rows="2"
                                        class="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                        @input="
                                            setPaymentNotes(
                                                selectedDynamicMethod.code,
                                                (
                                                    $event.target as HTMLTextAreaElement
                                                ).value,
                                            )
                                        "
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div
                            v-if="showReferenceNumber || showNotes"
                            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                        >
                            <div
                                class="grid grid-cols-1 gap-3"
                                :class="
                                    showReferenceNumber && showNotes
                                        ? 'md:grid-cols-2'
                                        : ''
                                "
                            >
                                <div v-if="showReferenceNumber">
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                        {{ referenceNumberLabel }}
                                    </label>
                                    <input
                                        v-model="referenceNumber"
                                        type="text"
                                        placeholder="Ej: REC-001"
                                        class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <div v-if="showNotes">
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                        {{ notesLabel }}
                                    </label>
                                    <textarea
                                        v-model="notes"
                                        rows="2"
                                        class="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <slot name="details" />

                        <div
                            class="flex items-center justify-between rounded-lg bg-green-600 p-4"
                        >
                            <span
                                class="text-lg font-bold text-white uppercase"
                            >
                                Total
                            </span>
                            <span class="text-2xl font-bold text-white">
                                {{ formatCurrency(totalPaid) }}
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    class="flex w-72 flex-col border-l border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/30"
                >
                    <div class="space-y-2 p-4 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">
                                Subtotal
                            </span>
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(subtotal ?? amountToCharge) }}
                            </span>
                        </div>
                        <div
                            v-if="shippingCost && shippingCost > 0"
                            class="flex justify-between"
                        >
                            <span class="text-gray-500 dark:text-gray-400">
                                Envio
                            </span>
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(shippingCost) }}
                            </span>
                        </div>
                        <div
                            v-if="discountAmount && discountAmount > 0"
                            class="flex justify-between text-red-600 dark:text-red-400"
                        >
                            <span>Descuentos</span>
                            <span>-{{ formatCurrency(discountAmount) }}</span>
                        </div>
                        <div v-if="taxAmount" class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">
                                ITBMS
                            </span>
                            <span
                                class="font-medium text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(taxAmount) }}
                            </span>
                        </div>

                        <div
                            class="mt-2 border-t border-gray-200 pt-2 dark:border-border"
                        >
                            <div class="flex justify-between text-lg font-bold">
                                <span class="text-gray-900 dark:text-white">
                                    Total
                                </span>
                                <span
                                    class="text-indigo-600 dark:text-indigo-400"
                                >
                                    {{ formatCurrency(amountToCharge) }}
                                </span>
                            </div>
                        </div>

                        <div
                            class="mt-2 space-y-1 border-t border-gray-200 pt-2 dark:border-border"
                        >
                            <div class="flex justify-between">
                                <span class="text-gray-500 dark:text-gray-400">
                                    Pagos
                                </span>
                                <span
                                    class="font-medium text-green-600 dark:text-green-400"
                                >
                                    {{ formatCurrency(totalPaid) }}
                                </span>
                            </div>
                            <div class="flex justify-between font-bold">
                                <span class="text-gray-700 dark:text-gray-300">
                                    Balance
                                </span>
                                <span
                                    :class="
                                        remainingToPay > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'
                                    "
                                >
                                    {{ formatCurrency(remainingToPay) }}
                                </span>
                            </div>
                        </div>

                        <div
                            v-if="isPurchaseMode && supplierCreditAmount > 0"
                            class="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                            Credito proveedor no crea pago inmediato; queda como
                            saldo en cuentas por pagar.
                        </div>
                    </div>

                    <div class="flex-1"></div>

                    <div class="space-y-2 p-4">
                        <button
                            type="button"
                            :disabled="!canFinish"
                            class="w-full rounded-lg bg-green-600 py-3 font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                            @click="handleFinish"
                        >
                            {{ loading ? 'Guardando...' : primaryLabel }}
                        </button>
                        <button
                            type="button"
                            class="w-full py-2 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            @click="handleCancel"
                        >
                            {{ secondaryLabel }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
</style>
