import { ref } from 'vue';
import { DEFAULT_MARGIN_COST_SOURCE } from '@/utils/priceMargins';
import type { MarginCostSource } from '@/utils/priceMargins';

// Uno para toda la pantalla: lo elegido en la tabla de marcas se mantiene al abrir una marca.
const source = ref<MarginCostSource>(DEFAULT_MARGIN_COST_SOURCE);

export function useMarginCostSource() {
    return { marginCostSource: source };
}
