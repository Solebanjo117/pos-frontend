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

const isItemActive = (item: NavItem): boolean =>
    isCurrentOrChildUrl(item.href) ||
    Boolean(item.items?.some((child) => isItemActive(child)));

// Expand every parent needed to expose the active leaf, including level two.
const isGroupActive = (item: NavItem): boolean =>
    Boolean(item.items?.some((child) => isItemActive(child)));
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
                                <template
                                    v-for="subItem in item.items"
                                    :key="subItem.title"
                                >
                                    <template
                                        v-if="subItem.items && subItem.items.length"
                                    >
                                        <DropdownMenuLabel
                                            class="pt-2 text-[10px] tracking-wide text-slate-400 uppercase"
                                        >
                                            {{ subItem.title }}
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem
                                            v-for="nestedItem in subItem.items"
                                            :key="nestedItem.title"
                                            :as-child="true"
                                        >
                                            <Link
                                                :href="nestedItem.href"
                                                class="flex w-full items-center gap-2 pl-4"
                                                :class="{
                                                    'bg-sidebar-primary text-sidebar-primary-foreground':
                                                        isItemActive(nestedItem),
                                                }"
                                            >
                                                <component
                                                    :is="nestedItem.icon"
                                                    v-if="nestedItem.icon"
                                                />
                                                <span>{{ nestedItem.title }}</span>
                                                <span
                                                    v-if="nestedItem.badge"
                                                    class="ml-auto inline-flex items-center justify-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] leading-none font-bold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                                                    >{{ nestedItem.badge }}</span
                                                >
                                            </Link>
                                        </DropdownMenuItem>
                                    </template>
                                    <DropdownMenuItem v-else :as-child="true">
                                        <Link
                                            :href="subItem.href"
                                            class="flex w-full items-center gap-2"
                                            :class="{
                                                'bg-sidebar-primary text-sidebar-primary-foreground':
                                                    isItemActive(subItem),
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
                                </template>
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
                                    <template
                                        v-for="subItem in item.items"
                                        :key="subItem.title"
                                    >
                                        <SidebarMenuSubItem
                                            v-if="
                                                subItem.items &&
                                                subItem.items.length
                                            "
                                            class="py-1"
                                        >
                                            <div
                                                class="px-2 pb-1 text-[10px] font-semibold tracking-wide text-sidebar-foreground/55 uppercase"
                                            >
                                                {{ subItem.title }}
                                            </div>
                                            <SidebarMenuSub
                                                class="mx-0 border-l border-sidebar-border px-1"
                                            >
                                                <SidebarMenuSubItem
                                                    v-for="nestedItem in subItem.items"
                                                    :key="nestedItem.title"
                                                >
                                                    <SidebarMenuSubButton
                                                        as-child
                                                        :is-active="
                                                            isItemActive(
                                                                nestedItem,
                                                            )
                                                        "
                                                    >
                                                        <Link
                                                            :href="nestedItem.href"
                                                        >
                                                            <component
                                                                :is="nestedItem.icon"
                                                                v-if="
                                                                    nestedItem.icon
                                                                "
                                                            />
                                                            <span>
                                                                {{
                                                                    nestedItem.title
                                                                }}
                                                            </span>
                                                            <span
                                                                v-if="
                                                                    nestedItem.badge
                                                                "
                                                                class="ml-auto inline-flex items-center justify-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] leading-none font-bold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                                                                >{{
                                                                    nestedItem.badge
                                                                }}</span
                                                            >
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            </SidebarMenuSub>
                                        </SidebarMenuSubItem>
                                        <SidebarMenuSubItem v-else>
                                            <SidebarMenuSubButton
                                                as-child
                                                :is-active="
                                                    isItemActive(subItem)
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
                                    </template>
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
