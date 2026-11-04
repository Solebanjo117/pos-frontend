// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import SearchableSelect from './SearchableSelect.vue';

const options = [
    { value: 1, label: '555' },
    { value: 2, label: 'NIPPON PARTS AUTOMOTIVE DISTRIBUTION' },
];

describe('SearchableSelect', () => {
    afterEach(() => {
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
});
