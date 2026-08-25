export function canManageCatalog(role: unknown): boolean {
    return role === 'admin' || role === 'manager';
}

export function canManagePurchasingRecords(role: unknown): boolean {
    return canManageCatalog(role) || role === 'buyer';
}
