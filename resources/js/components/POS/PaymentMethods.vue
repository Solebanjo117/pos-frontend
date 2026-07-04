<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { formatCurrency } from '@/utils/formatters';

const { methods, fetchMethods, isSpecialMethod } = usePaymentMethods();

// Fetch methods on mount
onMounted(fetchMethods);

const props = defineProps<{
    payments: Record<string, number>;
}>();

const emit = defineEmits<{
    (e: 'paymentChange', code: string, value: number): void;
}>();

// Filter: show only non-main methods (custom methods added by admin)
// Main methods (cash, card, transfer, credit, store_credit) have separate buttons
const otherMethods = computed(() =>
    methods.value.filter(
        (m) =>
            !['cash', 'card', 'transfer'].includes(m.code) &&
            !isSpecialMethod(m.code),
    ),
);

const total = computed(() =>
    otherMethods.value.reduce(
        (acc, m) => acc + (props.payments[m.code] || 0),
        0,
    ),
);

const handleChange = (code: string, rawValue: string) => {
    const val = parseFloat(rawValue);
    emit('paymentChange', code, isNaN(val) ? 0 : val);
};

defineExpose({ total });
</script>

<template>
    <div
        class="flex h-full flex-col rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
    >
        <h3
            class="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-700 dark:border-border/50 dark:text-gray-200"
        >
            Otros Métodos de Pago
        </h3>

        <div class="flex-1 overflow-auto">
            <div
                v-if="otherMethods.length === 0"
                class="py-4 text-center text-sm text-gray-400 dark:text-gray-500"
            >
                No hay métodos adicionales configurados
            </div>
            <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div
                    v-for="method in otherMethods"
                    :key="method.code"
                    class="flex flex-col"
                >
                    <label
                        :for="`payment-${method.code}`"
                        class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                        {{ method.name }}
                    </label>
                    <div class="relative">
                        <span
                            class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-400"
                        >
                            $
                        </span>
                        <input
                            :id="`payment-${method.code}`"
                            type="number"
                            min="0"
                            step="0.01"
                            :value="
                                (payments[method.code] || 0) === 0
                                    ? ''
                                    : payments[method.code]
                            "
                            @input="
                                handleChange(
                                    method.code,
                                    ($event.target as HTMLInputElement).value,
                                )
                            "
                            class="w-full rounded border border-gray-200 px-3 py-2 pl-7 text-sm text-gray-900 transition-shadow focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-card dark:text-white"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>
        </div>

        <div
            class="mt-4 flex items-center justify-between rounded-md border-t border-gray-100 bg-gray-50 p-3 pt-4 dark:border-border dark:bg-muted"
        >
            <span class="text-sm font-semibold text-gray-600 dark:text-gray-300"
                >Total Electrónicos</span
            >
            <span class="text-lg font-bold text-gray-900 dark:text-white">{{
                formatCurrency(total)
            }}</span>
        </div>
    </div>
</template>
