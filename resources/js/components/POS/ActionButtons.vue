<script setup lang="ts">
import { Trash2, Save, Lock, Banknote, CreditCard, ArrowLeftRight, Landmark } from 'lucide-vue-next'

const props = defineProps<{
  hasOpenSession: boolean
  canPay: boolean
  hasCustomer?: boolean
  creditAvailable?: number
}>()

const emit = defineEmits([
  'clear', 
  'save-draft', 
  'open-cash-register', 
  'pay-cash', 
  'pay-card', 
  'pay-transfer',
  'pay-credit'
])
</script>

<template>
  <div class="flex flex-col gap-3 flex-1 justify-end">
    <!-- Top Actions -->
    <div class="grid grid-cols-2 gap-2">
      <button 
        @click="emit('clear')"
        class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200"
      >
        <Trash2 class="w-3.5 h-3.5" />
        Limpiar
      </button>
      <button 
        @click="emit('save-draft')"
        class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200"
      >
        <Save class="w-3.5 h-3.5" />
        Guardar
      </button>
    </div>

    <!-- Warning / Abre Caja Button -->
    <button 
      v-if="!hasOpenSession"
      @click="emit('open-cash-register')"
      class="w-full px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-500 border border-orange-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
    >
      <Lock class="w-3.5 h-3.5" />
      Abre caja para cobrar
    </button>

    <!-- Payment Buttons -->
    <div class="space-y-2 mt-2">
      <button 
        :disabled="!hasOpenSession || !canPay"
        @click="emit('pay-cash')"
        class="w-full h-12 flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden"
        :class="{ 'opacity-50 cursor-not-allowed': !hasOpenSession || !canPay }"
      >
        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Banknote class="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span class="text-base font-bold tracking-wide">Efectivo</span>
      </button>
      
      <div class="grid grid-cols-3 gap-2">
        <button 
          :disabled="!hasOpenSession || !canPay"
          @click="emit('pay-card')"
          class="h-12 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden"
          :class="{ 'opacity-50 cursor-not-allowed': !hasOpenSession || !canPay }"
        >
          <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CreditCard class="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-bold tracking-wide">Tarjeta</span>
        </button>
        
        <button 
          :disabled="!hasOpenSession || !canPay"
          @click="emit('pay-transfer')"
          class="h-12 flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden"
          :class="{ 'opacity-50 cursor-not-allowed': !hasOpenSession || !canPay }"
        >
          <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <ArrowLeftRight class="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-bold tracking-wide">Transf.</span>
        </button>

        <button 
          :disabled="!hasOpenSession || !canPay || !hasCustomer || (creditAvailable ?? 0) <= 0"
          @click="emit('pay-credit')"
          class="h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden"
          :class="{ 'opacity-50 cursor-not-allowed': !hasOpenSession || !canPay || !hasCustomer || (creditAvailable ?? 0) <= 0 }"
          :title="!hasCustomer ? 'Selecciona un cliente primero' : (creditAvailable ?? 0) <= 0 ? 'Cliente sin crédito disponible' : `Crédito disponible: $${(creditAvailable ?? 0).toFixed(2)}`"
        >
          <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <Landmark class="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-bold tracking-wide">Crédito</span>
        </button>
      </div>
    </div>
  </div>
</template>
