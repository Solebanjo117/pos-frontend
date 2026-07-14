export type RegionalFormatterConfig = {
    active?: boolean;
    timezone?: string;
    dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    timeFormat?: '12h' | '24h';
    datetimeFormat?: string;
    currency?: string;
    decimalSeparator?: '.' | ',';
};

const defaultRegionalConfig: Required<RegionalFormatterConfig> = {
    active: true,
    timezone: 'America/Panama',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    datetimeFormat: 'DD/MM/YYYY HH:mm',
    currency: 'USD',
    decimalSeparator: '.',
};

let regionalConfig: Required<RegionalFormatterConfig> = {
    ...defaultRegionalConfig,
};

export const configureRegionalFormatters = (
    config: RegionalFormatterConfig,
): void => {
    regionalConfig = {
        ...regionalConfig,
        active: config.active ?? regionalConfig.active,
        timezone: config.timezone || regionalConfig.timezone,
        dateFormat: config.dateFormat || regionalConfig.dateFormat,
        timeFormat: config.timeFormat || regionalConfig.timeFormat,
        datetimeFormat: config.datetimeFormat || regionalConfig.datetimeFormat,
        currency: (config.currency || regionalConfig.currency).toUpperCase(),
        decimalSeparator:
            config.decimalSeparator || regionalConfig.decimalSeparator,
    };
};

export const roundMoney = (value: unknown): number => {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
        return 0;
    }

    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;

    return Object.is(rounded, -0) ? 0 : rounded;
};

const currencySymbols: Record<string, string> = {
    USD: '$',
    PAB: 'B/.',
    EUR: '€',
    MXN: '$',
    COP: '$',
};

export const formatCurrency = (
    value: unknown,
    override?: RegionalFormatterConfig,
): string => {
    const config = { ...regionalConfig, ...override };
    const amount = roundMoney(value);
    const sign = amount < 0 ? '-' : '';
    const decimalSeparator = config.decimalSeparator === ',' ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const symbol =
        currencySymbols[(config.currency || 'USD').toUpperCase()] ?? '$';
    const [integer, decimals] = Math.abs(amount).toFixed(2).split('.');
    const groupedInteger = integer.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        thousandsSeparator,
    );

    return `${sign}${symbol}${groupedInteger}${decimalSeparator}${decimals}`;
};

export const formatMoney = formatCurrency;

type DateParts = {
    day: string;
    month: string;
    year: string;
    hour24: string;
    hour12: string;
    minute: string;
    period: string;
};

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

const dateOnlyParts = (value: string): DateParts | null => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    return {
        year: match[1],
        month: match[2],
        day: match[3],
        hour24: '00',
        hour12: '12',
        minute: '00',
        period: 'a. m.',
    };
};

const partsInTimezone = (
    date: Date,
    timezone: string,
): DateParts | null => {
    try {
        const formattedParts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(date);
        const map = Object.fromEntries(
            formattedParts.map((part) => [part.type, part.value]),
        );
        const hourNumber = Number(map.hour || 0);
        const normalizedHour = hourNumber === 24 ? 0 : hourNumber;
        const hour12 = normalizedHour % 12 || 12;

        return {
            year: map.year,
            month: map.month,
            day: map.day,
            hour24: String(normalizedHour).padStart(2, '0'),
            hour12: String(hour12).padStart(2, '0'),
            minute: map.minute,
            period: normalizedHour < 12 ? 'a. m.' : 'p. m.',
        };
    } catch {
        return null;
    }
};

const resolveParts = (value: unknown): DateParts | null => {
    if (typeof value === 'string') {
        const dateOnly = dateOnlyParts(value);
        if (dateOnly) return dateOnly;
    }

    const date = parseReportDate(value);
    if (!date) return null;

    return (
        partsInTimezone(date, regionalConfig.timezone) ||
        partsInTimezone(date, defaultRegionalConfig.timezone)
    );
};

const formatDatePattern = (
    parts: DateParts,
    format = regionalConfig.dateFormat,
): string =>
    format
        .replace('YYYY', parts.year)
        .replace('YY', parts.year.slice(-2))
        .replace('DD', parts.day)
        .replace('MM', parts.month);

const formatTimePattern = (parts: DateParts): string => {
    if (regionalConfig.timeFormat === '12h') {
        return `${parts.hour12}:${parts.minute} ${parts.period}`;
    }

    return `${parts.hour24}:${parts.minute}`;
};

const formatDateTimePattern = (parts: DateParts, pattern: string): string =>
    pattern
        .replace('YYYY', parts.year)
        .replace('YY', parts.year.slice(-2))
        .replace('DD', parts.day)
        .replace('MM', parts.month)
        .replace('HH', parts.hour24)
        .replace('hh', parts.hour12)
        .replace('mm', parts.minute)
        .replace('A', parts.period);

export const formatReportDate = (value: unknown): string => {
    const parts = resolveParts(value);

    if (!parts) {
        return '-';
    }

    if (!regionalConfig.active) {
        return formatDatePattern(parts, defaultRegionalConfig.dateFormat);
    }

    return formatDatePattern(parts);
};

export const formatReportDateTime = (value: unknown): string => {
    const parts = resolveParts(value);

    if (!parts) {
        return '-';
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return formatReportDate(value);
    }

    if (regionalConfig.active) {
        return formatDateTimePattern(parts, regionalConfig.datetimeFormat);
    }

    const date = formatDatePattern(parts, defaultRegionalConfig.dateFormat);

    return `${date} ${formatTimePattern(parts)}`;
};

export const formatDateInputValue = (
    value: Date | string | number = new Date(),
): string => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const parts =
        partsInTimezone(date, regionalConfig.timezone) ||
        partsInTimezone(date, defaultRegionalConfig.timezone);

    return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
};

/**
 * Replace hyphens/bars with spaces for display purposes.
 * e.g. "FIL-001-BOX" -> "FIL 001 BOX"
 */
export const displayFormat = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/-/g, ' ');
};
