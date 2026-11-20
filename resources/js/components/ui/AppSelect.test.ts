// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import AppSelect from './AppSelect.vue';

const options = [
    { value: undefined, label: 'Todos' },
    { value: 'out_of_stock', label: 'Sin stock' },
    { value: 'low_stock', label: 'Stock bajo' },
];

describe('AppSelect', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('shows "Todos" for an empty value and emits the original option value', async () => {
        const wrapper = mount(AppSelect, {
            attachTo: document.body,
            props: { options, modelValue: undefined },
        });

        expect(wrapper.get('button').text()).toContain('Todos');

        await wrapper.get('button').trigger('click');
        await flushPromises();
        const items = document.body.querySelectorAll('li[role="option"]');
        (items[2] as HTMLElement).click();

        expect(wrapper.emitted('update:modelValue')).toEqual([['low_stock']]);
        // Lista corta: sin buscador.
        expect(document.body.querySelector('[role="listbox"] input')).toBeNull();
        wrapper.unmount();
    });

    it('keeps numeric values and treats null, undefined and "" as the same empty choice', async () => {
        const wrapper = mount(AppSelect, {
            props: {
                options: [
                    { value: '', label: 'Todas' },
                    { value: 7, label: 'Bosch' },
                ],
                modelValue: null,
            },
        });
        expect(wrapper.get('button').text()).toContain('Todas');

        await wrapper.setProps({ modelValue: '7' });
        expect(wrapper.get('button').text()).toContain('Bosch');
    });

    it('adds a search box when there are many options and skips disabled ones', async () => {
        const many = Array.from({ length: 10 }, (_, i) => ({
            value: i,
            label: `Opción ${i}`,
        }));
        const wrapper = mount(AppSelect, {
            attachTo: document.body,
            props: {
                options: [
                    { value: '', label: 'Elige una', disabled: true },
                    ...many,
                ],
                modelValue: '',
                placeholder: 'Elige una',
            },
        });

        await wrapper.get('button').trigger('click');
        await flushPromises();
        expect(
            document.body.querySelector('[role="listbox"] input'),
        ).not.toBeNull();
        expect(
            document.body.querySelectorAll('li[role="option"]'),
        ).toHaveLength(10);
        wrapper.unmount();
    });

    it('no screen uses a native <select> any more', () => {
        const jsDir = resolve(__dirname, '../..');
        // Excepción: editor de celdas de la vista previa del importador (borde rojo dinámico por error).
        const allowed = new Set(['components/Import/UniversalImporter.vue']);
        const vueFiles = (dir: string): string[] =>
            readdirSync(dir).flatMap((name) => {
                const path = join(dir, name);
                if (statSync(path).isDirectory()) return vueFiles(path);
                return name.endsWith('.vue') ? [path] : [];
            });

        const offenders = ['pages', 'components']
            .flatMap((folder) => vueFiles(join(jsDir, folder)))
            .map((file) => relative(jsDir, file).split('\\').join('/'))
            .filter((rel) => !rel.startsWith('components/ui/') && !allowed.has(rel))
            .filter((rel) => /<select[\s>]/.test(readFileSync(join(jsDir, rel), 'utf8')));

        expect(offenders).toEqual([]);
    });
});

