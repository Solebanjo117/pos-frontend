<script setup lang="ts">
/**
 * Gama de la marca: cada marca es Standard o Premium (solo una de las dos).
 */
import { BRAND_TIER_OPTIONS } from '@/utils/brandTier';
import type { BrandTier } from '@/utils/brandTier';

defineProps<{
    modelValue: BrandTier;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: BrandTier];
}>();
</script>

<template>
    <div
        role="radiogroup"
        aria-label="Gama de la marca"
        class="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1 dark:border-border dark:bg-muted"
    >
        <button
            v-for="option in BRAND_TIER_OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="modelValue === option.value"
            :data-testid="`brand-tier-${option.value}`"
            class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
                modelValue === option.value
                    ? option.value === 'premium'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white text-gray-900 shadow-sm dark:bg-card dark:text-white'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            "
            @click="emit('update:modelValue', option.value)"
        >
            {{ option.label }}
        </button>
    </div>
</template>
