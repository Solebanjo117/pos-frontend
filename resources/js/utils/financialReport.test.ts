import { describe, expect, it } from 'vitest';
import {
    buildBalanceSheetUrl,
    buildFinancialReportUrl,
    financialReportFilterKey,
    financialReportRequestDecision,
    validateBalanceSheetDate,
    validateFinancialReportDates,
} from './financialReport';

describe('financial report filters', () => {
    it('validates complete ISO date ranges', () => {
        expect(validateFinancialReportDates('2026-07-01', '2026-07-22')).toBe(
            null,
        );
        expect(validateFinancialReportDates('', '2026-07-22')).toContain(
            'completo',
        );
        expect(
            validateFinancialReportDates('2026-02-30', '2026-07-22'),
        ).toContain('invalida');
        expect(
            validateFinancialReportDates('2026-07-23', '2026-07-22'),
        ).toContain('anterior');
    });

    it('updates only the date query parameters while preserving context', () => {
        expect(
            buildFinancialReportUrl(
                'https://hermexpos.app/reports/financial?tab=income&date_from=2026-01-01#statement',
                { date_from: '2026-07-01', date_to: '2026-07-22' },
            ),
        ).toBe(
            '/reports/financial?tab=income&date_from=2026-07-01&date_to=2026-07-22#statement',
        );
    });

    it('stores one Balance Sheet cutoff without deleting report context', () => {
        expect(validateBalanceSheetDate('2026-08-17')).toBeNull();
        expect(validateBalanceSheetDate('2026-02-30')).toContain('válida');
        expect(
            buildBalanceSheetUrl(
                'https://hermexpos.app/reports/financial?date_from=2026-08-01&date_to=2026-08-17',
                '2026-08-15',
            ),
        ).toBe(
            '/reports/financial?date_from=2026-08-01&date_to=2026-08-17&as_of=2026-08-15',
        );
    });

    it('ignores duplicate in-flight requests and queues changed filters', () => {
        const key = financialReportFilterKey({
            date_from: '2026-07-01',
            date_to: '2026-07-22',
            warehouse_id: 2,
        });

        expect(financialReportRequestDecision(null, key)).toBe('start');
        expect(financialReportRequestDecision(key, key)).toBe('ignore');
        expect(financialReportRequestDecision(key, `${key}-changed`)).toBe(
            'queue',
        );
    });
});
