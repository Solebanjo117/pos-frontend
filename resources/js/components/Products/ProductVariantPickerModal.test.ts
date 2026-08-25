// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import ProductVariantPickerModal from './ProductVariantPickerModal.vue';

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({ currentWarehouseId: ref(1) }),
}));

const product = {
    id: 10,
    name: 'Filtro de aceite',
    status: 'active',
    total_stock: 4,
    variants: [
        {
            id: 20,
            product_id: 10,
            sku: 'FIL-20',
            status: 'active',
            total_stock: 4,
            pricing: { base_price: 12 },
            inventory: [{ warehouse_id: 1, quantity_available: 4 }],
        },
    ],
};

const stubs = {
    ProductFilters: { template: '<div />' },
    ProductSort: { template: '<div />' },
    ProductDetailModal: { template: '<div />' },
    PriceDisplay: { template: '<span />' },
};

describe('ProductVariantPickerModal for POS preparation', () => {
    it('emits the selected real variant and clears selection when reopened', async () => {
        const wrapper = mount(ProductVariantPickerModal, {
            props: { show: true, products: [product] as any, context: 'pos' },
            global: { stubs },
        });
        const vm = wrapper.vm as any;

        vm.toggleVariant(product, product.variants[0]);
        vm.setQuantity(product, product.variants[0], 3);
        vm.submit();

        expect(wrapper.emitted('confirm')?.[0]?.[0]).toMatchObject([
            { product: { id: 10 }, variant: { id: 20 }, quantity: 3 },
        ]);

        await wrapper.setProps({ show: false });
        await wrapper.setProps({ show: true });

        expect(vm.selectedCount).toBe(0);
        vm.submit();
        expect(wrapper.emitted('confirm')).toHaveLength(1);
    });

    it('emits the filter contract supported by the products endpoint', () => {
        const wrapper = mount(ProductVariantPickerModal, {
            props: { show: true, products: [product] as any, context: 'pos' },
            global: { stubs },
        });
        const vm = wrapper.vm as any;
        vm.internalSearchQuery = 'filtro';
        vm.filterValues = {
            sku: '',
            category_ids: [2],
            brand_ids: [3],
            min_price: 10,
            max_price: 20,
            in_stock: true,
        };
        vm.sortValue = 'price_desc';
        vm.emitFilters();

        expect(wrapper.emitted('search')?.at(-1)?.[0]).toEqual({
            query: 'filtro',
            category_ids: [2],
            brand_ids: [3],
            min_price: 10,
            max_price: 20,
            in_stock: true,
            sort: 'price_desc',
        });
    });
});
