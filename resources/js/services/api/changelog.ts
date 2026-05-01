import apiClient from './client';

export interface ChangelogRelease {
    id?: number | null;
    source?: 'config' | 'entry';
    version: string;
    date: string;
    title: string;
    category: string;
    changes: string[];
    status?: 'draft' | 'published';
    created_by?: string | null;
}

export interface ChangelogDraft {
    id: number;
    title: string;
    body: string;
    category: string;
    version?: string | null;
    status: 'draft';
    created_at?: string | null;
    created_by?: string | null;
}

export interface ChangelogResponse {
    success: boolean;
    data: ChangelogRelease[];
    drafts?: ChangelogDraft[];
    message?: string;
}

export interface ChangelogEntryPayload {
    title: string;
    body: string;
    category: string;
    version?: string | null;
    publish?: boolean;
}

export interface ChangelogEntryResponse {
    success: boolean;
    data: ChangelogRelease | ChangelogDraft;
    message?: string;
}

export const changelogApi = {
    async getChangelog(): Promise<ChangelogResponse> {
        const response = await apiClient.get<ChangelogResponse>('/changelog');
        return response.data;
    },

    async createEntry(
        payload: ChangelogEntryPayload,
    ): Promise<ChangelogEntryResponse> {
        const response = await apiClient.post<ChangelogEntryResponse>(
            '/changelog/entries',
            payload,
        );
        return response.data;
    },

    async publishEntry(entryId: number): Promise<ChangelogEntryResponse> {
        const response = await apiClient.patch<ChangelogEntryResponse>(
            `/changelog/entries/${entryId}/publish`,
        );
        return response.data;
    },
};
