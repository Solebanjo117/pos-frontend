<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { AlertCircle, CheckCircle2, RotateCcw, X, Calculator, FileText } from 'lucide-vue-next'
import type { PosSession, PosSessionSummary } from '../../types/pos-session'
import CashSummary from './CashSummary.vue'
import CashCountTable from './CashCountTable.vue'
import PaymentMethods from './PaymentMethods.vue'
import { usePaymentMethods } from '@/composables/usePaymentMethods'

const { methods, fetchMethods, isSpecialMethod } = usePaymentMethods()

const props = defineProps<{
    show: boolean
    session: PosSession | null
    summary: PosSessionSummary | null
    loading?: boolean
    error?: string | null
}>()

const emit = defineEmits<{
    (e: 'submit', amount: number, notes?: string, closingDetails?: Record<string, any>): void
    (e: 'close'): void
}>()

// ── Cash denomination counts (unit + pack per denomination) ──
const DENOMINATION_KEYS = [
    '100', '50', '20', '10', '5', '1',
    '1.00', '0.50', '0.25', '0.10', '0.05', '0.01',
]

const cashCounts = reactive<Record<string, number>>(
    DENOMINATION_KEYS.reduce((acc, id) => ({ ...acc, [`unit_${id}`]: 0, [`pack_${id}`]: 0 }), {})
)

// ── Electronic payment counts (dynamic) ──
const payments = reactive<Record<string, number>>({})

// Fetch methods on modal open and initialize payments
watch(() => props.show, async (val) => {
    if (val) {
        await fetchMethods()
        // Initialize payments for custom methods (not main ones)
        methods.value
            .filter(m => !['cash', 'card', 'transfer'].includes(m.code) && !isSpecialMethod(m.code))
            .forEach(m => {
                if (!(m.code in payments)) {
                    payments[m.code] = 0
                }
            })
    }
}, { immediate: true })

const notes = ref<string>('')

// ── Totals ──
const CASH_ROWS = [
    { id: '100', unitValue: 100, packValue: 10000 },
    { id: '50',  unitValue: 50,  packValue: 5000  },
    { id: '20',  unitValue: 20,  packValue: 2000  },
    { id: '10',  unitValue: 10,  packValue: 1000  },
    { id: '5',   unitValue: 5,   packValue: 500   },
    { id: '1',   unitValue: 1,   packValue: 100   },
    { id: '1.00', unitValue: 1.00, packValue: 25.00 },
    { id: '0.50', unitValue: 0.50, packValue: 10.00 },
    { id: '0.25', unitValue: 0.25, packValue: 10.00 },
    { id: '0.10', unitValue: 0.10, packValue: 5.00  },
    { id: '0.05', unitValue: 0.05, packValue: 2.00  },
    { id: '0.01', unitValue: 0.01, packValue: 0.50  },
]

const totalCashCounted = computed(() =>
    CASH_ROWS.reduce((acc, row) => {
        return acc + (cashCounts[`unit_${row.id}`] || 0) * row.unitValue
                   + (cashCounts[`pack_${row.id}`] || 0) * row.packValue
    }, 0)
)

const totalElectronicCounted = computed(() =>
    Object.values(payments).reduce((acc, val) => acc + (val || 0), 0)
)

const totalCounted = computed(() => totalCashCounted.value + totalElectronicCounted.value)

const expectedCash = computed(() => props.summary?.expected_cash ?? props.session?.expected_amount ?? 0)

const difference = computed(() => Math.round((totalCashCounted.value - expectedCash.value) * 100) / 100)

const isBalanced = computed(() => Math.abs(difference.value) < 0.01)
const isMissing  = computed(() => difference.value < -0.005)
const isSurplus  = computed(() => difference.value > 0.005)
const requiresNotes = computed(() => isMissing.value || isSurplus.value)

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)

// ── Handlers ──
const handleCashCountChange = (id: string, value: number) => {
    cashCounts[id] = value
}

const handlePaymentChange = (code: string, value: number) => {
    payments[code] = value
}

const handleSubmit = () => {
    const closingDetails: Record<string, any> = {
        denominations: { ...cashCounts },
        electronic_payments: { ...payments },
    }
    emit('submit', totalCashCounted.value, notes.value, closingDetails)
}

const handleCancel = () => {
    DENOMINATION_KEYS.forEach(id => {
        cashCounts[`unit_${id}`] = 0
        cashCounts[`pack_${id}`] = 0
    })
    Object.keys(payments).forEach(code => { payments[code] = 0 })
    notes.value = ''
}

const close = () => emit('close')
</script>

<template>
    <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/60 backdrop-blur-sm overflow-y-auto"
    >
        <!-- Full-screen overlay container (not a card, but a full-screen panel) -->
        <div class="min-h-screen w-full max-w-7xl flex flex-col bg-gray-50 text-gray-900 font-sans">

            <!-- ── Header ── -->
            <header class="bg-white border-b border-gray-200 sticky top-0 z-10 flex-none">
                <div class="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white">
                            <Calculator :size="18" :stroke-width="2.5" />
                        </div>
                        <h1 class="text-lg font-bold tracking-tight text-gray-900">
                            Cierre de Caja
                        </h1>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-gray-500">
                        <span v-if="session" class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-green-500"></span>
                            Sesión #{{ session.id }}
                        </span>
                        <button
                            @click="close"
                            class="text-gray-400 hover:text-gray-600 transition-colors ml-2 p-1"
                        >
                            <X :size="20" />
                        </button>
                    </div>
                </div>
            </header>

            <!-- ── Main Content ── -->
            <main class="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full">
                <div class="space-y-5">

                    <!-- Error banner -->
                    <div
                        v-if="error"
                        class="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-red-800 border border-red-200"
                    >
                        <AlertCircle :size="18" />
                        <span class="text-sm">{{ error }}</span>
                    </div>

                    <!-- Section 1: Summary -->
                    <CashSummary
                        :summary="summary"
                        :total-counted="totalCashCounted"
                        :total-electronic="totalElectronicCounted"
                    />

                    <!-- Section 2 & 3: Two-column details grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5" style="min-height: 420px; max-height: calc(100vh - 340px);">
                        <div class="h-[480px] lg:h-full">
                            <CashCountTable
                                :counts="cashCounts"
                                @count-change="handleCashCountChange"
                            />
                        </div>
                        <div class="h-[480px] lg:h-full">
                            <PaymentMethods
                                :payments="payments"
                                @payment-change="handlePaymentChange"
                            />
                        </div>
                    </div>

                    <!-- Notes (shown when there is a difference) -->
                    <div v-if="requiresNotes" class="bg-white rounded-lg border border-gray-200 p-4">
                        <label for="closing-notes" class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                            <FileText :size="15" />
                            Justificación
                            <span class="text-red-500 text-xs font-medium">(Obligatoria)</span>
                        </label>
                        <textarea
                            id="closing-notes"
                            v-model="notes"
                            :required="requiresNotes"
                            rows="3"
                            class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                            :placeholder="isMissing ? 'Explique el motivo del faltante...' : 'Explique el motivo del sobrante...'"
                        ></textarea>
                    </div>

                </div>
            </main>

            <!-- ── Sticky Footer ── -->
            <footer class="sticky bottom-0 z-10 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-none">
                <div class="px-4 sm:px-6 lg:px-8 py-4">
                    <div class="flex flex-col md:flex-row items-center justify-between gap-4">

                        <!-- Totals summary -->
                        <div class="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-2">
                            <div>
                                <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">
                                    Efectivo Esperado
                                </span>
                                <span class="text-2xl font-bold text-gray-400">
                                    {{ formatCurrency(expectedCash) }}
                                </span>
                            </div>

                            <div class="hidden md:block w-px bg-gray-200 h-10 self-center"></div>

                            <div>
                                <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">
                                    Efectivo Contado
                                </span>
                                <span class="text-2xl font-bold" :class="isBalanced ? 'text-green-600' : 'text-gray-900'">
                                    {{ formatCurrency(totalCashCounted) }}
                                </span>
                            </div>

                            <div class="hidden md:block w-px bg-gray-200 h-10 self-center"></div>

                            <!-- Balanced / Difference badge -->
                            <div class="flex items-center">
                                <div
                                    v-if="isBalanced"
                                    class="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100"
                                >
                                    <CheckCircle2 :size="18" :stroke-width="2.5" />
                                    <span class="font-bold text-sm uppercase tracking-wide">Cuadra</span>
                                </div>
                                <div
                                    v-else
                                    class="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100"
                                >
                                    <X :size="18" :stroke-width="2.5" />
                                    <span class="font-bold text-sm uppercase tracking-wide">
                                        {{ isMissing ? 'Faltante:' : 'Sobrante:' }}
                                        {{ difference > 0 ? '+' : '' }}{{ formatCurrency(difference) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Action buttons -->
                        <div class="flex items-center gap-3 w-full md:w-auto">
                            <button
                                type="button"
                                @click="handleCancel"
                                class="flex-1 md:flex-none justify-center flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all text-sm"
                            >
                                <RotateCcw :size="16" />
                                Limpiar
                            </button>
                            <button
                                type="button"
                                :disabled="loading || (requiresNotes && !notes.trim())"
                                @click="handleSubmit"
                                class="flex-1 md:flex-none justify-center flex items-center gap-2 px-8 py-2.5 font-bold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all text-sm bg-gray-900 text-white hover:bg-black focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckCircle2 :size="16" />
                                <span v-if="loading">Cerrando...</span>
                                <span v-else>Cerrar Caja</span>
                            </button>
                        </div>

                    </div>
                </div>
            </footer>

        </div>
    </div>
</template>
