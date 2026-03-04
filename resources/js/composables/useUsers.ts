import { ref } from 'vue'
import apiClient from '@/services/api/client'
import type { User } from '@/types'

export function useUsers() {
    const users = ref<User[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const fetchUsers = async () => {
        loading.value = true
        error.value = null
        try {
            const response = await apiClient.get('/users')
            // The API might return { data: [...] } or just an array.
            users.value = Array.isArray(response.data)
                ? response.data
                : (response.data.data ?? [])
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error fetching users'
            console.error('Error fetching users:', err)
        } finally {
            loading.value = false
        }
    }

    return {
        users,
        loading,
        error,
        fetchUsers
    }
}
