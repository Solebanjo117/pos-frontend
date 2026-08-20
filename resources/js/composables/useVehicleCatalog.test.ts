// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVehicleCatalog } from './useVehicleCatalog';

const { get, post, patch, put, remove } = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
    default: { get, post, patch, put, delete: remove },
}));

describe('useVehicleCatalog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        get.mockResolvedValue({ data: { data: [], meta: {} } });
        post.mockResolvedValue({ data: { data: {} } });
        patch.mockResolvedValue({ data: { data: {} } });
        put.mockResolvedValue({ data: { data: {} } });
        remove.mockResolvedValue({ data: {} });
    });

    it('uses the real endpoint and preserves backend filters for every tab', async () => {
        const catalog = useVehicleCatalog();
        const filters = {
            page: 3,
            per_page: 20,
            search: 'toyota',
            sort: 'years',
            direction: 'desc' as const,
        };

        await catalog.fetchRows('vehicles', filters);

        expect(get).toHaveBeenCalledWith('/vehicle-configurations', {
            params: filters,
        });
    });

    it('sends model and engine pairs for atomic bulk deletion', async () => {
        const catalog = useVehicleCatalog();
        await catalog.bulkDelete('vehicles', [
            {
                key: '7:9',
                make: { id: 1, name: 'Toyota' },
                model: {
                    id: 7,
                    name: 'Corolla',
                    year_from: 2020,
                    year_to: 2026,
                },
                engine: { id: 9, engine_code: '2ZR-FE' },
                vins: [],
                vins_count: 0,
                can_edit: true,
                can_delete: true,
            },
        ]);

        expect(post).toHaveBeenCalledWith('/vehicle-catalog/bulk-delete', {
            entity: 'vehicles',
            configurations: [{ model_id: 7, engine_id: 9 }],
        });
    });

    it('uses the composite configuration route for update and delete', async () => {
        const catalog = useVehicleCatalog();
        const row = {
            key: '7:9',
            make: { id: 1, name: 'Toyota' },
            model: {
                id: 7,
                name: 'Corolla',
                year_from: 2020,
                year_to: 2026,
            },
            engine: { id: 9, engine_code: '2ZR-FE' },
            vins: [],
            vins_count: 0,
            can_edit: true,
            can_delete: true,
        };

        await catalog.updateConfiguration(7, 9, {
            model_id: 7,
            engine_id: 10,
        });
        await catalog.deleteRow('vehicles', row);

        expect(patch).toHaveBeenCalledWith('/vehicle-configurations/7/9', {
            model_id: 7,
            engine_id: 10,
        });
        expect(remove).toHaveBeenCalledWith('/vehicle-configurations/7/9');
    });
});
