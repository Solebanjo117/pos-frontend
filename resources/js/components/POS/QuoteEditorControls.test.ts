// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import ActionButtons from './ActionButtons.vue';
import POSInlineSearch from './POSInlineSearch.vue';
import ProductTable from './ProductTable.vue';

vi.mock('@inertiajs/vue3', () => ({
    usePage: () => ({ props: { auth: { user: { id: 1, role: 'admin' } } } }),
}));

vi.mock('@/composables/useAuth', () => ({
    useAuth: () => ({ hasRole: vi.fn(() => true) }),
}));

vi.mock('@/services/api/client', () => ({
    default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}));

const lineItem = () => ({
    id: 'line-1',
    product_id: 1,
    product_name: 'Producto cotizado',
    product_sku: 'COT-1',
    product_price: 20,
    quantity: 2,
    available_stock: 5,
    discount_percent: 12.5,
    discount_amount: 5,
    tax_percent: 7,
    tax_amount: 2.45,
    subtotal: 35,
    total: 37.45,
    default_tax_percent: 7,
    is_tax_overridden: false,
});

const productTableStubs = {
    draggable: defineComponent({
        props: { modelValue: { type: Array, default: () => [] } },
        setup(props, { slots }) {
            return () =>
                h('table', [
                    slots.header?.(),
                    ...props.modelValue.flatMap(
                        (element, index) =>
                            slots.item?.({ element, index }) ?? [],
                    ),
                ]);
        },
    }),
    QuickPurchaseModal: true,
};

describe('quote editor controls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the shared simplified search and custom line action', async () => {
        const wrapper = mount(POSInlineSearch, {
            props: {},
        });

        expect(
            wrapper
                .find('input[placeholder="Buscar productos (F1)..."]')
                .exists(),
        ).toBe(true);
        expect(
            wrapper.find('[data-testid="quote-custom-line"]').text(),
        ).toContain('Nueva miscelánea');
        expect(wrapper.text()).not.toContain('Todas las categorías');
        expect(wrapper.text()).not.toContain('Todas las marcas');

        await wrapper
            .find('[data-testid="quote-custom-line"]')
            .trigger('click');
        expect(wrapper.emitted('add-custom-line')).toHaveLength(1);
    });

    it('replaces quote save controls with deposit and cashier destinations', async () => {
        const wrapper = mount(ActionButtons, {
            props: {
                hasOpenSession: false,
                canPay: false,
                quoteMode: true,
            },
        });

        expect(wrapper.text()).toContain('Depósito');
        expect(wrapper.text()).toContain('Caja');
        expect(wrapper.text()).not.toContain('Limpiar');
        expect(wrapper.text()).not.toContain('Cotizar');

        await wrapper
            .find('[data-testid="quote-send-deposit"]')
            .trigger('click');
        await wrapper
            .find('[data-testid="quote-send-cashier"]')
            .trigger('click');
        expect(wrapper.emitted('send-quote-to-deposit')).toHaveLength(1);
        expect(wrapper.emitted('send-quote-to-cashier')).toHaveLength(1);
    });

    it('uses direct price and fixed discount fields with the summary at the right', async () => {
        const wrapper = mount(ProductTable, {
            props: {
                items: [lineItem()],
                users: [{ id: 1, name: 'Administrador' }],
                quoteMode: true,
                canEditCommercial: true,
            },
            global: { stubs: productTableStubs },
        });

        await wrapper.find('tr.cursor-pointer').trigger('click');

        expect(wrapper.find('[data-testid="unit-price"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="discount-amount"]').exists()).toBe(
            true,
        );
        expect(wrapper.find('[data-testid="pricing-formula"]').exists()).toBe(
            false,
        );
        await wrapper.find('[data-testid="unit-price"]').setValue('24.75');
        await wrapper.find('[data-testid="unit-price"]').trigger('change');
        expect(wrapper.emitted('update-item-price')).toContainEqual([
            'line-1',
            24.75,
        ]);
        expect(wrapper.text()).toContain('Descuento $');
        expect(
            wrapper.find('[data-testid="line-summary"]').classes(),
        ).toContain('lg:col-start-4');
    });

    it('uses direct price and fixed discount outside quote mode', async () => {
        const { discount_amount: _discountAmount, ...item } = lineItem();
        const wrapper = mount(ProductTable, {
            props: {
                items: [item],
                users: [{ id: 1, name: 'Administrador' }],
                quoteMode: false,
                canEditCommercial: true,
            },
            global: { stubs: productTableStubs },
        });

        await wrapper.find('tr.cursor-pointer').trigger('click');

        expect(wrapper.find('[data-testid="unit-price"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="pricing-formula"]').exists()).toBe(
            false,
        );
        expect(wrapper.find('[data-testid="discount-amount"]').exists()).toBe(
            true,
        );
        expect(wrapper.text()).toContain('Descuento $');
    });

    it('shows the configured tax as a label with its calculated amount', async () => {
        const wrapper = mount(ProductTable, {
            props: {
                items: [lineItem()],
                users: [{ id: 1, name: 'Administrador' }],
                canEditCommercial: true,
            },
            global: { stubs: productTableStubs },
        });

        await wrapper.find('tr.cursor-pointer').trigger('click');

        expect(wrapper.find('[data-testid="item-tax-label"]').text()).toBe(
            '7% ITBMS',
        );
        expect(
            wrapper.find('[data-testid="item-tax-amount"]').text(),
        ).toContain('$2.45');
        expect(wrapper.find('input[value="7"]').exists()).toBe(false);

        await wrapper.find('[data-testid="item-tax-toggle"]').trigger('click');
        expect(wrapper.emitted('toggle-item-tax-exempt')).toContainEqual([
            'line-1',
        ]);
    });

    it('shows an exempt line without an editable tax field', async () => {
        const item = { ...lineItem(), tax_percent: 0, tax_amount: 0 };
        const wrapper = mount(ProductTable, {
            props: {
                items: [item],
                users: [{ id: 1, name: 'Administrador' }],
                canEditCommercial: true,
            },
            global: { stubs: productTableStubs },
        });

        await wrapper.find('tr.cursor-pointer').trigger('click');

        expect(wrapper.find('[data-testid="item-tax-label"]').text()).toBe(
            'Exento',
        );
        expect(
            wrapper.find('[data-testid="item-tax-amount"]').text(),
        ).toContain('$0.00');
    });
});
