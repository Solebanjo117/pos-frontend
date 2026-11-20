// @vitest-environment jsdom

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    appSelectButton,
    chooseAppSelectOption,
} from '@/lib/testing/appSelect';
import StockAdjustModal from './StockAdjustModal.vue';

const put = vi.fn();
vi.mock('@/services/api/client', () => ({
    default: { put: (...args: unknown[]) => put(...args) },
}));

const body = () => new DOMWrapper(document.body);
const saveButton = () =>
    document.body.querySelector<HTMLButtonElement>(
        '[data-test="save-adjustment"]',
    )!;

const mountModal = async () => {
    const wrapper = mount(StockAdjustModal, {
        attachTo: document.body,
        props: {
            open: true,
            productId: 10,
            variantId: 20,
            warehouseId: 3,
            currentQuantity: 5,
            label: 'Terminal · CTR',
        },
    });
    await flushPromises();
    return wrapper;
};

const setQuantity = async (value: string) => {
    await body().get('[data-test="new-quantity"]').setValue(value);
    await flushPromises();
};

describe('StockAdjustModal', () => {
    beforeEach(() => {
        put.mockReset().mockResolvedValue({
            data: { data: { quantity_available: 8 } },
        });
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('shows the current stock and the movement the new quantity will create', async () => {
        const wrapper = await mountModal();

        expect(body().get('[data-test="current-quantity"]').text()).toBe('5');
        await setQuantity('8');
        expect(body().get('[data-test="difference"]').text()).toContain(
            'entrada de 3',
        );
        await setQuantity('2');
        expect(body().get('[data-test="difference"]').text()).toContain(
            'salida de 3',
        );
        wrapper.unmount();
    });

    it('requires a reason before saving, and a note when the reason is "Otro"', async () => {
        const wrapper = await mountModal();
        await setQuantity('8');
        expect(saveButton().disabled).toBe(true);

        await chooseAppSelectOption(
            appSelectButton(body(), 'Motivo del ajuste'),
            'Otro',
        );
        expect(saveButton().disabled).toBe(true);

        await body()
            .get('[data-test="notes"]')
            .setValue('Se encontró en bodega');
        await flushPromises();
        expect(saveButton().disabled).toBe(false);
        wrapper.unmount();
    });

    it('sends the adjustment with its reason and note, and reports the new stock', async () => {
        const wrapper = await mountModal();
        await setQuantity('8');
        await chooseAppSelectOption(
            appSelectButton(body(), 'Motivo del ajuste'),
            'Conteo físico',
        );
        await body()
            .get('[data-test="notes"]')
            .setValue('Conteo de fin de mes');

        saveButton().click();
        await flushPromises();

        expect(put).toHaveBeenCalledWith(
            '/inventory/products/10/warehouses/3',
            {
                variant_id: 20,
                stock_available: 8,
                reason: 'Conteo físico',
                notes: 'Conteo de fin de mes',
            },
        );
        expect(wrapper.emitted('saved')?.[0]).toEqual([8]);
        expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
        wrapper.unmount();
    });

    it('does not allow saving the same quantity', async () => {
        const wrapper = await mountModal();
        await chooseAppSelectOption(
            appSelectButton(body(), 'Motivo del ajuste'),
            'Daño',
        );
        expect(saveButton().disabled).toBe(true);
        wrapper.unmount();
    });
});
