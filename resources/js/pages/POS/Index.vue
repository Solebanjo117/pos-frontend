<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Head, usePage } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePOS } from '@/composables/usePOS'
import { useProducts } from '@/composables/useProducts'
import { useCustomers } from '@/composables/useCustomers'
import { useWarehouses } from '@/composables/useWarehouses'
import apiClient from '@/services/api/client'
import { Search, Trash2, Save, Banknote, CreditCard, Landmark, AlertTriangle, Keyboard, LogOut, Car } from 'lucide-vue-next'
import { usePosSettings } from '@/composables/usePosSettings'
import { usePosSession } from '@/composables/usePosSession'

import CashRegisterStatus from '@/components/POS/CashRegisterStatus.vue'
import POSControls from '@/components/POS/POSControls.vue'
import ProductTable from '@/components/POS/ProductTable.vue'
import SummarySection from '@/components/POS/SummarySection.vue'
import ActionButtons from '@/components/POS/ActionButtons.vue'

import OpenSessionModal from '@/components/POS/OpenSessionModal.vue'
import CloseSessionModal from '@/components/POS/CloseSessionModal.vue'
import CashMovementModal from '@/components/POS/CashMovementModal.vue'
import VariantSelectModal from '@/components/POS/VariantSelectModal.vue'
import AddPaymentModal from '@/components/POS/AddPaymentModal.vue'
import PaymentMethods from '@/components/POS/PaymentMethods.vue'
import PrintTicketModal from '@/components/POS/PrintTicketModal.vue'
import ProductSearchModal from '@/components/POS/ProductSearchModal.vue'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import { SalesOrderPaymentApiService } from '@/services/payments'

defineOptions({ layout: AppLayout })

const {
  cart,
  customer_id,
  notes,
  loading,
  error,
  paymentMethod,
  amountReceived,
  cartSubtotal,
  cartTax,
  cartTotal,
  cartItemCount,
  change,
  addToCart,
  updateQuantity,
  updateDiscount,
  removeItem,
  updateItemTax,
  toggleItemTaxExempt,
  updateItemSeller,
  updateItemNotes,
  clearCart,
  processSale,
  saveDraft,
  shippingCost,
  shippingMethod,
  logAction,
  // Multi-cart
  allSessions,
  activeSessionId,
  activeSession,
  createNewCart,
  switchCart,
  removeCart,
  renameCart,
} = usePOS()

const { 
  currentWarehouseId, 
  setWarehouse, 
  initWarehouse, 
  settings,
  isClientMode 
} = usePosSettings()

const { products, fetchProducts } = useProducts()
const { customers, fetchCustomers } = useCustomers()
const { warehouses, fetchWarehouses } = useWarehouses()

const {
  session,
  summary: sessionSummary,
  isChecking: isCheckingSession,
  isOpen: isSessionOpen,
  error: sessionError,
  checkCurrentSession,
  openSession,
  closeSession,
  addCashMovement,
} = usePosSession()

// UI State
const searchQuery = ref('')
const posControlsRef = ref<InstanceType<typeof POSControls> | null>(null)
const selectedCategoryId = ref<number | undefined>(undefined)
const selectedBrandId = ref<number | undefined>(undefined)
const quantity = ref(1)
const showPaymentModal = ref(false)
const showShortcutsHelp = ref(false)
const showProductsModal = ref(false)
const isSearching = ref(false)
const showCloseSessionModal = ref(false)
const showCashMovementModal = ref(false)
const forceShowOpenSessionModal = ref(false)
const sessionActionLoading = ref(false)
const seller_id = ref<number | undefined>((usePage().props.auth?.user as any)?.id)

// Variant selection modal state — queue-based to support multiple products needing variant selection
const showVariantModal = ref(false)
const variantQueue = ref<any[]>([])  // FIFO queue of products awaiting variant selection
const pendingProduct = computed(() => variantQueue.value[0] ?? null)  // always the first in queue

// Credit / partial-payment modal state
const showAddPaymentModal = ref(false)
const addPaymentLoading = ref(false)
const addPaymentError = ref<string | null>(null)
const pendingOrderId = ref<number | null>(null)
const pendingOrderTotal = ref(0)
const pendingOrderAmountPaid = ref(0)
// Electronic Payments for Multi-Tender Flow
const electronicPayments = reactive<Record<string, number>>({})

const handlePaymentChange = (id: string, value: number) => {
    electronicPayments[id] = value
}

const totalElectronicPayments = computed(() => {
    return Object.values(electronicPayments).reduce((sum, val) => sum + val, 0)
})

const totalPaid = computed(() => {
    return amountReceived.value + totalElectronicPayments.value
})

const localChange = computed(() => {
    return Math.max(0, totalPaid.value - cartTotal.value)
})

const totalRemaining = computed(() => {
    return Math.max(0, cartTotal.value - totalPaid.value)
})

// Print ticket modal state
const showPrintTicketModal = ref(false)
const lastOrderId = ref<number | null>(null)
const lastOrderNumber = ref<string>('')

// Product selection modal state
const selectedProductIds = ref<Set<number>>(new Set())

// Categories and brands for filters
interface Category { id: number; name: string }
interface Brand { id: number; name: string }
const categories = ref<Category[]>([])
const brands = ref<Brand[]>([])
const users = ref<{id: number, name: string}[]>([])

// Refs (searchInput kept for backward compat, posControlsRef is primary)
const searchInput = ref<HTMLInputElement>()
const quantityInput = ref<HTMLInputElement>()

// Format currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

// Get helpers
const getProductPrice = (product: any): number =>
  product.pricing?.base_price ?? product.default_variant?.pricing?.base_price ?? 0

const getProductTaxRate = (product: any): number =>
  product.pricing?.tax_rate ?? product.default_variant?.pricing?.tax_rate ?? 0

const getProductStock = (product: any): number =>
  product.total_stock ?? product.default_variant?.total_stock ?? 0

const getProductSKU = (product: any): string => {
  if (isClientMode()) return `#${product.id}`
  return product.sku_base ?? product.sku ?? product.default_variant?.sku ?? ''
}

// Build filters
const buildFilters = () => ({
  search: searchQuery.value || undefined,
  category_id: selectedCategoryId.value,
  brand_id: selectedBrandId.value,
  warehouse_id: currentWarehouseId.value || undefined,
  per_page: 50,
})

// Current customer computed property
const selectedCustomer = computed(() => {
  if (!customer_id.value) return null
  return customers.value.find(c => c.id === customer_id.value)
})

// Smart Search: auto-add single result or show modal for multiple
const performSearch = async (overrideQuery?: string, overrideQty?: number) => {
  const finalQuery = overrideQuery ?? searchQuery.value
  if (!finalQuery.trim()) return

  isSearching.value = true
  logAction('search', { query: finalQuery.trim() })
  try {
    const filters = {
      ...buildFilters(),
      search: finalQuery.trim(),
    }
    await fetchProducts(filters)

    if (products.value.length === 1) {
      // Auto-add single match
      addProductToCart(products.value[0], overrideQty ?? quantity.value)
      searchQuery.value = ''
      await nextTick()
      searchInput.value?.focus()
    } else if (products.value.length > 1) {
      // Show selection modal
      selectedProductIds.value = new Set()
      showProductsModal.value = true
    } else {
      // No results
      console.warn('No products found for', finalQuery)
    }
  } catch (err) {
    console.error('POS search error:', err)
  } finally {
    isSearching.value = false
  }
}

const handleControlsSearch = (data: { query: string; quantity: number; category_id?: number; brand_id?: number }) => {
  searchQuery.value = data.query
  quantity.value = data.quantity
  if (data.category_id !== undefined) selectedCategoryId.value = data.category_id
  if (data.brand_id !== undefined) selectedBrandId.value = data.brand_id
  performSearch(data.query, data.quantity)
}

// Vehicle search handler — uses the standard product search since product names now include vehicle info
const handleVehicleSearch = async (data: { query: string; quantity: number }) => {
  const trimmed = data.query
  if (!trimmed) return

  isSearching.value = true
  logAction('vehicle-search', { query: trimmed })
  try {
    const filters = {
      search: trimmed,
      warehouse_id: currentWarehouseId.value || undefined,
      per_page: 50,
    }
    await fetchProducts(filters)

    if (products.value.length === 1) {
      addProductToCart(products.value[0], data.quantity)
      searchQuery.value = ''
      posControlsRef.value?.focus()
    } else if (products.value.length > 1) {
      selectedProductIds.value = new Set()
      showProductsModal.value = true
    } else {
      console.warn('No products found for vehicle', trimmed)
    }
  } catch (err) {
    console.error('POS vehicle search error:', err)
  } finally {
    isSearching.value = false
  }
}

// Add a product to cart — opens VariantSelectModal if multiple variants exist
// Products with multiple variants are enqueued — they are processed one by one via variantQueue
const addProductToCart = (product: any, overrideQty?: number) => {
  const variants = product.variants ?? []
  const qtyToUse = overrideQty ?? quantity.value

  if (variants.length === 1) {
    // Single variant: add directly
    addToCart(product, variants[0], qtyToUse, currentWarehouseId.value || undefined)
    searchQuery.value = ''
    nextTick(() => searchInput.value?.focus())
  } else if (variants.length > 1) {
    // Multiple variants: enqueue product for variant selection
    variantQueue.value.push(product)
    showProductsModal.value = false
    // Open modal if it's the only/first item in queue
    if (variantQueue.value.length === 1) {
      showVariantModal.value = true
    }
  } else {
    // Fallback: use default_variant if variants array not loaded
    const fallback = product.default_variant ?? null
    addToCart(product, fallback, qtyToUse, currentWarehouseId.value || undefined)
    searchQuery.value = ''
    nextTick(() => searchInput.value?.focus())
  }
}

// Handler when cashier confirms multi-selected variants for the current product in queue
const onVariantsSelected = (selections: Array<{ variant: any; quantity: number }>) => {
  const product = variantQueue.value[0]
  if (product) {
    selections.forEach(({ variant, quantity: qty }) => {
      addToCart(product, variant, qty, currentWarehouseId.value || undefined)
    })
  }
  // Dequeue the current product
  variantQueue.value.shift()
  if (variantQueue.value.length > 0) {
    // There are more products in queue — keep modal open with next product
    // (pendingProduct computed will auto-update to queue[0])
  } else {
    // Queue exhausted — close modal
    showVariantModal.value = false
    searchQuery.value = ''
    nextTick(() => searchInput.value?.focus())
  }
}

// Close variant modal and clear queue
const closeVariantModal = () => {
  showVariantModal.value = false
  variantQueue.value = []
}

// Add selected products from modal — products with multiple variants are enqueued
const addSelectedProducts = (ids: Set<number>) => {
  const selected = products.value.filter(p => ids.has(p.id))
  showProductsModal.value = false
  searchQuery.value = ''
  quantity.value = 1
  // Separate single-variant products (add directly) from multi-variant (enqueue)
  selected.forEach(p => addProductToCart(p))
  // If any multi-variant products were enqueued, open the modal
  if (variantQueue.value.length > 0) {
    showVariantModal.value = true
  } else {
    searchInput.value?.focus()
  }
}

// Fetch categories and brands
const fetchCategories = async () => {
  try {
    const res = await apiClient.get('/categories')
    categories.value = res.data.data ?? res.data ?? []
  } catch (e) { console.error('Error loading categories', e) }
}

const fetchBrands = async () => {
  try {
    const res = await apiClient.get('/brands')
    brands.value = res.data.data ?? res.data ?? []
  } catch (e) { console.error('Error loading brands', e) }
}

const fetchUsers = async () => {
    try {
        const res = await apiClient.get('/users')
        users.value = res.data.data ?? res.data ?? []
    } catch (e) { console.error('Error loading users', e) }
}

// Keyboard shortcuts
const handleKeyboard = (e: KeyboardEvent) => {
  if (showPaymentModal.value || showProductsModal.value || showVariantModal.value) return

  switch (e.key) {
    case 'F1':
      e.preventDefault()
      searchInput.value?.focus()
      break
    case 'F2':
      e.preventDefault()
      quantityInput.value?.focus()
      break
    case 'F4':
      e.preventDefault()
      clearCart()
      break
    case 'F5':
      e.preventDefault()
      handleSaveDraft()
      break
    case 'F10':
      e.preventDefault()
      if (isSessionOpen.value && cart.value.length > 0) openPaymentModal('cash')
      break
    case 'F12':
      e.preventDefault()
      showShortcutsHelp.value = !showShortcutsHelp.value
      break
  }
}

// Payment (Cash/Card/Transfer/Multiple)
const openPaymentModal = (method: 'cash' | 'card' | 'transfer' = 'cash') => {
  if (cart.value.length > 0) {
    paymentMethod.value = method
    
    // Reset all amounts
    amountReceived.value = 0
    Object.keys(electronicPayments).forEach(k => delete electronicPayments[k])
    
    if (method === 'cash') {
        amountReceived.value = Math.ceil(cartTotal.value)
    } else if (method === 'card') {
        electronicPayments['visa'] = cartTotal.value
    } else if (method === 'transfer') {
        electronicPayments['transferencia'] = cartTotal.value
    }
    
    showPaymentModal.value = true
  }
}

// Payment (Credit) — Uses the new AddPaymentModal for partial payments
const openCreditSale = () => {
    if (cart.value.length > 0 && selectedCustomer.value) {
        pendingOrderTotal.value = cartTotal.value
        pendingOrderAmountPaid.value = 0
        showAddPaymentModal.value = true
    }
}

const closePaymentModal = () => { showPaymentModal.value = false }

const handlePayment = async () => {
  const paymentsArray: Array<{method: string, amount: number, notes?: string}> = []
    
  if (amountReceived.value > 0) {
      const cashEffectiveAmount = localChange.value > 0 
                                  ? amountReceived.value - localChange.value 
                                  : amountReceived.value
      if (cashEffectiveAmount > 0) {
          paymentsArray.push({
               method: 'cash',
               amount: cashEffectiveAmount,
          })
      }
  }
  
  for (const [methodId, amount] of Object.entries(electronicPayments)) {
      if (amount > 0) {
          paymentsArray.push({
              method: methodId,
              amount: amount
          })
      }
  }

  const result = await processSale(paymentsArray)
  if (result) {
    closePaymentModal()
    lastOrderId.value = result.id ?? null
    lastOrderNumber.value = result.order_number ?? ''
    showPrintTicketModal.value = true
    searchInput.value?.focus()
  }
}

const handleSaveDraft = async () => {
  const success = await saveDraft()
  if (success) {
    alert('💾 Borrador guardado')
    searchInput.value?.focus()
  }
}

// Handle credit/partial payment submission
const handleCreditPaymentSubmit = async (payload: { amount: number; method: string; notes?: string }) => {
    addPaymentLoading.value = true
    addPaymentError.value = null

    try {
        paymentMethod.value = payload.method as any
        amountReceived.value = payload.amount
        notes.value = payload.notes || ''

        // Create the sale
        const success = await processSale()
        
        if (success) {
            showAddPaymentModal.value = false
            lastOrderId.value = success.id ?? null
            lastOrderNumber.value = success.order_number ?? ''
            showPrintTicketModal.value = true
            searchInput.value?.focus()
        } else {
            addPaymentError.value = error.value || 'Error al procesar la venta'
        }
    } catch (e: any) {
        addPaymentError.value = e.response?.data?.message || 'Error inesperado'
    } finally {
        addPaymentLoading.value = false
    }
}

// Session Handlers
const handleOpenSession = async (amount: number) => {
    sessionActionLoading.value = true
    const success = await openSession(amount, currentWarehouseId.value ?? undefined)
    sessionActionLoading.value = false
    if (success) {
        forceShowOpenSessionModal.value = false
        searchInput.value?.focus()
    }
}

const handleCloseSession = async (amount: number, notes?: string, closingDetails?: Record<string, any>) => {
    sessionActionLoading.value = true
    const success = await closeSession(amount, notes, closingDetails)
    sessionActionLoading.value = false
    if (success) {
        showCloseSessionModal.value = false
        // Will trigger the OpenSessionModal on the next reactive loop since isOpen becomes false
    }
}

const cashMovementLoading = ref(false)
const cashMovementError = ref<string | null>(null)

const handleCashMovement = async (payload: { type: 'in' | 'out'; amount: number; reason: string; notes: string }) => {
    cashMovementLoading.value = true
    cashMovementError.value = null
    const success = await addCashMovement(payload)
    cashMovementLoading.value = false
    if (success) {
        showCashMovementModal.value = false
        // Refresh session summary to update expected cash
        await checkCurrentSession(currentWarehouseId.value ?? undefined)
    } else {
        cashMovementError.value = sessionError.value
    }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyboard)
  
  // Checking session is a priority — pass warehouse after init so we scope correctly
  await checkCurrentSession(currentWarehouseId.value ?? undefined)
  await checkCurrentSession(currentWarehouseId.value ?? undefined)
  await Promise.all([
    fetchCategories(),
    fetchBrands(),
    fetchCustomers({ per_page: 50 } as any),
    fetchUsers(),
    fetchWarehouses({} as any),
    initWarehouse() // Load last selected warehouse
  ])
  
  // Initial product load with warehouse context
  if (currentWarehouseId.value) {
    performSearch()
  } else {
    // If no warehouse selected/persisted, default to first available or wait for user
    if (settings.value?.default_warehouse_id) {
        setWarehouse(settings.value.default_warehouse_id)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)
})
</script>

<template>
  <Head title="Punto de Venta" />

  <div class="h-[calc(100vh-4rem)] flex flex-col bg-[#F8F9FB] dark:bg-background text-gray-900 dark:text-foreground overflow-hidden" style="font-family: 'Inter', sans-serif">

    <!-- Header - Fixed Height -->
    <div class="shrink-0 z-20 shadow-sm relative">
        <CashRegisterStatus 
            :hasOpenSession="isSessionOpen"
            @request-open="forceShowOpenSessionModal = true"
            @request-close="showCloseSessionModal = true"
            @request-cash-movement="showCashMovementModal = true"
        />
        <!-- We use the existing modal OpenSessionModal to actually process the opening -->
        <OpenSessionModal
            :show="(!isCheckingSession && !isSessionOpen) || forceShowOpenSessionModal"
            :loading="sessionActionLoading"
            :error="sessionError"
            @submit="handleOpenSession"
            @close="forceShowOpenSessionModal = false"
        />
    </div>

    <!-- Main Content - Flex to fill remaining height -->
    <main class="flex-1 min-h-0 flex flex-col xl:flex-row gap-4 p-4 lg:p-6 overflow-hidden">
        
        <!-- Left Column: Controls & Product List (Grows to fill space) -->
        <div class="flex-[3] flex flex-col gap-4 min-w-0 h-full overflow-hidden">
          <div class="shrink-0">
            <POSControls
                ref="posControlsRef"
                :categories="categories"
                :brands="brands"
                @search="handleControlsSearch"
                @search-vehicle="handleVehicleSearch"
            />
          </div>

          <!-- Multi-Cart Tabs -->
          <div v-if="allSessions.length > 0" class="shrink-0 flex items-center gap-1.5 px-1 py-1.5 bg-gray-100 dark:bg-muted/50 rounded-xl overflow-x-auto">
            <button
              v-for="s in allSessions"
              :key="s.id"
              @click="switchCart(s.id)"
              class="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
              :class="s.id === activeSessionId
                ? 'bg-white dark:bg-card text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-card hover:text-gray-700 dark:hover:text-gray-200'"
            >
              <span class="w-2 h-2 rounded-full shrink-0"
                :class="s.cart.length > 0 ? 'bg-indigo-500' : 'bg-gray-300'"
              ></span>
              {{ s.name }}
              <span v-if="s.cart.length" class="text-[10px] tabular-nums opacity-60">({{ s.cart.length }})</span>
              <!-- Close tab -->
              <span
                v-if="allSessions.length > 1"
                @click.stop="removeCart(s.id)"
                class="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >&times;</span>
            </button>
            <!-- New cart button -->
            <button
              @click="createNewCart()"
              class="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-white hover:text-indigo-600 dark:text-primary hover:shadow-sm transition-all text-lg leading-none"
              title="Nueva venta"
            >+</button>
          </div>
          <div class="flex-1 min-h-0 relative">
            <ProductTable 
                :items="cart"
                :users="users"
                :products="products"
                :client-mode="isClientMode()"
                :warehouse-id="currentWarehouseId"
                @update-quantity="(idx, qty) => updateQuantity(cart[idx].id, qty)"
                @remove="(idx) => removeItem(cart[idx].id)"
                @update-item-tax="(id, tax) => updateItemTax(id, tax)"
                @toggle-item-tax-exempt="(id) => toggleItemTaxExempt(id)"
                @update-item-seller="(id, sellerId) => updateItemSeller(id, sellerId)"
                @update-item-notes="(id, noteText) => updateItemNotes(id, noteText)"
            />
          </div>
        </div>
        
        <!-- Right Column: Summary & Actions -->
        <div class="flex-1 min-w-[300px] max-w-sm bg-white dark:bg-card p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-border flex flex-col h-full overflow-y-auto shrink-0">
          <div class="shrink-0 mb-4">
            <SummarySection 
                :subtotal="cartSubtotal"
                :taxAmount="cartTax"
                :total="cartTotal"
                :customerId="customer_id"
                :sellerId="seller_id"
                :customers="customers"
                :users="users"
                @update:customerId="v => customer_id = v"
                @update:sellerId="v => seller_id = v"
            />
          </div>
          <div class="mt-auto shrink-0 pt-4">
            <ActionButtons 
                :hasOpenSession="isSessionOpen"
                :canPay="cart.length > 0 && !loading && !error"
                :hasCustomer="!!selectedCustomer"
                :creditAvailable="(selectedCustomer?.credit_limit ?? 0) - (selectedCustomer?.current_balance ?? 0)"
                @clear="clearCart"
                @save-draft="handleSaveDraft"
                @open-cash-register="forceShowOpenSessionModal = true"
                @pay-cash="openPaymentModal('cash')"
                @pay-card="openPaymentModal('card')"
                @pay-transfer="openPaymentModal('transfer')"
                @pay-credit="openCreditSale"
            />
          </div>
        </div>
        
    </main>

    <!-- ========== PRODUCT SELECTION MODAL (multiple results) ========== -->
    <ProductSearchModal
      :show="showProductsModal"
      :products="products"
      :search-query="searchQuery"
      :client-mode="isClientMode()"
      @close="showProductsModal = false"
      @add-products="addSelectedProducts"
    />

    <!-- ========== Payment Modal ========== -->
    <div
      v-if="showPaymentModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-border flex items-center justify-between shrink-0">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Procesar Pago</h2>
          <button @click="closePaymentModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto flex-1">
          <!-- Payment Method Default Selection -->
          <div class="grid grid-cols-4 gap-2">
            <button
              @click="paymentMethod = 'cash'"
              :class="paymentMethod === 'cash' ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-muted'"
              class="flex flex-col items-center gap-1 p-3 rounded-xl transition-all text-sm font-medium"
            >
              <Banknote :class="paymentMethod === 'cash' ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'" class="w-5 h-5" />
              <span :class="paymentMethod === 'cash' ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'">Efectivo</span>
            </button>
            <button
              @click="paymentMethod = 'card'"
              :class="paymentMethod === 'card' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-muted'"
              class="flex flex-col items-center gap-1 p-3 rounded-xl transition-all text-sm font-medium"
            >
              <CreditCard :class="paymentMethod === 'card' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'" class="w-5 h-5" />
              <span :class="paymentMethod === 'card' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'">Tarjeta</span>
            </button>
            <button
              @click="paymentMethod = 'transfer'"
              :class="paymentMethod === 'transfer' ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-muted'"
              class="flex flex-col items-center gap-1 p-3 rounded-xl transition-all text-sm font-medium"
            >
              <Landmark :class="paymentMethod === 'transfer' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'" class="w-5 h-5" />
              <span :class="paymentMethod === 'transfer' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'">Transfer.</span>
            </button>
            <button
              @click="paymentMethod = 'multiple'"
              :class="paymentMethod === 'multiple' ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'bg-gray-50 dark:bg-muted'"
              class="flex flex-col items-center gap-1 p-3 rounded-xl transition-all text-sm font-medium"
            >
              <svg :class="paymentMethod === 'multiple' ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span :class="paymentMethod === 'multiple' ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'">Dividir Pago</span>
            </button>
          </div>



          <!-- Total -->
          <div class="bg-gray-50 dark:bg-muted/50 rounded-xl p-4 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Total a cobrar</p>
            <p class="text-3xl font-bold text-indigo-600 dark:text-primary dark:text-indigo-400">{{ formatCurrency(cartTotal) }}</p>
            <p v-if="shippingCost > 0" class="text-xs text-gray-500 dark:text-gray-400 mt-1">(incl. Envío: {{ formatCurrency(shippingCost) }})</p>
          </div>

          <!-- Payment Fields -->
          <div class="space-y-4">
            <div v-if="paymentMethod === 'cash' || paymentMethod === 'multiple'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Efectivo Recibido</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">$</span>
                <input
                  v-model.number="amountReceived"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full pl-7 px-4 py-3 text-xl text-right border border-gray-300 dark:border-border rounded-xl bg-white dark:bg-card text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  autofocus
                />
              </div>
            </div>
            
            <div v-if="paymentMethod === 'cash' || paymentMethod === 'multiple'" class="grid grid-cols-4 gap-2">
              <button
                v-for="amount in [Math.ceil(cartTotal), Math.ceil(cartTotal / 10) * 10, Math.ceil(cartTotal / 50) * 50, Math.ceil(cartTotal / 100) * 100]"
                :key="amount"
                @click="amountReceived = amount"
                class="py-2 text-sm font-medium bg-gray-100 dark:bg-muted rounded-lg hover:bg-gray-200 dark:hover:bg-muted/80 text-gray-700 dark:text-gray-300"
              >
                {{ formatCurrency(amount) }}
              </button>
            </div>
            
            <PaymentMethods v-if="paymentMethod === 'card' || paymentMethod === 'transfer' || paymentMethod === 'multiple'" :payments="electronicPayments" @paymentChange="handlePaymentChange" />

            <!-- Balance Summary -->
            <div v-if="localChange > 0" class="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 flex items-center justify-between">
              <span class="text-sm text-green-700 dark:text-green-400 font-medium">Cambio a Entregar:</span>
              <span class="text-2xl font-bold text-green-600 dark:text-green-400">{{ formatCurrency(localChange) }}</span>
            </div>
            <div v-else-if="totalRemaining > 0" class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 flex items-center justify-between text-red-600 dark:text-red-400">
               <span class="text-sm font-medium"><AlertTriangle class="w-4 h-4 inline mr-1" /> Faltan por cobrar:</span>
               <span class="text-xl font-bold">{{ formatCurrency(totalRemaining) }}</span>
            </div>
            <div v-else class="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center text-sm text-indigo-600 dark:text-primary dark:text-indigo-400 font-medium">
               Pago Completo
            </div>
          </div>

          <div v-if="error" class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
        </div>

        <div class="px-6 py-4 border-t border-gray-200 dark:border-border flex gap-3 shrink-0">
          <button
            @click="closePaymentModal"
            class="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-border rounded-xl hover:bg-gray-50 dark:hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            @click="handlePayment"
            :disabled="loading || totalPaid < cartTotal || !!error"
            class="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 shadow-sm bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90"
          >
            {{ loading ? 'Procesando...' : '✓ Confirmar Venta' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========== Keyboard Shortcuts Modal ========== -->
    <div
      v-if="showShortcutsHelp"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="showShortcutsHelp = false"
    >
      <div class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-4"><Keyboard class="w-5 h-5" /> Atajos de Teclado</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Buscar producto</span><kbd class="px-2 py-0.5 bg-gray-100 dark:bg-muted rounded font-mono text-xs">F1</kbd></div>
          <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Cantidad</span><kbd class="px-2 py-0.5 bg-gray-100 dark:bg-muted rounded font-mono text-xs">F2</kbd></div>
          <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Limpiar carrito</span><kbd class="px-2 py-0.5 bg-gray-100 dark:bg-muted rounded font-mono text-xs">F4</kbd></div>
          <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Guardar borrador</span><kbd class="px-2 py-0.5 bg-gray-100 dark:bg-muted rounded font-mono text-xs">F5</kbd></div>
          <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Cobrar</span><kbd class="px-2 py-0.5 bg-gray-100 dark:bg-muted rounded font-mono text-xs">F10</kbd></div>
          <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Esta ayuda</span><kbd class="px-2 py-0.5 bg-gray-100 dark:bg-muted rounded font-mono text-xs">F12</kbd></div>
        </div>
        <button @click="showShortcutsHelp = false" class="mt-4 w-full py-2 text-sm font-medium bg-indigo-600 dark:bg-primary dark:text-primary-foreground text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-primary/90">Cerrar</button>
      </div>
    </div>

    <!-- ========== Variant Select Modal ========== -->
    <VariantSelectModal
        :show="showVariantModal && pendingProduct !== null"
        :product="pendingProduct"
        @select-multiple="onVariantsSelected"
        @close="closeVariantModal"
    />

    <!-- CloseSession + shortcuts remain at bottom as overlays -->
    <CloseSessionModal
        :show="showCloseSessionModal"
        :session="session"
        :summary="sessionSummary"
        :loading="sessionActionLoading"
        :error="sessionError"
        @submit="handleCloseSession"
        @close="showCloseSessionModal = false"
    />

    <!-- ========== Credit / Partial Payment Modal ========== -->
    <AddPaymentModal
        :show="showAddPaymentModal"
        :order-id="null" 
        :order-total="pendingOrderTotal"
        :amount-paid="0"
        :customer-name="selectedCustomer?.name"
        :credit-available="(selectedCustomer?.credit_limit ?? 0) - (selectedCustomer?.current_balance ?? 0)"
        :loading="addPaymentLoading"
        :error="addPaymentError"
        @submit="handleCreditPaymentSubmit"
        @close="showAddPaymentModal = false"
    />

    <!-- ========== Print Ticket Modal ========== -->
    <PrintTicketModal
        :show="showPrintTicketModal"
        :order-id="lastOrderId"
        :order-number="lastOrderNumber"
        @close="showPrintTicketModal = false"
    />

    <!-- ========== Cash Movement Modal ========== -->
    <CashMovementModal
        :show="showCashMovementModal"
        :loading="cashMovementLoading"
        :error="cashMovementError"
        @submit="handleCashMovement"
        @close="showCashMovementModal = false; cashMovementError = null"
    />

  </div>
</template>
