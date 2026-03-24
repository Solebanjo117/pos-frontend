<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Head, usePage } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePOS } from '@/composables/usePOS'
import { useProducts } from '@/composables/useProducts'
import { useCustomers } from '@/composables/useCustomers'
import { useWarehouses } from '@/composables/useWarehouses'
import apiClient from '@/services/api/client'
import { Search, Trash2, Save, Banknote, CreditCard, Landmark, AlertTriangle, Keyboard, LogOut, Car, Gift } from 'lucide-vue-next'
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
import QuickCustomerModal from '@/components/POS/QuickCustomerModal.vue'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue'
import { SalesOrderPaymentApiService } from '@/services/payments'
import { router } from '@inertiajs/vue3'

defineOptions({ layout: AppLayout })

const props = withDefaults(defineProps<{
  quoteMode?: boolean
  quoteId?: number
  returnMode?: boolean
  editMode?: boolean
  orderId?: number
}>(), {
  quoteMode: false,
  quoteId: undefined,
  returnMode: false,
  editMode: false,
  orderId: undefined,
})

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
  updateItemPrice,
  reorderCart,
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
  loadQuoteAsSession,
} = usePOS()

const { 
  currentWarehouseId, 
  setWarehouse, 
  initWarehouse, 
  settings,
  isClientMode 
} = usePosSettings()

const { products, fetchProducts, fetchMoreProducts, total: totalProducts, hasNextPage, loading: productsLoading } = useProducts()
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
const showQuickCustomerModal = ref(false)
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

// Product Detail Modal (from right-click in cart)
const selectedProductForModal = ref<any>(null)
const openProductDetail = async (productId: number) => {
  try {
    const { data } = await apiClient.get(`/products/${productId}`)
    selectedProductForModal.value = data.data ?? data
  } catch { /* silent */ }
}

// Quick Customer Modal handler
const handleCustomerCreated = async (newCustomer: any) => {
    await fetchCustomers()
    customer_id.value = newCustomer.id
}

// Handle reorder success from ProductTable QuickPurchaseModal
const handleReorderSuccess = (result: { productId: number, variantId: number | null, quantityAdded: number }) => {
  const item = cart.value.find((i: any) =>
    i.product_id === result.productId &&
    (result.variantId ? i.variant_id === result.variantId : true)
  )
  if (item && item.available_stock !== undefined) {
    item.available_stock += result.quantityAdded
  }
}
const pendingOrderTotal = ref(0)
const pendingOrderAmountPaid = ref(0)
// Electronic Payments for Multi-Tender Flow
const electronicPayments = reactive<Record<string, number>>({})
// Store credit (saldo a favor) to apply to this sale
const storeCreditToApply = ref(0)
const handlePaymentChange = (id: string, value: number) => {
    electronicPayments[id] = value
}

const totalElectronicPayments = computed(() => {
    return Object.values(electronicPayments).reduce((sum, val) => sum + val, 0)
})

// Total dinero realmente recibido (efectivo, tarjeta, transferencia, saldo a favor)
// NO incluye crédito porque el crédito es deuda, no dinero recibido
const totalReceived = computed(() => {
  return amountReceived.value + totalElectronicPayments.value + storeCreditToApply.value
})

// Monto pendiente (lo que falta por cobrar o se cargará a crédito)
const pendingAmount = computed(() => {
  return Math.max(0, amountToCharge.value - totalReceived.value)
})

// Vuelto a entregar (solo si se recibió más de lo debido)
const localChange = computed(() => {
    return Math.max(0, totalReceived.value - cartTotal.value)
})

// Available credit for the selected customer
const creditAvailable = computed(() => {
  if (!selectedCustomer.value) return 0
  return Math.max(0, (selectedCustomer.value.credit_limit ?? 0) - Math.max(0, selectedCustomer.value.current_balance ?? 0))
})

// El crédito a cargar se calcula automáticamente: es el mínimo entre lo pendiente y el crédito disponible
// Solo aplica si hay cliente seleccionado
const creditToCharge = computed(() => {
  if (!selectedCustomer.value || pendingAmount.value <= 0) return 0
  return Math.min(pendingAmount.value, creditAvailable.value)
})

// Monto que queda sin cubrir (ni pagado ni cubierto por crédito)
const uncoveredAmount = computed(() => {
  return Math.max(0, pendingAmount.value - creditToCharge.value)
})

// Para compatibilidad con el template existente
const totalPaid = computed(() => {
  return totalReceived.value + creditToCharge.value
})

const totalRemaining = computed(() => {
    return uncoveredAmount.value
})

// Remaining to pay after cash and electronic payments (alias para compatibilidad)
const remainingToPay = computed(() => {
  return pendingAmount.value
})

// Return mode state
const returnOrderData = ref<any>(null)
const returnLoading = ref(false)
const returnError = ref<string | null>(null)

// Edit mode state
const editOrderData = ref<any>(null)
const editLoading = ref(false)
const editError = ref<string | null>(null)
interface OriginalItemSnapshot {
  qty: number
  price: number
  order_item_id: number
}
const originalItems = ref<Record<string, OriginalItemSnapshot>>({})
const nowTick = ref(Date.now())
let elapsedTimer: ReturnType<typeof setInterval> | null = null

const getOriginalItemKey = (payload: { product_id: number; variant_id?: number | null; warehouse_id?: number | null }) => {
  return `${payload.product_id}:${payload.variant_id ?? 'none'}:${payload.warehouse_id ?? 'none'}`
}

// Load order for edit (add/modify items on an existing confirmed order)
async function loadOrderForReturn(orderId: number) {
  try {
    const res = await apiClient.get(`/sales-orders/${orderId}`)
    const order = res.data.data ?? res.data
    returnOrderData.value = order

    // Set customer
    if (order.customer_id) {
      if (order.customer && !customers.value.some((c: any) => c.id === order.customer_id)) {
        customers.value.push(order.customer)
      }
      customer_id.value = order.customer_id
    }

    // DO NOT call clearCart() because we are in an isolated session
    for (const item of (order.items ?? [])) {
      const quantity = -Math.abs(item.quantity) // Negative for returns
      const unitPrice = Number(item.unit_price)
      const discountPercent = Number(item.discount_percent ?? 0)
      const taxPercent = Number(item.tax_percent ?? 0)

      // Use the actual values from the original order to avoid discrepancies
      // Negate them for returns
      const subtotal = -Math.abs(Number(item.subtotal ?? 0))
      const taxAmount = -Math.abs(Number(item.tax_amount ?? 0))
      const total = -Math.abs(Number(item.total ?? 0))

      cart.value.push({
        id: `return-${item.id}`,
        product_id: item.product_id,
        variant_id: item.variant_id ?? undefined,
        product_name: item.product_name || item.product?.name || 'Producto',
        product_sku: item.product_sku || item.product?.sku_base || '',
        product_price: unitPrice,
        quantity,
        discount_percent: discountPercent,
        tax_percent: taxPercent,
        default_tax_percent: taxPercent,
        is_tax_overridden: false,
        warehouse_id: item.warehouse_id,
        order_item_id: item.id, // Keep reference to original order item
        seller_id: item.seller_id, // Inject original seller
        subtotal,
        tax_amount: taxAmount,
        total,
      })
    }
  } catch (e: any) {
    console.error('Error loading order for return:', e)
    returnError.value = e.response?.data?.message || 'Error al cargar la orden para devolución'
  }
}

// Confirm return
async function confirmReturn() {
  if (!props.orderId || cart.value.length === 0) return

  returnLoading.value = true
  returnError.value = null

  try {
    // Build return items from cart
    const items = cart.value.map((item: any) => ({
      sales_order_item_id: item.order_item_id,
      quantity: Math.abs(item.quantity),
      seller_id: item.seller_id,
    }))

    // Create the return
    const returnRes = await apiClient.post(`/sales-orders/${props.orderId}/returns`, {
      refund_method: 'balance', // Always use balance for store credit
      reason: 'Devolución desde POS',
      items,
    })

    const returnId = returnRes.data.data?.id
    if (returnId) {
      // Approve immediately
      await apiClient.post(`/sales-returns/${returnId}/approve`)
    }

    // Redirect to the original order
    router.visit(`/sales-orders/${props.orderId}`)
  } catch (e: any) {
    console.error('Error processing return:', e)
    const errData = e.response?.data
    if (Array.isArray(errData?.errors)) {
      returnError.value = errData.errors.join('\n')
    } else {
      returnError.value = errData?.message || 'Error al procesar la devolución'
    }
  } finally {
    returnLoading.value = false
  }
}

// Load order for edit (add items / increase quantities)
async function loadOrderForEdit(orderId: number) {
  try {
    const res = await apiClient.get(`/sales-orders/${orderId}`)
    const order = res.data.data ?? res.data
    editOrderData.value = order

    // Set customer
    if (order.customer_id) {
      if (order.customer && !customers.value.some((c: any) => c.id === order.customer_id)) {
        customers.value.push(order.customer)
      }
      customer_id.value = order.customer_id
    }

    // Load existing items with POSITIVE quantities and snapshot original state
    for (const item of (order.items ?? [])) {
      const quantity = Math.abs(item.quantity)
      const unitPrice = Number(item.unit_price)
      const discountPercent = Number(item.discount_percent ?? 0)
      const taxPercent = Number(item.tax_percent ?? 0)
      const subtotal = Number(item.subtotal ?? 0)
      const taxAmount = Number(item.tax_amount ?? 0)
      const total = Number(item.total ?? 0)

      const originalKey = getOriginalItemKey({
        product_id: item.product_id,
        variant_id: item.variant_id ?? null,
        warehouse_id: item.warehouse_id ?? null,
      })

      // Snapshot original state
      originalItems.value[originalKey] = {
        qty: quantity,
        price: unitPrice,
        order_item_id: item.id,
      }

      cart.value.push({
        id: `edit-${item.id}`,
        product_id: item.product_id,
        variant_id: item.variant_id ?? undefined,
        product_name: item.product_name || item.product?.name || 'Producto',
        product_sku: item.product_sku || item.product?.sku_base || '',
        product_price: unitPrice,
        quantity,
        discount_percent: discountPercent,
        tax_percent: taxPercent,
        default_tax_percent: taxPercent,
        is_tax_overridden: false,
        warehouse_id: item.warehouse_id,
        order_item_id: item.id,
        seller_id: item.seller_id,
        subtotal,
        tax_amount: taxAmount,
        total,
      })
    }
  } catch (e: any) {
    console.error('Error loading order for edit:', e)
    editError.value = e.response?.data?.message || 'Error al cargar la orden para editar'
  }
}

// Computed: calculate difference between current cart and original order
const orderDiff = computed(() => {
  if (!props.editMode) return { items: [], total: 0 }

  const diffItems: Array<{
    product_id: number
    variant_id?: number
    warehouse_id: number
    qty: number
    qty_diff: number
    price: number
    tax_percent: number
    seller_id?: number
    is_new: boolean
    order_item_id?: number
  }> = []

  let diffTotal = 0

  for (const item of cart.value) {
    const originalKey = getOriginalItemKey({
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      warehouse_id: item.warehouse_id ?? null,
    })
    const original = originalItems.value[originalKey]

    if (!original) {
      // New product (not in original order)
      const itemSubtotal = item.quantity * item.product_price
      const itemTax = itemSubtotal * ((item.tax_percent ?? 0) / 100)
      diffTotal += itemSubtotal + itemTax

      diffItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        warehouse_id: Number(item.warehouse_id ?? currentWarehouseId.value ?? 0),
        qty: item.quantity,
        qty_diff: item.quantity,
        price: item.product_price,
        tax_percent: item.tax_percent ?? 0,
        seller_id: item.seller_id,
        is_new: true,
      })
    } else if (item.quantity > original.qty) {
      // Quantity increased
      const qtyDiff = item.quantity - original.qty
      const itemSubtotal = qtyDiff * item.product_price
      const itemTax = itemSubtotal * ((item.tax_percent ?? 0) / 100)
      diffTotal += itemSubtotal + itemTax

      diffItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        warehouse_id: Number(item.warehouse_id ?? currentWarehouseId.value ?? 0),
        qty: item.quantity,
        qty_diff: qtyDiff,
        price: item.product_price,
        tax_percent: item.tax_percent ?? 0,
        seller_id: item.seller_id,
        is_new: false,
        order_item_id: original.order_item_id,
      })
    }
    // If quantity <= original, no diff (we don't allow reducing in edit mode)
  }

  return { items: diffItems, total: Number(diffTotal.toFixed(2)) }
})

// Format elapsed time since order creation
const editOrderElapsedTime = computed(() => {
  if (!editOrderData.value?.created_at) return ''
  nowTick.value
  const created = new Date(editOrderData.value.created_at)
  const now = new Date(nowTick.value)
  const diffMs = now.getTime() - created.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  if (diffHours > 0) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  if (diffMins > 0) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`
  return 'hace unos segundos'
})

const amountToCharge = computed(() => {
  if (props.editMode) {
    return Math.max(0, orderDiff.value.total)
  }
  return cartTotal.value
})

const handleUpdateQuantity = (index: number, qty: number) => {
  const item = cart.value[index]
  if (!item) return

  if (props.editMode) {
    const originalKey = getOriginalItemKey({
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      warehouse_id: item.warehouse_id ?? null,
    })
    const original = originalItems.value[originalKey]
    if (original && qty < original.qty) {
      editError.value = 'No se permite reducir cantidades en modo edición. Para reducciones usa devoluciones.'
      return
    }
  }

  editError.value = null
  updateQuantity(item.id, qty)
}

// Confirm edit order (add items / charge difference)
async function confirmEditOrder() {
  if (!props.orderId || orderDiff.value.items.length === 0) return

  editLoading.value = true
  editError.value = null

  try {
    // Build items payload
    const items = orderDiff.value.items.map(item => ({
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      warehouse_id: Number(item.warehouse_id) || Number(currentWarehouseId.value) || 1,
      qty: item.qty,
      price: item.price,
      tax_percent: item.tax_percent,
      seller_id: item.seller_id ?? null,
    }))

    // Build payments array from current modal state
    const paymentsArray: Array<{method: string, amount: number, notes?: string}> = []

    if (amountReceived.value > 0) {
      const cashEffectiveAmount = localChange.value > 0
        ? amountReceived.value - localChange.value
        : amountReceived.value
      if (cashEffectiveAmount > 0) {
        paymentsArray.push({ method: 'cash', amount: cashEffectiveAmount })
      }
    }

    for (const [methodId, amount] of Object.entries(electronicPayments)) {
      if (amount > 0) {
        paymentsArray.push({ method: methodId, amount: amount })
      }
    }

    if (storeCreditToApply.value > 0) {
      paymentsArray.push({
        method: 'store_credit',
        amount: storeCreditToApply.value,
        notes: 'Aplicado de saldo a favor del cliente'
      })
    }

    if (creditToCharge.value > 0 && selectedCustomer.value) {
      paymentsArray.push({
        method: 'credit',
        amount: creditToCharge.value,
        notes: 'Cobrado a crédito del cliente'
      })
    }

    // Call backend endpoint
    await apiClient.patch(`/sales-orders/${props.orderId}/add-items`, {
      items,
      payment: paymentsArray,
    })

    // Redirect to the order detail
    router.visit(`/sales-orders/${props.orderId}`)
  } catch (e: any) {
    console.error('Error processing edit order:', e)
    const errData = e.response?.data
    if (Array.isArray(errData?.errors)) {
      editError.value = errData.errors.join('\n')
    } else {
      editError.value = errData?.message || 'Error al procesar la edición'
    }
  } finally {
    editLoading.value = false
  }
}

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
  per_page: 20,
})

// Current customer computed property
const selectedCustomer = computed(() => {
  if (!customer_id.value) return null
  return customers.value.find(c => c.id === customer_id.value)
})

const canCheckout = computed(() =>
  cart.value.length > 0 &&
  !loading.value
)


// Smart Search: auto-add single result or show modal for multiple
const performSearch = async (overrideQuery?: string, overrideQty?: number) => {
  const finalQuery = overrideQuery ?? searchQuery.value
  if (!finalQuery.trim()) return

  isSearching.value = true
  logAction('search', { query: finalQuery.trim() })
  try {
    const filters = {
      ...buildFilters(),
      search: finalQuery.trim() || undefined,
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

const loadMoreProducts = async () => {
  if (!hasNextPage.value || productsLoading.value) return
  
  logAction('search_load_more', { query: searchQuery.value })
  try {
    const filters = {
      ...buildFilters(),
      search: searchQuery.value || undefined,
    }
    await fetchMoreProducts(filters)
  } catch (err) {
    console.error('POS load more error:', err)
  }
}

const handleControlsSearch = (data: { query: string; quantity: number; category_id?: number; brand_id?: number }) => {
  searchQuery.value = data.query
  quantity.value = data.quantity
  if (data.category_id !== undefined) selectedCategoryId.value = data.category_id
  if (data.brand_id !== undefined) selectedBrandId.value = data.brand_id
  performSearch(data.query, data.quantity)
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
      if (!props.quoteMode && isSessionOpen.value && cart.value.length > 0) openPaymentModal('cash')
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

    // Reset all amounts and clear previous errors
    amountReceived.value = 0
    error.value = null
    storeCreditToApply.value = 0
    Object.keys(electronicPayments).forEach(k => delete electronicPayments[k])

    if (method === 'cash') {
      amountReceived.value = Math.ceil(amountToCharge.value)
    } else if (method === 'card') {
      electronicPayments['visa'] = amountToCharge.value
    } else if (method === 'transfer') {
      electronicPayments['transferencia'] = amountToCharge.value
    }

    showPaymentModal.value = true
  }
}

// Payment (Credit) — Uses the new AddPaymentModal for partial payments
const openCreditSale = () => {
    if (cart.value.length > 0 && selectedCustomer.value) {
        pendingOrderTotal.value = cartTotal.value
        pendingOrderAmountPaid.value = 0
        error.value = null
        showAddPaymentModal.value = true
    }
}

const closePaymentModal = () => {
    showPaymentModal.value = false
    error.value = null
}

const handlePayment = async () => {
  if (props.editMode) {
    await confirmEditOrder()
    if (!editError.value) {
      closePaymentModal()
    }
    return
  }

  // Clear any previous payment errors before attempting new payment
  error.value = null
  
  // Validate cart items before processing
  const invalidItems = cart.value.filter(item => !item.product_id || item.product_id <= 0)
  if (invalidItems.length > 0) {
    console.error('Invalid items in cart:', invalidItems)
    error.value = `⚠️ Carrito inválido: ${invalidItems.length} producto(s) con ID inválido. Revisa tu carrito y vuelve a agregar los productos.`
    return
  }
  
  // Log items being sent to backend for debugging
  console.log('Payment attempt - Cart items to be processed:', cart.value.map(item => ({ 
    product_id: item.product_id, 
    product_name: item.product_name,
    quantity: item.quantity 
  })))
  
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

  // Add store credit payment if used
  if (storeCreditToApply.value > 0) {
      paymentsArray.push({
          method: 'store_credit',
          amount: storeCreditToApply.value,
          notes: 'Aplicado de saldo a favor del cliente'
      })
  }

    // Add credit charge if there's pending amount with a customer
    if (creditToCharge.value > 0 && selectedCustomer.value) {
      paymentsArray.push({
        method: 'credit',
        amount: creditToCharge.value,
        notes: 'Cobrado a crédito del cliente'
      })
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

// Detect if the active session was loaded from a SalesQuote
const isQuoteSession = computed(() => !!activeSession.value?.source_quote_id)

// Save changes back to the originating SalesQuote (update it in place)
const saveQuoteChangesLoading = ref(false)

const handleSaveQuoteChanges = async () => {
  const quoteId = activeSession.value?.source_quote_id
  if (!quoteId) return
  if (cart.value.length === 0) {
    alert('El carrito está vacío, agrega productos antes de guardar.')
    return
  }
  saveQuoteChangesLoading.value = true
  try {
    const items = cart.value.map((item: any) => ({
      product_id:       item.product_id,
      variant_id:       item.variant_id ?? null,
      warehouse_id:     item.warehouse_id ?? currentWarehouseId.value,
      quantity:         item.quantity,
      unit_price:       item.product_price,
      discount_percent: item.discount_percent ?? 0,
      tax_percent:      item.tax_percent ?? 0,
    }))

    await apiClient.put(`/sales-quotes/${quoteId}`, {
      customer_id:  customer_id.value ?? null,
      warehouse_id: currentWarehouseId.value ?? null,
      items,
    })

    alert('✅ Cotización actualizada exitosamente.')
    searchInput.value?.focus()
  } catch (e: any) {
    alert(e.response?.data?.message || 'Error al actualizar la cotización')
  } finally {
    saveQuoteChangesLoading.value = false
  }
}

// Save current cart as a Sales Quote (draft)
const saveQuoteLoading = ref(false)

const handleSaveQuote = async () => {
  if (cart.value.length === 0) {
    alert('Agrega productos al carrito antes de guardar una cotización.')
    return
  }
  saveQuoteLoading.value = true
  try {
    const items = cart.value.map((item: any) => ({
      product_id:       item.product_id,
      variant_id:       item.variant_id ?? null,
      warehouse_id:     item.warehouse_id ?? currentWarehouseId.value,
      quantity:         item.quantity,
      unit_price:       item.product_price,
      discount_percent: item.discount_percent ?? 0,
      tax_percent:      item.tax_percent ?? 0,
    }))

    const res = await apiClient.post('/sales-quotes/from-pos', {
      customer_id:  customer_id.value ?? null,
      warehouse_id: currentWarehouseId.value ?? null,
      items,
    })

    const quoteNumber = res.data.data?.quote_number ?? ''
    clearCart()

    const msg = `📄 Cotización ${quoteNumber} guardada exitosamente.\n\n¿Deseas ir a Cotizaciones?`
    if (confirm(msg)) {
      window.location.href = '/sales-quotes'
    }
  } catch (e: any) {
    alert(e.response?.data?.message || 'Error al guardar la cotización')
  } finally {
    saveQuoteLoading.value = false
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
        error.value = null
        searchInput.value?.focus()
    }
}

const handleCloseSession = async (amount: number, notes?: string, closingDetails?: Record<string, any>) => {
    sessionActionLoading.value = true
    const success = await closeSession(amount, notes, closingDetails)
    sessionActionLoading.value = false
    if (success) {
        showCloseSessionModal.value = false
        error.value = null
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

let returnSessionId: string | null = null;
let editSessionId: string | null = null;

onMounted(async () => {
  window.addEventListener('keydown', handleKeyboard)

  // Clear any previous errors from past sessions
  error.value = null

  await initWarehouse()

  // Skip session check in quote mode, return mode, and edit mode — no cash register needed
  if (!props.quoteMode && !props.returnMode && !props.editMode) {
    // Session source of truth comes from backend before showing open-session flow
    await checkCurrentSession(currentWarehouseId.value ?? undefined)
  }

  await Promise.all([
    fetchCategories(),
    fetchBrands(),
    fetchCustomers({ per_page: 50 } as any),
    fetchUsers(),
    fetchWarehouses({} as any),
  ])

  // Initial product load with warehouse context
  if (!currentWarehouseId.value) {
    // If no warehouse selected/persisted, default to first available or wait for user
    if (settings.value?.default_warehouse_id) {
        setWarehouse(settings.value.default_warehouse_id)
    }
  } else if (!props.returnMode && !props.editMode) {
    performSearch()
  }

  // In return mode, load the order for return
  if (props.returnMode && props.orderId) {
    sessionStorage.setItem('pos_previous_session', activeSessionId.value)

    // Clean up any stale return sessions
    allSessions.value = allSessions.value.filter((s: any) => !s.name.includes('Devolución en Curso'))

    createNewCart('Devolución en Curso')
    returnSessionId = activeSessionId.value

    await loadOrderForReturn(props.orderId)
  }

  // In edit mode, load the order for editing
  if (props.editMode && props.orderId) {
    sessionStorage.setItem('pos_previous_session', activeSessionId.value)

    // Clean up any stale edit sessions
    allSessions.value = allSessions.value.filter((s: any) => !s.name.includes('Editando Orden'))

    createNewCart(`Editando Orden #${props.orderId}`)
    editSessionId = activeSessionId.value

    await loadOrderForEdit(props.orderId)
  }

  // In quote mode with an existing quote, auto-load it into the cart
  if (props.quoteMode && props.quoteId) {
    try {
      const res = await apiClient.get(`/sales-quotes/${props.quoteId}`)
      const q = res.data
      loadQuoteAsSession({
        id: q.id,
        quote_number: q.quote_number,
        customer_id: q.customer?.id ?? null,
        items: (q.items ?? []).map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          variant_id: item.variant_id ?? null,
          warehouse_id: item.warehouse_id ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
          subtotal: item.subtotal,
          tax_amount: item.tax_amount,
          total: item.total,
          variant: item.variant ?? null,
        }))
      })
    } catch (e: any) {
      console.error('Error loading quote:', e)
      error.value = e.response?.data?.message || 'Error al cargar la cotización'
    }
  }

  elapsedTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 60000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)

  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }

  if (props.returnMode && returnSessionId) {
    // Silently remove the return session
    allSessions.value = allSessions.value.filter((s: any) => s.id !== returnSessionId)

    // Restore the previous session
    const prevId = sessionStorage.getItem('pos_previous_session')
    if (prevId) {
      const exists = allSessions.value.some((s: any) => s.id === prevId)
      if (exists) {
        activeSessionId.value = prevId
      } else if (allSessions.value.length > 0) {
        activeSessionId.value = allSessions.value[0].id
      }
      sessionStorage.removeItem('pos_previous_session')
    }
  }

  if (props.editMode && editSessionId) {
    // Silently remove the edit session
    allSessions.value = allSessions.value.filter((s: any) => s.id !== editSessionId)

    // Restore the previous session
    const prevId = sessionStorage.getItem('pos_previous_session')
    if (prevId) {
      const exists = allSessions.value.some((s: any) => s.id === prevId)
      if (exists) {
        activeSessionId.value = prevId
      } else if (allSessions.value.length > 0) {
        activeSessionId.value = allSessions.value[0].id
      }
      sessionStorage.removeItem('pos_previous_session')
    }
  }
})

</script>

<template>
  <Head :title="props.quoteMode ? 'Editor de Cotización' : 'Punto de Venta'" />

  <div class="h-[calc(100vh-4rem)] flex flex-col bg-[#F8F9FB] dark:bg-background text-gray-900 dark:text-foreground overflow-hidden" style="font-family: 'Inter', sans-serif">

    <!-- Return Mode Header -->
    <div v-if="props.returnMode" class="shrink-0 z-20 shadow-sm bg-orange-500 text-white px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            @click="router.visit(`/sales-orders/${props.orderId}`)"
            class="p-2 hover:bg-orange-600 rounded-lg transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-xl font-bold">Devolución</h1>
            <p class="text-orange-100 text-sm">Orden #{{ returnOrderData?.order_number || props.orderId }}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm text-orange-100">Total a devolver</p>
          <p class="text-2xl font-bold">{{ formatCurrency(Math.abs(cartTotal)) }}</p>
        </div>
      </div>
    </div>

    <!-- Edit Mode Header -->
    <div v-if="props.editMode" class="shrink-0 z-20 shadow-sm bg-blue-600 text-white px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            @click="router.visit(`/sales-orders/${props.orderId}`)"
            class="p-2 hover:bg-blue-700 rounded-lg transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-xl font-bold">Editando Orden</h1>
            <p class="text-blue-100 text-sm">
              #{{ editOrderData?.order_number || props.orderId }}
              <span class="ml-2 opacity-75">{{ editOrderElapsedTime }}</span>
              <span v-if="editOrderData?.created_at" class="ml-1 opacity-60 text-xs">
                ({{ new Date(editOrderData.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }})
              </span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-6">
          <div class="text-right">
            <p class="text-xs text-blue-200">Cliente</p>
            <p class="text-sm font-medium">{{ editOrderData?.customer_name || 'Sin cliente' }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-blue-200">Total original</p>
            <p class="text-sm font-medium">{{ formatCurrency(editOrderData?.total || 0) }}</p>
          </div>
          <div class="text-right border-l border-blue-500 pl-6">
            <p class="text-xs text-blue-200">Diferencia a cobrar</p>
            <p class="text-2xl font-bold">{{ formatCurrency(orderDiff.total) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Header - Fixed Height (hidden in quoteMode, returnMode, and editMode — no cash register needed) -->
    <div v-if="!props.quoteMode && !props.returnMode && !props.editMode" class="shrink-0 z-20 shadow-sm relative">
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
          <!-- Hide search controls in return mode -->
          <div v-if="!props.returnMode" class="shrink-0">
            <POSControls
                ref="posControlsRef"
                :categories="categories"
                :brands="brands"
                @search="handleControlsSearch"
            />
          </div>

          <!-- Multi-Cart Tabs (hide in return mode and edit mode) -->
          <div v-if="allSessions.length > 0 && !props.returnMode && !props.editMode" class="shrink-0 flex items-center gap-1.5 px-1 py-1.5 bg-gray-100 dark:bg-muted/50 rounded-xl overflow-x-auto">
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
                :return-mode="returnMode"
              @update-quantity="(idx, qty) => handleUpdateQuantity(idx, qty)"
                @remove="(idx) => removeItem(cart[idx].id)"
                @update-item-tax="(id, tax) => updateItemTax(id, tax)"
                @toggle-item-tax-exempt="(id) => toggleItemTaxExempt(id)"
                @update-item-seller="(id, sellerId) => updateItemSeller(id, sellerId)"
                @update-item-notes="(id, noteText) => updateItemNotes(id, noteText)"
                @update-item-price="(id, price) => updateItemPrice(id, price)"
                @update-item-discount="(id, discount) => updateDiscount(id, discount)"
                @view-details="(productId) => openProductDetail(productId)"
                @reorder="reorderCart"
                @reorder-success="handleReorderSuccess"
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
                @open-quick-customer="showQuickCustomerModal = true"
            />
          </div>
          <div class="mt-auto shrink-0 pt-4">
            <!-- Return Mode: Show Confirm Return button -->
            <div v-if="props.returnMode" class="space-y-3">
              <div v-if="returnError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                {{ returnError }}
              </div>
              <button
                @click="confirmReturn"
                :disabled="returnLoading || cart.length === 0"
                class="w-full h-14 flex items-center justify-center gap-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-muted text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] font-bold text-lg"
              >
                <svg v-if="returnLoading" class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span v-else>Confirmar Devolución</span>
              </button>
              <button
                @click="router.visit(`/sales-orders/${props.orderId}`)"
                class="w-full py-3 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-border rounded-xl hover:bg-gray-50 dark:hover:bg-muted transition"
              >
                Cancelar
              </button>
            </div>

            <!-- Edit Mode: Show Confirm Edit button or Payment Modal -->
            <div v-else-if="props.editMode" class="space-y-3">
              <div v-if="editError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                {{ editError }}
              </div>

              <!-- Show diff summary -->
              <div v-if="orderDiff.items.length > 0" class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                <p class="text-sm text-blue-700 dark:text-blue-300 mb-2 font-medium">Cambios a aplicar:</p>
                <ul class="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <li v-for="(item, idx) in orderDiff.items" :key="idx">
                    {{ item.is_new ? '+' : '↑' }}
                    {{ item.qty_diff }}x ${{ item.price.toFixed(2) }}
                    <span v-if="!item.is_new" class="opacity-60">(qty aumentada)</span>
                  </li>
                </ul>
                <div class="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 flex justify-between items-center">
                  <span class="text-sm font-semibold text-blue-700 dark:text-blue-300">Total diferencia:</span>
                  <span class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(orderDiff.total) }}</span>
                </div>
              </div>

              <!-- No changes message -->
              <div v-else class="bg-gray-50 dark:bg-muted rounded-xl p-4 text-center">
                <p class="text-sm text-gray-500 dark:text-gray-400">No se han realizado cambios a la orden.</p>
              </div>

              <!-- Action buttons -->
              <button
                v-if="orderDiff.total > 0"
                @click="openPaymentModal('cash')"
                :disabled="editLoading"
                class="w-full h-14 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-muted text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] font-bold text-lg"
              >
                <svg v-if="editLoading" class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span v-else>Cobrar Diferencia {{ formatCurrency(orderDiff.total) }}</span>
              </button>

              <button
                v-else-if="orderDiff.items.length > 0"
                @click="confirmEditOrder"
                :disabled="editLoading"
                class="w-full h-14 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-muted text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] font-bold text-lg"
              >
                <svg v-if="editLoading" class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span v-else>Guardar cambios</span>
              </button>

              <button
                v-else-if="orderDiff.items.length === 0"
                disabled
                class="w-full h-14 flex items-center justify-center gap-3 bg-gray-300 dark:bg-muted text-gray-500 rounded-xl cursor-not-allowed font-bold text-lg"
              >
                Sin cambios
              </button>

              <button
                @click="router.visit(`/sales-orders/${props.orderId}`)"
                class="w-full py-3 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-border rounded-xl hover:bg-gray-50 dark:hover:bg-muted transition"
              >
                Cancelar
              </button>
            </div>

            <!-- Normal Mode: ActionButtons -->
            <ActionButtons
                v-else
                :hasOpenSession="isSessionOpen"
              :canPay="canCheckout"
                :isQuoteSession="isQuoteSession"
                :quoteMode="props.quoteMode"
                @clear="clearCart"
                @save-draft="handleSaveDraft"
                @save-quote="handleSaveQuote"
                @save-quote-changes="handleSaveQuoteChanges"
                @open-cash-register="forceShowOpenSessionModal = true"
                @open-payment-modal="openPaymentModal('cash')"
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
      :total-count="totalProducts"
      :has-more="hasNextPage"
      :loading-more="productsLoading"
      @close="showProductsModal = false"
      @add-products="addSelectedProducts"
      @load-more="loadMoreProducts"
    />

    <!-- ========== Payment Modal (hidden in quoteMode) ========== -->
    <div
      v-if="!props.quoteMode && showPaymentModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-border flex items-center justify-between shrink-0">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ props.editMode ? 'Cobrar diferencia' : 'Procesar Pago' }}</h2>
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
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ props.editMode ? 'Diferencia a cobrar' : 'Total a cobrar' }}</p>
            <p class="text-3xl font-bold text-indigo-600 dark:text-primary dark:text-indigo-400">{{ formatCurrency(amountToCharge) }}</p>
            <p v-if="!props.editMode && shippingCost > 0" class="text-xs text-gray-500 dark:text-gray-400 mt-1">(incl. Envío: {{ formatCurrency(shippingCost) }})</p>
          </div>

          <!-- Store Credit (Saldo a Favor) -->
          <div v-if="selectedCustomer?.has_store_credit && (selectedCustomer?.store_credit ?? 0) > 0" class="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
            <div class="flex items-center gap-2 mb-2">
              <Gift class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Saldo a Favor Disponible</span>
              <span class="ml-auto text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatCurrency(selectedCustomer.store_credit) }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <label class="text-sm text-emerald-700 dark:text-emerald-300">Aplicar:</label>
              <div class="relative flex-1">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500 text-sm">$</span>
                <input
                  v-model.number="storeCreditToApply"
                  type="number"
                  step="0.01"
                  min="0"
                  :max="Math.min(selectedCustomer.store_credit ?? 0, amountToCharge)"
                  class="w-full pl-7 pr-3 py-2 text-right border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                @click="storeCreditToApply = Math.min(selectedCustomer?.store_credit ?? 0, amountToCharge)"
                class="px-3 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Usar todo
              </button>
            </div>
          </div>

          <!-- Credit (Crédito a Plazo) - Mostrado como información, no editable -->
          <div v-if="selectedCustomer && pendingAmount > 0" class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <div class="flex items-center gap-2 mb-3">
              <CreditCard class="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span class="text-sm font-semibold text-amber-700 dark:text-amber-300">Crédito del Cliente</span>
            </div>

            <div class="grid grid-cols-2 gap-2 mb-3 text-xs text-amber-700 dark:text-amber-300">
              <div>
                <span class="font-medium">Límite:</span>
                <span class="ml-1">{{ formatCurrency(selectedCustomer.credit_limit ?? 0) }}</span>
              </div>
              <div>
                <span class="font-medium">Días crédito:</span>
                <span class="ml-1">{{ selectedCustomer.credit_days ?? 0 }}</span>
              </div>
              <div>
                <span class="font-medium">Deuda actual:</span>
                <span class="ml-1">{{ formatCurrency(Math.max(0, selectedCustomer.current_balance ?? 0)) }}</span>
              </div>
              <div>
                <span class="font-medium">Disponible:</span>
                <span class="ml-1 font-bold">{{ formatCurrency(creditAvailable) }}</span>
              </div>
            </div>

            <!-- Monto pendiente que se cargará a crédito -->
            <div v-if="creditToCharge > 0" class="bg-amber-100 dark:bg-amber-900/40 rounded-lg p-3 text-center">
              <p class="text-xs text-amber-600 dark:text-amber-400 mb-1">Se cargará a cuenta del cliente:</p>
              <p class="text-2xl font-bold text-amber-700 dark:text-amber-300">{{ formatCurrency(creditToCharge) }}</p>
            </div>

            <!-- Advertencia si el crédito disponible no cubre el pendiente -->
            <div v-if="uncoveredAmount > 0" class="mt-2 bg-red-100 dark:bg-red-900/30 rounded-lg p-2 text-center">
              <p class="text-xs text-red-600 dark:text-red-400">
                <AlertTriangle class="w-3 h-3 inline mr-1" />
                Crédito insuficiente. Faltan: {{ formatCurrency(uncoveredAmount) }}
              </p>
            </div>
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
            <div class="space-y-2">
              <!-- Total recibido -->
              <div v-if="totalReceived > 0" class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm text-blue-700 dark:text-blue-400 font-medium">Pago recibido:</span>
                <span class="text-lg font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(totalReceived) }}</span>
              </div>

              <!-- Crédito a cargar -->
              <div v-if="creditToCharge > 0" class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm text-amber-700 dark:text-amber-400 font-medium">A crédito:</span>
                <span class="text-lg font-bold text-amber-600 dark:text-amber-400">{{ formatCurrency(creditToCharge) }}</span>
              </div>

              <!-- Cambio a entregar -->
              <div v-if="localChange > 0" class="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm text-green-700 dark:text-green-400 font-medium">Cambio a Entregar:</span>
                <span class="text-2xl font-bold text-green-600 dark:text-green-400">{{ formatCurrency(localChange) }}</span>
              </div>

              <!-- Falta por cobrar (sin cubrir por crédito) -->
              <div v-else-if="uncoveredAmount > 0" class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 flex items-center justify-between text-red-600 dark:text-red-400">
                <span class="text-sm font-medium"><AlertTriangle class="w-4 h-4 inline mr-1" /> Faltan por cobrar:</span>
                <span class="text-xl font-bold">{{ formatCurrency(uncoveredAmount) }}</span>
              </div>

              <!-- Pago completo -->
              <div v-else-if="pendingAmount <= 0 || (pendingAmount > 0 && creditToCharge >= pendingAmount)" class="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center text-sm text-indigo-600 dark:text-primary dark:text-indigo-400 font-medium">
                {{ creditToCharge > 0 ? '✓ Cubierto (pago + crédito)' : '✓ Pago Completo' }}
              </div>
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
            :disabled="loading || uncoveredAmount > 0"
            class="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 shadow-sm bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90"
          >
            {{ loading || editLoading ? 'Procesando...' : (props.editMode ? '✓ Confirmar cambios' : '✓ Confirmar Venta') }}
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

    <!-- ========== Product Detail Modal (right-click on cart item) ========== -->
    <ProductDetailModal
        v-if="selectedProductForModal"
        :product="selectedProductForModal"
        @close="selectedProductForModal = null"
        @view-alternative="(p: any) => selectedProductForModal = p"
    />

    <!-- ========== Quick Customer Modal ========== -->
    <QuickCustomerModal
        :show="showQuickCustomerModal"
        @update:show="showQuickCustomerModal = $event"
        @created="handleCustomerCreated"
    />

  </div>
</template>
