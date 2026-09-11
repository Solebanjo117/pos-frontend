// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import apiClient from '@/services/api/client';
import { useCashierQueue } from './useCashierQueue';

vi.mock('@/services/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

describe('useCashierQueue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the paginated total for the pending counter', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({
            data: {
                data: Array.from({ length: 100 }, (_, index) => ({
                    id: index + 1,
                })),
                meta: { total: 137 },
            },
        });

        const wrapper = mount(
            defineComponent({
                setup() {
                    const { count, fetchPending } = useCashierQueue();
                    void fetchPending();

                    return { count };
                },
                template: '<span data-test="count">{{ count }}</span>',
            }),
        );
        await flushPromises();

        expect(wrapper.get('[data-test="count"]').text()).toBe('137');
    });
});
