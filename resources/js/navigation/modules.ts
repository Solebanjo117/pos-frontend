import {
    Banknote,
    BarChart3,
    Boxes,
    Car,
    ClipboardCheck,
    ClipboardList,
    Factory,
    FileText,
    Folder,
    Gauge,
    History,
    Inbox,
    Landmark,
    ListOrdered,
    Package,
    PackagePlus,
    PackageSearch,
    Plus,
    Receipt,
    RefreshCw,
    RotateCcw,
    Settings,
    ShoppingCart,
    Store,
    Tag,
    Truck,
    UserRound,
    Users,
    Warehouse,
    Wrench,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import type { BreadcrumbItem } from '@/types';

export type AppRole =
    | 'admin'
    | 'manager'
    | 'buyer'
    | 'seller'
    | 'cashier'
    | 'assistant';

export type ModuleId =
    | 'home'
    | 'cash'
    | 'queues'
    | 'sales'
    | 'purchases'
    | 'inventory'
    | 'vehicles'
    | 'customers'
    | 'finance'
    | 'records'
    | 'reports'
    | 'settings';

export type ModuleFeature = 'workOrders';

export interface ModuleActionDefinition {
    title: string;
    href: string;
    description: string;
    icon: LucideIcon;
    roles?: AppRole[];
    feature?: ModuleFeature;
}

export interface ModuleSectionDefinition {
    title: string;
    description?: string;
    actions: ModuleActionDefinition[];
}

export interface ModuleDefinition {
    id: ModuleId;
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    activePaths: string[];
    sections: ModuleSectionDefinition[];
}

export interface NavigationFeatures {
    workOrdersEnabled: boolean;
}

const roles = {
    adminManager: ['admin', 'manager'] as AppRole[],
    cash: ['admin', 'manager', 'cashier'] as AppRole[],
    inventory: ['admin', 'manager', 'buyer', 'assistant'] as AppRole[],
    purchasing: ['admin', 'manager', 'buyer'] as AppRole[],
    sales: ['admin', 'manager', 'buyer', 'seller', 'assistant'] as AppRole[],
};

export const moduleDefinitions: ModuleDefinition[] = [
    {
        id: 'home',
        title: 'Inicio',
        description: 'Resumen general, alertas y actividad de la operación.',
        href: '/dashboard',
        icon: Gauge,
        activePaths: ['/dashboard'],
        sections: [
            {
                title: 'Resumen',
                actions: [
                    {
                        title: 'Panel principal',
                        href: '/dashboard',
                        description:
                            'Indicadores y actividad reciente del negocio.',
                        icon: Gauge,
                    },
                ],
            },
        ],
    },
    {
        id: 'cash',
        title: 'Caja',
        description: 'Operación de caja, efectivo, sesiones y cierres diarios.',
        href: '/cash',
        icon: Banknote,
        activePaths: ['/cash', '/pos', '/pos-sessions', '/reports/z-report'],
        sections: [
            {
                title: 'Operación',
                actions: [
                    {
                        title: 'Punto de venta',
                        href: '/pos',
                        description: 'Registrar ventas y procesar pagos.',
                        icon: ShoppingCart,
                        roles: roles.cash,
                    },
                    {
                        title: 'Cola de caja',
                        href: '/pos/cashier',
                        description: 'Atender operaciones pendientes de cobro.',
                        icon: Inbox,
                        roles: roles.cash,
                    },
                ],
            },
            {
                title: 'Efectivo y cierres',
                actions: [
                    {
                        title: 'Agregar efectivo',
                        href: '/pos?cash_action=in',
                        description:
                            'Registrar una entrada manual de efectivo.',
                        icon: Plus,
                        roles: roles.cash,
                    },
                    {
                        title: 'Retirar efectivo',
                        href: '/pos?cash_action=out',
                        description: 'Registrar una salida manual de efectivo.',
                        icon: Banknote,
                        roles: roles.cash,
                    },
                    {
                        title: 'Sesiones y cierres',
                        href: '/pos-sessions',
                        description:
                            'Consultar aperturas, movimientos y cierres.',
                        icon: Receipt,
                        roles: roles.cash,
                    },
                    {
                        title: 'Cierre Z',
                        href: '/reports/z-report',
                        description: 'Revisar el resumen diario de caja.',
                        icon: FileText,
                        roles: roles.cash,
                    },
                ],
            },
        ],
    },
    {
        id: 'queues',
        title: 'Cola',
        description: 'Trabajo pendiente de bodega, entrega y pedidos.',
        href: '/queues',
        icon: ListOrdered,
        activePaths: [
            '/queues',
            '/warehouses/queue',
            '/queues/delivery',
            '/queues/purchase-orders',
        ],
        sections: [
            {
                title: 'Operación pendiente',
                actions: [
                    {
                        title: 'Cola de bodega',
                        href: '/warehouses/queue',
                        description: 'Preparar artículos solicitados a bodega.',
                        icon: PackageSearch,
                        roles: roles.inventory,
                    },
                    {
                        title: 'Cola de entrega',
                        href: '/queues/delivery',
                        description: 'Gestionar ventas listas para entregar.',
                        icon: Truck,
                        roles: roles.cash,
                    },
                    {
                        title: 'Cola de pedidos',
                        href: '/queues/purchase-orders',
                        description: 'Consultar pedidos de compra pendientes.',
                        icon: ClipboardCheck,
                    },
                ],
            },
        ],
    },
    {
        id: 'sales',
        title: 'Ventas',
        description: 'Transacciones, cotizaciones y seguimiento comercial.',
        href: '/sales',
        icon: ShoppingCart,
        activePaths: ['/sales', '/sales-orders', '/sales-quotes', '/quotes'],
        sections: [
            {
                title: 'Transacciones',
                actions: [
                    {
                        title: 'Órdenes de venta',
                        href: '/sales-orders',
                        description: 'Consultar ventas, pagos y rentabilidad.',
                        icon: ClipboardList,
                        roles: roles.sales,
                    },
                    {
                        title: 'Nueva orden',
                        href: '/sales-orders/create',
                        description: 'Crear una orden de venta manual.',
                        icon: Plus,
                        roles: roles.sales,
                    },
                ],
            },
            {
                title: 'Cotizaciones',
                actions: [
                    {
                        title: 'Cotizaciones',
                        href: '/sales-quotes',
                        description:
                            'Consultar y dar seguimiento a cotizaciones.',
                        icon: FileText,
                        roles: roles.sales,
                    },
                    {
                        title: 'Nueva cotización',
                        href: '/sales-quotes/create',
                        description:
                            'Preparar una nueva propuesta para un cliente.',
                        icon: Plus,
                        roles: roles.sales,
                    },
                ],
            },
        ],
    },
    {
        id: 'purchases',
        title: 'Compras',
        description: 'Abastecimiento, órdenes, recepción y proveedores.',
        href: '/purchases',
        icon: ClipboardList,
        activePaths: [
            '/purchases',
            '/supply-list',
            '/purchase-orders',
            '/suppliers',
        ],
        sections: [
            {
                title: 'Abastecimiento',
                actions: [
                    {
                        title: 'Lista de abastecimiento',
                        href: '/supply-list',
                        description:
                            'Revisar necesidades y sugerencias de compra.',
                        icon: ClipboardList,
                        roles: roles.purchasing,
                    },
                    {
                        title: 'Órdenes de compra',
                        href: '/purchase-orders',
                        description:
                            'Consultar pedidos, recepciones y estados.',
                        icon: Package,
                        roles: roles.purchasing,
                    },
                    {
                        title: 'Nueva orden de compra',
                        href: '/purchase-orders/create',
                        description: 'Crear una orden para un proveedor.',
                        icon: PackagePlus,
                        roles: roles.purchasing,
                    },
                    {
                        title: 'Reposición inteligente',
                        href: '/purchase-orders/smart-reorder',
                        description: 'Generar sugerencias según existencias.',
                        icon: RefreshCw,
                        roles: roles.purchasing,
                    },
                ],
            },
            {
                title: 'Proveedores',
                actions: [
                    {
                        title: 'Proveedores',
                        href: '/suppliers',
                        description: 'Consultar y administrar proveedores.',
                        icon: Factory,
                        roles: roles.purchasing,
                    },
                    {
                        title: 'Importar proveedores',
                        href: '/suppliers/import',
                        description: 'Cargar proveedores desde un archivo.',
                        icon: PackagePlus,
                        roles: roles.adminManager,
                    },
                ],
            },
        ],
    },
    {
        id: 'inventory',
        title: 'Inventario',
        description: 'Productos, existencias, movimientos y catálogos.',
        href: '/inventory/overview',
        icon: Warehouse,
        activePaths: [
            '/inventory/overview',
            '/inventory',
            '/products',
            '/inventory-movements',
            '/inventory-transfers',
            '/returns',
            '/brands',
            '/categories',
            '/warehouses',
        ],
        sections: [
            {
                title: 'Productos y existencias',
                actions: [
                    {
                        title: 'Existencias',
                        href: '/inventory',
                        description:
                            'Consultar stock, lotes y valor disponible.',
                        icon: Boxes,
                        roles: roles.inventory,
                    },
                    {
                        title: 'Productos',
                        href: '/products',
                        description:
                            'Buscar y administrar el catálogo de artículos.',
                        icon: Package,
                    },
                    {
                        title: 'Nuevo producto',
                        href: '/products/create',
                        description: 'Registrar un artículo en el catálogo.',
                        icon: Plus,
                        roles: roles.purchasing,
                    },
                    {
                        title: 'Importar productos',
                        href: '/products/import',
                        description: 'Cargar artículos desde un archivo.',
                        icon: PackagePlus,
                        roles: roles.adminManager,
                    },
                ],
            },
            {
                title: 'Operaciones',
                actions: [
                    {
                        title: 'Movimientos',
                        href: '/inventory-movements',
                        description:
                            'Consultar entradas, salidas y trazabilidad.',
                        icon: History,
                    },
                    {
                        title: 'Registrar entrada',
                        href: '/inventory-movements/inbound/create',
                        description: 'Ingresar existencias manualmente.',
                        icon: PackagePlus,
                        roles: roles.inventory,
                    },
                    {
                        title: 'Transferencias',
                        href: '/inventory-transfers',
                        description: 'Consultar movimientos entre bodegas.',
                        icon: Truck,
                    },
                    {
                        title: 'Mermas',
                        href: '/inventory/waste',
                        description: 'Registrar pérdidas o productos dañados.',
                        icon: RotateCcw,
                        roles: roles.inventory,
                    },
                    {
                        title: 'Devoluciones',
                        href: '/returns',
                        description:
                            'Consultar devoluciones y notas asociadas.',
                        icon: RefreshCw,
                    },
                ],
            },
            {
                title: 'Catálogos y bodegas',
                actions: [
                    {
                        title: 'Categorías',
                        href: '/categories',
                        description: 'Organizar productos por categoría.',
                        icon: Folder,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Marcas',
                        href: '/brands',
                        description: 'Administrar las marcas del catálogo.',
                        icon: Tag,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Bodegas',
                        href: '/warehouses',
                        description: 'Consultar y administrar ubicaciones.',
                        icon: Warehouse,
                    },
                ],
            },
        ],
    },
    {
        id: 'vehicles',
        title: 'Vehículos',
        description: 'Catálogo automotriz, motores e importación.',
        href: '/vehicles/overview',
        icon: Car,
        activePaths: ['/vehicles/overview', '/vehicles'],
        sections: [
            {
                title: 'Catálogo automotriz',
                actions: [
                    {
                        title: 'Vehículos',
                        href: '/vehicles',
                        description: 'Consultar marcas, modelos y chasis.',
                        icon: Car,
                    },
                    {
                        title: 'Motores',
                        href: '/vehicles/engines',
                        description: 'Administrar motores y especificaciones.',
                        icon: Wrench,
                    },
                    {
                        title: 'Importar vehículos',
                        href: '/vehicles/import',
                        description:
                            'Cargar información automotriz desde archivo.',
                        icon: PackagePlus,
                        roles: roles.adminManager,
                    },
                ],
            },
        ],
    },
    {
        id: 'customers',
        title: 'Clientes',
        description: 'Clientes y órdenes de trabajo habilitadas.',
        href: '/customers/overview',
        icon: Users,
        activePaths: ['/customers/overview', '/customers', '/work-orders'],
        sections: [
            {
                title: 'Gestión de clientes',
                actions: [
                    {
                        title: 'Clientes',
                        href: '/customers',
                        description:
                            'Consultar perfiles, contactos e historial.',
                        icon: Users,
                    },
                    {
                        title: 'Nuevo cliente',
                        href: '/customers/create',
                        description: 'Registrar un nuevo cliente.',
                        icon: UserRound,
                    },
                ],
            },
            {
                title: 'Servicio',
                actions: [
                    {
                        title: 'Órdenes de trabajo',
                        href: '/work-orders',
                        description:
                            'Consultar y administrar trabajos del taller.',
                        icon: Wrench,
                        feature: 'workOrders',
                    },
                    {
                        title: 'Nueva orden de trabajo',
                        href: '/work-orders/create',
                        description: 'Abrir un nuevo trabajo para un cliente.',
                        icon: Plus,
                        feature: 'workOrders',
                    },
                ],
            },
        ],
    },
    {
        id: 'finance',
        title: 'Finanzas',
        description: 'Rentabilidad, crédito, obligaciones y gastos.',
        href: '/finance',
        icon: Landmark,
        activePaths: [
            '/finance',
            '/reports/financial',
            '/ar',
            '/accounts-receivable',
            '/accounts-payable',
            '/operational-expenses',
            '/operational-expense-beneficiaries',
        ],
        sections: [
            {
                title: 'Análisis',
                actions: [
                    {
                        title: 'Finanzas y rentabilidad',
                        href: '/reports/financial',
                        description:
                            'Resumen, resultados, balance y análisis diario.',
                        icon: BarChart3,
                        roles: roles.adminManager,
                    },
                ],
            },
            {
                title: 'Crédito y obligaciones',
                actions: [
                    {
                        title: 'Cuentas por cobrar',
                        href: '/ar',
                        description: 'Créditos, abonos y saldos de clientes.',
                        icon: Banknote,
                    },
                    {
                        title: 'Cuentas por pagar',
                        href: '/accounts-payable',
                        description: 'Obligaciones y pagos a proveedores.',
                        icon: Receipt,
                        roles: roles.purchasing,
                    },
                ],
            },
            {
                title: 'Gastos',
                actions: [
                    {
                        title: 'Gastos operativos',
                        href: '/operational-expenses',
                        description:
                            'Consultar gastos, categorías y beneficiarios.',
                        icon: Receipt,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Registrar gasto',
                        href: '/operational-expenses?new=1',
                        description: 'Crear un nuevo gasto operativo.',
                        icon: Plus,
                        roles: roles.adminManager,
                    },
                ],
            },
        ],
    },
    {
        id: 'records',
        title: 'Registros',
        description: 'Acceso trazable a movimientos y documentos del sistema.',
        href: '/records',
        icon: ClipboardList,
        activePaths: ['/records'],
        sections: [
            {
                title: 'Ventas',
                actions: [
                    {
                        title: 'Órdenes de venta',
                        href: '/sales-orders',
                        description:
                            'Facturas, pagos, artículos y rentabilidad.',
                        icon: ClipboardList,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Cotizaciones',
                        href: '/sales-quotes',
                        description: 'Cotizaciones y envíos a Caja.',
                        icon: FileText,
                        roles: roles.adminManager,
                    },
                ],
            },
            {
                title: 'Caja',
                actions: [
                    {
                        title: 'Cola de caja',
                        href: '/pos/cashier',
                        description:
                            'Ventas, gastos y devoluciones pendientes.',
                        icon: Inbox,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Sesiones y cierres',
                        href: '/pos-sessions',
                        description:
                            'Aperturas, cierres y movimientos de efectivo.',
                        icon: Receipt,
                        roles: roles.adminManager,
                    },
                ],
            },
            {
                title: 'Inventario y compras',
                actions: [
                    {
                        title: 'Movimientos de inventario',
                        href: '/inventory-movements',
                        description: 'Historial operativo por artículo.',
                        icon: History,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Órdenes de compra',
                        href: '/purchase-orders',
                        description: 'Pedidos, recepciones y pagos.',
                        icon: Package,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Transferencias',
                        href: '/inventory-transfers',
                        description: 'Movimientos entre bodegas.',
                        icon: Truck,
                        roles: roles.adminManager,
                    },
                ],
            },
            {
                title: 'Finanzas',
                actions: [
                    {
                        title: 'Gastos operativos',
                        href: '/operational-expenses',
                        description: 'Gastos, programación, eventos y pagos.',
                        icon: Receipt,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Devoluciones',
                        href: '/returns',
                        description:
                            'Notas de crédito y trazabilidad por artículo.',
                        icon: RotateCcw,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Finanzas y rentabilidad',
                        href: '/reports/financial',
                        description: 'Reportes y detalles financieros.',
                        icon: Landmark,
                        roles: roles.adminManager,
                    },
                ],
            },
        ],
    },
    {
        id: 'reports',
        title: 'Reportes',
        description: 'Informes operativos agrupados por área.',
        href: '/reports',
        icon: BarChart3,
        activePaths: ['/reports'],
        sections: [
            {
                title: 'Ventas',
                actions: [
                    {
                        title: 'Ventas por cliente',
                        href: '/reports/sales-by-client',
                        description:
                            'Totales y documentos agrupados por cliente.',
                        icon: Users,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Ventas por producto',
                        href: '/reports/sales-by-product',
                        description: 'Unidades, costo y utilidad por artículo.',
                        icon: Package,
                        roles: roles.adminManager,
                    },
                ],
            },
            {
                title: 'Inventario',
                actions: [
                    {
                        title: 'Niveles de stock',
                        href: '/reports/stock-levels',
                        description: 'Existencias y disponibilidad por bodega.',
                        icon: Boxes,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Historial de movimientos',
                        href: '/reports/movement-history',
                        description:
                            'Entradas, salidas, ajustes y transferencias.',
                        icon: History,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Inventario valorizado',
                        href: '/reports/valued-inventory',
                        description:
                            'Existencia y valor de lotes FIFO disponibles.',
                        icon: Banknote,
                        roles: roles.adminManager,
                    },
                ],
            },
            {
                title: 'Compras, clientes y auditoría',
                actions: [
                    {
                        title: 'Compras por proveedor',
                        href: '/reports/purchases-by-supplier',
                        description:
                            'Compras recibidas y saldos por proveedor.',
                        icon: Factory,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Notas de crédito',
                        href: '/reports/credit-notes',
                        description: 'Notas emitidas y resolución financiera.',
                        icon: Receipt,
                        roles: roles.adminManager,
                    },
                    {
                        title: 'Referencias de clientes',
                        href: '/reports/customer-references',
                        description: 'Referencias comerciales registradas.',
                        icon: UserRound,
                        roles: roles.adminManager,
                    },
                ],
            },
        ],
    },
    {
        id: 'settings',
        title: 'Configuración',
        description: 'Usuarios, tienda, respaldos y reglas del sistema.',
        href: '/settings/overview',
        icon: Settings,
        activePaths: ['/settings/overview', '/settings', '/users'],
        sections: [
            {
                title: 'Administración',
                actions: [
                    {
                        title: 'Usuarios',
                        href: '/users',
                        description: 'Administrar usuarios, roles y bodegas.',
                        icon: Users,
                        roles: ['admin'],
                    },
                    {
                        title: 'Configuración de tienda',
                        href: '/settings/store',
                        description:
                            'Identidad, operación y preferencias regionales.',
                        icon: Store,
                        roles: ['admin'],
                    },
                    {
                        title: 'Respaldos',
                        href: '/settings/backups',
                        description: 'Crear y consultar respaldos del sistema.',
                        icon: Boxes,
                        roles: ['admin'],
                    },
                    {
                        title: 'Bitácora',
                        href: '/settings/activity-logs',
                        description:
                            'Revisar actividad administrativa y accesos.',
                        icon: History,
                        roles: ['admin'],
                    },
                ],
            },
            {
                title: 'Reglas comerciales',
                actions: [
                    {
                        title: 'Fórmulas de precio',
                        href: '/settings/pricing-formulas',
                        description:
                            'Configurar fórmulas y redondeo de precios.',
                        icon: Settings,
                    },
                ],
            },
        ],
    },
];

export const normalizeNavigationPath = (value: string): string => {
    let path = value.trim();

    if (/^https?:\/\//i.test(path)) {
        path = new URL(path).pathname;
    } else {
        path = path.split(/[?#]/, 1)[0] ?? '/';
    }

    if (!path.startsWith('/')) {
        path = `/${path}`;
    }

    return path.length > 1 ? path.replace(/\/+$/, '') : path;
};

export const pathMatchesModulePattern = (
    currentPath: string,
    pattern: string,
): boolean => {
    const path = normalizeNavigationPath(currentPath);
    const normalizedPattern = normalizeNavigationPath(pattern);

    return (
        path === normalizedPattern || path.startsWith(`${normalizedPattern}/`)
    );
};

export const findModuleForPath = (
    currentPath: string,
): ModuleDefinition | undefined =>
    moduleDefinitions.find((module) =>
        module.activePaths.some((pattern) =>
            pathMatchesModulePattern(currentPath, pattern),
        ),
    );

const roleAllowsAction = (
    action: ModuleActionDefinition,
    role: string | null,
): boolean =>
    !action.roles || (role !== null && action.roles.includes(role as AppRole));

const featureAllowsAction = (
    action: ModuleActionDefinition,
    features: NavigationFeatures,
): boolean => action.feature !== 'workOrders' || features.workOrdersEnabled;

export const getVisibleModules = (
    role: string | null,
    features: NavigationFeatures,
): ModuleDefinition[] => {
    if (role === null) return [];

    return moduleDefinitions
        .map((module) => ({
            ...module,
            sections: module.sections
                .map((section) => ({
                    ...section,
                    actions: section.actions.filter(
                        (action) =>
                            roleAllowsAction(action, role) &&
                            featureAllowsAction(action, features),
                    ),
                }))
                .filter((section) => section.actions.length > 0),
        }))
        .filter((module) => module.sections.length > 0);
};

export const getVisibleModuleById = (
    moduleId: ModuleId,
    role: string | null,
    features: NavigationFeatures,
): ModuleDefinition | undefined =>
    getVisibleModules(role, features).find((module) => module.id === moduleId);

export const resolveModuleBreadcrumbs = (
    currentUrl: string,
    suppliedBreadcrumbs: BreadcrumbItem[],
): BreadcrumbItem[] => {
    const module = findModuleForPath(currentUrl);
    if (!module) return suppliedBreadcrumbs;

    const moduleBreadcrumb: BreadcrumbItem = {
        title: module.title,
        href: module.href,
    };
    const supplied = suppliedBreadcrumbs.filter((item) => {
        if (
            item.title.toLocaleLowerCase() === module.title.toLocaleLowerCase()
        ) {
            return false;
        }

        if (item.href && normalizeNavigationPath(item.href) === '/dashboard') {
            return false;
        }

        return !(
            item.href &&
            normalizeNavigationPath(item.href) ===
                normalizeNavigationPath(module.href)
        );
    });

    if (supplied.length > 0) {
        return [moduleBreadcrumb, ...supplied];
    }

    const currentPath = normalizeNavigationPath(currentUrl);
    const matchingAction = module.sections
        .flatMap((section) => section.actions)
        .filter((action) => pathMatchesModulePattern(currentPath, action.href))
        .sort(
            (left, right) =>
                normalizeNavigationPath(right.href).length -
                normalizeNavigationPath(left.href).length,
        )[0];

    if (
        matchingAction &&
        normalizeNavigationPath(matchingAction.href) !==
            normalizeNavigationPath(module.href)
    ) {
        const breadcrumbs: BreadcrumbItem[] = [
            moduleBreadcrumb,
            { title: matchingAction.title, href: matchingAction.href },
        ];
        const actionPath = normalizeNavigationPath(matchingAction.href);

        if (currentPath !== actionPath) {
            const segments = currentPath.split('/').filter(Boolean);
            const lastSegment = segments.at(-1);
            const terminalTitle =
                lastSegment === 'edit'
                    ? 'Editar'
                    : lastSegment === 'receive'
                      ? 'Recepción'
                      : lastSegment === 'create'
                        ? 'Crear'
                        : lastSegment && /^\d+$/.test(lastSegment)
                          ? 'Detalle'
                          : null;

            if (terminalTitle) {
                breadcrumbs.push({ title: terminalTitle });
            }
        }

        return breadcrumbs;
    }

    return [moduleBreadcrumb];
};
