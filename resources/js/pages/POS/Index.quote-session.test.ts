// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
    role: 'admin' as string,
    visit: vi.fn(),
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiPatch: vi.fn(),
    checkSession: vi.fn(),
    sessionOpen: true,
    transition: vi.fn(),
}));

vi.mock('@inertiajs/vue3', () => ({
    Head: { template: '<div />' },
    usePage: () => ({
        props: { auth: { user: { id: 55, name: 'Cajero', role: mocks.role } } },
    }),
    router: {
        visit: mocks.visit,
        on: vi.fn(() => vi.fn()),
    },
}));

vi.mock('@/layouts/AppLayout.vue', () => ({
    default: { name: 'AppLayout', template: '<div><slot /></div>' },
}));

vi.mock('@/services/api/client', () => ({
    default: {
        get: mocks.apiGet,
        post: mocks.apiPost,
        put: mocks.apiPut,
        patch: mocks.apiPatch,
        delete: vi.fn(),
    },
}));

vi.mock('@/services/sales-orders', () => ({
    salesOrdersService: { create: vi.fn() },
}));

vi.mock('@/services/sales-quotes', () => ({
    SalesQuotesApiService: { transition: mocks.transition },
}));

vi.mock('@/services/sales-returns', () => ({
    SalesReturnsApiService: { create: vi.fn() },
}));

vi.mock('@/services/payments', () => ({
    SalesOrderPaymentApiService: { create: vi.fn() },
}));

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({
        fetchSettings: vi.fn().mockResolvedValue(undefined),
        initWarehouse: vi.fn().mockResolvedValue(undefined),
        setWarehouse: vi.fn(),
        isSingleWarehouseMode: () => false,
        isClientMode: () => false,
        getDefaultWarehouse: vi.fn(),
        getDefaultWarehouseId: vi.fn(() => 1),
        currentWarehouseId: ref(1),
        settings: ref({ default_warehouse_id: 1 }),
    }),
}));

vi.mock('@/composables/useStoreSettings', () => ({
    useStoreSettings: () => ({
        fetchSettings: vi.fn().mockResolvedValue(undefined),
        resolveTaxRate: (rate: number | null) => rate ?? 0,
        defaultTaxRate: () => 0,
    }),
}));

vi.mock('@/composables/useProducts', () => ({
    useProducts: () => ({
        products: ref([]),
        fetchProducts: vi.fn().mockResolvedValue(undefined),
        fetchMoreProducts: vi.fn().mockResolvedValue(undefined),
        total: ref(0),
        hasNextPage: ref(false),
        loading: ref(false),
    }),
}));

vi.mock('@/composables/useCustomers', () => ({
    useCustomers: () => ({
        customers: ref([]),
        fetchCustomers: vi.fn().mockResolvedValue(undefined),
        perPage: ref(50),
    }),
}));

vi.mock('@/composables/useWarehouses', () => ({
    useWarehouses: () => ({
        warehouses: ref([]),
        fetchWarehouses: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('@/composables/usePosSession', () => ({
    usePosSession: () => ({
        isChecking: ref(false),
        isOpen: ref(mocks.sessionOpen),
        error: ref(null),
        checkCurrentSession: mocks.checkSession.mockResolvedValue(undefined),
        openSession: vi.fn().mockResolvedValue(undefined),
        addCashMovement: vi.fn().mockResolvedValue(undefined),
    }),
}));

const ActionButtonsStub = {
    name: 'ActionButtons',
    emits: [
        'clear',
        'save-quote',
        'save-quote-changes',
        'open-cash-register',
        'open-payment-modal',
        'send-quote-to-deposit',
        'send-quote-to-cashier',
    ],
    template: `<div>
        <button data-test="emit-save-quote-changes" @click="$emit('save-quote-changes')" />
        <button data-test="emit-save-quote" @click="$emit('save-quote')" />
        <button data-test="emit-send-to-cashier" @click="$emit('send-quote-to-cashier')" />
    </div>`,
};

/** Sesión de carrito cargada desde una cotización, con stock insuficiente. */
function seedQuoteSession(): void {
    localStorage.clear();
    localStorage.setItem(
        'pos_sessions_user_55',
        JSON.stringify([
            {
                id: 's_quote_19',
                name: 'COT-0000000269',
                cart: [
                    {
                        id: 'item-1',
                        product_id: 4,
                        variant_id: 5,
                        product_name: 'Filtro de aceite',
                        product_sku: 'FIL-1',
                        product_price: 10,
                        quantity: 3,
                        available_stock: 1,
                        discount_percent: 0,
                        discount_amount: 0,
                        tax_percent: 0,
                        default_tax_percent: 0,
                        is_tax_overridden: false,
                        subtotal: 30,
                        tax_amount: 0,
                        total: 30,
                    },
                ],
                customer_id: 3,
                notes: 'Entregar hoy',
                source_quote_id: 19,
                quote_number: '0000000269',
                quote_customer_name: 'Taller Los Andes',
                quote_seller_name: 'Ana Vendedora',
                quote_created_at: '2026-08-25T09:45:00.000Z',
                quote_notes: 'Entregar antes del mediodía',
                sessionLogs: [],
                createdAt: '2026-08-25T09:45:00.000Z',
            },
        ]),
    );
    localStorage.setItem('pos_active_session_user_55', 's_quote_19');
}

async function mountPos(props: Record<string, unknown> = {}) {
    const { default: Index } = await import('./Index.vue');
    const { useToast } = await import('@/composables/useToast');
    const wrapper = mount(Index, {
        props,
        shallow: true,
        global: { stubs: { ActionButtons: ActionButtonsStub } },
    });
    await flushPromises();

    return { wrapper, toast: useToast() };
}

describe('POS quote session banner', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mocks.role = 'admin';
        mocks.sessionOpen = true;
        mocks.apiGet.mockResolvedValue({ data: { data: [] } });
        mocks.apiPut.mockResolvedValue({ data: { data: { id: 19 } } });
        mocks.apiPost.mockResolvedValue({
            data: { data: { id: 19, quote_number: '0000000269' } },
        });
        mocks.transition.mockResolvedValue(undefined);
        (window as any).__page = {
            props: { auth: { user: { id: 55, role: 'admin' } } },
        };
        seedQuoteSession();
    });

    it('shows the quote number, customer, seller, date and notes', async () => {
        const { wrapper } = await mountPos();

        const banner = wrapper.get('[data-test="quote-session-banner"]');
        expect(banner.text()).toContain('COTIZACIÓN #0000000269');
        expect(wrapper.get('[data-test="quote-session-customer"]').text()).toBe(
            'Taller Los Andes',
        );
        expect(wrapper.get('[data-test="quote-session-seller"]').text()).toBe(
            'Ana Vendedora',
        );
        expect(
            wrapper.get('[data-test="quote-session-created-at"]').text(),
        ).toContain('25/08/2026');
        expect(
            wrapper.get('[data-test="quote-session-notes"]').text(),
        ).toContain('Entregar antes del mediodía');

        wrapper.unmount();
    });

    it('hides the banner in the quote editor, which has its own header', async () => {
        const { wrapper } = await mountPos({ quoteMode: true, quoteId: 19 });

        expect(
            wrapper.find('[data-test="quote-session-banner"]').exists(),
        ).toBe(false);
        expect(wrapper.text()).toContain('Editor de Cotización');

        wrapper.unmount();
    });

    it('hides the banner when the cart is not backed by a quote', async () => {
        localStorage.clear();
        const { wrapper } = await mountPos();

        expect(
            wrapper.find('[data-test="quote-session-banner"]').exists(),
        ).toBe(false);

        wrapper.unmount();
    });
});

describe('POS post-sale edit session', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mocks.role = 'admin';
        mocks.sessionOpen = false;
        localStorage.clear();
        mocks.apiGet.mockImplementation(async (url: string) => {
            if (url === '/sales-orders/22') {
                return {
                    data: {
                        data: {
                            id: 22,
                            order_number: 'V-22',
                            status: 'confirmed',
                            total: 20,
                            items: [
                                {
                                    id: 41,
                                    product_id: 4,
                                    warehouse_id: 1,
                                    quantity: 2,
                                    unit_price: 10,
                                    discount_amount: 0,
                                    discount_percent: 0,
                                    tax_percent: 0,
                                    total: 20,
                                },
                            ],
                        },
                    },
                };
            }
            return { data: { data: [] } };
        });
    });

    it('checks and offers to open Caja before charging a post-sale difference', async () => {
        const { wrapper } = await mountPos({ editMode: true, orderId: 22 });

        expect(mocks.checkSession).toHaveBeenCalledWith(1);
        expect(wrapper.find('cash-register-status-stub').exists()).toBe(true);
        expect(wrapper.find('open-session-modal-stub').exists()).toBe(true);

        wrapper.unmount();
    }, 15000);
});

describe('POS stock warnings are advisory, never blocking', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mocks.role = 'admin';
        mocks.sessionOpen = true;
        mocks.apiGet.mockImplementation(async (url: string) => {
            if (url === '/sales-quotes/19') {
                return {
                    data: {
                        id: 19,
                        quote_number: '0000000269',
                        status: 'draft',
                        draft_revision: 0,
                        warehouse_id: 1,
                        customer_id: 3,
                        items: [
                            {
                                id: 31,
                                product_id: 4,
                                product_name: 'Filtro de aceite',
                                product_sku: 'FIL-1',
                                variant_id: 5,
                                warehouse_id: 1,
                                quantity: 3,
                                unit_price: 10,
                                discount_percent: 0,
                                discount_amount: 0,
                                tax_percent: 0,
                                subtotal: 30,
                                tax_amount: 0,
                                total: 30,
                            },
                        ],
                    },
                };
            }
            return { data: { data: [] } };
        });
        mocks.apiPut.mockResolvedValue({ data: { data: { id: 19 } } });
        mocks.apiPost.mockResolvedValue({
            data: { data: { id: 19, quote_number: '0000000269' } },
        });
        mocks.transition.mockResolvedValue(undefined);
        (window as any).__page = {
            props: { auth: { user: { id: 55, role: 'admin' } } },
        };
        seedQuoteSession();
    });

    it('saves quote changes without a confirm and warns through a toast', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { wrapper, toast } = await mountPos();

        await wrapper
            .get('[data-test="emit-save-quote-changes"]')
            .trigger('click');
        await flushPromises();

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(alertSpy).not.toHaveBeenCalled();
        expect(mocks.apiPut).toHaveBeenCalledWith(
            '/sales-quotes/19',
            expect.objectContaining({ customer_id: 3 }),
        );
        expect(toast.toasts.value.map((entry) => entry.type)).toEqual(
            expect.arrayContaining(['warning', 'success']),
        );
        expect(
            toast.toasts.value.find((entry) => entry.type === 'warning')
                ?.message,
        ).toContain('Filtro de aceite');

        wrapper.unmount();
        confirmSpy.mockRestore();
        alertSpy.mockRestore();
    });

    it('suppresses the stock warning for a strict cashier', async () => {
        mocks.role = 'cashier';
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { wrapper, toast } = await mountPos();

        await wrapper
            .get('[data-test="emit-send-to-cashier"]')
            .trigger('click');
        await flushPromises();

        expect(confirmSpy).toHaveBeenCalledOnce();
        expect(confirmSpy.mock.calls[0][0]).not.toContain('Advertencia');
        expect(mocks.transition).toHaveBeenCalledWith(19, 'send-to-cashier');
        expect(
            toast.toasts.value.some((entry) => entry.type === 'warning'),
        ).toBe(false);

        wrapper.unmount();
        confirmSpy.mockRestore();
    });

    it('keeps the destination confirm but moves the stock advisory to a toast', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { wrapper, toast } = await mountPos({
            quoteMode: true,
            quoteId: 19,
        });

        await wrapper
            .get('[data-test="emit-send-to-cashier"]')
            .trigger('click');
        await flushPromises();

        expect(confirmSpy).toHaveBeenCalledOnce();
        expect(confirmSpy.mock.calls[0][0]).toContain('cola de Caja');
        expect(confirmSpy.mock.calls[0][0]).not.toContain('Advertencia');
        expect(mocks.transition).toHaveBeenCalledWith(19, 'send-to-cashier');
        expect(
            toast.toasts.value.some((entry) => entry.type === 'warning'),
        ).toBe(false);

        wrapper.unmount();
        confirmSpy.mockRestore();
    });

    it('does not send the quote when the destination confirm is rejected', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { wrapper, toast } = await mountPos({
            quoteMode: true,
            quoteId: 19,
        });

        await wrapper
            .get('[data-test="emit-send-to-cashier"]')
            .trigger('click');
        await flushPromises();

        expect(mocks.transition).not.toHaveBeenCalled();
        expect(toast.toasts.value).toHaveLength(0);

        wrapper.unmount();
        confirmSpy.mockRestore();
    });
});
