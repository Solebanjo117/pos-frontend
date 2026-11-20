// @vitest-environment jsdom

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.vue';

const jsDir = resolve(__dirname, '../..');
// Listas desplegables de buscadores y la cabecera del vehículo elegido: no son listas vacías de pantalla.
const ALLOWED = new Set([
    'components/AsyncProductCombobox.vue',
    'components/ProductCombobox.vue',
    'components/POS/VehicleContextHeader.vue',
]);
const EMPTY_TEXT =
    /^\s*(No hay|No se encontr|Sin resultados|Ningún|Ninguna|Aún no hay|Todavía no hay)/;

const vueFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return vueFiles(path);
        return name.endsWith('.vue') ? [path] : [];
    });

describe('EmptyState', () => {
    it('muestra el texto centrado con el estilo estándar', () => {
        const wrapper = mount(EmptyState, {
            slots: { default: 'No hay productos.' },
        });
        expect(wrapper.text()).toBe('No hay productos.');
        expect(wrapper.classes()).toEqual(
            expect.arrayContaining(['text-muted-foreground', 'py-10']),
        );
        expect(
            mount(EmptyState, { props: { compact: true } }).classes(),
        ).toContain('py-2');
    });

    it('ninguna pantalla arma su propio mensaje de "No hay…"', () => {
        const offenders = ['pages', 'components'].flatMap((folder) =>
            vueFiles(join(jsDir, folder)).flatMap((file) => {
                const rel = relative(jsDir, file).replace(/\\/g, '/');
                if (rel.startsWith('components/ui/') || ALLOWED.has(rel)) {
                    return [];
                }
                const source = readFileSync(file, 'utf8');
                const start = source.indexOf('<template>');
                if (start === -1) return [];
                const lines = source.slice(start).split('\n');

                return lines.flatMap((line, index) => {
                    const text = line.includes('>')
                        ? line.slice(line.lastIndexOf('>') + 1)
                        : line;
                    if (!EMPTY_TEXT.test(text)) return [];
                    // Debe estar dentro de <EmptyState> (en la misma línea o poco antes),
                    // o ser un texto de botón/opción, o el título (h2/h3) de un estado vacío
                    // completo con icono, explicación y botón de acción.
                    const context = lines
                        .slice(Math.max(0, index - 4), index + 1)
                        .join('\n');
                    if (
                        /<EmptyState\b|<option\b|<button\b|<h[23]\b/.test(
                            context,
                        )
                    ) {
                        return [];
                    }
                    return [`${rel}: ${text.trim()}`];
                });
            }),
        );

        expect(offenders).toEqual([]);
    });
});
