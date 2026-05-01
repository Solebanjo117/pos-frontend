<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<{
        title?: string;
        description?: string;
        constrained?: boolean;
        class?: HTMLAttributes['class'];
        contentClass?: HTMLAttributes['class'];
    }>(),
    {
        constrained: false,
    },
);
</script>

<template>
    <div :class="cn('flex flex-1 flex-col p-4 md:p-6', props.class)">
        <div
            :class="
                cn(
                    'flex w-full flex-1 flex-col gap-6',
                    props.constrained && 'mx-auto max-w-7xl',
                    props.contentClass,
                )
            "
        >
            <header
                v-if="title || description || $slots.actions || $slots.header"
                class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
                <slot name="header">
                    <div class="min-w-0 space-y-1">
                        <h1
                            v-if="title"
                            class="text-2xl font-semibold text-foreground"
                        >
                            {{ title }}
                        </h1>
                        <p
                            v-if="description"
                            class="max-w-3xl text-sm text-muted-foreground"
                        >
                            {{ description }}
                        </p>
                    </div>
                </slot>

                <div
                    v-if="$slots.actions"
                    class="flex shrink-0 flex-wrap items-center gap-2"
                >
                    <slot name="actions" />
                </div>
            </header>

            <slot />
        </div>
    </div>
</template>
