import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Decisión de Luis (2026-11-13): la Descripción del producto no es obligatoria
 * al crear ni al editar. Si se deja vacía, el backend la genera con la categoría
 * y la compatibilidad vehicular.
 */
const source = (file: string) => readFileSync(resolve(__dirname, file), 'utf8');

describe('Products: Descripción is optional', () => {
    for (const file of ['Create.vue', 'Edit.vue']) {
        it(`${file} does not mark Descripción as required`, () => {
            const page = source(file);

            expect(page).not.toMatch(
                /Descripción\s*<span class="text-red-500">\*<\/span>/,
            );

            const nameInput = page.match(
                /<input\s[^>]*v-model="form\.name"[^>]*>/,
            )?.[0];
            expect(nameInput, file).toBeDefined();
            expect(nameInput).not.toMatch(/\srequired[\s>]/);
        });
    }
});
