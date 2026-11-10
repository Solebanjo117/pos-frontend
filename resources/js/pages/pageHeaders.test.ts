import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Título de página estándar: text-2xl font-semibold tracking-tight text-foreground, y la descripción
 * justo debajo en text-sm text-muted-foreground. Quedan fuera los títulos de paneles del punto de
 * venta, el login, la barra compacta de la ficha de proveedor y los h1 solo para lectores de pantalla.
 */
const pagesDir = __dirname;
const EXCLUDED = new Set([
    'POS/Index.vue',
    'Welcome.vue',
    'Suppliers/Show.vue',
]);
const TITLE = [
    'text-2xl',
    'font-semibold',
    'tracking-tight',
    'text-foreground',
];
const OTHER_TYPOGRAPHY =
    /^(?:(?:sm|md|lg|xl|dark):)?(?:text-(?:xs|sm|base|lg|xl|3xl|4xl)|font-(?:bold|black|medium)|text-(?:gray|slate)-\d+|text-white)$/;

const vueFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return vueFiles(path);
        return name.endsWith('.vue') ? [path] : [];
    });

describe('títulos de página', () => {
    it('todas las páginas usan el mismo estilo de título', () => {
        const offenders = vueFiles(pagesDir).flatMap((file) => {
            const rel = relative(pagesDir, file).replace(/\\/g, '/');
            if (EXCLUDED.has(rel)) return [];
            const source = readFileSync(file, 'utf8');

            return [
                ...source.matchAll(/<h1\b[^>]*?(?<![:\w-])class="([^"]*)"/g),
            ]
                .map((match) => match[1].split(/\s+/))
                .filter((classes) => !classes.includes('sr-only'))
                .filter(
                    (classes) =>
                        !TITLE.every((c) => classes.includes(c)) ||
                        classes.some((c) => OTHER_TYPOGRAPHY.test(c)),
                )
                .map((classes) => `${rel}: ${classes.join(' ')}`);
        });

        expect(offenders).toEqual([]);
    });
});
