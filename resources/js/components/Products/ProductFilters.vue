<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
    X,
    Layers,
    Tag,
    DollarSign,
    Package,
    RotateCcw,
} from 'lucide-vue-next';

interface Category {
    id: number;
    name: string;
}
interface Brand {
    id: number;
    name: string;
}

export interface ProductFilterValues {
    sku?: string;
    category_ids: number[];
    brand_ids: number[];
    min_price?: number | undefined;
    max_price?: number | undefined;
    in_stock: boolean;
}

const props = withDefaults(
    defineProps<{
        modelValue: ProductFilterValues;
        categories: Category[];
        brands: Brand[];
        collapsible?: boolean;
    }>(),
    {
        collapsible: false,
    },
);

const emit = defineEmits<{
    (e: 'update:modelValue', value: ProductFilterValues): void;
    (e: 'close'): void;
}>();

// Local deep copy of filters (use JSON for safe deep-clone, unwrapping Vue proxies)
const local = ref<ProductFilterValues>(
    JSON.parse(JSON.stringify(props.modelValue)),
);

// Sync from parent when the full modelValue changes identity
watch(
    () => props.modelValue,
    (v) => {
        local.value = JSON.parse(JSON.stringify(v));
    },
    { deep: true },
);

// Debounce timer for text/number inputs
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const emitDebounced = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        emit('update:modelValue', { ...local.value });
    }, 400);
};

const emitImmediate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    emit('update:modelValue', { ...local.value });
};

// Category multi-select
const toggleCategory = (id: number) => {
    const idx = local.value.category_ids.indexOf(id);
    if (idx >= 0) {
        local.value.category_ids.splice(idx, 1);
    } else {
        local.value.category_ids.push(id);
    }
    emitImmediate();
};

// Brand multi-select
const toggleBrand = (id: number) => {
    const idx = local.value.brand_ids.indexOf(id);
    if (idx >= 0) {
        local.value.brand_ids.splice(idx, 1);
    } else {
        local.value.brand_ids.push(id);
    }
    emitImmediate();
};

const activeFilterCount = computed(() => {
    let count = 0;
    if (local.value.category_ids.length > 0) count++;
    if (local.value.brand_ids.length > 0) count++;
    if (local.value.min_price != null) count++;
    if (local.value.max_price != null) count++;
    if (local.value.in_stock) count++;
    return count;
});

const clearFilters = () => {
    local.value = {
        category_ids: [],
        brand_ids: [],
        min_price: undefined,
        max_price: undefined,
        in_stock: false,
    };
    emitImmediate();
};

// Category search for long lists
const categorySearch = ref('');
const filteredCategories = computed(() => {
    const q = categorySearch.value.trim().toLowerCase();
    if (!q) return props.categories;
    return props.categories.filter((c) => c.name.toLowerCase().includes(q));
});

// Brand search for long lists
const brandSearch = ref('');
const filteredBrands = computed(() => {
    const q = brandSearch.value.trim().toLowerCase();
    if (!q) return props.brands;
    return props.brands.filter((b) => b.name.toLowerCase().includes(q));
});
</script>

<template>
    <aside
        class="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:w-60 dark:border-border dark:bg-card"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-border"
        >
            <h3
                class="flex items-center gap-1.5 text-sm font-bold text-gray-800 dark:text-white"
            >
                <Layers class="h-4 w-4 text-indigo-500" />
                Filtros
                <span
                    v-if="activeFilterCount > 0"
                    class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                >
                    {{ activeFilterCount }}
                </span>
            </h3>
            <div class="flex items-center gap-1">
                <button
                    v-if="activeFilterCount > 0"
                    @click="clearFilters"
                    class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                >
                    <RotateCcw class="h-3 w-3" />
                    Limpiar
                </button>
                <button
                    v-if="collapsible"
                    @click="emit('close')"
                    class="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted"
                    aria-label="Cerrar filtros"
                    title="Cerrar filtros"
                >
                    <X class="h-4 w-4" />
                </button>
            </div>
        </div>

        <!-- Scrollable body -->
        <div class="flex-1 space-y-5 overflow-y-auto p-3">
            <!-- Categories -->
            <div>
                <h4
                    class="mb-2 flex items-center gap-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                    <Layers class="h-3 w-3" />
                    Categorías
                    <span
                        v-if="local.category_ids.length"
                        class="text-indigo-500"
                        >({{ local.category_ids.length }})</span
                    >
                </h4>
                <!-- Mini search for categories -->
                <input
                    v-if="categories.length > 6"
                    v-model="categorySearch"
                    type="text"
                    placeholder="Buscar categoría..."
                    class="mb-1.5 w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600 placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none dark:border-border dark:bg-muted dark:text-gray-300"
                />
                <div class="max-h-44 space-y-0.5 overflow-y-auto pr-1">
                    <label
                        v-for="cat in filteredCategories"
                        :key="cat.id"
                        class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all"
                        :class="
                            local.category_ids.includes(cat.id)
                                ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-muted'
                        "
                    >
                        <input
                            type="checkbox"
                            :checked="local.category_ids.includes(cat.id)"
                            @change="toggleCategory(cat.id)"
                            class="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span class="truncate">{{ cat.name }}</span>
                    </label>
                    <p
                        v-if="filteredCategories.length === 0"
                        class="px-2 text-[11px] text-gray-400 italic"
                    >
                        {{
                            categorySearch ? 'Sin resultados' : 'Sin categorías'
                        }}
                    </p>
                </div>
            </div>

            <!-- Brands -->
            <div>
                <h4
                    class="mb-2 flex items-center gap-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                    <Tag class="h-3 w-3" />
                    Marcas
                    <span v-if="local.brand_ids.length" class="text-purple-500"
                        >({{ local.brand_ids.length }})</span
                    >
                </h4>
                <!-- Mini search for brands -->
                <input
                    v-if="brands.length > 6"
                    v-model="brandSearch"
                    type="text"
                    placeholder="Buscar marca..."
                    class="mb-1.5 w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600 placeholder:text-gray-400 focus:ring-1 focus:ring-purple-400 focus:outline-none dark:border-border dark:bg-muted dark:text-gray-300"
                />
                <div class="max-h-44 space-y-0.5 overflow-y-auto pr-1">
                    <label
                        v-for="brand in filteredBrands"
                        :key="brand.id"
                        class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all"
                        :class="
                            local.brand_ids.includes(brand.id)
                                ? 'bg-purple-50 font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-muted'
                        "
                    >
                        <input
                            type="checkbox"
                            :checked="local.brand_ids.includes(brand.id)"
                            @change="toggleBrand(brand.id)"
                            class="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span class="truncate">{{ brand.name }}</span>
                    </label>
                    <p
                        v-if="filteredBrands.length === 0"
                        class="px-2 text-[11px] text-gray-400 italic"
                    >
                        {{ brandSearch ? 'Sin resultados' : 'Sin marcas' }}
                    </p>
                </div>
            </div>

            <!-- Price Range -->
            <div>
                <h4
                    class="mb-2 flex items-center gap-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                    <DollarSign class="h-3 w-3" />
                    Precio
                </h4>
                <div class="flex gap-2">
                    <input
                        v-model.number="local.min_price"
                        @input="emitDebounced"
                        type="number"
                        placeholder="Min"
                        min="0"
                        step="0.01"
                        class="w-1/2 [appearance:textfield] rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 transition-shadow placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none dark:border-border dark:bg-muted dark:text-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <input
                        v-model.number="local.max_price"
                        @input="emitDebounced"
                        type="number"
                        placeholder="Max"
                        min="0"
                        step="0.01"
                        class="w-1/2 [appearance:textfield] rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 transition-shadow placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none dark:border-border dark:bg-muted dark:text-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                </div>
            </div>

            <!-- In Stock Toggle -->
            <label class="group flex cursor-pointer items-center gap-2 px-1">
                <input
                    type="checkbox"
                    v-model="local.in_stock"
                    @change="emitImmediate"
                    class="h-4 w-4 cursor-pointer rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div class="flex items-center gap-1">
                    <Package class="h-3.5 w-3.5 text-emerald-500" />
                    <span
                        class="text-xs text-gray-700 transition-colors group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white"
                        >Solo con stock</span
                    >
                </div>
            </label>
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-100 px-3 py-2 dark:border-border">
            <p class="text-center text-[10px] text-gray-400">
                Filtros automáticos del panel lateral.
            </p>
        </div>
    </aside>
</template>
