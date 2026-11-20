import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Botón principal estándar: color del tema (bg-primary text-primary-foreground): negro en modo
 * claro y dorado en modo oscuro. Ningún botón o enlace debe usar un fondo de color propio con texto
 * blanco (azul, índigo, verde, negro…). Los rojos de eliminar y los de contorno no cuentan.
 */
const jsDir = resolve(__dirname, '..');
const OWN_PRIMARY =
    /\bbg-(?:indigo|blue|emerald|green|teal|sky|violet)-(?:500|600|700)\b|\bbg-(?:slate|gray|zinc|neutral)-(?:800|900|950)(?![\w/])|\bbg-black(?![\w/])/;
// (bg-black/50 y similares son los botones translúcidos sobre las fotos: no son botones principales.)

const vueFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return vueFiles(path);
        return name.endsWith('.vue') ? [path] : [];
    });

describe('botones principales', () => {
    it('usan el color del tema, no un color propio', () => {
        const offenders = ['pages', 'components'].flatMap((folder) =>
            vueFiles(join(jsDir, folder)).flatMap((file) => {
                const rel = relative(jsDir, file).replace(/\\/g, '/');
                if (rel.startsWith('components/ui/')) return [];
                const source = readFileSync(file, 'utf8');

                return [
                    ...source.matchAll(
                        /<(?:button|a|Link)\b(?:[^>"']|"[^"]*"|'[^']*')*?(?<![:@\w-])class="([^"]*)"/g,
                    ),
                ]
                    .map((match) => match[1])
                    .filter(
                        (classes) =>
                            OWN_PRIMARY.test(classes) &&
                            /\btext-white\b/.test(classes),
                    )
                    .map((classes) => `${rel}: ${classes}`);
            }),
        );

        expect(offenders).toEqual([]);
    });
});
