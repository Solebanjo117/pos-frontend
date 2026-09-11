// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import DateRangeInput from './DateRangeInput.vue';

afterEach(() => {
    document.body.innerHTML = '';
});

describe('DateRangeInput', () => {
    it('shows three months and applies one click as a single-day range', async () => {
        const wrapper = mount(DateRangeInput, {
            attachTo: document.body,
            props: {
                from: '2026-06-01',
                to: '2026-08-26',
                persistToUrl: false,
            },
        });

        await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
        await nextTick();

        expect(document.body.querySelectorAll('[role="dialog"] section')).toHaveLength(3);

        const day = document.body.querySelector<HTMLButtonElement>(
            '[data-calendar-day="2026-06-15"]',
        );
        expect(day).not.toBeNull();
        day?.click();
        await nextTick();

        const applyButton = [...document.body.querySelectorAll('button')].find(
            (button) => button.textContent?.trim() === 'Aplicar',
        ) as HTMLButtonElement;
        applyButton.click();
        await nextTick();

        expect(wrapper.emitted('update:from')?.at(-1)).toEqual(['2026-06-15']);
        expect(wrapper.emitted('update:to')?.at(-1)).toEqual(['2026-06-15']);

        wrapper.unmount();
    });
});
