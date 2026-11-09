import {
    engineSheet,
    type VehicleConfigurationRow,
} from '@/composables/useVehicleCatalog';
import type {
    ProductVehicleCompatibilityPayload,
    VehicleCompatibility,
} from '@/types/product';

/** Vehículo exacto (modelo + motor) asignado a un producto. */
export interface VehicleFitmentEntry {
    model_id: number;
    engine_id: number;
    make: string;
    model: string;
    generation: string | null;
    years: string;
    engine: string;
    engine_sheet: string;
}

/** Asignación anterior (marca, modelo, motor, chasis, texto libre…) que se conserva tal cual. */
export interface LegacyFitmentEntry {
    id: number;
    label: string;
    /** Los registros "universal" no son un carro y no pueden ser el principal. */
    canBeDefault?: boolean;
}

export interface DraftCompatData {
    vehicles: VehicleFitmentEntry[];
    legacy: LegacyFitmentEntry[];
    isUniversal: boolean;
    /** Clave del carro principal (fitmentKey o legacyKey). Si falta o ya no existe, se usa el primero. */
    defaultKey?: string | null;
}

export const emptyCompatDraft = (): DraftCompatData => ({
    vehicles: [],
    legacy: [],
    isUniversal: false,
    defaultKey: null,
});

export const fitmentKey = (vehicle: {
    model_id: number;
    engine_id: number;
}): string => `${vehicle.model_id}:${vehicle.engine_id}`;

export const legacyKey = (record: { id: number }): string =>
    `legacy:${record.id}`;

/** Claves que pueden ser principal, en orden: vehículos exactos y luego asignaciones anteriores. */
const defaultCandidates = (draft: DraftCompatData): string[] =>
    draft.isUniversal
        ? []
        : [
              ...draft.vehicles.map(fitmentKey),
              ...draft.legacy
                  .filter((record) => record.canBeDefault !== false)
                  .map(legacyKey),
          ];

/**
 * Carro principal efectivo: el elegido si sigue asignado; si no, el primero. Así siempre hay uno
 * cuando el producto tiene carros (y ninguno si es universal o no tiene).
 */
export const effectiveDefaultKey = (draft: DraftCompatData): string | null => {
    const candidates = defaultCandidates(draft);
    if (draft.defaultKey && candidates.includes(draft.defaultKey)) {
        return draft.defaultKey;
    }
    return candidates[0] ?? null;
};

const yearsLabel = (from?: number | null, to?: number | null): string => {
    if (from && to) return from === to ? String(from) : `${from}-${to}`;
    return from ? `${from}+` : '';
};

/** "1998-1999" a partir de "1998-1999" o de "-" (modelo sin años). */
const cleanYearRange = (value?: string | null): string => {
    const years = String(value ?? '').match(/\d{4}/g) ?? [];
    if (years.length >= 2) return `${years[0]}-${years[1]}`;
    return years[0] ?? '';
};

export const fitmentTitle = (vehicle: VehicleFitmentEntry): string =>
    [vehicle.make, vehicle.model, vehicle.generation].filter(Boolean).join(' ');

export const fitmentFromConfiguration = (
    row: VehicleConfigurationRow,
): VehicleFitmentEntry => ({
    model_id: row.model.id,
    engine_id: row.engine.id,
    make: row.make.name,
    model: row.model.name,
    generation: row.model.generation ?? null,
    years: yearsLabel(row.model.year_from, row.model.year_to),
    engine: row.engine.nickname
        ? `${row.engine.engine_code} (${row.engine.nickname})`
        : row.engine.engine_code,
    engine_sheet: engineSheet(row.engine),
});

const legacyLabel = (record: VehicleCompatibility): string => {
    const vehicle = [record.make, record.model, record.generation]
        .filter(Boolean)
        .join(' ');
    const years = cleanYearRange(record.year_range);
    const base = [vehicle, years].filter(Boolean).join(' ');

    switch (record.scope_type) {
        case 'make':
            return `Toda la marca ${record.make ?? ''}`.trim();
        case 'model':
            if (record.all_engines) return `${base} · todos los motores`;
            if (record.all_chassis) return `${base} · todos los chasis`;
            return `${base} · todo el modelo`;
        case 'engine':
            return `Motor ${record.engine ?? record.engine_code ?? ''}${base ? ` · ${base}` : ''}`;
        case 'chassis':
            return `Chasis ${record.chassis?.code ?? ''}${base ? ` · ${base}` : ''}`;
        case 'raw':
            return `Texto: ${record.raw_vehicle_text ?? ''}`;
        case 'universal':
            return 'Universal (todos los vehículos)';
        default:
            return base || 'Compatibilidad sin detalle';
    }
};

/** Separa la compatibilidad guardada en vehículos exactos y asignaciones anteriores. */
export const draftFromCompatibility = (
    records: VehicleCompatibility[] = [],
    isUniversal = false,
): DraftCompatData => ({
    vehicles: records
        .filter(
            (record) =>
                record.scope_type === 'vehicle' &&
                record.model_id &&
                record.engine_id,
        )
        .map((record) => ({
            model_id: Number(record.model_id),
            engine_id: Number(record.engine_id),
            make: String(record.make ?? ''),
            model: String(record.model ?? ''),
            generation: record.generation ?? null,
            years: cleanYearRange(record.year_range),
            engine: String(record.engine_code ?? ''),
            engine_sheet: String(record.engine ?? ''),
        })),
    legacy: records
        .filter(
            (record): record is VehicleCompatibility & { id: number } =>
                record.scope_type !== 'vehicle' && Boolean(record.id),
        )
        .map((record) => ({
            id: record.id,
            label: legacyLabel(record),
            canBeDefault: record.scope_type !== 'universal',
        })),
    isUniversal,
    defaultKey: defaultKeyFromRecords(records),
});

/** Clave del registro marcado como principal en lo guardado. */
const defaultKeyFromRecords = (
    records: VehicleCompatibility[],
): string | null => {
    const record = records.find((item) => item.is_default);
    if (!record) return null;
    if (
        record.scope_type === 'vehicle' &&
        record.model_id &&
        record.engine_id
    ) {
        return fitmentKey({
            model_id: Number(record.model_id),
            engine_id: Number(record.engine_id),
        });
    }
    return record.id ? legacyKey({ id: record.id }) : null;
};

/** Lo que se envía al guardar: vehículos exactos + ids de asignaciones anteriores que se conservan. */
export const vehicleCompatibilityPayload = (
    draft: DraftCompatData,
): ProductVehicleCompatibilityPayload => {
    const seen = new Set<string>();

    return {
        vehicles: draft.vehicles
            .filter((vehicle) => {
                const key = fitmentKey(vehicle);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map(({ model_id, engine_id }) => ({ model_id, engine_id })),
        keep_ids: draft.legacy.map((record) => record.id),
        default: defaultPayload(draft),
    };
};

const defaultPayload = (
    draft: DraftCompatData,
): ProductVehicleCompatibilityPayload['default'] => {
    const key = effectiveDefaultKey(draft);
    if (!key) return null;
    if (key.startsWith('legacy:')) return { id: Number(key.slice(7)) };
    const vehicle = draft.vehicles.find((item) => fitmentKey(item) === key);
    return vehicle
        ? { model_id: vehicle.model_id, engine_id: vehicle.engine_id }
        : null;
};
