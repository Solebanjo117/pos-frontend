// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePosSettings } from '@/composables/usePosSettings';
import AppSidebarHeader from './AppSidebarHeader.vue';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@inertiajs/vue3', () => ({
    usePage: () => ({ url: '/transactions' }),
}));

vi.mock('@/services/api/client', () => ({
    default: { get: mocks.get },
}));

describe('AppSidebarHeader warehouse notice', () => {
    beforeEach(() => {
        mocks.get.mockReset();
        usePosSettings().currentWarehouseId.value = null;
    });

    it('shows a non-interactive assignment notice without an active warehouse', async () => {
        mocks.get.mockResolvedValue({
            data: {
                current_warehouse_id: null,
                allowed_warehouses: [{ id: 1, name: 'Sucursal Uno' }],
            },
        });
        const wrapper = mount(AppSidebarHeader, {
            global: { stubs: { Breadcrumbs: true, SidebarTrigger: true } },
        });
        await flushPromises();

        expect(wrapper.text()).toContain(
            'Solicita la asignación a un administrador',
        );
        expect(wrapper.find('select').exists()).toBe(false);
        expect(mocks.get).toHaveBeenCalledWith('/user/warehouse-context');
    });

    it('clears a stale notice when single-warehouse initialization sets the active context', async () => {
        mocks.get.mockResolvedValue({
            data: {
                current_warehouse_id: null,
                allowed_warehouses: [{ id: 2, name: 'Dos' }],
            },
        });
        const wrapper = mount(AppSidebarHeader, {
            global: { stubs: { Breadcrumbs: true, SidebarTrigger: true } },
        });
        await flushPromises();
        expect(wrapper.text()).toContain('Solicita la asignación');

        usePosSettings().currentWarehouseId.value = 2;
        await flushPromises();

        expect(wrapper.text()).not.toContain('Solicita la asignación');
    });
    it('does not show the notice when the user has an active warehouse', async () => {
        mocks.get.mockResolvedValue({
            data: { current_warehouse_id: 1, allowed_warehouses: [] },
        });
        const wrapper = mount(AppSidebarHeader, {
            global: { stubs: { Breadcrumbs: true, SidebarTrigger: true } },
        });
        await flushPromises();

        expect(wrapper.text()).not.toContain('Solicita la asignación');
        expect(wrapper.find('select').exists()).toBe(false);
    });
});
