import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Pedido de Luis (2026-11-26): por ahora se trabaja con un solo almacén, así que la tabla de marcas
 * de Editar producto no dice "Stock (Almacén Principal)", y tampoco se nombra el almacén en la
 * ventana de la marca ni al ajustar. Vuelve a verse con MULTI_WAREHOUSE_ENABLED.
 */
const manager = readFileSync(resolve(__dirname, 'VariantManager.vue'), 'utf8');

describe('Edit product brands: one warehouse', () => {
    it('names the warehouse only when several warehouses are enabled', () => {
        expect(manager).toContain(
            'if (!multiWarehouse || !currentWarehouseId.value) return',
        );
        expect(manager).toContain('v-if="editingVariant && multiWarehouse"');
        expect(manager).toMatch(
            /multiWarehouse &&\s+variant\.inventory\?\.length > 1/,
        );
    });
});
