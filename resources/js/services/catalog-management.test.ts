import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/services/api/client';
import { CustomersApiService } from '@/services/customers';
import { suppliersService } from '@/services/suppliers';

vi.mock('@/services/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

describe('customer and supplier catalog contracts', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sends one atomic customer bulk request', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: { affected: 2 } });
        await CustomersApiService.bulkCustomers('deactivate', [3, 7]);
        expect(apiClient.post).toHaveBeenCalledOnce();
        expect(apiClient.post).toHaveBeenCalledWith('/customers/bulk-action', {
            action: 'deactivate',
            ids: [3, 7],
        });
    });

    it('uses the shared supplier catalog summary and bulk endpoints', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({
            data: {
                data: {
                    categories: 4,
                    brands: 2,
                    suppliers: 8,
                    active_suppliers: 7,
                },
            },
        });
        vi.mocked(apiClient.post).mockResolvedValue({ data: { affected: 1 } });

        await expect(
            suppliersService.getCatalogSummary(),
        ).resolves.toMatchObject({ suppliers: 8 });
        await suppliersService.bulkCatalogAction('brand', 'delete', [11]);

        expect(apiClient.get).toHaveBeenCalledWith('/supplier-catalog/summary');
        expect(apiClient.post).toHaveBeenCalledWith(
            '/supplier-catalog/bulk-action',
            {
                entity: 'brand',
                action: 'delete',
                ids: [11],
            },
        );
    });
});
