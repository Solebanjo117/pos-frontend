<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, ArrowDownUp, ArrowUpRight, ArrowDownLeft, Banknote, FileText, Loader2 } from 'lucide-vue-next'

interface Props {
    show: boolean
    loading?: boolean
    error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    error: null,
})

const emit = defineEmits<{
    close: []
    submit: [payload: { type: 'in' | 'out'; amount: number; reason: string; notes: string }]
}>()

const movementType = ref<'out' | 'in'>('out')
const amount = ref<number | null>(null)
const reason = ref('')
const notes = ref('')

const reasons = [
    'Pago de agua',
    'Pago de luz',
    'Pago de internet',
    'Servicios',
    'Compra de insumos',
    'Fletes / Envíos',
    'Otros',
]

const isValid = computed(() => {
    return amount.value && amount.value > 0 && reason.value.trim().length > 0
})

const handleSubmit = () => {
    if (!isValid.value) return
    emit('submit', {
        type: movementType.value,
        amount: amount.value!,
        reason: reason.value,
        notes: notes.value,
    })
}

const resetForm = () => {
    movementType.value = 'out'
    amount.value = null
    reason.value = ''
    notes.value = ''
}

const handleClose = () => {
    resetForm()
    emit('close')
}
</script>

<template>
    <div v-if="show" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="handleClose">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <ArrowDownUp :size="20" class="text-indigo-500" />
                    Movimiento de Caja
                </h2>
                <button @click="handleClose" class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <X :size="18" />
                </button>
            </div>

            <div class="p-6 space-y-5">
                <!-- Type Toggle -->
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Tipo de Movimiento</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button
                            @click="movementType = 'out'"
                            :class="movementType === 'out'
                                ? 'ring-2 ring-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
                            class="flex items-center justify-center gap-2 p-3 rounded-xl transition-all text-sm font-medium"
                        >
                            <ArrowUpRight :size="18" />
                            Retiro / Gasto
                        </button>
                        <button
                            @click="movementType = 'in'"
                            :class="movementType === 'in'
                                ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
                            class="flex items-center justify-center gap-2 p-3 rounded-xl transition-all text-sm font-medium"
                        >
                            <ArrowDownLeft :size="18" />
                            Ingreso Extra
                        </button>
                    </div>
                </div>

                <!-- Amount -->
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                        <Banknote :size="12" class="inline mr-1" /> Monto
                    </label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-lg font-semibold">$</span>
                        <input
                            v-model.number="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            class="w-full pl-8 pr-4 py-3 text-xl text-right border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            autofocus
                        />
                    </div>
                </div>

                <!-- Reason -->
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                        <FileText :size="12" class="inline mr-1" /> Motivo
                    </label>
                    <select
                        v-model="reason"
                        class="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        <option value="" disabled>Selecciona un motivo...</option>
                        <option v-for="r in reasons" :key="r" :value="r">{{ r }}</option>
                    </select>
                </div>

                <!-- Notes -->
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Notas (Opcional)</label>
                    <textarea
                        v-model="notes"
                        rows="2"
                        placeholder="Descripción adicional..."
                        class="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                </div>

                <!-- Error -->
                <div v-if="error" class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                    {{ error }}
                </div>

                <!-- Preview -->
                <div v-if="isValid" class="rounded-xl p-4 text-center"
                    :class="movementType === 'out' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'"
                >
                    <p class="text-xs font-semibold uppercase tracking-wider mb-1"
                        :class="movementType === 'out' ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'"
                    >
                        {{ movementType === 'out' ? 'Salida de Caja' : 'Entrada a Caja' }}
                    </p>
                    <p class="text-2xl font-bold"
                        :class="movementType === 'out' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'"
                    >
                        {{ movementType === 'out' ? '-' : '+' }}${{ amount?.toFixed(2) }}
                    </p>
                    <p class="text-xs mt-1"
                        :class="movementType === 'out' ? 'text-red-500/70 dark:text-red-400/70' : 'text-emerald-500/70 dark:text-emerald-400/70'"
                    >
                        {{ reason }}
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                    @click="handleClose"
                    class="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    @click="handleSubmit"
                    :disabled="!isValid || loading"
                    class="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 shadow-sm transition-colors flex items-center justify-center gap-2"
                    :class="movementType === 'out'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'"
                >
                    <Loader2 v-if="loading" :size="16" class="animate-spin" />
                    {{ loading ? 'Registrando...' : '✓ Registrar Movimiento' }}
                </button>
            </div>
        </div>
    </div>
</template>
