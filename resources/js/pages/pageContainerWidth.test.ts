import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El contenido de las páginas va dentro de una columna flex (SidebarInset). Ahí, un contenedor
 * con "mx-auto max-w-…" sin "w-full" se encoge al ancho de su contenido y cambia de ancho
 * cuando terminan de cargar los datos. Esta prueba evita que vuelva a pasar.
 */
const pagesDir = __dirname;

const vueFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return vueFiles(path);
        return name.endsWith('.vue') ? [path] : [];
    });

describe('ancho de los contenedores de página', () => {
    it('todo contenedor centrado con ancho máximo usa w-full', () => {
        const offenders = vueFiles(pagesDir).flatMap((file) =>
            readFileSync(file, 'utf8')
                .split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(
                    ({ line }) =>
                        /^\s*<(div|main|section)\s+class="mx-auto max-w-/.test(
                            line,
                        ) && !/\bw-full\b/.test(line),
                )
                .map(
                    ({ number }) =>
                        `${relative(pagesDir, file).replace(/\\/g, '/')}:${number}`,
                ),
        );

        expect(offenders).toEqual([]);
    });
});
