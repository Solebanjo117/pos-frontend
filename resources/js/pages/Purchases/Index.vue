<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Compras', href: '/purchases' },
];
</script>

<template>
    <Head title="Compras" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="purchases" />
    </AppLayout>
</template>
