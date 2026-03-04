<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  type ChartOptions
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

interface Props {
  critical: number
  low: number
  normal: number
  optimal: number
}

const props = defineProps<Props>()

const chartData = computed(() => ({
  labels: ['Crítico', 'Bajo', 'Normal', 'Óptimo'],
  datasets: [
    {
      label: 'Productos por Estado',
      backgroundColor: [
        'rgba(239, 68, 68, 0.8)',   // red-500
        'rgba(234, 179, 8, 0.8)',   // yellow-500
        'rgba(59, 130, 246, 0.8)',  // blue-500
        'rgba(34, 197, 94, 0.8)',   // green-500
      ],
      borderColor: [
        'rgb(239, 68, 68)',
        'rgb(234, 179, 8)',
        'rgb(59, 130, 246)',
        'rgb(34, 197, 94)',
      ],
      borderWidth: 2,
      data: [props.critical, props.low, props.normal, props.optimal],
    },
  ],
}))

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: true,
      text: 'Distribución de Productos por Estado de Stock',
      font: {
        size: 16,
        weight: 'bold',
      },
      color: '#374151', // gray-700
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const total = props.critical + props.low + props.normal + props.optimal
          const value = context.parsed.y ?? 0
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
          return `${value} productos (${percentage}%)`
        },
      },
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
}
</script>

<template>
  <div class="h-full w-full">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
