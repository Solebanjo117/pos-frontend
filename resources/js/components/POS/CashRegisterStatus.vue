<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, Lock, LockOpen, ArrowDownUp } from 'lucide-vue-next'
import { usePosSession } from '@/composables/usePosSession'
import { formatCurrency } from '@/utils/formatters'
import { usePage } from '@inertiajs/vue3'

const page = usePage()
const userName = computed(() => (page.props.auth as any)?.user?.name || 'Vendedor')

const {
  session,
  openSession,
} = usePosSession()

const props = defineProps<{
  hasOpenSession: boolean
}>()

// Example input for opening session directly from header, optionally we can keep using our OpenSessionModal
// For this design, I'll emit an event to open the modal to keep logic clean.
const emit = defineEmits(['request-open', 'request-close', 'request-cash-movement'])

</script>

<template>
  <div>
    <!-- Session Closed Warning -->
    <div v-if="!hasOpenSession" class="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3 text-blue-700">
        <AlertCircle class="w-5 h-5 flex-shrink-0" />
        <span class="font-medium text-sm md:text-base">Caja no iniciada – Debes abrir una sesión para habilitar las ventas.</span>
      </div>
      
      <div class="flex items-center gap-3">
        <button 
          @click="emit('request-open')"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap whitespace-nowrap"
        >
          <Lock class="w-4 h-4" />
          Abrir Caja
        </button>
      </div>
    </div>

    <!-- Session Open Status -->
    <div v-else class="bg-emerald-50 border-b border-emerald-100 px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3 text-emerald-800">
        <LockOpen class="w-5 h-5 flex-shrink-0" />
        <span class="font-medium text-sm md:text-base">
          Caja Abierta (Usuario: {{ userName }})
        </span>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="text-sm text-emerald-700">
          <span class="hidden md:inline">Fondo inicial:</span> <span class="font-bold">{{ formatCurrency(session?.opening_amount || 0) }}</span>
        </div>
        <button 
          @click="emit('request-cash-movement')"
          class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          title="Registrar retiro o ingreso de efectivo"
        >
          <ArrowDownUp class="w-4 h-4" />
          <span class="hidden md:inline">Mov. Caja</span>
        </button>
        <button 
          @click="emit('request-close')"
          class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Lock class="w-4 h-4" />
          Cerrar Caja
        </button>
      </div>
    </div>
  </div>
</template>

