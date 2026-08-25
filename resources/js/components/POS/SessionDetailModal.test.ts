// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionDetailModal from './SessionDetailModal.vue';

const mocks = vi.hoisted(() => ({
    fetchMethods: vi.fn(),
}));

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: () => ({
        fetchMethods: mocks.fetchMethods,
        getMethodName: (code: string) => code,
    }),
}));

const baseProps = {
    session: null,
    salesOrders: [],
    cashMovements: [],
    purchasePayments: [],
    accountPayments: [],
    operationalExpenses: [],
    documents: [],
    timeline: [],
    loading: false,
};

describe('SessionDetailModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fetchMethods.mockResolvedValue(undefined);
    });

    it('keeps a recoverable load error visible and emits retry', async () => {
        const wrapper = mount(SessionDetailModal, {
            props: {
                ...baseProps,
                error: 'No se encontró el cierre solicitado.',
            },
            global: {
                stubs: {
                    Link: true,
                    TransactionTraceDrawer: true,
                },
            },
        });

        await flushPromises();

        expect(wrapper.get('[role="alert"]').text()).toContain(
            'No se encontró el cierre solicitado.',
        );
        const retryButton = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Reintentar'));
        expect(retryButton).toBeDefined();
        await retryButton!.trigger('click');
        expect(wrapper.emitted('retry')).toHaveLength(1);
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('supports Escape and exposes an accessible dialog title', async () => {
        const wrapper = mount(SessionDetailModal, {
            props: baseProps,
            global: {
                stubs: {
                    Link: true,
                    TransactionTraceDrawer: true,
                },
            },
            attachTo: document.body,
        });

        await flushPromises();

        expect(wrapper.attributes('role')).toBe('dialog');
        expect(wrapper.attributes('aria-modal')).toBe('true');
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
            'Cerrar detalle de caja',
        );

        await wrapper.trigger('keydown', { key: 'Escape' });
        expect(wrapper.emitted('close')).toHaveLength(1);
        wrapper.unmount();
    });
});
