// @vitest-environment jsdom

import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuickVehicleDialog from './QuickVehicleDialog.vue';

// AppSelect funciona sobre el SearchableSelect simulado (un <select>): se elige por el texto visible.
const chooseByLabel = async (
    select: Omit<DOMWrapper<Element>, 'exists'>,
    label: string,
) => {
    const option = select
        .findAll('option')
        .find((item) => item.text().trim() === label);
    if (!option) throw new Error(`Opción "${label}" no encontrada`);
    await select.setValue(option.element.getAttribute('value'));
};

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/services/api/client', () => ({
    default: { get: mocks.get, post: mocks.post },
}));

const stubs = {
    AppModal: {
        props: ['open', 'title', 'description', 'size'],
        emits: ['close', 'update:open'],
        template:
            '<div v-if="open"><h2>{{ title }}</h2><p>{{ description }}</p><slot /><footer><slot name="footer" /></footer></div>',
    },
    Dialog: { template: '<div><slot /></div>' },
    DialogScrollContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
    DialogDescription: { template: '<p><slot /></p>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
    SearchableSelect: {
        props: ['modelValue', 'options', 'disabled', 'ariaLabel'],
        emits: ['update:modelValue'],
        template:
            '<select :aria-label="ariaLabel" :disabled="disabled" :value="modelValue" @change="$emit(\'update:modelValue\', Number($event.target.value))"><option value=""></option><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    },
};

const catalogGet = (pairedEngineIds: number[] = []) =>
    mocks.get.mockImplementation(async (url: string) => {
        if (url === '/vehicle-makes/all') {
            return { data: { data: [{ id: 1, name: 'TOYOTA' }] } };
        }
        if (url === '/vehicle-makes/1/models') {
            return {
                data: {
                    data: [
                        {
                            id: 7,
                            name: 'COROLLA',
                            generation: 'E110',
                            year_from: 1998,
                            year_to: 1999,
                        },
                    ],
                },
            };
        }
        if (url === '/vehicle-engines') {
            return {
                data: {
                    data: [
                        {
                            id: 9,
                            engine_code: '1ZZFE',
                            displacement: '1.8L',
                            valves: '16V',
                            cam_type: 'DOHC',
                        },
                    ],
                },
            };
        }
        if (url === '/vehicle-chassis') {
            return {
                data: {
                    data: [
                        { id: 50, code: 'E110' },
                        { id: 51, code: 'E120' },
                    ],
                },
            };
        }
        if (url === '/vehicle-models/7/engines') {
            return { data: { data: pairedEngineIds.map((id) => ({ id })) } };
        }
        if (/^\/vehicle-models\/\d+\/engines$/.test(url)) {
            return { data: { data: [] } };
        }
        throw new Error(`GET inesperado ${url}`);
    });

const mountDialog = () =>
    mount(QuickVehicleDialog, {
        props: { open: true },
        global: { stubs },
    });

const clickButton = async (
    wrapper: ReturnType<typeof mountDialog>,
    text: string,
) => {
    await wrapper
        .findAll('button')
        .find((button) => button.text().includes(text))!
        .trigger('click');
};

describe('QuickVehicleDialog', () => {
    beforeEach(() => {
        mocks.get.mockReset();
        mocks.post.mockReset();
    });

    it('pairs an existing model and engine and returns the assigned vehicle', async () => {
        catalogGet([]);
        mocks.post.mockResolvedValue({ data: { data: {} } });
        const wrapper = mountDialog();
        await flushPromises();

        await wrapper.get('select[aria-label="Marca"]').setValue('1');
        await flushPromises();
        await wrapper.get('select[aria-label="Modelo"]').setValue('7');
        await wrapper.get('select[aria-label="Motor"]').setValue('9');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post).toHaveBeenCalledWith('/vehicle-configurations', {
            model_id: 7,
            engine_id: 9,
        });
        expect(wrapper.emitted('created')?.[0]?.[0]).toEqual({
            model_id: 7,
            engine_id: 9,
            make: 'TOYOTA',
            model: 'COROLLA',
            generation: 'E110',
            years: '1998-1999',
            engine: '1ZZFE',
            engine_sheet: '1.8L 16V DOHC',
        });
    });

    it('does not register again a vehicle that already exists', async () => {
        catalogGet([9]);
        const wrapper = mountDialog();
        await flushPromises();

        await wrapper.get('select[aria-label="Marca"]').setValue('1');
        await flushPromises();
        await wrapper.get('select[aria-label="Modelo"]').setValue('7');
        await wrapper.get('select[aria-label="Motor"]').setValue('9');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.post).not.toHaveBeenCalled();
        expect(wrapper.emitted('created')).toHaveLength(1);
    });

    it('creates make model and engine when they are new', async () => {
        catalogGet();
        mocks.post.mockImplementation(async (url: string, body: any) => {
            if (url === '/vehicle-makes')
                return { data: { data: { id: 2, name: body.name } } };
            if (url === '/vehicle-models') {
                return { data: { data: { id: 20, ...body } } };
            }
            if (url === '/vehicle-engines')
                return { data: { data: { id: 30, ...body } } };
            throw new Error(`POST inesperado ${url}`);
        });
        const wrapper = mountDialog();
        await flushPromises();

        await clickButton(wrapper, '+ Nueva marca');
        await wrapper.get('#quick-vehicle-make').setValue('mitsubishi');
        await wrapper.get('#quick-vehicle-model').setValue('montero');
        await wrapper.get('#quick-vehicle-chassis-code').setValue('v20');
        await wrapper.get('#quick-vehicle-year-from').setValue('1991');
        await wrapper.get('#quick-vehicle-year-to').setValue('1999');
        await wrapper.get('#quick-vehicle-engine-code').setValue('6G72');
        await wrapper.get('#quick-vehicle-engine-valves').setValue('24V');
        await chooseByLabel(wrapper.get('#quick-vehicle-engine-cam'), 'SOHC');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.post.mock.calls.map(([url]) => url)).toEqual([
            '/vehicle-makes',
            '/vehicle-models',
            '/vehicle-engines',
        ]);
        expect(mocks.post).toHaveBeenCalledWith(
            '/vehicle-models',
            expect.objectContaining({ chassis_id: null, generation: 'V20' }),
        );
        expect(mocks.post).toHaveBeenCalledWith(
            '/vehicle-engines',
            expect.objectContaining({
                make_id: 2,
                model_ids: [20],
                valves: '24V',
                cam_type: 'SOHC',
            }),
        );
        expect(wrapper.emitted('created')?.[0]?.[0]).toMatchObject({
            model_id: 20,
            engine_id: 30,
            make: 'MITSUBISHI',
            model: 'MONTERO',
            years: '1991-1999',
        });
    });

    it('shows which step failed with the server message', async () => {
        catalogGet();
        mocks.post.mockRejectedValue({
            response: {
                data: {
                    errors: { name: ['Ya existe una marca con ese nombre.'] },
                },
            },
        });
        const wrapper = mountDialog();
        await flushPromises();

        await clickButton(wrapper, '+ Nueva marca');
        await wrapper.get('#quick-vehicle-make').setValue('TOYOTA');
        await wrapper.get('#quick-vehicle-model').setValue('YARIS');
        await wrapper.get('#quick-vehicle-engine-code').setValue('1NZFE');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(wrapper.get('[role="alert"]').text()).toBe(
            'No se pudo guardar la marca: Ya existe una marca con ese nombre.',
        );
        expect(wrapper.emitted('created')).toBeUndefined();
    });

    it('creates a new model on an existing chassis of the make', async () => {
        catalogGet();
        mocks.post.mockImplementation(async (url: string, body: any) => {
            if (url === '/vehicle-models') {
                return {
                    data: { data: { id: 21, ...body, generation: 'E120' } },
                };
            }
            return { data: { data: {} } };
        });
        const wrapper = mountDialog();
        await flushPromises();

        await wrapper.get('select[aria-label="Marca"]').setValue('1');
        await flushPromises();
        await clickButton(wrapper, '+ Nuevo modelo');
        await wrapper.get('#quick-vehicle-model').setValue('sprinter');
        await wrapper.get('select[aria-label="Chasis"]').setValue('51');
        await wrapper.get('select[aria-label="Motor"]').setValue('9');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(mocks.post).toHaveBeenCalledWith(
            '/vehicle-models',
            expect.objectContaining({
                name: 'SPRINTER',
                chassis_id: 51,
                generation: null,
            }),
        );
        expect(wrapper.emitted('created')?.[0]?.[0]).toMatchObject({
            model_id: 21,
            generation: 'E120',
        });
    });
});
