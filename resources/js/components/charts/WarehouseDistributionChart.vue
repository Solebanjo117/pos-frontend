<script setup lang="ts">
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    type ChartOptions,
} from 'chart.js';
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';

ChartJS.register(Title, Tooltip, Legend, ArcElement);

interface WarehouseData {
    warehouse_name: string;
    total_products: number;
}

interface Props {
    data: WarehouseData[];
}

const props = defineProps<Props>();

const colors = [
    'rgba(59, 130, 246, 0.8)', // blue-500
    'rgba(34, 197, 94, 0.8)', // green-500
    'rgba(234, 179, 8, 0.8)', // yellow-500
    'rgba(239, 68, 68, 0.8)', // red-500
    'rgba(168, 85, 247, 0.8)', // purple-500
    'rgba(236, 72, 153, 0.8)', // pink-500
];

const borderColors = [
    'rgb(59, 130, 246)',
    'rgb(34, 197, 94)',
    'rgb(234, 179, 8)',
    'rgb(239, 68, 68)',
    'rgb(168, 85, 247)',
    'rgb(236, 72, 153)',
];

const chartData = computed(() => ({
    labels: props.data.map((w) => w.warehouse_name),
    datasets: [
        {
            label: 'Productos por Almacén',
            backgroundColor: colors.slice(0, props.data.length),
            borderColor: borderColors.slice(0, props.data.length),
            borderWidth: 2,
            data: props.data.map((w) => w.total_products),
        },
    ],
}));

const chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                padding: 15,
                font: {
                    size: 12,
                },
            },
        },
        title: {
            display: true,
            text: 'Distribución de Productos por Almacén',
            font: {
                size: 16,
                weight: 'bold',
            },
            color: '#374151',
        },
        tooltip: {
            callbacks: {
                label: (context) => {
                    const total = props.data.reduce(
                        (sum, w) => sum + w.total_products,
                        0,
                    );
                    const percentage =
                        total > 0
                            ? ((context.parsed / total) * 100).toFixed(1)
                            : '0';
                    return `${context.label}: ${context.parsed} (${percentage}%)`;
                },
            },
        },
    },
};
</script>

<template>
    <div class="h-full w-full">
        <Doughnut :data="chartData" :options="chartOptions" />
    </div>
</template>
