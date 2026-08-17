<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { Check, Plus, Star, Trash2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/services/api/client';
import type { ProductCode, ProductCodeType } from '@/types/product';

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

const newCode = ref('');
const newType = ref<ProductCodeType>('sku');
const localError = ref('');
const checking = ref(false);
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

const addCode = () => {
    localError.value = '';
    const code = newCode.value.trim();
    const normalized = normalizeCode(code);

    if (!normalized) {
        localError.value = 'Escribe un código válido.';
        return;
    }

    if (
        props.modelValue.some((item) => normalizeCode(item.code) === normalized)
    ) {
        localError.value = 'Este código ya está incluido en la lista.';
        return;
    }

    updateCodes([
        ...props.modelValue,
        {
            code,
            type: newType.value,
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

const removeCode = (index: number) => {
    const selected = props.modelValue[index];
    if (selected.is_primary && props.modelValue.length > 1) {
        localError.value =
            'Selecciona otro código principal antes de eliminar el actual.';
        return;
    }

    localError.value = '';
    updateCodes(props.modelValue.filter((_, codeIndex) => codeIndex !== index));
};

const updateCode = (index: number, field: 'code' | 'type', value: string) => {
    updateCodes(
        props.modelValue.map((code, codeIndex) =>
            codeIndex === index ? { ...code, [field]: value } : code,
        ),
    );
};

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
    <div class="space-y-4">
        <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <Input
                v-model="newCode"
                :disabled="disabled"
                class="font-mono"
                placeholder="Ej: 45503-19155"
                @keydown.enter.prevent="addCode"
            />
            <select
                v-model="newType"
                :disabled="disabled"
                class="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Tipo de código"
            >
                <option value="sku">SKU</option>
                <option value="upc">UPC</option>
                <option value="alternate">Alterno</option>
                <option value="manual">Manual</option>
            </select>
            <Button
                type="button"
                variant="outline"
                :disabled="disabled"
                @click="addCode"
            >
                <Plus class="mr-2 h-4 w-4" /> Agregar
            </Button>
        </div>

        <p v-if="localError" class="text-sm text-destructive">
            {{ localError }}
        </p>

        <div v-if="modelValue.length" class="space-y-2">
            <div
                v-for="(item, index) in modelValue"
                :key="item.id ?? `${normalizeCode(item.code)}-${index}`"
                class="rounded-lg border bg-background p-3"
            >
                <div
                    class="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto_auto]"
                >
                    <Input
                        :model-value="item.code"
                        :disabled="disabled"
                        class="font-mono"
                        aria-label="Código comercial"
                        @update:model-value="
                            updateCode(index, 'code', String($event))
                        "
                    />
                    <select
                        :value="item.type"
                        :disabled="disabled"
                        class="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        aria-label="Tipo de código"
                        @change="
                            updateCode(
                                index,
                                'type',
                                ($event.target as HTMLSelectElement).value,
                            )
                        "
                    >
                        <option value="sku">SKU</option>
                        <option value="upc">UPC</option>
                        <option value="alternate">Alterno</option>
                        <option value="manual">Manual</option>
                    </select>
                    <Button
                        type="button"
                        size="sm"
                        :variant="item.is_primary ? 'default' : 'outline'"
                        :disabled="disabled || item.is_primary"
                        @click="setPrimary(index)"
                    >
                        <Check v-if="item.is_primary" class="mr-1 h-4 w-4" />
                        <Star v-else class="mr-1 h-4 w-4" />
                        {{ item.is_primary ? 'Principal' : 'Hacer principal' }}
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        :disabled="disabled"
                        :aria-label="`Eliminar código ${item.code}`"
                        @click="removeCode(index)"
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>
                </div>

                <div
                    v-if="matches[normalizeCode(item.code)]"
                    class="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive"
                >
                    Este código pertenece a
                    <strong>{{ matches[normalizeCode(item.code)].name }}</strong
                    >.
                    <Link
                        :href="matches[normalizeCode(item.code)].url"
                        class="ml-1 font-medium underline underline-offset-2"
                    >
                        Ver producto existente
                    </Link>
                </div>
            </div>
        </div>

        <div
            v-else
            class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
        >
            Sin código. Puedes guardar el producto y agregar códigos después.
        </div>

        <p v-if="checking" class="text-xs text-muted-foreground">
            Verificando códigos…
        </p>
    </div>
</template>
