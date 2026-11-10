// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import Index from './Index.vue';

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div />' },
    router: { visit: vi.fn() },
}));

vi.mock('@/layouts/AppLayout.vue', () => ({
    default: { template: '<div><slot /></div>' },
}));

vi.mock('@/components/Traceability/InventoryMovementDrawer.vue', () => ({
    default: { template: '<div />' },
}));

vi.mock('@/composables/useInventoryMovements', () => ({
    useInventoryMovements: () => ({
        movements: ref([]),
        fetchMovements: vi.fn().mockResolvedValue(undefined),
        loading: ref(false),
        error: ref(null),
        currentPage: ref(1),
        lastPage: ref(1),
        total: ref(0),
    }),
}));

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({
        isSingleWarehouseMode: () => true,
        fetchSettings: vi.fn().mockResolvedValue(undefined),
        currentWarehouseId: ref(1),
        initWarehouse: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('@/services/api/client', () => ({
    default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}));

describe('Movimientos de inventario', () => {
    it('no ofrece registrar entradas ni transferencias, pero sí salidas', async () => {
        const wrapper = mount(Index);
        await flushPromises();

        const hrefs = wrapper
            .findAll('a')
            .map((link) => link.attributes('href'));
        expect(hrefs).not.toContain('/inventory/movements/inbound/create');
        expect(hrefs).not.toContain('/inventory/movements/transfer/create');
        expect(hrefs).toContain('/inventory/movements/outbound/create');
    });
});
