import { ref, computed, onMounted, watch } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { salesOrdersService } from '@/services/sales-orders'
import { usePosSettings } from './usePosSettings'
import { useStoreSettings } from './useStoreSettings'
import type { Product } from '@/types/product'
import type { CreateSalesOrderData } from '@/types/sales-order'

interface CartItem {
    id: string // temporal ID for cart
    product_id: number
    variant_id?: number  // Track which variant/brand was added
    variant_brand?: string  // Brand name for display in cart
    product_name: string
    product_sku: string
    product_price: number
    quantity: number
    available_stock?: number
    discount_percent: number
    tax_percent: number
    default_tax_percent: number // original tax so we can restore it
    is_tax_overridden: boolean  // Phase 1: tracks if vendor manually changed ITBM
    seller_id?: number
    warehouse_id?: number
    notes?: string // Phase 2: per-line internal notes
    subtotal: number
    tax_amount: number
    total: number
}

// ============================================
// MULTI-CART SESSION TYPES
// ============================================
interface PosCartSession {
    id: string
    name: string
    cart: CartItem[]
    customer_id?: number
    notes: string
    source_quote_id?: number   // set when session was loaded from a SalesQuote
    sessionLogs: { action: string; metadata: Record<string, any>; timestamp: string }[]
    createdAt: string
}

// ============================================
// MODULE-LEVEL STATE — shared across all usePOS() calls
// Persists across Inertia navigations (SPA)
// ============================================

function getUserId(): number {
    try {
        const page = (window as any).__page || {}
        return page?.props?.auth?.user?.id || 0
    } catch { return 0 }
}

function sessionsKey(): string {
    return `pos_sessions_user_${getUserId()}`
}

function activeSessionKey(): string {
    return `pos_active_session_user_${getUserId()}`
}

function generateSessionId(): string {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function createEmptySession(name?: string): PosCartSession {
    return {
        id: generateSessionId(),
        name: name || 'Venta 1',
        cart: [],
        customer_id: undefined,
        notes: '',
        sessionLogs: [],
        createdAt: new Date().toISOString(),
    }
}

function loadSessionsFromStorage(): PosCartSession[] {
    try {
        const stored = localStorage.getItem(sessionsKey())
        const parsed = stored ? JSON.parse(stored) : null
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch { }
    // Default: one empty session
    return [createEmptySession()]
}

function loadActiveSessionId(): string {
    try {
        return localStorage.getItem(activeSessionKey()) || ''
    } catch { return '' }
}

function persistSessions(sessions: PosCartSession[], activeId: string) {
    try {
        localStorage.setItem(sessionsKey(), JSON.stringify(sessions))
        localStorage.setItem(activeSessionKey(), activeId)
    } catch { }
}

// --- Legacy migration: convert old single-cart localStorage to new format ---
function migrateLegacyCart(): PosCartSession[] | null {
    try {
        const oldCart = localStorage.getItem('pos_cart')
        if (!oldCart) return null
        const cartItems = JSON.parse(oldCart)
        if (!Array.isArray(cartItems) || cartItems.length === 0) return null

        const oldCustomer = localStorage.getItem('pos_customer_id')
        const oldNotes = localStorage.getItem('pos_notes')

        const session = createEmptySession()
        session.cart = cartItems
        session.customer_id = oldCustomer ? Number(oldCustomer) : undefined
        session.notes = oldNotes || ''

        // Cleanup legacy keys
        localStorage.removeItem('pos_cart')
        localStorage.removeItem('pos_customer_id')
        localStorage.removeItem('pos_notes')
        localStorage.removeItem('pos_shipping')

        return [session]
    } catch { return null }
}

// ============================================
// SHARED REACTIVE STATE
// ============================================

// Try migrate legacy first
const migratedSessions = migrateLegacyCart()
const allSessions = ref<PosCartSession[]>(migratedSessions || loadSessionsFromStorage())

// Make sure we have at least one session
if (allSessions.value.length === 0) {
    allSessions.value = [createEmptySession()]
}

const activeSessionId = ref<string>(
    loadActiveSessionId() || allSessions.value[0].id
)

// Ensure active ID points to a real session
if (!allSessions.value.find(s => s.id === activeSessionId.value)) {
    activeSessionId.value = allSessions.value[0].id
}

// Derived reactive refs that point to the active session's data
const activeSession = computed(() => {
    return allSessions.value.find(s => s.id === activeSessionId.value) || allSessions.value[0]
})

const cart = computed({
    get: () => activeSession.value.cart,
    set: (val) => { activeSession.value.cart = val },
})

const customer_id = computed({
    get: () => activeSession.value.customer_id,
    set: (val) => { activeSession.value.customer_id = val },
})

const notes = computed({
    get: () => activeSession.value.notes,
    set: (val) => { activeSession.value.notes = val },
})

const sessionLogs = computed({
    get: () => activeSession.value.sessionLogs,
    set: (val) => { activeSession.value.sessionLogs = val },
})

// Non-session state (these reset per checkout, not per tab)
const paymentMethod = ref<'cash' | 'card' | 'transfer' | 'multiple'>('cash')
const amountReceived = ref(0)
const shippingCost = ref(0)
const shippingMethod = ref<'pickup' | 'delivery'>('pickup')
const loading = ref(false)
const error = ref<string | null>(null)
const connectionStatus = ref<'online' | 'offline' | 'error'>('online')

// Persist to localStorage on ANY change to sessions
watch(allSessions, () => {
    persistSessions(allSessions.value, activeSessionId.value)
}, { deep: true })

watch(activeSessionId, (val) => {
    persistSessions(allSessions.value, val)
})

// ============================================
// COMPOSABLE FUNCTION
// ============================================
export function usePOS() {
    // Get authenticated user from Inertia
    const page = usePage()

    // POS settings
    const { fetchSettings, isSingleWarehouseMode, getDefaultWarehouse, getDefaultWarehouseId, currentWarehouseId } = usePosSettings()
    const { settings: storeSettings, fetchSettings: fetchStoreSettings } = useStoreSettings()

    // ====== Audit Logging ======
    const logAction = (action: string, metadata: Record<string, any> = {}) => {
        activeSession.value.sessionLogs.push({ action, metadata, timestamp: new Date().toISOString() })
    }

    // Load settings on initialization
    onMounted(async () => {
        try {
            await Promise.all([fetchSettings(), fetchStoreSettings()])
        } catch (err) {
            console.error('Error loading POS settings:', err)
        }
    })

    // Recalculate item totals
    const recalculateItem = (item: CartItem) => {
        const baseAmount = item.quantity * item.product_price
        const discountAmount = baseAmount * (item.discount_percent / 100)
        item.subtotal = baseAmount - discountAmount
        item.tax_amount = item.subtotal * (item.tax_percent / 100)
        item.total = item.subtotal + item.tax_amount
    }

    // Add product to cart (always requires an explicit variant)
    const addToCart = (product: Product, variant: any, quantity: number = 1, warehouse_id?: number) => {
        // Auto-assign default warehouse if in single warehouse mode
        if (isSingleWarehouseMode() && !warehouse_id) {
            warehouse_id = getDefaultWarehouseId() ?? undefined
        }

        const existingItem = cart.value.find(
            item => item.product_id === product.id && item.variant_id === variant?.id && item.warehouse_id === warehouse_id
        )

        if (existingItem) {
            existingItem.quantity += quantity
            recalculateItem(existingItem)
        } else {
            // Resolve price: variant pricing first, then product pricing, then 0
            const variantPricing = variant?.pricing
            const productPricing = product.pricing
            const resolvedPrice = variantPricing?.calculated_price ?? variantPricing?.base_price
                ?? productPricing?.calculated_price ?? productPricing?.base_price ?? 0
            const resolvedTaxRate = variantPricing?.tax_rate ?? productPricing?.tax_rate ?? (storeSettings.value.store_tax_rate ?? 7)

            const newItem: CartItem = {
                id: `${product.id}-${variant?.id ?? 'nv'}-${Date.now()}`,
                product_id: product.id,
                variant_id: variant?.id,
                variant_brand: variant?.brand?.name ?? undefined,
                product_name: product.name,
                product_sku: variant?.sku || (product as any).sku_base || '',
                product_price: resolvedPrice,
                quantity,
                available_stock: variant?.total_stock ?? product.total_stock ?? undefined,
                discount_percent: 0,
                tax_percent: resolvedTaxRate,
                default_tax_percent: resolvedTaxRate,
                is_tax_overridden: false,
                seller_id: (page.props.auth?.user as any)?.id,
                warehouse_id,
                notes: undefined,
                subtotal: 0,
                tax_amount: 0,
                total: 0,
            }
            recalculateItem(newItem)
            cart.value.push(newItem)
        }
        logAction('cart_add', { product_id: product.id, variant_id: variant?.id, quantity, name: product.name })
    }

    // Update item quantity
    const updateQuantity = (itemId: string, quantity: number) => {
        const item = cart.value.find(i => i.id === itemId)
        if (item && quantity > 0) {
            const oldQty = item.quantity
            item.quantity = quantity
            recalculateItem(item)
            logAction('qty_change', { product_id: item.product_id, old_qty: oldQty, new_qty: quantity })
        }
    }

    // Update item discount
    const updateDiscount = (itemId: string, discountPercent: number) => {
        const item = cart.value.find(i => i.id === itemId)
        if (item) {
            item.discount_percent = Math.max(0, Math.min(100, discountPercent))
            recalculateItem(item)
        }
    }

    // Remove item from cart
    const removeItem = (itemId: string) => {
        const removed = cart.value.find(i => i.id === itemId)
        if (removed) {
            logAction('cart_remove', { product_id: removed.product_id, variant_id: removed.variant_id, name: removed.product_name })
        }
        activeSession.value.cart = cart.value.filter(i => i.id !== itemId)
    }

    // Update item tax percent (manual override by vendor)
    const updateItemTax = (itemId: string, taxPercent: number) => {
        const item = cart.value.find(i => i.id === itemId)
        if (item) {
            const oldTax = item.tax_percent
            // Phase 1: Cap at 15% to prevent accidental misconfig
            const safeTax = isNaN(taxPercent) ? 0 : Math.max(0, Math.min(15, taxPercent))
            item.tax_percent = safeTax
            item.is_tax_overridden = true
            // Keep default in sync so restore works after manual edits
            if (safeTax > 0) {
                item.default_tax_percent = safeTax
            }
            recalculateItem(item)
            logAction('tax_override', { product_id: item.product_id, old_tax: oldTax, new_tax: safeTax })
        }
    }

    // Phase 1: Update item price manually (vendor override)
    const updateItemPrice = (itemId: string, newPrice: number) => {
        const item = cart.value.find(i => i.id === itemId)
        if (item) {
            const oldPrice = item.product_price
            item.product_price = Math.max(0, newPrice)
            // Auto-reset: deactivate tax override when price is manually changed
            if (item.is_tax_overridden) {
                item.tax_percent = item.default_tax_percent || (storeSettings.value.store_tax_rate ?? 7)
                item.is_tax_overridden = false
            }
            recalculateItem(item)
            logAction('price_override', { product_id: item.product_id, old_price: oldPrice, new_price: newPrice })
        }
    }

    // Toggle item tax exempt
    const toggleItemTaxExempt = (itemId: string) => {
        const item = cart.value.find(i => i.id === itemId)
        if (item) {
            if (item.tax_percent > 0) {
                // Save current rate before zeroing so we can restore it
                item.default_tax_percent = item.tax_percent
                item.tax_percent = 0
            } else {
                // Restore: fallback to 7 if default was never set (legacy localStorage items)
                item.tax_percent = item.default_tax_percent || (storeSettings.value.store_tax_rate ?? 7)
            }
            recalculateItem(item)
        }
    }

    // Update item seller
    const updateItemSeller = (itemId: string, sellerId: number | undefined) => {
        const item = cart.value.find(i => i.id === itemId)
        if (item) {
            item.seller_id = sellerId
        }
    }

    // Update item notes (Phase 2: per-line internal notes)
    const updateItemNotes = (itemId: string, noteText: string) => {
        const item = cart.value.find(i => i.id === itemId)
        if (item) {
            item.notes = noteText || undefined
            logAction('item_note', { product_id: item.product_id, has_note: !!noteText })
        }
    }

    // Reorder cart items (e.g. from Drag and Drop)
    const reorderCart = (newCartArray: CartItem[]) => {
        activeSession.value.cart = [...newCartArray]
    }

    // Clear entire cart (clears the ACTIVE session only)
    const clearCart = () => {
        if (cart.value.length > 0) {
            if (confirm('¿Limpiar todo el carrito?')) {
                activeSession.value.cart = []
                activeSession.value.customer_id = undefined
                activeSession.value.notes = ''
                paymentMethod.value = 'cash'
                amountReceived.value = 0
                shippingCost.value = 0
                shippingMethod.value = 'pickup'
            }
        }
    }

    // ============================================
    // MULTI-CART METHODS
    // ============================================

    /** Create a new empty cart tab and switch to it */
    const createNewCart = (name?: string) => {
        const nextNum = allSessions.value.length + 1
        const session = createEmptySession(name || `Venta ${nextNum}`)
        allSessions.value.push(session)
        activeSessionId.value = session.id
        // Reset non-session state
        paymentMethod.value = 'cash'
        amountReceived.value = 0
        shippingCost.value = 0
        shippingMethod.value = 'pickup'
    }

    /** Switch to an existing cart tab */
    const switchCart = (sessionId: string) => {
        if (allSessions.value.find(s => s.id === sessionId)) {
            activeSessionId.value = sessionId
            // Reset payment state when switching
            paymentMethod.value = 'cash'
            amountReceived.value = 0
            shippingCost.value = 0
            shippingMethod.value = 'pickup'
        }
    }

    /** Remove a cart tab (with confirmation if it has items) */
    const removeCart = (sessionId: string) => {
        const session = allSessions.value.find(s => s.id === sessionId)
        if (!session) return

        if (session.cart.length > 0) {
            if (!confirm(`¿Eliminar "${session.name}" con ${session.cart.length} producto(s)?`)) return
        }

        allSessions.value = allSessions.value.filter(s => s.id !== sessionId)

        // If we removed the active session, switch to another
        if (activeSessionId.value === sessionId) {
            if (allSessions.value.length === 0) {
                // Create a fresh one
                const fresh = createEmptySession()
                allSessions.value = [fresh]
                activeSessionId.value = fresh.id
            } else {
                activeSessionId.value = allSessions.value[0].id
            }
        }
    }

    /** Rename a cart tab */
    const renameCart = (sessionId: string, newName: string) => {
        const session = allSessions.value.find(s => s.id === sessionId)
        if (session) {
            session.name = newName
        }
    }

    // Computed totals
    const cartSubtotal = computed(() => {
        return cart.value.reduce((sum, item) => sum + item.subtotal, 0)
    })

    const cartTax = computed(() => {
        return cart.value.reduce((sum, item) => sum + item.tax_amount, 0)
    })

    const cartTotal = computed(() => {
        return cartSubtotal.value + cartTax.value + shippingCost.value
    })

    const cartItemCount = computed(() => {
        return cart.value.reduce((sum, item) => sum + item.quantity, 0)
    })

    const change = computed(() => {
        return Math.max(0, amountReceived.value - cartTotal.value)
    })

    // Process sale
    const processSale = async (paymentsArray?: Array<{ method: string, amount: number, notes?: string }>) => {
        if (cart.value.length === 0) {
            error.value = 'El carrito está vacío'
            return false
        }

        // Validate payments vs total
        if (!paymentsArray || paymentsArray.length === 0) {
            // Legacy check
            if (paymentMethod.value === 'cash' && amountReceived.value < cartTotal.value && !customer_id.value) {
                error.value = 'Monto recibido insuficiente (se requiere cliente para pagos parciales/crédito)'
                return false
            }
        } else {
            // Multi-tender check
            const totalPaid = paymentsArray.reduce((acc, p) => acc + p.amount, 0)
            if (totalPaid < cartTotal.value && !customer_id.value) {
                error.value = 'Monto total insuficiente (se requiere cliente para pagos parciales)'
                return false
            }
        }

        loading.value = true
        error.value = null

        try {
            logAction('checkout_success', { total: cartTotal.value })

            const currentUser = page.props.auth?.user as any
            const orderData: CreateSalesOrderData = {
                user_id: currentUser?.id, // Pass user_id from Inertia auth dynamically
                customer_id: customer_id.value,
                date: new Date().toISOString().split('T')[0],
                status: 'confirmed', // POS sales must be confirmed immediately so they appear in session summary
                warehouse_id: currentWarehouseId.value || 1,
                notes: notes.value,

                // Dynamic payment format
                ...(paymentsArray && paymentsArray.length > 0
                    ? {
                        payments: paymentsArray,
                        payment_method: 'multiple' as any
                    }
                    : {
                        payment_method: paymentMethod.value,
                        initial_payment: amountReceived.value,
                    }
                ),

                discount_amount: 0,
                shipping_cost: shippingCost.value,
                audit_logs: sessionLogs.value.length > 0 ? sessionLogs.value : undefined,
                items: cart.value.map(item => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id, // Send variant ID to backend
                    warehouse_id: item.warehouse_id || currentWarehouseId.value || 1, // Use backend context as fallback
                    quantity: item.quantity,
                    unit_price: item.product_price,
                    discount_percent: item.discount_percent,
                    tax_percent: item.tax_percent,
                    seller_id: item.seller_id,
                    notes: item.notes || undefined,
                })),
            }

            const createdOrder = await salesOrdersService.create(orderData)

            // After successful sale: remove the completed session and switch
            const completedId = activeSessionId.value
            allSessions.value = allSessions.value.filter(s => s.id !== completedId)

            if (allSessions.value.length === 0) {
                // Create a fresh session
                const fresh = createEmptySession()
                allSessions.value = [fresh]
                activeSessionId.value = fresh.id
            } else {
                // Switch to the first remaining session
                activeSessionId.value = allSessions.value[0].id
            }

            // Reset payment state
            amountReceived.value = 0
            shippingCost.value = 0
            shippingMethod.value = 'pickup'

            // Return the created order so callers can use the ID (e.g. for printing tickets)
            return createdOrder
        } catch (err: any) {
            console.error('Sales order creation error:', err.response?.data)

            if (!err.response) {
                // Network error — no response from server
                connectionStatus.value = 'offline'
                error.value = 'Sin conexión con el servidor — intenta de nuevo'
            } else if (err.response.status === 401) {
                connectionStatus.value = 'error'
                error.value = 'Sesión expirada. Recarga la página.'
            } else if (err.response.status && err.response.status >= 500) {
                connectionStatus.value = 'error'
                error.value = err.response.data?.message || 'Error interno del servidor'
            } else {
                // 422 or other — stock/validation errors
                connectionStatus.value = 'online'
                const stockErrors = err.response.data?.errors
                if (Array.isArray(stockErrors)) {
                    error.value = stockErrors.join('\n')
                } else {
                    error.value = err.response.data?.message || 'Error al procesar la venta'
                }
            }

            return false
        } finally {
            loading.value = false
        }
    }

    // Save as draft
    const saveDraft = async () => {
        if (cart.value.length === 0) {
            error.value = 'El carrito está vacío'
            return false
        }

        loading.value = true
        error.value = null

        try {
            const currentUser = page.props.auth?.user as any
            const orderData: CreateSalesOrderData = {
                user_id: currentUser?.id, // Pass user_id from Inertia auth
                customer_id: customer_id.value,
                date: new Date().toISOString().split('T')[0],
                notes: notes.value,
                payment_method: undefined,
                payment_status: 'pending',
                warehouse_id: currentWarehouseId.value || 1,
                discount_amount: 0,
                shipping_cost: shippingCost.value,
                items: cart.value.map(item => ({
                    product_id: item.product_id,
                    warehouse_id: item.warehouse_id || currentWarehouseId.value || 1,
                    quantity: item.quantity,
                    unit_price: item.product_price,
                    discount_percent: item.discount_percent,
                    tax_percent: item.tax_percent,
                    seller_id: item.seller_id,
                    notes: item.notes || undefined,
                })),
            }

            await salesOrdersService.create(orderData)

            // Remove the completed session
            const completedId = activeSessionId.value
            allSessions.value = allSessions.value.filter(s => s.id !== completedId)

            if (allSessions.value.length === 0) {
                const fresh = createEmptySession()
                allSessions.value = [fresh]
                activeSessionId.value = fresh.id
            } else {
                activeSessionId.value = allSessions.value[0].id
            }

            return true
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error al guardar borrador'
            return false
        } finally {
            loading.value = false
        }
    }

    // ============================================
    // LOAD QUOTE AS A NEW POS SESSION
    // ============================================

    /**
     * Opens a SalesQuote as a new cart tab in the POS.
     * Items, prices, discounts and taxes are taken directly from the quote.
     */
    const loadQuoteAsSession = (quote: {
        id: number
        quote_number: string
        customer_id?: number | null
        items: Array<{
            product_id: number
            product_name: string
            product_sku: string
            variant_id?: number | null
            warehouse_id?: number | null
            quantity: number
            unit_price: number
            discount_percent: number
            tax_percent: number
            subtotal: number
            tax_amount: number
            total: number
            variant?: { id: number; sku: string; brand?: { name: string } | null } | null
        }>
    }): string => {
        createNewCart(`COT-${quote.quote_number}`)

        const newSession = activeSession.value
        newSession.customer_id = quote.customer_id ?? undefined
        newSession.source_quote_id = quote.id   // ← persisted so POS can update it later

        newSession.cart = quote.items.map((item, idx): CartItem => {
            const cartItem: CartItem = {
                id: `q${quote.id}-${item.product_id}-${item.variant_id ?? 'nv'}-${idx}`,
                product_id: item.product_id,
                variant_id: item.variant_id ?? undefined,
                variant_brand: item.variant?.brand?.name ?? undefined,
                product_name: item.product_name,
                product_sku: item.variant?.sku || item.product_sku || '',
                product_price: Number(item.unit_price) || 0,
                quantity: Number(item.quantity) || 1,
                discount_percent: Number(item.discount_percent) || 0,
                tax_percent: Number(item.tax_percent) || 0,
                default_tax_percent: Number(item.tax_percent) || 0,
                is_tax_overridden: false,
                warehouse_id: item.warehouse_id ?? undefined,
                subtotal: 0,
                tax_amount: 0,
                total: 0,
            }
            // Let the POS recalculate so its own computed totals are always correct
            recalculateItem(cartItem)
            return cartItem
        })

        logAction('quote_loaded', { quote_id: quote.id, quote_number: quote.quote_number, items: quote.items.length })

        return newSession.id
    }

    return {

        // State
        cart,
        customer_id,
        notes,
        loading,
        error,
        connectionStatus,
        paymentMethod,
        amountReceived,
        shippingCost,
        shippingMethod,

        // Computed
        cartSubtotal,
        cartTax,
        cartTotal,
        cartItemCount,
        change,

        // Methods
        addToCart,
        updateQuantity,
        updateDiscount,
        updateItemPrice,
        removeItem,
        updateItemTax,
        toggleItemTaxExempt,
        updateItemSeller,
        updateItemNotes,
        reorderCart,
        clearCart,
        processSale,
        saveDraft,
        loadQuoteAsSession,

        // Multi-cart
        allSessions,
        activeSessionId,
        activeSession,
        createNewCart,
        switchCart,
        removeCart,
        renameCart,

        // Audit
        sessionLogs,
        logAction,

        // POS Settings
        isSingleWarehouseMode,
        getDefaultWarehouse,
        getDefaultWarehouseId,
    }
}
