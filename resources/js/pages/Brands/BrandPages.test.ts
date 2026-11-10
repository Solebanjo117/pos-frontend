// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import Create from './Create.vue';
import Edit from './Edit.vue';
import Index from './Index.vue';

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div />' },
    Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
    router: { visit: vi.fn() },
}));

vi.mock('@/layouts/AppLayout.vue', () => ({
    default: { template: '<div class="flex flex-col"><slot /></div>' },
}));

vi.mock('@/composables/useBrands', () => ({
    useBrands: () => ({
        brands: ref([]),
        brand: ref({ id: 1, name: 'BOSCH', tier: 'premium', suppliers: [] }),
        pagination: ref(null),
        loading: ref(false),
        error: ref(null),
        fetchBrands: vi.fn().mockResolvedValue(undefined),
        fetchBrandById: vi.fn().mockResolvedValue(undefined),
        createBrand: vi.fn(),
        updateBrand: vi.fn(),
        deleteBrand: vi.fn(),
    }),
}));

vi.mock('@/composables/useSuppliers', () => ({
    useSuppliers: () => ({
        fetchActiveSuppliers: vi.fn().mockResolvedValue([]),
    }),
}));

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe('Marcas', () => {
    it.each([
        ['Nueva', Create, {}],
        ['Editar', Edit, { id: '1' }],
    ])(
        '%s marca: el formulario ocupa todo el ancho disponible',
        async (_name, page, props) => {
            const wrapper = mount(page as any, { props });
            await flushPromises();

            // Dentro del layout flex, sin w-full el formulario se encogía a su contenido.
            const container = wrapper.get('.max-w-3xl');
            expect(container.classes()).toEqual(
                expect.arrayContaining(['w-full', 'mx-auto']),
            );
        },
    );

    it('el listado tiene Nueva Marca e Importar juntos a la derecha', async () => {
        const wrapper = mount(Index);
        await flushPromises();

        const create = wrapper.get('a[href="/brands/create"]');
        const importLink = wrapper.get('a[href="/brands/import"]');
        expect(create.element.parentElement).toBe(
            importLink.element.parentElement,
        );
        expect(create.element.nextElementSibling).toBe(importLink.element);
    });
});
