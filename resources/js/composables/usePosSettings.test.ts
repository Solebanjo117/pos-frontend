// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePosSettings } from './usePosSettings';

const mocks = vi.hoisted(() => ({
    getWarehouseContext: vi.fn(),
    getSettings: vi.fn(),
    setWarehouseContext: vi.fn(),
}));

vi.mock('@/services/api/pos', () => ({
    posService: mocks,
}));

describe('warehouse context initialization', () => {
    beforeEach(() => {
        mocks.getWarehouseContext.mockReset();
        mocks.getSettings.mockReset();
        mocks.setWarehouseContext.mockReset();
        localStorage.clear();
        usePosSettings().currentWarehouseId.value = null;
        usePosSettings().settings.value = null;
        usePosSettings().error.value = null;
    });

    it('does not select the first allowed warehouse without an active context', async () => {
        mocks.getWarehouseContext.mockResolvedValue({
            current_warehouse_id: null,
            allowed_warehouses: [
                { id: 1, name: 'Uno' },
                { id: 2, name: 'Dos' },
            ],
        });
        mocks.getSettings.mockResolvedValue({
            single_warehouse_mode: false,
            default_warehouse_id: 1,
        });

        await usePosSettings().initWarehouse();

        expect(usePosSettings().currentWarehouseId.value).toBeNull();
        expect(mocks.setWarehouseContext).not.toHaveBeenCalled();
        expect(usePosSettings().error.value).toContain(
            'No tienes una sucursal asignada',
        );
    });

    it('does not restore a stale local warehouse when context lookup fails', async () => {
        localStorage.setItem('pos_current_warehouse_id', '2');
        mocks.getWarehouseContext.mockRejectedValue(new Error('Sin conexión'));

        await usePosSettings().initWarehouse();

        expect(usePosSettings().currentWarehouseId.value).toBeNull();
        expect(localStorage.getItem('pos_current_warehouse_id')).toBeNull();
        expect(mocks.setWarehouseContext).not.toHaveBeenCalled();
        expect(usePosSettings().error.value).toContain(
            'No se pudo verificar la sucursal',
        );
    });
    it('uses only the configured default in single-warehouse mode', async () => {
        mocks.getWarehouseContext.mockResolvedValue({
            current_warehouse_id: null,
            allowed_warehouses: [
                { id: 1, name: 'Uno' },
                { id: 2, name: 'Dos' },
            ],
        });
        mocks.getSettings.mockResolvedValue({
            single_warehouse_mode: true,
            default_warehouse_id: 2,
        });

        await usePosSettings().initWarehouse();

        expect(mocks.setWarehouseContext).toHaveBeenCalledWith(2);
        expect(usePosSettings().currentWarehouseId.value).toBe(2);
    });
});
