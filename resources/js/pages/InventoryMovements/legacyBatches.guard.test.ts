import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * 2026-11-18: se quitó el sistema viejo de "lotes de producción" (product_batches, selector de lote y
 * "seguimiento por lote"). Nunca tuvo datos. Los lotes reales son los FIFO: el sistema decide de qué
 * lote sale cada unidad, y el número de lote se escribe solo al registrar una entrada.
 */
const jsDir = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(jsDir, path), 'utf8');

describe('Inventory: no legacy production batches', () => {
    it('does not ask for a batch on outbound or transfer movements', () => {
        for (const path of [
            'pages/InventoryMovements/CreateOutbound.vue',
            'pages/InventoryMovements/CreateTransfer.vue',
            'pages/InventoryMovements/CreateInbound.vue',
            'pages/InventoryMovements/Index.vue',
            'pages/InventoryMovements/Show.vue',
            'composables/useProducts.ts',
            'services/api/products.ts',
            'types/product.ts',
            'types/inventory-movement.ts',
        ]) {
            const text = source(path);
            expect(text, path).not.toContain('product_batch');
            expect(text, path).not.toContain('batch_tracking');
            expect(text, path).not.toContain('fetchBatches');
        }
    });

    it('keeps the lot number on inbound movements (FIFO lots)', () => {
        expect(source('pages/InventoryMovements/CreateInbound.vue')).toContain(
            'batch_number',
        );
    });

    it('removed the dead batch pages', () => {
        expect(existsSync(resolve(jsDir, 'pages/Inventory/Batches.vue'))).toBe(
            false,
        );
        expect(existsSync(resolve(jsDir, 'pages/Inventory/Index.vue'))).toBe(
            false,
        );
    });
});
