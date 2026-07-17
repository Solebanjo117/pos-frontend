<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Clientes', href: '/customers/overview' },
];
</script>

<template>
    <Head title="Clientes" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="customers" />
    </AppLayout>
</template>
