// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrintTicketModal from './PrintTicketModal.vue';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    createObjectUrl: vi.fn(() => 'blob:ticket-preview'),
    revokeObjectUrl: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
    default: { get: mocks.get },
}));

describe('PrintTicketModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('URL', {
            createObjectURL: mocks.createObjectUrl,
            revokeObjectURL: mocks.revokeObjectUrl,
        });
        mocks.get.mockResolvedValue({ data: new Blob(['pdf']) });
    });

    it('loads the authenticated PDF before enabling print', async () => {
        const wrapper = mount(PrintTicketModal, {
            props: { show: true, orderId: 12, orderNumber: 'ORD-12' },
        });
        await flushPromises();

        expect(mocks.get).toHaveBeenCalledWith(
            '/sales-orders/12/ticket?type=internal',
            expect.objectContaining({ responseType: 'blob' }),
        );
        expect(wrapper.find('iframe').attributes('src')).toBe(
            'blob:ticket-preview',
        );

        const printButton = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Imprimir'))!;
        expect(printButton.attributes()).toHaveProperty('disabled');
        await wrapper.find('iframe').trigger('load');
        expect(printButton.attributes()).not.toHaveProperty('disabled');
    });

    it('reloads the selected format and resets it when reopened', async () => {
        const wrapper = mount(PrintTicketModal, {
            props: { show: true, orderId: 7 },
        });
        await flushPromises();

        const proforma = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Proforma'))!;
        const client = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Cliente'))!;
        await proforma.trigger('click');
        await client.trigger('click');
        await flushPromises();
        expect(mocks.get).toHaveBeenLastCalledWith(
            '/sales-orders/7/proforma?type=client',
            expect.any(Object),
        );

        await wrapper.setProps({ show: false });
        await wrapper.setProps({ show: true });
        await flushPromises();
        expect(mocks.get).toHaveBeenLastCalledWith(
            '/sales-orders/7/ticket?type=internal',
            expect.any(Object),
        );
    });

    it('shows an understandable server error and allows retry', async () => {
        mocks.get.mockRejectedValueOnce({ response: { status: 404 } });
        const wrapper = mount(PrintTicketModal, {
            props: { show: true, orderId: 404 },
        });
        await flushPromises();

        expect(wrapper.text()).toContain(
            'El documento solicitado ya no existe.',
        );
        const retry = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Reintentar'))!;
        await retry.trigger('click');
        await flushPromises();
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });
});
