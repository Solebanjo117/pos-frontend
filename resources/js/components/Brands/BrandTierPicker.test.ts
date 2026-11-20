// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import {
    brandOptionLabel,
    brandTierLabel,
    normalizeBrandTier,
} from '@/utils/brandTier';
import BrandTierPicker from './BrandTierPicker.vue';

describe('BrandTierPicker', () => {
    it('marca la gama actual y emite la elegida', async () => {
        const wrapper = mount(BrandTierPicker, {
            props: { modelValue: 'standard' },
        });

        expect(
            wrapper
                .get('[data-testid="brand-tier-standard"]')
                .attributes('aria-checked'),
        ).toBe('true');
        expect(
            wrapper
                .get('[data-testid="brand-tier-premium"]')
                .attributes('aria-checked'),
        ).toBe('false');

        await wrapper
            .get('[data-testid="brand-tier-premium"]')
            .trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([['premium']]);
    });

    it('trata como Standard las marcas sin gama', () => {
        expect(normalizeBrandTier('premium')).toBe('premium');
        expect(normalizeBrandTier('standard')).toBe('standard');
        expect(normalizeBrandTier(undefined)).toBe('standard');
        expect(normalizeBrandTier('otra')).toBe('standard');
        expect(brandTierLabel('premium')).toBe('Premium');
        expect(brandTierLabel(null)).toBe('Standard');
    });

    it('muestra la gama al lado del nombre en los selectores de marca', () => {
        expect(brandOptionLabel({ name: '555', tier: 'premium' })).toBe(
            '555 (Premium)',
        );
        expect(brandOptionLabel({ name: '777', tier: 'standard' })).toBe(
            '777 (Standard)',
        );
        expect(brandOptionLabel({ name: 'Sin gama' })).toBe(
            'Sin gama (Standard)',
        );
    });
});
