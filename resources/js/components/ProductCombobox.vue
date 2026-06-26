<script setup lang="ts">
import { Check, ChevronsUpDown, Search } from 'lucide-vue-next';
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { type Product, type ProductVariant } from '@/types/product';

const props = defineProps<{
    modelValue: number | null;
    variantId?: number | null;
    products: Product[];
    error?: string;
    placeholder?: string;
    hideVariants?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: number | null): void;
    (e: 'update:variantId', value: number | null): void;
    (e: 'selected', product: Product, variant?: ProductVariant | null): void;
}>();

const isOpen = ref(false);
const searchQuery = ref('');
const containerRef = ref<HTMLElement | null>(null);

// Helper to format variant name
const formatVariantName = (variant: ProductVariant) => {
    const parts = [];
    if (variant.brand) parts.push(variant.brand.name);
    // Add other attributes if available, currently just SKU/Brand is standard
    // If we had attributes loaded on the variant object in list, we'd show them
    return parts.join(' - ');
};

const selectedLabel = computed(() => {
    if (!props.modelValue) return '';

    const product = props.products.find((p) => p.id === props.modelValue);
    if (!product) return '';

    let label = product.name;

    if (props.variantId && product.variants) {
        const variant = product.variants.find((v) => v.id === props.variantId);
        if (variant) {
            label += ` (${variant.sku})`;
            if (variant.brand) label += ` - ${variant.brand.name}`;
        }
    } else {
        label += ` (${product.sku_base})`;
    }

    return label;
});

watch(
    () => props.modelValue,
    (newVal) => {
        if (!newVal) {
            // searchQuery.value = '' // Don't clear query on reset?
        }
    },
);

// Flattened list of selectable items (Products AND Variants)
const filteredItems = computed(() => {
    const query = searchQuery.value.toLowerCase();
    const items: Array<{
        type: 'product' | 'variant';
        id: number; // unique key for v-for (composite)
        product: Product;
        variant?: ProductVariant;
        label: string;
        subLabel: string;
    }> = [];

    props.products.forEach((product) => {
        // Match product itself
        const productMatches =
            product.name.toLowerCase().includes(query) ||
            product.sku_base.toLowerCase().includes(query);

        // If product has variants, check them (unless hidden)
        if (
            product.variants &&
            product.variants.length > 0 &&
            !props.hideVariants
        ) {
            product.variants.forEach((variant) => {
                const variantMatches =
                    variant.sku.toLowerCase().includes(query) ||
                    variant.brand?.name?.toLowerCase().includes(query) ||
                    productMatches; // if parent matches, show variants too

                if (variantMatches) {
                    const label = `${product.name}`;
                    let subLabel = `SKU: ${variant.sku}`;
                    if (variant.brand) subLabel += ` | ${variant.brand.name}`;

                    items.push({
                        type: 'variant',
                        id: variant.id, // Use variant ID as key (assuming unique across system, if not use composite)
                        product,
                        variant,
                        label,
                        subLabel,
                    });
                }
            });
        } else {
            // No variants, show product itself
            if (productMatches) {
                items.push({
                    type: 'product',
                    id: product.id,
                    product,
                    label: product.name,
                    subLabel: `SKU: ${product.sku_base}`,
                });
            }
        }
    });

    return items.slice(0, 50);
});

const toggleOpen = () => {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        // focus input
        setTimeout(() => {
            const input = containerRef.value?.querySelector('input');
            input?.focus();
        }, 50);
    }
};

const selectItem = (item: any) => {
    emit('update:modelValue', item.product.id);
    if (item.type === 'variant') {
        emit('update:variantId', item.variant.id);
        emit('selected', item.product, item.variant);
    } else {
        emit('update:variantId', null);
        emit('selected', item.product, null);
    }
    isOpen.value = false;
    searchQuery.value = '';
};

const handleClickOutside = (event: MouseEvent) => {
    if (
        containerRef.value &&
        !containerRef.value.contains(event.target as Node)
    ) {
        isOpen.value = false;
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
    <div class="relative" ref="containerRef">
        <div
            @click="toggleOpen"
            class="flex w-full cursor-pointer items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-muted"
            :class="{ 'border-red-500': error }"
        >
            <span v-if="selectedLabel" class="truncate">
                {{ selectedLabel }}
            </span>
            <span v-else class="text-gray-500 dark:text-gray-400">
                {{ placeholder || 'Buscar producto...' }}
            </span>
            <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </div>

        <div v-if="error" class="mt-1 text-xs text-red-600">
            {{ error }}
        </div>

        <div
            v-if="isOpen"
            class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card"
        >
            <div
                class="sticky top-0 border-b border-gray-200 bg-gray-50 p-2 dark:border-border dark:bg-background"
            >
                <div class="relative">
                    <Search
                        class="absolute top-2.5 left-2 h-3.5 w-3.5 text-gray-400"
                    />
                    <input
                        v-model="searchQuery"
                        type="text"
                        class="w-full rounded border border-gray-200 bg-white py-1 pr-2 pl-8 text-xs focus:border-blue-500 focus:outline-none dark:border-border dark:bg-card dark:text-white"
                        placeholder="Buscar por nombre, SKU o marca..."
                    />
                </div>
            </div>

            <ul class="py-1">
                <li
                    v-for="(item, index) in filteredItems"
                    :key="`${item.type}-${item.id}`"
                    @click="selectItem(item)"
                    class="relative cursor-pointer px-2 py-1.5 text-sm text-gray-900 select-none hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-muted/50"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex flex-col">
                            <span>{{ item.label }}</span>
                            <span
                                class="text-xs text-gray-500 dark:text-gray-400"
                                >{{ item.subLabel }}</span
                            >
                        </div>
                        <Check
                            v-if="
                                modelValue === item.product.id &&
                                (item.type === 'product' ||
                                    variantId === item.variant?.id)
                            "
                            class="h-4 w-4 text-blue-600 dark:text-primary"
                        />
                    </div>
                </li>
                <li
                    v-if="filteredItems.length === 0"
                    class="px-2 py-2 text-center text-xs text-gray-500"
                >
                    No se encontraron productos.
                </li>
            </ul>
        </div>
    </div>
</template>
