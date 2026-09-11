<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Ventas', href: '/sales' }];
</script>

<template>
    <Head title="Ventas" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <ModuleHubLayout module-id="sales" />
    </AppLayout>
</template>
