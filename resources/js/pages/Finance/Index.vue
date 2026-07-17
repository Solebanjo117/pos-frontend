<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Finanzas', href: '/finance' }];
</script>

<template>
    <Head title="Finanzas" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="finance" />
    </AppLayout>
</template>
