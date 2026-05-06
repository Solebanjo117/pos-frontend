<script setup lang="ts">
import ProductVariantPickerModal from '@/components/Products/ProductVariantPickerModal.vue';
import type { Product } from '@/types/product';
import type { ProductVariantSelection } from '@/types/product-variant-picker';

interface CategoryOption {
    id: number;
    name: string;
}

interface BrandOption {
    id: number;
    name: string;
}

const props = withDefaults(
    defineProps<{
        show: boolean;
        products: Product[];
        searchQuery: string;
        clientMode?: boolean;
        totalCount?: number;
        hasMore?: boolean;
        loadingMore?: boolean;
        context?: 'pos' | 'supply-list';
        showQuickPurchaseAction?: boolean;
        categories?: CategoryOption[];
        brands?: BrandOption[];
    }>(),
    {
        clientMode: false,
        totalCount: 0,
        hasMore: false,
        loadingMore: false,
        context: 'pos',
        showQuickPurchaseAction: true,
        categories: () => [],
        brands: () => [],
    },
);

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'add-products', ids: Set<number>): void;
    (e: 'add-variants', selections: ProductVariantSelection[]): void;
    (e: 'load-more'): void;
    (e: 'product-selected', product: Product): void;
    (
        e: 'search-in-modal',
        filters: {
            query: string;
            category_ids?: number[];
            brand_ids?: number[];
            sku?: string;
            min_price?: number;
            max_price?: number;
            in_stock?: boolean;
            sort?: string;
        },
    ): void;
}>();
</script>

<template>
    <ProductVariantPickerModal
        :show="props.show"
        :products="props.products"
        :search-query="props.searchQuery"
        :total-count="props.totalCount"
        :has-more="props.hasMore"
        :loading-more="props.loadingMore"
        :categories="props.categories"
        :brands="props.brands"
        title="Seleccionar Productos"
        confirm-label="Agregar"
        context="pos"
        @close="emit('close')"
        @confirm="emit('add-variants', $event)"
        @load-more="emit('load-more')"
        @search="emit('search-in-modal', $event)"
    />
</template>
