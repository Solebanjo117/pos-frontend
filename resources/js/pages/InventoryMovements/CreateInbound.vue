<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { PackagePlus, Trash2, Plus, Copy } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductCombobox from '@/components/ProductCombobox.vue'
import { type BreadcrumbItem } from '@/types'
import { useInventoryMovements } from '@/composables/useInventoryMovements'
import { useProducts } from '@/composables/useProducts'
import { useWarehouses } from '@/composables/useWarehouses'
import { usePosSettings } from '@/composables/usePosSettings'
import { useSuppliers } from '@/composables/useSuppliers'

interface InboundItem {
    id: string // Temp ID for list management
    product_id: number | null
    variant_id: number | null // Added
    batch_number: string
    cost: number | null
    tax_rate: number
    final_cost: number | null // Computed for display/logic
    quantity: number
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Movimientos', href: '/inventory-movements' },
    { title: 'Nueva Entrada Masiva', href: '/inventory-movements/inbound/create' },
]

const { recordBulkInbound, loading, error } = useInventoryMovements()
const { products, fetchProducts } = useProducts()
const { warehouses, fetchWarehouses } = useWarehouses()
const { isSingleWarehouseMode, getDefaultWarehouseId, currentWarehouseId, initWarehouse } = usePosSettings()
const { suppliers, fetchActiveSuppliers } = useSuppliers()

// Header State
const headerForm = ref({
    warehouse_id: null as number | null,
    supplier_id: null as number | null,
    reference_type: undefined as 'purchase' | 'adjustment' | 'return' | undefined,
    reference_id: null as number | null,
    notes: '',
})

// Batch Defaults
const batchDefaults = ref({
    batch_number: '',
    cost: null as number | null,
    tax_rate: 7, // Default 7% ITBMS
})

// Items List
const items = ref<InboundItem[]>([])

const formErrors = ref<Record<string, string>>({})
const successMessage = ref('')
const globalError = ref<string | null>(null)

// Computed
const showWarehouseSelect = computed(() => true)

onMounted(async () => {
    // Generate default batch number based on current timestamp
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    batchDefaults.value.batch_number = `LOTE-${year}${month}${day}-${hours}${minutes}`

    await Promise.all([
        fetchProducts(),
        fetchWarehouses(),
        fetchActiveSuppliers(),
    ])

    // Initialize Warehouse from backend (Priority: Backend Context > Default Setting > First Available)
    await initWarehouse()
    
    if (currentWarehouseId.value) {
        headerForm.value.warehouse_id = currentWarehouseId.value
    } else {
        const defaultId = getDefaultWarehouseId()
        if (defaultId) {
            headerForm.value.warehouse_id = defaultId
        } else if (warehouses.value.length > 0) {
            headerForm.value.warehouse_id = warehouses.value[0].id
        }
    }

    // Add initial empty row
    addItem()
})

const addItem = () => {
    items.value.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        product_id: null,
        variant_id: null, // Added
        batch_number: batchDefaults.value.batch_number,
        cost: batchDefaults.value.cost,
        tax_rate: batchDefaults.value.tax_rate,
        final_cost: batchDefaults.value.cost ? batchDefaults.value.cost * (1 + (batchDefaults.value.tax_rate / 100)) : null,
        quantity: 1,
    })
}

const removeItem = (index: number) => {
    if (items.value.length > 1) {
        items.value.splice(index, 1)
    }
}

// Logic to handle product section (and potentially auto-fill variant)
const handleProductSelect = (index: number, productId: number | null, variantId?: number | null) => {
    const item = items.value[index]
    item.product_id = productId
    item.variant_id = variantId || null

    // Helper to find product details
    const product = products.value.find(p => p.id === productId)
    
    // Auto-fill cost from variant or product default
    if (product) {
        let baseCost = null;
        let taxRate = product.pricing?.tax_rate || 7;

        if (variantId) {
            const variant = product.variants?.find(v => v.id === variantId)
            if (variant && variant.pricing?.cost) {
                baseCost = variant.pricing.cost
                taxRate = variant.pricing.tax_rate ?? taxRate;
            }
        } else if (product.default_variant?.pricing?.cost) {
            baseCost = product.default_variant.pricing.cost
            taxRate = product.default_variant.pricing.tax_rate ?? taxRate;
        }

        item.cost = baseCost;
        item.tax_rate = taxRate;
        if (item.cost !== null) {
            item.final_cost = Number((item.cost * (1 + (item.tax_rate / 100))).toFixed(2))
        } else {
            item.final_cost = null;
        }
    }

    // If it's the last item and a product is selected, add a new row
    if (index === items.value.length - 1 && productId !== null) {
        nextTick(() => {
            addItem()
        })
    }
}

const applyDefaultsToAll = () => {
    items.value.forEach(item => {
        if (batchDefaults.value.batch_number) item.batch_number = batchDefaults.value.batch_number
        if (batchDefaults.value.cost !== null) item.cost = batchDefaults.value.cost
        item.tax_rate = batchDefaults.value.tax_rate
        handlePriceChange(item, 'cost')
    })
}

// 3-way calculator logic (Price + Tax + Quantity)
const handlePriceChange = (item: InboundItem, field: 'cost' | 'tax_rate' | 'final_cost' | 'quantity') => {
    const qty = item.quantity || 1

    if (field === 'cost' || field === 'tax_rate' || field === 'quantity') {
        if (item.cost !== null && item.cost !== undefined) {
            // final_cost = (cost * (1 + tax_rate / 100)) * quantity
            const unitCostWithTax = item.cost * (1 + (item.tax_rate / 100))
            item.final_cost = Number((unitCostWithTax * qty).toFixed(2))
        } else {
            item.final_cost = null
        }
    } else if (field === 'final_cost') {
        // user inputs total cost, reverse calculate unit cost: cost = (final_cost / quantity) / (1 + tax_rate / 100)
        if (item.final_cost !== null && item.final_cost !== undefined && item.tax_rate !== null && qty > 0) {
            const unitCostWithTax = item.final_cost / qty
            item.cost = Number((unitCostWithTax / (1 + (item.tax_rate / 100))).toFixed(2))
        } else {
            item.cost = null
        }
    }
}

const refreshVariants = async (index: number) => {
    const item = items.value[index]
    if (!item.product_id) return
    const prevProduct = item.product_id
    await fetchProducts() // Re-fetch products from API
    handleProductSelect(index, prevProduct) // Re-trigger selection to refresh UI
}

const getProductDetails = (productId: number | null) => {
    if (!productId) return null
    return products.value.find(p => p.id === productId)
}

const validateForm = () => {
    formErrors.value = {}
    globalError.value = null
    let isValid = true

    if (!headerForm.value.warehouse_id) {
        formErrors.value.warehouse_id = 'El almacén es obligatorio'
        isValid = false
    }

    // Filter out the last empty row if it has no product
    const validItems = items.value.filter(item => item.product_id !== null)

    if (validItems.length === 0) {
        globalError.value = 'Debe agregar al menos un producto valido'
        return false
    }

    validItems.forEach((item, index) => {
        if (!item.quantity || item.quantity < 1) {
            formErrors.value[`item_${item.id}_quantity`] = 'Cantidad inválida'
            isValid = false
        }
        
        const product = getProductDetails(item.product_id)
        if (product && product.batch_tracking) {
             if (!item.batch_number) {
                 formErrors.value[`item_${item.id}_batch`] = 'Lote requerido'
                 isValid = false
             }
        }
    })

    return isValid
}

const handleSubmit = async () => {
    if (!validateForm()) return

    try {
        const validItems = items.value.filter(item => item.product_id !== null)
        
        const payload = {
            items: validItems.map(item => ({
                product_id: item.product_id!,
                variant_id: item.variant_id || undefined,
                warehouse_id: headerForm.value.warehouse_id!,
                quantity: item.quantity,
                reference_type: headerForm.value.reference_type,
                reference_id: headerForm.value.reference_id || undefined,
                notes: headerForm.value.notes || undefined,
                batch_number: item.batch_number || undefined,
                cost: item.cost || undefined,
                supplier_id: headerForm.value.supplier_id || undefined,
            }))
        }

        await recordBulkInbound(payload)

        successMessage.value = 'Entrada masiva registrada exitosamente'
        setTimeout(() => {
            router.visit('/inventory-movements')
        }, 1500)
    } catch (err) {
        // Error handled in composable
         globalError.value = error.value || 'Error desconocido'
    }
}

const cancel = () => {
    router.visit('/inventory-movements')
}
</script>

<template>
    <Head title="Nueva Entrada Masiva" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <div class="mx-auto max-w-7xl">
                <!-- Header -->
                <div class="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
                            <PackagePlus :size="32" />
                            Entrada de Inventario (Por Lotes)
                        </h1>
                        <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                            Registra entradas de múltiples productos y lotes simultáneamente (Multialmacén)
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            @click="cancel"
                            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            @click="handleSubmit"
                            :disabled="loading"
                            class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50"
                        >
                            {{ loading ? 'Procesando...' : 'Confirmar Entrada' }}
                        </button>
                    </div>
                </div>

                <!-- Messages -->
                <div v-if="successMessage" class="mb-4 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {{ successMessage }}
                </div>
                <div v-if="error || globalError" class="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                    {{ error || globalError }}
                </div>

                <!-- Main Grid -->
                <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
                    <!-- Sidebar: Config & Defaults -->
                    <div class="lg:col-span-1 space-y-6">
                        <!-- General Info -->
                        <div class="rounded-lg bg-white p-4 shadow dark:bg-card">
                            <h2 class="mb-4 font-semibold text-gray-900 dark:text-white">Información General</h2>
                            <div class="space-y-4">
                                <div v-if="showWarehouseSelect">
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">Almacén Destino</label>
                                    <select
                                        v-model="headerForm.warehouse_id"
                                        class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    >
                                        <option :value="null">Seleccionar...</option>
                                        <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                                    </select>
                                    <p v-if="formErrors.warehouse_id" class="text-xs text-red-600">{{ formErrors.warehouse_id }}</p>
                                </div>

                                <div>
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">Tipo Referencia</label>
                                    <select
                                        v-model="headerForm.reference_type"
                                        class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    >
                                        <option :value="undefined">Ninguna</option>
                                        <option value="purchase">Compra (PO)</option>
                                        <option value="adjustment">Ajuste</option>
                                        <option value="return">Devolución</option>
                                    </select>
                                </div>

                                <div v-if="headerForm.reference_type">
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">ID Referencia</label>
                                    <input
                                        v-model.number="headerForm.reference_id"
                                        type="number"
                                        class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    />
                                </div>

                                <div>
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">Proveedor</label>
                                    <select
                                        v-model="headerForm.supplier_id"
                                        class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    >
                                        <option :value="null">Sin proveedor</option>
                                        <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">Notas Globales</label>
                                    <textarea
                                        v-model="headerForm.notes"
                                        rows="2"
                                        class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Batch Defaults -->
                        <div class="rounded-lg bg-blue-50 p-4 shadow dark:bg-card border border-blue-100 dark:border-border">
                            <div class="flex items-center justify-between mb-4">
                                <h2 class="font-semibold text-blue-900 dark:text-blue-100">Valores por Defecto</h2>
                                <button
                                    @click="applyDefaultsToAll"
                                    type="button"
                                    title="Aplicar a todas las filas existentes"
                                    class="text-blue-600 dark:text-primary hover:text-blue-800 dark:text-blue-400"
                                >
                                    <Copy :size="16" />
                                </button>
                            </div>
                            <p class="text-xs text-blue-700 dark:text-blue-300 mb-4">
                                Estos valores se aplicarán automáticamente a las nuevas filas que agregues.
                            </p>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-xs font-medium text-blue-900 dark:text-blue-200">Lote / Batch</label>
                                    <input
                                        v-model="batchDefaults.batch_number"
                                        type="text"
                                        class="mt-1 w-full rounded-md border-blue-200 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                        placeholder="Ej: LOTE-ABC"
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-blue-900 dark:text-blue-200">% ITBM</label>
                                    <input
                                        v-model.number="batchDefaults.tax_rate"
                                        type="number"
                                        step="0.01"
                                        class="mt-1 w-full rounded-md border-blue-200 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-blue-900 dark:text-blue-200">Costo Base</label>
                                    <input
                                        v-model.number="batchDefaults.cost"
                                        type="number"
                                        step="0.01"
                                        class="mt-1 w-full rounded-md border-blue-200 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Items List -->
                    <div class="lg:col-span-3">
                        <div class="rounded-lg bg-white p-4 shadow dark:bg-card min-h-[500px] flex flex-col">
                            <div class="mb-4 flex items-center justify-between">
                                <h2 class="font-semibold text-gray-900 dark:text-white">Items de Entrada ({{ items.length }})</h2>
                                <button
                                    @click="addItem"
                                    type="button"
                                    class="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-primary hover:text-blue-800 dark:text-blue-400"
                                >
                                    <Plus :size="16" /> Agregar Item
                                </button>
                            </div>

                            <div class="flex-1 overflow-auto">
                                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                                    <thead class="bg-gray-50 dark:bg-muted">
                                        <tr>
                                            <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 w-1/4">Producto Base</th>
                                            <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 w-1/4">Variante/Marca</th>
                                            <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 w-32">Lote</th>
                                            <th scope="col" class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 w-24">Cant.</th>
                                            <th scope="col" class="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 min-w-[300px]">Adquisición (Costo / IDMBS / Final)</th>
                                            <th scope="col" class="relative px-3 py-3 w-10"><span class="sr-only">Acciones</span></th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                                        <tr v-for="(item, index) in items" :key="item.id">
                                            <td class="px-3 py-4 align-top">
                                                <ProductCombobox
                                                    v-model="item.product_id"
                                                    :hide-variants="true"
                                                    :products="products"
                                                    placeholder="Buscar carpeta base..."
                                                    :error="formErrors[`item_${item.id}_product`]"
                                                    @selected="(prod) => handleProductSelect(index, prod.id, null)"
                                                />
                                                <div v-if="item.product_id" class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                                    Padre: {{ getProductDetails(item.product_id)?.sku_base }}
                                                </div>
                                            </td>
                                            <td class="px-3 py-4 align-top">
                                                <div v-if="item.product_id" class="flex flex-col gap-1">
                                                    <div class="flex items-center gap-1">
                                                        <select
                                                            v-model="item.variant_id"
                                                            @change="handleProductSelect(index, item.product_id, item.variant_id)"
                                                            class="w-full rounded-md border-gray-300 py-1.5 shadow-sm text-sm dark:border-border dark:bg-muted"
                                                        >
                                                            <option :value="null">Genérico / Default</option>
                                                            <option v-for="v in getProductDetails(item.product_id)?.variants || []" :key="v.id" :value="v.id">
                                                                {{ v.sku }} {{ v.brand ? '- ' + v.brand.name : '' }}
                                                            </option>
                                                        </select>
                                                        <button 
                                                            @click="refreshVariants(index)" 
                                                            title="Refrescar variantes" 
                                                            class="p-1.5 text-blue-600 dark:text-primary hover:bg-blue-50 rounded-md dark:text-blue-400 dark:hover:bg-muted/50"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                                        </button>
                                                    </div>
                                                    <a :href="`/products/${item.product_id}/edit`" target="_blank" class="text-xs text-blue-600 dark:text-primary hover:underline dark:text-blue-400 mt-1 flex items-center gap-1">
                                                        + Añadir variante
                                                    </a>
                                                </div>
                                                <div v-else class="text-xs text-gray-400 italic py-2">Solo disponible al elegir base</div>
                                            </td>
                                            <td class="px-3 py-4 align-top">
                                                <input
                                                    v-model="item.batch_number"
                                                    type="text"
                                                    placeholder="Nº Lote"
                                                    class="w-full text-sm rounded-md border-gray-300 py-1.5 shadow-sm dark:border-border dark:bg-muted"
                                                    :class="{ 'border-red-500': formErrors[`item_${item.id}_batch`] }"
                                                />
                                            </td>
                                            <td class="px-3 py-4 align-top">
                                                <input
                                                    v-model.number="item.quantity"
                                                    @input="handlePriceChange(item, 'quantity')"
                                                    type="number"
                                                    min="1"
                                                    class="w-full text-sm rounded-md border-gray-300 text-center shadow-sm py-1.5 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                                    :class="{ 'border-red-500': formErrors[`item_${item.id}_quantity`] }"
                                                />
                                            </td>
                                            <td class="px-3 py-4 align-top">
                                                <div class="flex items-start gap-2">
                                                    <div class="flex-1">
                                                        <input
                                                            v-model.number="item.cost"
                                                            @input="handlePriceChange(item, 'cost')"
                                                            type="number"
                                                            step="0.01"
                                                            class="w-full text-sm rounded-md border-gray-300 text-right shadow-sm py-1.5 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted"
                                                            placeholder="Neto"
                                                        />
                                                    </div>
                                                    <div class="w-16">
                                                        <label class="sr-only">ITBM</label>
                                                        <input
                                                            v-model.number="item.tax_rate"
                                                            @input="handlePriceChange(item, 'tax_rate')"
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="%"
                                                            class="w-full text-xs rounded-md border-gray-300 shadow-sm py-1 dark:bg-muted dark:border-border"
                                                        />
                                                    </div>
                                                    <div class="flex-1 border-l pl-2 dark:border-border">
                                                        <input
                                                            v-model.number="item.final_cost"
                                                            @input="handlePriceChange(item, 'final_cost')"
                                                            type="number"
                                                            step="0.01"
                                                            class="w-full text-sm rounded-md border-gray-300 text-right shadow-sm py-1.5 focus:border-green-500 focus:ring-green-500 dark:border-border dark:bg-muted font-semibold text-green-700 dark:text-green-400"
                                                            placeholder="Total"
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="px-3 py-4 align-top text-center">
                                                <button
                                                    @click="removeItem(index)"
                                                    type="button"
                                                    class="text-red-500 hover:text-red-700"
                                                    title="Eliminar fila"
                                                    :disabled="items.length === 1 && !item.product_id"
                                                    :class="{ 'opacity-50 cursor-not-allowed': items.length === 1 && !item.product_id }"
                                                >
                                                    <Trash2 :size="18" />
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="mt-4 border-t border-gray-200 pt-4 dark:border-border">
                                <div class="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                                    <span>Total Items: {{ items.length }}</span>
                                    <span>Total Cantidad: {{ items.reduce((acc, item) => acc + (item.quantity || 0), 0) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
