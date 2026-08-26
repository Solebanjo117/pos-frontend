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
});
