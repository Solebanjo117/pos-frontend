// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { chooseAppSelectOption } from '@/lib/testing/appSelect';
import apiClient from '@/services/api/client';
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

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({ currentWarehouseId: ref(3) }),
}));

vi.mock('@/services/api/client', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { data: [] } }),
        post: vi.fn().mockResolvedValue({ data: { price: null } }),
    },
}));

const stubs = {
    AppModal: {
        props: ['open', 'title'],
        template:
            '<div v-if="open" :data-title="title"><slot /><footer><slot name="footer" /></footer></div>',
    },
    PricingFormula: {
        props: ['taxRate'],
        template: '<div data-testid="pricing-formula" :data-tax="taxRate" />',
    },
    StockAdjustModal: {
        props: ['open', 'currentQuantity', 'warehouseId', 'variantId'],
        template:
            '<div data-testid="stock-adjust" :data-open="open" :data-qty="currentQuantity" :data-wh="warehouseId" :data-variant="variantId" />',
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
        // La ventana de la marca no envía códigos ni SKU: el backend conserva los de la marca.
        expect(updateVariant.mock.calls[0][2]).not.toHaveProperty('codes');
        expect(updateVariant.mock.calls[0][2]).not.toHaveProperty('sku');
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

    it('shows the brand stock in the current warehouse and adjusts it only through the adjust window', async () => {
        fetchVariants.mockResolvedValue([
            {
                ...variantWithRates(7, 7),
                inventory: [
                    { warehouse: { id: 2 }, quantity_available: 9 },
                    { warehouse: { id: 3 }, quantity_available: 4 },
                ],
            },
        ]);
        const wrapper = await mountModal();

        expect(wrapper.get('[data-test="variant-stock"]').text()).toBe('4');
        expect(wrapper.find('input[type="number"][readonly]').exists()).toBe(
            false,
        );

        const adjust = wrapper.get('[data-testid="stock-adjust"]');
        expect(adjust.attributes('data-open')).toBe('false');
        await wrapper.get('[data-test="adjust-stock"]').trigger('click');
        expect(adjust.attributes('data-open')).toBe('true');
        expect(adjust.attributes('data-qty')).toBe('4');
        expect(adjust.attributes('data-wh')).toBe('3');
        expect(adjust.attributes('data-variant')).toBe('20');
    });

    it('shows the brand code read-only and does not send it when saving', async () => {
        fetchVariants.mockResolvedValue([variantWithRates(7, 7)]);
        const wrapper = await mountModal();

        const code = wrapper.get('[data-test="brand-code"]');
        expect((code.element as HTMLInputElement).value).toBe('FIL-20');
        expect(code.attributes('readonly')).toBeDefined();

        await wrapper.get('form').trigger('submit');
        await flushPromises();
        expect(updateVariant.mock.calls[0][2]).not.toHaveProperty('sku');
    });

    it('loads the brand when it is created already open (as from the products list)', async () => {
        fetchVariants.mockResolvedValue([variantWithRates(7, 7)]);
        const wrapper = mount(ProductVariantFormModal, {
            props: { open: true, productId: 10, variantId: 20 },
            global: { stubs },
        });
        await flushPromises();

        expect(fetchVariants).toHaveBeenCalledWith(10);
        // Con la marca cargada se ve su existencia y el costo base guardado.
        expect(wrapper.find('[data-test="variant-stock"]').exists()).toBe(true);
        expect(
            wrapper
                .findAll('input')
                .some(
                    (input) =>
                        (input.element as HTMLInputElement).value === '10',
                ),
        ).toBe(true);
    });

    it('shows the loading indicator, not an empty form, while brands are still loading', async () => {
        fetchVariants.mockResolvedValue([variantWithRates(7, 7)]);
        let resolveBrands: (value: unknown) => void = () => {};
        vi.mocked(apiClient.get).mockReturnValueOnce(
            new Promise((resolve) => (resolveBrands = resolve)) as any,
        );

        const wrapper = mount(ProductVariantFormModal, {
            props: { open: true, productId: 10, variantId: 20 },
            global: { stubs },
        });
        await flushPromises();

        expect(wrapper.find('[data-slot="loading-state"]').exists()).toBe(true);
        expect(wrapper.find('form').exists()).toBe(false);

        resolveBrands({ data: { data: [] } });
        await flushPromises();
        expect(wrapper.find('form').exists()).toBe(true);
        expect(wrapper.find('[data-slot="loading-state"]').exists()).toBe(
            false,
        );
    });
});
