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
const { fetchCurrentUser, isAdmin, role: userRole, hasRole } = useAuth();
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

// Role-based access helpers
const canAccessPOS = computed(() => hasRole(['admin', 'manager', 'cashier']))
const canAccessQuoteEditor = computed(() => hasRole(['admin', 'manager', 'seller']))
const canAccessInventory = computed(() => hasRole(['admin', 'manager', 'buyer']))
const canAccessPurchaseOrders = computed(() => hasRole(['admin', 'manager', 'buyer']))
const canAccessReports = computed(() => hasRole(['admin', 'manager']))
const canAccessCatalog = computed(() => hasRole(['admin', 'manager']))
const canAccessVehicles = computed(() => hasRole(['admin', 'manager', 'seller']))

const mainNavItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];

    // --- Ventas section (role-filtered sub-items) ---
    const ventasSubItems: NavItem[] = [];
    if (canAccessPOS.value) {
        ventasSubItems.push({
            title: 'Punto de Venta',
            href: '/pos',
            icon: ShoppingCart,
        });
    }
    ventasSubItems.push({
        title: 'Órdenes de Venta',
        href: '/sales-orders',
    });
    ventasSubItems.push({
        title: 'Cotizaciones',
        href: '/sales-quotes',
        icon: FileText,
    });
    if (canAccessPOS.value) {
        ventasSubItems.push({
            title: 'Cierres de Caja',
            href: '/pos-sessions',
            icon: Receipt,
        });
    }
    ventasSubItems.push({
        title: 'Órdenes de Trabajo',
        href: '/work-orders',
        icon: Wrench,
    });

    if (ventasSubItems.length > 0) {
        items.push({
            title: 'Ventas',
            icon: ShoppingCart,
            items: ventasSubItems,
        });
    }

    // --- Compras section ---
    if (canAccessPurchaseOrders.value) {
        items.push({
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
        });
    }

    // --- Dashboard (visible to all) ---
    items.push({
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    });

    // --- Inventario section ---
    if (canAccessInventory.value) {
        items.push({
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
        });
    } else {
        // Seller gets read-only Products link (outside Inventario)
        if (canAccessQuoteEditor.value) {
            items.push({
                title: 'Productos',
                href: '/products',
                icon: Package,
            });
        }
    }

    // --- Vehículos ---
    if (canAccessVehicles.value) {
        items.push({
            title: 'Vehículos',
            href: '/vehicles',
            icon: Truck,
        });
    }

    // --- Clientes (visible to all authenticated roles) ---
    items.push({
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
    });

    // --- Catálogo ---
    if (canAccessCatalog.value) {
        items.push({
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
        });
    }

    // --- Reportes ---
    if (canAccessReports.value) {
        items.push({
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
        });
    }

    // --- Administración: visible only for admins ---
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
