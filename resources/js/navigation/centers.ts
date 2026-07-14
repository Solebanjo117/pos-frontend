export interface NavigationCenterItem {
    title: string;
    href: string;
    description: string;
}

export interface NavigationCenterGroup {
    title: string;
    items: NavigationCenterItem[];
}

export const reportCenterGroups: NavigationCenterGroup[] = [
    {
        title: 'Ventas',
        items: [
            { title: 'Ventas por cliente', href: '/reports/sales-by-client', description: 'Totales y documentos agrupados por cliente.' },
            { title: 'Ventas por producto', href: '/reports/sales-by-product', description: 'Unidades, costo y utilidad por articulo.' },
        ],
    },
    {
        title: 'Caja y pagos',
        items: [
            { title: 'Cierre Z', href: '/reports/z-report', description: 'Movimientos y cierre diario de Caja.' },
            { title: 'Cuentas por cobrar', href: '/ar', description: 'Créditos y cobros pendientes de clientes.' },
            { title: 'Cuentas por pagar', href: '/accounts-payable', description: 'Créditos y pagos pendientes a proveedores.' },
        ],
    },
    {
        title: 'Inventario',
        items: [
            { title: 'Niveles de stock', href: '/reports/stock-levels', description: 'Existencias y disponibilidad por almacén.' },
            { title: 'Historial de movimientos', href: '/reports/movement-history', description: 'Entradas, salidas, ajustes y transferencias.' },
            { title: 'Inventario valorizado', href: '/reports/valued-inventory', description: 'Existencia y valor de lotes FIFO disponibles.' },
        ],
    },
    {
        title: 'Clientes',
        items: [
            { title: 'Referencias', href: '/reports/customer-references', description: 'Referencias comerciales registradas.' },
        ],
    },
    {
        title: 'Finanzas y contabilidad',
        items: [
            { title: 'Finanzas y rentabilidad', href: '/reports/financial', description: 'Resumen diario, resultados, créditos y contabilidad ligera.' },
            { title: 'Compras por proveedor', href: '/reports/purchases-by-supplier', description: 'Compras recibidas, pagos y saldo por proveedor.' },
            { title: 'Notas de crédito', href: '/reports/credit-notes', description: 'Notas emitidas y resolución financiera.' },
            { title: 'Gastos por categoría y persona', href: '/operational-expenses', description: 'Movimientos, beneficiarios y categorías de gasto.' },
            { title: 'Devoluciones y notas de crédito', href: '/returns', description: 'Devoluciones, inventario y resolución financiera.' },
        ],
    },
];

export const recordCenterGroups: NavigationCenterGroup[] = [
    {
        title: 'Ventas',
        items: [
            { title: 'Órdenes de venta', href: '/sales-orders', description: 'Facturas, pagos, artículos y rentabilidad.' },
            { title: 'Cotizaciones', href: '/sales-quotes', description: 'Cotizaciones y envíos a Caja.' },
        ],
    },
    {
        title: 'Caja',
        items: [
            { title: 'Cola de Caja', href: '/pos/cashier', description: 'Ventas, gastos y devoluciones pendientes.' },
            { title: 'Sesiones y cierres', href: '/pos-sessions', description: 'Aperturas, cierres y movimientos de efectivo.' },
        ],
    },
    {
        title: 'Inventario y compras',
        items: [
            { title: 'Movimientos de inventario', href: '/inventory-movements', description: 'Historial operativo por artículo.' },
            { title: 'Órdenes de compra', href: '/purchase-orders', description: 'Pedidos, recepciones y pagos.' },
            { title: 'Transferencias', href: '/inventory-transfers', description: 'Movimientos entre almacenes.' },
        ],
    },
    {
        title: 'Finanzas',
        items: [
            { title: 'Gastos operativos', href: '/operational-expenses', description: 'Gastos, programación, eventos y pagos.' },
            { title: 'Devoluciones', href: '/returns', description: 'Notas de crédito y trazabilidad por artículo.' },
            { title: 'Finanzas y rentabilidad', href: '/reports/financial', description: 'Reportes y drilldowns financieros.' },
        ],
    },
];
