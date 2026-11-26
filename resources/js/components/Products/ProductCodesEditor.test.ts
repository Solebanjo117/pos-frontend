// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import type { ProductCode } from '@/types/product';
import ProductCodesEditor from './ProductCodesEditor.vue';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/services/api/client', () => ({
    default: {
        get: apiGet,
    },
}));

vi.mock('@inertiajs/vue3', () => ({
    Link: {
        props: ['href'],
        template: '<a :href="href"><slot /></a>',
    },
}));

const mountEditor = (initialCodes: ProductCode[] = []) => {
    return mount(
        defineComponent({
            components: { ProductCodesEditor },
            setup() {
                const codes = ref<ProductCode[]>(initialCodes);
                return { codes };
            },
            template: '<ProductCodesEditor v-model="codes" />',
        }),
    );
};

const buttonWithText = (
    wrapper: ReturnType<typeof mountEditor>,
    text: string,
) => {
    const button = wrapper
        .findAll('button')
        .find((candidate) => candidate.text().includes(text));

    if (!button) throw new Error(`No se encontró el botón ${text}`);

    return button;
};

describe('ProductCodesEditor', () => {
    beforeEach(() => {
        vi.useRealTimers();
        apiGet.mockReset();
        apiGet.mockResolvedValue({ data: { data: [] } });
    });

    it('permite mantener un producto sin código', () => {
        const wrapper = mountEditor();

        expect(wrapper.text()).toContain('Sin número de parte');
        expect((wrapper.vm as { codes: ProductCode[] }).codes).toEqual([]);
    });

    it('crea el primer código como principal y bloquea equivalentes locales', async () => {
        const wrapper = mountEditor();
        const input = wrapper.get('input[placeholder="Ej: 45503-19155"]');

        await input.setValue('45503-19155');
        await buttonWithText(wrapper, 'Agregar').trigger('click');

        expect((wrapper.vm as { codes: ProductCode[] }).codes).toEqual([
            expect.objectContaining({
                code: '45503-19155',
                is_primary: true,
            }),
        ]);

        await input.setValue('45503 19155');
        await buttonWithText(wrapper, 'Agregar').trigger('click');

        expect(wrapper.text()).toContain('ya está en la lista');
        expect((wrapper.vm as { codes: ProductCode[] }).codes).toHaveLength(1);
    });

    it('cambia el principal con la estrella y lo muestra primero', async () => {
        const wrapper = mountEditor([
            { code: 'SKU-1', type: 'sku', is_primary: true },
            { code: 'ALT-1', type: 'alternate', is_primary: false },
        ]);

        await wrapper
            .get('button[aria-label="Hacer principal ALT-1"]')
            .trigger('click');
        await nextTick();

        expect((wrapper.vm as { codes: ProductCode[] }).codes).toEqual([
            expect.objectContaining({ code: 'SKU-1', is_primary: false }),
            expect.objectContaining({ code: 'ALT-1', is_primary: true }),
        ]);
        const firstRow = wrapper.findAll('[data-test="code-row"]')[0];
        expect((firstRow.get('input').element as HTMLInputElement).value).toBe(
            'ALT-1',
        );
        expect(firstRow.text()).toContain('se imprime en tickets y pedidos');
    });

    it('al quitar el principal, el siguiente pasa a ser principal', async () => {
        const wrapper = mountEditor([
            { code: 'SKU-1', type: 'sku', is_primary: true },
            { code: 'ALT-1', type: 'alternate', is_primary: false },
        ]);

        await wrapper
            .get('button[aria-label="Eliminar código SKU-1"]')
            .trigger('click');

        expect((wrapper.vm as { codes: ProductCode[] }).codes).toEqual([
            expect.objectContaining({ code: 'ALT-1', is_primary: true }),
        ]);
    });

    it('agrega con Enter y marca como código de barras un número de 12 a 14 dígitos', async () => {
        const wrapper = mountEditor([
            { code: 'SKU-1', type: 'sku', is_primary: true },
        ]);
        const input = wrapper.get('[data-test="code-new"]');

        await input.setValue('7501234567890');
        await input.trigger('keydown', { key: 'Enter' });
        await input.setValue('OTRO-2');
        await input.trigger('keydown', { key: 'Enter' });

        expect((wrapper.vm as { codes: ProductCode[] }).codes).toEqual([
            expect.objectContaining({ code: 'SKU-1', is_primary: true }),
            expect.objectContaining({
                code: '7501234567890',
                type: 'upc',
                is_primary: false,
            }),
            expect.objectContaining({ code: 'OTRO-2', type: 'alternate' }),
        ]);
    });

    it('muestra el producto existente cuando el servidor detecta un conflicto', async () => {
        apiGet.mockResolvedValue({
            data: {
                data: [
                    {
                        id: 27,
                        name: 'Producto existente',
                        matched_code: '4550319155',
                        primary_code: '45503-19155',
                        url: '/inventory/products/27/edit',
                    },
                ],
            },
        });
        const wrapper = mountEditor([
            { code: '45503 19155', type: 'sku', is_primary: true },
        ]);
        const editor = wrapper.getComponent(ProductCodesEditor);

        await (
            editor.vm as unknown as { validateAll: () => Promise<void> }
        ).validateAll();
        await nextTick();

        expect(wrapper.text()).toContain('Producto existente');
        expect(wrapper.get('a').attributes('href')).toBe(
            '/inventory/products/27/edit',
        );
        // Lo que ven las pantallas que usan el editor por ref: la API expuesta (defineExpose).
        const exposed = (
            editor.vm as unknown as {
                $: { exposed: { hasConflicts: () => boolean } };
            }
        ).$.exposed;
        expect(exposed.hasConflicts()).toBe(true);
    });
});
