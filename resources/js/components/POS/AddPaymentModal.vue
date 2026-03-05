<script setup lang="ts">
import { ref, computed } from 'vue'
import { Banknote, X, AlertCircle, CreditCard } from 'lucide-vue-next'

const props = defineProps<{
    show: boolean
    orderId: number | null
    orderTotal: number
    amountPaid: number
    customerName?: string
    creditAvailable?: number
    loading?: boolean
    error?: string | null
}>()

const emit = defineEmits<{
    (e: 'submit', payload: { amount: number; method: string; notes?: string }): void
    (e: 'close'): void
}>()

const paymentMethod = ref<'cash' | 'card' | 'transfer' | 'credit'>('cash')
const paymentAmount = ref<number>(0)
const notes = ref('')

const amountDue = computed(() => Math.max(0, props.orderTotal - props.amountPaid))
const remainingAfterPayment = computed(() => Math.max(0, amountDue.value - paymentAmount.value))

const hasCreditAvailable = computed(() =>
    (props.creditAvailable ?? 0) > 0 && paymentMethod.value === 'credit'
)

const canSubmit = computed(() =>
    paymentAmount.value >= 0 &&
    paymentAmount.value <= amountDue.value &&
    !(paymentMethod.value === 'credit' && paymentAmount.value > (props.creditAvailable ?? 0))
)

const handleOpen = () => {
    paymentAmount.value = amountDue.value
    paymentMethod.value = 'cash'
    notes.value = ''
}

const handleSubmit = () => {
    emit('submit', {
        amount: paymentAmount.value,
        method: paymentMethod.value,
        notes: notes.value || undefined,
    })
}

const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
</script>

<template>
    <Transition name="modal">
        <div
            v-if="show"
            class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
            <div class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md" @vue:mounted="handleOpen">
                <!-- Header -->
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border">
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Registrar Pago</h2>
                        <p v-if="customerName" class="text-xs text-gray-500 dark:text-gray-400">{{ customerName }}</p>
                    </div>
                    <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <div class="p-6 space-y-4">
                    <!-- Error -->
                    <div v-if="error" class="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                        <AlertCircle class="w-4 h-4 flex-shrink-0" />
                        {{ error }}
                    </div>

                    <!-- Balance summary -->
                    <div class="bg-gray-50 dark:bg-background/50 rounded-xl p-4 space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Total de la orden</span>
                            <span class="font-medium">{{ formatCurrency(orderTotal) }}</span>
                        </div>
                        <div v-if="amountPaid > 0" class="flex justify-between text-green-600 dark:text-green-400">
                            <span>Pagado anteriormente</span>
                            <span>- {{ formatCurrency(amountPaid) }}</span>
                        </div>
                        <div class="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-border pt-1 mt-1">
                            <span>Saldo pendiente</span>
                            <span class="text-orange-600 dark:text-orange-400">{{ formatCurrency(amountDue) }}</span>
                        </div>
                    </div>

                    <!-- Method -->
                    <div>
                        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Método de pago</label>
                        <div class="grid grid-cols-4 gap-2">
                            <button
                                v-for="m in [
                                    { key: 'cash',     label: 'Efectivo',  color: 'green' },
                                    { key: 'card',     label: 'Tarjeta',   color: 'blue'  },
                                    { key: 'transfer', label: 'Transfer.', color: 'purple' },
                                    { key: 'credit',   label: 'Crédito',   color: 'orange', disabled: !creditAvailable },
                                ]"
                                :key="m.key"
                                :disabled="m.disabled"
                                @click="paymentMethod = m.key as any"
                                :class="[
                                    'py-2 px-1 rounded-lg text-xs font-semibold border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed',
                                    paymentMethod === m.key
                                        ? `border-${m.color}-500 bg-${m.color}-50 dark:bg-${m.color}-900/20 text-${m.color}-700 dark:text-${m.color}-400`
                                        : 'border-gray-200 dark:border-border text-gray-500 dark:text-gray-400 hover:border-gray-300'
                                ]"
                            >
                                {{ m.label }}
                            </button>
                        </div>
                        <p v-if="paymentMethod === 'credit' && creditAvailable" class="text-xs text-orange-500 mt-1">
                            Crédito disponible: {{ formatCurrency(creditAvailable) }}
                        </p>
                    </div>

                    <!-- Amount -->
                    <div>
                        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Monto a pagar
                        </label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                            <input
                                v-model.number="paymentAmount"
                                type="number"
                                min="0"
                                :max="amountDue"
                                step="0.01"
                                class="w-full pl-7 pr-3 py-3 text-2xl font-bold rounded-xl border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <div class="flex gap-2 mt-2">
                            <button @click="paymentAmount = amountDue" class="text-xs px-3 py-1 bg-gray-100 dark:bg-muted rounded-lg hover:bg-gray-200 transition-colors">
                                Pagar todo ({{ formatCurrency(amountDue) }})
                            </button>
                        </div>
                    </div>

                    <!-- Remaining after -->
                    <div v-if="remainingAfterPayment > 0" class="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                        <AlertCircle class="w-3.5 h-3.5 flex-shrink-0" />
                        Quedará pendiente: <strong>{{ formatCurrency(remainingAfterPayment) }}</strong>
                    </div>

                    <!-- Notes -->
                    <div>
                        <input
                            v-model="notes"
                            type="text"
                            placeholder="Notas (opcional)..."
                            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white"
                        />
                    </div>

                    <!-- Submit -->
                    <button
                        @click="handleSubmit"
                        :disabled="!canSubmit || loading"
                        class="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                        {{ loading ? 'Registrando...' : `Registrar ${formatCurrency(paymentAmount)}` }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
