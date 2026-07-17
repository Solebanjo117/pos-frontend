<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { Inbox } from 'lucide-vue-next';
import { onMounted } from 'vue';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import ModuleMetric from '@/components/modules/ModuleMetric.vue';
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
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="cash">
            <template #metrics>
                <ModuleMetric
                    label="Pendientes en caja"
                    :value="count"
                    description="Operaciones esperando cobro"
                    :icon="Inbox"
                />
            </template>
        </ModuleHubLayout>
    </AppLayout>
</template>
