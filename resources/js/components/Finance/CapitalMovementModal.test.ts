// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import CapitalMovementModal from './CapitalMovementModal.vue';

const stubs = {
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
};

describe('CapitalMovementModal', () => {
    it('emits one positive idempotent request and waits for its parent to close', async () => {
        const wrapper = mount(CapitalMovementModal, {
            props: { open: true },
            global: { stubs },
        });
        const vm = wrapper.vm as any;
        vm.amount = 50;
        vm.reason = 'Aporte de socio';
        await nextTick();

        vm.submit();
        vm.submit();

        expect(wrapper.emitted('submit')).toHaveLength(1);
        const payload = wrapper.emitted('submit')?.[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(payload.amount).toBe(50);
        expect(payload.idempotency_key).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(wrapper.emitted('update:open')).toBeUndefined();
    });

    it('shows the backend error and keeps submission disabled while loading', async () => {
        const wrapper = mount(CapitalMovementModal, {
            props: {
                open: true,
                loading: true,
                error: 'La clave de idempotencia ya fue utilizada con datos diferentes.',
            },
            global: { stubs },
        });

        expect(wrapper.get('[role="alert"]').text()).toContain(
            'La clave de idempotencia ya fue utilizada con datos diferentes.',
        );
        expect(
            wrapper
                .findAll('button')
                .some((button) => button.attributes('disabled') !== undefined),
        ).toBe(true);
    });
});
