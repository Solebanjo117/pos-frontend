<script setup lang="ts">
import { computed } from 'vue'
import { Trash2, Save, Lock, CreditCard, FileText } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'

const props = defineProps<{
  hasOpenSession: boolean
  canPay: boolean
  isQuoteSession?: boolean
  quoteMode?: boolean
}>()

const emit = defineEmits([
  'clear',
  'save-draft',
  'save-quote',
  'save-quote-changes',
  'open-cash-register',
  'open-payment-modal',
])

const { hasRole } = useAuth()
const canManageCashRegister = computed(() => hasRole(['admin', 'manager', 'cashier']))
</script>

<template>
  <div class="flex flex-col gap-3 flex-1 justify-end">
    <!-- Top Actions -->
    <div :class="props.isQuoteSession ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'">
      <button 
        @click="emit('clear')"
        class="px-3 py-2 bg-gray-100 dark:bg-muted/80 hover:bg-gray-200 dark:hover:bg-muted text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200 dark:border-border"
      >
        <Trash2 class="w-3.5 h-3.5" />
        Limpiar
      </button>

      <!-- Normal session: save-draft button -->
      <button 
        v-if="!props.isQuoteSession"
        @click="emit('save-draft')"
        class="px-3 py-2 bg-gray-100 dark:bg-muted/80 hover:bg-gray-200 dark:hover:bg-muted text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200 dark:border-border"
      >
        <Save class="w-3.5 h-3.5" />
        Guardar
      </button>

      <!-- Quote session: save changes -->
      <button 
        v-if="props.isQuoteSession"
        @click="emit('save-quote-changes')"
        class="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-500/30"
      >
        <Save class="w-3.5 h-3.5" />
        Guardar Cambios
      </button>

      <!-- Cotizar: hidden when in a quote session (but always shown in quoteMode) -->
      <button 
        v-if="!props.isQuoteSession || props.quoteMode"
        @click="emit('save-quote')"
        class="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-amber-200 dark:border-amber-500/30"
      >
        <FileText class="w-3.5 h-3.5" />
        Cotizar
      </button>
    </div>

    <!-- Warning / Abre Caja Button (hidden in quoteMode) -->
    <button 
      v-if="!props.quoteMode && !hasOpenSession && canManageCashRegister"
      @click="emit('open-cash-register')"
      class="w-full px-3 py-2 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-500 border border-orange-200 dark:border-orange-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
    >
      <Lock class="w-3.5 h-3.5" />
      Abre caja para cobrar
    </button>

    <!-- Payment Button (hidden in quoteMode) -->
    <div v-if="!props.quoteMode" class="mt-2">
      <button
        :disabled="!hasOpenSession || !canPay"
        @click="emit('open-payment-modal')"
        class="w-full h-14 flex items-center justify-center gap-3 bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500 disabled:bg-gray-300 dark:disabled:bg-muted text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden"
        :class="{ 'opacity-50 cursor-not-allowed': !hasOpenSession || !canPay }"
      >
        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <CreditCard class="w-6 h-6 group-hover:scale-110 transition-transform" />
        <span class="text-lg font-bold tracking-wide">Cobrar</span>
      </button>
    </div>
  </div>
</template>
