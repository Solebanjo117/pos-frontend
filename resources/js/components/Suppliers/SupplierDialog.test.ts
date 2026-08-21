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
    Dialog: { template: '<div><slot /></div>' },
    DialogScrollContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
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
});
