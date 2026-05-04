<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Trash2, Lock } from 'lucide-vue-next';
import {
    useProductAttributes,
    type ProductAttribute,
} from '@/composables/useProductAttributes';

const props = withDefaults(
    defineProps<{
        productId?: number;
        mode?: 'live' | 'draft';
        modelValue?: ProductAttribute[];
    }>(),
    {
        mode: 'live',
        modelValue: () => [],
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: ProductAttribute[]];
}>();

const {
    attributes,
    loading,
    error,
    fetchAttributes,
    addAttribute,
    updateAttribute,
    removeAttribute,
} = useProductAttributes(props.productId ?? 0);

const adding = ref(false);
const newName = ref('');
const newValue = ref('');
const actionError = ref('');
const savingIds = ref<Set<number>>(new Set());
const nextDraftId = ref(-1);

const isDraftMode = computed(() => props.mode === 'draft');
const displayedAttributes = computed(() =>
    isDraftMode.value ? props.modelValue : attributes.value,
);

const isInherited = (attr: ProductAttribute): boolean => {
    return (attr as any).source === 'category';
};

const isSelectInherited = (attr: ProductAttribute): boolean => {
    return (
        isInherited(attr) &&
        attr.type === 'select' &&
        Array.isArray(attr.options) &&
        attr.options.length > 0
    );
};

const emitDraftAttributes = (value: ProductAttribute[]) => {
    emit('update:modelValue', value);
};

/** Format a possibly array value for text display. */
const displayValue = (attr: ProductAttribute): string => {
    if (Array.isArray(attr.value)) {
        return attr.value.length > 0 ? [...attr.value].sort().join(', ') : '—';
    }
    return String(attr.value ?? '');
};

onMounted(async () => {
    if (!isDraftMode.value && props.productId) {
        await fetchAttributes();
    }
});

defineExpose({
    refresh: async () => {
        if (!isDraftMode.value && props.productId) {
            await fetchAttributes();
        }
    },
});

const handleAdd = async () => {
    if (!newName.value.trim() || !newValue.value.trim()) return;
    adding.value = true;
    actionError.value = '';
    try {
        if (isDraftMode.value) {
            emitDraftAttributes([
                ...displayedAttributes.value,
                {
                    id: nextDraftId.value--,
                    product_id: props.productId ?? 0,
                    name: newName.value.trim(),
                    value: newValue.value.trim(),
                    unit: null,
                    type: 'string',
                    options: null,
                    source: 'custom',
                } as ProductAttribute,
            ]);
            newName.value = '';
            newValue.value = '';
            return;
        }

        await addAttribute(newName.value.trim(), newValue.value.trim());
        newName.value = '';
        newValue.value = '';
    } catch (e: any) {
        actionError.value =
            e.response?.data?.message ||
            error.value ||
            'No se pudo agregar el atributo.';
    } finally {
        adding.value = false;
    }
};

let debounceTimers: Record<number, ReturnType<typeof setTimeout>> = {};

const debouncedSave = (
    attr: ProductAttribute,
    field: 'name' | 'value',
    newVal: string | string[],
) => {
    if (isDraftMode.value) {
        updateDraftField(attr, field, newVal);
        return;
    }

    if (debounceTimers[attr.id]) clearTimeout(debounceTimers[attr.id]);
    debounceTimers[attr.id] = setTimeout(() => {
        saveField(attr, field, newVal);
    }, 600);
};

const updateDraftField = (
    attr: ProductAttribute,
    field: 'name' | 'value',
    newVal: string | string[],
) => {
    emitDraftAttributes(
        displayedAttributes.value.map((item) =>
            item.id === attr.id ? { ...item, [field]: newVal } : item,
        ),
    );
};

const saveField = async (
    attr: ProductAttribute,
    field: 'name' | 'value',
    newVal: string | string[],
) => {
    const trimmed = typeof newVal === 'string' ? newVal.trim() : newVal;
    if (typeof trimmed === 'string' && !trimmed) return;

    if (isDraftMode.value) {
        updateDraftField(attr, field, trimmed);
        return;
    }

    // Skip if unchanged
    const current = attr[field];
    if (typeof trimmed === 'string' && current === trimmed) return;
    if (
        Array.isArray(trimmed) &&
        Array.isArray(current) &&
        JSON.stringify(trimmed) === JSON.stringify(current)
    )
        return;

    savingIds.value.add(attr.id);
    actionError.value = '';
    try {
        await updateAttribute(attr.id, { [field]: trimmed } as any);
    } catch (e: any) {
        actionError.value =
            e.response?.data?.message ||
            error.value ||
            'No se pudo actualizar.';
    } finally {
        savingIds.value.delete(attr.id);
    }
};

const flushAndSave = (
    attr: ProductAttribute,
    field: 'name' | 'value',
    newVal: string | string[],
) => {
    if (debounceTimers[attr.id]) clearTimeout(debounceTimers[attr.id]);
    saveField(attr, field, newVal);
};

const handleRemoveAttribute = async (attributeId: number) => {
    if (isDraftMode.value) {
        emitDraftAttributes(
            displayedAttributes.value.filter(
                (attribute) => attribute.id !== attributeId,
            ),
        );
        return;
    }

    try {
        await removeAttribute(attributeId);
    } catch (e: any) {
        actionError.value =
            e.response?.data?.message || 'No se pudo eliminar el atributo.';
    }
};
</script>

<template>
    <div class="space-y-4">
        <!-- Add Attribute Bar -->
        <div class="grid items-end gap-3 sm:grid-cols-12">
            <div class="sm:col-span-5">
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Atributo (Ej. Amperaje)</label
                >
                <input
                    v-model="newName"
                    type="text"
                    placeholder="Nombre"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                    @keyup.enter="handleAdd"
                />
            </div>
            <div class="sm:col-span-5">
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Valor (Ej. 100)</label
                >
                <input
                    v-model="newValue"
                    type="text"
                    placeholder="Valor"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                    @keyup.enter="handleAdd"
                />
            </div>
            <div class="sm:col-span-2">
                <button
                    @click="handleAdd"
                    :disabled="!newName || !newValue || adding"
                    class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    {{ adding ? '...' : 'Agregar' }}
                </button>
            </div>
        </div>
        <p v-if="actionError" class="text-sm text-red-600">{{ actionError }}</p>

        <!-- Inline-editable specs table -->
        <div
            class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background"
        >
            <div
                v-if="loading && displayedAttributes.length === 0"
                class="px-4 py-6 text-center text-sm text-gray-500"
            >
                Cargando especificaciones...
            </div>

            <div
                v-else-if="displayedAttributes.length === 0"
                class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
            >
                No hay especificaciones definidas.
            </div>

            <table v-else class="w-full text-left text-sm">
                <thead class="bg-gray-50 dark:bg-card">
                    <tr>
                        <th
                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                        >
                            Atributo
                        </th>
                        <th
                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                        >
                            Valor
                        </th>
                        <th class="w-12 px-4 py-2"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                    <tr
                        v-for="attr in displayedAttributes"
                        :key="attr.id"
                        class="group"
                        :class="{
                            'bg-amber-50/50 dark:bg-amber-900/10':
                                isInherited(attr),
                        }"
                    >
                        <td class="px-4 py-1.5">
                            <div class="flex items-center gap-1.5">
                                <Lock
                                    v-if="isInherited(attr)"
                                    class="h-3.5 w-3.5 shrink-0 text-amber-500"
                                    title="Atributo heredado de categoría"
                                />
                                <input
                                    :value="attr.name"
                                    @input="
                                        debouncedSave(
                                            attr,
                                            'name',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                        )
                                    "
                                    @blur="
                                        flushAndSave(
                                            attr,
                                            'name',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                        )
                                    "
                                    @keyup.enter="
                                        (
                                            $event.target as HTMLInputElement
                                        ).blur()
                                    "
                                    :readonly="isInherited(attr)"
                                    :class="[
                                        'w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium hover:border-gray-300 focus:border-blue-400 focus:bg-white focus:outline-none dark:hover:border-border dark:focus:border-primary dark:focus:bg-muted',
                                        isInherited(attr)
                                            ? 'text-amber-700 dark:text-amber-300'
                                            : 'text-gray-900 dark:text-white',
                                        isInherited(attr)
                                            ? 'cursor-not-allowed opacity-75'
                                            : '',
                                    ]"
                                />
                            </div>
                        </td>
                        <td class="px-4 py-1.5">
                            <div class="flex items-center gap-1.5">
                                <div
                                    v-if="isSelectInherited(attr)"
                                    class="w-full"
                                >
                                    <div
                                        class="max-h-40 overflow-y-auto rounded border border-gray-200 bg-white dark:border-border dark:bg-muted"
                                    >
                                        <label
                                            v-for="option in attr.options"
                                            :key="option"
                                            class="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-muted/80"
                                            :class="
                                                (
                                                    Array.isArray(attr.value)
                                                        ? attr.value.includes(
                                                              option,
                                                          )
                                                        : attr.value === option
                                                )
                                                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                                                    : 'text-gray-700 dark:text-gray-300'
                                            "
                                        >
                                            <input
                                                type="checkbox"
                                                :checked="
                                                    Array.isArray(attr.value)
                                                        ? attr.value.includes(
                                                              option,
                                                          )
                                                        : attr.value === option
                                                "
                                                class="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                                @change="
                                                    (() => {
                                                        const current =
                                                            Array.isArray(
                                                                attr.value,
                                                            )
                                                                ? [
                                                                      ...attr.value,
                                                                  ]
                                                                : attr.value
                                                                  ? [attr.value]
                                                                  : [];
                                                        const next =
                                                            current.includes(
                                                                option,
                                                            )
                                                                ? current.filter(
                                                                      (v) =>
                                                                          v !==
                                                                          option,
                                                                  )
                                                                : [
                                                                      ...current,
                                                                      option,
                                                                  ];
                                                        flushAndSave(
                                                            attr,
                                                            'value',
                                                            next,
                                                        );
                                                    })()
                                                "
                                            />
                                            <span class="text-sm select-none">{{
                                                option
                                            }}</span>
                                        </label>
                                    </div>
                                    <p
                                        v-if="
                                            Array.isArray(attr.value) &&
                                            attr.value.length > 0
                                        "
                                        class="mt-1 text-xs text-gray-400 dark:text-gray-500"
                                    >
                                        {{
                                            attr.value.length === 1
                                                ? '1 seleccionado'
                                                : `${attr.value.length} seleccionados`
                                        }}
                                    </p>
                                </div>
                                <input
                                    v-else
                                    :value="displayValue(attr)"
                                    @input="
                                        debouncedSave(
                                            attr,
                                            'value',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                        )
                                    "
                                    @blur="
                                        flushAndSave(
                                            attr,
                                            'value',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                        )
                                    "
                                    @keyup.enter="
                                        (
                                            $event.target as HTMLInputElement
                                        ).blur()
                                    "
                                    class="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-sm text-gray-700 hover:border-gray-300 focus:border-blue-400 focus:bg-white focus:outline-none dark:text-gray-300 dark:hover:border-border dark:focus:border-primary dark:focus:bg-muted"
                                />
                                <div
                                    v-if="savingIds.has(attr.id)"
                                    class="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"
                                ></div>
                            </div>
                        </td>
                        <td class="px-2 py-1.5 text-right">
                            <button
                                v-if="!isInherited(attr)"
                                @click="handleRemoveAttribute(attr.id)"
                                class="text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600"
                                title="Eliminar"
                            >
                                <Trash2 class="h-4 w-4" />
                            </button>
                            <span
                                v-else
                                class="text-xs text-amber-500 dark:text-amber-400"
                                title="Heredado de categoría"
                            >
                                Heredado
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
