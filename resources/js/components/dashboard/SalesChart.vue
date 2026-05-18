<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    type ChartOptions,
} from 'chart.js';
import type { SalesChartData } from '@/types/dashboard';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
);

interface Props {
    data: SalesChartData;
    period?: string;
}

const props = withDefaults(defineProps<Props>(), {
    period: '7d',
});

const chartData = computed(() => ({
    labels: props.data.labels,
    datasets: [
        {
            label: 'Ventas',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgb(59, 130, 246)',
            pointBackgroundColor: 'rgb(59, 130, 246)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(59, 130, 246)',
            data: props.data.data,
            fill: true,
            tension: 0.4,
        },
        ...(props.data.cost && props.data.cost.some((v) => v !== 0)
            ? [
                  {
                      label: 'Costo',
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      borderColor: 'rgb(239, 68, 68)',
                      pointBackgroundColor: 'rgb(239, 68, 68)',
                      pointBorderColor: '#fff',
                      pointHoverBackgroundColor: '#fff',
                      pointHoverBorderColor: 'rgb(239, 68, 68)',
                      data: props.data.cost,
                      fill: true,
                      tension: 0.4,
                      borderDash: [5, 5],
                  },
              ]
            : []),
        ...(props.data.profit && props.data.profit.some((v) => v !== 0)
            ? [
                  {
                      label: 'Utilidad',
                      backgroundColor: 'rgba(16, 185, 129, 0.05)',
                      borderColor: 'rgb(16, 185, 129)',
                      pointBackgroundColor: 'rgb(16, 185, 129)',
                      pointBorderColor: '#fff',
                      pointHoverBackgroundColor: '#fff',
                      pointHoverBorderColor: 'rgb(16, 185, 129)',
                      data: props.data.profit,
                      fill: true,
                      tension: 0.4,
                      borderDash: [5, 5],
                  },
              ]
            : []),
    ],
}));

const chartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: true,
            position: 'top' as const,
        },
        tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
                label: function (context: any) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += new Intl.NumberFormat('es-MX', {
                            style: 'currency',
                            currency: 'USD',
                        }).format(context.parsed.y);
                    }
                    return label;
                },
            },
        },
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                callback: function (value: any) {
                    return '$' + value.toLocaleString('es-MX');
                },
            },
            grid: {
                color: 'rgba(0, 0, 0, 0.05)',
            },
        },
        x: {
            grid: {
                display: false,
            },
        },
    },
    interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
    },
}));
</script>

<template>
    <div class="h-full w-full">
        <Line :data="chartData" :options="chartOptions" />
    </div>
</template>
