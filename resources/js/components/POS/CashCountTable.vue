<script setup lang="ts">
import { computed } from 'vue';

interface CashRowConfig {
    id: string;
    label: string;
    unitValue: number;
    packValue: number;
    packLabel: string;
    isCoin?: boolean;
}

const CASH_ROWS: CashRowConfig[] = [
    // Billetes
    {
        id: '100',
        label: '$100',
        unitValue: 100,
        packValue: 10000,
        packLabel: 'Fajo',
    },
    {
        id: '50',
        label: '$50',
        unitValue: 50,
        packValue: 5000,
        packLabel: 'Fajo',
    },
    {
        id: '20',
        label: '$20',
        unitValue: 20,
        packValue: 2000,
        packLabel: 'Fajo',
    },
    {
        id: '10',
        label: '$10',
        unitValue: 10,
        packValue: 1000,
        packLabel: 'Fajo',
    },
    { id: '5', label: '$5', unitValue: 5, packValue: 500, packLabel: 'Fajo' },
    { id: '1', label: '$1', unitValue: 1, packValue: 100, packLabel: 'Fajo' },
    // Monedas
    {
        id: '1.00',
        label: '$1.00',
        unitValue: 1.0,
        packValue: 25.0,
        packLabel: 'Rollo',
        isCoin: true,
    },
    {
        id: '0.50',
        label: '$0.50',
        unitValue: 0.5,
        packValue: 10.0,
        packLabel: 'Rollo',
        isCoin: true,
    },
    {
        id: '0.25',
        label: '$0.25',
        unitValue: 0.25,
        packValue: 10.0,
        packLabel: 'Rollo',
        isCoin: true,
    },
    {
        id: '0.10',
        label: '$0.10',
        unitValue: 0.1,
        packValue: 5.0,
        packLabel: 'Rollo',
        isCoin: true,
    },
    {
        id: '0.05',
        label: '$0.05',
        unitValue: 0.05,
        packValue: 2.0,
        packLabel: 'Rollo',
        isCoin: true,
    },
    {
        id: '0.01',
        label: '$0.01',
        unitValue: 0.01,
        packValue: 0.5,
        packLabel: 'Rollo',
        isCoin: true,
    },
];

const props = defineProps<{
    counts: Record<string, number>;
}>();

const emit = defineEmits<{
    (e: 'countChange', id: string, value: number): void;
}>();

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value || 0);
};

const rowTotal = (row: CashRowConfig) => {
    const unitKey = `unit_${row.id}`;
    const packKey = `pack_${row.id}`;
    return (
        (props.counts[unitKey] || 0) * row.unitValue +
        (props.counts[packKey] || 0) * row.packValue
    );
};

const total = computed(() =>
    CASH_ROWS.reduce((acc, row) => acc + rowTotal(row), 0),
);

const handleChange = (id: string, rawValue: string) => {
    const val = parseFloat(rawValue);
    emit('countChange', id, isNaN(val) ? 0 : val);
};

// Expose for parent use
defineExpose({ CASH_ROWS, total });
</script>

<template>
    <div
        class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
    >
        <!-- Header -->
        <div
            class="flex flex-none items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2"
        >
            <h3 class="text-xs font-bold tracking-wide text-gray-700 uppercase">
                Efectivo
            </h3>
            <span
                class="rounded border border-green-100 bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700"
            >
                {{ formatCurrency(total) }}
            </span>
        </div>

        <div class="flex-1 overflow-y-auto">
            <table class="w-full table-fixed border-collapse text-xs">
                <thead
                    class="sticky top-0 z-10 bg-white shadow-sm ring-1 ring-gray-100"
                >
                    <tr
                        class="text-[10px] tracking-wider text-gray-500 uppercase"
                    >
                        <th class="w-20 py-2 pl-3 text-left font-semibold">
                            Denom.
                        </th>
                        <th class="w-16 py-2 text-center font-semibold">x1</th>
                        <th class="w-16 py-2 text-center font-semibold">
                            xPack
                        </th>
                        <th class="py-2 pr-3 text-right font-semibold">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr
                        v-for="row in CASH_ROWS"
                        :key="row.id"
                        class="group transition-colors hover:bg-blue-50/30"
                    >
                        <td
                            class="py-1 pl-3 font-mono text-[11px] font-bold text-gray-700"
                        >
                            {{ row.label }}
                        </td>

                        <!-- Unit input -->
                        <td class="px-1 py-1 text-center">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                :value="
                                    (counts[`unit_${row.id}`] || 0) === 0
                                        ? ''
                                        : counts[`unit_${row.id}`]
                                "
                                @input="
                                    handleChange(
                                        `unit_${row.id}`,
                                        ($event.target as HTMLInputElement)
                                            .value,
                                    )
                                "
                                class="w-full rounded border px-1 py-0.5 text-center font-mono text-xs transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                :class="{
                                    'border-blue-300 bg-blue-50 font-bold text-blue-900':
                                        (counts[`unit_${row.id}`] || 0) > 0,
                                    'border-gray-200 text-gray-400':
                                        (counts[`unit_${row.id}`] || 0) === 0,
                                }"
                                placeholder="-"
                            />
                        </td>

                        <!-- Pack input -->
                        <td class="px-1 py-1 text-center">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                :value="
                                    (counts[`pack_${row.id}`] || 0) === 0
                                        ? ''
                                        : counts[`pack_${row.id}`]
                                "
                                @input="
                                    handleChange(
                                        `pack_${row.id}`,
                                        ($event.target as HTMLInputElement)
                                            .value,
                                    )
                                "
                                class="w-full rounded border px-1 py-0.5 text-center font-mono text-xs transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                :class="{
                                    'border-indigo-300 bg-indigo-50 font-bold text-indigo-900':
                                        (counts[`pack_${row.id}`] || 0) > 0,
                                    'border-gray-200 text-gray-400':
                                        (counts[`pack_${row.id}`] || 0) === 0,
                                }"
                                :placeholder="
                                    row.packLabel === 'Rollo' ? 'R' : 'F'
                                "
                            />
                        </td>

                        <!-- Row total -->
                        <td
                            class="py-1 pr-3 text-right font-mono text-[11px] font-medium transition-colors"
                            :class="{
                                'text-gray-300': rowTotal(row) === 0,
                                'font-bold text-gray-900': rowTotal(row) > 0,
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
