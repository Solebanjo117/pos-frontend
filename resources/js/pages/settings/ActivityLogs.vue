<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import {
    Search,
    Activity,
    LogIn,
    LogOut,
    User,
    Calendar,
    Filter,
} from 'lucide-vue-next';

defineOptions({ layout: AppLayout });

interface ActivityLog {
    id: number;
    log_name: string;
    description: string;
    event: string | null;
    causer: { id: number; name: string; email: string; role: string } | null;
    properties: Record<string, any>;
    created_at: string;
}

const logs = ref<ActivityLog[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const currentPage = ref(1);
const lastPage = ref(1);
const total = ref(0);

// Filters
const filterLogName = ref<string>('');
const filterEvent = ref<string>('');
const filterDateFrom = ref<string>('');
const filterDateTo = ref<string>('');

const fetchLogs = async (page = 1) => {
    loading.value = true;
    error.value = null;
    try {
        const params: Record<string, any> = { page, per_page: 30 };
        if (filterLogName.value) params.log_name = filterLogName.value;
        if (filterEvent.value) params.event = filterEvent.value;
        if (filterDateFrom.value) params.date_from = filterDateFrom.value;
        if (filterDateTo.value) params.date_to = filterDateTo.value;

        const res = await apiClient.get('/activity-logs', { params });
        const data = res.data;

        logs.value = data.data ?? [];
        currentPage.value = data.current_page ?? 1;
        lastPage.value = data.last_page ?? 1;
        total.value = data.total ?? 0;
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al cargar la bitácora';
    } finally {
        loading.value = false;
    }
};

const formatDate = (d: string) => {
    const date = new Date(d);
    return (
        date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }) +
        ' ' +
        date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    );
};

const getEventIcon = (event: string | null) => {
    switch (event) {
        case 'login':
            return LogIn;
        case 'logout':
            return LogOut;
        default:
            return Activity;
    }
};

const getEventColor = (event: string | null) => {
    switch (event) {
        case 'login':
            return 'text-green-500 bg-green-50 dark:bg-green-900/20';
        case 'logout':
            return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
        default:
            return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
};

onMounted(() => fetchLogs());
</script>

<template>
    <Head title="Bitácora de Actividad" />

    <div class="mx-auto max-w-6xl p-6">
        <!-- Header -->
        <div class="mb-6">
            <h1
                class="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white"
            >
                <Activity class="h-7 w-7 text-indigo-600 dark:text-primary" />
                Bitácora de Actividad
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Registro de accesos y acciones del sistema
            </p>
        </div>

        <!-- Filters -->
        <div
            class="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
        >
            <div class="flex flex-wrap items-end gap-3">
                <div>
                    <label class="mb-1 block text-xs font-medium text-gray-500"
                        >Tipo</label
                    >
                    <select
                        v-model="filterLogName"
                        @change="fetchLogs(1)"
                        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                    >
                        <option value="">Todos</option>
                        <option value="auth">Autenticación</option>
                        <option value="default">General</option>
                    </select>
                </div>
                <div>
                    <label class="mb-1 block text-xs font-medium text-gray-500"
                        >Evento</label
                    >
                    <select
                        v-model="filterEvent"
                        @change="fetchLogs(1)"
                        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                    >
                        <option value="">Todos</option>
                        <option value="login">Login</option>
                        <option value="logout">Logout</option>
                        <option value="created">Creado</option>
                        <option value="updated">Actualizado</option>
                        <option value="deleted">Eliminado</option>
                    </select>
                </div>
                <div>
                    <label class="mb-1 block text-xs font-medium text-gray-500"
                        >Desde</label
                    >
                    <input
                        v-model="filterDateFrom"
                        @change="fetchLogs(1)"
                        type="date"
                        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                    />
                </div>
                <div>
                    <label class="mb-1 block text-xs font-medium text-gray-500"
                        >Hasta</label
                    >
                    <input
                        v-model="filterDateTo"
                        @change="fetchLogs(1)"
                        type="date"
                        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                    />
                </div>
                <div
                    class="ml-auto self-end pb-2 text-sm text-gray-500 dark:text-gray-400"
                >
                    {{ total }} registros
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="py-12 text-center text-gray-500">
            <div
                class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
            ></div>
            Cargando registros...
        </div>

        <!-- Error -->
        <div
            v-else-if="error"
            class="rounded-xl bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
            {{ error }}
        </div>

        <!-- Log List -->
        <div v-else class="space-y-2">
            <div
                v-if="logs.length === 0"
                class="rounded-xl bg-white p-12 text-center text-gray-400 dark:bg-card"
            >
                <Activity class="mx-auto mb-3 h-12 w-12 opacity-30" />
                No hay registros para los filtros seleccionados.
            </div>

            <div
                v-for="log in logs"
                :key="log.id"
                class="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-border dark:bg-card"
            >
                <!-- Icon -->
                <div
                    class="shrink-0 rounded-xl p-2.5"
                    :class="getEventColor(log.event)"
                >
                    <component :is="getEventIcon(log.event)" class="h-5 w-5" />
                </div>

                <!-- Description -->
                <div class="min-w-0 flex-1">
                    <p
                        class="text-sm font-medium text-gray-900 dark:text-white"
                    >
                        {{ log.description }}
                    </p>
                    <div
                        class="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
                    >
                        <span v-if="log.causer" class="flex items-center gap-1">
                            <User class="h-3 w-3" />
                            {{ log.causer.name }} ({{ log.causer.role }})
                        </span>
                        <span v-if="log.properties?.ip">
                            IP: {{ log.properties.ip }}
                        </span>
                    </div>
                </div>

                <!-- Timestamp -->
                <div class="shrink-0 text-right">
                    <p
                        class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
                    >
                        <Calendar class="h-3.5 w-3.5" />
                        {{ formatDate(log.created_at) }}
                    </p>
                    <span
                        class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                        :class="{
                            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':
                                log.event === 'login',
                            'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400':
                                log.event === 'logout',
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400':
                                !['login', 'logout'].includes(log.event || ''),
                        }"
                    >
                        {{ log.event || log.log_name }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Pagination -->
        <div v-if="lastPage > 1" class="mt-6 flex justify-center gap-2">
            <button
                v-for="page in lastPage"
                :key="page"
                @click="fetchLogs(page)"
                :class="[
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
                    page === currentPage
                        ? 'bg-indigo-600 text-white dark:bg-primary dark:text-primary-foreground'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-300 dark:hover:bg-muted/50',
                ]"
            >
                {{ page }}
            </button>
        </div>
    </div>
</template>
