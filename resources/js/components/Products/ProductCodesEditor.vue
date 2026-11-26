<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { AlertTriangle, Check, Copy, Plus, Star, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import apiClient from '@/services/api/client';
import type { ProductCode, ProductCodeType } from '@/types/product';

/**
 * Números de parte del producto. Uno es el principal (★): se imprime en tickets, cotizaciones y
 * órdenes de compra, y lo usan todas sus marcas. Los demás son otros números con los que se
 * conoce la misma pieza; en la tabla de Productos se ven todos.
 */
interface DuplicateMatch {
    id: number;
    variant_id?: number | null;
    name: string;
    matched_code: string;
    primary_code?: string | null;
    url: string;
}

const props = withDefaults(
    defineProps<{
        modelValue: ProductCode[];
        excludeProductId?: number;
        excludeVariantId?: number;
        disabled?: boolean;
    }>(),
    {
        excludeProductId: undefined,
        excludeVariantId: undefined,
        disabled: false,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: ProductCode[]];
    'conflict-change': [hasConflict: boolean];
}>();

const TYPE_OPTIONS: Array<{ value: ProductCodeType; label: string }> = [
    { value: 'sku', label: 'Número de parte' },
    { value: 'alternate', label: 'Alterno' },
    { value: 'upc', label: 'Código de barras' },
    { value: 'manual', label: 'Otro' },
];

const newCode = ref('');
const localError = ref('');
const checking = ref(false);
const copiedIndex = ref<number | null>(null);
const matches = ref<Record<string, DuplicateMatch>>({});
let validationTimer: ReturnType<typeof setTimeout> | null = null;
let validationGeneration = 0;

const normalizeCode = (value: string): string =>
    value
        .trim()
        .toLocaleUpperCase()
        .replace(/[^\p{L}\p{N}]+/gu, '');

const hasConflicts = computed(() => Object.keys(matches.value).length > 0);

const updateCodes = (codes: ProductCode[]) => {
    emit('update:modelValue', codes);
};

/** Tipo sugerido: el primero es el número de parte; 12-14 dígitos es código de barras. */
const guessType = (code: string): ProductCodeType => {
    if (/^\d{12,14}$/.test(code.replace(/\s+/g, ''))) return 'upc';
    return props.modelValue.length === 0 ? 'sku' : 'alternate';
};

const addCode = () => {
    localError.value = '';
    const code = newCode.value.trim();
    const normalized = normalizeCode(code);

    if (!normalized) {
        localError.value = 'Escribe un número válido.';
        return;
    }

    if (
        props.modelValue.some((item) => normalizeCode(item.code) === normalized)
    ) {
        localError.value = 'Este número ya está en la lista.';
        return;
    }

    updateCodes([
        ...props.modelValue,
        {
            code,
            type: guessType(code),
            is_primary: props.modelValue.length === 0,
        },
    ]);
    newCode.value = '';
};

const setPrimary = (index: number) => {
    updateCodes(
        props.modelValue.map((code, codeIndex) => ({
            ...code,
            is_primary: codeIndex === index,
        })),
    );
};

/** Al quitar el principal, el siguiente de la lista pasa a ser principal. */
const removeCode = (index: number) => {
    localError.value = '';
    const removedPrimary = Boolean(props.modelValue[index]?.is_primary);
    const rest = props.modelValue.filter((_, codeIndex) => codeIndex !== index);
    if (removedPrimary && rest.length) {
        rest[0] = { ...rest[0], is_primary: true };
    }
    updateCodes(rest);
};

const updateCode = (index: number, field: 'code' | 'type', value: string) => {
    updateCodes(
        props.modelValue.map((code, codeIndex) =>
            codeIndex === index ? { ...code, [field]: value } : code,
        ),
    );
};

const copyCode = async (index: number) => {
    try {
        await navigator.clipboard?.writeText(props.modelValue[index].code);
        copiedIndex.value = index;
        setTimeout(() => {
            if (copiedIndex.value === index) copiedIndex.value = null;
        }, 1200);
    } catch {
        // Sin permiso de portapapeles: no pasa nada.
    }
};

/** El principal siempre se muestra primero; el índice real se conserva para editar. */
const rows = computed(() =>
    props.modelValue
        .map((item, index) => ({ item, index }))
        .sort(
            (a, b) =>
                Number(Boolean(b.item.is_primary)) -
                Number(Boolean(a.item.is_primary)),
        ),
);

const validateAll = async () => {
    const generation = ++validationGeneration;
    const nextMatches: Record<string, DuplicateMatch> = {};
    const uniqueCodes = Array.from(
        new Map(
            props.modelValue
                .filter((item) => normalizeCode(item.code))
                .map((item) => [normalizeCode(item.code), item.code]),
        ).entries(),
    );

    checking.value = true;
    try {
        await Promise.all(
            uniqueCodes.map(async ([normalized, code]) => {
                const response = await apiClient.get(
                    '/products/check-duplicate',
                    {
                        params: {
                            code,
                            exclude_product_id: props.excludeProductId,
                            exclude_variant_id: props.excludeVariantId,
                        },
                    },
                );
                const match = response.data.data?.[0] as
                    | DuplicateMatch
                    | undefined;
                if (match) nextMatches[normalized] = match;
            }),
        );

        if (generation === validationGeneration) matches.value = nextMatches;
    } finally {
        if (generation === validationGeneration) checking.value = false;
    }
};

watch(
    () => props.modelValue,
    () => {
        if (validationTimer) clearTimeout(validationTimer);
        validationTimer = setTimeout(validateAll, 450);
    },
    { deep: true, immediate: true },
);

watch(hasConflicts, (value) => emit('conflict-change', value), {
    immediate: true,
});

defineExpose({ hasConflicts: () => hasConflicts.value, validateAll });
</script>

<template>
    <div class="space-y-3" data-test="product-codes-editor">
        <ul
            v-if="modelValue.length"
            class="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-border dark:border-border"
        >
            <li
                v-for="{ item, index } in rows"
                :key="item.id ?? `${normalizeCode(item.code)}-${index}`"
                data-test="code-row"
                :class="
                    item.is_primary ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
                "
            >
                <div class="flex items-center gap-2 px-3 py-2">
                    <button
                        type="button"
                        data-test="code-star"
                        class="shrink-0 rounded p-0.5 disabled:cursor-default"
                        :class="
                            item.is_primary
                                ? 'text-amber-500'
                                : 'text-gray-300 hover:text-amber-400 dark:text-gray-600'
                        "
                        :disabled="disabled || item.is_primary"
                        :aria-label="
                            item.is_primary
                                ? `${item.code} es el principal`
                                : `Hacer principal ${item.code}`
                        "
                        :title="
                            item.is_primary ? 'Principal' : 'Hacer principal'
                        "
                        @click="setPrimary(index)"
                    >
                        <Star
                            class="h-4 w-4"
                            :fill="item.is_primary ? 'currentColor' : 'none'"
                        />
                    </button>

                    <div class="min-w-0 flex-1">
                        <input
                            :value="item.code"
                            :disabled="disabled"
                            aria-label="Número de parte"
                            class="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-sm hover:border-gray-200 focus:border-primary focus:bg-white focus:outline-none dark:hover:border-border dark:focus:bg-muted"
                            :class="
                                item.is_primary
                                    ? 'font-semibold text-gray-900 dark:text-white'
                                    : 'text-gray-700 dark:text-gray-300'
                            "
                            @input="
                                updateCode(
                                    index,
                                    'code',
                                    ($event.target as HTMLInputElement).value,
                                )
                            "
                        />
                        <p
                            v-if="item.is_primary"
                            class="px-1.5 text-[11px] text-amber-700 dark:text-amber-300"
                        >
                            Principal · se imprime en tickets y pedidos
                        </p>
                    </div>

                    <AppSelect
                        :model-value="item.type"
                        :disabled="disabled"
                        aria-label="Tipo de número"
                        class="hidden w-40 shrink-0 sm:block"
                        :options="TYPE_OPTIONS"
                        @update:model-value="
                            updateCode(index, 'type', String($event))
                        "
                    />

                    <button
                        type="button"
                        class="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                        :aria-label="`Copiar ${item.code}`"
                        :title="copiedIndex === index ? 'Copiado' : 'Copiar'"
                        @click="copyCode(index)"
                    >
                        <Check
                            v-if="copiedIndex === index"
                            class="h-3.5 w-3.5 text-green-600"
                        />
                        <Copy v-else class="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        class="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                        :disabled="disabled"
                        :aria-label="`Eliminar código ${item.code}`"
                        @click="removeCode(index)"
                    >
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>

                <div
                    v-if="matches[normalizeCode(item.code)]"
                    data-test="code-duplicate"
                    class="mx-3 mb-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                >
                    <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        Ya lo usa
                        <strong>{{
                            matches[normalizeCode(item.code)].name
                        }}</strong
                        >.
                        <Link
                            :href="matches[normalizeCode(item.code)].url"
                            class="ml-1 font-medium underline underline-offset-2"
                        >
                            Ver producto existente
                        </Link>
                    </span>
                </div>
            </li>
        </ul>

        <div
            v-else
            class="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-muted-foreground dark:border-border"
        >
            Sin número de parte. Puedes guardar el producto y agregarlo después.
        </div>

        <div class="flex gap-2">
            <input
                v-model="newCode"
                type="text"
                :disabled="disabled"
                data-test="code-new"
                class="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-border dark:bg-muted dark:text-white"
                placeholder="Ej: 45503-19155"
                @keydown.enter.prevent="addCode"
            />
            <button
                type="button"
                :disabled="disabled || !newCode.trim()"
                class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-border dark:text-gray-200 dark:hover:bg-gray-800"
                @click="addCode"
            >
                <Plus class="h-4 w-4" /> Agregar
            </button>
        </div>
        <p class="text-xs text-muted-foreground">
            Escribe el número y presiona Enter. El primero queda como principal;
            cámbialo con la ★.
        </p>

        <p v-if="localError" class="text-sm text-destructive">
            {{ localError }}
        </p>
        <p v-if="checking" class="text-xs text-muted-foreground">
            Verificando números…
        </p>
    </div>
</template>
