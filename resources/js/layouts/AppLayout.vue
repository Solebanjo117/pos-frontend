<script setup lang="ts">
import AppLayout from '@/layouts/app/AppSidebarLayout.vue';
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
    <AppLayout
        :breadcrumbs="breadcrumbs"
        :show-warehouse-selector="showWarehouseSelector"
    >
        <slot />
    </AppLayout>
</template>
