<script setup lang="ts">
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    type ChartOptions,
} from 'chart.js';
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';

ChartJS.register(
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
);

interface ProductStock {
    name: string;
    current_stock: number;
    stock_value: number;
}

interface Props {
    products: ProductStock[];
    limit?: number;
}

const props = withDefaults(defineProps<Props>(), {
    limit: 10,
});

const topProducts = computed(() => {
    return [...props.products]
        .sort((a, b) => b.current_stock - a.current_stock)
        .slice(0, props.limit);
});

const chartData = computed(() => ({
    labels: topProducts.value.map((p) =>
        p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
    ),
    datasets: [
        {
            label: 'Stock Disponible',
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 2,
            data: topProducts.value.map((p) => p.current_stock),
        },
    ],
}));

const chartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false,
        },
        title: {
            display: true,
            text: `Top ${props.limit} Productos con Mayor Stock`,
            font: {
                size: 16,
                weight: 'bold',
            },
            color: '#374151',
        },
        tooltip: {
            callbacks: {
                afterLabel: (context) => {
                    const product = topProducts.value[context.dataIndex];
                    return `Valor: ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(product.stock_value)}`;
                },
            },
        },
    },
    scales: {
        x: {
            beginAtZero: true,
            ticks: {
                precision: 0,
            },
        },
    },
};
</script>

<template>
    <div class="h-full w-full">
        <Bar :data="chartData" :options="chartOptions" />
    </div>
</template>
