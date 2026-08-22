export function canManageCatalog(role: unknown): boolean {
    return role === 'admin' || role === 'manager';
}
