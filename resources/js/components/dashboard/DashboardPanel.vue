<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const props = defineProps<{
    title: string;
    description?: string;
    class?: HTMLAttributes['class'];
    contentClass?: HTMLAttributes['class'];
}>();
</script>

<template>
    <Card :class="cn('min-w-0 rounded-lg py-0', props.class)">
        <CardHeader class="gap-1 p-4 pb-2">
            <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0">
                    <CardTitle class="text-base font-semibold">
                        {{ title }}
                    </CardTitle>
                    <p
                        v-if="description"
                        class="mt-1 text-sm text-muted-foreground"
                    >
                        {{ description }}
                    </p>
                </div>

                <slot name="action" />
            </div>
        </CardHeader>

        <CardContent :class="cn('p-4 pt-2', props.contentClass)">
            <slot />
        </CardContent>
    </Card>
</template>
