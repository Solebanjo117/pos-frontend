<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import { BookOpen, Clock3, Tag } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { changelogApi, type ChangelogRelease } from '@/services/api/changelog'
import { type BreadcrumbItem } from '@/types'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Changelog', href: '/changelog' },
]

const loading = ref(true)
const error = ref<string | null>(null)
const releases = ref<ChangelogRelease[]>([])

const releaseCountLabel = computed(() => {
    const total = releases.value.length
    return `${total} release${total === 1 ? '' : 's'}`
})

const formatDate = (value: string): string => {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value

    return parsed.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    })
}

const loadChangelog = async () => {
    loading.value = true
    error.value = null

    try {
        const response = await changelogApi.getChangelog()
        releases.value = Array.isArray(response.data) ? response.data : []
    } catch (err: any) {
        error.value = err?.response?.data?.message || 'No se pudo cargar el changelog.'
        releases.value = []
    } finally {
        loading.value = false
    }
}

onMounted(loadChangelog)
</script>

<template>
    <Head title="Changelog" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4 md:p-6">
            <div class="mx-auto w-full max-w-5xl space-y-6">
                <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-border dark:bg-card">
                    <div class="flex items-start justify-between gap-4">
                        <div class="space-y-1">
                            <h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
                                <BookOpen class="h-6 w-6 text-blue-600 dark:text-primary" />
                                Changelog
                            </h1>
                            <p class="text-sm text-gray-600 dark:text-gray-300">
                                Historial de cambios recientes de HermeX POS.
                            </p>
                        </div>
                        <span class="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {{ releaseCountLabel }}
                        </span>
                    </div>
                </section>

                <section v-if="loading" class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-border dark:bg-card">
                    <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    <p class="text-sm text-gray-600 dark:text-gray-300">Cargando changelog...</p>
                </section>

                <section v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-800/60 dark:bg-red-900/20">
                    <p class="text-sm font-medium text-red-700 dark:text-red-300">{{ error }}</p>
                    <button
                        type="button"
                        @click="loadChangelog"
                        class="mt-3 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                        Reintentar
                    </button>
                </section>

                <section v-else-if="releases.length === 0" class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-border dark:bg-card">
                    <p class="text-sm text-gray-600 dark:text-gray-300">No hay cambios publicados todavia.</p>
                </section>

                <section v-else class="space-y-4">
                    <article
                        v-for="release in releases"
                        :key="`${release.version}-${release.date}`"
                        class="rounded-xl border border-gray-200 bg-white p-5 dark:border-border dark:bg-card"
                    >
                        <header class="mb-3 flex flex-wrap items-center gap-2">
                            <span class="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-black">
                                v{{ release.version }}
                            </span>
                            <span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-muted dark:text-gray-300">
                                <Clock3 class="h-3.5 w-3.5" />
                                {{ formatDate(release.date) }}
                            </span>
                            <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <Tag class="h-3.5 w-3.5" />
                                {{ release.category }}
                            </span>
                        </header>

                        <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">{{ release.title }}</h2>

                        <ul class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                            <li
                                v-for="(change, index) in release.changes"
                                :key="`${release.version}-${index}`"
                                class="flex items-start gap-2"
                            >
                                <span class="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                                <span>{{ change }}</span>
                            </li>
                        </ul>
                    </article>
                </section>
            </div>
        </div>
    </AppLayout>
</template>
