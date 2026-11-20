<script setup lang="ts">
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

defineProps<{
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

const onChange = (value: number | string | null) => {
    if (typeof value === 'string') emit('update:modelValue', value);
};
</script>

<template>
    <SearchableSelect
        class="w-52"
        :options="sortOptions"
        :model-value="modelValue"
        :searchable="false"
        aria-label="Ordenar productos"
        @update:model-value="onChange"
    />
</template>
