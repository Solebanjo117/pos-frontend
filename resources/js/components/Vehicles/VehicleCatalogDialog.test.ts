// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import VehicleCatalogDialog from './VehicleCatalogDialog.vue';

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
        props: ['modelValue', 'options', 'disabled'],
        emits: ['update:modelValue'],
        template:
            '<select :disabled="disabled" :value="modelValue" @change="$emit(\'update:modelValue\', Number($event.target.value))"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    },
};

const baseProps = {
    open: true,
    row: null,
    makes: [
        {
            id: 1,
            name: 'Toyota',
            models_count: 1,
            engines_count: 1,
            vehicles_count: 1,
            can_edit: true,
            can_delete: true,
        },
        {
            id: 5,
            name: 'Honda',
            models_count: 1,
            engines_count: 0,
            vehicles_count: 0,
            can_edit: true,
            can_delete: true,
        },
    ],
    models: [
        {
            id: 2,
            make_id: 1,
            name: 'Corolla',
            year_from: 2020,
            year_to: 2026,
            engines_count: 1,
            vehicles_count: 1,
            can_edit: true,
            can_delete: true,
        },
        {
            id: 4,
            make_id: 1,
            name: 'Yaris',
            year_from: 2021,
            year_to: 2026,
            engines_count: 1,
            vehicles_count: 0,
            can_edit: true,
            can_delete: true,
        },
        {
            id: 6,
            make_id: 5,
            name: 'Civic',
            year_from: 2020,
            year_to: 2026,
            engines_count: 0,
            vehicles_count: 0,
            can_edit: true,
            can_delete: true,
        },
    ],
    engines: [
        {
            id: 3,
            make_id: 1,
            engine_code: '2ZR-FE',
            vehicles_count: 1,
            can_edit: true,
            can_delete: true,
        },
    ],
    chassis: [],
    processing: false,
};

describe('VehicleCatalogDialog', () => {
    it('shows dependent model engine and VIN fields for a vehicle configuration', async () => {
        const wrapper = mount(VehicleCatalogDialog, {
            props: { ...baseProps, tab: 'vehicles' },
            global: { stubs },
        });

        expect(wrapper.text()).toContain('Relaciona un modelo con un motor');
        expect(wrapper.text()).toContain('Modelo');
        expect(wrapper.text()).toContain('Motor');
        expect(wrapper.text()).toContain('VIN registrados');

        const addButton = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Agregar VIN'));
        await addButton?.trigger('click');
        expect(wrapper.find('input[placeholder="VIN"]').exists()).toBe(true);
    });

    it('blocks incomplete data and emits numeric IDs with the exact create payload', async () => {
        const wrapper = mount(VehicleCatalogDialog, {
            props: { ...baseProps, tab: 'vehicles' },
            global: { stubs },
        });

        const selects = wrapper.findAll('select');
        const saveButton = wrapper
            .findAll('button')
            .find((button) => button.text() === 'Guardar');
        expect(saveButton?.attributes('disabled')).toBeDefined();

        await selects[0].setValue('2');
        await selects[1].setValue('3');
        expect(saveButton?.attributes('disabled')).toBeUndefined();

        const addButton = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Agregar VIN'));
        await addButton?.trigger('click');
        await wrapper.get('input[placeholder="VIN"]').setValue(' vin-001 ');
        await wrapper
            .get('input[placeholder="Notas opcionales"]')
            .setValue(' Principal ');
        await wrapper.get('form').trigger('submit');

        expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
            model_id: 2,
            engine_id: 3,
            vins: [{ vin: 'VIN-001', notes: 'Principal' }],
        });
    });

    it('clears the selected engine whenever the model changes', async () => {
        const wrapper = mount(VehicleCatalogDialog, {
            props: { ...baseProps, tab: 'vehicles' },
            global: { stubs },
        });
        const selects = wrapper.findAll('select');

        await selects[0].setValue('2');
        await selects[1].setValue('3');
        expect(
            wrapper
                .findAll('button')
                .find((button) => button.text() === 'Guardar')
                ?.attributes('disabled'),
        ).toBeUndefined();

        await selects[0].setValue('4');
        expect((selects[1].element as HTMLSelectElement).value).toBe('');
        expect(
            wrapper
                .findAll('button')
                .find((button) => button.text() === 'Guardar')
                ?.attributes('disabled'),
        ).toBeDefined();
    });

    it('clears related models when the engine make changes', async () => {
        const wrapper = mount(VehicleCatalogDialog, {
            props: { ...baseProps, tab: 'engines' },
            global: { stubs },
        });
        const makeSelect = wrapper.findAll('select')[0];

        await makeSelect.setValue('1');
        await wrapper.get('input[type="checkbox"]').setValue(true);
        await wrapper.get('input[placeholder="Ej: 2ZR-FE"]').setValue('2ZR-FE');
        await makeSelect.setValue('5');
        await wrapper.get('form').trigger('submit');

        expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
            make_id: 5,
            model_ids: [],
            engine_code: '2ZR-FE',
        });
    });

    it('sends the full engine sheet with valves cam type cylinders and nickname', async () => {
        const wrapper = mount(VehicleCatalogDialog, {
            props: { ...baseProps, tab: 'engines' },
            global: { stubs },
        });

        await wrapper.findAll('select')[0].setValue('1');
        await wrapper.get('#vehicle-engine-code').setValue('2L');
        await wrapper.get('#vehicle-engine-nickname').setValue(' buzo ');
        await wrapper.get('#vehicle-engine-displacement').setValue('2.4L');
        await wrapper.get('#vehicle-engine-valves').setValue('8V');
        await wrapper.get('#vehicle-engine-cam').setValue('SOHC');
        await wrapper.get('#vehicle-engine-cylinders').setValue('4');
        await wrapper.get('form').trigger('submit');

        expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
            engine_code: '2L',
            nickname: 'buzo',
            displacement: '2.4L',
            valves: '8V',
            cam_type: 'SOHC',
            cylinders: 4,
        });
    });

    it('sends empty engine sheet fields as null', async () => {
        const wrapper = mount(VehicleCatalogDialog, {
            props: { ...baseProps, tab: 'engines' },
            global: { stubs },
        });

        await wrapper.findAll('select')[0].setValue('1');
        await wrapper.get('#vehicle-engine-code').setValue('1NZFE');
        await wrapper.get('form').trigger('submit');

        expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
            nickname: null,
            valves: null,
            cam_type: null,
            cylinders: null,
        });
    });

    it('locks the pair and linked VIN while preserving its data', async () => {
        const wrapper = mount(VehicleCatalogDialog, {
            props: {
                ...baseProps,
                tab: 'vehicles',
                row: {
                    key: '2:3',
                    make: { id: 1, name: 'Toyota' },
                    model: {
                        id: 2,
                        name: 'Corolla',
                        year_from: 2020,
                        year_to: 2026,
                    },
                    engine: { id: 3, engine_code: '2ZR-FE' },
                    vins: [
                        {
                            id: 4,
                            vin: 'CUSTOMER-VIN',
                            is_customer_linked: true,
                        },
                    ],
                    vins_count: 1,
                    can_edit: true,
                    can_delete: false,
                    delete_block_reason: 'Vinculada a un cliente.',
                },
            },
            global: { stubs },
        });
        await nextTick();

        expect(wrapper.text()).toContain('Vinculada a un cliente.');
        expect(
            wrapper
                .findAll('select')
                .every((select) => select.attributes('disabled') !== undefined),
        ).toBe(true);
        expect(
            wrapper.get('input[placeholder="VIN"]').attributes('disabled'),
        ).toBeDefined();
        expect(
            (
                wrapper.get('input[placeholder="VIN"]')
                    .element as HTMLInputElement
            ).value,
        ).toBe('CUSTOMER-VIN');
    });

    it('preserves an open-ended model year range when editing other fields', async () => {
        const openEndedModel = { ...baseProps.models[0], year_to: null };
        const wrapper = mount(VehicleCatalogDialog, {
            props: {
                ...baseProps,
                tab: 'models',
                row: openEndedModel,
                models: [openEndedModel],
            },
            global: { stubs },
        });
        await nextTick();

        expect(
            wrapper.get('#vehicle-year-to').attributes('required'),
        ).toBeUndefined();
        await wrapper.get('form').trigger('submit');

        expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
            name: 'Corolla',
            year_from: 2020,
        });
        expect(wrapper.emitted('save')?.[0]?.[0]).not.toHaveProperty('year_to');
    });

    describe('chasis del modelo', () => {
        const chassis = [
            { id: 11, code: 'E110', model: { make: { id: 1 } } },
            { id: 12, code: 'E120', models: [{ make: { id: 1 } }] },
            { id: 13, code: 'RD1', model: { make: { id: 5 } } },
        ];

        it('lists only the chassis of the chosen make and sends the selected one', async () => {
            const wrapper = mount(VehicleCatalogDialog, {
                props: { ...baseProps, tab: 'models', chassis },
                global: { stubs },
            });
            const [makeSelect, chassisSelect] = wrapper.findAll('select');

            await makeSelect.setValue('1');
            expect(
                chassisSelect.findAll('option').map((option) => option.text()),
            ).toEqual(['E110', 'E120']);

            await wrapper.get('#vehicle-model-name').setValue('Corolla');
            await chassisSelect.setValue('12');
            await wrapper.get('form').trigger('submit');

            expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
                make_id: 1,
                chassis_id: 12,
                generation: null,
            });
        });

        it('creates a new chassis code in uppercase', async () => {
            const wrapper = mount(VehicleCatalogDialog, {
                props: { ...baseProps, tab: 'models', chassis },
                global: { stubs },
            });

            await wrapper.findAll('select')[0].setValue('1');
            await wrapper.get('#vehicle-model-name').setValue('Corolla');
            await wrapper
                .findAll('button')
                .find((button) => button.text() === '+ Nuevo código')!
                .trigger('click');
            await wrapper.get('#vehicle-chassis-code').setValue(' e140 ');
            await wrapper.get('form').trigger('submit');

            expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
                chassis_id: null,
                generation: 'E140',
            });
        });

        it('shows the current chassis of the model when editing', async () => {
            const row = { ...baseProps.models[0], generation: 'E120' };
            const wrapper = mount(VehicleCatalogDialog, {
                props: { ...baseProps, tab: 'models', row, chassis },
                global: { stubs },
            });
            await nextTick();

            expect(
                (wrapper.findAll('select')[1].element as HTMLSelectElement)
                    .value,
            ).toBe('12');
        });
    });
});
