<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Banknote, CreditCard, Wallet, X, AlertTriangle, Gift } from 'lucide-vue-next'
import { usePaymentMethods } from '@/composables/usePaymentMethods'
import type { Customer } from '@/types/customer'

const { methods, fetchMethods, isSpecialMethod } = usePaymentMethods()

interface Payment {
    method: string
    amount: number
}

const props = defineProps<{
    show: boolean
    amountToCharge: number
    customer?: Customer | null
    shippingCost?: number
    editMode?: boolean
    subtotal?: number
    taxAmount?: number
    discountAmount?: number
}>()

const emit = defineEmits<{
    (e: 'finish', payments: Payment[]): void
    (e: 'cancel'): void
}>()

// Payment amounts by method code
const payments = ref<Record<string, number>>({})

// Cash denominations (Panama uses USD)
const cashDenominations = [100, 50, 20, 10, 5, 1, 0.25]

// Fetch methods when panel opens
watch(() => props.show, (show) => {
    if (show) {
        fetchMethods()
        resetPayments()
    }
})

onMounted(() => {
    if (props.show) {
        fetchMethods()
    }
})

// Reset all payments to 0
const resetPayments = () => {
    payments.value = {}
}

// Computed: Credit available for customer
const creditAvailable = computed(() => {
    if (!props.customer) return 0
    const limit = props.customer.credit_limit ?? 0
    const balance = props.customer.current_balance ?? 0
    return Math.max(0, limit - balance)
})

// Computed: Store credit available
const storeCreditAvailable = computed(() => {
    if (!props.customer) return 0
    return props.customer.store_credit ?? 0
})

// Get cash payment amount
const cashAmount = computed({
    get: () => payments.value['cash'] ?? 0,
    set: (val) => { payments.value['cash'] = val }
})

// Get credit payment amount
const creditAmount = computed({
    get: () => payments.value['credit'] ?? 0,
    set: (val) => { payments.value['credit'] = val }
})

// Get store credit payment amount
const storeCreditAmount = computed({
    get: () => payments.value['store_credit'] ?? 0,
    set: (val) => { payments.value['store_credit'] = val }
})

// Dynamic methods (not cash, credit, store_credit)
const dynamicMethods = computed(() =>
    methods.value.filter(m =>
        !['cash', 'credit', 'store_credit'].includes(m.code) &&
        m.is_active
    )
)

// Total paid (sum of all methods)
const totalPaid = computed(() => {
    return Object.values(payments.value).reduce((sum, val) => sum + (val || 0), 0)
})

// Remaining to pay
const remainingToPay = computed(() => {
    return Math.max(0, props.amountToCharge - totalPaid.value)
})

// Change to give back (only if cash > needed)
const changeToGive = computed(() => {
    const cashPaid = cashAmount.value
    const nonCashPaid = totalPaid.value - cashPaid
    const neededFromCash = props.amountToCharge - nonCashPaid
    
    if (cashPaid > neededFromCash && neededFromCash > 0) {
        return cashPaid - neededFromCash
    }
    return 0
})

// Effective cash (cash - change)
const effectiveCash = computed(() => {
    return Math.max(0, cashAmount.value - changeToGive.value)
})

// Can finish sale?
const canFinish = computed(() => {
    // Total paid must cover the amount to charge
    if (totalPaid.value < props.amountToCharge) return false
    
    // Credit cannot exceed available
    if (creditAmount.value > creditAvailable.value) return false
    
    // Store credit cannot exceed available
    if (storeCreditAmount.value > storeCreditAvailable.value) return false
    
    return true
})

// Handle MAX button - fill remaining amount
const handleMax = (methodCode: string) => {
    const remaining = remainingToPay.value
    if (remaining <= 0) return
    
    // For special methods, cap at available
    if (methodCode === 'credit') {
        payments.value[methodCode] = Math.min(remaining, creditAvailable.value)
    } else if (methodCode === 'store_credit') {
        payments.value[methodCode] = Math.min(remaining, storeCreditAvailable.value)
    } else {
        payments.value[methodCode] = remaining
    }
}

// Handle cash denomination click
const handleDenomination = (amount: number) => {
    cashAmount.value = amount
}

// Handle dynamic method payment change
const handleDynamicPayment = (code: string, value: number) => {
    payments.value[code] = value
}

// Format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount)
}

// Finish sale
const handleFinish = () => {
    const paymentList: Payment[] = []
    
    // Add cash (effective amount, not including change)
    if (effectiveCash.value > 0) {
        paymentList.push({ method: 'cash', amount: effectiveCash.value })
    }
    
    // Add credit
    if (creditAmount.value > 0) {
        paymentList.push({ method: 'credit', amount: creditAmount.value })
    }
    
    // Add store credit
    if (storeCreditAmount.value > 0) {
        paymentList.push({ method: 'store_credit', amount: storeCreditAmount.value })
    }
    
    // Add dynamic methods
    for (const method of dynamicMethods.value) {
        const amount = payments.value[method.code] ?? 0
        if (amount > 0) {
            paymentList.push({ method: method.code, amount })
        }
    }
    
    console.log('[UnifiedPaymentPanel] Sending payments:', paymentList)
    console.log('[UnifiedPaymentPanel] Available dynamic methods:', dynamicMethods.value.map(m => ({ code: m.code, name: m.name })))
    
    emit('finish', paymentList)
}

// Cancel
const handleCancel = () => {
    emit('cancel')
}
</script>

<template>
    <Transition name="modal">
        <div
            v-if="show"
            class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
            <div class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex overflow-hidden">
                <!-- Left Panel: Payment Methods -->
                <div class="flex-1 flex flex-col overflow-hidden">
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-gray-200 dark:border-border flex items-center justify-between shrink-0 bg-green-600">
                        <h2 class="text-xl font-bold text-white">PAYMENT</h2>
                        <button @click="handleCancel" class="text-white/80 hover:text-white transition-colors">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Scrollable Payment Content -->
                    <div class="flex-1 overflow-y-auto p-4 space-y-4">
                        
                        <!-- ═══ EFECTIVO ═══ -->
                        <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                            <div class="flex items-center gap-2 mb-3">
                                <Banknote class="w-5 h-5 text-green-600 dark:text-green-400" />
                                <span class="text-sm font-bold text-green-700 dark:text-green-300 uppercase">Efectivo</span>
                            </div>
                            
                            <!-- Cash Input with Max -->
                            <div class="flex gap-2 mb-3">
                                <div class="relative flex-1">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">$</span>
                                    <input
                                        v-model.number="cashAmount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        class="w-full pl-8 pr-3 py-2.5 text-lg font-bold text-right border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-green-900/30 text-green-800 dark:text-green-200 focus:ring-2 focus:ring-green-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    @click="handleMax('cash')"
                                    class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors text-sm"
                                >
                                    Max
                                </button>
                            </div>
                            
                            <!-- Denomination Buttons -->
                            <div class="grid grid-cols-7 gap-1.5">
                                <button
                                    v-for="denom in cashDenominations"
                                    :key="denom"
                                    @click="handleDenomination(denom)"
                                    class="py-2 text-sm font-medium bg-green-100 dark:bg-green-800/50 hover:bg-green-200 dark:hover:bg-green-700 text-green-800 dark:text-green-200 rounded-lg transition-colors"
                                >
                                    {{ denom >= 1 ? `$${denom}` : `${denom * 100}¢` }}
                                </button>
                            </div>
                            
                            <!-- Change Display -->
                            <div v-if="changeToGive > 0" class="mt-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-2 text-center">
                                <span class="text-sm text-yellow-700 dark:text-yellow-300">Cambio: </span>
                                <span class="text-lg font-bold text-yellow-800 dark:text-yellow-200">{{ formatCurrency(changeToGive) }}</span>
                            </div>
                        </div>

                        <!-- ═══ CRÉDITO DEL CLIENTE ═══ -->
                        <div v-if="customer && creditAvailable > 0" class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                            <div class="flex items-center gap-2 mb-2">
                                <CreditCard class="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                <span class="text-sm font-bold text-amber-700 dark:text-amber-300 uppercase">Crédito</span>
                                <span class="ml-auto text-xs text-amber-600 dark:text-amber-400">
                                    Disponible: {{ formatCurrency(creditAvailable) }}
                                </span>
                            </div>
                            
                            <div class="flex gap-2">
                                <div class="relative flex-1">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">$</span>
                                    <input
                                        v-model.number="creditAmount"
                                        type="number"
                                        min="0"
                                        :max="creditAvailable"
                                        step="0.01"
                                        class="w-full pl-8 pr-3 py-2.5 text-lg font-bold text-right border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 focus:ring-2 focus:ring-amber-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    @click="handleMax('credit')"
                                    class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors text-sm"
                                >
                                    Max
                                </button>
                            </div>
                            
                            <p v-if="creditAmount > creditAvailable" class="mt-2 text-xs text-red-600 flex items-center gap-1">
                                <AlertTriangle class="w-3 h-3" />
                                Excede el crédito disponible
                            </p>
                        </div>

                        <!-- ═══ SALDO A FAVOR ═══ -->
                        <div v-if="customer && storeCreditAvailable > 0" class="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                            <div class="flex items-center gap-2 mb-2">
                                <Gift class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                <span class="text-sm font-bold text-emerald-700 dark:text-emerald-300 uppercase">Saldo a Favor</span>
                                <span class="ml-auto text-xs text-emerald-600 dark:text-emerald-400">
                                    Disponible: {{ formatCurrency(storeCreditAvailable) }}
                                </span>
                            </div>
                            
                            <div class="flex gap-2">
                                <div class="relative flex-1">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                                    <input
                                        v-model.number="storeCreditAmount"
                                        type="number"
                                        min="0"
                                        :max="storeCreditAvailable"
                                        step="0.01"
                                        class="w-full pl-8 pr-3 py-2.5 text-lg font-bold text-right border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    @click="handleMax('store_credit')"
                                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors text-sm"
                                >
                                    Max
                                </button>
                            </div>
                        </div>

                        <!-- ═══ MÉTODOS DINÁMICOS ═══ -->
                        <div v-if="dynamicMethods.length > 0" class="bg-gray-50 dark:bg-muted/50 rounded-xl p-4 border border-gray-200 dark:border-border">
                            <div class="flex items-center gap-2 mb-3">
                                <Wallet class="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                <span class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">Otros Métodos</span>
                            </div>
                            
                            <div class="space-y-2">
                                <div v-for="method in dynamicMethods" :key="method.code" class="flex items-center gap-2">
                                    <label class="w-24 text-sm font-medium text-gray-600 dark:text-gray-400 uppercase truncate">
                                        {{ method.name }}
                                    </label>
                                    <div class="relative flex-1">
                                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input
                                            :value="payments[method.code] ?? 0"
                                            @input="handleDynamicPayment(method.code, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            class="w-full pl-8 pr-3 py-2 text-right border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <button
                                        @click="handleMax(method.code)"
                                        class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-sm"
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- ═══ TOTAL LINE ═══ -->
                        <div class="bg-green-600 rounded-xl p-4 flex items-center justify-between">
                            <span class="text-lg font-bold text-white uppercase">Total</span>
                            <span class="text-2xl font-bold text-white">{{ formatCurrency(totalPaid) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Right Panel: Summary -->
                <div class="w-72 bg-gray-50 dark:bg-muted/30 border-l border-gray-200 dark:border-border flex flex-col">
                    <!-- Summary Header -->
                    <div class="p-4 space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Subtotal</span>
                            <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(subtotal ?? amountToCharge) }}</span>
                        </div>
                        <div v-if="shippingCost && shippingCost > 0" class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Envío</span>
                            <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(shippingCost) }}</span>
                        </div>
                        <div v-if="discountAmount && discountAmount > 0" class="flex justify-between text-red-600 dark:text-red-400">
                            <span>Descuentos</span>
                            <span>-{{ formatCurrency(discountAmount) }}</span>
                        </div>
                        <div v-if="taxAmount" class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">ITBMS</span>
                            <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(taxAmount) }}</span>
                        </div>
                        
                        <div class="border-t border-gray-200 dark:border-border pt-2 mt-2">
                            <div class="flex justify-between text-lg font-bold">
                                <span class="text-gray-900 dark:text-white">Total</span>
                                <span class="text-indigo-600 dark:text-indigo-400">{{ formatCurrency(amountToCharge) }}</span>
                            </div>
                        </div>

                        <div class="border-t border-gray-200 dark:border-border pt-2 mt-2 space-y-1">
                            <div class="flex justify-between">
                                <span class="text-gray-500 dark:text-gray-400">Pagos</span>
                                <span class="font-medium text-green-600 dark:text-green-400">{{ formatCurrency(totalPaid) }}</span>
                            </div>
                            <div class="flex justify-between font-bold">
                                <span class="text-gray-700 dark:text-gray-300">Balance</span>
                                <span :class="remainingToPay > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                                    {{ formatCurrency(remainingToPay) }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Spacer -->
                    <div class="flex-1"></div>

                    <!-- Action Buttons -->
                    <div class="p-4 space-y-2">
                        <button
                            @click="handleFinish"
                            :disabled="!canFinish"
                            class="w-full py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Finalizar Venta
                        </button>
                        <button
                            @click="handleCancel"
                            class="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                            &lt; Volver a la Venta
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
