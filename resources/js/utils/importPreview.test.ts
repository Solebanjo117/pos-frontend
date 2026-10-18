import { describe, expect, it } from 'vitest';
import { rowActionType, withPendingSearchableOptions } from './importPreview';

describe('import preview row status', () => {
    it('keeps the action type sent by the server', () => {
        expect(rowActionType({ __action_type: 'update', __valid: true })).toBe(
            'update',
        );
        expect(
            rowActionType({ __action_type: 'conflict', __valid: false }),
        ).toBe('conflict');
    });

    it('marks rows without a server action as ready or invalid from their validation', () => {
        expect(rowActionType({ __action_type: undefined, __valid: true })).toBe(
            'ready',
        );
        expect(
            rowActionType({ __action_type: undefined, __valid: false }),
        ).toBe('invalid');
    });
});

describe('pending searchable options', () => {
    const makes = [
        { value: 3, label: 'TOYOTA' },
        { value: 4, label: 'ISUZU' },
    ];

    it('adds unresolved text values as new options once', () => {
        expect(
            withPendingSearchableOptions(makes, ['BMW', 3, 'BMW', ' ', null, 4]),
        ).toEqual([
            ...makes,
            { value: 'BMW', label: 'BMW (nueva)' },
        ]);
    });

    it('does not duplicate values that already exist or look like ids', () => {
        expect(
            withPendingSearchableOptions(
                [{ value: 'BMW', label: 'BMW' }],
                ['BMW', '12'],
            ),
        ).toEqual([{ value: 'BMW', label: 'BMW' }]);
    });
});
