import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productsApi } from '@/services/api/products';
import { useProducts } from './useProducts';

vi.mock('@/services/api/products', () => ({
    productsApi: { getProducts: vi.fn() },
}));

describe('useProducts POS search concurrency', () => {
    beforeEach(() => vi.mocked(productsApi.getProducts).mockReset());

    it('ignores a stale response that arrives after the latest search', async () => {
        let resolveFirst!: (value: any) => void;
        let resolveSecond!: (value: any) => void;
        vi.mocked(productsApi.getProducts)
            .mockReturnValueOnce(
                new Promise((resolve) => (resolveFirst = resolve)) as any,
            )
            .mockReturnValueOnce(
                new Promise((resolve) => (resolveSecond = resolve)) as any,
            );

        const state = useProducts();
        const first = state.fetchProducts({ search: 'aceite' });
        const second = state.fetchProducts({ search: 'filtro' });

        resolveSecond({
            data: [{ id: 2, name: 'Filtro' }],
            meta: { current_page: 1, last_page: 1, total: 1 },
        });
        await second;
        resolveFirst({
            data: [{ id: 1, name: 'Aceite' }],
            meta: { current_page: 1, last_page: 1, total: 1 },
        });
        await first;

        expect(state.products.value).toEqual([{ id: 2, name: 'Filtro' }]);
        expect(state.loading.value).toBe(false);
    });
});
