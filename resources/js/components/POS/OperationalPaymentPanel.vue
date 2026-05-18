<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
    Banknote,
    CreditCard,
    Wallet,
    X,
    AlertTriangle,
    Gift,
} from 'lucide-vue-next';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import type { Customer } from '@/types/customer';

interface Payment {
    method: string;
    amount: number;
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
    },
);

const emit = defineEmits<{
    (e: 'finish', payments: Payment[], meta: PaymentFinishMeta): void;
    (e: 'cancel'): void;
}>();

const payments = ref<Record<string, number>>({});
const referenceNumber = ref('');
const notes = ref('');

const cashDenominations = [100, 50, 20, 10, 5, 1, 0.25];
const defaultPurchaseAllowedMethods = ['cash', 'card', 'transfer', 'other'];

const isPurchaseMode = computed(() => props.mode === 'purchase');
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

    if (isPurchaseMode.value) {
        return props.includeSupplierCredit
            ? [...defaultPurchaseAllowedMethods, 'supplier_credit']
            : defaultPurchaseAllowedMethods;
    }

    return [];
});

const isAllowedMethod = (code: string): boolean => {
    if (!effectiveAllowedMethods.value.length) {
        return true;
    }

    return effectiveAllowedMethods.value.includes(code);
};

const showCashMethod = computed(() => isAllowedMethod('cash'));

watch(
    () => props.show,
    (show) => {
        if (show) {
            fetchMethods();
            resetPayments();
        }
    },
);

onMounted(() => {
    if (props.show) {
        fetchMethods();
    }
});

const resetPayments = () => {
    payments.value = {};
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

const storeCreditAvailable = computed(() => {
    if (!props.customer || isPurchaseMode.value) {
        return 0;
    }

    return props.customer.store_credit ?? 0;
});

const cashAmount = computed({
    get: () => payments.value.cash ?? 0,
    set: (val: number) => {
        payments.value.cash = val;
    },
});

const creditAmount = computed({
    get: () => payments.value.credit ?? 0,
    set: (val: number) => {
        payments.value.credit = val;
    },
});

const storeCreditAmount = computed({
    get: () => payments.value.store_credit ?? 0,
    set: (val: number) => {
        payments.value.store_credit = val;
    },
});

const supplierCreditAmount = computed(
    () => payments.value.supplier_credit ?? 0,
);

const dynamicMethods = computed(() =>
    methods.value.filter((method) => {
        if (!method.is_active || method.code === 'cash') {
            return false;
        }

        if (isPurchaseMode.value) {
            if (
                method.code === 'supplier_credit' &&
                !props.includeSupplierCredit
            ) {
                return false;
            }

            return isAllowedMethod(method.code);
        }

        return !['credit', 'store_credit', 'supplier_credit'].includes(
            method.code,
        );
    }),
);

const totalPaid = computed(() =>
    Object.values(payments.value).reduce((sum, val) => sum + (val || 0), 0),
);

const remainingToPay = computed(() =>
    Math.max(0, props.amountToCharge - totalPaid.value),
);

const changeToGive = computed(() => {
    const cashPaid = cashAmount.value;
    const nonCashPaid = totalPaid.value - cashPaid;
    const neededFromCash = props.amountToCharge - nonCashPaid;

    if (cashPaid > neededFromCash && neededFromCash > 0) {
        return cashPaid - neededFromCash;
    }

    return 0;
});

const effectiveCash = computed(() =>
    Math.max(0, cashAmount.value - changeToGive.value),
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
        payments.value[methodCode] = Math.min(remaining, creditAvailable.value);
    } else if (methodCode === 'store_credit') {
        payments.value[methodCode] = Math.min(
            remaining,
            storeCreditAvailable.value,
        );
    } else {
        payments.value[methodCode] = remaining;
    }
};

const handleDenomination = (amount: number) => {
    cashAmount.value = amount;
};

const handleDynamicPayment = (code: string, value: number) => {
    payments.value[code] = value;
};

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);

const handleFinish = () => {
    const paymentList: Payment[] = [];

    if (effectiveCash.value > 0) {
        paymentList.push({ method: 'cash', amount: effectiveCash.value });
    }

    if (!isPurchaseMode.value && creditAmount.value > 0) {
        paymentList.push({ method: 'credit', amount: creditAmount.value });
    }

    if (!isPurchaseMode.value && storeCreditAmount.value > 0) {
        paymentList.push({
            method: 'store_credit',
            amount: storeCreditAmount.value,
        });
    }

    for (const method of dynamicMethods.value) {
        if (isPurchaseMode.value && method.code === 'supplier_credit') {
            continue;
        }

        const amount = payments.value[method.code] ?? 0;

        if (amount > 0) {
            paymentList.push({ method: method.code, amount });
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
                            v-if="showCashMethod"
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
                                !isPurchaseMode &&
                                customer &&
                                creditAvailable > 0
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
                                        step="0.01"
                                        class="w-full rounded-md border border-amber-300 bg-white py-2.5 pr-3 pl-8 text-right text-lg font-bold text-amber-800 focus:ring-2 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    type="button"
                                    class="rounded-md bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-700"
                                    @click="handleMax('credit')"
                                >
                                    Max
                                </button>
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
                                !isPurchaseMode &&
                                customer &&
                                storeCreditAvailable > 0
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
                            v-if="dynamicMethods.length > 0"
                            class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted/50"
                        >
                            <div class="mb-3 flex items-center gap-2">
                                <Wallet
                                    class="h-5 w-5 text-gray-600 dark:text-gray-400"
                                />
                                <span
                                    class="text-sm font-bold text-gray-700 uppercase dark:text-gray-300"
                                >
                                    Otros metodos
                                </span>
                            </div>

                            <div class="space-y-2">
                                <div
                                    v-for="method in dynamicMethods"
                                    :key="method.code"
                                    class="flex items-center gap-2"
                                >
                                    <label
                                        class="w-32 truncate text-sm font-medium text-gray-600 uppercase dark:text-gray-400"
                                    >
                                        {{ method.name }}
                                    </label>
                                    <div class="relative flex-1">
                                        <span
                                            class="absolute top-1/2 left-3 -translate-y-1/2 font-bold text-gray-500"
                                        >
                                            $
                                        </span>
                                        <input
                                            :value="payments[method.code] ?? 0"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            class="w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-8 text-right text-gray-800 focus:ring-2 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                            placeholder="0.00"
                                            @input="
                                                handleDynamicPayment(
                                                    method.code,
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
                                        class="rounded-md bg-blue-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                                        @click="handleMax(method.code)"
                                    >
                                        Max
                                    </button>
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
