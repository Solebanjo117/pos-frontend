import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/services/api/client';
import { financialDocumentsService } from '@/services/financial-documents';
import {
    FINANCIAL_DOCUMENT_COLUMNS,
    type FinancialDocumentFilters,
} from '@/types/financial-document';

vi.mock('@/services/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

const filters: FinancialDocumentFilters = {
    date_from: '',
    date_to: '',
    search: '',
    document_number: '',
    party_id: null,
    status: 'open',
    page: 1,
    per_page: 25,
};

describe('financialDocumentsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mantiene el orden exacto del contrato visual', () => {
        expect(FINANCIAL_DOCUMENT_COLUMNS).toEqual([
            'Fecha',
            'Persona / Empresa',
            '# Factura',
            'Total',
            'Pagado',
            'Saldo',
            'Editar',
            'Eliminar',
        ]);
    });

    it.each([
        ['receivable', '/accounts-receivable/documents'],
        ['payable', '/accounts-payable/documents'],
    ] as const)('usa un listado separado para %s', async (mode, endpoint) => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: [] } });

        await financialDocumentsService.list(mode, filters);

        expect(apiClient.get).toHaveBeenCalledWith(endpoint, {
            params: filters,
        });
    });

    it('no mezcla los endpoints de cobro y pago', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

        await financialDocumentsService.settle('receivable', 7, {
            amount: 10,
        });
        await financialDocumentsService.settle('payable', 8, { amount: 20 });

        expect(apiClient.post).toHaveBeenNthCalledWith(
            1,
            '/accounts-receivable/7/receipts',
            { amount: 10 },
        );
        expect(apiClient.post).toHaveBeenNthCalledWith(
            2,
            '/accounts-payable/8/payments',
            { amount: 20 },
        );
    });
});
