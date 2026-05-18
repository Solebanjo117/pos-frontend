<script setup lang="ts">
import AppContent from '@/components/AppContent.vue';
import AppHeader from '@/components/AppHeader.vue';
import AppShell from '@/components/AppShell.vue';
import type { BreadcrumbItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
});
</script>

<template>
    <AppShell class="flex-col">
        <AppHeader :breadcrumbs="breadcrumbs" />
        <AppContent>
            <slot />
            <footer
                class="mt-auto border-t border-gray-200 px-6 py-3 text-center text-xs text-gray-400 dark:border-gray-700/50 dark:text-gray-500"
            >
                © {{ new Date().getFullYear() }} HermeX POS. Todos los derechos
                reservados.
            </footer>
        </AppContent>
    </AppShell>
</template>
