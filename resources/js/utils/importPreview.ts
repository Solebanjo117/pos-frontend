import type { ImportActionType, ImportRow } from '@/types/import';

export interface ImportSearchableSelectOption {
    value: string | number;
    label: string;
}

/**
 * Las importaciones que no calculan una acción en el servidor (vehículos,
 * categorías, marcas, proveedores) se muestran como "Lista" o "Inválida"
 * según su validación actual.
 */
export const rowActionType = (
    row: Pick<ImportRow, '__action_type' | '__valid'>,
): ImportActionType => row.__action_type ?? (row.__valid ? 'ready' : 'invalid');

/**
 * Agrega como opción los textos que no coinciden con un registro existente,
 * para columnas cuyo importador crea el registro faltante (ej. marca de vehículo).
 */
export const withPendingSearchableOptions = (
    options: ImportSearchableSelectOption[],
    rawValues: unknown[],
): ImportSearchableSelectOption[] => {
    const knownValues = new Set(options.map((option) => option.value));
    const pending: ImportSearchableSelectOption[] = [];

    rawValues.forEach((rawValue) => {
        if (typeof rawValue !== 'string') return;
        if (rawValue.trim() === '' || /^\d+$/.test(rawValue.trim())) return;
        if (knownValues.has(rawValue)) return;

        knownValues.add(rawValue);
        pending.push({ value: rawValue, label: `${rawValue.trim()} (nueva)` });
    });

    return [...options, ...pending];
};
