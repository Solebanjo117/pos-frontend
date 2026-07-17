<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { ClipboardCheck, PackageSearch, Truck } from 'lucide-vue-next';
import { onMounted } from 'vue';
import ModuleHubLayout from '@/components/modules/ModuleHubLayout.vue';
import ModuleMetric from '@/components/modules/ModuleMetric.vue';
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
    <AppLayout :breadcrumbs="breadcrumbs">
        <ModuleHubLayout module-id="queues">
            <template #metrics>
                <ModuleMetric
                    v-if="canViewWarehouse"
                    label="Pendientes en bodega"
                    :value="warehouse.count.value"
                    :icon="PackageSearch"
                />
                <ModuleMetric
                    v-if="canViewDelivery"
                    label="Pendientes de entrega"
                    :value="delivery.count.value"
                    :icon="Truck"
                />
                <ModuleMetric
                    label="Pedidos por recibir"
                    :value="purchaseOrders.count.value"
                    :icon="ClipboardCheck"
                />
            </template>
        </ModuleHubLayout>
    </AppLayout>
</template>
