// @vitest-environment jsdom

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LoadingState from './LoadingState.vue';

const jsDir = resolve(__dirname, '../..');

const vueFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return vueFiles(path);
        return name.endsWith('.vue') ? [path] : [];
    });

const template = (source: string): string => {
    const start = source.indexOf('<template>');
    const end = source.lastIndexOf('</template>');
    return start === -1 || end === -1 ? '' : source.slice(start, end);
};

describe('LoadingState', () => {
    it('muestra el icono que gira y el texto, como estado accesible', () => {
        const wrapper = mount(LoadingState, {
            props: { label: 'Cargando productos...' },
        });

        expect(wrapper.attributes('role')).toBe('status');
        expect(wrapper.text()).toBe('Cargando productos...');
        expect(wrapper.find('svg.animate-spin').exists()).toBe(true);
    });

    it('usa "Cargando..." si no se indica texto', () => {
        expect(mount(LoadingState).text()).toBe('Cargando...');
    });

    it('ninguna pantalla arma su propio "Cargando…" en la plantilla', () => {
        // El texto de carga solo debe aparecer como label de <LoadingState> o dentro de una
        // expresión (por ejemplo, el texto de un botón mientras guarda).
        const offenders = ['pages', 'components'].flatMap((folder) =>
            vueFiles(join(jsDir, folder)).flatMap((file) =>
                template(readFileSync(file, 'utf8'))
                    .split('\n')
                    .map((line, index) => ({ line, number: index + 1 }))
                    .filter(({ line }) => />\s*Cargando|^\s*Cargando/.test(line))
                    .map(
                        ({ number }) =>
                            `${relative(jsDir, file).replace(/\\/g, '/')} (línea ${number} de la plantilla)`,
                    ),
            ),
        );

        expect(offenders).toEqual([]);
    });
});
