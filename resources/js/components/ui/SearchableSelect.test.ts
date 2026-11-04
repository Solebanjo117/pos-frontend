// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import SearchableSelect from './SearchableSelect.vue';

const options = [
    { value: 1, label: '555' },
    { value: 2, label: 'NIPPON PARTS AUTOMOTIVE DISTRIBUTION' },
];

describe('SearchableSelect', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('uses the standard 36px field height', () => {
        const wrapper = mount(SearchableSelect, {
            props: { options, modelValue: null },
        });

        expect(wrapper.get('button').classes()).toContain('h-9');
    });

    it('opens a list at least 224px wide without horizontal scroll and truncates long names', async () => {
        const wrapper = mount(SearchableSelect, {
            attachTo: document.body,
            props: { options, modelValue: 1 },
        });

        await wrapper.get('button').trigger('click');
        await flushPromises();

        const listbox = document.body.querySelector('[role="listbox"]') as HTMLElement;
        expect(listbox.style.width).toBe('224px');

        const list = listbox.querySelector('ul') as HTMLElement;
        expect(list.className).toContain('overflow-x-hidden');

        const longOption = listbox.querySelectorAll('li[role="option"]')[1] as HTMLElement;
        expect(longOption.getAttribute('title')).toBe('NIPPON PARTS AUTOMOTIVE DISTRIBUTION');
        expect(longOption.querySelector('span')!.className).toContain('truncate');
        wrapper.unmount();
    });

    const placeTrigger = (top: number) => {
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            top,
            bottom: top + 36,
            left: 40,
            right: 240,
            width: 200,
            height: 36,
            x: 40,
            y: top,
            toJSON: () => ({}),
        } as DOMRect);
    };

    const openSelect = async (wrapper: ReturnType<typeof mount>) => {
        await wrapper.get('button').trigger('click');
        await flushPromises();
        return document.body.querySelector('[role="listbox"]') as HTMLElement;
    };

    it('opens downward when there is room below the field', async () => {
        placeTrigger(100);
        const wrapper = mount(SearchableSelect, {
            attachTo: document.body,
            props: { options, modelValue: null },
        });

        expect((await openSelect(wrapper)).dataset.placement).toBe('bottom');
        wrapper.unmount();
    });

    it('opens upward when the field is near the bottom of the screen', async () => {
        placeTrigger(700);
        const wrapper = mount(SearchableSelect, {
            attachTo: document.body,
            props: { options, modelValue: null },
        });

        expect((await openSelect(wrapper)).dataset.placement).toBe('top');
        wrapper.unmount();
    });

    it('floats inside a dialog without being part of the scrolling content', async () => {
        const Host = defineComponent({
            setup: () => () =>
                h('div', { role: 'dialog', id: 'host-dialog' }, [
                    h('div', { class: 'modal-body' }, [
                        h(SearchableSelect, { options, modelValue: null }),
                    ]),
                ]),
        });
        const wrapper = mount(Host, { attachTo: document.body });

        const listbox = await openSelect(wrapper);

        expect(listbox.closest('#host-dialog')).not.toBeNull();
        expect(listbox.closest('.modal-body')).toBeNull();
        expect(listbox.className).toContain('absolute');
        wrapper.unmount();
    });
});

