<script setup lang="ts">
import { computed } from 'vue'

interface CashRowConfig {
    id: string
    label: string
    unitValue: number
    packValue: number
    packLabel: string
    isCoin?: boolean
}

const CASH_ROWS: CashRowConfig[] = [
    // Billetes
    { id: '100', label: '$100', unitValue: 100, packValue: 10000, packLabel: 'Fajo' },
    { id: '50', label: '$50', unitValue: 50, packValue: 5000, packLabel: 'Fajo' },
    { id: '20', label: '$20', unitValue: 20, packValue: 2000, packLabel: 'Fajo' },
    { id: '10', label: '$10', unitValue: 10, packValue: 1000, packLabel: 'Fajo' },
    { id: '5', label: '$5', unitValue: 5, packValue: 500, packLabel: 'Fajo' },
    { id: '1', label: '$1', unitValue: 1, packValue: 100, packLabel: 'Fajo' },
    // Monedas
    { id: '1.00', label: '$1.00', unitValue: 1.00, packValue: 25.00, packLabel: 'Rollo', isCoin: true },
    { id: '0.50', label: '$0.50', unitValue: 0.50, packValue: 10.00, packLabel: 'Rollo', isCoin: true },
    { id: '0.25', label: '$0.25', unitValue: 0.25, packValue: 10.00, packLabel: 'Rollo', isCoin: true },
    { id: '0.10', label: '$0.10', unitValue: 0.10, packValue: 5.00, packLabel: 'Rollo', isCoin: true },
    { id: '0.05', label: '$0.05', unitValue: 0.05, packValue: 2.00, packLabel: 'Rollo', isCoin: true },
    { id: '0.01', label: '$0.01', unitValue: 0.01, packValue: 0.50, packLabel: 'Rollo', isCoin: true },
]

const props = defineProps<{
    counts: Record<string, number>
}>()

const emit = defineEmits<{
    (e: 'countChange', id: string, value: number): void
}>()

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}

const rowTotal = (row: CashRowConfig) => {
    const unitKey = `unit_${row.id}`
    const packKey = `pack_${row.id}`
    return ((props.counts[unitKey] || 0) * row.unitValue) + ((props.counts[packKey] || 0) * row.packValue)
}

const total = computed(() => CASH_ROWS.reduce((acc, row) => acc + rowTotal(row), 0))

const handleChange = (id: string, rawValue: string) => {
    const val = parseFloat(rawValue)
    emit('countChange', id, isNaN(val) ? 0 : val)
}

// Expose for parent use
defineExpose({ CASH_ROWS, total })
</script>

<template>
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="bg-gray-50 border-b border-gray-200 px-3 py-2 flex justify-between items-center flex-none">
            <h3 class="text-xs font-bold text-gray-700 uppercase tracking-wide">Efectivo</h3>
            <span class="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                {{ formatCurrency(total) }}
            </span>
        </div>

        <div class="overflow-y-auto flex-1">
            <table class="w-full text-xs border-collapse table-fixed">
                <thead class="sticky top-0 z-10 bg-white shadow-sm ring-1 ring-gray-100">
                    <tr class="text-gray-500 text-[10px] uppercase tracking-wider">
                        <th class="text-left py-2 pl-3 font-semibold w-20">Denom.</th>
                        <th class="text-center py-2 font-semibold w-16">x1</th>
                        <th class="text-center py-2 font-semibold w-16">xPack</th>
                        <th class="text-right py-2 pr-3 font-semibold">Total</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr
                        v-for="row in CASH_ROWS"
                        :key="row.id"
                        class="hover:bg-blue-50/30 transition-colors group"
                    >
                        <td class="py-1 pl-3 text-gray-700 font-bold font-mono text-[11px]">
                            {{ row.label }}
                        </td>

                        <!-- Unit input -->
                        <td class="py-1 px-1 text-center">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                :value="(counts[`unit_${row.id}`] || 0) === 0 ? '' : counts[`unit_${row.id}`]"
                                @input="handleChange(`unit_${row.id}`, ($event.target as HTMLInputElement).value)"
                                class="w-full text-center border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                                :class="{
                                    'border-blue-300 bg-blue-50 text-blue-900 font-bold': (counts[`unit_${row.id}`] || 0) > 0,
                                    'border-gray-200 text-gray-400': (counts[`unit_${row.id}`] || 0) === 0,
                                }"
                                placeholder="-"
                            />
                        </td>

                        <!-- Pack input -->
                        <td class="py-1 px-1 text-center">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                :value="(counts[`pack_${row.id}`] || 0) === 0 ? '' : counts[`pack_${row.id}`]"
                                @input="handleChange(`pack_${row.id}`, ($event.target as HTMLInputElement).value)"
                                class="w-full text-center border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                                :class="{
                                    'border-indigo-300 bg-indigo-50 text-indigo-900 font-bold': (counts[`pack_${row.id}`] || 0) > 0,
                                    'border-gray-200 text-gray-400': (counts[`pack_${row.id}`] || 0) === 0,
                                }"
                                :placeholder="row.packLabel === 'Rollo' ? 'R' : 'F'"
                            />
                        </td>

                        <!-- Row total -->
                        <td
                            class="py-1 pr-3 text-right font-mono font-medium transition-colors text-[11px]"
                            :class="{
                                'text-gray-300': rowTotal(row) === 0,
                                'text-gray-900 font-bold': rowTotal(row) > 0,
                            }"
                        >
                            {{ formatCurrency(rowTotal(row)) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
