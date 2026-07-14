<script setup lang="ts">
import {
    X,
    ArrowDownUp,
    ArrowUpRight,
    ArrowDownLeft,
    Banknote,
    FileText,
    Loader2,
} from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

interface Props {
    show: boolean;
    loading?: boolean;
    error?: string | null;
    initialType?: 'in' | 'out';
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    error: null,
    initialType: 'out',
});

const emit = defineEmits<{
    close: [];
    submit: [
        payload: {
            type: 'in' | 'out';
            subtype: 'cash_in' | 'cash_out' | 'deposit' | 'withdrawal' | 'adjustment_positive' | 'adjustment_negative';
            amount: number;
            reason: string;
            reference_number: string;
            notes: string;
        },
    ];
}>();

const movementType = ref<'out' | 'in'>('out');
const subtype = ref<'cash_in' | 'cash_out' | 'deposit' | 'withdrawal' | 'adjustment_positive' | 'adjustment_negative'>('cash_out');
const amount = ref<number | null>(null);
const reason = ref('');
const referenceNumber = ref('');
const notes = ref('');

const reasons = [
    'Pago de agua',
    'Pago de luz',
    'Pago de internet',
    'Servicios',
    'Compra de insumos',
    'Fletes / Envíos',
    'Otros',
];

const operations = [
    { value: 'cash_in', label: 'Entrada de efectivo', type: 'in' },
    { value: 'cash_out', label: 'Salida de efectivo', type: 'out' },
    { value: 'deposit', label: 'Deposito desde Caja', type: 'out' },
    { value: 'withdrawal', label: 'Retiro hacia Caja', type: 'in' },
    { value: 'adjustment_positive', label: 'Ajuste positivo (admin)', type: 'in' },
    { value: 'adjustment_negative', label: 'Ajuste negativo (admin)', type: 'out' },
] as const;

watch(subtype, (value) => {
    movementType.value = operations.find((operation) => operation.value === value)?.type ?? 'out';
});

const isValid = computed(() => {
    return amount.value && amount.value > 0 && reason.value.trim().length > 0;
});

const handleSubmit = () => {
    if (!isValid.value) return;
    emit('submit', {
        type: movementType.value,
        subtype: subtype.value,
        amount: amount.value!,
        reason: reason.value,
        reference_number: referenceNumber.value,
        notes: notes.value,
    });
};

const resetForm = () => {
    movementType.value = props.initialType;
    subtype.value = props.initialType === 'in' ? 'cash_in' : 'cash_out';
    amount.value = null;
    reason.value = '';
    referenceNumber.value = '';
    notes.value = '';
};

watch(
    () => [props.show, props.initialType] as const,
    ([show, initialType]) => {
        if (show) {
            movementType.value = initialType;
            subtype.value = initialType === 'in' ? 'cash_in' : 'cash_out';
        }
    },
    { immediate: true },
);

const handleClose = () => {
    resetForm();
    emit('close');
};
</script>

<template>
    <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        @click.self="handleClose"
    >
        <div
            class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-card"
        >
            <!-- Header -->
            <div
                class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border"
            >
                <h2
                    class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"
                >
                    <ArrowDownUp :size="20" class="text-indigo-500" />
                    Movimiento de Caja
                </h2>
                <button
                    @click="handleClose"
                    class="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-muted/50"
                >
                    <X :size="18" />
                </button>
            </div>

            <div class="space-y-5 p-6">
                <!-- Type Toggle -->
                <div>
                    <label
                        class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >Tipo de Movimiento</label
                    >
                    <div class="grid grid-cols-2 gap-2">
                        <button
                            @click="subtype = 'cash_out'"
                            :class="
                                movementType === 'out'
                                    ? 'bg-red-50 text-red-700 ring-2 ring-red-500 dark:bg-red-900/20 dark:text-red-400'
                                    : 'bg-gray-50 text-gray-600 dark:bg-muted dark:text-gray-300'
                            "
                            class="flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-all"
                        >
                            <ArrowUpRight :size="18" />
                            Retiro / Gasto
                        </button>
                        <button
                            @click="subtype = 'cash_in'"
                            :class="
                                movementType === 'in'
                                    ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400'
                                    : 'bg-gray-50 text-gray-600 dark:bg-muted dark:text-gray-300'
                            "
                            class="flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-all"
                        >
                            <ArrowDownLeft :size="18" />
                            Ingreso Extra
                        </button>
                    </div>
                </div>

                <div>
                    <label class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                        Operacion
                    </label>
                    <select
                        v-model="subtype"
                        class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm dark:border-border dark:bg-muted"
                    >
                        <option v-for="operation in operations" :key="operation.value" :value="operation.value">
                            {{ operation.label }}
                        </option>
                    </select>
                </div>

                <!-- Amount -->
                <div>
                    <label
                        class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                    >
                        <Banknote :size="12" class="mr-1 inline" /> Monto
                    </label>
                    <div class="relative">
                        <span
                            class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-lg font-semibold text-gray-400"
                            >$</span
                        >
                        <input
                            v-model.number="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            class="w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-8 text-right text-xl text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-white"
                            autofocus
                        />
                    </div>
                </div>

                <!-- Reason -->
                <div>
                    <label
                        class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                    >
                        <FileText :size="12" class="mr-1 inline" /> Motivo
                    </label>
                    <select
                        v-model="reason"
                        class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-white"
                    >
                        <option value="" disabled>
                            Selecciona un motivo...
                        </option>
                        <option v-for="r in reasons" :key="r" :value="r">
                            {{ r }}
                        </option>
                    </select>
                </div>

                <!-- Notes -->
                <div>
                    <label class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                        Referencia (opcional)
                    </label>
                    <input
                        v-model="referenceNumber"
                        type="text"
                        maxlength="120"
                        class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm dark:border-border dark:bg-muted"
                    />
                </div>

                <!-- Notes -->
                <div>
                    <label
                        class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >Notas (Opcional)</label
                    >
                    <textarea
                        v-model="notes"
                        rows="2"
                        placeholder="Descripción adicional..."
                        class="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-white"
                    />
                </div>

                <!-- Error -->
                <div
                    v-if="error"
                    class="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
                >
                    {{ error }}
                </div>

                <!-- Preview -->
                <div
                    v-if="isValid"
                    class="rounded-xl p-4 text-center"
                    :class="
                        movementType === 'out'
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-emerald-50 dark:bg-emerald-900/20'
                    "
                >
                    <p
                        class="mb-1 text-xs font-semibold tracking-wider uppercase"
                        :class="
                            movementType === 'out'
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-emerald-500 dark:text-emerald-400'
                        "
                    >
                        {{
                            movementType === 'out'
                                ? 'Salida de Caja'
                                : 'Entrada a Caja'
                        }}
                    </p>
                    <p
                        class="text-2xl font-bold"
                        :class="
                            movementType === 'out'
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                        "
                    >
                        {{ movementType === 'out' ? '-' : '+' }}${{
                            amount?.toFixed(2)
                        }}
                    </p>
                    <p
                        class="mt-1 text-xs"
                        :class="
                            movementType === 'out'
                                ? 'text-red-500/70 dark:text-red-400/70'
                                : 'text-emerald-500/70 dark:text-emerald-400/70'
                        "
                    >
                        {{ reason }}
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div
                class="flex gap-3 border-t border-gray-200 px-6 py-4 dark:border-border"
            >
                <button
                    @click="handleClose"
                    class="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                >
                    Cancelar
                </button>
                <button
                    @click="handleSubmit"
                    :disabled="!isValid || loading"
                    class="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-40"
                    :class="
                        movementType === 'out'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                    "
                >
                    <Loader2 v-if="loading" :size="16" class="animate-spin" />
                    {{ loading ? 'Registrando...' : '✓ Registrar Movimiento' }}
                </button>
            </div>
        </div>
    </div>
</template>
