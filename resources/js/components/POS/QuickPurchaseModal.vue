<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  X,
  PackageCheck,
  Building2,
  DollarSign,
  ShoppingCart,
  List
} from 'lucide-vue-next'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import { useSuppliers } from '@/composables/useSuppliers'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { supplyListService } from '@/services/supply-list'
import { useToast } from '@/composables/useToast'
import type { Supplier } from '@/types/supplier'

// Reusing global store settings if needed, or simply pass props.
import { usePosSettings } from '@/composables/usePosSettings'

const props = withDefaults(defineProps<{
  isOpen: boolean
  product: any // We pass the selected product from the modal/table
  initialVariantId?: number | null // Pre-select variant from cart item
  // Whether to show the quick purchase (direct PO) action
  showQuickPurchaseAction?: boolean
}>(), {
  showQuickPurchaseAction: true,
})

const emit = defineEmits(['close', 'success'])

const { fetchActiveSuppliers } = useSuppliers()
const { quickReceivePurchaseOrder, loading: isSubmitting } = usePurchaseOrders()
const toast = useToast()
const { currentWarehouseId } = usePosSettings()

const suppliers = ref<Supplier[]>([])
const loadingSuppliers = ref(false)

// Form state
const selectedSupplierId = ref<number | ''>('')
const selectedVariantId = ref<number | ''>('')
const quantity = ref(1)
const unitCost = ref(0)

// Computed options for SearchableSelect
const supplierOptions = computed(() => {
  const opts = [{ value: '' as number | '', label: 'Sin proveedor asignado' }]
  if (suppliers.value) {
    opts.push(...suppliers.value.map(s => ({ value: s.id, label: s.name })))
  }
  return opts
})

// Load suppliers
const loadSuppliers = async () => {
  loadingSuppliers.value = true
  suppliers.value = await fetchActiveSuppliers()
  loadingSuppliers.value = false

  // Don't auto-select supplier - let user choose or leave empty for Supply List
  // Only pre-select if product has a single main supplier
  if (props.product?.suppliers?.length === 1) {
      selectedSupplierId.value = props.product.suppliers[0].id
  } else {
      selectedSupplierId.value = '' // Default: no supplier
  }
}

// Reset form
const resetForm = () => {
    quantity.value = 1

    // Pre-select variant: from prop > single variant > default variant
    if (props.initialVariantId) {
        selectedVariantId.value = props.initialVariantId
        // Get cost from the specific variant
        const variant = props.product?.variants?.find((v: any) => v.id === props.initialVariantId)
        unitCost.value = variant?.pricing?.cost || props.product?.pricing?.cost || props.product?.cost || 0
    } else if (props.product?.variants?.length === 1) {
        selectedVariantId.value = props.product.variants[0].id
        unitCost.value = props.product.variants[0]?.pricing?.cost || props.product?.pricing?.cost || props.product?.cost || 0
    } else if (props.product?.default_variant_id) {
        selectedVariantId.value = props.product.default_variant_id
        const variant = props.product?.variants?.find((v: any) => v.id === props.product.default_variant_id)
        unitCost.value = variant?.pricing?.cost || props.product?.pricing?.cost || props.product?.cost || 0
    } else {
        selectedVariantId.value = ''
        unitCost.value = props.product?.pricing?.cost || props.product?.cost || props.product?.variants?.[0]?.pricing?.cost || 0
    }
}

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    resetForm()
    // Always reload suppliers when modal opens to ensure fresh data
    await loadSuppliers()
  }
}, { immediate: true })

// Also watch for initialVariantId changes (for when modal is already mounted)
watch(() => props.initialVariantId, (newVal) => {
  if (props.isOpen && newVal) {
    selectedVariantId.value = newVal
    const variant = props.product?.variants?.find((v: any) => v.id === newVal)
    if (variant?.pricing?.cost) {
      unitCost.value = variant.pricing.cost
    }
  }
})

const handleClose = () => {
  if (isSubmitting.value) return
  emit('close')
}

// Add to Supply List (recommended flow)
const handleAddToSupplyList = async () => {
  if (quantity.value < 1) {
    return toast.error('La cantidad debe ser mayor a 0')
  }

  try {
    isSubmitting.value = true
    
    const result = await supplyListService.addItem({
      product_id: props.product.id,
      variant_id: selectedVariantId.value || null,
      supplier_id: selectedSupplierId.value || null,
      quantity_needed: quantity.value,
      notes: 'Agregado desde POS'
    })

    toast.success('Producto agregado a la Lista de Abastecimiento y stock actualizado')
    emit('success', { 
        productId: props.product.id,
        variantId: selectedVariantId.value,
      quantityAdded: result.stock_added,
        addedToSupplyList: true
    })
    
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Error al agregar a la lista')
  } finally {
    isSubmitting.value = false
  }
}

// Quick Purchase (direct PO - advanced flow)
const handleQuickPurchase = async () => {
  if (!selectedSupplierId.value || quantity.value < 1 || unitCost.value < 0) {
    return toast.error('Por favor verifica los datos ingresados (proveedor y costo requeridos)')
  }

  try {
    if (!currentWarehouseId.value) {
      return toast.error('No hay sucursal seleccionada. Verifica tu configuración.')
    }

    await quickReceivePurchaseOrder({
      supplier_id: selectedSupplierId.value,
      warehouse_id: currentWarehouseId.value,
      items: [
        {
          product_id: props.product.id,
          variant_id: selectedVariantId.value || null,
          quantity_ordered: quantity.value,
          unit_cost: unitCost.value,
          notes: 'Generado desde POS'
        }
      ]
    })

    toast.success('Stock abastecido exitosamente mediante compra rápida')
    emit('success', { 
        productId: props.product.id,
        variantId: selectedVariantId.value,
        quantityAdded: quantity.value,
    })
    
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Error al procesar abastecimiento rápido')
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

const totalCost = computed(() => quantity.value * unitCost.value)

</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[70] overflow-y-auto">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        @click="handleClose"
      ></div>

    <div class="flex min-h-screen items-center justify-center p-4">
      <!-- Modal Content -->
      <div 
        class="bg-white dark:bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 dark:border-border flex justify-between items-center bg-gray-50/50 dark:bg-muted/20">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <PackageCheck class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Abastecimiento</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">Agregar a lista o compra rápida</p>
            </div>
          </div>
          <button 
            @click="handleClose"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted rounded-full transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="px-6 py-5">
            <!-- Product Info -->
            <div class="mb-5 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-start gap-3">
                <ShoppingCart class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{{ product?.name || 'Producto Desconocido' }}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">SKU: {{ product?.sku_base || product?.sku || 'N/A' }} | Costo actual: {{ formatCurrency(product?.pricing?.cost || product?.cost || 0) }}</p>
                </div>
            </div>

            <div class="space-y-4">
                <!-- Supplier (optional for supply list) -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                        <Building2 class="w-4 h-4 text-gray-400" />
                        Proveedor <span class="text-xs text-gray-400">(opcional)</span>
                    </label>
                    <SearchableSelect
                        v-model="selectedSupplierId"
                        :options="supplierOptions"
                        :disabled="loadingSuppliers"
                        :loading="loadingSuppliers"
                        placeholder="Sin proveedor asignado"
                    />
                    <p class="text-xs text-gray-400 mt-1">Si no asignas proveedor, se creará una OC sin proveedor al convertir la lista</p>
                </div>

                <!-- Variant (Only show if multiple variants exist) -->
                <div v-if="product?.variants && product.variants.length > 0">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                        <PackageCheck class="w-4 h-4 text-gray-400" />
                        Variante a abastecer
                    </label>
                    <select
                        v-model="selectedVariantId"
                        class="w-full px-3 py-2.5 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white transition-shadow"
                    >
                        <option value="" disabled>Seleccione una variante...</option>
                        <option v-for="variant in product.variants" :key="variant.id" :value="variant.id">
                           {{ variant.sku || variant.sku_base }} - {{ variant.name || 'Variante' }}
                        </option>
                    </select>
                </div>

                <!-- Quantity (Cost optional for supply list) -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Cantidad
                        </label>
                        <input
                            v-model.number="quantity"
                            type="number"
                            min="1"
                            class="w-full px-3 py-2.5 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white transition-shadow"
                            placeholder="Ej. 10"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                            Costo <span class="text-xs text-gray-400">(opcional)</span>
                        </label>
                        <div class="relative">
                            <DollarSign class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                v-model.number="unitCost"
                                type="number"
                                min="0"
                                step="0.01"
                                class="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white transition-shadow"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                <!-- Total Reference (only if cost is provided) -->
                <div v-if="unitCost > 0" class="mt-4 flex justify-between items-center text-sm px-1">
                    <span class="text-gray-500 dark:text-gray-400">Total O.C. estimado:</span>
                    <span class="font-bold text-gray-900 dark:text-white text-lg">{{ formatCurrency(totalCost) }}</span>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 dark:border-border bg-gray-50/50 dark:bg-muted/20">
          <!-- Info text -->
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center">
            <strong>Recomendado:</strong> Agregar a lista y consolidar compras al final del día
          </p>
          
          <div class="flex flex-col sm:flex-row justify-end gap-2">
            <button
              @click="handleClose"
              :disabled="isSubmitting"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            
            <!-- Primary action: Add to Supply List -->
            <button
              @click="handleAddToSupplyList"
              :disabled="isSubmitting || quantity < 1 || (product?.variants?.length > 0 && !selectedVariantId)"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-primary dark:hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="isSubmitting" class="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <List v-else class="w-4 h-4" />
              Agregar a Lista
            </button>
            
            <!-- Secondary action: Quick Purchase (requires supplier and cost) - hidden when showQuickPurchaseAction is false -->
            <button
              v-if="showQuickPurchaseAction"
              @click="handleQuickPurchase"
              :disabled="isSubmitting || !selectedSupplierId || quantity < 1 || unitCost <= 0 || (product?.variants?.length > 0 && !selectedVariantId)"
              class="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Requiere proveedor y costo"
            >
              <svg v-if="isSubmitting" class="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <PackageCheck v-else class="w-4 h-4" />
              Compra Rápida
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>
