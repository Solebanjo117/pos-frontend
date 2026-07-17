<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Vehículos', href: '/vehicles/overview' },
];
</script>

<template>
    <Head title="Vehículos" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="vehicles" />
    </AppLayout>
</template>
