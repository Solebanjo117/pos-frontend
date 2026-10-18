// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionsIndex from './Index.vue';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    initWarehouse: vi.fn(),
    getWarehouseContext: vi.fn(),
    role: 'seller',
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div />' },
    Link: {
        props: ['href'],
        template: '<a :href="href"><slot /></a>',
    },
    usePage: () => ({
        url: '/transactions',
        props: { auth: { user: { role: mocks.role } } },
    }),
}));

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({
        currentWarehouseId: { __v_isRef: true, value: 1 },
        initWarehouse: mocks.initWarehouse,
    }),
}));

vi.mock('@/services/api/pos', () => ({
    posService: { getWarehouseContext: mocks.getWarehouseContext },
}));

vi.mock('@/services/transactions', () => ({
    transactionsService: { list: mocks.list },
}));

vi.mock('@/services/sales-quotes', () => ({
    SalesQuotesApiService: {
        transition: vi.fn(),
        convert: vi.fn(),
        delete: vi.fn(),
    },
}));

const response = {
    data: [
        {
            key: 'order:10',
            type: 'order',
            id: 10,
            number: 'OV-10',
            date: '2026-09-27',
            customer_id: 1,
            customer_name: 'Cliente',
            seller_name: 'Vendedor',
            warehouse_id: null,
            status: 'pending',
            status_label: 'Pendiente',
            total: '100.00',
            amount_due: 40,
            payment_status: 'pending',
            linked_quote: {
                id: 4,
                number: 'COT-4',
                status: 'sent_to_deposit',
                status_label: 'En depósito',
            },
            actions: ['view', 'continue_quote'],
        },
        {
            key: 'quote:5',
            type: 'quote',
            id: 5,
            number: 'COT-5',
            date: '2026-09-27',
            customer_id: null,
            customer_name: null,
            seller_name: 'Vendedor',
            warehouse_id: 1,
            status: 'draft',
            status_label: 'Borrador',
            total: '25.00',
            amount_due: null,
            payment_status: null,
            linked_quote: null,
            actions: ['view', 'edit'],
        },
    ],
    total: 2,
    current_page: 1,
    last_page: 1,
    per_page: 15,
    metrics: {
        total_transactions: 2,
        orders: 1,
        quotes: 1,
        pending: 2,
        order_amount: '100.00',
        quote_amount: '25.00',
    },
};

describe('Transactions index', () => {
    beforeEach(() => {
        mocks.initWarehouse.mockResolvedValue(undefined);
        mocks.list.mockResolvedValue(response);
        mocks.getWarehouseContext.mockResolvedValue({
            current_warehouse_id: 1,
            allowed_warehouses: [
                { id: 1, name: 'Sucursal Uno' },
                { id: 2, name: 'Sucursal Dos' },
            ],
        });
        mocks.role = 'seller';
        window.history.replaceState({}, '', '/transactions');
    });

    it('shows a linked order once with its original quote and continues through the quote', async () => {
        const wrapper = mount(TransactionsIndex);
        await flushPromises();

        expect(mocks.list).toHaveBeenCalledWith(
            expect.objectContaining({ warehouse_id: 1, type: 'all' }),
        );
        expect(wrapper.findAll('tbody tr')).toHaveLength(2);
        expect(wrapper.text()).toContain('OV-10');
        expect(wrapper.text()).toContain('COT-4');
        expect(wrapper.text()).toContain('COT-5');
        expect(wrapper.find('a[href="/sales-quotes/4"]').exists()).toBe(true);
        expect(wrapper.find('a[href="/sales-orders/10/edit"]').exists()).toBe(
            false,
        );
        expect(wrapper.text()).toContain('Importe en órdenes');
        expect(wrapper.text()).toContain('100.00');
    });

    it('lets an admin filter an authorized warehouse without changing global context', async () => {
        mocks.role = 'admin';
        const wrapper = mount(TransactionsIndex);
        await flushPromises();

        const selector = wrapper.find('select[aria-label="Sucursal"]');
        expect(selector.exists()).toBe(true);
        await selector.setValue('2');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(mocks.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ warehouse_id: 2 }),
        );
        expect(window.location.search).toContain('warehouse_id=2');
    });
    it('applies the quote tab to the server request', async () => {
        const wrapper = mount(TransactionsIndex);
        await flushPromises();
        await wrapper
            .findAll('button')
            .find((button) => button.text() === 'Cotizaciones')
            ?.trigger('click');
        await flushPromises();

        expect(mocks.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'quote', page: 1 }),
        );
    });

    it.each(['admin', 'manager', 'seller', 'buyer', 'assistant'])(
        'removes new order and keeps quote creation within permissions for %s',
        async (role) => {
            mocks.role = role;
            const wrapper = mount(TransactionsIndex);
            await flushPromises();

            expect(
                wrapper.find('a[href="/sales-orders/create"]').exists(),
            ).toBe(false);
            expect(wrapper.text()).not.toContain('Nueva orden');
            const quoteLink = wrapper.find('a[href="/quotes/create"]');
            expect(quoteLink.exists()).toBe(
                ['admin', 'manager', 'seller'].includes(role),
            );
            if (quoteLink.exists())
                expect(quoteLink.text()).toBe('Nueva cotización');
            wrapper.unmount();
        },
    );
});
