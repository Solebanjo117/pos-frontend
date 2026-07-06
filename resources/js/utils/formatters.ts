export const roundMoney = (value: unknown): number => {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
        return 0;
    }

    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;

    return Object.is(rounded, -0) ? 0 : rounded;
};

export const formatCurrency = (value: unknown): string => {
    const amount = roundMoney(value);
    const sign = amount < 0 ? '-' : '';

    return `${sign}$${Math.abs(amount).toFixed(2)}`;
};

export const formatMoney = formatCurrency;

const reportMonthLabels = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
];

const parseReportDate = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const raw = String(value);
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T00:00:00`
        : raw;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatReportDate = (value: unknown): string => {
    const date = parseReportDate(value);

    if (!date) {
        return '-';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = reportMonthLabels[date.getMonth()] ?? '';
    const year = String(date.getFullYear()).slice(-2);

    return `${day}${month}${year}`;
};

export const formatReportDateTime = (value: unknown): string => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return formatReportDate(value);
    }

    const date = parseReportDate(value);

    if (!date) {
        return '-';
    }

    const hours24 = date.getHours();
    const hours = hours24 % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const period = hours24 < 12 ? 'a. m.' : 'p. m.';

    return `${formatReportDate(value)} ${hours}:${minutes} ${period}`;
};

/**
 * Replace hyphens/bars with spaces for display purposes.
 * e.g. "FIL-001-BOX" → "FIL 001 BOX"
 */
export const displayFormat = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/-/g, ' ');
};
