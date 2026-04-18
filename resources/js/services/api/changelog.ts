import apiClient from './client'

export interface ChangelogRelease {
    version: string
    date: string
    title: string
    category: string
    changes: string[]
}

export interface ChangelogResponse {
    success: boolean
    data: ChangelogRelease[]
    message?: string
}

export const changelogApi = {
    async getChangelog(): Promise<ChangelogResponse> {
        const response = await apiClient.get<ChangelogResponse>('/changelog')
        return response.data
    },
}
