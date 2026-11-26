<script setup lang="ts">
/**
 * Tipo de inventario del producto (como el "Type" de Lightspeed):
 * inventariable lleva existencia; no inventariable es un servicio o cargo.
 */
import type { ProductInventoryType } from '@/types/product';

defineProps<{ modelValue: ProductInventoryType | undefined }>();
const emit = defineEmits<{
    'update:modelValue': [value: ProductInventoryType];
}>();

const OPTIONS: { value: ProductInventoryType; label: string }[] = [
    { value: 'single', label: 'Inventariable' },
    { value: 'non_inventory', label: 'No inventariable' },
];
</script>

<template>
    <div
        role="radiogroup"
        aria-label="Tipo de inventario"
        data-test="product-inventory-type-toggle"
        class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs dark:border-border dark:bg-muted"
    >
        <button
            v-for="option in OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            :data-value="option.value"
            :aria-checked="(modelValue || 'single') === option.value"
            class="rounded-md px-3 py-1 font-medium transition-colors"
            :class="
                (modelValue || 'single') === option.value
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-card dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            "
            @click="emit('update:modelValue', option.value)"
        >
            {{ option.label }}
        </button>
    </div>
</template>
