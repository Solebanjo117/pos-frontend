import apiClient from '@/services/api/client';
import { formatDateInputValue } from '@/utils/formatters';
export function reportPeriod(preset = 'month') {
    const today = formatDateInputValue();
    const [year, month] = today.split('-').map(Number);
    const first = (offset: number) =>
        new Date(Date.UTC(year, month - 1 + offset, 1))
            .toISOString()
            .slice(0, 10);
    if (preset === 'today') return { date_from: today, date_to: today };
    if (preset === 'previous')
        return {
            date_from: first(-1),
            date_to: new Date(Date.UTC(year, month - 1, 0))
                .toISOString()
                .slice(0, 10),
        };
    return { date_from: first(preset === 'two' ? -1 : 0), date_to: today };
}
export function reportParams(filters: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(filters).filter(
            ([, value]) =>
                value !== '' && value !== null && value !== undefined,
        ),
    );
}
export async function downloadMoneyReport(
    report: string,
    format: 'csv' | 'xlsx',
    filters: Record<string, unknown>,
) {
    const response = await apiClient.get(
        `/reports/${report}/export/${format}`,
        { params: reportParams(filters), responseType: 'blob' },
    );
    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
}
