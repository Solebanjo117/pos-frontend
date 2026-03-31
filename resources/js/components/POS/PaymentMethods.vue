<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePaymentMethods } from '@/composables/usePaymentMethods'

const { methods, fetchMethods, isSpecialMethod } = usePaymentMethods()

// Fetch methods on mount
onMounted(fetchMethods)

const props = defineProps<{
    payments: Record<string, number>
}>()

const emit = defineEmits<{
    (e: 'paymentChange', code: string, value: number): void
}>()

// Filter: show only non-main methods (custom methods added by admin)
// Main methods (cash, card, transfer, credit, store_credit) have separate buttons
const otherMethods = computed(() =>
    methods.value.filter(m =>
        !['cash', 'card', 'transfer'].includes(m.code) && !isSpecialMethod(m.code)
    )
)

const total = computed(() =>
    otherMethods.value.reduce((acc, m) => acc + (props.payments[m.code] || 0), 0)
)

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}

const handleChange = (code: string, rawValue: string) => {
    const val = parseFloat(rawValue)
    emit('paymentChange', code, isNaN(val) ? 0 : val)
}

defineExpose({ total })
</script>

<template>
    <div class="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-gray-100 dark:border-border h-full flex flex-col">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b border-gray-100 dark:border-border/50 pb-2">
            Otros Métodos de Pago
        </h3>

        <div class="overflow-auto flex-1">
            <div v-if="otherMethods.length === 0" class="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                No hay métodos adicionales configurados
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div v-for="method in otherMethods" :key="method.code" class="flex flex-col">
                    <label :for="`payment-${method.code}`" class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {{ method.name }}
                    </label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
                            $
                        </span>
                        <input
                            :id="`payment-${method.code}`"
                            type="number"
                            min="0"
                            step="0.01"
                            :value="(payments[method.code] || 0) === 0 ? '' : payments[method.code]"
                            @input="handleChange(method.code, ($event.target as HTMLInputElement).value)"
                            class="w-full border border-gray-200 dark:border-border dark:bg-card rounded px-3 py-2 pl-7 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white transition-shadow text-sm"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4 pt-4 border-t border-gray-100 dark:border-border flex justify-between items-center bg-gray-50 dark:bg-muted p-3 rounded-md">
            <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">Total Electrónicos</span>
            <span class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(total) }}</span>
        </div>
    </div>
</template>
