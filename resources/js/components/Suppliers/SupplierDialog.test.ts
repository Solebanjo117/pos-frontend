// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandsService } from '@/services/brands';
import { suppliersService } from '@/services/suppliers';
import SupplierDialog from './SupplierDialog.vue';

vi.mock('@/services/brands', () => ({
    brandsService: {
        getAllActive: vi.fn(),
    },
}));

vi.mock('@/services/suppliers', () => ({
    suppliersService: {
        create: vi.fn(),
        update: vi.fn(),
        getById: vi.fn(),
    },
}));

const stubs = {
    // AppModal real: cabecera, cuerpo con scroll y pie fijo. Aquí solo se renderizan sus partes.
    AppModal: {
        props: ['open', 'title'],
        template:
            '<div><h2>{{ title }}</h2><div data-test="modal-body"><slot /></div><footer data-test="modal-footer"><slot name="footer" /></footer></div>',
    },
    Link: { template: '<a><slot /></a>' },
};

describe('SupplierDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(brandsService.getAllActive).mockResolvedValue([
            { id: 7, name: 'Bosch' },
        ]);
    });

    it('keeps the form and renders every backend validation error', async () => {
        vi.mocked(suppliersService.create).mockRejectedValue({
            response: {
                data: {
                    message: 'Los datos enviados no son válidos.',
                    errors: {
                        name: ['El proveedor ya existe.'],
                        email: ['El correo no es válido.'],
                        brand_ids: ['Una marca seleccionada no existe.'],
                    },
                },
            },
        });

        const wrapper = mount(SupplierDialog, {
            props: { open: true, supplier: null },
            global: { stubs },
        });
        await flushPromises();

        const name = wrapper.find('input[required]');
        await name.setValue('Proveedor conservado');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect((name.element as HTMLInputElement).value).toBe(
            'Proveedor conservado',
        );
        expect(wrapper.text()).toContain('El proveedor ya existe.');
        expect(wrapper.text()).toContain('El correo no es válido.');
        expect(wrapper.text()).toContain('Una marca seleccionada no existe.');
        expect(wrapper.emitted('saved')).toBeUndefined();
    });

    it('puts Cancel and Save in the modal footer and submits the form from there', async () => {
        vi.mocked(suppliersService.create).mockResolvedValue({
            id: 3,
            name: 'Proveedor nuevo',
        } as any);

        const wrapper = mount(SupplierDialog, {
            props: { open: true, supplier: null },
            global: { stubs },
        });
        await flushPromises();

        const body = wrapper.get('[data-test="modal-body"]');
        const footer = wrapper.get('[data-test="modal-footer"]');
        const form = body.get('form');
        const save = footer
            .findAll('button')
            .find((button) => button.text().includes('Guardar proveedor'))!;

        expect(body.text()).not.toContain('Guardar proveedor');
        expect(footer.text()).toContain('Cancelar');
        expect(save.attributes('type')).toBe('submit');
        expect(save.attributes('form')).toBe(form.attributes('id'));

        await wrapper.find('input[required]').setValue('Proveedor nuevo');
        await form.trigger('submit');
        await flushPromises();

        expect(suppliersService.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Proveedor nuevo' }),
        );
        expect(wrapper.emitted('saved')).toHaveLength(1);
    });

    it('searches supplied brands without losing the ones already checked', async () => {
        vi.mocked(brandsService.getAllActive).mockResolvedValue([
            { id: 7, name: 'Bosch' },
            { id: 8, name: 'Denso' },
            { id: 9, name: 'Nippón Parts' },
        ]);
        vi.mocked(suppliersService.create).mockResolvedValue({
            id: 3,
            name: 'Proveedor',
        } as any);

        // Se abre después de montar, como en la página: así carga las marcas.
        const wrapper = mount(SupplierDialog, {
            props: { open: false, supplier: null },
            global: { stubs },
        });
        await wrapper.setProps({ open: true });
        await flushPromises();

        const brandLabels = () =>
            wrapper
                .findAll('label')
                .filter((label) =>
                    label.find('input[type="checkbox"]').exists(),
                )
                .map((label) => label.text());
        const checkboxFor = (name: string) =>
            wrapper
                .findAll('label')
                .find((label) => label.text() === name)!
                .get('input[type="checkbox"]');

        await checkboxFor('Bosch').trigger('change');
        expect(wrapper.get('[data-testid="brand-selected-count"]').text()).toBe(
            '1 seleccionada(s)',
        );

        // Sin tildes ni mayúsculas.
        await wrapper.get('[data-testid="brand-search"]').setValue('NIPPON');
        expect(brandLabels()).toEqual(['Nippón Parts']);

        await wrapper.get('[data-testid="brand-search"]').setValue('zzz');
        expect(brandLabels()).toEqual([]);
        expect(wrapper.text()).toContain('Ninguna marca coincide');

        await wrapper.find('input[required]').setValue('Proveedor');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        // Bosch sigue marcada aunque el filtro la oculte.
        expect(suppliersService.create).toHaveBeenCalledWith(
            expect.objectContaining({ brand_ids: [7] }),
        );
    });
});
