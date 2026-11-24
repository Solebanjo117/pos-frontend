<script setup lang="ts">
import { computed, ref } from 'vue';

/**
 * Celda de la tabla de Productos con varios valores (categorías, números de parte, carros):
 * uno debajo del otro, el principal primero y en negrita. Muestra `max` y un "+N más" que
 * despliega el resto en la misma celda ("ver menos" lo vuelve a juntar).
 */
export interface StackedCellItem {
    label: string;
    detail?: string | null;
    primary?: boolean;
}

const props = withDefaults(
    defineProps<{
        items: StackedCellItem[];
        max?: number;
        mono?: boolean;
    }>(),
    { max: 2, mono: false },
);

const expanded = ref(false);

const visible = computed(() =>
    expanded.value ? props.items : props.items.slice(0, props.max),
);
const hiddenCount = computed(() => Math.max(0, props.items.length - props.max));
const fullText = computed(() =>
    props.items
        .map((item) =>
            item.detail ? `${item.label} · ${item.detail}` : item.label,
        )
        .join('\n'),
);
</script>

<template>
    <div
        v-if="items.length"
        data-test="stacked-cell"
        class="flex min-w-0 flex-col gap-0.5"
        :title="fullText"
    >
        <span
            v-for="(item, index) in visible"
            :key="`${item.label}-${item.detail ?? ''}-${index}`"
            class="leading-snug break-words"
            :class="[
                mono ? 'font-mono text-xs' : 'text-sm',
                item.primary
                    ? 'font-semibold text-gray-900 dark:text-white'
                    : 'text-gray-700 dark:text-gray-300',
            ]"
            >{{ item.label
            }}<span
                v-if="item.detail"
                class="font-sans text-xs font-normal text-gray-500 dark:text-gray-400"
            >
                · {{ item.detail }}</span
            ></span
        >
        <button
            v-if="hiddenCount > 0"
            type="button"
            data-test="stacked-cell-toggle"
            class="self-start text-xs font-medium text-blue-600 hover:underline dark:text-primary"
            :aria-expanded="expanded"
            @click.stop="expanded = !expanded"
        >
            {{ expanded ? 'ver menos' : `+${hiddenCount} más` }}
        </button>
    </div>
    <span v-else class="text-xs text-gray-400">—</span>
</template>
