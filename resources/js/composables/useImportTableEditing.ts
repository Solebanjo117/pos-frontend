import { ref, type Ref } from 'vue';

export interface ImportCellEdit {
    rowIndex: number;
    columnKey: string;
    previousValue: unknown;
    nextValue: unknown;
}

export interface UseImportTableEditingOptions<
    TRow extends Record<string, unknown>,
> {
    rows: Ref<TRow[]>;
    rowIndex: (row: TRow) => number;
    afterEdit: (edit: ImportCellEdit) => void;
    maxHistory?: number;
}

export function useImportTableEditing<TRow extends Record<string, unknown>>({
    rows,
    rowIndex,
    afterEdit,
    maxHistory = 100,
}: UseImportTableEditingOptions<TRow>) {
    const selectedRows = ref<Set<number>>(new Set());
    const undoStack = ref<ImportCellEdit[]>([]);
    const redoStack = ref<ImportCellEdit[]>([]);

    const commitCellEdit = (
        targetRowIndex: number,
        columnKey: string,
        nextValue: unknown,
        recordHistory = true,
    ): void => {
        const row = rows.value.find(
            (candidate) => rowIndex(candidate) === targetRowIndex,
        );
        if (!row) {
            return;
        }

        const previousValue = row[columnKey];
        if (previousValue === nextValue) {
            return;
        }

        (row as Record<string, unknown>)[columnKey] = nextValue;

        if (recordHistory) {
            undoStack.value.push({
                rowIndex: targetRowIndex,
                columnKey,
                previousValue,
                nextValue,
            });
            if (undoStack.value.length > maxHistory) {
                undoStack.value.shift();
            }
            redoStack.value = [];
        }

        afterEdit({
            rowIndex: targetRowIndex,
            columnKey,
            previousValue,
            nextValue,
        });
    };

    const undoCellEdit = (): void => {
        const edit = undoStack.value.pop();
        if (!edit) {
            return;
        }

        commitCellEdit(
            edit.rowIndex,
            edit.columnKey,
            edit.previousValue,
            false,
        );
        redoStack.value.push(edit);
    };

    const redoCellEdit = (): void => {
        const edit = redoStack.value.pop();
        if (!edit) {
            return;
        }

        commitCellEdit(edit.rowIndex, edit.columnKey, edit.nextValue, false);
        undoStack.value.push(edit);
    };

    const clearEditingState = (): void => {
        selectedRows.value = new Set();
        undoStack.value = [];
        redoStack.value = [];
    };

    return {
        selectedRows,
        undoStack,
        redoStack,
        commitCellEdit,
        undoCellEdit,
        redoCellEdit,
        clearEditingState,
    };
}
