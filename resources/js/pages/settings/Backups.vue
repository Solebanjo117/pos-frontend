<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import {
    Archive,
    CalendarClock,
    DatabaseBackup,
    Download,
    FileArchive,
    HardDrive,
    Loader2,
    RefreshCw,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';
import { useToast } from '@/composables/useToast';
import apiClient from '@/services/api/client';

const toast = useToast();

interface BackupFile {
    filename: string;
    size_kb: number;
    created_at: string;
}

const backups = ref<BackupFile[]>([]);
const loading = ref(false);
const triggering = ref(false);
const error = ref<string | null>(null);

const fetchBackups = async () => {
    loading.value = true;
    error.value = null;
    try {
        const response = await apiClient.get<BackupFile[]>('/backups');
        backups.value = response.data;
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al cargar backups';
    } finally {
        loading.value = false;
    }
};

const triggerBackup = async () => {
    triggering.value = true;
    try {
        await apiClient.post('/backups/trigger');
        toast.success('Backup creado correctamente');
        await fetchBackups();
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al crear backup');
    } finally {
        triggering.value = false;
    }
};

const downloadBackup = (filename: string) => {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
        /\/$/,
        '',
    );
    window.open(
        `${baseUrl}/backups/${encodeURIComponent(filename)}/download`,
        '_blank',
    );
};

const formatSize = (kb: number): string => {
    if (kb >= 1024) {
        return `${(kb / 1024).toFixed(1)} MB`;
    }

    return `${kb.toFixed(kb % 1 === 0 ? 0 : 1)} KB`;
};

const totalSizeKb = computed(() =>
    backups.value.reduce(
        (total, backup) => total + Number(backup.size_kb || 0),
        0,
    ),
);
const latestBackup = computed(() => backups.value[0] ?? null);

onMounted(fetchBackups);
</script>

<template>
    <AppLayout :breadcrumbs="[{ title: 'Backups', href: '/settings/backups' }]">
        <Head title="Backups" />

        <SettingsLayout>
            <div class="space-y-6">
                <header
                    class="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                    <div class="flex items-start gap-3">
                        <div
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        >
                            <DatabaseBackup class="h-5 w-5" />
                        </div>
                        <div>
                            <h2 class="text-lg font-semibold text-foreground">
                                Backups de base de datos
                            </h2>
                            <p class="text-sm text-muted-foreground">
                                Respaldos automaticos diarios y ejecucion manual
                                para tareas criticas.
                            </p>
                        </div>
                    </div>

                    <button
                        @click="triggerBackup"
                        :disabled="triggering"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
                    >
                        <Loader2
                            v-if="triggering"
                            class="h-4 w-4 animate-spin"
                        />
                        <RefreshCw v-else class="h-4 w-4" />
                        {{ triggering ? 'Creando backup...' : 'Backup ahora' }}
                    </button>
                </header>

                <div class="grid gap-3 md:grid-cols-4">
                    <div class="rounded-lg border bg-card p-4">
                        <div class="flex items-center justify-between gap-2">
                            <p
                                class="text-xs font-medium text-muted-foreground uppercase"
                            >
                                Ultimo backup
                            </p>
                            <CalendarClock
                                class="h-4 w-4 text-muted-foreground"
                            />
                        </div>
                        <p class="mt-2 text-sm font-semibold text-foreground">
                            {{ latestBackup?.created_at ?? 'Sin respaldo' }}
                        </p>
                    </div>
                    <div class="rounded-lg border bg-card p-4">
                        <div class="flex items-center justify-between gap-2">
                            <p
                                class="text-xs font-medium text-muted-foreground uppercase"
                            >
                                Archivos
                            </p>
                            <Archive class="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p class="mt-2 text-2xl font-semibold text-foreground">
                            {{ backups.length }}
                        </p>
                    </div>
                    <div class="rounded-lg border bg-card p-4">
                        <div class="flex items-center justify-between gap-2">
                            <p
                                class="text-xs font-medium text-muted-foreground uppercase"
                            >
                                Tamano total
                            </p>
                            <HardDrive class="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p class="mt-2 text-2xl font-semibold text-foreground">
                            {{ formatSize(totalSizeKb) }}
                        </p>
                    </div>
                    <div class="rounded-lg border bg-card p-4">
                        <div class="flex items-center justify-between gap-2">
                            <p
                                class="text-xs font-medium text-muted-foreground uppercase"
                            >
                                Programacion
                            </p>
                            <DatabaseBackup
                                class="h-4 w-4 text-muted-foreground"
                            />
                        </div>
                        <p class="mt-2 text-sm font-semibold text-foreground">
                            Diario 2:00 AM
                        </p>
                    </div>
                </div>

                <div
                    v-if="error"
                    class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                >
                    {{ error }}
                </div>

                <div
                    v-if="loading"
                    class="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground"
                >
                    Cargando backups...
                </div>

                <div v-else class="overflow-hidden rounded-lg border bg-card">
                    <table class="w-full text-sm">
                        <thead
                            class="bg-muted/50 text-xs text-muted-foreground uppercase"
                        >
                            <tr>
                                <th class="px-4 py-3 text-left">Archivo</th>
                                <th class="px-4 py-3 text-right">Tamano</th>
                                <th class="px-4 py-3 text-left">Fecha</th>
                                <th class="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                            <tr
                                v-for="backup in backups"
                                :key="backup.filename"
                                class="transition-colors hover:bg-muted/30"
                            >
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-2">
                                        <FileArchive
                                            class="h-4 w-4 text-muted-foreground"
                                        />
                                        <span class="font-mono text-xs">
                                            {{ backup.filename }}
                                        </span>
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 text-right text-muted-foreground tabular-nums"
                                >
                                    {{ formatSize(backup.size_kb) }}
                                </td>
                                <td class="px-4 py-3 text-muted-foreground">
                                    {{ backup.created_at }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        @click="downloadBackup(backup.filename)"
                                        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                                    >
                                        <Download class="h-3.5 w-3.5" />
                                        Descargar
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="backups.length === 0">
                                <td
                                    colspan="4"
                                    class="px-4 py-10 text-center text-muted-foreground"
                                >
                                    No hay backups disponibles. Crea el primero
                                    con "Backup ahora".
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </SettingsLayout>
    </AppLayout>
</template>
