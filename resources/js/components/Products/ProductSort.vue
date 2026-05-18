<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next';

const props = defineProps<{
    modelValue: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
}>();

const sortOptions = [
    { value: 'name_asc', label: 'Nombre A-Z' },
    { value: 'price_asc', label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'sku_asc', label: 'SKU A-Z' },
    { value: 'newest', label: 'Más recientes' },
];

const onChange = (e: Event) => {
    emit('update:modelValue', (e.target as HTMLSelectElement).value);
};
</script>

<template>
    <div class="inline-flex items-center gap-1.5">
        <ArrowUpDown class="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <select
            :value="modelValue"
            @change="onChange"
            class="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 pr-7 text-xs text-gray-700 transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none dark:border-border dark:bg-muted dark:text-foreground"
        >
            <option
                v-for="opt in sortOptions"
                :key="opt.value"
                :value="opt.value"
            >
                {{ opt.label }}
            </option>
        </select>
    </div>
</template>
