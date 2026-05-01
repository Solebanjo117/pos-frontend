<script setup lang="ts">
import { ref } from 'vue';
import { ChevronRight } from 'lucide-vue-next';

const props = withDefaults(
    defineProps<{
        title: string;
        subtitle?: string;
        count?: number | string;
        defaultOpen?: boolean;
    }>(),
    {
        defaultOpen: true,
    },
);

const open = ref(props.defaultOpen);
</script>

<template>
    <section
        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
    >
        <button
            type="button"
            class="flex w-full items-start gap-3 border-b border-gray-100 bg-white px-4 py-3 text-left transition hover:bg-emerald-50/40 dark:border-border dark:bg-card dark:hover:bg-emerald-950/20"
            :class="{ 'border-b-0': !open }"
            @click="open = !open"
        >
            <ChevronRight
                :size="18"
                class="mt-0.5 shrink-0 text-emerald-600 transition-transform dark:text-emerald-300"
                :class="{ 'rotate-90': open }"
            />
            <span class="min-w-0">
                <span
                    class="block text-sm font-semibold text-gray-950 dark:text-white"
                >
                    {{ title }}
                </span>
                <span
                    v-if="subtitle"
                    class="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400"
                >
                    {{ subtitle }}
                </span>
            </span>
            <span
                v-if="count !== undefined"
                class="ml-auto rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
                {{ count }}
            </span>
        </button>
        <div v-show="open">
            <slot />
        </div>
    </section>
</template>
