// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionTrace } from '@/types/transaction-trace';
import TransactionTraceDrawer from './TransactionTraceDrawer.vue';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
}));

vi.mock('@/services/transaction-traces', () => ({
    transactionTraceService: { get: mocks.get },
}));

const trace = (id: number): TransactionTrace => ({
    root: {
        type: 'pos_session',
        id,
        label: `Sesión de Caja #${id}`,
        number: `#${id}`,
        can_view: true,
        restricted: false,
        traceable: true,
    },
    relationships: [],
    timeline: [],
    meta: {
        current_page: 1,
        last_page: 1,
        per_page: 25,
        total: 0,
    },
});

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });

    return { promise, resolve, reject };
};

const stubs = {
    Link: true,
    TransactionRelationsPanel: true,
    TransactionTimeline: true,
    Sheet: { template: '<div><slot /></div>' },
    SheetContent: { template: '<div><slot /></div>' },
    SheetHeader: { template: '<header><slot /></header>' },
    SheetTitle: { template: '<h2><slot /></h2>' },
    SheetDescription: { template: '<p><slot /></p>' },
};

describe('TransactionTraceDrawer', () => {
    beforeEach(() => vi.clearAllMocks());

    it('ignores an obsolete response when navigation changes', async () => {
        const first = deferred<TransactionTrace>();
        const second = deferred<TransactionTrace>();
        mocks.get
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        const wrapper = mount(TransactionTraceDrawer, {
            props: { open: true, type: 'pos_session', id: 1 },
            global: {
                stubs,
            },
        });
        await flushPromises();

        const firstSignal = mocks.get.mock.calls[0]?.[4] as AbortSignal;
        await wrapper.setProps({ id: 2 });
        await flushPromises();
        expect(firstSignal.aborted).toBe(true);

        second.resolve(trace(2));
        await flushPromises();
        first.resolve(trace(1));
        await flushPromises();

        expect(wrapper.text()).toContain('Sesión de Caja #2');
        expect(wrapper.text()).not.toContain('Sesión de Caja #1');
    });

    it('can retry and reload the same trace after closing', async () => {
        mocks.get
            .mockRejectedValueOnce({
                response: { status: 500, data: { message: 'Fallo temporal' } },
            })
            .mockResolvedValueOnce(trace(7))
            .mockResolvedValueOnce(trace(7));

        const wrapper = mount(TransactionTraceDrawer, {
            props: { open: true, type: 'pos_session', id: 7 },
            global: {
                stubs,
            },
        });
        await flushPromises();

        expect(wrapper.get('[role="alert"]').text()).toContain(
            'Fallo temporal',
        );
        await wrapper.get('[role="alert"] button').trigger('click');
        await flushPromises();
        expect(wrapper.text()).toContain('Sesión de Caja #7');

        await wrapper.setProps({ open: false });
        await wrapper.setProps({ open: true });
        await flushPromises();
        expect(mocks.get).toHaveBeenCalledTimes(3);
    });
});
