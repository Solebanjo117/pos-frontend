<script setup lang="ts">
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    type ChartOptions,
} from 'chart.js';
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import type { CategorySales } from '@/types/dashboard';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
    data: CategorySales[];
}

const props = defineProps<Props>();

const chartData = computed(() => {
    // Top 5 categories + Others
    const sortedData = [...props.data].sort((a, b) => b.revenue - a.revenue);
    const top5 = sortedData.slice(0, 5);
    const others = sortedData
        .slice(5)
        .reduce((acc, curr) => acc + curr.revenue, 0);

    const labels = top5.map((item) => item.category);
    const revenues = top5.map((item) => item.revenue);

    if (others > 0) {
        labels.push('Otras Categorías');
        revenues.push(others);
    }

    return {
        labels: labels,
        datasets: [
            {
                data: revenues,
                backgroundColor: [
                    '#3b82f6', // blue-500
                    '#10b981', // emerald-500
                    '#f59e0b', // amber-500
                    '#ef4444', // red-500
                    '#8b5cf6', // violet-500
                    '#64748b', // slate-500 (Otras)
                ],
                hoverOffset: 4,
            },
        ],
    };
});

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'right' as const,
            labels: {
                generateLabels: (chart) => {
                    const data = chart.data;
                    if (data.labels && data.datasets.length) {
                        return data.labels.map((label, i) => {
                            const meta = chart.getDatasetMeta(0);
                            const style = meta.controller.getStyle(i, false);

                            // Get metric value
                            const value = data.datasets[0].data[i] as number;
                            const formattedValue = new Intl.NumberFormat(
                                'es-MX',
                                {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 0,
                                },
                            ).format(value);

                            return {
                                text: `${label} (${formattedValue})`,
                                fillStyle: style.backgroundColor,
                                strokeStyle: style.borderColor,
                                lineWidth: style.borderWidth,
                                hidden:
                                    isNaN(value) ||
                                    (meta.data[i] as any).hidden,
                                index: i,
                            } as any;
                        });
                    }
                    return [];
                },
                boxWidth: 12,
                font: {
                    size: 11,
                },
            },
        },
        tooltip: {
            callbacks: {
                label: function (context: any) {
                    let label = context.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed !== null) {
                        label += new Intl.NumberFormat('es-MX', {
                            style: 'currency',
                            currency: 'USD',
                        }).format(context.parsed);
                    }
                    return label;
                },
            },
        },
    },
    cutout: '70%',
}));
</script>

<template>
    <div class="relative flex h-full w-full items-center justify-center p-2">
        <Doughnut
            v-if="props.data && props.data.length > 0"
            :data="chartData"
            :options="chartOptions"
        />
        <div
            v-else
            class="text-center text-sm text-gray-500 dark:text-gray-400"
        >
            No hay datos de ventas por categoría en este periodo.
        </div>
    </div>
</template>
