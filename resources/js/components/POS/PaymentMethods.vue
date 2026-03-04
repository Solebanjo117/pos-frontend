<script setup lang="ts">
import { computed } from 'vue'

interface PaymentType {
    id: string
    label: string
}

const PAYMENT_TYPES: PaymentType[] = [
    { id: 'visa', label: 'Visa' },
    { id: 'mastercard', label: 'Mastercard' },
    { id: 'clave', label: 'Clave' },
    { id: 'amex', label: 'AMEX' },
    { id: 'yappy', label: 'Yappy' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'notaCredito', label: 'Nota de Crédito' },
    { id: 'creditoCliente', label: 'Crédito Cliente' },
]

const props = defineProps<{
    payments: Record<string, number>
}>()

const emit = defineEmits<{
    (e: 'paymentChange', id: string, value: number): void
}>()

const total = computed(() =>
    PAYMENT_TYPES.reduce((acc, { id }) => acc + (props.payments[id] || 0), 0)
)

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}

const handleChange = (id: string, rawValue: string) => {
    const val = parseFloat(rawValue)
    emit('paymentChange', id, isNaN(val) ? 0 : val)
}

defineExpose({ total })
</script>

<template>
    <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full flex flex-col">
        <h3 class="text-sm font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">
            Otros Métodos de Pago
        </h3>

        <div class="overflow-auto flex-1">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div v-for="type in PAYMENT_TYPES" :key="type.id" class="flex flex-col">
                    <label :for="`payment-${type.id}`" class="text-xs font-medium text-gray-500 mb-1">
                        {{ type.label }}
                    </label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
                            $
                        </span>
                        <input
                            :id="`payment-${type.id}`"
                            type="number"
                            min="0"
                            step="0.01"
                            :value="(payments[type.id] || 0) === 0 ? '' : payments[type.id]"
                            @input="handleChange(type.id, ($event.target as HTMLInputElement).value)"
                            class="w-full border border-gray-200 rounded px-3 py-2 pl-7 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-shadow text-sm"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 p-3 rounded-md">
            <span class="text-sm font-semibold text-gray-600">Total Electrónicos</span>
            <span class="text-lg font-bold text-gray-900">{{ formatCurrency(total) }}</span>
        </div>
    </div>
</template>
