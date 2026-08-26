// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { getPosSessionDetailId, setPosSessionDetailId } from './posSessionUrl';

describe('pos session detail URL', () => {
    it('supports canonical and legacy traceability links', () => {
        expect(getPosSessionDetailId('/pos-sessions?session_id=42')).toBe(42);
        expect(getPosSessionDetailId('/pos-sessions?session=17')).toBe(17);
        expect(
            getPosSessionDetailId('/pos-sessions?session_id=invalid'),
        ).toBeNull();
    });

    it('preserves filters while adding or removing the selected session', () => {
        const opened = setPosSessionDetailId(
            '/pos-sessions?status=closed&page=2&session=8',
            21,
        );
        expect(opened).toBe('/pos-sessions?status=closed&page=2&session_id=21');

        expect(setPosSessionDetailId(opened, null)).toBe(
            '/pos-sessions?status=closed&page=2',
        );
    });
});
