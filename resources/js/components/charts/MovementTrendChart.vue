<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    type ChartOptions,
} from 'chart.js';

ChartJS.register(
    Title,
    Tooltip,
    Legend,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
);

interface TimelineData {
    date: string;
    inbound: number;
    outbound: number;
    net: number;
}

interface Props {
    data: TimelineData[];
}

const props = defineProps<Props>();

const chartData = computed(() => ({
    labels: props.data.map((d) => d.date),
    datasets: [
        {
            label: 'Entradas',
            data: props.data.map((d) => d.inbound),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
        },
        {
            label: 'Salidas',
            data: props.data.map((d) => d.outbound),
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true,
        },
        {
            label: 'Neto',
            data: props.data.map((d) => d.net),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true,
            borderDash: [5, 5],
        },
    ],
}));

const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
            labels: {
                usePointStyle: true,
                padding: 20,
            },
        },
        title: {
            display: true,
            text: 'Tendencia de Movimientos',
            font: {
                size: 16,
                weight: 'bold',
            },
            color: '#374151',
        },
        tooltip: {
            mode: 'index',
            intersect: false,
        },
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                precision: 0,
            },
        },
    },
    interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
    },
};
</script>

<template>
    <div class="h-full w-full">
        <Line :data="chartData" :options="chartOptions" />
    </div>
</template>
