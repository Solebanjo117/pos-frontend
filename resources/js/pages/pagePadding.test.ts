import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El margen interior de las páginas es único y lo pone el layout (.app-page en app.css).
 * Las páginas no deben agregar su propio padding en el contenedor raíz; solo las de pantalla
 * completa, que se marcan con .app-page-full-bleed.
 */
const pagesDir = __dirname;
const jsDir = resolve(pagesDir, '..');
const PAGE_PADDING = /^(sm:|md:|lg:|xl:|2xl:)?(p|px)-\S+$/;
const NOT_PAGE_CONTAINER =
    /^(fixed|absolute|sticky|inset-\S+|rounded\S*|border\S*|bg-\S+|shadow\S*|z-\S+)$/;

const vueFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return vueFiles(path);
        return name.endsWith('.vue') ? [path] : [];
    });

/** Primer elemento dentro de <AppLayout> (o de la plantilla si usa el layout persistente). */
const rootElement = (source: string): string | null => {
    const persistent = /layout:\s*\[?AppLayout/.test(source);
    const appLayout = source.match(/<AppLayout\b[^>]*>/);
    if (!appLayout && !persistent) return null;
    const start = appLayout
        ? source.indexOf(appLayout[0]) + appLayout[0].length
        : source.indexOf('<template>') + '<template>'.length;
    const rest = source
        .slice(start)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<Head\b[^>]*\/>/g, '');
    return rest.match(/<[\w-]+\b[^>]*>/)?.[0] ?? null;
};

describe('padding de las páginas', () => {
    it('el layout envuelve las páginas en el contenedor estándar', () => {
        const layout = readFileSync(
            join(jsDir, 'layouts/app/AppSidebarLayout.vue'),
            'utf8',
        );
        const css = readFileSync(resolve(jsDir, '../css/app.css'), 'utf8');

        expect(layout).toMatch(/class="app-page\b[^"]*"[\s\S]*<slot \/>/);
        expect(css).toContain('.app-page:has(> .app-page-full-bleed)');
    });

    it('ninguna página pone su propio padding en el contenedor raíz', () => {
        const offenders = vueFiles(pagesDir).flatMap((file) => {
            const root = rootElement(readFileSync(file, 'utf8'));
            if (!root) return [];
            const classes =
                root.match(/(?<![:\w-])class="([^"]*)"/)?.[1].split(/\s+/) ??
                [];
            if (classes.includes('app-page-full-bleed')) return [];
            if (classes.some((c) => NOT_PAGE_CONTAINER.test(c))) return [];
            const padding = classes.filter((c) => PAGE_PADDING.test(c));
            return padding.length
                ? [
                      `${relative(pagesDir, file).replace(/\\/g, '/')}: ${padding.join(' ')}`,
                  ]
                : [];
        });

        expect(offenders).toEqual([]);
    });
});
