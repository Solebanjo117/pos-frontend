<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import apiClient from '@/services/api/client'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'
import {
    FileText, Search, Plus, Minus, Trash2, Save, User, Calendar, Package, Hash, AlertTriangle
} from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

interface Product {
    id: number
    name: string
    sku_base: string
    pricing?: {
        base_price: number
        tax_rate?: number
        sale_tax_rate?: number
    }
    default_variant?: {
        sku: string;
    }
    variants?: { 
        id: number; 
        sku: string; 
        name?: string; 
        pricing?: {
            base_price: number
            tax_rate?: number
            sale_tax_rate?: number
        }
    }[]
}

const getPrice = (product: Product, variant?: any) => {
    if (variant?.pricing?.base_price) return Number(variant.pricing.base_price)
    if (product.pricing?.base_price) return Number(product.pricing.base_price)
    return 0
}

const normalizeTaxPercent = (value: unknown): number => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(100, Math.round(parsed)))
}

const getSaleTaxRate = (product: Product, variant?: any): number => {
    return normalizeTaxPercent(
        variant?.pricing?.sale_tax_rate
        ?? variant?.pricing?.tax_rate
        ?? product.pricing?.sale_tax_rate
        ?? product.pricing?.tax_rate
        ?? 0
    )
}

interface Customer {
    id: number
    name: string
    email: string
}

interface CartItem {
    product_id: number
    variant_id: number | null
    warehouse_id: number
    product_name: string
    variant_name: string
    sku: string
    quantity: number
    unit_price: number
    discount_percent: number
    tax_percent: number
    total: number
}

const customers = ref<Customer[]>([])
const products = ref<Product[]>([])
const cart = ref<CartItem[]>([])
const saving = ref(false)

// Form fields
const selectedCustomerId = ref<number | null>(null)
const validUntil = ref('')
const notes = ref('')
const internalNotes = ref('')
const productSearch = ref('')
const searchResults = ref<Product[]>([])
const searchTimeout = ref<any>(null)

// Warehouse
const warehouseId = ref<number>(1)

// R41: Quote number display (shown after first save or preview)
const savedQuoteNumber = ref<string | null>(null)

// UX-001: Track unsaved changes
const isDirty = ref(false)
const showExitModal = ref(false)
const pendingNavigation = ref<string | null>(null)

// Watch for changes to mark as dirty
watch([cart, selectedCustomerId, notes, internalNotes, validUntil], () => {
    if (cart.value.length > 0 || selectedCustomerId.value || notes.value || internalNotes.value) {
        isDirty.value = true
    }
}, { deep: true })

// Intercept browser close/refresh
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty.value && cart.value.length > 0) {
        e.preventDefault()
        e.returnValue = '¿Está seguro de salir? Los cambios no guardados se perderán.'
        return e.returnValue
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
})

// Navigation guard helper
const navigateWithCheck = (url: string) => {
    if (isDirty.value && cart.value.length > 0) {
        pendingNavigation.value = url
        showExitModal.value = true
    } else {
        router.visit(url)
    }
}

const handleConfirmExit = () => {
    showExitModal.value = false
    isDirty.value = false
    if (pendingNavigation.value) {
        router.visit(pendingNavigation.value)
    }
}

const handleSaveAndExit = async () => {
    await handleSave()
}

const handleCancelExit = () => {
    showExitModal.value = false
    pendingNavigation.value = null
}

const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + item.total, 0))
const cartSubtotal = computed(() => cart.value.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0))

const customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Público General' },
    ...customers.value.map((c) => ({ value: c.id, label: c.name })),
])

const recalcItem = (item: CartItem) => {
    const sub = item.quantity * item.unit_price
    const disc = sub * (item.discount_percent / 100)
    const afterDisc = sub - disc
    item.tax_percent = normalizeTaxPercent(item.tax_percent)
    const tax = afterDisc * (item.tax_percent / 100)
    item.total = afterDisc + tax
}

const searchProducts = async () => {
    if (productSearch.value.length < 2) {
        searchResults.value = []
        return
    }
    clearTimeout(searchTimeout.value)
    searchTimeout.value = setTimeout(async () => {
        try {
            const res = await apiClient.get('/products', {
                params: { search: productSearch.value, per_page: 10 }
            })
            searchResults.value = res.data.data ?? res.data ?? []
        } catch (e) {
            searchResults.value = []
        }
    }, 300)
}

const addProduct = (product: Product, variant?: any) => {
    const existingIdx = cart.value.findIndex(
        i => i.product_id === product.id && i.variant_id === (variant?.id ?? null)
    )

    if (existingIdx >= 0) {
        cart.value[existingIdx].quantity++
        recalcItem(cart.value[existingIdx])
    } else {
        const price = getPrice(product, variant)
        const item: CartItem = {
            product_id: product.id,
            variant_id: variant?.id ?? null,
            warehouse_id: warehouseId.value,
            product_name: product.name,
            variant_name: variant?.sku || variant?.name || '',
            sku: variant?.sku || product.sku_base,
            quantity: 1,
            unit_price: price,
            discount_percent: 0,
            tax_percent: getSaleTaxRate(product, variant),
            total: price,
        }
        cart.value.push(item)
    }

    productSearch.value = ''
    searchResults.value = []
}

const removeItem = (idx: number) => {
    cart.value.splice(idx, 1)
}

const changeQty = (idx: number, delta: number) => {
    const item = cart.value[idx]
    item.quantity = Math.max(1, item.quantity + delta)
    recalcItem(item)
}

const fetchCustomers = async () => {
    try {
        const res = await apiClient.get('/customers', { params: { per_page: 100 } })
        customers.value = res.data.data ?? res.data ?? []
    } catch (e) {
        console.error('Error loading customers:', e)
    }
}

const fetchWarehouse = async () => {
    try {
        const res = await apiClient.get('/user/warehouse-context')
        warehouseId.value = res.data.warehouse_id || 1
    } catch (e) {
        // fallback
    }
}

const handleSave = async () => {
    if (cart.value.length === 0) {
        alert('Agrega al menos un producto a la cotización.')
        return
    }

    saving.value = true
    try {
        const payload = {
            customer_id: selectedCustomerId.value || null,
            warehouse_id: warehouseId.value,
            valid_until: validUntil.value || null,
            notes: notes.value || null,
            internal_notes: internalNotes.value || null,
            items: cart.value.map(item => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                warehouse_id: item.warehouse_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_percent: item.discount_percent,
                tax_percent: normalizeTaxPercent(item.tax_percent),
            })),
        }

        const response = await apiClient.post('/sales-quotes', payload)
        // R41: Store the quote number after saving
        if (response.data?.quote_number) {
            savedQuoteNumber.value = response.data.quote_number
        }
        isDirty.value = false // Clear dirty flag before navigation
        router.visit('/sales-quotes')
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al guardar la cotización')
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await Promise.all([fetchCustomers(), fetchWarehouse()])
    // Default valid_until = 15 days from now
    const d = new Date()
    d.setDate(d.getDate() + 15)
    validUntil.value = d.toISOString().slice(0, 10)
})
</script>

<template>
    <Head title="Nueva Cotización" />

    <div class="max-w-7xl mx-auto">
        <!-- R41: Enhanced Header with Quote Number -->
        <div class="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/50 px-6 py-4 rounded-xl mb-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                        <FileText class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 dark:text-white">
                            Nueva Cotización
                        </h1>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Crea un presupuesto sin afectar el inventario
                        </p>
                    </div>
                </div>
                
                <!-- Quote Number Badge -->
                <div class="flex items-center gap-2 bg-white dark:bg-card px-4 py-3 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-800">
                    <Hash class="w-5 h-5 text-indigo-500" />
                    <div class="text-right">
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cotización</p>
                        <p class="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                            {{ savedQuoteNumber || 'NUEVA' }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left: product search + cart -->
            <div class="lg:col-span-2 space-y-4">
                <!-- Product Search -->
                <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-4">
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Buscar productos</label>
                    <div class="relative">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
                        <input
                            v-model="productSearch"
                            @input="searchProducts"
                            type="text"
                            placeholder="Escribe SKU o nombre del producto..."
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
                        />
                    </div>

                    <!-- Search Results -->
                    <div v-if="searchResults.length > 0" class="mt-2 border border-gray-200 dark:border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <template v-for="product in searchResults" :key="product.id">
                            <div v-if="product.variants && product.variants.length > 0">
                                <div v-for="variant in product.variants" :key="variant.id"
                                    @click="addProduct(product, variant)"
                                    class="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer flex justify-between items-center border-b border-gray-100 dark:border-border last:border-0"
                                >
                                    <div>
                                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ product.name }}</p>
                                        <p class="text-xs text-gray-500">{{ variant.sku || variant.name }}</p>
                                    </div>
                                    <span class="text-sm font-bold text-indigo-600 dark:text-primary">${{ getPrice(product, variant).toFixed(2) }}</span>
                                </div>
                            </div>
                            <div v-else
                                @click="addProduct(product)"
                                class="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer flex justify-between items-center border-b border-gray-100 dark:border-border last:border-0"
                            >
                                <div>
                                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ product.name }}</p>
                                    <p class="text-xs text-gray-500">{{ product.sku_base }}</p>
                                </div>
                                <span class="text-sm font-bold text-indigo-600 dark:text-primary">${{ getPrice(product).toFixed(2) }}</span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Cart Items -->
                <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden">
                    <div class="px-4 py-3 bg-gray-50 dark:bg-background border-b border-gray-200 dark:border-border">
                        <h3 class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                            <Package :size="16" />
                            Artículos ({{ cart.length }})
                        </h3>
                    </div>

                    <div v-if="cart.length === 0" class="p-8 text-center text-gray-400">
                        <Package class="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Agrega productos usando la barra de búsqueda</p>
                    </div>

                    <div v-else>
                        <div v-for="(item, idx) in cart" :key="idx" class="px-4 py-3 border-b border-gray-100 dark:border-border last:border-0 flex items-center gap-4">
                            <!-- Product Info -->
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ item.product_name }}</p>
                                <p v-if="item.variant_name" class="text-xs text-gray-500">{{ item.variant_name }}</p>
                            </div>

                            <!-- Price -->
                            <div class="w-24">
                                <input
                                    v-model.number="item.unit_price"
                                    @input="recalcItem(item)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-right text-gray-900 dark:text-white"
                                />
                            </div>

                            <!-- Quantity -->
                            <div class="flex items-center gap-1">
                                <button @click="changeQty(idx, -1)" class="p-1 rounded bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:hover:bg-muted">
                                    <Minus :size="14" />
                                </button>
                                <span class="w-8 text-center text-sm font-bold text-gray-900 dark:text-white">{{ item.quantity }}</span>
                                <button @click="changeQty(idx, 1)" class="p-1 rounded bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:hover:bg-muted">
                                    <Plus :size="14" />
                                </button>
                            </div>

                            <!-- Line Total -->
                            <div class="w-24 text-right">
                                <span class="text-sm font-bold text-gray-900 dark:text-white">${{ item.total.toFixed(2) }}</span>
                            </div>

                            <!-- Remove -->
                            <button @click="removeItem(idx)" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                                <Trash2 :size="16" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: form + totals -->
            <div class="space-y-4">
                <!-- Customer & Dates -->
                <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-4 space-y-4">
                    <div>
                        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            <User :size="12" class="inline mr-1" />
                            Cliente
                        </label>
                        <SearchableSelect
                            v-model="selectedCustomerId"
                            :options="customerOptions"
                            placeholder="Público General"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            <Calendar :size="12" class="inline mr-1" />
                            Válida hasta
                        </label>
                        <input
                            v-model="validUntil"
                            type="date"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white text-sm"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notas</label>
                        <textarea
                            v-model="notes"
                            rows="3"
                            placeholder="Comentarios para el cliente..."
                            class="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white text-sm resize-none"
                        ></textarea>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nota Interna</label>
                        <textarea
                            v-model="internalNotes"
                            rows="2"
                            placeholder="Nota interna — solo visible para el equipo"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white text-sm resize-none"
                        ></textarea>
                        <p class="text-xs text-muted-foreground mt-1">
                            Esta nota no aparece en documentos impresos ni en el ticket del cliente.
                        </p>
                    </div>
                </div>

                <!-- Totals -->
                <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-4">
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Subtotal</span>
                            <span>${{ cartSubtotal.toFixed(2) }}</span>
                        </div>
                        <div class="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-border">
                            <span>TOTAL</span>
                            <span class="text-indigo-600 dark:text-primary">${{ cartTotal.toFixed(2) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Save Button -->
                <button
                    @click="handleSave"
                    :disabled="saving || cart.length === 0"
                    class="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 disabled:bg-gray-400 text-white font-bold rounded-xl shadow-lg transition text-lg"
                >
                    <Save :size="20" />
                    {{ saving ? 'Guardando...' : 'Guardar Cotización' }}
                </button>
            </div>
        </div>
    </div>

    <!-- UX-001: Exit Confirmation Modal -->
    <Teleport to="body">
        <div v-if="showExitModal" class="fixed inset-0 z-50 flex items-center justify-center">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/50" @click="handleCancelExit"></div>
            
            <!-- Modal -->
            <div class="relative bg-white dark:bg-card rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-10">
                <div class="flex items-start gap-4">
                    <div class="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                        <AlertTriangle class="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                            ¿Salir sin guardar?
                        </h3>
                        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Tiene cambios sin guardar en esta cotización. ¿Qué desea hacer?
                        </p>
                    </div>
                </div>
                
                <div class="mt-6 space-y-3">
                    <button
                        @click="handleSaveAndExit"
                        :disabled="saving"
                        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition"
                    >
                        <Save :size="18" />
                        {{ saving ? 'Guardando...' : 'Guardar y salir' }}
                    </button>
                    
                    <button
                        @click="handleConfirmExit"
                        class="w-full px-4 py-2.5 bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:hover:bg-muted/80 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition"
                    >
                        Salir sin guardar
                    </button>
                    
                    <button
                        @click="handleCancelExit"
                        class="w-full px-4 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
