<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ArrowLeft } from 'lucide-vue-next';
import { computed } from 'vue';
import ModuleSection from '@/components/modules/ModuleSection.vue';
import PageShell from '@/components/PageShell.vue';
import { Button } from '@/components/ui/button';
import { useModuleNavigation } from '@/composables/useModuleNavigation';
import type { ModuleId } from '@/navigation/modules';

const props = withDefaults(
    defineProps<{
        moduleId: ModuleId;
        showSections?: boolean;
    }>(),
    {
        showSections: true,
    },
);

const { getModule } = useModuleNavigation();
const moduleDefinition = getModule(props.moduleId);
const title = computed(
    () => moduleDefinition.value?.title ?? 'Sin accesos disponibles',
);
const description = computed(
    () =>
        moduleDefinition.value?.description ??
        'Tu rol no tiene funciones disponibles en este módulo.',
);
</script>

<template>
    <PageShell
        :title="title"
        :description="description"
        constrained
        content-class="max-w-[1440px]"
    >
        <template v-if="$slots.actions" #actions>
            <slot name="actions" />
        </template>

        <template v-if="moduleDefinition">
            <slot name="overview" />

            <div
                v-if="$slots.metrics"
                class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
                <slot name="metrics" />
            </div>

            <div
                v-if="showSections"
                class="space-y-7"
                aria-label="Funciones del módulo"
            >
                <ModuleSection
                    v-for="section in moduleDefinition.sections"
                    :key="section.title"
                    :section="section"
                />
            </div>

            <slot />
        </template>

        <div
            v-else
            class="rounded-lg border border-dashed bg-card p-8 text-center"
        >
            <p class="text-sm text-muted-foreground">
                No hay accesos habilitados para tu rol.
            </p>
            <Button as-child variant="outline" class="mt-4">
                <Link href="/dashboard">
                    <ArrowLeft class="size-4" />
                    Volver a Inicio
                </Link>
            </Button>
        </div>
    </PageShell>
</template>
