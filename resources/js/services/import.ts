import type {
    ImportRun,
    ImportRunRowsResponse,
    ImportResult,
    ImportProfile,
    ImportBatchReferencesResponse,
    ImportBatchVehicleCandidatesResponse,
    VehicleCandidate,
} from '@/types/import';
import apiClient from './api/client';

export interface ImportColumn {
    key: string;
    label: string;
    type?: 'text' | 'number' | 'select' | 'searchable' | 'image';
    required?: boolean;
    options?: { label: string; value: string }[];
    searchableEndpoint?: string;
    placeholder?: string;
    creatable?: boolean;
    /** El importador crea el registro si el texto no coincide con una opción existente. */
    createsMissing?: boolean;
    /** If set, this column renders as an action button (modal trigger) instead of an input */
    actionType?: 'attributes' | 'variants' | 'compatibility';
}

export interface ImporterConfig {
    entity: string;
    title: string;
    description: string;
    templateFilename: string;
    columns: ImportColumn[];
    fullFileImport?: boolean;
    groupedProductPreview?: boolean;
}

export interface ImportSheetSelection {
    sheet_index?: number | null;
    sheet_name?: string | null;
    mapping?: Record<string, string>;
    mode?: string;
    profile_id?: number | null;
    import_run_id?: number | null;
    onUploadProgress?: (event: { loaded: number; total?: number }) => void;
}

export const importService = {
    async downloadTemplate(entity: string): Promise<Blob> {
        const response = await apiClient.get(`/${entity}/import/template`, {
            responseType: 'blob',
        });
        return response.data;
    },

    async preview(
        entity: string,
        file: File,
        options: ImportSheetSelection = {},
    ): Promise<ImportResult> {
        const formData = new FormData();
        formData.append('file', file);
        appendImportOptions(formData, options);
        const response = await apiClient.post(
            `/${entity}/import/preview`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
                onUploadProgress: options.onUploadProgress,
            },
        );
        return response.data;
    },

    async metadata(
        entity: string,
        file: File,
        options: ImportSheetSelection = {},
    ): Promise<ImportResult> {
        const formData = new FormData();
        formData.append('file', file);
        appendImportOptions(formData, options);
        const response = await apiClient.post(
            `/${entity}/import/metadata`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
                onUploadProgress: options.onUploadProgress,
            },
        );
        return response.data;
    },

    async execute(
        entity: string,
        rows: any[],
        options: Pick<ImportSheetSelection, 'mode'> = {},
    ): Promise<ImportResult> {
        const response = await apiClient.post(`/${entity}/import/execute`, {
            rows,
            mode: options.mode,
        });
        return response.data;
    },

    async validateRows(
        entity: string,
        rows: any[],
        options: Omit<
            ImportSheetSelection,
            'import_run_id' | 'sheet_name'
        > = {},
    ): Promise<ImportResult> {
        const response = await apiClient.post(
            `/${entity}/import/validate-rows`,
            {
                rows,
                mode: options.mode,
                mapping: options.mapping,
                sheet_index: options.sheet_index,
                profile_id: options.profile_id,
            },
        );
        return response.data;
    },

    async exportPreview(entity: string, rows: any[]): Promise<Blob> {
        const response = await apiClient.post(
            `/${entity}/import/export-preview`,
            { rows },
            { responseType: 'blob', timeout: 120000 },
        );
        return response.data;
    },

    async createReferencesBatch(
        entity: string,
        payload: { categories: string[]; brands: string[] },
    ): Promise<ImportBatchReferencesResponse> {
        const response = await apiClient.post(
            `/${entity}/import/references/batch`,
            payload,
        );
        return response.data;
    },

    async createVehicleCandidatesBatch(
        entity: string,
        candidates: VehicleCandidate[],
    ): Promise<ImportBatchVehicleCandidatesResponse> {
        const response = await apiClient.post(
            `/${entity}/import/vehicle-candidates/batch`,
            { candidates },
        );
        return response.data;
    },

    async importFile(
        entity: string,
        file: File,
        options: ImportSheetSelection = {},
    ): Promise<ImportResult> {
        const formData = new FormData();
        formData.append('file', file);
        appendImportOptions(formData, options);
        const response = await apiClient.post(`/${entity}/import`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
            onUploadProgress: options.onUploadProgress,
        });
        return response.data;
    },

    async importValidatedRun(
        entity: string,
        validatedImportRunId: number,
        options: Pick<ImportSheetSelection, 'mode'> = {},
    ): Promise<ImportResult> {
        const response = await apiClient.post(`/${entity}/import`, {
            validated_import_run_id: validatedImportRunId,
            mode: options.mode,
        });
        return response.data;
    },

    async getRun(entity: string, importRunId: number): Promise<ImportRun> {
        const response = await apiClient.get(
            `/${entity}/import/runs/${importRunId}`,
        );
        return response.data;
    },

    async getRunRows(
        entity: string,
        importRunId: number,
        params: Record<string, any> = {},
    ): Promise<ImportRunRowsResponse> {
        const response = await apiClient.get(
            `/${entity}/import/runs/${importRunId}/rows`,
            { params },
        );
        return response.data;
    },

    async getRunErrors(
        entity: string,
        importRunId: number,
        params: Record<string, any> = {},
    ): Promise<ImportRunRowsResponse> {
        const response = await apiClient.get(
            `/${entity}/import/runs/${importRunId}/errors`,
            { params },
        );
        return response.data;
    },

    async updateRunRows(
        entity: string,
        importRunId: number,
        payload: {
            rows_revision: number;
            rows: Array<{
                id: number;
                updated_at: string;
                data: Record<string, any>;
            }>;
        },
    ): Promise<{
        data: {
            rows_revision: number;
            rows_dirty: boolean;
            full_revalidation_status: string;
            rows: any[];
        };
    }> {
        const response = await apiClient.patch(
            `/${entity}/import/runs/${importRunId}/rows`,
            payload,
        );
        return response.data;
    },

    async updateRunMapping(
        entity: string,
        importRunId: number,
        payload: {
            rows_revision: number;
            mapping: Record<string, string>;
            visible_row_ids: number[];
        },
    ): Promise<{
        data: {
            import_run_id: number;
            mapping: Record<string, string>;
            rows_revision: number;
            rows_dirty: boolean;
            full_revalidation_status: string;
            rows: any[];
        };
    }> {
        const response = await apiClient.patch(
            `/${entity}/import/runs/${importRunId}/mapping`,
            payload,
        );
        return response.data;
    },

    async revalidateRunRows(
        entity: string,
        importRunId: number,
        payload: {
            scope?: 'full' | 'references';
            brands?: string[];
            categories?: string[];
        } = {},
    ): Promise<{
        data: {
            full_revalidation_status: string;
            scope?: string;
            affected_rows_count?: number;
            fallback_full_revalidation?: boolean;
        };
    }> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/revalidate`,
            payload,
        );
        return response.data;
    },

    async listRuns(
        entity: string,
        params: Record<string, any> = {},
    ): Promise<{ data: ImportRun[] }> {
        const response = await apiClient.get(`/${entity}/import/runs`, {
            params,
        });
        return response.data;
    },

    async validateFile(
        entity: string,
        file: File,
        options: ImportSheetSelection = {},
    ): Promise<ImportResult> {
        const formData = new FormData();
        formData.append('file', file);
        appendImportOptions(formData, options);
        const response = await apiClient.post(
            `/${entity}/import/validate`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
                onUploadProgress: options.onUploadProgress,
            },
        );
        return response.data;
    },

    async listProfiles(entity: string): Promise<{ data: ImportProfile[] }> {
        const response = await apiClient.get(`/${entity}/import/profiles`);
        return response.data;
    },

    async saveProfile(
        entity: string,
        payload: Partial<ImportProfile>,
    ): Promise<ImportProfile> {
        const response = await apiClient.post(
            `/${entity}/import/profiles`,
            payload,
        );
        return response.data;
    },

    async cancelRun(
        entity: string,
        importRunId: number,
    ): Promise<{ data: { status: string }; message?: string }> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/cancel`,
        );
        return response.data;
    },

    async retryFailed(
        entity: string,
        importRunId: number,
    ): Promise<ImportResult> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/retry-failed`,
        );
        return response.data;
    },

    async processRunNow(
        entity: string,
        importRunId: number,
    ): Promise<ImportRun> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/process-now`,
            {},
            { timeout: 120000 },
        );
        return response.data;
    },

    async processRunChunk(
        entity: string,
        importRunId: number,
    ): Promise<ImportRun> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/process-chunk`,
            {},
            {
                timeout: 120000,
                suppressExpectedTerminalChunkConflictLog: true,
            },
        );
        return response.data;
    },

    async deleteRun(entity: string, importRunId: number): Promise<void> {
        await apiClient.delete(`/${entity}/import/runs/${importRunId}`);
    },

    async downloadErrors(entity: string, importRunId: number): Promise<Blob> {
        const response = await apiClient.get(
            `/${entity}/import/runs/${importRunId}/errors.xlsx`,
            { responseType: 'blob' },
        );
        return response.data;
    },

    async downloadSource(entity: string, importRunId: number): Promise<Blob> {
        const response = await apiClient.get(
            `/${entity}/import/runs/${importRunId}/source`,
            { responseType: 'blob' },
        );
        return response.data;
    },
};

function appendImportOptions(
    formData: FormData,
    options: ImportSheetSelection,
): void {
    if (options.sheet_index !== undefined && options.sheet_index !== null) {
        formData.append('sheet_index', String(options.sheet_index));
    }
    if (options.sheet_name) {
        formData.append('sheet_name', options.sheet_name);
    }
    if (options.mode) {
        formData.append('mode', options.mode);
    }
    if (options.profile_id) {
        formData.append('profile_id', String(options.profile_id));
    }
    if (options.import_run_id) {
        formData.append('import_run_id', String(options.import_run_id));
    }
    Object.entries(options.mapping ?? {}).forEach(([source, target]) => {
        formData.append(`mapping[${source}]`, target);
    });
}
