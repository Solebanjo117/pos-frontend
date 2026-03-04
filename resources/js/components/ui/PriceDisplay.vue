<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '@/utils/formatters'

const props = withDefaults(defineProps<{
    basePrice: number
    taxRate?: number
    size?: 'sm' | 'md' | 'lg'
    layout?: 'stacked' | 'inline'
}>(), {
    taxRate: 0,
    size: 'md',
    layout: 'stacked',
})

const taxAmount = computed(() => props.basePrice * (props.taxRate / 100))
const netPrice = computed(() => props.basePrice + taxAmount.value)
const isExempt = computed(() => props.taxRate === 0)

const sizeClasses = computed(() => {
    switch (props.size) {
        case 'sm':
            return { net: 'text-xs font-semibold', detail: 'text-[10px]' }
        case 'lg':
            return { net: 'text-base font-bold', detail: 'text-xs' }
        default:
            return { net: 'text-sm font-semibold', detail: 'text-[11px]' }
    }
})
</script>

<template>
    <div :class="layout === 'inline' ? 'inline-flex items-baseline gap-1.5' : 'flex flex-col'">
        <!-- Net Price (with tax) -->
        <span :class="sizeClasses.net" class="text-gray-900 dark:text-white">
            {{ formatCurrency(netPrice) }}
        </span>
        <!-- Tax breakdown or Exempt tag -->
        <span v-if="isExempt"
            class="inline-flex items-center rounded px-1 py-0.5 text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 leading-none"
            :class="sizeClasses.detail">
            Exento
        </span>
        <span v-else class="text-gray-400 dark:text-gray-500 leading-tight" :class="sizeClasses.detail">
            Base {{ formatCurrency(basePrice) }} + ITBMS {{ formatCurrency(taxAmount) }}
        </span>
    </div>
</template>
