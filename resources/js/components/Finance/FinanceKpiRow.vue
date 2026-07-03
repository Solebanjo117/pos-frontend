<script setup lang="ts">
defineProps<{
    kpis: Array<{
        key: string;
        label: string;
        value: number;
        metric?: string;
        detail?: string;
    }>;
    currencyFormatter: (value: number) => string;
}>();

const emit = defineEmits<{
    select: [
        kpi: { key: string; label: string; value: number; metric?: string },
    ];
}>();
</script>

<template>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        <button
            v-for="kpi in kpis"
            :key="kpi.key"
            class="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
            type="button"
            @click="emit('select', kpi)"
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
            <p
                v-if="kpi.detail"
                class="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500"
            >
                {{ kpi.detail }}
            </p>
        </button>
    </div>
</template>
