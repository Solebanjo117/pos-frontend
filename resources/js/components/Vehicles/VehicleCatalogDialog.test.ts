// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import VehicleCatalogDialog from './VehicleCatalogDialog.vue';

const stubs = {
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
});
