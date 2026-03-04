import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { router } from '@inertiajs/vue3'

const apiClient: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
    timeout: 15000,
    withCredentials: true, // Send cookies with requests
})

// Get CSRF token from page meta tag (Laravel default)
const getCSRFToken = (): string | null => {
    const meta = document.querySelector('meta[name="csrf-token"]')
    return meta ? meta.getAttribute('content') : null
}

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add CSRF token to headers
        const token = getCSRFToken()
        if (token) {
            config.headers['X-CSRF-TOKEN'] = token
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    },
)

// Response interceptor — global error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response) {
            const status = error.response.status

            switch (status) {
                case 401:
                    // Session expired — redirect to login
                    console.warn('[API] 401 Unauthorized — redirecting to login')
                    router.visit('/login')
                    break

                case 403:
                    // Forbidden — show toast via custom event
                    console.warn('[API] 403 Forbidden')
                    window.dispatchEvent(
                        new CustomEvent('api:forbidden', {
                            detail: { message: 'No tienes permiso para realizar esta acción.' },
                        }),
                    )
                    break

                case 500:
                    console.error('[API] 500 Server Error', error.response.data)
                    window.dispatchEvent(
                        new CustomEvent('api:server-error', {
                            detail: { message: 'Error del servidor. Intenta de nuevo.' },
                        }),
                    )
                    break

                default:
                    console.error(`[API] Error ${status}:`, error.response.data)
            }
        } else if (error.request) {
            // Network error — no response received
            console.error('[API] No response from server')
            window.dispatchEvent(
                new CustomEvent('api:network-error', {
                    detail: { message: 'Sin conexión con el servidor.' },
                }),
            )
        } else {
            console.error('[API] Request error:', error.message)
        }

        return Promise.reject(error)
    },
)

export default apiClient
