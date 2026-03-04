import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

// ------------------------------------------------------------------
// useAuth — reads the authenticated user from Inertia shared props.
// This is synchronous (no API call needed) and always up-to-date
// because Inertia re-shares props on every navigation.
// ------------------------------------------------------------------

export function useAuth() {
    const page = usePage()

    // Inertia shares auth.user via HandleInertiaRequests.php
    const currentUser = computed(() => (page.props.auth?.user as unknown as {
        id: number
        name: string
        email: string
        role: string
        is_active: boolean
    } | null) ?? null)

    const role = computed(() => currentUser.value?.role ?? null)

    const hasRole = (roles: string | string[]): boolean => {
        if (!currentUser.value) return false
        const list = Array.isArray(roles) ? roles : [roles]
        return list.includes(currentUser.value.role)
    }

    const isAdmin = computed(() => hasRole('admin'))
    const isManager = computed(() => hasRole(['admin', 'manager']))
    const isBuyer = computed(() => hasRole(['admin', 'manager', 'buyer']))
    const isSeller = computed(() => hasRole(['admin', 'manager', 'seller']))
    const isCashier = computed(() => hasRole(['admin', 'manager', 'seller', 'cashier']))

    const can = (permission: string): boolean => {
        const permissions: Record<string, string[]> = {
            'users.manage': ['admin'],
            'users.view': ['admin', 'manager'],
            'purchase-orders.create': ['admin', 'manager', 'buyer'],
            'reports.view': ['admin', 'manager'],
            'backups.manage': ['admin'],
            'settings.manage': ['admin'],
            'inventory.adjust': ['admin', 'manager', 'buyer'],
            'pos.use': ['admin', 'manager', 'seller', 'cashier'],
        }
        const allowed = permissions[permission] ?? []
        return allowed.length === 0 || hasRole(allowed)
    }

    // fetchCurrentUser kept as no-op for backwards compatibility
    const fetchCurrentUser = async () => { /* noop — data comes from Inertia props */ }

    return {
        currentUser,
        role,
        loading: computed(() => false),
        initialized: computed(() => true),
        fetchCurrentUser,
        hasRole,
        isAdmin,
        isManager,
        isBuyer,
        isSeller,
        isCashier,
        can,
    }
}
