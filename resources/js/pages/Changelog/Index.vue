<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import { BookOpen, Clock3, Send, Tag } from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import PageShell from '@/components/PageShell.vue';
import { Button } from '@/components/ui/button';
import {
    changelogApi,
    type ChangelogDraft,
    type ChangelogRelease,
} from '@/services/api/changelog';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Changelog', href: '/changelog' },
];

const loading = ref(true);
const error = ref<string | null>(null);
const releases = ref<ChangelogRelease[]>([]);
const drafts = ref<ChangelogDraft[]>([]);
const publishingId = ref<number | null>(null);

const releaseCountLabel = computed(() => {
    const total = releases.value.length;
    return `${total} release${total === 1 ? '' : 's'}`;
});

const formatDate = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
};

const releaseBadge = (release: ChangelogRelease): string => {
    if (release.source === 'entry') return 'nota rapida';

    return `v${release.version}`;
};

const loadChangelog = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await changelogApi.getChangelog();
        releases.value = Array.isArray(response.data) ? response.data : [];
        drafts.value = Array.isArray(response.drafts) ? response.drafts : [];
    } catch (err: any) {
        error.value =
            err?.response?.data?.message || 'No se pudo cargar el changelog.';
        releases.value = [];
        drafts.value = [];
    } finally {
        loading.value = false;
    }
};

const publishDraft = async (draftId: number) => {
    publishingId.value = draftId;
    error.value = null;

    try {
        await changelogApi.publishEntry(draftId);
        await loadChangelog();
    } catch (err: any) {
        error.value =
            err?.response?.data?.message || 'No se pudo publicar la nota.';
    } finally {
        publishingId.value = null;
    }
};

onMounted(loadChangelog);
</script>

<template>
    <Head title="Changelog" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <PageShell
            title="Changelog"
            description="Historial de cambios recientes de HermeX POS."
            constrained
        >
            <template #actions>
                <span
                    class="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
                >
                    {{ releaseCountLabel }}
                </span>
            </template>

            <section
                v-if="loading"
                class="rounded-lg border bg-card p-8 text-center"
            >
                <div
                    class="mx-auto mb-3 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
                ></div>
                <p class="text-sm text-muted-foreground">
                    Cargando changelog...
                </p>
            </section>

            <section
                v-else-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/30"
            >
                <p class="text-sm font-medium text-red-700 dark:text-red-300">
                    {{ error }}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    class="mt-3"
                    @click="loadChangelog"
                >
                    Reintentar
                </Button>
            </section>

            <template v-else>
                <section
                    v-if="drafts.length > 0"
                    class="rounded-lg border bg-card p-5"
                >
                    <div class="mb-4 flex flex-col gap-1">
                        <h2 class="text-lg font-semibold text-foreground">
                            Borradores pendientes
                        </h2>
                        <p class="text-sm text-muted-foreground">
                            Notas rapidas guardadas desde el dashboard y
                            pendientes de publicacion.
                        </p>
                    </div>

                    <div class="space-y-3">
                        <article
                            v-for="draft in drafts"
                            :key="draft.id"
                            class="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                            <div class="min-w-0">
                                <div
                                    class="mb-1 flex flex-wrap items-center gap-2"
                                >
                                    <span
                                        class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                    >
                                        {{ draft.category }}
                                    </span>
                                    <span
                                        v-if="draft.created_by"
                                        class="text-xs text-muted-foreground"
                                    >
                                        {{ draft.created_by }}
                                    </span>
                                </div>
                                <h3
                                    class="text-sm font-semibold text-foreground"
                                >
                                    {{ draft.title }}
                                </h3>
                                <p
                                    class="mt-1 text-sm break-words text-muted-foreground"
                                >
                                    {{ draft.body }}
                                </p>
                            </div>

                            <Button
                                type="button"
                                size="sm"
                                class="shrink-0"
                                :disabled="publishingId === draft.id"
                                @click="publishDraft(draft.id)"
                            >
                                <Send class="size-4" />
                                Publicar
                            </Button>
                        </article>
                    </div>
                </section>

                <section
                    v-if="releases.length === 0"
                    class="rounded-lg border bg-card p-8 text-center"
                >
                    <p class="text-sm text-muted-foreground">
                        No hay cambios publicados todavia.
                    </p>
                </section>

                <section v-else class="space-y-4">
                    <article
                        v-for="release in releases"
                        :key="`${release.version}-${release.date}`"
                        class="rounded-lg border bg-card p-5"
                    >
                        <header class="mb-3 flex flex-wrap items-center gap-2">
                            <span
                                class="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
                            >
                                {{ releaseBadge(release) }}
                            </span>
                            <span
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                            >
                                <Clock3 class="size-3.5" />
                                {{ formatDate(release.date) }}
                            </span>
                            <span
                                class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            >
                                <Tag class="size-3.5" />
                                {{ release.category }}
                            </span>
                            <span
                                v-if="release.created_by"
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                            >
                                {{ release.created_by }}
                            </span>
                        </header>

                        <h2
                            class="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground"
                        >
                            <BookOpen
                                v-if="release.source === 'entry'"
                                class="size-4 text-muted-foreground"
                            />
                            {{ release.title }}
                        </h2>

                        <ul class="space-y-2 text-sm text-muted-foreground">
                            <li
                                v-for="(change, index) in release.changes"
                                :key="`${release.version}-${index}`"
                                class="flex items-start gap-2"
                            >
                                <span
                                    class="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-primary"
                                ></span>
                                <span class="break-words">{{ change }}</span>
                            </li>
                        </ul>
                    </article>
                </section>
            </template>
        </PageShell>
    </AppLayout>
</template>
