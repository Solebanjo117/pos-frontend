import { describe, expect, it } from 'vitest';
import type { VehicleConfigurationRow } from '@/composables/useVehicleCatalog';
import {
    draftFromCompatibility,
    effectiveDefaultKey,
    fitmentFromConfiguration,
    fitmentKey,
    fitmentTitle,
    legacyKey,
    vehicleCompatibilityPayload,
} from './vehicleFitment';

const corollaRow: VehicleConfigurationRow = {
    key: '7:9',
    make: { id: 1, name: 'TOYOTA' },
    model: {
        id: 7,
        name: 'COROLLA',
        year_from: 1998,
        year_to: 1999,
        generation: 'E110',
    },
    engine: {
        id: 9,
        engine_code: '1ZZFE',
        displacement: '1.8L',
        valves: '16V',
        cam_type: 'DOHC',
    },
    vins: [],
    vins_count: 0,
    can_edit: true,
    can_delete: true,
    delete_block_reason: null,
};

describe('vehicle fitment helpers', () => {
    it('builds an assigned vehicle from a catalog row', () => {
        const vehicle = fitmentFromConfiguration(corollaRow);

        expect(vehicle).toMatchObject({
            model_id: 7,
            engine_id: 9,
            years: '1998-1999',
            engine: '1ZZFE',
            engine_sheet: '1.8L 16V DOHC',
        });
        expect(fitmentTitle(vehicle)).toBe('TOYOTA COROLLA E110');
    });

    it('shows the engine nickname next to the code', () => {
        const vehicle = fitmentFromConfiguration({
            ...corollaRow,
            engine: {
                ...corollaRow.engine,
                engine_code: '2L',
                nickname: 'BUZO',
            },
        });

        expect(vehicle.engine).toBe('2L (BUZO)');
    });

    it('splits saved compatibility into exact vehicles and previous assignments', () => {
        const draft = draftFromCompatibility(
            [
                {
                    id: 1,
                    scope_type: 'vehicle',
                    model_id: 7,
                    engine_id: 9,
                    make: 'TOYOTA',
                    model: 'COROLLA',
                    generation: 'E110',
                    year_range: '1998-1999',
                    engine: '1.8L 16V DOHC 1ZZFE',
                    engine_code: '1ZZFE',
                },
                { id: 2, scope_type: 'raw', raw_vehicle_text: 'Corolla AE100' },
                { id: 3, scope_type: 'make', make: 'TOYOTA' },
                {
                    id: 4,
                    scope_type: 'model',
                    make: 'TOYOTA',
                    model: 'YARIS',
                    year_range: '-',
                    all_engines: true,
                },
            ],
            false,
        );

        expect(draft.vehicles).toHaveLength(1);
        expect(draft.vehicles[0]).toMatchObject({
            model_id: 7,
            engine_id: 9,
            years: '1998-1999',
        });
        expect(draft.legacy).toEqual([
            { id: 2, label: 'Texto: Corolla AE100', canBeDefault: true },
            { id: 3, label: 'Toda la marca TOYOTA', canBeDefault: true },
            {
                id: 4,
                label: 'TOYOTA YARIS · todos los motores',
                canBeDefault: true,
            },
        ]);
        // Sin carro marcado como principal en lo guardado.
        expect(draft.defaultKey).toBeNull();
    });

    it('sends unique exact vehicles and the previous assignments to keep', () => {
        const vehicle = fitmentFromConfiguration(corollaRow);

        expect(
            vehicleCompatibilityPayload({
                vehicles: [vehicle, { ...vehicle }],
                legacy: [{ id: 2, label: 'Texto: Corolla AE100' }],
                isUniversal: false,
            }),
        ).toEqual({
            vehicles: [{ model_id: 7, engine_id: 9 }],
            keep_ids: [2],
            // Sin principal elegido se envía el primero.
            default: { model_id: 7, engine_id: 9 },
        });
    });

    it('reads the saved default vehicle and sends the chosen one', () => {
        const draft = draftFromCompatibility(
            [
                {
                    id: 1,
                    scope_type: 'vehicle',
                    model_id: 7,
                    engine_id: 9,
                    make: 'TOYOTA',
                    model: 'COROLLA',
                },
                {
                    id: 2,
                    scope_type: 'raw',
                    raw_vehicle_text: 'Corolla AE100',
                    is_default: true,
                },
            ],
            false,
        );

        expect(draft.defaultKey).toBe(legacyKey({ id: 2 }));
        expect(effectiveDefaultKey(draft)).toBe('legacy:2');
        expect(vehicleCompatibilityPayload(draft).default).toEqual({ id: 2 });

        const chosen = {
            ...draft,
            defaultKey: fitmentKey({ model_id: 7, engine_id: 9 }),
        };
        expect(vehicleCompatibilityPayload(chosen).default).toEqual({
            model_id: 7,
            engine_id: 9,
        });
    });

    it('falls back to the first vehicle when the default was removed, and has none when universal', () => {
        const vehicle = fitmentFromConfiguration(corollaRow);
        const draft = {
            vehicles: [vehicle],
            legacy: [
                { id: 5, label: 'Universal', canBeDefault: false },
                { id: 6, label: 'Texto: Hilux' },
            ],
            isUniversal: false,
            defaultKey: 'legacy:99',
        };

        expect(effectiveDefaultKey(draft)).toBe(fitmentKey(vehicle));
        expect(effectiveDefaultKey({ ...draft, vehicles: [] })).toBe(
            'legacy:6',
        );
        expect(effectiveDefaultKey({ ...draft, isUniversal: true })).toBeNull();
        expect(
            vehicleCompatibilityPayload({
                vehicles: [],
                legacy: [],
                isUniversal: false,
            }).default,
        ).toBeNull();
    });
});
