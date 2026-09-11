<script setup lang="ts">
import ModuleAction from '@/components/modules/ModuleAction.vue';
import type { ModuleSectionDefinition } from '@/navigation/modules';

defineProps<{
    section: ModuleSectionDefinition;
    actionCounts?: Record<string, number>;
}>();
</script>

<template>
    <section :aria-labelledby="`module-section-${section.title}`">
        <div class="mb-3 space-y-1">
            <h2
                :id="`module-section-${section.title}`"
                class="text-sm font-semibold text-foreground"
            >
                {{ section.title }}
            </h2>
            <p v-if="section.description" class="text-xs text-muted-foreground">
                {{ section.description }}
            </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ModuleAction
                v-for="action in section.actions"
                :key="action.href"
                :action="action"
                :count="actionCounts?.[action.href]"
            />
        </div>
    </section>
</template>
