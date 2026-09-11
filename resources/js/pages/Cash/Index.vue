<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted } from 'vue';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import { useCashierQueue } from '@/composables/useCashierQueue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Caja', href: '/cash' }];
const { count, fetchPending } = useCashierQueue();

onMounted(() => {
    void fetchPending();
});
</script>

<template>
    <Head title="Caja" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <ModuleHubLayout
            module-id="cash"
            :action-counts="{ '/pos/cashier': count }"
        />
    </AppLayout>
</template>
