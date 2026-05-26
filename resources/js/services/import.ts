import apiClient from './api/client';

export interface ImportColumn {
    key: string;
    label: string;
    type?: 'text' | 'number' | 'select' | 'searchable';
    required?: boolean;
    options?: { label: string; value: string }[];
    searchableEndpoint?: string;
    placeholder?: string;
    creatable?: boolean;
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
}

export interface ImportSheetSelection {
    sheet_index?: number | null;
    sheet_name?: string | null;
    mapping?: Record<string, string>;
    mode?: string;
    profile_id?: number | null;
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
    ): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        appendImportOptions(formData, options);
        const response = await apiClient.post(
            `/${entity}/import/preview`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' },
            },
        );
        return response.data;
    },

    async execute(entity: string, rows: any[]): Promise<any> {
        const response = await apiClient.post(`/${entity}/import/execute`, {
            rows,
        });
        return response.data;
    },

    async importFile(
        entity: string,
        file: File,
        options: ImportSheetSelection = {},
    ): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        appendImportOptions(formData, options);
        const response = await apiClient.post(`/${entity}/import`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
        });
        return response.data;
    },

    async getRun(entity: string, importRunId: number): Promise<any> {
        const response = await apiClient.get(
            `/${entity}/import/runs/${importRunId}`,
        );
        return response.data;
    },

    async validateFile(
        entity: string,
        file: File,
        options: ImportSheetSelection = {},
    ): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        appendImportOptions(formData, options);
        const response = await apiClient.post(
            `/${entity}/import/validate`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
            },
        );
        return response.data;
    },

    async listProfiles(entity: string): Promise<any> {
        const response = await apiClient.get(`/${entity}/import/profiles`);
        return response.data;
    },

    async saveProfile(entity: string, payload: any): Promise<any> {
        const response = await apiClient.post(
            `/${entity}/import/profiles`,
            payload,
        );
        return response.data;
    },

    async cancelRun(entity: string, importRunId: number): Promise<any> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/cancel`,
        );
        return response.data;
    },

    async retryFailed(entity: string, importRunId: number): Promise<any> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/retry-failed`,
        );
        return response.data;
    },

    async processRunNow(entity: string, importRunId: number): Promise<any> {
        const response = await apiClient.post(
            `/${entity}/import/runs/${importRunId}/process-now`,
            {},
            { timeout: 120000 },
        );
        return response.data;
    },

    async downloadErrors(entity: string, importRunId: number): Promise<Blob> {
        const response = await apiClient.get(
            `/${entity}/import/runs/${importRunId}/errors.xlsx`,
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
    Object.entries(options.mapping ?? {}).forEach(([source, target]) => {
        formData.append(`mapping[${source}]`, target);
    });
}
