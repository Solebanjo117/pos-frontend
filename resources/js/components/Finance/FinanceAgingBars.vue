<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    buckets?: Record<string, { label: string; amount: number; count: number }>;
    currencyFormatter: (value: number) => string;
}>();

const rows = computed(() => {
    const source = props.buckets ?? {};
    const order = ['current', '1_30', '31_60', '61_90', '90_plus'];
    const labels: Record<string, string> = {
        current: 'Corriente',
        '1_30': '1-30 dias',
        '31_60': '31-60 dias',
        '61_90': '61-90 dias',
        '90_plus': '+90 dias',
    };
    const colors: Record<string, string> = {
        current: 'bg-emerald-500',
        '1_30': 'bg-amber-400',
        '31_60': 'bg-orange-500',
        '61_90': 'bg-rose-500',
        '90_plus': 'bg-red-600',
    };
    const total = order.reduce(
        (sum, key) => sum + Number(source[key]?.amount ?? 0),
        0,
    );

    return order.map((key) => {
        const amount = Number(source[key]?.amount ?? 0);
        return {
            key,
            label: source[key]?.label ?? labels[key],
            amount,
            count: Number(source[key]?.count ?? 0),
            pct: total > 0 ? (amount / total) * 100 : 0,
            color: colors[key],
        };
    });
});
</script>

<template>
    <div
        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
        <div class="mb-3 flex items-center justify-between gap-3">
            <h3
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
                Antiguedad de saldos
            </h3>
            <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ rows.reduce((sum, row) => sum + row.count, 0) }} documentos
            </span>
        </div>

        <div class="space-y-3">
            <div v-for="row in rows" :key="row.key" class="space-y-1.5">
                <div class="flex items-center justify-between gap-3 text-xs">
                    <span
                        class="font-medium text-slate-600 dark:text-slate-300"
                    >
                        {{ row.label }}
                    </span>
                    <span
                        class="text-slate-500 tabular-nums dark:text-slate-400"
                    >
                        {{ currencyFormatter(row.amount) }} ·
                        {{ row.count }}
                    </span>
                </div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                        class="h-2 rounded-full"
                        :class="row.color"
                        :style="{
                            width: `${Math.max(row.pct, row.amount > 0 ? 6 : 0)}%`,
                        }"
                    />
                </div>
            </div>
        </div>
    </div>
</template>
