// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import apiClient from '@/services/api/client';
import CashDepositPanel from './CashDepositPanel.vue';

vi.mock('@inertiajs/vue3', () => ({
    Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
}));
vi.mock('@/composables/useAuth', () => ({
    useAuth: () => ({ isAdmin: ref(true) }),
}));
vi.mock('@/utils/formatters', () => ({
    formatCurrency: (value: number) => `$${value}`,
    formatReportDateTime: (value: string) => value,
}));
vi.mock('@/services/api/client', () => ({
    default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('@/components/ui/button', () => ({
    Button: { template: '<button><slot /></button>' },
}));
vi.mock('@/components/ui/dialog', () => {
    const slot = { template: '<div><slot /></div>' };
    return {
        Dialog: {
            props: ['open'],
            template: '<div v-if="open" role="dialog"><slot /></div>',
        },
        DialogContent: slot,
        DialogDescription: slot,
        DialogFooter: slot,
        DialogHeader: slot,
        DialogTitle: slot,
    };
});
const sourceResult = () => ({
    data: [
        {
            id: 9,
            scope: 'sales',
            document_number: 'SO-9',
            business_datetime: '2026-10-02T17:00:00Z',
            amount: 100,
            deposited: 40,
            remaining: 60,
        },
    ],
    summary: { collected: 100, deposited: 40, remaining: 60 },
    availability: { initialized: true, balance: 50 },
    warehouse: { id: 3, name: 'Sucursal Centro' },
    currency: 'USD',
    warnings: [] as string[],
    meta: { last_page: 1 },
});
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
        url === '/cash/deposit-sources'
            ? ({ data: sourceResult() } as any)
            : ({
                  data: {
                      data: [
                          {
                              endpoint_id: 1,
                              account_type: 'bank',
                              name: 'Banco USD',
                              currency: 'USD',
                          },
                          {
                              endpoint_id: 2,
                              account_type: 'bank',
                              name: 'Banco EUR',
                              currency: 'EUR',
                          },
                      ],
                  },
              } as any),
    );
    vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: { id: 5, folio: 'TRF-5' } },
    });
});
async function ready() {
    const wrapper = mount(CashDepositPanel, {
        props: { warehouseId: 3, dateFrom: '2026-10-01', dateTo: '2026-10-04' },
    });
    await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Seleccionar cobros')!
        .trigger('click');
    await flushPromises();
    await wrapper.find('select').setValue('1');
    return wrapper;
}
it('loads the applied range and separates remaining receipts from physical cash', async () => {
    const wrapper = await ready();
    expect(apiClient.get).toHaveBeenCalledWith('/cash/deposit-sources', {
        params: {
            warehouse_id: 3,
            date_from: '2026-10-01',
            date_to: '2026-10-04',
            page: 1,
        },
    });
    expect(wrapper.text()).toContain('$60');
    expect(wrapper.text()).toContain('$50');
    expect(wrapper.text()).not.toContain('Banco EUR');
    expect(apiClient.post).not.toHaveBeenCalled();
});
it('blocks over-allocation, spent cash and extra decimals', async () => {
    const wrapper = await ready();
    for (const amount of ['61', '51', '40.001']) {
        await wrapper.find('input[type="number"]').setValue(amount);
        expect(
            wrapper
                .findAll('button')
                .find((button) => button.text() === 'Revisar depósito')!
                .attributes('disabled'),
        ).toBeDefined();
    }
    await wrapper.find('input[type="number"]').setValue('40');
    expect(
        wrapper
            .findAll('button')
            .find((button) => button.text() === 'Revisar depósito')!
            .attributes('disabled'),
    ).toBeUndefined();
});
it('requires confirmation and sends a partial allocation once while saving', async () => {
    const wrapper = await ready();
    await wrapper.find('input[type="number"]').setValue('40');
    await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Revisar depósito')!
        .trigger('click');
    expect(wrapper.find('[role="dialog"]').text()).toContain('Sucursal Centro');
    expect(wrapper.find('[role="dialog"]').text()).toContain('Banco USD');
    expect(apiClient.post).not.toHaveBeenCalled();
    let resolve!: (value: any) => void;
    vi.mocked(apiClient.post).mockReturnValue(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const vm = wrapper.vm as any;
    const first = vm.deposit();
    await vm.deposit();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
        '/cash/deposits',
        expect.objectContaining({
            amount: 40,
            warehouse_id: 3,
            financial_account_id: 1,
            allocations: [{ scope: 'sales', id: 9, amount: 40 }],
            idempotency_key: expect.any(String),
        }),
    );
    resolve({ data: { data: { id: 5, folio: 'TRF-5' } } });
    await first;
    await flushPromises();
    expect(wrapper.emitted('deposited')).toHaveLength(1);
    expect(wrapper.find('a[href="/finance/transfers/5"]').exists()).toBe(true);
});
it('keeps the idempotency key after a network failure for a safe retry', async () => {
    const wrapper = await ready();
    await wrapper.find('input[type="number"]').setValue('40');
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network'));
    await (wrapper.vm as any).deposit();
    const firstKey = vi.mocked(apiClient.post).mock.calls[0][1] as any;
    expect(wrapper.find('[role="alert"]').text()).toContain('reintentar');
    await (wrapper.vm as any).deposit();
    expect(
        (vi.mocked(apiClient.post).mock.calls[1][1] as any).idempotency_key,
    ).toBe(firstKey.idempotency_key);
});
it('clears selection and reloads when the branch or range changes', async () => {
    const wrapper = await ready();
    await wrapper.find('input[type="number"]').setValue('40');
    await wrapper.setProps({ warehouseId: 4, dateFrom: '2026-09-01' });
    await flushPromises();
    expect((wrapper.vm as any).allocations).toEqual([]);
    expect(apiClient.get).toHaveBeenCalledWith('/cash/deposit-sources', {
        params: expect.objectContaining({
            warehouse_id: 4,
            date_from: '2026-09-01',
        }),
    });
});

it('disables historical collections requiring reconciliation and displays only eligible remnants', async () => {
    const result = sourceResult();
    Object.assign(result.data[0], { requires_reconciliation: true });
    Object.assign(result.summary, {
        blocked_remaining: 60,
        available_for_deposit: 0,
    });
    result.warnings = ['Hay depósitos anteriores sin asignación a cobros.'];
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: result } as any);
    const wrapper = await ready();
    expect(
        wrapper.find('input[type="number"]').attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.text()).toContain('Requiere conciliación');
    expect(wrapper.text()).toContain('Hay depósitos anteriores');
    (wrapper.vm as any).amounts = { 'sales-9': 40 };
    await flushPromises();
    await (wrapper.vm as any).deposit();
    expect(apiClient.post).not.toHaveBeenCalled();
});
