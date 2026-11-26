// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ProductInventoryTypeToggle from './ProductInventoryTypeToggle.vue';

/*
 * Pedido del jefe (2026-11-23): tipos de inventario como en Lightspeed, por ahora
 * solo "single" (inventariable) y "non-inventory" (no inventariable), editable en
 * cada producto desde Editar producto.
 */
describe('ProductInventoryTypeToggle', () => {
    it('shows only the two types, inventariable by default', () => {
        const wrapper = mount(ProductInventoryTypeToggle, {
            props: { modelValue: undefined },
        });

        const options = wrapper.findAll('[role="radio"]');
        expect(options.map((option) => option.text())).toEqual([
            'Inventariable',
            'No inventariable',
        ]);
        expect(
            wrapper.get('[data-value="single"]').attributes('aria-checked'),
        ).toBe('true');
    });

    it('emits the selected type', async () => {
        const wrapper = mount(ProductInventoryTypeToggle, {
            props: { modelValue: 'single' },
        });

        await wrapper.get('[data-value="non_inventory"]').trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([
            ['non_inventory'],
        ]);
    });
});

describe('Edit product: inventory type', () => {
    const page = readFileSync(
        resolve(__dirname, '../../pages/Products/Edit.vue'),
        'utf8',
    );

    it('edits the type of each product and loads the saved one', () => {
        expect(page).toMatch(
            /<ProductInventoryTypeToggle\s+v-model="form\.inventory_type"/,
        );
        expect(page).toContain(
            "inventory_type: currentProduct.value.inventory_type ?? 'single'",
        );
    });
});
