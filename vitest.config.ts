import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Vitest 3 bundles older Vite types, while the app runs Vite 8. The Vue
    // plugin is runtime-compatible; narrow the version-only type mismatch.
    plugins: [vue() as never],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['resources/js/**/*.test.ts'],
        setupFiles: ['./vitest.setup.ts'],
    },
});
