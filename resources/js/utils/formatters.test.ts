import { describe, expect, it, vi, afterEach } from 'vitest';
import { formatDuration } from './formatters';

describe('formatDuration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns seconds for differences under 60 seconds', () => {
        const from = new Date('2026-08-17T10:00:00');
        const to = new Date('2026-08-17T10:00:45');

        expect(formatDuration(from, to)).toBe('45s');
    });

    it('returns zero seconds for equal timestamps', () => {
        const ts = new Date('2026-08-17T10:00:00');

        expect(formatDuration(ts, ts)).toBe('0s');
    });

    it('returns minutes for differences under 60 minutes', () => {
        const from = new Date('2026-08-17T10:00:00');
        const to = new Date('2026-08-17T10:12:00');

        expect(formatDuration(from, to)).toBe('12m');
    });

    it('returns hours for differences under 24 hours', () => {
        const from = new Date('2026-08-17T10:00:00');
        const to = new Date('2026-08-17T13:00:00');

        expect(formatDuration(from, to)).toBe('3h');
    });

    it('returns days for differences under 30 days', () => {
        const from = new Date('2026-08-01T10:00:00');
        const to = new Date('2026-08-05T10:00:00');

        expect(formatDuration(from, to)).toBe('4d');
    });

    it('returns months for differences >= 30 days', () => {
        const from = new Date('2026-01-01T10:00:00');
        const to = new Date('2026-03-15T10:00:00');

        expect(formatDuration(from, to)).toBe('2 meses');
    });

    it('returns singular "1 mes" for exactly 1 month', () => {
        const from = new Date('2026-06-17T10:00:00');
        const to = new Date('2026-07-17T10:00:00');

        expect(formatDuration(from, to)).toBe('1 mes');
    });

    it('returns years for differences >= 365 days', () => {
        const from = new Date('2024-08-17T10:00:00');
        const to = new Date('2026-08-17T10:00:00');

        expect(formatDuration(from, to)).toBe('2 años');
    });

    it('returns singular "1 año" for exactly 1 year', () => {
        const from = new Date('2025-08-17T10:00:00');
        const to = new Date('2026-08-17T10:00:00');

        expect(formatDuration(from, to)).toBe('1 año');
    });

    it('accepts ISO string inputs', () => {
        expect(
            formatDuration('2026-08-17T10:00:00', '2026-08-17T10:05:00'),
        ).toBe('5m');
    });

    it('defaults to now when to is omitted', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-17T10:05:00'));

        expect(formatDuration('2026-08-17T10:00:00')).toBe('5m');
    });

    it('clamps negative differences to 0s', () => {
        const from = new Date('2026-08-17T11:00:00');
        const to = new Date('2026-08-17T10:00:00');

        expect(formatDuration(from, to)).toBe('0s');
    });

    it('returns empty string for invalid dates', () => {
        expect(formatDuration('not-a-date', '2026-08-17T10:00:00')).toBe('');
        expect(formatDuration('2026-08-17T10:00:00', 'invalid')).toBe('');
    });
});
