import { router } from '@inertiajs/vue3';
import axios, { type AxiosInstance, type AxiosError } from 'axios';

declare module 'axios' {
    export interface AxiosRequestConfig {
        suppressExpectedTerminalChunkConflictLog?: boolean;
    }
}

const configuredApiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const apiBaseURL = configuredApiBaseURL.includes('pos-backend.test')
    ? '/api/v1'
    : configuredApiBaseURL;

const apiClient: AxiosInstance = axios.create({
    baseURL: apiBaseURL,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
    timeout: 15000,
    withCredentials: true, // Send cookies with requests
});

let isRedirectingToLogin = false;

const isPublicAuthPage = (): boolean =>
    window.location.pathname === '/login' || window.location.pathname === '/';

// Get CSRF token from page meta tag (Laravel default)
const getCSRFToken = (): string | null => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
};

const getResponseMessage = (payload: unknown, fallback: string): string => {
    if (typeof payload === 'string') {
        return payload;
    }

    if (!payload || typeof payload !== 'object') {
        return fallback;
    }

    const response = payload as {
        message?: unknown;
        data?: { message?: unknown };
    };

    if (
        typeof response.message === 'string' &&
        response.message.trim() !== ''
    ) {
        return response.message;
    }

    if (
        typeof response.data?.message === 'string' &&
        response.data.message.trim() !== ''
    ) {
        return response.data.message;
    }

    return fallback;
};

const getBlockingReason = (payload: unknown): string | null => {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const response = payload as {
        blocking_reason?: unknown;
        data?: { blocking_reason?: unknown };
    };

    if (
        typeof response.blocking_reason === 'string' &&
        response.blocking_reason.trim() !== ''
    ) {
        return response.blocking_reason;
    }

    if (
        typeof response.data?.blocking_reason === 'string' &&
        response.data.blocking_reason.trim() !== ''
    ) {
        return response.data.blocking_reason;
    }

    return null;
};

const isExpectedTerminalChunkConflict = (
    error: AxiosError,
    responseMessage: string,
): boolean => {
    const url = error.config?.url ?? '';

    return (
        error.config?.suppressExpectedTerminalChunkConflictLog === true &&
        error.response?.status === 409 &&
        /\/import\/runs\/\d+\/process-chunk$/.test(url) &&
        responseMessage.includes('ya finalizo')
    );
};

const IMPORT_UPLOAD_TOO_LARGE_MESSAGE =
    'El servidor rechazó el archivo porque supera el límite de carga.';

const getImportUploadTooLargeMessage = (error: AxiosError): string | null => {
    if (error.response?.status === 413) {
        return IMPORT_UPLOAD_TOO_LARGE_MESSAGE;
    }

    const config = error.config;
    if (!config?.url || !config.url.includes('/products/import/')) {
        return null;
    }

    if (!(config.data instanceof FormData)) {
        return null;
    }

    const file = config.data.get('file');
    if (!(file instanceof Blob)) {
        return null;
    }

    return IMPORT_UPLOAD_TOO_LARGE_MESSAGE;
};
// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add CSRF token to headers
        const token = getCSRFToken();
        if (token) {
            config.headers['X-CSRF-TOKEN'] = token;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Response interceptor — global error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response) {
            const status = error.response.status;
            const responseData = error.response.data;
            const responseMessage = getResponseMessage(
                responseData,
                status === 500
                    ? 'Error del servidor. Intenta de nuevo.'
                    : 'La solicitud no pudo completarse.',
            );
            const blockingReason = getBlockingReason(responseData);

            error.message = responseMessage;

            if (isExpectedTerminalChunkConflict(error, responseMessage)) {
                return Promise.reject(error);
            }

            switch (status) {
                case 401:
                    // Session expired or unauthenticated
                    // Only redirect if we are not already on the login or welcome pages
                    if (!isPublicAuthPage() && !isRedirectingToLogin) {
                        isRedirectingToLogin = true;
                        console.warn(
                            '[API] 401 Unauthorized — redirecting to login',
                        );
                        router.visit('/login');
                    } else {
                        console.warn(
                            '[API] 401 Unauthorized — suppressed redirect on public page',
                        );
                    }
                    break;

                case 403:
                    // Forbidden — show toast via custom event
                    console.warn('[API] 403 Forbidden');
                    window.dispatchEvent(
                        new CustomEvent('api:forbidden', {
                            detail: {
                                message:
                                    'No tienes permiso para realizar esta acción.',
                            },
                        }),
                    );
                    break;

                case 422:
                    if (blockingReason) {
                        console.warn('[API] 422 Blocking response', {
                            message: responseMessage,
                            blocking_reason: blockingReason,
                            data: responseData,
                        });
                        break;
                    }

                    console.warn(
                        '[API] 422 Unprocessable Entity',
                        responseData,
                    );
                    break;

                case 500:
                    console.error('[API] 500 Server Error', {
                        message: responseMessage,
                        data: responseData,
                    });
                    window.dispatchEvent(
                        new CustomEvent('api:server-error', {
                            detail: {
                                message: responseMessage,
                                data: responseData,
                                blocking_reason: blockingReason,
                            },
                        }),
                    );
                    break;

                default:
                    console.error(
                        `[API] Error ${status}:`,
                        error.response.data,
                    );
            }
        } else if (error.code === 'ECONNABORTED') {
            console.error('[API] Request timed out');
            window.dispatchEvent(
                new CustomEvent('api:network-error', {
                    detail: {
                        message:
                            'La solicitud tardo demasiado. Intenta con la importacion en cola.',
                    },
                }),
            );
        } else if (error.request) {
            // Network error — no response received
            const uploadTooLargeMessage = getImportUploadTooLargeMessage(error);
            if (uploadTooLargeMessage) {
                error.message = uploadTooLargeMessage;
                console.error('[API] Upload rejected by server size limits');
                window.dispatchEvent(
                    new CustomEvent('api:network-error', {
                        detail: { message: uploadTooLargeMessage },
                    }),
                );
            } else {
                console.error('[API] No response from server');
                window.dispatchEvent(
                    new CustomEvent('api:network-error', {
                        detail: { message: 'Sin conexión con el servidor.' },
                    }),
                );
            }
        } else {
            console.error('[API] Request error:', error.message);
        }

        return Promise.reject(error);
    },
);

export default apiClient;
