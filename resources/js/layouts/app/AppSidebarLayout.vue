<script setup lang="ts">
import AppContent from '@/components/AppContent.vue';
import AppShell from '@/components/AppShell.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import AppSidebarHeader from '@/components/AppSidebarHeader.vue';
import ToastContainer from '@/components/ToastContainer.vue';
import type { BreadcrumbItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
    showWarehouseSelector?: boolean;
};

withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
    showWarehouseSelector: true,
});
</script>

<template>
    <AppShell variant="sidebar">
        <AppSidebar />
        <AppContent variant="sidebar" class="overflow-x-hidden">
            <AppSidebarHeader
                :breadcrumbs="breadcrumbs"
                :show-warehouse-selector="showWarehouseSelector"
            />
            <slot />
            <footer
                class="mt-auto border-t border-gray-200 px-6 py-3 text-center text-xs text-gray-400 dark:border-gray-700/50 dark:text-gray-500"
            >
                © {{ new Date().getFullYear() }} HermeX POS. Todos los derechos
                reservados.
            </footer>
        </AppContent>
        <ToastContainer />
    </AppShell>
</template>
