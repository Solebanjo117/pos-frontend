<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { Calculator, ChevronDown, Check, X } from 'lucide-vue-next'
import apiClient from '@/services/api/client'
import { useDebounceFn } from '@vueuse/core'
import { usePricingFormulas } from '@/composables/usePricingFormulas'

const props = defineProps<{
  cost: number
  taxRate?: number
  modelValue?: string   // The formula string (e.g. "costo * 2")
  price?: number        // The numeric base_price
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:price': [price: number]
}>()

// ==================== STATE ====================

const rawInput = ref(props.modelValue || (props.price !== undefined && props.price > 0 ? String(props.price) : ''))
const preview = ref<{ success: boolean; result?: number; error?: string } | null>(null)
const showPresets = ref(false)
const isLoadingPreview = ref(false)
const isFocused = ref(false)

const { activeFormulas, fetchActiveFormulas } = usePricingFormulas()
const PRESETS = computed(() => activeFormulas.value.map((f: any) => ({
  label: f.name,
  formula: f.formula
})))

// ==================== COMPUTED ====================

// Use real cost; if 0, formulas resolving to 0 are still valid
const effectiveCost = computed(() => Number(props.cost) || 0)
const effectiveTax  = computed(() => props.taxRate ?? 7)

/**
 * Detects if the input is likely a formula (not just a plain number).
 * A formula contains letters or operators beyond what a plain number would use.
 */
const isFormula = computed(() => {
  const v = rawInput.value.trim()
  if (!v) return false
  // Pure numeric (including decimals) = not a formula
  if (/^-?\d+(\.\d+)?$/.test(v)) return false
  return true
})

const previewText = computed(() => {
  if (!isFormula.value) return null
  if (!rawInput.value.trim()) return null
  if (isLoadingPreview.value) return '...'
  if (!preview.value) return null
  if (!preview.value.success) return `Error: ${preview.value.error}`
  return `$${preview.value.result?.toFixed(2)}`
})

const previewColor = computed(() => {
  if (!preview.value) return ''
  return preview.value.success ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
})

const inputClass = computed(() => {
  if (isFormula.value && preview.value?.success) {
    return 'border-blue-400 ring-1 ring-blue-300 dark:border-blue-500'
  }
  if (isFormula.value && preview.value && !preview.value.success) {
    return 'border-red-400 ring-1 ring-red-300 dark:border-red-500'
  }
  return 'border-gray-300 dark:border-border'
})

// Control qué muestra el input:
// - Si se está editando (foco), mostramos exactamente lo que el usuario escribió (num/fórmula).
// - Si se quitó el foco (Blur), es fórmula válida, y pre-calculamos -> mostramos el resultado calculado final (estilo Excel).
const displayValue = computed(() => {
  if (isFocused.value) {
    return rawInput.value
  }
  if (isFormula.value && preview.value?.success && preview.value.result !== undefined) {
    return preview.value.result.toFixed(2)
  }
  return rawInput.value
})

const onFocus = () => {
    isFocused.value = true
}

const onBlur = () => {
    isFocused.value = false
    commitValue()
    // Delay hide presets for click
    setTimeout(() => {
        showPresets.value = false
    }, 200)
}

const onKeydownEnter = (e: KeyboardEvent) => {
    (e.target as HTMLInputElement).blur()
}

// ==================== ACTIONS ====================

async function fetchPreview() {
  if (!isFormula.value || !rawInput.value.trim()) {
    preview.value = null
    return
  }
  isLoadingPreview.value = true
  try {
    const { data } = await apiClient.post('/pricing-formula/preview', {
      formula: rawInput.value,
      cost: effectiveCost.value,
      tax_rate: effectiveTax.value,
    })
    preview.value = data
    // NOTE: no emit here — price is only committed on blur/Enter via commitValue()
  } catch {
    preview.value = { success: false, error: 'Error de conexión' }
  } finally {
    isLoadingPreview.value = false
  }
}

const debouncedFetch = useDebounceFn(fetchPreview, 400)

// Only preview while typing — actual price commit happens on blur/enter
watch(rawInput, (val) => {
  if (isFormula.value) {
    // Formula mode: debounce preview only (no price emit yet)
    debouncedFetch()
  } else {
    // Numeric mode: clear preview, emit will happen on blur/enter
    preview.value = null
  }
})

/** Commit the current value — called on blur and Enter */
async function commitValue() {
  if (isFormula.value) {
    emit('update:modelValue', rawInput.value)
    // If we already have a successful preview, emit the price immediately
    if (preview.value?.success && preview.value.result !== undefined) {
      emit('update:price', preview.value.result)
    } else {
      // Await the fetch so we can emit the price right after
      await fetchPreview()
      if (preview.value?.success && preview.value.result !== undefined) {
        emit('update:price', preview.value.result)
      }
    }
  } else {
    const numVal = parseFloat(rawInput.value) || 0
    emit('update:modelValue', '')
    emit('update:price', numVal)
  }
}

watch(() => props.cost, () => {
  if (isFormula.value) debouncedFetch()
})

// Re-evalúa precio cuando cambia la tasa ITBM
watch(() => props.taxRate, async (newRate) => {
  if (isFormula.value) {
    // En modo fórmula: re-fetch (la API ya usa taxRate para calcular ITBM)
    await fetchPreview()
    if (preview.value?.success && preview.value.result !== undefined) {
      emit('update:price', preview.value.result)
    }
  } else {
    // En modo número plano: aplicar ITBM al valor base
    const base = parseFloat(rawInput.value)
    if (!isNaN(base) && base > 0) {
      const rate = Number(newRate) || 0
      const withTax = Number((base * (1 + rate / 100)).toFixed(2))
      emit('update:modelValue', '')
      emit('update:price', withTax)
    }
  }
})

// Sync if parent changes modelValue externally (e.g. on load)
watch(() => props.modelValue, (newFormula) => {
  if (newFormula && rawInput.value !== newFormula) {
    rawInput.value = newFormula
  }
}, { immediate: true })

// Sync if parent changes price externally (e.g. on load, only if no formula)
watch(() => props.price, (newPrice) => {
  if (!props.modelValue && newPrice !== undefined && newPrice > 0) {
    const current = parseFloat(rawInput.value)
    if (current !== newPrice) {
      rawInput.value = String(newPrice)
    }
  }
}, { immediate: true })

function selectPreset(preset: { label: string, formula: string }) {
  rawInput.value = preset.formula
  showPresets.value = false
}

function clearInput() {
  rawInput.value = ''
  preview.value = null
  emit('update:modelValue', '')
  emit('update:price', 0)
}

// Fetch on mount after nextTick so props are fully hydrated
onMounted(async () => {
  await nextTick()
  // Fetch formulas dynamically
  if (activeFormulas.value.length === 0) {
      await fetchActiveFormulas()
  }
  
  if (isFormula.value && rawInput.value.trim()) {
    fetchPreview()
  }
})
</script>

<template>
  <div class="space-y-1">
    <!-- Input row -->
    <div class="flex gap-1.5 items-center">
      <!-- Main input (dual mode: number OR formula) -->
      <div class="relative flex-1">
        <!-- Formula icon indicator -->
        <span
          v-if="isFormula"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none select-none text-xs font-mono font-bold"
          title="Modo fórmula"
        >ƒ</span>
        <input
          :value="displayValue"
          @input="rawInput = ($event.target as HTMLInputElement).value"
          @keydown.enter="onKeydownEnter"
          @focus="onFocus"
          @blur="onBlur"
          type="text"
          :class="[
            'w-full py-2 pr-3 text-sm rounded-lg border bg-white dark:bg-card text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors font-mono',
            (isFormula && !isFocused) ? 'pl-7 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 font-semibold' : (isFormula ? 'pl-7' : 'pl-3'),
            inputClass
          ]"
          :placeholder="isFormula ? 'ej: costo * 2 o ROUND(costo * 1.5)' : 'Precio de venta...'"
        />
        <!-- Clear button when filled -->
        <button
          v-if="rawInput"
          @click="clearInput"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 transition-colors"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Presets dropdown button -->
      <div class="relative flex-shrink-0">
        <button
          @mousedown.prevent="showPresets = !showPresets"
          type="button"
          class="h-9 px-2.5 rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-card text-gray-500 hover:text-blue-500 hover:border-blue-400 transition-colors flex items-center gap-1"
          title="Fórmulas predefinidas"
        >
          <Calculator class="w-4 h-4" />
          <ChevronDown class="w-3.5 h-3.5" :class="{ 'rotate-180': showPresets }" />
        </button>

        <div
          v-if="showPresets"
          class="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-lg overflow-hidden"
        >
          <div class="px-3 py-2 border-b border-gray-100 dark:border-border">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Fórmulas rápidas</p>
          </div>
          <button
            v-for="preset in PRESETS"
            :key="preset.formula"
            @click="selectPreset(preset)"
            type="button"
            class="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-muted flex items-start gap-2 group"
          >
            <Check
              class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500 transition-opacity"
              :class="rawInput === preset.formula ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'"
            />
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ preset.label }}</p>
              <p class="text-xs text-gray-400 font-mono">{{ preset.formula }}</p>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Formula preview row (only when in formula mode AND focused) -->
    <div v-if="isFormula && isFocused" class="flex items-center gap-2 text-xs min-h-[16px]">
      <span v-if="isLoadingPreview" class="text-gray-400 animate-pulse">Calculando...</span>
      <template v-else-if="previewText">
        <span class="text-gray-400">Con costo ${{ effectiveCost.toFixed(2) }} →</span>
        <span :class="['font-semibold', previewColor]">{{ previewText }}</span>
      </template>
    </div>

    <!-- Help hint (static, only shown when entering formula mode) -->
    <p v-if="isFormula" class="text-xs text-gray-400">
      Variables: <code class="bg-gray-100 dark:bg-muted px-1 rounded">costo</code>,
      <code class="bg-gray-100 dark:bg-muted px-1 rounded">ITBM</code> ·
      Funciones: ROUND, ROUNDUP, FLOOR, CEIL
    </p>
  </div>
</template>
