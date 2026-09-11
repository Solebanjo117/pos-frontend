import { onMounted, ref, type Ref } from 'vue';

export interface ReorderableColumn {
    key: string;
    label: string;
}

export function useReorderableColumns<T extends ReorderableColumn>(
    defaultColumns: readonly T[],
    storageKey: string,
): {
    columns: Ref<T[]>;
    draggedColumnKey: Ref<string | null>;
    moveColumn: (fromIndex: number, toIndex: number) => void;
    dropColumn: (targetKey: string) => void;
} {
    const columns = ref<T[]>([...defaultColumns]) as Ref<T[]>;
    const draggedColumnKey = ref<string | null>(null);

    const persist = (): void => {
        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify(columns.value.map((column) => column.key)),
            );
        } catch {
            // The table remains reorderable when storage is unavailable.
        }
    };

    const moveColumn = (fromIndex: number, toIndex: number): void => {
        if (
            fromIndex < 0 ||
            toIndex < 0 ||
            toIndex >= columns.value.length ||
            fromIndex === toIndex
        ) {
            return;
        }

        const [column] = columns.value.splice(fromIndex, 1);
        columns.value.splice(toIndex, 0, column);
        persist();
    };

    const dropColumn = (targetKey: string): void => {
        if (!draggedColumnKey.value) {
            return;
        }

        moveColumn(
            columns.value.findIndex(
                (column) => column.key === draggedColumnKey.value,
            ),
            columns.value.findIndex((column) => column.key === targetKey),
        );
        draggedColumnKey.value = null;
    };

    onMounted(() => {
        try {
            const storedValue: unknown = JSON.parse(
                localStorage.getItem(storageKey) ?? '[]',
            );
            if (!Array.isArray(storedValue)) {
                return;
            }

            const savedKeys = storedValue.filter(
                (key): key is string =>
                    typeof key === 'string' &&
                    defaultColumns.some((column) => column.key === key),
            );
            const uniqueKeys = [...new Set(savedKeys)];
            columns.value = [
                ...uniqueKeys.map(
                    (key) =>
                        defaultColumns.find((column) => column.key === key)!,
                ),
                ...defaultColumns.filter(
                    (column) => !uniqueKeys.includes(column.key),
                ),
            ];
        } catch {
            columns.value = [...defaultColumns];
        }
    });

    return { columns, draggedColumnKey, moveColumn, dropColumn };
}
