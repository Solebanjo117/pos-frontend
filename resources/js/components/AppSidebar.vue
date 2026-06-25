<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import {
    Banknote,
    BarChart3,
    Car,
    ClipboardCheck,
    ClipboardList,
    Factory,
    FileText,
    Folder,
    Inbox,
    ListOrdered,
    Package,
    PackageSearch,
    Receipt,
    RotateCcw,
    Settings,
    ShoppingCart,
    Store,
    Tag,
    Truck,
    Users,
    Warehouse,
    Wrench,
} from 'lucide-vue-next';
import { onMounted, computed } from 'vue';
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

import { useAuth } from '@/composables/useAuth';
import { useCashierQueue } from '@/composables/useCashierQueue';
import { useDeliveryQueue } from '@/composables/useDeliveryQueue';
import { usePosSettings } from '@/composables/usePosSettings';
import { usePurchaseOrderQueue } from '@/composables/usePurchaseOrderQueue';
import { useStoreSettings } from '@/composables/useStoreSettings';
import { useWarehouseQueue } from '@/composables/useWarehouseQueue';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import AppLogo from './AppLogo.vue';

const { fetchSettings } = usePosSettings();
const { fetchCurrentUser, isAdmin, role: userRole, hasRole } = useAuth();
const { settings: storeSettings, fetchSettings: fetchStoreSettings } =
    useStoreSettings();
const { count: cashierQueueCount, startPolling: startCashierPolling } =
    useCashierQueue();
const { count: warehouseQueueCount, startPolling: startWarehousePolling } =
    useWarehouseQueue();
const { count: deliveryQueueCount, startPolling: startDeliveryPolling } =
    useDeliveryQueue();
const {
    count: purchaseOrderQueueCount,
    startPolling: startPurchaseOrderQueuePolling,
} = usePurchaseOrderQueue();

const canAccessCashierQueue = computed(() =>
    hasRole(['admin', 'manager', 'cashier']),
);
const canAccessWarehouseQueue = computed(() =>
    hasRole(['admin', 'manager', 'buyer', 'assistant']),
);
const canAccessDeliveryQueue = computed(() =>
    hasRole(['admin', 'manager', 'cashier']),
);
const canAccessPurchaseOrderQueue = computed(() => Boolean(userRole.value));

// Load settings
onMounted(async () => {
    try {
        await Promise.all([
            fetchSettings(),
            fetchCurrentUser(),
            fetchStoreSettings(),
        ]);
        if (canAccessCashierQueue.value) {
            startCashierPolling(30000);
        }
        if (canAccessWarehouseQueue.value) {
            startWarehousePolling(30000);
        }
        if (canAccessDeliveryQueue.value) {
            startDeliveryPolling(30000);
        }
        if (canAccessPurchaseOrderQueue.value) {
            startPurchaseOrderQueuePolling(30000);
        }
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
            const href =
                typeof item.href === 'string' ? item.href.toLowerCase() : '';
            return (
                title !== 'órdenes de trabajo' &&
                title !== 'ordenes de trabajo' &&
                !href.includes('/work-orders')
            );
        })
        .map((item) => ({
            ...item,
            items: item.items ? filterWorkOrders(item.items) : item.items,
        }));
};

// Role-based access helpers
const canAccessPOS = computed(() => hasRole(['admin', 'manager', 'cashier']));
const canAccessQuoteEditor = computed(() =>
    hasRole(['admin', 'manager', 'seller']),
);
const canAccessPurchaseOrders = computed(() =>
    hasRole(['admin', 'manager', 'buyer']),
);
const canAccessReports = computed(() => hasRole(['admin', 'manager']));
const canAccessCatalog = computed(() => hasRole(['admin', 'manager']));
const canAccessVehicles = computed(() =>
    hasRole(['admin', 'manager', 'seller']),
);
const canAccessReturns = computed(() =>
    hasRole(['admin', 'manager', 'cashier', 'buyer', 'assistant']),
);

const mainNavItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];

    // --- Cola ---
    const queueItems: NavItem[] = [];
    if (canAccessCashierQueue.value) {
        queueItems.push({
            title: 'Cola Caja',
            href: '/pos/cashier',
            icon: Inbox,
            badge:
                cashierQueueCount.value > 0
                    ? String(cashierQueueCount.value)
                    : undefined,
        });
    }
    if (canAccessWarehouseQueue.value) {
        queueItems.push({
            title: 'Cola Bodega',
            href: '/warehouses/queue',
            icon: PackageSearch,
            badge:
                warehouseQueueCount.value > 0
                    ? String(warehouseQueueCount.value)
                    : undefined,
        });
    }
    if (canAccessDeliveryQueue.value) {
        queueItems.push({
            title: 'Cola Entrega',
            href: '/queues/delivery',
            icon: Truck,
            badge:
                deliveryQueueCount.value > 0
                    ? String(deliveryQueueCount.value)
                    : undefined,
        });
    }
    if (canAccessPurchaseOrderQueue.value) {
        queueItems.push({
            title: 'Cola Pedidos',
            href: '/queues/purchase-orders',
            icon: ClipboardCheck,
            badge:
                purchaseOrderQueueCount.value > 0
                    ? String(purchaseOrderQueueCount.value)
                    : undefined,
        });
    }

    if (queueItems.length > 0) {
        items.push({
            title: 'Cola',
            icon: ListOrdered,
            items: queueItems,
        });
    }

    // --- Ventas ---
    const salesItems: NavItem[] = [];
    if (canAccessPOS.value) {
        salesItems.push({
            title: 'Caja',
            href: '/pos',
            icon: ShoppingCart,
        });
        salesItems.push({
            title: 'Cierres de Caja',
            href: '/pos-sessions',
            icon: Receipt,
        });
    }

    salesItems.push({
        title: 'Órdenes de Venta',
        href: '/sales-orders',
        icon: ClipboardList,
    });

    if (canAccessPOS.value || canAccessQuoteEditor.value) {
        salesItems.push({
            title: 'Cotizaciones',
            href: '/sales-quotes',
            icon: FileText,
        });
    }

    if (salesItems.length > 0) {
        items.push({
            title: 'Ventas',
            icon: ShoppingCart,
            items: salesItems,
        });
    }

    // --- Compras ---
    if (canAccessPurchaseOrders.value) {
        items.push({
            title: 'Compras',
            icon: ClipboardList,
            items: [
                {
                    title: 'Lista de Abastecimiento',
                    href: '/supply-list',
                    icon: ClipboardList,
                },
                {
                    title: 'Órdenes de Compra',
                    href: '/purchase-orders',
                    icon: ClipboardList,
                },
                {
                    title: 'Cuentas por Pagar',
                    href: '/accounts-payable',
                    icon: Banknote,
                },
                {
                    title: 'Gastos operativos',
                    href: '/operational-expenses',
                    icon: Receipt,
                },
                {
                    title: 'Proveedores',
                    href: '/suppliers',
                    icon: Factory,
                },
            ],
        });
    }

    // --- Inventario ---
    const inventoryItems: NavItem[] = [
        {
            title: 'Inventario',
            href: '/inventory',
            icon: Warehouse,
        },
        {
            title: 'Productos',
            href: '/products',
            icon: Package,
        },
    ];

    if (canAccessReturns.value) {
        inventoryItems.push({
            title: 'Devoluciones',
            href: '/returns',
            icon: RotateCcw,
        });
    }

    if (canAccessCatalog.value) {
        inventoryItems.push({
            title: 'Categorias',
            href: '/categories',
            icon: Folder,
        });
        inventoryItems.push({
            title: 'Marcas',
            href: '/brands',
            icon: Tag,
        });
    }

    if (inventoryItems.length > 0) {
        items.push({
            title: 'Inventario',
            icon: Warehouse,
            items: inventoryItems,
        });
    }

    // --- Vehículos ---
    if (canAccessVehicles.value) {
        items.push({
            title: 'Vehículos',
            icon: Truck,
            items: [
                {
                    title: 'Carros',
                    href: '/vehicles',
                    icon: Car,
                },
                {
                    title: 'Motores',
                    href: '/vehicles/engines',
                    icon: Wrench,
                },
            ],
        });
    }

    // --- Clientes ---
    items.push({
        title: 'Clientes',
        icon: Users,
        items: [
            {
                title: 'Clientes',
                href: '/customers',
                icon: Users,
            },
            {
                title: 'Credito cliente',
                href: '/ar',
                icon: Banknote,
            },
            {
                title: 'Ordenes de Trabajo',
                href: '/work-orders',
                icon: Wrench,
            },
        ],
    });

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
                    title: 'Clientes y referencias',
                    href: '/reports/customer-references',
                },
                {
                    title: 'Ventas por Cliente',
                    href: '/reports/sales-by-client',
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
            title: 'Settings',
            icon: Settings,
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
                {
                    title: 'Fórmulas de Precio',
                    href: '/settings/pricing-formulas',
                    icon: Settings,
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
