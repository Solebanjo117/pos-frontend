<script setup lang="ts">
import type { Component } from 'vue';

withDefaults(
    defineProps<{
        label: string;
        value: string;
        detail?: string;
        accent?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'sky' | 'slate';
        icon?: Component;
    }>(),
    {
        accent: 'slate',
    },
);

const accents = {
    emerald:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
    sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
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
                    class="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50"
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
                v-if="icon"
                :class="[
                    'flex size-9 shrink-0 items-center justify-center rounded-md border',
                    accents[accent],
                ]"
            >
                <component :is="icon" :size="18" />
            </div>
        </div>
    </article>
</template>
