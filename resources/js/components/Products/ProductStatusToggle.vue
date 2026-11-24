<script setup lang="ts">
/** Estado del producto como interruptor de dos opciones (no es un código). */
defineProps<{ modelValue: string | undefined }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'discontinued', label: 'Discontinuado' },
];
</script>

<template>
    <div
        role="radiogroup"
        aria-label="Estado del producto"
        data-test="product-status-toggle"
        class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs dark:border-border dark:bg-muted"
    >
        <button
            v-for="option in OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="(modelValue || 'active') === option.value"
            class="rounded-md px-3 py-1 font-medium transition-colors"
            :class="
                (modelValue || 'active') === option.value
                    ? option.value === 'active'
                        ? 'bg-white text-green-700 shadow-sm dark:bg-card dark:text-green-400'
                        : 'bg-white text-gray-700 shadow-sm dark:bg-card dark:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            "
            @click="emit('update:modelValue', option.value)"
        >
            <span
                class="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                :class="
                    option.value === 'active' ? 'bg-green-500' : 'bg-gray-400'
                "
            />{{ option.label }}
        </button>
    </div>
</template>
