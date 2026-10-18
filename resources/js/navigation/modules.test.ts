import { describe, expect, it } from 'vitest';
import {
    findModuleForPath,
    getVisibleModuleById,
    getVisibleModules,
    normalizeNavigationPath,
    resolveModuleBreadcrumbs,
} from '@/navigation/modules';

const features = { workOrdersEnabled: true };

describe('module route resolution', () => {
    it('normalizes query strings, fragments and absolute URLs', () => {
        expect(normalizeNavigationPath('/pos?cash_action=in')).toBe('/pos');
        expect(normalizeNavigationPath('/products/12/#history')).toBe(
            '/products/12',
        );
        expect(
            normalizeNavigationPath(
                'https://pos-frontend.test/reports/financial?from=2026-01-01',
            ),
        ).toBe('/reports/financial');
    });

    it.each([
        ['/pos?cash_action=in', 'cash'],
        ['/reports/z-report', 'cash'],
        ['/warehouses/queue', 'queues'],
        ['/reports/financial', 'finance'],
        ['/reports/sales-by-product', 'reports'],
        ['/products/42/edit', 'inventory'],
        ['/customers/42', 'customers'],
        ['/settings/pricing-formulas', 'settings'],
        ['/transactions?type=quote', 'sales'],
        ['/quotes/create', 'sales'],
    ])('assigns %s to %s', (path, moduleId) => {
        expect(findModuleForPath(path)?.id).toBe(moduleId);
    });
});

describe('role and feature filtering', () => {
    it('does not expose authenticated navigation to a missing user', () => {
        expect(getVisibleModules(null, features)).toEqual([]);
    });

    it('uses route middleware roles for buyer access', () => {
        const modules = getVisibleModules('buyer', features);
        expect(modules.map((module) => module.id)).toContain('sales');
        expect(modules.map((module) => module.id)).toContain('purchases');
        expect(modules.map((module) => module.id)).toContain('finance');

        const finance = modules.find((module) => module.id === 'finance');
        const financeActions = finance?.sections.flatMap(
            (section) => section.actions,
        );
        expect(financeActions?.map((action) => action.href)).toContain(
            '/accounts-payable',
        );
        expect(financeActions?.map((action) => action.href)).not.toContain(
            '/operational-expenses',
        );
    });

    it('hides work orders when the store module is disabled', () => {
        const customers = getVisibleModuleById('customers', 'admin', {
            workOrdersEnabled: false,
        });
        const actions = customers?.sections.flatMap(
            (section) => section.actions,
        );

        expect(
            actions?.some((action) => action.href.startsWith('/work-orders')),
        ).toBe(false);
        expect(actions?.some((action) => action.href === '/customers')).toBe(
            true,
        );
    });

    it('groups the cashier queue and request forms in cash operations', () => {
        const cash = getVisibleModuleById('cash', 'cashier', features);
        const actions = cash?.sections.flatMap((section) => section.actions);

        expect(actions?.map((action) => action.title)).toEqual(
            expect.arrayContaining(['Cola de caja', 'Agregar / Retirar']),
        );
        expect(actions?.map((action) => action.title)).not.toEqual(
            expect.arrayContaining(['Agregar efectivo', 'Retirar efectivo']),
        );
    });
});

describe('sales navigation', () => {
    it('keeps one history and an independent quote creation entry', () => {
        for (const role of ['admin', 'manager', 'seller'] as const) {
            const sales = getVisibleModuleById('sales', role, features);
            const actions = sales?.sections.flatMap(
                (section) => section.actions,
            );
            expect(actions?.map((action) => action.href)).toEqual([
                '/transactions',
                '/quotes/create',
            ]);
            expect(actions?.map((action) => action.title)).toEqual([
                'Transacciones',
                'Nueva cotización',
            ]);
        }
    });

    it.each(['buyer', 'assistant'])(
        'keeps %s limited to the transaction history',
        (role) => {
            const sales = getVisibleModuleById('sales', role, features);
            expect(
                sales?.sections.flatMap((section) =>
                    section.actions.map((action) => action.href),
                ),
            ).toEqual(['/transactions']);
        },
    );

    it('does not expose sales creation to cashiers or unauthenticated users', () => {
        for (const role of ['cashier', null]) {
            expect(
                getVisibleModuleById('sales', role, features),
            ).toBeUndefined();
        }
    });

    it('keeps supplier purchase creation in Purchases', () => {
        const purchases = getVisibleModuleById('purchases', 'buyer', features);
        expect(
            purchases?.sections.flatMap((section) =>
                section.actions.map((action) => action.href),
            ),
        ).toContain('/purchase-orders/create');
    });
});
describe('module breadcrumbs', () => {
    it('prepends the module hub and preserves supplied detail context', () => {
        expect(
            resolveModuleBreadcrumbs('/products/42/edit', [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Editar producto' },
            ]),
        ).toEqual([
            { title: 'Inventario', href: '/inventory/overview' },
            { title: 'Editar producto' },
        ]);
    });

    it('derives a child breadcrumb when a page does not provide one', () => {
        expect(resolveModuleBreadcrumbs('/sales-orders/42', [])).toEqual([
            { title: 'Ventas', href: '/sales' },
            { title: 'Transacciones', href: '/transactions' },
            { title: 'Detalle' },
        ]);
    });

    it('derives edit context for nested operational routes', () => {
        expect(resolveModuleBreadcrumbs('/products/42/edit', [])).toEqual([
            { title: 'Inventario', href: '/inventory/overview' },
            { title: 'Productos', href: '/products' },
            { title: 'Editar' },
        ]);
    });

    it('keeps the hub breadcrumb singular on a hub page', () => {
        expect(
            resolveModuleBreadcrumbs('/finance', [
                { title: 'Finanzas', href: '/finance' },
            ]),
        ).toEqual([{ title: 'Finanzas', href: '/finance' }]);
    });
});
