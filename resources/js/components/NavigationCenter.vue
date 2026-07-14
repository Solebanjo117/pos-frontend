<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ArrowRight } from 'lucide-vue-next';
import type { NavigationCenterGroup } from '@/navigation/centers';

defineProps<{ groups: NavigationCenterGroup[] }>();
</script>

<template>
    <div class="grid gap-x-8 gap-y-6 lg:grid-cols-2">
        <section v-for="group in groups" :key="group.title" class="min-w-0">
            <h2 class="mb-2 border-b pb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {{ group.title }}
            </h2>
            <div class="divide-y rounded-md border bg-card">
                <Link
                    v-for="item in group.items"
                    :key="item.href"
                    :href="item.href"
                    class="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                >
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold">{{ item.title }}</p>
                        <p class="truncate text-xs text-muted-foreground">{{ item.description }}</p>
                    </div>
                    <ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                </Link>
            </div>
        </section>
    </div>
</template>
