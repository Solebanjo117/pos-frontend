import apiClient from './api/client';

export interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    current_warehouse_id: number | null;
    created_at: string;
    current_warehouse?: { id: number; name: string } | null;
}

export interface CreateUserPayload {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: string;
    current_warehouse_id?: number | null;
}

export interface UpdateUserPayload {
    name?: string;
    email?: string;
    password?: string;
    password_confirmation?: string;
    role?: string;
    current_warehouse_id?: number | null;
    is_active?: boolean;
}

class UsersApiService {
    async getUsers(): Promise<User[]> {
        const response = await apiClient.get<User[]>('/users');
        return response.data;
    }

    async createUser(data: CreateUserPayload): Promise<User> {
        const response = await apiClient.post<{ user: User }>('/users', data);
        return response.data.user;
    }

    async updateUser(id: number, data: UpdateUserPayload): Promise<User> {
        const response = await apiClient.put<{ user: User }>(
            `/users/${id}`,
            data,
        );
        return response.data.user;
    }

    async deleteUser(id: number): Promise<void> {
        await apiClient.delete(`/users/${id}`);
    }

    async getCurrentUser(): Promise<User | null> {
        const response = await apiClient.get<User>('/user');
        return response.data;
    }
}

export default new UsersApiService();
