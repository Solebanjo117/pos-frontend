export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

/**
 * Replace hyphens/bars with spaces for display purposes.
 * e.g. "FIL-001-BOX" → "FIL 001 BOX"
 */
export const displayFormat = (str: string | null | undefined): string => {
    if (!str) return ''
    return str.replace(/-/g, ' ')
}
