<script setup lang="ts">
import type { TopCashier } from '@/types/dashboard'
import { UserIcon } from 'lucide-vue-next'

interface Props {
    cashiers: TopCashier[]
}
defineProps<Props>()
</script>

<template>
    <div class="space-y-4">
        <template v-if="cashiers && cashiers.length > 0">
            <div v-for="(cashier, index) in cashiers" :key="index" class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                        <UserIcon class="h-5 w-5" />
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ cashier.name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ cashier.orders }} órdenes</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-gray-900 dark:text-white">${{ cashier.revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}</p>
                    <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Top #{{ index + 1 }}</p>
                </div>
            </div>
        </template>
        <div v-else class="text-sm text-center text-gray-500 dark:text-gray-400 py-4">
            No hay ventas registradas en este periodo.
        </div>
    </div>
</template>
