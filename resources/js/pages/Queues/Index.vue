<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted } from 'vue';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import { useAuth } from '@/composables/useAuth';
import { useDeliveryQueue } from '@/composables/useDeliveryQueue';
import { usePurchaseOrderQueue } from '@/composables/usePurchaseOrderQueue';
import { useWarehouseQueue } from '@/composables/useWarehouseQueue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cola', href: '/queues' }];
const { hasRole } = useAuth();
const warehouse = useWarehouseQueue();
const delivery = useDeliveryQueue();
const purchaseOrders = usePurchaseOrderQueue();

const canViewWarehouse = hasRole(['admin', 'manager', 'buyer', 'assistant']);
const canViewDelivery = hasRole(['admin', 'manager', 'cashier']);

onMounted(() => {
    if (canViewWarehouse) void warehouse.fetchPending();
    if (canViewDelivery) void delivery.fetchPending();
    void purchaseOrders.fetchPending();
});
</script>

<template>
    <Head title="Cola" />
    <AppLayout :breadcrumbs="breadcrumbs" :show-warehouse-selector="false">
        <ModuleHubLayout
            module-id="queues"
            :action-counts="{
                '/warehouses/queue': warehouse.count.value,
                '/queues/delivery': delivery.count.value,
                '/queues/purchase-orders': purchaseOrders.count.value,
            }"
        />
    </AppLayout>
</template>
