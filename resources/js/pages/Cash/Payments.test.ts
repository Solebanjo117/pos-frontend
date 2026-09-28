// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import Payments from '@/components/Finance/CashPaymentsReport.vue';
import apiClient from '@/services/api/client';

vi.mock('@/layouts/AppLayout.vue', () => ({ default: {} }));
vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<span />' },
    Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
}));
vi.mock('@/composables/useAuth', () => ({
    useAuth: () => ({ isAdmin: ref(true), isManager: ref(true) }),
}));
vi.mock('@/utils/formatters', () => ({
    formatCurrency: (value: number) => `$${value}`,
    formatReportDateTime: (value: string) => value,
}));
vi.mock('@/services/api/client', () => ({
    default: { get: vi.fn(), post: vi.fn() },
}));

const row = {
    id: 7,
    scope: 'sales',
    document_id: 9,
    document_number: 'SO-9',
    method: 'yappy',
    method_name: 'Yappy',
    liquidity_bucket: 'bank',
    amount: 25,
    financial_account_id: null,
    created_at: '2026-09-27',
    user_name: 'Caja',
};
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
        if (url === '/cash/payment-movements')
            return {
                data: {
                    data: [row],
                    last_page: 1,
                    filter_options: {
                        methods: [],
                        operators: [],
                        sessions: [],
                        warehouses: [{ id: 3, name: 'Sucursal' }],
                    },
                },
            } as any;
        if (url === '/cash/payment-summary')
            return {
                data: {
                    data: [
                        { method: 'yappy', incoming: 25, outgoing: 0, net: 25 },
                    ],
                },
            } as any;
        if (url === '/cash/availability')
            return {
                data: {
                    data: { initialized: true, balance: 100, warehouse_id: 3 },
                },
            } as any;
        return { data: { data: [{ endpoint_id: 4, name: 'Banco' }] } } as any;
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
});

it('links the original order and assigns a pending account in the displayed warehouse', async () => {
    const wrapper = mount(Payments);
    await flushPromises();
    expect(wrapper.find('a[href="/sales-orders/9"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Pendiente de asignar cuenta');
    const vm = wrapper.vm as any;
    vm.accountSelection['sales-7'] = 4;
    await vm.assign(row);
    expect(apiClient.post).toHaveBeenCalledWith(
        '/cash/payments/sales/7/account',
        { financial_account_id: 4, warehouse_id: 3 },
    );
    wrapper.unmount();
});

it('clears prior branch balances and rows when a filtered request fails', async () => {
    const wrapper = mount(Payments);
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.filters.warehouse_id = '8';
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network'));
    await vm.load();
    expect(vm.rows).toEqual([]);
    expect(vm.summary).toEqual([]);
    expect(vm.availability).toBeNull();
    expect(wrapper.text()).toContain('No se pudieron cargar los movimientos.');
    wrapper.unmount();
});
