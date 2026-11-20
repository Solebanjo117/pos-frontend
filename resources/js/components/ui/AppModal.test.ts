// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import AppModal from './AppModal.vue';

const mountModal = (props: Record<string, unknown> = {}) =>
    mount(AppModal, {
        attachTo: document.body,
        props: { open: true, title: 'Agregar vehículo', ...props },
        slots: {
            default: '<p data-test="body">Contenido largo</p>',
            footer: '<button data-test="save">Guardar</button>',
        },
    });

const dialog = () =>
    document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;

describe('AppModal', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a fixed header with title, description and close button, a scrollable body and a footer', async () => {
        const wrapper = mountModal({ description: 'Se registra en el catálogo' });
        await flushPromises();

        expect(dialog().textContent).toContain('Agregar vehículo');
        expect(dialog().textContent).toContain('Se registra en el catálogo');
        expect(dialog().querySelector('header [aria-label="Cerrar"]')).not.toBeNull();

        const body = dialog().querySelector('[data-test="body"]')!.parentElement!;
        expect(body.className).toContain('overflow-y-auto');
        // El cuadro no recorta: las listas desplegables pueden flotar por fuera.
        expect(dialog().className).not.toContain('overflow-hidden');
        expect(dialog().querySelector('footer [data-test="save"]')).not.toBeNull();
        wrapper.unmount();
    });

    it('applies the standard width for each size', async () => {
        const wrapper = mountModal({ size: 'sm' });
        await flushPromises();
        expect(dialog().className).toContain('sm:max-w-md');
        wrapper.unmount();
    });

    it('emits close when the X is clicked', async () => {
        const wrapper = mountModal();
        await flushPromises();

        (dialog().querySelector('[aria-label="Cerrar"]') as HTMLElement).click();
        await flushPromises();

        expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
        expect(wrapper.emitted('close')).toHaveLength(1);
        wrapper.unmount();
    });

    it('does not render a footer when there are no actions', async () => {
        const wrapper = mount(AppModal, {
            attachTo: document.body,
            props: { open: true, title: 'Detalle' },
            slots: { default: '<p>Solo lectura</p>' },
        });
        await flushPromises();

        expect(dialog().querySelector('footer')).toBeNull();
        wrapper.unmount();
    });

    it('focuses the first field when it opens, not the close button', async () => {
        const wrapper = mount(AppModal, {
            attachTo: document.body,
            props: { open: false, title: 'Editar proveedor' },
            slots: {
                default:
                    '<form><input data-test="name" /><input data-test="email" /></form>',
            },
        });
        await wrapper.setProps({ open: true });
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const close = dialog().querySelector('[aria-label="Cerrar"]');
        expect(document.activeElement).toBe(
            dialog().querySelector('[data-test="name"]'),
        );
        expect(document.activeElement).not.toBe(close);
        // El anillo de la X solo aparece al navegar con teclado.
        expect(close?.className).toContain('focus-visible:ring-2');
        expect(close?.className).not.toContain(' focus:ring-2');
        wrapper.unmount();
    });

    it('skips read-only fields and never outlines the whole dialog', async () => {
        const wrapper = mount(AppModal, {
            attachTo: document.body,
            props: { open: false, title: 'Editar variante' },
            slots: {
                default:
                    '<form><input data-test="stock" readonly /><input data-test="sku" /></form>',
            },
        });
        await wrapper.setProps({ open: true });
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.activeElement).toBe(
            dialog().querySelector('[data-test="sku"]'),
        );
        expect(dialog().className).toContain('outline-none');
        wrapper.unmount();
    });

    it('does not highlight the close button when it opens with nothing to type in (e.g. while loading)', async () => {
        const wrapper = mount(AppModal, {
            attachTo: document.body,
            props: { open: false, title: 'Editar Variante' },
            slots: { default: '<div role="status">Cargando...</div>' },
        });
        await wrapper.setProps({ open: true });
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.activeElement).not.toBe(
            dialog().querySelector('[aria-label="Cerrar"]'),
        );
        expect(document.activeElement).toBe(dialog());
        wrapper.unmount();
    });
});
