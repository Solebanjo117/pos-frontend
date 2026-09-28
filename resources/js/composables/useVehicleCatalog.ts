import apiClient from '@/services/api/client';

export type VehicleCatalogTab = 'makes' | 'engines' | 'models' | 'vehicles';

export interface VehicleCatalogMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface VehicleCatalogSummary {
    makes: number;
    engines: number;
    models: number;
    vehicles: number;
}

export interface VehicleCatalogCapability {
    can_edit: boolean;
    can_delete: boolean;
    delete_block_reason?: string | null;
}

export interface VehicleMakeRow extends VehicleCatalogCapability {
    id: number;
    name: string;
    models_count: number;
    engines_count: number;
    vehicles_count: number;
}

export interface VehicleModelRow extends VehicleCatalogCapability {
    id: number;
    make_id: number;
    name: string;
    year_from: number;
    year_to: number | null;
    generation?: string | null;
    engines_count: number;
    vehicles_count: number;
    make?: { id: number; name: string };
    chassis?: Array<{ id: number; code: string; name?: string | null }>;
}

export interface VehicleEngineRow extends VehicleCatalogCapability {
    id: number;
    make_id: number;
    model_id?: number | null;
    model_ids?: number[];
    engine_code: string;
    displacement?: string | null;
    fuel_type?: string | null;
    aspiration?: string | null;
    vehicles_count: number;
    make?: { id: number; name: string };
    models?: Array<{ id: number; name: string }>;
}

export interface VehicleVinRow {
    id?: number;
    vin: string;
    notes?: string | null;
    is_customer_linked?: boolean;
}

export interface VehicleConfigurationRow extends VehicleCatalogCapability {
    key: string;
    make: { id: number; name: string };
    model: {
        id: number;
        name: string;
        year_from: number;
        year_to: number | null;
        generation?: string | null;
    };
    engine: {
        id: number;
        engine_code: string;
        displacement?: string | null;
        fuel_type?: string | null;
        aspiration?: string | null;
    };
    vins: VehicleVinRow[];
    vins_count: number;
}

export type VehicleCatalogRow =
    | VehicleMakeRow
    | VehicleEngineRow
    | VehicleModelRow
    | VehicleConfigurationRow;

export interface VehicleCatalogFilters {
    page: number;
    per_page: number;
    search: string;
    sort: string;
    direction: 'asc' | 'desc';
}

const endpointByTab: Record<VehicleCatalogTab, string> = {
    makes: '/vehicle-makes',
    engines: '/vehicle-engines',
    models: '/vehicle-models',
    vehicles: '/vehicle-configurations',
};

export function useVehicleCatalog() {
    const fetchSummary = async (): Promise<VehicleCatalogSummary> => {
        const response = await apiClient.get('/vehicle-catalog/summary');
        return response.data.data;
    };

    const fetchRows = async <T extends VehicleCatalogRow>(
        tab: VehicleCatalogTab,
        filters: VehicleCatalogFilters,
    ): Promise<{ data: T[]; meta: VehicleCatalogMeta }> => {
        const response = await apiClient.get(endpointByTab[tab], {
            params: filters,
        });
        return response.data;
    };

    const fetchAllRows = async <T extends VehicleCatalogRow>(
        tab: VehicleCatalogTab,
        filters: VehicleCatalogFilters,
    ): Promise<T[]> => {
        const data: T[] = [];
        let page = 1;
        let lastPage = 1;

        do {
            const response = await fetchRows<T>(tab, { ...filters, page });
            data.push(...response.data);
            lastPage = Math.max(Number(response.meta.last_page) || 1, 1);
            page += 1;
        } while (page <= lastPage);

        return data;
    };

    const fetchDialogOptions = async (
        tab: VehicleCatalogTab,
        filters: VehicleCatalogFilters,
    ): Promise<{
        makes: VehicleMakeRow[];
        models: VehicleModelRow[];
        engines: VehicleEngineRow[];
    }> => {
        if (tab === 'makes') return { makes: [], models: [], engines: [] };
        if (tab === 'models') {
            return {
                makes: await fetchAllRows<VehicleMakeRow>('makes', filters),
                models: [],
                engines: [],
            };
        }
        if (tab === 'engines') {
            const [makes, models] = await Promise.all([
                fetchAllRows<VehicleMakeRow>('makes', filters),
                fetchAllRows<VehicleModelRow>('models', filters),
            ]);
            return { makes, models, engines: [] };
        }

        const [models, engines] = await Promise.all([
            fetchAllRows<VehicleModelRow>('models', filters),
            fetchAllRows<VehicleEngineRow>('engines', {
                ...filters,
                sort: 'code',
            }),
        ]);
        return { makes: [], models, engines };
    };

    const fetchRow = async <T extends VehicleCatalogRow>(
        tab: Exclude<VehicleCatalogTab, 'vehicles'>,
        id: number,
    ): Promise<T> => {
        const response = await apiClient.get(`${endpointByTab[tab]}/${id}`);
        return response.data.data;
    };

    const createMake = async (name: string) => {
        return (await apiClient.post('/vehicle-makes', { name })).data.data;
    };

    const updateMake = async (id: number, name: string) => {
        return (await apiClient.put(`/vehicle-makes/${id}`, { name })).data
            .data;
    };

    const createModel = async (payload: Record<string, unknown>) => {
        return (await apiClient.post('/vehicle-models', payload)).data.data;
    };

    const updateModel = async (
        id: number,
        payload: Record<string, unknown>,
    ) => {
        return (await apiClient.put(`/vehicle-models/${id}`, payload)).data
            .data;
    };

    const createEngine = async (payload: Record<string, unknown>) => {
        return (await apiClient.post('/vehicle-engines', payload)).data.data;
    };

    const updateEngine = async (
        id: number,
        payload: Record<string, unknown>,
    ) => {
        return (await apiClient.put(`/vehicle-engines/${id}`, payload)).data
            .data;
    };

    const createConfiguration = async (payload: Record<string, unknown>) => {
        return (await apiClient.post('/vehicle-configurations', payload)).data
            .data;
    };

    const updateConfiguration = async (
        modelId: number,
        engineId: number,
        payload: Record<string, unknown>,
    ) => {
        return (
            await apiClient.patch(
                `/vehicle-configurations/${modelId}/${engineId}`,
                payload,
            )
        ).data.data;
    };

    const deleteRow = async (
        tab: VehicleCatalogTab,
        row: VehicleCatalogRow,
    ) => {
        if (tab === 'vehicles') {
            const configuration = row as VehicleConfigurationRow;
            await apiClient.delete(
                `/vehicle-configurations/${configuration.model.id}/${configuration.engine.id}`,
            );
            return;
        }

        const resource = {
            makes: 'vehicle-makes',
            engines: 'vehicle-engines',
            models: 'vehicle-models',
        }[tab];
        await apiClient.delete(`/${resource}/${(row as { id: number }).id}`);
    };

    const bulkDelete = async (
        tab: VehicleCatalogTab,
        selectedRows: VehicleCatalogRow[],
    ) => {
        const payload =
            tab === 'vehicles'
                ? {
                      entity: tab,
                      configurations: selectedRows.map((row) => {
                          const configuration = row as VehicleConfigurationRow;
                          return {
                              model_id: configuration.model.id,
                              engine_id: configuration.engine.id,
                          };
                      }),
                  }
                : {
                      entity: tab,
                      ids: selectedRows.map(
                          (row) => (row as { id: number }).id,
                      ),
                  };

        return (await apiClient.post('/vehicle-catalog/bulk-delete', payload))
            .data.data;
    };

    const exportCatalog = async () => {
        const response = await apiClient.get('/vehicle-catalog/export', {
            responseType: 'blob',
        });
        const href = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = href;
        link.download = `catalogo_vehiculos_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(href);
    };

    return {
        fetchSummary,
        fetchRows,
        fetchAllRows,
        fetchDialogOptions,
        fetchRow,
        createMake,
        updateMake,
        createModel,
        updateModel,
        createEngine,
        updateEngine,
        createConfiguration,
        updateConfiguration,
        deleteRow,
        bulkDelete,
        exportCatalog,
    };
}
