<script setup lang="ts">
import { User, IdCard, CheckCircle2, ChevronDown } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps<{
  subtotal: number
  taxAmount: number
  total: number
  customerId: number | string | null | undefined
  sellerId: number | string | null | undefined
  customers: Array<{ id: number; name: string; document_number?: string; phone?: string | null }>
  users: Array<{ id: number; name: string }>
}>()

const emit = defineEmits(['update:customerId', 'update:sellerId'])

const selectedCustomer = computed(() => {
  if (!props.customerId) return null
  return props.customers.find(c => c.id === props.customerId)
})

const selectedSeller = computed(() => {
  if (!props.sellerId) return null
  return props.users.find(u => u.id === props.sellerId)
})

const internalCustomerId = ref(props.customerId || '')
const internalSellerId = ref(props.sellerId || '')

watch(() => props.customerId, (val) => {
  internalCustomerId.value = val || ''
})

watch(() => props.sellerId, (val) => {
  internalSellerId.value = val || ''
})

</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Customer & Seller Form -->
    <div class="space-y-4">
      
      <!-- Cliente Input Group -->
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 font-bold mb-1 block uppercase tracking-wide">
          Cliente
        </label>
        <div class="flex gap-2 relative">
          
          <div class="relative w-full">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
              v-model="internalCustomerId"
              @change="emit('update:customerId', internalCustomerId ? Number(internalCustomerId) : null)"
              class="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-sm font-medium text-gray-700 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:border-gray-300 dark:hover:border-gray-500 appearance-none"
              :class="selectedCustomer ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50 text-blue-700 dark:text-blue-400' : ''"
            >
              <option value="">Público General</option>
              <option v-for="c in customers" :key="c.id" :value="c.id">
                {{ c.name }} {{ c.document_number ? `(${c.document_number})` : '' }}
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown class="w-4 h-4 text-gray-400" />
            </div>
            <CheckCircle2 v-if="selectedCustomer" class="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-in fade-in zoom-in duration-300" />
          </div>

        </div>
      </div>
      
      <!-- Vendedor Input Group -->
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 font-bold mb-1 block uppercase tracking-wide">
          Vendedor
        </label>
        <div class="flex gap-2">
          
          <div class="relative w-full">
            <IdCard class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
              v-model="internalSellerId"
              @change="emit('update:sellerId', internalSellerId ? Number(internalSellerId) : null)"
              class="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-sm font-medium text-gray-700 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:border-gray-300 dark:hover:border-gray-500 appearance-none"
              :class="selectedSeller ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50 text-blue-700 dark:text-blue-400' : ''"
            >
              <option value="">Seleccionar Vendedor</option>
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.name }}
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown class="w-4 h-4 text-gray-400" />
            </div>
            <CheckCircle2 v-if="selectedSeller" class="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-in fade-in zoom-in duration-300" />
          </div>

        </div>
      </div>
    </div>
    
    <!-- Divider -->
    <!-- Divider -->
    <div class="h-px bg-gray-100 dark:bg-border my-1"></div>

    <!-- Summary Card -->
    <div class="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-bl-full -mr-8 -mt-8 opacity-40 pointer-events-none"></div>
      
      <div class="relative z-10 space-y-2">
        <div class="flex justify-between text-gray-600 dark:text-gray-300 text-sm">
          <span>Subtotal</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(subtotal) }}</span>
        </div>
        <div class="flex justify-between text-gray-600 dark:text-gray-300 text-sm">
          <span>IVA</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(taxAmount) }}</span>
        </div>
        
        <div class="h-px bg-blue-200/50 dark:bg-blue-900/50 my-2"></div>
        
        <div class="flex justify-between items-end">
          <span class="text-base font-bold text-gray-800 dark:text-gray-200 mb-0.5">TOTAL</span>
          <span class="text-3xl font-bold text-blue-600 dark:text-primary dark:text-blue-400">{{ formatCurrency(total) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
