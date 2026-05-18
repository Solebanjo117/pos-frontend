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
}

export const importService = {
    async downloadTemplate(entity: string): Promise<Blob> {
        const response = await apiClient.get(`/${entity}/import/template`, {
            responseType: 'blob',
        });
        return response.data;
    },

    async preview(entity: string, file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
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
};
