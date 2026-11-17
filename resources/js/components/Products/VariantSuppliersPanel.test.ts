// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VariantSuppliersPanel from './VariantSuppliersPanel.vue';

const get = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock('@/services/api/client', () => ({
    default: {
        get: (...args: unknown[]) => get(...args),
        put: (...args: unknown[]) => put(...args),
        delete: (...args: unknown[]) => del(...args),
    },
}));

// Ejemplo del jefe: D8521-3RA1A marca 555, comprada a Nikomoto y a Japan.
const nikomoto = {
    supplier_id: 1,
    supplier_name: 'NIKOMOTO 555 SUN',
    supplier_code: '726HAIQ7271',
    supplier_cost: 9.54,
    last_purchased_at: '2026-04-04T10:00:00Z',
    lead_time_days: 0,
    minimum_order_quantity: 1,
    is_default: true,
};
const japan = {
    ...nikomoto,
    supplier_id: 2,
    supplier_name: 'JAPAN INTERNATIONAL PARTS',
    supplier_code: 'D8521-3RA1A',
    supplier_cost: 10.88,
    is_default: false,
};

const SearchableSelectStub = {
    props: ['options', 'modelValue'],
    emits: ['update:modelValue'],
    template:
        '<button type="button" data-test="pick-supplier" :data-options="options.map((o) => o.label).join(\'|\')" @click="$emit(\'update:modelValue\', options[0]?.value)">pick</button>',
};

const mountPanel = async () => {
    const wrapper = mount(VariantSuppliersPanel, {
        props: { productId: 10, variantId: 20 },
        global: { stubs: { SearchableSelect: SearchableSelectStub } },
    });
    await flushPromises();
    return wrapper;
};

describe('VariantSuppliersPanel', () => {
    beforeEach(() => {
        get.mockReset().mockImplementation((url: string) =>
            Promise.resolve({
                data: {
                    data: url.startsWith('/suppliers')
                        ? [
                              { id: 1, name: 'NIKOMOTO 555 SUN' },
                              { id: 2, name: 'JAPAN INTERNATIONAL PARTS' },
                              { id: 3, name: 'AUTOPARTES DEL ISTMO' },
                          ]
                        : [nikomoto, japan],
                },
            }),
        );
        put.mockReset();
        del.mockReset();
    });

    it('lists each supplier with its code and last purchase cost, marking the cheapest as default', async () => {
        const wrapper = await mountPanel();

        expect(get).toHaveBeenCalledWith('/products/10/variants/20/suppliers');
        const rows = wrapper.findAll('[data-test="variant-supplier-row"]');
        expect(rows).toHaveLength(2);
        expect(rows[0].text()).toContain('NIKOMOTO 555 SUN');
        expect(rows[0].text()).toContain('726HAIQ7271');
        expect(rows[0].text()).toContain('9.54');
        expect(rows[0].find('[data-test="default-supplier"]').exists()).toBe(
            true,
        );
        expect(rows[1].find('[data-test="default-supplier"]').exists()).toBe(
            false,
        );
    });

    it('offers only suppliers the brand does not have yet, and adds one with its code and cost', async () => {
        put.mockResolvedValue({
            data: {
                data: [
                    nikomoto,
                    japan,
                    {
                        ...japan,
                        supplier_id: 3,
                        supplier_name: 'AUTOPARTES DEL ISTMO',
                        supplier_code: 'AI-55',
                        supplier_cost: 11,
                    },
                ],
            },
        });
        const wrapper = await mountPanel();

        const picker = wrapper.get('[data-test="pick-supplier"]');
        expect(picker.attributes('data-options')).toBe('AUTOPARTES DEL ISTMO');

        await picker.trigger('click');
        await wrapper.get('#new-supplier-code').setValue(' AI-55 ');
        await wrapper.get('#new-supplier-cost').setValue('11');
        await wrapper.get('[data-test="add-supplier"]').trigger('click');
        await flushPromises();

        expect(put).toHaveBeenCalledWith(
            '/products/10/variants/20/suppliers/3',
            {
                supplier_code: 'AI-55',
                supplier_cost: 11,
            },
        );
        expect(
            wrapper.findAll('[data-test="variant-supplier-row"]'),
        ).toHaveLength(3);
    });

    it('removes a supplier from the brand', async () => {
        del.mockResolvedValue({ data: { data: [nikomoto] } });
        const wrapper = await mountPanel();

        const japanRow = wrapper.findAll(
            '[data-test="variant-supplier-row"]',
        )[1];
        const remove = japanRow
            .findAll('button')
            .find((b) => b.text() === 'Quitar')!;
        await remove.trigger('click');
        await flushPromises();

        expect(del).toHaveBeenCalledWith(
            '/products/10/variants/20/suppliers/2',
        );
        expect(
            wrapper.findAll('[data-test="variant-supplier-row"]'),
        ).toHaveLength(1);
    });
});
