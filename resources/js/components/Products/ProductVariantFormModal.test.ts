// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { chooseAppSelectOption } from '@/lib/testing/appSelect';
import ProductVariantFormModal from './ProductVariantFormModal.vue';

const updateVariant = vi.fn();
const fetchVariants = vi.fn();

vi.mock('@/composables/useProducts', () => ({
    useProducts: () => ({
        updateVariant,
        fetchVariants,
        loading: ref(false),
        error: ref(null),
    }),
}));

vi.mock('@/composables/useStoreSettings', () => ({
    useStoreSettings: () => ({
        settings: ref({ store_tax_rate: 7, price_rounding_increment: 0 }),
        fetchSettings: vi.fn().mockResolvedValue(undefined),
        defaultTaxRate: () => 7,
        resolveTaxRate: (value: unknown) =>
            value === null || value === undefined ? 7 : Number(value),
    }),
}));

vi.mock('@/services/api/client', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { data: [] } }),
        post: vi.fn().mockResolvedValue({ data: { price: null } }),
    },
}));

const passthrough = { template: '<div><slot /></div>' };
const stubs = {
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
    PricingFormula: {
        props: ['taxRate'],
        template: '<div data-testid="pricing-formula" :data-tax="taxRate" />',
    },
    ProductCodesEditor: {
        template: '<div />',
        methods: {
            validateAll: () => Promise.resolve(),
            hasConflicts: () => false,
        },
    },
};

const variantWithRates = (costTaxRate: number, saleTaxRate: number) => ({
    id: 20,
    product_id: 10,
    sku: 'FIL-20',
    status: 'active',
    brand_id: 1,
    codes: [],
    pricing: {
        base_price: 15,
        cost_base: 10,
        cost_miscellaneous: 0,
        cost_tax_rate: costTaxRate,
        sale_tax_rate: saleTaxRate,
        tax_rate: saleTaxRate,
    },
});

const mountModal = async () => {
    const wrapper = mount(ProductVariantFormModal, {
        props: { open: false, productId: 10, variantId: 20 },
        global: { stubs },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    return wrapper;
};

describe('ProductVariantFormModal ITBM', () => {
    beforeEach(() => {
        updateVariant.mockReset().mockResolvedValue({ id: 20 });
        fetchVariants.mockReset();
    });

    it('muestra Sí/No con la tasa de la tienda y ajusta una tasa antigua', async () => {
        fetchVariants.mockResolvedValue([variantWithRates(10, 0)]);
        const wrapper = await mountModal();

        const cost = wrapper.get('[data-testid="cost-itbm-select"]');
        const sale = wrapper.get('[data-testid="sale-itbm-select"]');

        // El selector muestra la opción elegida.
        expect(cost.text()).toContain('Sí (7%)');
        expect(sale.text()).toBe('No');
        expect(wrapper.find('input[type="number"][max="100"]').exists()).toBe(
            false,
        );
        // Con ITBM de venta "No" el precio se calcula sin ITBM (antes caía a 7%).
        expect(
            wrapper
                .get('[data-testid="pricing-formula"]')
                .attributes('data-tax'),
        ).toBe('0');

        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(updateVariant).toHaveBeenCalledTimes(1);
        expect(updateVariant.mock.calls[0][2].pricing).toMatchObject({
            cost_tax_rate: 7,
            sale_tax_rate: 0,
            tax_rate: 0,
        });
    });

    it('guarda la tasa de la tienda o 0 según lo elegido', async () => {
        fetchVariants.mockResolvedValue([variantWithRates(0, 7)]);
        const wrapper = await mountModal();

        await chooseAppSelectOption(
            wrapper.get('[data-testid="cost-itbm-select"] button'),
            'Sí (7%)',
        );
        await chooseAppSelectOption(
            wrapper.get('[data-testid="sale-itbm-select"] button'),
            'No',
        );
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(updateVariant.mock.calls[0][2].pricing).toMatchObject({
            cost_tax_rate: 7,
            sale_tax_rate: 0,
            tax_rate: 0,
        });
    });
});
