import { describe, expect, it } from 'vitest';
import { MULTI_WAREHOUSE_ENABLED } from './features';

describe('interruptores de funciones', () => {
    it('por defecto se trabaja con un solo almacén', () => {
        // Sin VITE_MULTI_WAREHOUSE=true en .env, la interfaz de varios almacenes queda oculta.
        expect(MULTI_WAREHOUSE_ENABLED).toBe(false);
    });
});
