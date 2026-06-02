<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
    eyebrow?: string;
    title: string;
    subtitle?: string;
    icon?: Component;
}>();
</script>

<template>
    <section
        class="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
        <header
            class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between dark:border-slate-800"
        >
            <div class="flex items-start gap-3">
                <div
                    v-if="icon"
                    class="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                >
                    <component :is="icon" :size="20" />
                </div>
                <div class="min-w-0">
                    <p
                        v-if="eyebrow"
                        class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                    >
                        {{ eyebrow }}
                    </p>
                    <h2
                        class="mt-0.5 text-xl font-semibold tracking-normal text-slate-950 dark:text-slate-50"
                    >
                        {{ title }}
                    </h2>
                    <p
                        v-if="subtitle"
                        class="mt-1 text-sm text-slate-500 dark:text-slate-400"
                    >
                        {{ subtitle }}
                    </p>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <slot name="actions" />
            </div>
        </header>

        <div class="p-5">
            <slot />
        </div>
    </section>
</template>
