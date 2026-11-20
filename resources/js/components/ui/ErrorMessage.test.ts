// @vitest-environment jsdom

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ErrorMessage from './ErrorMessage.vue';

const jsDir = resolve(__dirname, '../..');

const vueFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return vueFiles(path);
        return name.endsWith('.vue') ? [path] : [];
    });

describe('ErrorMessage', () => {
    it('muestra el mensaje como alerta, con icono y el color de error del tema', () => {
        const wrapper = mount(ErrorMessage, {
            slots: { default: 'No se pudo guardar.' },
        });

        expect(wrapper.attributes('role')).toBe('alert');
        expect(wrapper.text()).toBe('No se pudo guardar.');
        expect(wrapper.classes()).toContain('text-destructive');
        expect(wrapper.find('svg').exists()).toBe(true);
    });

    it('ninguna pantalla arma su propio cuadro de error', () => {
        // Un div/p/section con fondo rojo claro que muestra una variable de error debe ser <ErrorMessage>.
        const offenders = ['pages', 'components'].flatMap((folder) =>
            vueFiles(join(jsDir, folder)).flatMap((file) => {
                const rel = relative(jsDir, file).replace(/\\/g, '/');
                if (rel.startsWith('components/ui/')) return [];
                const source = readFileSync(file, 'utf8');

                return [
                    ...source.matchAll(
                        /<(div|p|section)\b[^>]*?(?<![:\w-])class="([^"]*\bbg-(?:red-50|red-100|destructive\/\d+)\b[^"]*)"[^>]*>([\s\S]{0,300}?)<\/\1>/g,
                    ),
                ]
                    .filter(
                        ([, , classes, body]) =>
                            !classes.includes('rounded-full') &&
                            /\{\{\s*[\w.]*[eE]rror/.test(body) &&
                            !/<(button|a|Button|Link)\b/.test(body),
                    )
                    .map(([, , classes]) => `${rel}: ${classes}`);
            }),
        );

        expect(offenders).toEqual([]);
    });
});
