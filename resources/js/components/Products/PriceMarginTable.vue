<script setup lang="ts">
/**
 * Markup y margen de los precios de venta de una marca, como el recuadro "Pricing" de
 * Lightspeed. Solo muestra: el precio se sigue escribiendo en "Precio de Venta".
 */
import { computed } from 'vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import { useMarginCostSource } from '@/composables/useMarginCostSource';
import {
    MARGIN_COST_SOURCES,
    formatPercent,
    marginPercent,
    markupPercent,
    resolveMarginCost,
} from '@/utils/priceMargins';
import type { MarginCostInput } from '@/utils/priceMargins';

const props = defineProps<{
    /** Precio de venta sin ITBM. */
    price: number;
    costInput: MarginCostInput;
}>();

const { marginCostSource } = useMarginCostSource();

const resolved = computed(() =>
    resolveMarginCost(marginCostSource.value, props.costInput),
);

// Hoy HermeX tiene un solo precio de venta por marca; la tabla admite más filas.
const rows = computed(() => {
    const price = Number(props.price) || 0;
    const cost = resolved.value.cost;
    return [
        {
            key: 'sale',
            name: 'Precio de venta',
            price,
            markup: markupPercent(price, cost),
            margin: marginPercent(price, cost),
        },
    ];
});

const percentClass = (value: number | null) =>
    value !== null && value < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-900 dark:text-white';
</script>

<template>
    <div data-test="price-margin-table">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span
                class="text-xs font-semibold tracking-wider text-gray-500 uppercase"
                >Markup y margen</span
            >
            <label class="flex items-center gap-2 text-xs text-gray-500">
                Costo
                <AppSelect
                    v-model="marginCostSource"
                    data-test="margin-cost-source"
                    class="w-48 min-w-0"
                    :options="MARGIN_COST_SOURCES"
                />
            </label>
        </div>
        <table
            class="w-full overflow-hidden rounded-md border border-gray-200 text-sm dark:border-border"
        >
            <thead
                class="bg-gray-100 text-[11px] text-gray-500 uppercase dark:bg-muted dark:text-gray-400"
            >
                <tr>
                    <th class="px-3 py-1.5 text-left font-medium">Nombre</th>
                    <th class="px-3 py-1.5 text-right font-medium">Precio</th>
                    <th class="px-3 py-1.5 text-right font-medium">Markup</th>
                    <th class="px-3 py-1.5 text-right font-medium">Margen</th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="row in rows"
                    :key="row.key"
                    class="border-t border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <td
                        class="px-3 py-2 font-medium text-gray-900 dark:text-white"
                    >
                        {{ row.name }}
                    </td>
                    <td
                        class="px-3 py-2 text-right text-gray-900 tabular-nums dark:text-white"
                    >
                        ${{ row.price.toFixed(2) }}
                    </td>
                    <td
                        data-test="margin-markup"
                        class="px-3 py-2 text-right tabular-nums"
                        :class="percentClass(row.markup)"
                    >
                        {{ formatPercent(row.markup) }}
                    </td>
                    <td
                        data-test="margin-margin"
                        class="px-3 py-2 text-right tabular-nums"
                        :class="percentClass(row.margin)"
                    >
                        {{ formatPercent(row.margin) }}
                    </td>
                </tr>
            </tbody>
        </table>
        <p
            data-test="margin-cost-detail"
            class="mt-1 text-xs"
            :class="
                resolved.fallback
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
            "
        >
            {{ resolved.detail }} Precio sin ITBM.
        </p>
    </div>
</template>
