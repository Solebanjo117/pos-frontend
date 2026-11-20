// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import Create from './Create.vue';
import Edit from './Edit.vue';

const mocks = vi.hoisted(() => ({
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div />' },
    Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
    router: { visit: vi.fn() },
}));

vi.mock('@/layouts/AppLayout.vue', () => ({
    default: { template: '<div class="flex flex-col"><slot /></div>' },
}));

vi.mock('@/components/Categories/CategoryImagesSection.vue', () => ({
    default: { template: '<div />' },
}));

vi.mock('@/composables/useCategories', () => ({
    useCategories: () => ({
        loading: ref(false),
        error: ref(null),
        category: ref({
            id: 5,
            name: 'Filtros',
            parent_id: 2,
            parent_ids: [2, 3],
            description: '',
            default_attributes: [],
            applies_itbm: true,
            itbm_percent: 10,
        }),
        createCategory: mocks.createCategory,
        updateCategory: mocks.updateCategory,
        fetchCategoryById: vi.fn().mockResolvedValue(undefined),
        fetchCategoriesWithParent: vi.fn().mockResolvedValue([]),
    }),
}));

vi.mock('@/composables/useStoreSettings', () => ({
    useStoreSettings: () => ({
        fetchSettings: vi.fn().mockResolvedValue(undefined),
        defaultTaxRate: () => 7,
        resolveTaxRate: (value: unknown) =>
            value === null || value === undefined ? 7 : Number(value),
    }),
}));

vi.mock('@/services/categories', () => ({
    categoriesService: { uploadImages: vi.fn() },
}));

describe('Formulario de categoría', () => {
    beforeEach(() => {
        mocks.createCategory.mockReset().mockResolvedValue({ id: 9 });
        mocks.updateCategory.mockReset().mockResolvedValue({ id: 5 });
    });

    it('nueva: sin categorías padre y con el ITBM fijo de la tienda', async () => {
        const wrapper = mount(Create);
        await flushPromises();

        expect(wrapper.text()).not.toContain('Categorías padre');
        expect(wrapper.find('[data-testid="itbm-store-rate"]').exists()).toBe(
            false,
        );

        await wrapper.get('[data-testid="applies-itbm"]').trigger('click');

        expect(wrapper.get('[data-testid="itbm-store-rate"]').text()).toContain(
            '7%',
        );
        // Ya no hay campo para escribir el porcentaje.
        expect(wrapper.find('input[type="number"][max="100"]').exists()).toBe(
            false,
        );

        await wrapper.get('input[type="text"]').setValue('Bujías');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.createCategory).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Bujías',
                applies_itbm: true,
                itbm_percent: 7,
                parent_ids: [],
                parent_id: null,
            }),
        );
    });

    it('editar: conserva las categorías padre que ya tenía y guarda la tasa de la tienda', async () => {
        const wrapper = mount(Edit, { props: { id: '5' } });
        await flushPromises();

        expect(wrapper.text()).not.toContain('Categorías padre');
        expect(
            wrapper
                .get('[data-testid="applies-itbm"]')
                .attributes('data-state'),
        ).toBe('checked');

        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.updateCategory).toHaveBeenCalledWith(
            5,
            expect.objectContaining({
                parent_ids: [2, 3],
                parent_id: 2,
                itbm_percent: 7,
            }),
        );
    });
});
