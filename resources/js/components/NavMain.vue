<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/composables/useCurrentUrl';
import { toUrl } from '@/lib/utils';
import { type NavItem } from '@/types';

defineProps<{
    items: NavItem[];
}>();

const { currentUrl, isCurrentUrl } = useCurrentUrl();
const { isMobile, state } = useSidebar();

const isIconCollapsed = computed(
    () => state.value === 'collapsed' && !isMobile.value,
);

const isCurrentOrChildUrl = (href: NavItem['href']): boolean => {
    const url = toUrl(href);
    if (!url) return false;
    if (isCurrentUrl(url)) return true;
    if (url === '/') return currentUrl.value === '/';
    return currentUrl.value.startsWith(`${url}/`);
};

// Only expand the sidebar group that contains the active page
const isGroupActive = (item: NavItem): boolean => {
    if (!item.items) return false;
    return item.items.some((sub) => isCurrentOrChildUrl(sub.href));
};
</script>

<template>
    <SidebarGroup class="px-2 py-0">
        <SidebarGroupLabel>Platform</SidebarGroupLabel>
        <SidebarMenu>
            <template v-for="item in items" :key="item.title">
                <template v-if="item.items && item.items.length > 0">
                    <!-- Collapsed desktop submenu flyout -->
                    <DropdownMenu v-if="isIconCollapsed">
                        <SidebarMenuItem>
                            <DropdownMenuTrigger as-child>
                                <SidebarMenuButton
                                    :is-active="isGroupActive(item)"
                                >
                                    <component
                                        :is="item.icon"
                                        v-if="item.icon"
                                    />
                                    <span>{{ item.title }}</span>
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="right"
                                align="start"
                                :side-offset="8"
                                class="min-w-56"
                            >
                                <DropdownMenuLabel>
                                    {{ item.title }}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                    v-for="subItem in item.items"
                                    :key="subItem.title"
                                    :as-child="true"
                                >
                                    <Link
                                        :href="subItem.href"
                                        class="flex w-full items-center gap-2"
                                        :class="{
                                            'bg-sidebar-primary text-sidebar-primary-foreground':
                                                subItem.href
                                                    ? isCurrentUrl(subItem.href)
                                                    : false,
                                        }"
                                    >
                                        <component
                                            :is="subItem.icon"
                                            v-if="subItem.icon"
                                        />
                                        <span>{{ subItem.title }}</span>
                                        <span
                                            v-if="subItem.badge"
                                            class="ml-auto inline-flex items-center justify-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] leading-none font-bold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                                            >{{ subItem.badge }}</span
                                        >
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </SidebarMenuItem>
                    </DropdownMenu>

                    <!-- Item with Subitems (Collapsible) -->
                    <Collapsible
                        v-else
                        as-child
                        :default-open="isGroupActive(item)"
                        class="group/collapsible"
                    >
                        <SidebarMenuItem>
                            <CollapsibleTrigger as-child>
                                <SidebarMenuButton :tooltip="item.title">
                                    <component
                                        :is="item.icon"
                                        v-if="item.icon"
                                    />
                                    <span>{{ item.title }}</span>
                                    <ChevronRight
                                        class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                                    />
                                </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    <SidebarMenuSubItem
                                        v-for="subItem in item.items"
                                        :key="subItem.title"
                                    >
                                        <SidebarMenuSubButton
                                            as-child
                                            :is-active="
                                                subItem.href
                                                    ? isCurrentUrl(subItem.href)
                                                    : false
                                            "
                                        >
                                            <Link :href="subItem.href">
                                                <component
                                                    :is="subItem.icon"
                                                    v-if="subItem.icon"
                                                />
                                                <span>{{ subItem.title }}</span>
                                                <span
                                                    v-if="subItem.badge"
                                                    class="ml-auto inline-flex items-center justify-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] leading-none font-bold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                                                    >{{ subItem.badge }}</span
                                                >
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </SidebarMenuItem>
                    </Collapsible>
                </template>

                <!-- Regular Item (No Subitems) -->
                <SidebarMenuItem v-else>
                    <SidebarMenuButton
                        as-child
                        :is-active="item.href ? isCurrentUrl(item.href) : false"
                        :tooltip="item.title"
                    >
                        <Link :href="item.href">
                            <component :is="item.icon" v-if="item.icon" />
                            <span>{{ item.title }}</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </template>
        </SidebarMenu>
    </SidebarGroup>
</template>
