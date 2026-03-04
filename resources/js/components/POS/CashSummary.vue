<script setup lang="ts">
import type { PosSessionSummary } from '../../types/pos-session'

defineProps<{
    summary: PosSessionSummary | null
    totalCounted: number
    totalElectronic: number
}>()

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}
</script>

<template>
    <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Resumen de Sesión
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <!-- Fondo Inicial -->
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Fondo Inicial</span>
                <span class="text-lg font-bold text-gray-900">
                    {{ formatCurrency(summary?.opening_amount ?? 0) }}
                </span>
            </div>

            <!-- Ventas en Efectivo -->
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Ventas en Efectivo</span>
                <span class="text-lg font-bold text-gray-900">
                    {{ formatCurrency(summary?.cash_sales ?? 0) }}
                </span>
            </div>

            <!-- Pagos Electrónicos -->
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Pagos Electrónicos</span>
                <span class="text-lg font-bold text-gray-900">
                    {{ formatCurrency(summary?.electronic_sales ?? 0) }}
                </span>
            </div>

            <!-- Efectivo Esperado -->
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Efectivo Esperado</span>
                <span class="text-lg font-bold text-blue-600">
                    {{ formatCurrency(summary?.expected_cash ?? 0) }}
                </span>
            </div>

            <!-- Diferencia de Efectivo -->
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Diferencia</span>
                <span
                    class="text-lg font-bold"
                    :class="{
                        'text-green-600': Math.abs(totalCounted - (summary?.expected_cash ?? 0)) < 0.01,
                        'text-red-600': Math.abs(totalCounted - (summary?.expected_cash ?? 0)) >= 0.01,
                    }"
                >
                    {{ formatCurrency(totalCounted - (summary?.expected_cash ?? 0)) }}
                </span>
            </div>
        </div>
    </div>
</template>
