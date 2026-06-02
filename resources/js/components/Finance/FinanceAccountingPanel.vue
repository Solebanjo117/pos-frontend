<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';

const props = withDefaults(
    defineProps<{
        title: string;
        total: number;
        rows: Array<{
            key: string;
            label: string;
            amount: number;
            detail?: string | null;
            type?: string;
        }>;
        icon?: Component;
        tone?: 'asset' | 'liability' | 'profit' | 'expense' | 'neutral';
        currencyFormatter: (value: number) => string;
    }>(),
    {
        tone: 'neutral',
    },
);

const toneClass = computed(() => {
    return {
        asset: 'text-sky-600 dark:text-sky-300',
        liability: 'text-amber-600 dark:text-amber-300',
        profit: 'text-emerald-600 dark:text-emerald-300',
        expense: 'text-rose-600 dark:text-rose-300',
        neutral: 'text-slate-700 dark:text-slate-300',
    }[props.tone];
});
</script>

<template>
    <section
        class="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
        <header
            class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
        >
            <div class="flex min-w-0 items-center gap-2">
                <component
                    :is="icon"
                    v-if="icon"
                    :size="17"
                    :class="toneClass"
                />
                <h3
                    class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                    {{ title }}
                </h3>
            </div>
            <strong class="shrink-0 text-sm tabular-nums" :class="toneClass">
                {{ currencyFormatter(total) }}
            </strong>
        </header>

        <div class="divide-y divide-slate-100 dark:divide-slate-800">
            <div
                v-for="row in rows"
                :key="row.key"
                class="flex items-start justify-between gap-4 px-4 py-3"
            >
                <div class="min-w-0">
                    <p
                        class="text-sm font-medium text-slate-800 dark:text-slate-200"
                    >
                        {{ row.label }}
                    </p>
                    <p
                        v-if="row.detail"
                        class="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                    >
                        {{ row.detail }}
                    </p>
                </div>
                <span
                    class="shrink-0 text-sm font-semibold tabular-nums"
                    :class="
                        row.amount < 0
                            ? 'text-rose-600 dark:text-rose-300'
                            : 'text-slate-900 dark:text-slate-100'
                    "
                >
                    {{ currencyFormatter(row.amount) }}
                </span>
            </div>
            <div
                v-if="rows.length === 0"
                class="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
            >
                Sin datos para este periodo.
            </div>
        </div>
    </section>
</template>
