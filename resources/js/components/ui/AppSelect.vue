<script setup lang="ts">
/**
 * Selector estándar del sistema (reemplaza al <select> nativo): misma apariencia que el resto de
 * listas (SearchableSelect), lista redondeada y con el tema, y buscador cuando hay muchas opciones.
 *
 * Respeta los valores originales de cada opción (números, textos, null o undefined), así que se
 * puede usar con v-model igual que un <select>. Los valores "vacíos" (null, undefined, '') se
 * consideran equivalentes para mostrar la opción elegida (por ejemplo, "Todos").
 */
import { computed } from 'vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

export interface AppSelectOption {
    value: unknown;
    label: string;
    disabled?: boolean;
}

const props = withDefaults(
    defineProps<{
        options: AppSelectOption[];
        modelValue?: unknown;
        placeholder?: string;
        disabled?: boolean;
        ariaLabel?: string;
        /** Por defecto, buscador solo con más de 8 opciones. */
        searchable?: boolean;
    }>(),
    {
        modelValue: undefined,
        placeholder: 'Seleccionar...',
        disabled: false,
        ariaLabel: undefined,
        searchable: undefined,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: any];
}>();

const isEmpty = (value: unknown) =>
    value === null || value === undefined || value === '';

const same = (a: unknown, b: unknown) =>
    a === b || (isEmpty(a) && isEmpty(b)) || String(a) === String(b);

const enabledOptions = computed(() =>
    props.options.filter((option) => !option.disabled),
);

// SearchableSelect trabaja con valores simples: se usa la posición de cada opción.
const internalOptions = computed(() =>
    enabledOptions.value.map((option, index) => ({
        value: index,
        label: option.label,
    })),
);

const selectedIndex = computed(() => {
    const index = enabledOptions.value.findIndex((option) =>
        same(option.value, props.modelValue),
    );
    return index === -1 ? null : index;
});

const isSearchable = computed(
    () => props.searchable ?? enabledOptions.value.length > 8,
);

const onUpdate = (index: number | string | null) => {
    if (index === null) return;
    emit('update:modelValue', enabledOptions.value[Number(index)]?.value);
};
</script>

<template>
    <SearchableSelect
        :options="internalOptions"
        :model-value="selectedIndex"
        :placeholder="placeholder"
        :disabled="disabled"
        :searchable="isSearchable"
        :aria-label="ariaLabel ?? placeholder"
        @update:model-value="onUpdate"
    />
</template>
