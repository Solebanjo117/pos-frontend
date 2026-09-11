// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { Inbox } from 'lucide-vue-next';
import { describe, expect, it } from 'vitest';
import ModuleAction from './ModuleAction.vue';

describe('ModuleAction', () => {
    it('renders the pending count beside the action title', () => {
        const wrapper = mount(ModuleAction, {
            props: {
                action: {
                    title: 'Cola de caja',
                    href: '/pos/cashier',
                    description: 'Atender operaciones pendientes de cobro.',
                    icon: Inbox,
                },
                count: 7,
            },
            global: {
                stubs: {
                    Link: {
                        template: '<a><slot /></a>',
                    },
                },
            },
        });

        expect(wrapper.text()).toContain('Cola de caja 7');
        expect(wrapper.text()).toContain(
            'Atender operaciones pendientes de cobro.',
        );
    });
});
