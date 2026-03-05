<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Building2 } from 'lucide-vue-next';
import type { BreadcrumbItem } from '@/types';
import apiClient from '@/services/api/client';

withDefaults(
    defineProps<{
        breadcrumbs?: BreadcrumbItem[];
    }>(),
    {
        breadcrumbs: () => [],
    },
);

interface AllowedWarehouse {
    id: number
    name: string
}

const currentWarehouseId = ref<number | null>(null)
const allowedWarehouses = ref<AllowedWarehouse[]>([])
const switching = ref(false)

onMounted(async () => {
    try {
        const res = await apiClient.get('/user/warehouse-context')
        currentWarehouseId.value = res.data.current_warehouse_id
        allowedWarehouses.value = res.data.allowed_warehouses || []
    } catch (e) {
        console.error('Failed to load warehouse context', e)
    }
})

const switchWarehouse = async (event: Event) => {
    const target = event.target as HTMLSelectElement
    const newId = Number(target.value)
    if (!newId || newId === currentWarehouseId.value) return

    switching.value = true
    try {
        await apiClient.post('/user/warehouse-context', { warehouse_id: newId })
        // Reload to refresh all data with new warehouse context
        window.location.reload()
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al cambiar sucursal')
        switching.value = false
    }
}
</script>

<template>
    <header
        class="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/70 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4"
    >
        <div class="flex items-center gap-2 flex-1">
            <SidebarTrigger class="-ml-1" />
            <template v-if="breadcrumbs && breadcrumbs.length > 0">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />
            </template>
        </div>

        <!-- Global Warehouse Selector -->
        <div v-if="allowedWarehouses.length > 0" class="flex items-center gap-2">
            <Building2 :size="16" class="text-indigo-500" />
            <select
                :value="currentWarehouseId"
                @change="switchWarehouse"
                :disabled="switching || allowedWarehouses.length <= 1"
                class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-primary focus:border-transparent dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted transition-colors"
                :class="{ 'opacity-60 cursor-not-allowed': switching }"
            >
                <option v-for="w in allowedWarehouses" :key="w.id" :value="w.id">
                    {{ w.name }}
                </option>
            </select>
        </div>
    </header>
</template>

