<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const sortOptions = [
  { value: 'name_asc', label: 'Nombre A-Z' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'sku_asc', label: 'SKU A-Z' },
  { value: 'newest', label: 'Más recientes' },
]

const onChange = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="inline-flex items-center gap-1.5">
    <ArrowUpDown class="w-3.5 h-3.5 text-gray-400 shrink-0" />
    <select
      :value="modelValue"
      @change="onChange"
      class="text-xs bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow cursor-pointer pr-7"
    >
      <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>
