import { describe, expect, it } from 'vitest';
import { canManageCatalog } from './catalogPermissions';

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
});
