<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { Search } from 'lucide-vue-next';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

interface Category {
    id: number;
    name: string;
}
interface Brand {
    id: number;
    name: string;
}

const props = defineProps<{
    categories?: Category[];
    brands?: Brand[];
}>();

const emit = defineEmits(['search', 'filter-category', 'filter-brand']);

const query = ref('');
const quantity = ref(1);
const selectedCategory = ref<number | null>(null);
const selectedBrand = ref<number | null>(null);

// Computed options for SearchableSelect
const categoryOptions = computed(() => {
    const opts = [
        { value: null as number | null, label: 'Todas las Categorías' },
    ];
    if (props.categories) {
        opts.push(
            ...props.categories.map((c) => ({ value: c.id, label: c.name })),
        );
    }
    return opts;
});

const brandOptions = computed(() => {
    const opts = [{ value: null as number | null, label: 'Todas las Marcas' }];
    if (props.brands) {
        opts.push(...props.brands.map((b) => ({ value: b.id, label: b.name })));
    }
    return opts;
});

// Ref for the search input element — used for persistent auto-focus
const searchInputRef = ref<HTMLInputElement>();

// Enforce minimum quantity of 1
watch(quantity, (val) => {
    if (val < 1 || !val) {
        quantity.value = 1;
    }
});

// Auto-focus on mount
onMounted(() => {
    nextTick(() => searchInputRef.value?.focus());
});

const handleSearch = () => {
    // Permitir búsqueda vacía para listar todos los productos (BUG-001 fix)
    const trimmed = query.value.trim();

    emit('search', {
        query: trimmed || undefined,
        quantity: quantity.value,
        category_id: selectedCategory.value || undefined,
        brand_id: selectedBrand.value || undefined,
    });
};

const handleCategoryChange = () => {
    emit('filter-category', selectedCategory.value || undefined);
};

const handleBrandChange = () => {
    emit('filter-brand', selectedBrand.value || undefined);
};

// Expose focus method so parent can call it after adding items
const focus = () => {
    nextTick(() => searchInputRef.value?.focus());
};

defineExpose({ focus });
</script>

<template>
    <div
        class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
    >
        <!-- Single Row: Search Bar + Category/Brand Dropdowns + Qty + Buscar -->
        <div class="flex flex-col items-center gap-3 md:flex-row">
            <!-- Search Bar -->
            <div class="relative w-full flex-1">
                <Search
                    class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <input
                    ref="searchInputRef"
                    v-model="query"
                    @keyup.enter="handleSearch"
                    type="text"
                    placeholder="SKU, nombre, vehículo, motor… (Enter para buscar)"
                    class="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-3 pl-10 text-sm text-gray-700 transition-shadow placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-foreground dark:placeholder:text-gray-500"
                />
            </div>

            <!-- Category / Brand Dropdowns -->
            <div class="flex w-full gap-2 md:w-auto">
                <SearchableSelect
                    v-model="selectedCategory"
                    :options="categoryOptions"
                    placeholder="Todas las Categorías"
                    @update:modelValue="handleCategoryChange"
                    class="min-w-[160px] flex-1"
                />
                <SearchableSelect
                    v-model="selectedBrand"
                    :options="brandOptions"
                    placeholder="Todas las Marcas"
                    @update:modelValue="handleBrandChange"
                    class="min-w-[160px] flex-1"
                />
            </div>

            <!-- Buscar Button -->
            <div class="flex shrink-0">
                <button
                    @click="handleSearch"
                    class="h-10 rounded-lg border border-gray-200 bg-gray-100 px-4 text-sm font-medium whitespace-nowrap text-gray-700 transition-colors hover:bg-gray-200 dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
                >
                    Buscar
                </button>
            </div>
        </div>
    </div>
</template>
