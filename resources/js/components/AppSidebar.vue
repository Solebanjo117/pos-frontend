<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { BookOpen, Folder, LayoutGrid, Package, Warehouse, List, BarChart3, Users, ShoppingCart, Truck, ClipboardList, Factory, ArrowLeftRight, Tag, Car, Wrench, Banknote, Settings, Shield, FileText, Receipt, Store } from 'lucide-vue-next';
import NavFooter from '@/components/NavFooter.vue';
import NavMain from '@/components/NavMain.vue';
import NavUser from '@/components/NavUser.vue';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import AppLogo from './AppLogo.vue';


import { ref, onMounted, computed } from 'vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { useAuth } from '@/composables/useAuth';
import { useStoreSettings } from '@/composables/useStoreSettings';

const { fetchSettings, isSingleWarehouseMode } = usePosSettings();
const { fetchCurrentUser, isAdmin } = useAuth();
const { settings: storeSettings, fetchSettings: fetchStoreSettings } = useStoreSettings();

// Load settings
onMounted(async () => {
    try {
        await Promise.all([fetchSettings(), fetchCurrentUser(), fetchStoreSettings()]);
    } catch (e) {
        console.error('Failed to load settings', e);
    }
});

const filterWorkOrders = (items: NavItem[]): NavItem[] => {
    const enabled = storeSettings.value.modules_work_orders_enabled;

    if (enabled) return items;

    return items
        .filter((item) => {
            const title = item.title.toLowerCase();
            const href = typeof item.href === 'string' ? item.href.toLowerCase() : '';
            return title !== 'órdenes de trabajo' && title !== 'ordenes de trabajo' && !href.includes('/work-orders');
        })
        .map((item) => ({
            ...item,
            items: item.items ? filterWorkOrders(item.items) : item.items,
        }));
};


const mainNavItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [
    {
        title: 'Ventas',
        icon: ShoppingCart,
        items: [
            {
                title: 'Punto de Venta',
                href: '/pos',
                icon: ShoppingCart,
            },
            {
                title: 'Órdenes de Venta',
                href: '/sales-orders',
            },
            {
                title: 'Cotizaciones',
                href: '/sales-quotes',
                icon: FileText,
            },
            {
                title: 'Cierres de Caja',
                href: '/pos-sessions',
                icon: Receipt,
            },
        ],
    },
    {
        title: 'Compras',
        icon: ClipboardList,
        items: [
            {
                title: 'Órdenes de Compra',
                href: '/purchase-orders',
                icon: ClipboardList,
            },
            {
                title: 'Cuentas por Pagar',
                href: '/accounts-payable',
                icon: Factory,
            },
            {
                title: 'Proveedores',
                href: '/suppliers',
                icon: Factory,
            },
        ],
    },
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Inventario',
        href: '/inventory',
        icon: Warehouse,
        items: [
             {
                title: 'Ver Inventario',
                href: '/inventory',
                icon: List,
            },
            {
                title: 'Movimientos',
                href: '/inventory-movements',
                icon: ArrowLeftRight,
            },
            {
                title: 'Transferencias',
                href: '/inventory-transfers',
                icon: ArrowLeftRight,
            },
             {
                title: 'Productos',
                href: '/products',
                icon: Package,
            },
            // Warehouses Management
            {
                title: 'Almacenes',
                href: '/warehouses',
                icon: Warehouse,
            },
            {
                title: 'Stock por Almacén',
                href: '/inventory',
                icon: List,
            },
            {
                title: 'Mermas',
                href: '/inventory/waste',
                icon: Wrench,
            },
        ],
    },
    {
        title: 'Vehículos',
        href: '/vehicles',
        icon: Truck,
    },
    {
        title: 'Clientes',
        icon: Users,
        items: [
            {
                title: 'Directorio',
                href: '/customers',
                icon: Users,
            },
            {
                title: 'Cuentas por Cobrar',
                href: '/ar',
                icon: Banknote,
            },
        ],
    },
    {
        title: 'Catálogo',
        icon: Tag,
        items: [
            {
                title: 'Marcas',
                href: '/brands',
                icon: Tag,
            },
            {
                title: 'Categorías',
                href: '/categories',
                icon: Folder,
            },
        ],
    },
    {
        title: 'Reportes',
        icon: BarChart3,
        items: [
            {
                title: 'Niveles de Stock',
                href: '/reports/stock-levels',
            },
            {
                title: 'Histórico de Movimientos',
                href: '/reports/movement-history',
            },
            {
                title: 'Finanzas y Rentabilidad',
                href: '/reports/financial',
            },
            {
                title: 'Cierre de Caja (Z-Report)',
                href: '/reports/z-report',
            },
        ],
    },
    ];
    // Administración: visible only for admins
    if (isAdmin.value) {
        items.push({
            title: 'Administración',
            icon: Shield,
            items: [
                {
                    title: 'Usuarios',
                    href: '/users',
                    icon: Users,
                },
                {
                    title: 'Backups',
                    href: '/settings/backups',
                    icon: Settings,
                },
                {
                    title: 'Bitácora',
                    href: '/settings/activity-logs',
                    icon: BarChart3,
                },
                {
                    title: 'Config. de Tienda',
                    href: '/settings/store',
                    icon: Store,
                },
            ],
        });
    }

    return filterWorkOrders(items);
});


const footerNavItems: NavItem[] = [];
</script>

<template>
    <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg" as-child>
                        <Link :href="dashboard()">
                            <AppLogo />
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
            <NavMain :items="mainNavItems" />
        </SidebarContent>

        <SidebarFooter>
            <NavFooter :items="footerNavItems" />
            <NavUser />
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>
