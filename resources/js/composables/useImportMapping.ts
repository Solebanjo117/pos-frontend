import { computed, ref } from 'vue';

export type ImportMappingSource =
    | 'empty'
    | 'suggested'
    | 'manual'
    | 'profile'
    | 'draft'
    | 'history';

export type ImportMapping = Record<string, string>;

const normalizeMapping = (mapping: ImportMapping | null | undefined) =>
    mapping ?? {};

export function hasUsableMapping(
    mapping: ImportMapping | null | undefined,
): boolean {
    return Object.values(normalizeMapping(mapping)).some(
        (target) => target !== '' && target !== 'ignore',
    );
}

export function hasExplicitMapping(
    mapping: ImportMapping | null | undefined,
): boolean {
    return Object.entries(normalizeMapping(mapping)).some(
        ([source, target]) => source !== '' && target !== '',
    );
}

export function mappingsAreEqual(
    first: ImportMapping | null | undefined,
    second: ImportMapping | null | undefined,
): boolean {
    const normalizedFirst = normalizeMapping(first);
    const normalizedSecond = normalizeMapping(second);
    const firstKeys = Object.keys(normalizedFirst);
    const secondKeys = Object.keys(normalizedSecond);

    if (firstKeys.length !== secondKeys.length) {
        return false;
    }

    return firstKeys.every(
        (key) => normalizedFirst[key] === normalizedSecond[key],
    );
}

export function useImportMapping() {
    const fieldMapping = ref<ImportMapping>({});
    const mappingSource = ref<ImportMappingSource>('empty');

    const hasMapping = computed(() => hasUsableMapping(fieldMapping.value));
    const hasExplicitMappingValue = computed(() =>
        hasExplicitMapping(fieldMapping.value),
    );

    const resetMapping = (): void => {
        fieldMapping.value = {};
        mappingSource.value = 'empty';
    };

    const replaceMapping = (
        mapping: ImportMapping | null | undefined,
        source: ImportMappingSource,
    ): void => {
        fieldMapping.value = { ...normalizeMapping(mapping) };
        mappingSource.value = hasExplicitMappingValue.value ? source : 'empty';
    };

    const applySuggestedMappingIfPristine = (
        suggestedMapping: ImportMapping | null | undefined,
    ): void => {
        if (mappingSource.value !== 'empty' && hasExplicitMappingValue.value) {
            return;
        }

        replaceMapping(suggestedMapping, 'suggested');
    };

    const updateFieldMapping = (columnKey: string, value: string): void => {
        fieldMapping.value = {
            ...fieldMapping.value,
            [columnKey]: value,
        };
        mappingSource.value = 'manual';
    };

    return {
        fieldMapping,
        mappingSource,
        hasMapping,
        hasExplicitMapping: hasExplicitMappingValue,
        resetMapping,
        replaceMapping,
        applySuggestedMappingIfPristine,
        updateFieldMapping,
    };
}
