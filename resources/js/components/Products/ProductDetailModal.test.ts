// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import ProductDetailModal from './ProductDetailModal.vue';

vi.mock('@/composables/usePOS', () => ({
    usePOS: () => ({ addToCart: vi.fn() }),
}));

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({ currentWarehouseId: ref(1) }),
}));

vi.mock('@/composables/useStoreSettings', () => ({
    useStoreSettings: () => ({
        resolveTaxRate: (value: unknown) =>
            value === null || value === undefined ? 7 : Number(value),
    }),
}));

vi.mock('@/services/api/client', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { data: [] } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

const product = {
    id: 10,
    name: 'Filtro de aceite',
    sku_base: 'FIL-10',
    status: 'active',
    variants: [],
} as any;

describe('ProductDetailModal header toggles', () => {
    beforeEach(() => localStorage.clear());

    it('muestra Vista e ITBM como interruptores del mismo tamaño', async () => {
        const wrapper = mount(ProductDetailModal, { props: { product } });
        await flushPromises();

        const blind = wrapper.get('[data-testid="blind-mode-toggle"]');
        const itbm = wrapper.get('[data-testid="itbm-toggle"]');
        const sizeClasses = (classes: string[]) =>
            classes.filter((c) => /^(h|w)-/.test(c)).sort();

        expect(sizeClasses(blind.classes())).toEqual(['h-5', 'w-9']);
        expect(sizeClasses(itbm.classes())).toEqual(
            sizeClasses(blind.classes()),
        );
        expect(blind.element.parentElement?.textContent).toContain('Normal');
        expect(itbm.element.parentElement?.textContent).toContain('+ITBM'); // ITBM activado por defecto
    });

    it('cambia de estado y lo recuerda', async () => {
        const wrapper = mount(ProductDetailModal, { props: { product } });
        await flushPromises();

        await wrapper.get('[data-testid="blind-mode-toggle"]').trigger('click');
        await wrapper.get('[data-testid="itbm-toggle"]').trigger('click');

        expect(
            wrapper
                .get('[data-testid="blind-mode-toggle"]')
                .attributes('aria-checked'),
        ).toBe('true');
        expect(
            wrapper.get('[data-testid="itbm-toggle"]').element.parentElement
                ?.textContent,
        ).toContain('Sin ITBM');
        expect(localStorage.getItem('product_blind_mode')).toBe('true');
        expect(localStorage.getItem('product_include_itbm')).toBe('false');
    });

    it('titula con la categoría y el carro por defecto, y deja el nombre debajo', async () => {
        const wrapper = mount(ProductDetailModal, {
            props: {
                product: {
                    ...product,
                    category: { id: 3, name: 'Filtro de aceite' },
                    vehicles: [
                        {
                            label: 'TOYOTA COROLLA E110 1995-2002',
                            detail: '4A-FE',
                        },
                        { label: 'NISSAN SENTRA', detail: null },
                    ],
                },
            },
        });
        await flushPromises();

        expect(wrapper.get('[data-testid="product-detail-title"]').text()).toBe(
            'Filtro de aceite · TOYOTA COROLLA E110 1995-2002',
        );
        expect(wrapper.get('[data-testid="product-detail-name"]').text()).toBe(
            'Filtro de aceite',
        );
    });

    it('solo el cuerpo se desplaza; la cabecera queda fuera del scroll', async () => {
        const wrapper = mount(ProductDetailModal, { props: { product } });
        await flushPromises();

        const body = wrapper.get('[data-testid="product-detail-body"]');
        const box = body.element.parentElement as HTMLElement;
        const header = wrapper
            .get('[data-testid="product-detail-title"]')
            .element.closest('.shrink-0') as HTMLElement;

        expect(body.classes()).toContain('overflow-y-auto');
        expect(box.className).toContain('overflow-hidden');
        expect(box.className).not.toContain('overflow-y-auto');
        expect(header.parentElement).toBe(box);
        expect(header.className).not.toContain('sticky');
    });
});
