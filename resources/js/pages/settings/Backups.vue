<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import SettingsLayout from '@/layouts/settings/Layout.vue'
import Heading from '@/components/Heading.vue'
import apiClient from '@/services/api/client'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface BackupFile {
    filename: string
    size_kb: number
    created_at: string
}

const backups = ref<BackupFile[]>([])
const loading = ref(false)
const triggering = ref(false)
const error = ref<string | null>(null)

const fetchBackups = async () => {
    loading.value = true
    error.value = null
    try {
        const response = await apiClient.get<BackupFile[]>('/backups')
        backups.value = response.data
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al cargar backups'
    } finally {
        loading.value = false
    }
}

const triggerBackup = async () => {
    triggering.value = true
    try {
        await apiClient.post('/backups/trigger')
        toast.success('Backup creado correctamente')
        await fetchBackups()
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al crear backup')
    } finally {
        triggering.value = false
    }
}

const downloadBackup = (filename: string) => {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
    window.open(`${baseUrl}/backups/${encodeURIComponent(filename)}/download`, '_blank')
}

const formatSize = (kb: number): string => {
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
    return `${kb} KB`
}

onMounted(fetchBackups)
</script>

<template>
    <AppLayout :breadcrumbs="[{ title: 'Backups', href: '/settings/backups' }]">
        <Head title="Backups" />

        <SettingsLayout>
            <div class="space-y-6">
                <Heading
                    variant="small"
                    title="Backups de Base de Datos"
                    description="Los backups automáticos se generan diariamente a las 2:00 AM"
                />

                <!-- Trigger button -->
                <div class="flex justify-end">
                    <button
                        @click="triggerBackup"
                        :disabled="triggering"
                        class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        <svg v-if="triggering" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {{ triggering ? 'Creando backup...' : 'Hacer Backup Ahora' }}
                    </button>
                </div>

                <!-- Error -->
                <div v-if="error" class="rounded-md bg-red-50 p-4 text-sm text-red-700">{{ error }}</div>

                <!-- Loading -->
                <div v-if="loading" class="text-center py-8 text-muted-foreground text-sm">Cargando backups...</div>

                <!-- Table -->
                <div v-else class="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <table class="w-full text-sm">
                        <thead class="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th class="px-4 py-3 text-left">Archivo</th>
                                <th class="px-4 py-3 text-left">Tamaño</th>
                                <th class="px-4 py-3 text-left">Fecha</th>
                                <th class="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                            <tr v-for="backup in backups" :key="backup.filename" class="hover:bg-muted/30 transition-colors">
                                <td class="px-4 py-3 font-mono text-xs">{{ backup.filename }}</td>
                                <td class="px-4 py-3 text-muted-foreground">{{ formatSize(backup.size_kb) }}</td>
                                <td class="px-4 py-3 text-muted-foreground">{{ backup.created_at }}</td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        @click="downloadBackup(backup.filename)"
                                        class="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                        Descargar
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="backups.length === 0">
                                <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">
                                    No hay backups disponibles. Haz clic en "Hacer Backup Ahora" para crear el primero.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </SettingsLayout>
    </AppLayout>
</template>

