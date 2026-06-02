<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    rows: Array<{ label: string; amount: number; detail?: string }>;
    currencyFormatter: (value: number) => string;
}>();

const total = computed(() =>
    props.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
);
</script>

<template>
    <div
        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
        <div class="mb-3 flex items-center justify-between gap-3">
            <h3
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
                Desglose por metodo
            </h3>
            <span
                class="text-xs text-slate-500 tabular-nums dark:text-slate-400"
            >
                {{ currencyFormatter(total) }}
            </span>
        </div>

        <div class="space-y-3">
            <div v-for="row in rows" :key="row.label" class="space-y-1.5">
                <div class="flex items-center justify-between gap-3 text-xs">
                    <span
                        class="font-medium text-slate-600 dark:text-slate-300"
                    >
                        {{ row.label }}
                    </span>
                    <span
                        class="text-slate-500 tabular-nums dark:text-slate-400"
                    >
                        {{ currencyFormatter(row.amount) }}
                    </span>
                </div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                        class="h-2 rounded-full bg-indigo-500"
                        :style="{
                            width: `${total > 0 ? Math.max((row.amount / total) * 100, 6) : 0}%`,
                        }"
                    />
                </div>
                <p
                    v-if="row.detail"
                    class="text-[11px] text-slate-500 dark:text-slate-400"
                >
                    {{ row.detail }}
                </p>
            </div>
        </div>
    </div>
</template>
