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

/**
 * Replace hyphens/bars with spaces for display purposes.
 * e.g. "FIL-001-BOX" → "FIL 001 BOX"
 */
export const displayFormat = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/-/g, ' ');
};
