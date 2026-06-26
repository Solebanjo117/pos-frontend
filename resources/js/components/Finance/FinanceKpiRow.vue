<script setup lang="ts">
defineProps<{
    kpis: Array<{ key: string; label: string; value: number }>;
    currencyFormatter: (value: number) => string;
}>();
</script>

<template>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        <div
            v-for="kpi in kpis"
            :key="kpi.key"
            class="rounded-md border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950"
        >
            <p
                class="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
            >
                {{ kpi.label }}
            </p>
            <p
                class="mt-0.5 text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100"
            >
                {{ currencyFormatter(kpi.value) }}
            </p>
        </div>
    </div>
</template>
