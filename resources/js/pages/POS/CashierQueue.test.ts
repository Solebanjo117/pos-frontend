// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashierQueue from './CashierQueue.vue';

const mocks = vi.hoisted(() => ({
    entries: { __v_isRef: true, value: [] as any[] },
    loading: { __v_isRef: true, value: false },
    error: { __v_isRef: true, value: null as string | null },
    fetchPending: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    openEntry: vi.fn(),
    completeEntry: vi.fn(),
    removeSaleFromQueue: vi.fn(),
    loadQuoteAsSession: vi.fn(),
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    visit: vi.fn(),
}));

vi.mock('@/composables/useCashierQueue', () => ({
    useCashierQueue: () => ({
        entries: mocks.entries,
        count: { __v_isRef: true, value: mocks.entries.value.length },
        loading: mocks.loading,
        error: mocks.error,
        fetchPending: mocks.fetchPending,
        startPolling: mocks.startPolling,
        stopPolling: mocks.stopPolling,
        timeAgo: () => '14s',
        openEntry: mocks.openEntry,
        completeEntry: mocks.completeEntry,
        removeSaleFromQueue: mocks.removeSaleFromQueue,
    }),
}));

vi.mock('@/composables/usePOS', () => ({
    usePOS: () => ({ loadQuoteAsSession: mocks.loadQuoteAsSession }),
}));

vi.mock('@/services/api/client', () => ({
    default: { get: mocks.apiGet, post: mocks.apiPost },
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div />' },
    router: { visit: mocks.visit },
}));

const global = {
    stubs: {
        TransactionTraceDrawer: {
            props: ['open', 'type', 'id'],
            template:
                '<div data-test="trace-drawer" :data-open="String(open)" :data-id="String(id)" />',
        },
    },
};

const entry = {
    id: 8,
    entry_type: 'sale_collection',
    status: 'pending',
    warehouse_id: 2,
    estimated_amount: 10,
    final_amount: null,
    scheduled_for: '2026-08-25T10:00:00Z',
    opened_by: null,
    opened_at: null,
    source: {
        id: 19,
        document_number: '0000000269',
        order_number: '0000000270',
        description: 'Venta',
        party: 'Publico general',
        amount: 10,
        seller_name: 'Admin',
        preparation_status: 'pending',
        items: [
            {
                id: 31,
                product_id: 4,
                variant_id: 5,
                product_name: 'Filtro de aceite',
                product_sku: 'FIL-1',
                quantity: 1,
            },
        ],
    },
};

const quote = {
    id: 19,
    quote_number: '0000000269',
    warehouse_id: 2,
    customer: { id: 3 },
    user: { id: 7 },
    notes: 'Entregar hoy',
    subtotal: 10,
    tax_amount: 0,
    discount_amount: 0,
    total: 10,
    items: [
        {
            id: 31,
            product_id: 4,
            product_name: 'Filtro de aceite',
            product_sku: 'FIL-1',
            variant_id: 5,
            warehouse_id: 2,
            quantity: 1,
            unit_price: 10,
            discount_percent: 0,
            tax_percent: 0,
            subtotal: 10,
            tax_amount: 0,
            total: 10,
        },
    ],
};

const quoteSummary = {
    id: 19,
    quote_number: '0000000269',
    customer_name: 'Publico general',
    seller_name: 'Admin',
    notes: 'Entregar hoy',
    subtotal: 10,
    tax_amount: 0.7,
    discount_amount: 1,
    total: 9.7,
    items: [
        {
            id: 31,
            product_name: 'Filtro de aceite',
            sku: 'FIL-1',
            brand: 'Marca prueba',
            quantity: 1,
            unit_price: 10,
            subtotal: 10,
            total: 10.7,
        },
    ],
};

function mountQueue() {
    return mount(CashierQueue, { global });
}

describe('CashierQueue sale table and POS handoff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.entries.value = [entry];
        mocks.apiGet.mockImplementation((url: string) =>
            url.includes('/summary')
                ? Promise.resolve({ data: { data: quoteSummary } })
                : Promise.resolve({ data: [] }),
        );
        mocks.apiPost.mockResolvedValue({ data: { data: quote } });
        mocks.openEntry.mockResolvedValue(entry);
        mocks.removeSaleFromQueue.mockResolvedValue(undefined);
    });

    it('renders Ver, Cobrar, Rastrear and Quitar in that order', async () => {
        const wrapper = mountQueue();
        await flushPromises();

        expect(wrapper.get('[data-test="sales-queue-table"]').text()).toContain(
            'Fecha / Hora',
        );
        expect(wrapper.text()).toContain('N.º factura');
        expect(wrapper.text()).toContain('Cliente');
        expect(wrapper.text()).toContain('Monto');
        expect(wrapper.text()).toContain('Vendedor');
        expect(wrapper.text()).toContain('Tiempo');
        expect(wrapper.text()).toContain('Acciones');
        expect(wrapper.text()).toContain('0000000269');
        expect(wrapper.findAll('[data-test="sales-queue-row"]')).toHaveLength(
            1,
        );
        expect(
            wrapper.findAll('[data-test="sales-queue-mobile-row"]'),
        ).toHaveLength(1);
        const desktopActions = wrapper
            .get('[data-test="sale-actions"]')
            .findAll('button')
            .map((button) => button.attributes('title'));
        const mobileActions = wrapper
            .get('[data-test="sale-mobile-actions"]')
            .findAll('button')
            .map((button) => button.attributes('title'));

        expect(desktopActions).toEqual([
            'Ver pedido',
            'Cobrar',
            'Rastrear',
            'Quitar de cola',
        ]);
        expect(mobileActions).toEqual(desktopActions);
        expect(wrapper.findAll('button[title="Cobrar"]')).toHaveLength(2);
        expect(wrapper.find('[data-test="payment-panel"]').exists()).toBe(
            false,
        );
    });

    it('orders sales from newest to oldest with the id as tie breaker', async () => {
        const older = {
            ...entry,
            id: 7,
            scheduled_for: '2026-08-24T10:00:00Z',
            source: { ...entry.source, id: 18, document_number: 'OLD' },
        };
        const newestLowerId = {
            ...entry,
            id: 9,
            scheduled_for: '2026-08-26T10:00:00Z',
            source: { ...entry.source, id: 20, document_number: 'NEW-1' },
        };
        const newestHigherId = {
            ...entry,
            id: 10,
            scheduled_for: '2026-08-26T10:00:00Z',
            source: { ...entry.source, id: 21, document_number: 'NEW-2' },
        };
        mocks.entries.value = [older, newestLowerId, newestHigherId];

        const wrapper = mountQueue();
        await flushPromises();

        expect(
            wrapper
                .findAll('[data-test="sales-queue-row"]')
                .map((row) => row.findAll('td')[1].text()),
        ).toEqual(['NEW-2', 'NEW-1', 'OLD']);
    });

    it('opens the read-only order summary with real items and totals', async () => {
        const wrapper = mountQueue();
        await flushPromises();

        await wrapper.findAll('button[title="Ver pedido"]')[0].trigger('click');
        await flushPromises();

        expect(mocks.apiGet).toHaveBeenCalledWith('/sales-quotes/19/summary');
        expect(wrapper.text()).toContain('Pedido 0000000269');
        expect(wrapper.text()).toContain('Filtro de aceite');
        expect(wrapper.text()).toContain('FIL-1');
        expect(wrapper.text()).toContain('ITBMS');

        await wrapper.get('button[title="Cerrar resumen"]').trigger('click');
        expect(wrapper.find('button[title="Cerrar resumen"]').exists()).toBe(
            false,
        );
    });

    it('opens traceability with the real queue entry id', async () => {
        const wrapper = mountQueue();
        await flushPromises();

        await wrapper.findAll('button[title="Rastrear"]')[0].trigger('click');

        expect(
            wrapper.get('[data-test="trace-drawer"]').attributes(),
        ).toMatchObject({
            'data-open': 'true',
            'data-id': '8',
        });
    });

    it('confirms removal and keeps the quote when removal fails', async () => {
        const wrapper = mountQueue();
        await flushPromises();

        await wrapper
            .findAll('button[title="Quitar de cola"]')[0]
            .trigger('click');
        expect(wrapper.text()).toContain('La cotizacion no sera eliminada');

        mocks.removeSaleFromQueue.mockRejectedValueOnce({
            response: { status: 409, data: { message: 'Registro ocupado' } },
        });
        await wrapper.get('[data-test="confirm-remove"]').trigger('click');
        await flushPromises();

        expect(mocks.removeSaleFromQueue).toHaveBeenCalledWith(19);
        expect(wrapper.text()).toContain('Registro ocupado');
        expect(wrapper.find('[data-test="confirm-remove"]').exists()).toBe(
            true,
        );
        expect(wrapper.text()).toContain('0000000269');
    });

    it('cancels removal without a request and blocks duplicate confirmation', async () => {
        const wrapper = mountQueue();
        await flushPromises();

        await wrapper
            .findAll('button[title="Quitar de cola"]')[0]
            .trigger('click');
        await wrapper.get('[data-test="cancel-remove"]').trigger('click');
        expect(mocks.removeSaleFromQueue).not.toHaveBeenCalled();

        let finishRemoval: (() => void) | undefined;
        mocks.removeSaleFromQueue.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    finishRemoval = resolve;
                }),
        );
        await wrapper
            .findAll('button[title="Quitar de cola"]')[0]
            .trigger('click');
        const confirm = wrapper.get('[data-test="confirm-remove"]');
        await confirm.trigger('click');
        await confirm.trigger('click');

        expect(mocks.removeSaleFromQueue).toHaveBeenCalledOnce();
        finishRemoval?.();
        await flushPromises();
        expect(wrapper.find('[data-test="confirm-remove"]').exists()).toBe(
            false,
        );
    });

    it('loads the quote as a POS cart and navigates to the point of sale', async () => {
        const wrapper = mountQueue();
        await flushPromises();

        await wrapper.findAll('button[title="Cobrar"]')[0].trigger('click');
        await flushPromises();

        expect(mocks.openEntry).toHaveBeenCalledWith(8);
        expect(mocks.apiPost).toHaveBeenCalledWith(
            '/sales-quotes/19/open-at-cashier',
        );
        expect(mocks.loadQuoteAsSession).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 19,
                quote_number: '0000000269',
                customer_id: 3,
                seller_id: 7,
                items: [
                    expect.objectContaining({
                        id: 31,
                        product_id: 4,
                        variant_id: 5,
                        quantity: 1,
                    }),
                ],
            }),
        );
        expect(mocks.visit).toHaveBeenCalledWith('/pos');
    });

    it('blocks a second click while the quote is opening', async () => {
        let finishOpen: ((value: unknown) => void) | undefined;
        mocks.openEntry.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishOpen = resolve;
                }),
        );
        const wrapper = mountQueue();
        await flushPromises();
        const button = wrapper.findAll('button[title="Cobrar"]')[0];

        await button.trigger('click');
        await button.trigger('click');

        expect(mocks.openEntry).toHaveBeenCalledOnce();
        finishOpen?.(entry);
        await flushPromises();
    });

    it('keeps the row visible and does not navigate when opening fails', async () => {
        mocks.apiPost.mockRejectedValue({
            response: { status: 409, data: { message: 'Registro ocupado' } },
        });
        const wrapper = mountQueue();
        await flushPromises();

        await wrapper.findAll('button[title="Cobrar"]')[0].trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('Registro ocupado');
        expect(wrapper.text()).toContain('0000000269');
        expect(mocks.loadQuoteAsSession).not.toHaveBeenCalled();
        expect(mocks.visit).not.toHaveBeenCalled();
    });

    it('still loads the cart when Caja must first be opened in POS', async () => {
        mocks.apiPost.mockRejectedValue({
            response: {
                status: 422,
                data: { requires_session: true, data: quote },
            },
        });
        const wrapper = mountQueue();
        await flushPromises();

        await wrapper.findAll('button[title="Cobrar"]')[0].trigger('click');
        await flushPromises();

        expect(mocks.loadQuoteAsSession).toHaveBeenCalledOnce();
        expect(mocks.visit).toHaveBeenCalledWith('/pos');
    });
});
