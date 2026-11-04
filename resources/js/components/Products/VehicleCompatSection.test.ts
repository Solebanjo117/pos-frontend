// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftCompatData } from '@/utils/vehicleFitment';
import VehicleCompatSection from './VehicleCompatSection.vue';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    visit: vi.fn(),
    role: 'admin',
}));

vi.mock('@/services/api/client', () => ({
    default: { get: mocks.get },
}));

vi.mock('@inertiajs/vue3', () => ({
    usePage: () => ({ props: { auth: { user: { role: mocks.role } } } }),
    router: { visit: mocks.visit },
}));

const QuickVehicleDialogStub = {
    name: 'QuickVehicleDialog',
    props: ['open'],
    emits: ['close', 'created'],
    template: '<div v-if="open" data-test="quick-dialog" />',
};

const row = (modelId: number, model: string, generation: string) => ({
    key: `${modelId}:9`,
    make: { id: 1, name: 'TOYOTA' },
    model: {
        id: modelId,
        name: model,
        year_from: 2000,
        year_to: 2005,
        generation,
    },
    engine: { id: 9, engine_code: '1ZZFE', displacement: '1.8L' },
    vins: [],
    vins_count: 0,
    can_edit: true,
    can_delete: true,
    delete_block_reason: null,
});

const mountSection = (modelValue: DraftCompatData) =>
    mount(VehicleCompatSection, {
        props: { modelValue },
        global: { stubs: { QuickVehicleDialog: QuickVehicleDialogStub } },
    });

const buttonWithText = (
    wrapper: ReturnType<typeof mountSection>,
    text: string,
) => wrapper.findAll('button').find((button) => button.text().includes(text));

const lastEmitted = (wrapper: ReturnType<typeof mountSection>) =>
    wrapper.emitted('update:modelValue')?.at(-1)?.[0] as DraftCompatData;

describe('VehicleCompatSection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.role = 'admin';
        mocks.visit.mockReset();
        mocks.get.mockReset();
        mocks.get.mockResolvedValue({
            data: {
                data: [row(7, 'COROLLA', 'E120'), row(8, 'RAV4', 'A20')],
                meta: { total: 2 },
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('loads the vehicle list and assigns a vehicle when its row is clicked', async () => {
        const wrapper = mountSection({
            vehicles: [],
            legacy: [],
            isUniversal: false,
        });
        await flushPromises();

        expect(mocks.get).toHaveBeenCalledWith('/vehicle-configurations', {
            params: expect.objectContaining({ per_page: 25 }),
        });
        expect(wrapper.text()).toContain('TOYOTA COROLLA E120');

        await wrapper.findAll('tbody tr')[0].trigger('click');

        expect(lastEmitted(wrapper).vehicles).toEqual([
            expect.objectContaining({
                model_id: 7,
                engine_id: 9,
                generation: 'E120',
            }),
        ]);
    });

    it('searches the catalog with the typed text after a short pause', async () => {
        const wrapper = mountSection({
            vehicles: [],
            legacy: [],
            isUniversal: false,
        });
        await flushPromises();

        await wrapper.get('input[type="search"]').setValue('1zz');
        vi.advanceTimersByTime(300);
        await flushPromises();

        expect(mocks.get).toHaveBeenLastCalledWith('/vehicle-configurations', {
            params: expect.objectContaining({ search: '1zz' }),
        });
    });

    it('selects every shown vehicle that is not assigned yet', async () => {
        const wrapper = mountSection({
            vehicles: [
                {
                    model_id: 7,
                    engine_id: 9,
                    make: 'TOYOTA',
                    model: 'COROLLA',
                    generation: 'E120',
                    years: '2000-2005',
                    engine: '1ZZFE',
                    engine_sheet: '1.8L',
                },
            ],
            legacy: [],
            isUniversal: false,
        });
        await flushPromises();

        const selectAll = wrapper
            .findAll('button')
            .find((button) =>
                button.text().includes('Seleccionar los 1 mostrados'),
            );
        await selectAll!.trigger('click');

        expect(
            lastEmitted(wrapper).vehicles.map((vehicle) => vehicle.model_id),
        ).toEqual([7, 8]);
    });

    it('removes a previous assignment so it is not kept on save', async () => {
        const wrapper = mountSection({
            vehicles: [],
            legacy: [{ id: 5, label: 'Texto: Corolla AE100' }],
            isUniversal: false,
        });
        await flushPromises();

        expect(wrapper.text()).toContain('Texto: Corolla AE100');
        await wrapper
            .get('button[aria-label="Quitar Texto: Corolla AE100"]')
            .trigger('click');

        expect(lastEmitted(wrapper).legacy).toEqual([]);
    });

    it('clears assigned vehicles only after confirming the universal toggle', async () => {
        const confirm = vi.spyOn(window, 'confirm');
        const model: DraftCompatData = {
            vehicles: [],
            legacy: [{ id: 5, label: 'Toda la marca TOYOTA' }],
            isUniversal: false,
        };
        const wrapper = mountSection(model);
        await flushPromises();
        const universal = () =>
            wrapper
                .findAll('button')
                .find((button) => button.text().includes('Universal'))!;

        confirm.mockReturnValueOnce(false);
        await universal().trigger('click');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();

        confirm.mockReturnValueOnce(true);
        await universal().trigger('click');
        expect(lastEmitted(wrapper)).toEqual({
            vehicles: [],
            legacy: [],
            isUniversal: true,
        });
    });

    it('lets admins add a vehicle in a pop-up and assigns it to the product', async () => {
        const wrapper = mountSection({
            vehicles: [],
            legacy: [],
            isUniversal: false,
        });
        await flushPromises();
        mocks.get.mockClear();

        await buttonWithText(wrapper, 'Agregar vehículo')!.trigger('click');
        expect(wrapper.find('[data-test="quick-dialog"]').exists()).toBe(true);

        wrapper
            .findComponent({ name: 'QuickVehicleDialog' })
            .vm.$emit('created', {
                model_id: 20,
                engine_id: 30,
                make: 'TOYOTA',
                model: 'HILUX',
                generation: 'N80',
                years: '1990-2003',
                engine: '2L (BUZO)',
                engine_sheet: '2.4L 8V SOHC',
            });
        await flushPromises();

        expect(lastEmitted(wrapper).vehicles).toEqual([
            expect.objectContaining({ model_id: 20, engine_id: 30 }),
        ]);
        expect(wrapper.find('[data-test="quick-dialog"]').exists()).toBe(false);
        expect(mocks.get).toHaveBeenCalledWith(
            '/vehicle-configurations',
            expect.anything(),
        );
    });

    it('hides the add vehicle button for roles that cannot manage the catalog', async () => {
        mocks.role = 'buyer';
        const wrapper = mountSection({
            vehicles: [],
            legacy: [],
            isUniversal: false,
        });
        await flushPromises();

        expect(buttonWithText(wrapper, 'Agregar vehículo')).toBeUndefined();
    });

    it('opens the vehicle catalog in the same window only after confirming', async () => {
        const confirm = vi.spyOn(window, 'confirm');
        const wrapper = mountSection({
            vehicles: [],
            legacy: [],
            isUniversal: false,
        });
        await flushPromises();
        const link = wrapper.get('a[href="/vehicles?tab=vehicles"]');

        expect(link.attributes('target')).toBeUndefined();

        confirm.mockReturnValueOnce(false);
        await link.trigger('click');
        expect(mocks.visit).not.toHaveBeenCalled();

        confirm.mockReturnValueOnce(true);
        await link.trigger('click');
        expect(mocks.visit).toHaveBeenCalledWith('/vehicles?tab=vehicles');
    });
});
