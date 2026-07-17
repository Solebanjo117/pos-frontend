<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
    label: string;
    value: string | number;
    description?: string;
    icon?: Component;
}>();
</script>

<template>
    <article class="rounded-lg border bg-card p-4">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p class="text-xs font-medium text-muted-foreground">
                    {{ label }}
                </p>
                <p
                    class="mt-1 text-xl font-semibold text-foreground tabular-nums"
                >
                    {{ value }}
                </p>
                <p
                    v-if="description"
                    class="mt-1 text-xs text-muted-foreground"
                >
                    {{ description }}
                </p>
            </div>
            <span
                v-if="icon"
                class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground"
                aria-hidden="true"
            >
                <component :is="icon" class="size-4" />
            </span>
        </div>
    </article>
</template>
