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
    <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-4 text-sm">
        <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
            Resumen de la Sesión Actual
        </h2>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 mb-2">
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
                <span class="text-lg font-bold text-green-600">
                    + {{ formatCurrency(summary?.cash_sales ?? 0) }}
                </span>
            </div>

            <!-- Ingresos Extra -->
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Ingresos Extra</span>
                <span class="text-lg font-bold text-green-600">
                    + {{ formatCurrency(summary?.cash_movements_in ?? 0) }}
                </span>
            </div>

            <!-- Retiros -->
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Retiros / Salidas</span>
                <span class="text-lg font-bold text-red-500">
                    - {{ formatCurrency(summary?.cash_movements_out ?? 0) }}
                </span>
            </div>
            
            <!-- Efectivo Esperado -->
            <div class="flex flex-col col-span-2 md:col-span-1 pt-2 md:pt-0 md:border-t-0 border-t border-gray-100">
                <span class="text-xs leading-tight text-gray-500 mb-1">Efectivo Físico Esperado<br/><span class="text-[10px] text-gray-400 font-normal">(Base + Ventas + Ingresos - Retiros)</span></span>
                <span class="text-xl font-bold text-blue-600 dark:text-primary">
                    {{ formatCurrency(summary?.expected_cash ?? 0) }}
                </span>
            </div>
            
            <!-- Diferencia Faltante/Sobrante -->
            <div class="flex flex-col col-span-2 md:col-span-1 pt-2 md:pt-0 md:border-t-0 border-t border-gray-100">
                <span class="text-xs text-gray-500 mb-1">Diferencia (Ingresado - Esperado)</span>
                <span
                    class="text-xl font-bold"
                    :class="{
                        'text-green-600': Math.abs(totalCounted - (summary?.expected_cash ?? 0)) < 0.01,
                        'text-red-600': Math.abs(totalCounted - (summary?.expected_cash ?? 0)) >= 0.01,
                    }"
                >
                    {{ formatCurrency(totalCounted - (summary?.expected_cash ?? 0)) }}
                </span>
            </div>
        </div>

        <!-- Métrica Externa (No afecta el cuadre en efectivo) -->
        <div class="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/50 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
             <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">Ventas Electrónicas</span>
                <span class="text-base font-bold text-gray-700">
                    {{ formatCurrency(summary?.electronic_sales ?? 0) }}
                </span>
            </div>
             <div class="flex flex-col">
                <span class="text-xs font-semibold text-gray-500 mb-1">Descuentos Otorgados</span>
                <span class="text-base font-bold text-orange-500">
                    - {{ formatCurrency(summary?.total_discounts ?? 0) }}
                </span>
            </div>
        </div>
    </div>
</template>
