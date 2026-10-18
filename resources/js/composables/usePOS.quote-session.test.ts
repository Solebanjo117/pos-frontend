// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    usePage: () => ({ props: { auth: { user: { id: 55 } } } }),
}));

vi.mock('@/services/sales-orders', () => ({
    salesOrdersService: { create: vi.fn() },
}));

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({
        fetchSettings: vi.fn().mockResolvedValue(undefined),
        isSingleWarehouseMode: ref(false),
        getDefaultWarehouse: vi.fn(),
        getDefaultWarehouseId: vi.fn(() => 1),
        currentWarehouseId: ref(1),
    }),
}));

vi.mock('@/composables/useStoreSettings', () => ({
    useStoreSettings: () => ({
        fetchSettings: vi.fn().mockResolvedValue(undefined),
        resolveTaxRate: vi.fn((rate: number) => rate),
    }),
}));

const quote = (quantity: number) => ({
    id: 19,
    quote_number: '0000000269',
    customer_id: 3,
    seller_id: 7,
    notes: 'Entregar hoy',
    items: [
        {
            id: 31,
            product_id: 4,
            product_name: 'Filtro de aceite',
            product_sku: 'FIL-1',
            variant_id: 5,
            warehouse_id: 2,
            quantity,
            unit_price: 10,
            discount_percent: 0,
            tax_percent: 0,
            subtotal: 10 * quantity,
            tax_amount: 0,
            total: 10 * quantity,
        },
    ],
});

describe('usePOS quote sessions', () => {
    beforeEach(() => {
        localStorage.clear();
        (window as any).__page = { props: { auth: { user: { id: 55 } } } };
    });

    it('reactivates and refreshes the existing cart for the same quote', async () => {
        const { usePOS } = await import('./usePOS');
        let pos: ReturnType<typeof usePOS>;
        const Harness = defineComponent({
            setup() {
                pos = usePOS();
                return () => h('div');
            },
        });
        const wrapper = mount(Harness);

        const firstSessionId = pos!.loadQuoteAsSession(quote(1));
        const secondSessionId = pos!.loadQuoteAsSession(quote(2));
        const quoteSessions = pos!.allSessions.value.filter(
            (session) => session.source_quote_id === 19,
        );

        expect(secondSessionId).toBe(firstSessionId);
        expect(quoteSessions).toHaveLength(1);
        expect(pos!.activeSession.value.name).toBe('COT-0000000269');
        expect(pos!.activeSession.value.cart[0].quantity).toBe(2);
        expect(pos!.activeSession.value.cart[0].source_quote_item_id).toBe(31);

        wrapper.unmount();
    });

    it('keeps a quote discount fixed when quantity and price change', async () => {
        const { usePOS } = await import('./usePOS');
        let pos: ReturnType<typeof usePOS>;
        const Harness = defineComponent({
            setup() {
                pos = usePOS();
                return () => h('div');
            },
        });
        const wrapper = mount(Harness);
        const fixedQuote = quote(2);
        fixedQuote.items[0].discount_percent = 15;
        Object.assign(fixedQuote.items[0], {
            discount_amount: 3,
            subtotal: 17,
            total: 17,
        });

        pos!.loadQuoteAsSession(fixedQuote);
        const item = pos!.activeSession.value.cart[0];
        pos!.updateQuantity(item.id, 3);

        expect(item.discount_amount).toBe(3);
        expect(item.subtotal).toBe(27);

        pos!.updateItemPrice(item.id, 5);
        expect(item.discount_amount).toBe(3);
        expect(item.subtotal).toBe(12);

        pos!.updateDiscountAmount(item.id, 20);
        expect(item.discount_amount).toBe(15);
        expect(item.total).toBe(0);

        wrapper.unmount();
    });

    it('keeps fixed discounts unchanged for normal POS items', async () => {
        const { usePOS } = await import('./usePOS');
        let pos: ReturnType<typeof usePOS>;
        const Harness = defineComponent({
            setup() {
                pos = usePOS();
                return () => h('div');
            },
        });
        const wrapper = mount(Harness);

        pos!.loadQuoteAsSession(quote(2));
        const item = pos!.activeSession.value.cart[0];
        pos!.updateDiscountAmount(item.id, 3);
        pos!.updateQuantity(item.id, 3);

        expect(item.discount_amount).toBe(3);
        expect(item.subtotal).toBe(27);

        wrapper.unmount();
    });

    it('persists the quote header data so the POS can display it', async () => {
        const { usePOS } = await import('./usePOS');
        let pos: ReturnType<typeof usePOS>;
        const Harness = defineComponent({
            setup() {
                pos = usePOS();
                return () => h('div');
            },
        });
        const wrapper = mount(Harness);

        pos!.loadQuoteAsSession({
            ...quote(1),
            customer_name: 'Taller Los Andes',
            seller_name: 'Ana Vendedora',
            created_at: '2026-08-25T09:45:00.000Z',
        });
        const session = pos!.activeSession.value;

        expect(session.source_quote_id).toBe(19);
        expect(session.quote_number).toBe('0000000269');
        expect(session.quote_customer_name).toBe('Taller Los Andes');
        expect(session.quote_seller_name).toBe('Ana Vendedora');
        expect(session.quote_created_at).toBe('2026-08-25T09:45:00.000Z');
        expect(session.quote_notes).toBe('Entregar hoy');

        wrapper.unmount();
    });

    it('leaves the quote header fields empty when the API omits them', async () => {
        const { usePOS } = await import('./usePOS');
        let pos: ReturnType<typeof usePOS>;
        const Harness = defineComponent({
            setup() {
                pos = usePOS();
                return () => h('div');
            },
        });
        const wrapper = mount(Harness);

        pos!.loadQuoteAsSession({
            ...quote(1),
            customer_name: null,
            seller_name: null,
            created_at: null,
            notes: null,
        });
        const session = pos!.activeSession.value;

        expect(session.quote_customer_name).toBeUndefined();
        expect(session.quote_seller_name).toBeUndefined();
        expect(session.quote_created_at).toBeUndefined();
        expect(session.quote_notes).toBeUndefined();

        wrapper.unmount();
    });

    it('restores the item default tax after toggling an exempt line', async () => {
        const { usePOS } = await import('./usePOS');
        let pos: ReturnType<typeof usePOS>;
        const Harness = defineComponent({
            setup() {
                pos = usePOS();
                return () => h('div');
            },
        });
        const wrapper = mount(Harness);
        const taxedQuote = quote(1);
        Object.assign(taxedQuote.items[0], {
            tax_percent: 7,
            tax_amount: 0.7,
            total: 10.7,
        });

        pos!.loadQuoteAsSession(taxedQuote);
        const item = pos!.activeSession.value.cart[0];

        pos!.toggleItemTaxExempt(item.id);
        expect(item.tax_percent).toBe(0);
        expect(item.tax_amount).toBe(0);

        pos!.toggleItemTaxExempt(item.id);
        expect(item.tax_percent).toBe(7);
        expect(item.tax_amount).toBe(0.7);

        wrapper.unmount();
    });

    it('completes a sale without alerting the stock warnings returned by the API', async () => {
        const { usePOS } = await import('./usePOS');
        const { salesOrdersService } = await import('@/services/sales-orders');
        vi.mocked(salesOrdersService.create).mockResolvedValue({
            data: { id: 81, order_number: '2610110001' },
            warnings: [{ message: 'Filtro de aceite: sin stock disponible.' }],
        } as any);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        let pos: ReturnType<typeof usePOS>;
        const Harness = defineComponent({
            setup() {
                pos = usePOS();
                return () => h('div');
            },
        });
        const wrapper = mount(Harness);

        const lowStockQuote = quote(5);
        lowStockQuote.items[0].warehouse_id = 1;
        pos!.loadQuoteAsSession(lowStockQuote);
        pos!.activeSession.value.cart[0].available_stock = 0;

        const result = await pos!.processSale([{ method: 'cash', amount: 50 }]);

        expect(result).toBeTruthy();
        expect(salesOrdersService.create).toHaveBeenCalledOnce();
        expect(alertSpy).not.toHaveBeenCalled();
        expect(pos!.error.value).toBeNull();

        wrapper.unmount();
        alertSpy.mockRestore();
    });
});
