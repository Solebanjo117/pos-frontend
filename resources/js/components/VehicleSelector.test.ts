// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VehicleSelector from './VehicleSelector.vue';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/services/api/client', () => ({
    default: { get },
}));

const engines = [
    {
        id: 10,
        engine_code: '2ZR-FE',
        displacement: '1.8L',
        fuel_type: 'Gasoline',
        aspiration: 'Natural',
    },
    {
        id: 11,
        engine_code: '2ZR-FE',
        displacement: '2.0L',
        fuel_type: 'Diesel',
        aspiration: 'Turbo',
    },
];

beforeEach(() => {
    get.mockReset();
    get.mockImplementation((url: string) => {
        if (url === '/vehicle-makes/all') {
            return Promise.resolve({
                data: { data: [{ id: 1, name: 'Toyota' }] },
            });
        }
        if (url === '/vehicle-makes/1/models') {
            return Promise.resolve({
                data: {
                    data: [
                        {
                            id: 2,
                            make_id: 1,
                            name: 'Corolla',
                            year_from: 2018,
                            year_to: 2025,
                        },
                    ],
                },
            });
        }
        if (url === '/vehicle-models/2/engines') {
            return Promise.resolve({ data: { data: engines } });
        }
        if (url === '/vehicle-configurations') {
            return Promise.resolve({
                data: {
                    data: [
                        {
                            key: '2:11',
                            make: { id: 1, name: 'Toyota' },
                            model: {
                                id: 2,
                                name: 'Corolla',
                                year_from: 2018,
                                year_to: 2025,
                            },
                            engine: engines[1],
                            vins: [],
                            vins_count: 0,
                        },
                    ],
                    meta: { total: 1 },
                },
            });
        }
        throw new Error(`Unexpected URL: ${url}`);
    });
});

describe('VehicleSelector', () => {
    it('restores an existing selection and keeps distinct engine IDs with the same code', async () => {
        const wrapper = mount(VehicleSelector, {
            props: {
                modelValue: {
                    make_id: 1,
                    model_id: 2,
                    engine_id: 11,
                    year: 2020,
                },
            },
        });
        await flushPromises();

        // Marca, modelo, año y motor: cada selector muestra la opción restaurada.
        const selects = wrapper.findAll('button[aria-haspopup="listbox"]');
        expect(selects[0].text()).toBe('Toyota');
        expect(selects[1].text()).toContain('Corolla');
        expect(selects[2].text()).toBe('2020');
        expect(selects[3].text()).toContain('2.0L');

        // El motor ofrece las dos variantes del mismo código (más la opción vacía).
        await selects[3].trigger('click');
        await flushPromises();
        const engineOptions = Array.from(
            document.body.querySelectorAll('li[role="option"]'),
        ).map((item) => item.textContent ?? '');
        expect(engineOptions).toHaveLength(3);
        expect(engineOptions.join(' ')).toContain('1.8L');
        expect(engineOptions.join(' ')).toContain('2.0L');
        wrapper.unmount();
    });

    it('uses combined catalog search and selects the exact model and engine pair', async () => {
        const wrapper = mount(VehicleSelector);
        await flushPromises();

        const input = wrapper.get('input[type="search"]');
        await input.setValue('toyota 2020 diesel');
        await input.trigger('keydown.enter');
        await flushPromises();

        expect(get).toHaveBeenCalledWith('/vehicle-configurations', {
            params: {
                page: 1,
                per_page: 20,
                search: 'toyota 2020 diesel',
                sort: 'make',
                direction: 'asc',
            },
        });

        await wrapper.get('button').trigger('click');
        await flushPromises();

        expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject(
            {
                make_id: 1,
                model_id: 2,
                engine_id: 11,
                year: 2020,
            },
        );
    });
});
