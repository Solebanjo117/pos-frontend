import { describe, expect, it } from 'vitest';
import {
    canManageCatalog,
    canManagePurchasingRecords,
} from './catalogPermissions';

describe('catalog permissions', () => {
    it.each(['admin', 'manager'])('allows %s to manage catalogs', (role) => {
        expect(canManageCatalog(role)).toBe(true);
    });

    it.each(['buyer', 'seller', 'cashier', 'assistant', null, undefined])(
        'keeps bulk catalog actions hidden for %s',
        (role) => {
            expect(canManageCatalog(role)).toBe(false);
        },
    );

    it.each(['admin', 'manager', 'buyer'])(
        'allows %s to manage purchasing records',
        (role) => {
            expect(canManagePurchasingRecords(role)).toBe(true);
        },
    );

    it.each(['seller', 'cashier', 'assistant', null, undefined])(
        'keeps purchasing mutations hidden for %s',
        (role) => {
            expect(canManagePurchasingRecords(role)).toBe(false);
        },
    );
});
