export interface FinancialReportFilters {
    date_from: string;
    date_to: string;
    warehouse_id: number | null;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value: string): boolean => {
    if (!isoDatePattern.test(value)) return false;

    const parsed = new Date(`${value}T00:00:00Z`);
    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
};

export const validateFinancialReportDates = (
    dateFrom: string,
    dateTo: string,
): string | null => {
    if (!dateFrom || !dateTo) return 'Selecciona un rango de fechas completo.';
    if (!isValidIsoDate(dateFrom) || !isValidIsoDate(dateTo)) {
        return 'El rango contiene una fecha invalida.';
    }
    if (dateFrom > dateTo) {
        return 'La fecha inicial debe ser igual o anterior a la fecha final.';
    }

    return null;
};

export const financialReportFilterKey = (
    filters: FinancialReportFilters,
): string =>
    [filters.date_from, filters.date_to, filters.warehouse_id ?? 'all'].join(
        '|',
    );

export const financialReportRequestDecision = (
    activeRequestKey: string | null,
    requestedKey: string,
): 'start' | 'ignore' | 'queue' => {
    if (activeRequestKey === null) return 'start';
    return activeRequestKey === requestedKey ? 'ignore' : 'queue';
};

export const buildFinancialReportUrl = (
    currentHref: string,
    filters: Pick<FinancialReportFilters, 'date_from' | 'date_to'>,
): string => {
    const url = new URL(currentHref);
    url.searchParams.set('date_from', filters.date_from);
    url.searchParams.set('date_to', filters.date_to);
    url.searchParams.delete('as_of');

    return `${url.pathname}${url.search}${url.hash}`;
};

export const validateBalanceSheetDate = (asOf: string): string | null => {
    if (!asOf) return 'Selecciona la fecha de corte del Balance.';
    if (!isValidIsoDate(asOf)) return 'La fecha de corte no es válida.';

    return null;
};

export const buildBalanceSheetUrl = (
    currentHref: string,
    asOf: string,
): string => {
    const url = new URL(currentHref);
    url.searchParams.set('as_of', asOf);

    return `${url.pathname}${url.search}${url.hash}`;
};
