// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { useReorderableColumns } from './useReorderableColumns';

const defaultColumns = [
    { key: 'number', label: 'Número' },
    { key: 'customer', label: 'Cliente' },
    { key: 'total', label: 'Total' },
] as const;

const Harness = defineComponent({
    setup() {
        return useReorderableColumns(defaultColumns, 'test.columns');
    },
    render() {
        return h('div');
    },
});

const storedValues = new Map<string, string>();

beforeEach(() => {
    storedValues.clear();
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => storedValues.set(key, value),
    });
});

describe('useReorderableColumns', () => {
    it('reorders columns and restores the saved order', () => {
        const first = mount(Harness);
        first.vm.moveColumn(2, 0);

        expect(first.vm.columns.map((column) => column.key)).toEqual([
            'total',
            'number',
            'customer',
        ]);
        first.unmount();

        const restored = mount(Harness);
        expect(restored.vm.columns.map((column) => column.key)).toEqual([
            'total',
            'number',
            'customer',
        ]);
        restored.unmount();
    });
});
