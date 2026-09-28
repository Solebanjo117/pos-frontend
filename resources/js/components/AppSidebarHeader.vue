<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { AlertTriangle } from 'lucide-vue-next';
import { computed, ref, onMounted } from 'vue';
import Breadcrumbs from '@/components/Breadcrumbs.vue';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePosSettings } from '@/composables/usePosSettings';
import { resolveModuleBreadcrumbs } from '@/navigation/modules';
import apiClient from '@/services/api/client';
import type { BreadcrumbItem } from '@/types';

const props = withDefaults(
    defineProps<{
        breadcrumbs?: BreadcrumbItem[];
        showWarehouseSelector?: boolean;
    }>(),
    {
        breadcrumbs: () => [],
        showWarehouseSelector: true,
    },
);

const page = usePage();
const resolvedBreadcrumbs = computed<BreadcrumbItem[]>(() =>
    resolveModuleBreadcrumbs(page.url, props.breadcrumbs),
);

const { currentWarehouseId } = usePosSettings();
const missingServerWarehouse = ref(false);
const missingWarehouse = computed(
    () => missingServerWarehouse.value && currentWarehouseId.value === null,
);

onMounted(async () => {
    try {
        const res = await apiClient.get('/user/warehouse-context');
        missingServerWarehouse.value = !res.data.current_warehouse_id;
    } catch (cause) {
        console.error('Failed to load warehouse context', cause);
    }
});
</script>

<template>
    <header
        class="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/70 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4"
    >
        <div class="flex flex-1 items-center gap-2">
            <SidebarTrigger class="-ml-1" />
            <template v-if="resolvedBreadcrumbs.length > 0">
                <Breadcrumbs :breadcrumbs="resolvedBreadcrumbs" />
            </template>
        </div>

        <div
            v-if="missingWarehouse"
            role="status"
            class="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
            <AlertTriangle :size="15" />
            No tienes una sucursal asignada. Solicita la asignación a un
            administrador.
        </div>
    </header>
</template>
