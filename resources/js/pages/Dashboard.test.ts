// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import Dashboard from './Dashboard.vue';

const mocks = vi.hoisted(() => ({
    fetchDashboardData: vi.fn(),
    getAllWarehouses: vi.fn(),
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div />' },
    router: { visit: vi.fn() },
}));

vi.mock('@/layouts/AppLayout.vue', () => ({
    default: { template: '<div><slot /></div>' },
}));

vi.mock('@/routes', () => ({ dashboard: () => ({ url: '/dashboard' }) }));

vi.mock('vue-chartjs', () => ({ Doughnut: { template: '<div />' } }));

vi.mock('@/components/dashboard/SalesChart.vue', () => ({
    default: { template: '<div />' },
}));

vi.mock('@/composables/useDashboard', () => ({
    useDashboard: () => ({
        stats: ref({}),
        chartData: ref(null),
        topProducts: ref([]),
        lowStockProducts: ref([]),
        financial: ref(null),
        loading: ref(false),
        error: ref(null),
        fetchDashboardData: mocks.fetchDashboardData,
    }),
}));

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({
        currentWarehouseId: ref(1),
        initWarehouse: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('@/services/warehouses', () => ({
    default: { getAllWarehouses: mocks.getAllWarehouses },
}));

describe('Inicio (un solo almacén)', () => {
    it('no muestra el selector ni el nombre del almacén, pero usa el almacén actual', async () => {
        mocks.fetchDashboardData.mockResolvedValue(undefined);
        mocks.getAllWarehouses.mockResolvedValue([
            { id: 1, name: 'Almacén principal' },
        ]);

        const wrapper = mount(Dashboard);
        await flushPromises();

        expect(
            wrapper.find('[data-testid="dashboard-warehouse-filter"]').exists(),
        ).toBe(false);
        expect(wrapper.text()).not.toContain('Almacén principal');
        expect(
            wrapper.get('[data-testid="dashboard-period-title"]').text(),
        ).toBe('Resumen del periodo');
        expect(mocks.getAllWarehouses).not.toHaveBeenCalled();
        expect(mocks.fetchDashboardData).toHaveBeenCalledWith(
            expect.objectContaining({ warehouse_id: 1 }),
        );
    });
});
