<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { findModuleForPath, type ModuleDefinition } from '@/navigation/modules';

defineProps<{
    items: ModuleDefinition[];
}>();

const page = usePage();
const activeModule = computed(() => findModuleForPath(page.url));
</script>

<template>
    <SidebarGroup class="px-2 py-0">
        <SidebarGroupLabel>Módulos</SidebarGroupLabel>
        <SidebarMenu>
            <SidebarMenuItem v-for="item in items" :key="item.id">
                <SidebarMenuButton
                    as-child
                    :is-active="activeModule?.id === item.id"
                    :tooltip="item.title"
                >
                    <Link :href="item.href" :aria-label="item.title">
                        <component :is="item.icon" aria-hidden="true" />
                        <span>{{ item.title }}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    </SidebarGroup>
</template>
