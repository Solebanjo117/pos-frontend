// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import ProductCategoryPicker from './ProductCategoryPicker.vue';
import StackedCellList from './StackedCellList.vue';

vi.mock('@/services/api/client', () => ({
    default: { post: vi.fn(), get: vi.fn() },
}));

/*
 * Decisión de Luis (2026-11-24): en la tabla de Productos se ven TODAS las categorías, números de
 * parte y carros, uno debajo del otro, con el principal primero y en negrita. Máximo 2 por celda y
 * "+N más" para ver el resto. Sigue habiendo un solo principal (★) de categoría y de número.
 */
describe('StackedCellList (celdas de la tabla de Productos)', () => {
    const items = [
        { label: 'Nissan SENTRA B17 2012+', primary: true },
        { label: 'Nissan TIIDA' },
        { label: 'Nissan VERSA' },
        { label: 'Nissan NOTE' },
    ];

    it('muestra 2, el principal en negrita, y "+N más" despliega el resto', async () => {
        const wrapper = mount(StackedCellList, { props: { items } });
        const shown = () =>
            wrapper.findAll('[data-test="stacked-cell"] > span');

        expect(shown()).toHaveLength(2);
        expect(shown()[0].classes()).toContain('font-semibold');
        expect(shown()[1].classes()).not.toContain('font-semibold');

        const toggle = wrapper.get('[data-test="stacked-cell-toggle"]');
        expect(toggle.text()).toBe('+2 más');

        await toggle.trigger('click');
        expect(shown()).toHaveLength(4);
        expect(toggle.text()).toBe('ver menos');
    });

    it('no muestra "ver más" con 2 o menos, y un guion si no hay nada', () => {
        expect(
            mount(StackedCellList, { props: { items: items.slice(0, 2) } })
                .find('[data-test="stacked-cell-toggle"]')
                .exists(),
        ).toBe(false);
        expect(mount(StackedCellList, { props: { items: [] } }).text()).toBe(
            '—',
        );
    });

    it('la tabla de Productos usa la celda para código, categoría y carro', () => {
        const page = readFileSync(
            resolve(__dirname, '../../pages/Products/Index.vue'),
            'utf8',
        );
        for (const cell of [
            'product-codes-cell',
            'product-categories-cell',
            'product-vehicles-cell',
        ]) {
            expect(page).toContain(`data-test="${cell}"`);
        }
        expect(page).toContain('product.extra_categories');
    });
});

describe('ProductCategoryPicker (Crear y Editar producto)', () => {
    const categories = [
        { id: 1, name: 'Terminales' },
        { id: 2, name: 'Rótulas' },
        { id: 3, name: 'Suspensión' },
    ];

    const mountPicker = (primaryId: number | null, extraIds: number[]) =>
        mount(ProductCategoryPicker, {
            props: { categories, primaryId, extraIds },
            global: { stubs: { SearchableSelect: true } },
        });

    it('la principal va primero con estrella; la estrella de otra la hace principal', async () => {
        const wrapper = mountPicker(1, [2, 3]);
        const rows = wrapper.findAll('[data-test="category-row"]');

        expect(
            rows.map((row) => row.text().split('Principal')[0].trim()),
        ).toEqual(['Terminales', 'Rótulas', 'Suspensión']);

        await rows[2].get('[data-test="category-star"]').trigger('click');
        await nextTick();

        expect(wrapper.emitted('update:primaryId')?.at(-1)).toEqual([3]);
        expect(wrapper.emitted('update:extraIds')?.at(-1)).toEqual([[2, 1]]);
    });

    it('al quitar la principal, la siguiente pasa a ser principal', async () => {
        const wrapper = mountPicker(1, [2, 3]);

        await wrapper
            .findAll('[data-test="category-row"]')[0]
            .get('[data-test="category-remove"]')
            .trigger('click');

        expect(wrapper.emitted('update:primaryId')?.at(-1)).toEqual([2]);
        expect(wrapper.emitted('update:extraIds')?.at(-1)).toEqual([[3]]);
    });

    it('Crear y Editar producto usan el selector con creación en el mismo lugar', () => {
        for (const file of ['Create.vue', 'Edit.vue']) {
            const page = readFileSync(
                resolve(__dirname, `../../pages/Products/${file}`),
                'utf8',
            );
            expect(page, file).toContain('<ProductCategoryPicker');
            expect(page, file).toContain('allow-create');
            expect(page, file).not.toContain('Categorías extra');
            expect(page, file).toContain('<ProductStatusToggle');
        }
    });
});
