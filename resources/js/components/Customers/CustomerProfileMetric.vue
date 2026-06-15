<script setup lang="ts">
import type { Component } from 'vue';

withDefaults(
    defineProps<{
        label: string;
        value: string;
        detail?: string;
        icon: Component;
        accent?: 'emerald' | 'indigo' | 'amber' | 'sky' | 'violet';
    }>(),
    {
        detail: '',
        accent: 'indigo',
    },
);

const accentClasses = {
    emerald:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
    violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200',
};
</script>

<template>
    <article
        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p
                    class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                    {{ label }}
                </p>
                <p
                    class="mt-2 truncate text-xl font-bold text-slate-950 tabular-nums dark:text-slate-50"
                >
                    {{ value }}
                </p>
                <p
                    v-if="detail"
                    class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
                >
                    {{ detail }}
                </p>
            </div>
            <div
                class="flex size-9 shrink-0 items-center justify-center rounded-md border"
                :class="accentClasses[accent]"
            >
                <component :is="icon" :size="17" />
            </div>
        </div>
    </article>
</template>
