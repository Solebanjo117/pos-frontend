<script setup lang="ts">
import { ref, computed } from 'vue';

interface CatalogFilterState {
    categories: string[];
    priceRange: [number, number];
    availability: 'all' | 'in-stock' | 'out-of-stock';
    brands: string[];
}

interface Props {
    filters: CatalogFilterState;
    availableCategories?: Array<{ id: number; name: string }>;
    availableBrands?: Array<{ id: number; name: string }>;
}

const props = withDefaults(defineProps<Props>(), {
    availableCategories: () => [],
    availableBrands: () => [],
});

const emit = defineEmits<{
    'update:filters': [filters: CatalogFilterState];
}>();

const isCollapsed = ref(false);

const toggleCategory = (category: string) => {
    const newCategories = props.filters.categories.includes(category)
        ? props.filters.categories.filter((c) => c !== category)
        : [...props.filters.categories, category];
    emit('update:filters', { ...props.filters, categories: newCategories });
};

const toggleBrand = (brand: string) => {
    const newBrands = props.filters.brands.includes(brand)
        ? props.filters.brands.filter((b) => b !== brand)
        : [...props.filters.brands, brand];
    emit('update:filters', { ...props.filters, brands: newBrands });
};

const setAvailability = (value: 'all' | 'in-stock' | 'out-of-stock') => {
    emit('update:filters', { ...props.filters, availability: value });
};

const clearAll = () => {
    emit('update:filters', {
        categories: [],
        priceRange: [0, 50000],
        availability: 'all',
        brands: [],
    });
};

const hasActiveFilters = computed(() => {
    return (
        props.filters.categories.length > 0 ||
        props.filters.brands.length > 0 ||
        props.filters.availability !== 'all'
    );
});
</script>

<template>
    <div
        class="sticky top-4 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between border-b border-gray-100 p-4 dark:border-border"
        >
            <div class="flex items-center gap-2">
                <svg
                    class="h-4 w-4 text-gray-600 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                </svg>
                <h2 class="font-semibold text-gray-900 dark:text-white">
                    Filtros
                </h2>
            </div>
            <button
                v-if="hasActiveFilters"
                @click="clearAll"
                class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:text-primary dark:hover:text-blue-300"
            >
                Limpiar todo
            </button>
        </div>

        <div class="space-y-6 p-4">
            <!-- Categoría -->
            <div v-if="availableCategories.length > 0">
                <h3
                    class="mb-3 text-sm font-medium text-gray-900 dark:text-white"
                >
                    Categoría
                </h3>
                <div class="space-y-2">
                    <label
                        v-for="cat in availableCategories"
                        :key="cat.id"
                        class="group flex cursor-pointer items-center space-x-2"
                    >
                        <input
                            type="checkbox"
                            :checked="filters.categories.includes(cat.name)"
                            @change="toggleCategory(cat.name)"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-primary"
                        />
                        <span
                            class="text-sm text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white"
                        >
                            {{ cat.name }}
                        </span>
                    </label>
                </div>
            </div>

            <!-- Disponibilidad -->
            <div>
                <h3
                    class="mb-3 text-sm font-medium text-gray-900 dark:text-white"
                >
                    Disponibilidad
                </h3>
                <div class="space-y-2">
                    <label
                        v-for="opt in [
                            { value: 'all', label: 'Todos' },
                            { value: 'in-stock', label: 'En Stock' },
                            { value: 'out-of-stock', label: 'Sin Stock' },
                        ]"
                        :key="opt.value"
                        class="group flex cursor-pointer items-center space-x-2"
                    >
                        <input
                            type="radio"
                            name="availability"
                            :value="opt.value"
                            :checked="filters.availability === opt.value"
                            @change="setAvailability(opt.value as any)"
                            class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-border dark:text-primary"
                        />
                        <span
                            class="text-sm text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white"
                        >
                            {{ opt.label }}
                        </span>
                    </label>
                </div>
            </div>

            <!-- Marcas -->
            <div v-if="availableBrands.length > 0">
                <h3
                    class="mb-3 text-sm font-medium text-gray-900 dark:text-white"
                >
                    Marca
                </h3>
                <div class="max-h-48 space-y-2 overflow-y-auto">
                    <label
                        v-for="brand in availableBrands"
                        :key="brand.id"
                        class="group flex cursor-pointer items-center space-x-2"
                    >
                        <input
                            type="checkbox"
                            :checked="filters.brands.includes(brand.name)"
                            @change="toggleBrand(brand.name)"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-primary"
                        />
                        <span
                            class="text-sm text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white"
                        >
                            {{ brand.name }}
                        </span>
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>
