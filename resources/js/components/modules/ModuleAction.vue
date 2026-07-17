<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ArrowRight } from 'lucide-vue-next';
import type { ModuleActionDefinition } from '@/navigation/modules';

defineProps<{
    action: ModuleActionDefinition;
}>();
</script>

<template>
    <Link
        :href="action.href"
        class="group flex min-h-24 items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
        <span
            class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors group-hover:text-foreground"
            aria-hidden="true"
        >
            <component :is="action.icon" class="size-4" />
        </span>
        <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-foreground">
                {{ action.title }}
            </span>
            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                {{ action.description }}
            </span>
        </span>
        <ArrowRight
            class="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden="true"
        />
    </Link>
</template>
