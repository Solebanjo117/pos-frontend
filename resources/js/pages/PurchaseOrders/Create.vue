<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { useSuppliers } from '@/composables/useSuppliers'
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-vue-next'
import type { CreatePurchaseOrderData } from '@/types/purchase-order'
import apiClient from '@/services/api/client'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'

const props = defineProps<{ purchaseOrderId?: number }>()

const { loading, error, createPurchaseOrder, updatePurchaseOrder, fetchPurchaseOrderById, purchaseOrder } = usePurchaseOrders()
const { fetchActiveSuppliers } = useSuppliers()

const isEditing = computed(() => !!props.purchaseOrderId)

const suppliers = ref<any[]>([])
const warehouses = ref<any[]>([])
const productSearch = ref('')
const searchResults = ref<any[]>([])
const searchingProducts = ref(false)

const form = ref<CreatePurchaseOrderData>({
    supplier_id: 0,
    warehouse_id: 0,
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    tax_amount: 0,
    shipping_cost: 0,
    notes: '',
    items: [],
})

const subtotal = computed(() => form.value.items.reduce((sum, item: any) => sum + (item.quantity_ordered * (item.units_per_package ?? 1) * item.unit_cost), 0))
const total = computed(() => subtotal.value + (form.value.tax_amount || 0) + (form.value.shipping_cost || 0))

const supplierOptions = computed<SelectOption[]>(() => [
    { value: 0, label: 'Selecciona un proveedor' },
    ...suppliers.value.map((s) => ({ value: s.id, label: s.name })),
])

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: 0, label: 'Selecciona un almacén' },
    ...warehouses.value.map((w) => ({ value: w.id, label: w.name })),
])

async function searchProducts() {
    if (productSearch.value.length < 2) { searchResults.value = []; return }
    searchingProducts.value = true
    try {
        const { data } = await apiClient.get('/products', { params: { search: productSearch.value, per_page: 20, with_variants: true } })
        const products: any[] = data.data || []
        const query = productSearch.value.toLowerCase()

        // Flatten products → variants, one entry per variant
        // Then keep only variants whose own fields match the search term
        const variantRows: any[] = []
        for (const product of products) {
            const variants = product.variants?.length ? product.variants : (product.default_variant ? [product.default_variant] : [])
            for (const variant of variants) {
                const brandName = variant.brand?.name || product.brand?.name || ''
                const sku = variant.sku || product.sku || ''

                // Only include this variant if it directly matches the query
                const matches =
                    product.name.toLowerCase().includes(query) ||
                    sku.toLowerCase().includes(query) ||
                    brandName.toLowerCase().includes(query)

                if (!matches) continue

                variantRows.push({
                    variant_id: variant.id,
                    product_id: product.id,
                    product_name: product.name,
                    sku,
                    brand_name: brandName,
                    cost: variant.pricing?.cost ?? product.pricing?.cost ?? 0,
                })
            }
        }
        searchResults.value = variantRows
    } catch (e) {
        searchResults.value = []
    } finally {
        searchingProducts.value = false
    }
}

function addProduct(row: any) {
    // row is already a flat variant object from searchResults
    if (form.value.items.find((i: any) => i.variant_id === row.variant_id)) return

    form.value.items.push({
        product_id: row.product_id,
        variant_id: row.variant_id,
        quantity_ordered: 1,
        units_per_package: 1,
        unit_cost: row.cost || 0,
        notes: '',
        // Extra display fields (not sent to API)
        _name: row.product_name,
        _sku: row.sku,
        _brand: row.brand_name,
    } as any)
    productSearch.value = ''
    searchResults.value = []
}

function removeItem(index: number) {
    form.value.items.splice(index, 1)
}

async function handleSubmit() {
    if (!form.value.supplier_id || !form.value.warehouse_id) {
        alert('Selecciona proveedor y almacén')
        return
    }

    if (form.value.items.length === 0) {
        alert('Agrega al menos un producto')
        return
    }
    try {
        const payload = {
            ...form.value,
            items: form.value.items.map((item: any) => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity_ordered: item.quantity_ordered,
                units_per_package: item.units_per_package || 1,
                unit_cost: item.unit_cost,
                notes: item.notes || ''
            })),
        }
        
        if (isEditing.value && props.purchaseOrderId) {
            const updated = await updatePurchaseOrder(props.purchaseOrderId, payload)
            router.visit(`/purchase-orders/${updated.id}`)
        } else {
            const created = await createPurchaseOrder(payload)
            router.visit(`/purchase-orders/${created.id}`)
        }
    } catch (e) {}
}

onMounted(async () => {
    // Load suppliers and warehouses
    suppliers.value = await fetchActiveSuppliers()
    try {
        const { data } = await apiClient.get('/warehouses')
        warehouses.value = data.data || data || []
        
        // Auto-select warehouse from localStorage if available
        const savedWarehouse = localStorage.getItem('selected_warehouse_id')
        if (savedWarehouse && !isEditing.value) {
            form.value.warehouse_id = parseInt(savedWarehouse)
        }
    } catch (e) {
        console.error('Error loading warehouses', e)
    }

    // If editing, load existing purchase order
    if (isEditing.value && props.purchaseOrderId) {
        await fetchPurchaseOrderById(props.purchaseOrderId)
        
        if (purchaseOrder.value) {
            // Populate form with existing data
            form.value = {
                supplier_id: purchaseOrder.value.supplier_id,
                warehouse_id: purchaseOrder.value.warehouse_id,
                order_date: purchaseOrder.value.order_date,
                expected_date: purchaseOrder.value.expected_date || '',
                tax_amount: Number(purchaseOrder.value.tax_amount) || 0,
                shipping_cost: Number(purchaseOrder.value.shipping_cost) || 0,
                notes: purchaseOrder.value.notes || '',
                items: purchaseOrder.value.items.map((item: any) => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity_ordered: item.quantity_ordered,
                    units_per_package: item.units_per_package || 1,
                    unit_cost: Number(item.unit_cost),
                    notes: item.notes || '',
                    // Extra display fields
                    _name: item.variant?.product?.name || item.product?.name || 'Producto',
                    _sku: item.variant?.sku || item.product?.sku || 'N/A',
                    _brand: item.variant?.brand?.name || '',
                })),
            }
        }
    }
})
</script>

<template>
    <Head :title="isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'" />
    <AppLayout>
        <div class="max-w-4xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex items-center gap-4">
                <Link href="/purchase-orders" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                    <ArrowLeft :size="24" />
                </Link>
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                        {{ isEditing ? `Editar Orden ${purchaseOrder?.po_number || ''}` : 'Nueva Orden de Compra' }}
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ isEditing ? 'Modifica los detalles de la orden de compra' : 'Crea un pedido para reabastecer inventario' }}
                    </p>
                </div>
            </div>

            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <form @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-6">
                <!-- Order Info -->
                <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información del Pedido</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor *</label>
                            <SearchableSelect
                                v-model="form.supplier_id"
                                :options="supplierOptions"
                                placeholder="Selecciona un proveedor"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Almacén destino *</label>
                            <SearchableSelect
                                v-model="form.warehouse_id"
                                :options="warehouseOptions"
                                placeholder="Selecciona un almacén"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha del Pedido</label>
                            <input v-model="form.order_date" type="date" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Esperada</label>
                            <input v-model="form.expected_date" type="date" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" />
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                            <textarea v-model="form.notes" rows="2" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"></textarea>
                        </div>
                    </div>
                </div>

                <!-- Products -->
                <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Productos</h2>

                    <!-- Product Search -->
                    <div class="relative mb-4">
                        <div class="relative">
                            <Search class="absolute left-3 top-2.5 text-gray-400" :size="18" />
                            <input
                                v-model="productSearch"
                                type="text"
                                placeholder="Buscar producto por nombre o SKU..."
                                class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
                                @input="searchProducts"
                            />
                        </div>
                        <!-- Search Results Dropdown -->
                        <div v-if="searchResults.length" class="absolute z-10 w-full mt-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                            <button
                                v-for="row in searchResults" :key="row.variant_id"
                                type="button"
                                @click="addProduct(row)"
                                class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-muted/50 flex items-center justify-between border-b border-gray-100 dark:border-border last:border-0"
                            >
                                <div class="min-w-0">
                                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ row.product_name }}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">
                                        <span v-if="row.brand_name" class="font-semibold text-indigo-600 dark:text-primary dark:text-indigo-400 mr-1.5">{{ row.brand_name }}</span>
                                        <span class="font-mono">{{ row.sku }}</span>
                                    </p>
                                </div>
                                <span class="text-sm font-medium text-gray-600 dark:text-gray-300 ml-4 shrink-0">${{ Number(row.cost).toFixed(2) }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Items Table -->
                    <div v-if="form.items.length" class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                            <thead class="bg-gray-50 dark:bg-background">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paquetes</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" title="Unidades por paquete">Und/Paq</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Und.</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Costo Unit.</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                                    <th class="px-4 py-2"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-border">
                                <tr v-for="(item, idx) in form.items" :key="idx">
                                    <td class="px-4 py-2">
                                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ (item as any)._name }}</p>
                                        <p class="text-xs text-gray-500">
                                            <span v-if="(item as any)._brand" class="font-medium text-indigo-600 dark:text-primary dark:text-indigo-400 mr-1">{{ (item as any)._brand }}</span>
                                            {{ (item as any)._sku }}
                                        </p>
                                    </td>
                                    <td class="px-4 py-2">
                                        <input v-model.number="item.quantity_ordered" type="number" min="1" class="w-20 text-right px-2 py-1 border border-gray-300 dark:border-border rounded bg-white dark:bg-muted text-gray-900 dark:text-white" />
                                    </td>
                                    <td class="px-4 py-2">
                                        <input v-model.number="(item as any).units_per_package" type="number" min="1" title="Unidades por paquete" class="w-16 text-right px-2 py-1 border border-gray-300 dark:border-border rounded bg-white dark:bg-muted text-gray-900 dark:text-white" />
                                    </td>
                                    <td class="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-300 font-medium">
                                        {{ item.quantity_ordered * ((item as any).units_per_package || 1) }}
                                    </td>
                                    <td class="px-4 py-2">
                                        <input v-model.number="item.unit_cost" type="number" min="0" step="0.01" class="w-24 text-right px-2 py-1 border border-gray-300 dark:border-border rounded bg-white dark:bg-muted text-gray-900 dark:text-white" />
                                    </td>
                                    <td class="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        ${{ (item.quantity_ordered * ((item as any).units_per_package || 1) * item.unit_cost).toFixed(2) }}
                                    </td>
                                    <td class="px-4 py-2 text-right">
                                        <button type="button" @click="removeItem(idx)" class="p-1 text-gray-400 hover:text-red-600 transition">
                                            <Trash2 :size="16" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="text-center py-8 text-gray-400">
                        <Package class="mx-auto mb-2" :size="36" />
                        <p class="text-sm">Busca y agrega productos al pedido</p>
                    </div>
                </div>

                <!-- Totals & Submit -->
                <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Impuestos</label>
                            <input v-model.number="form.tax_amount" type="number" min="0" step="0.01" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Envío</label>
                            <input v-model.number="form.shipping_cost" type="number" min="0" step="0.01" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" />
                        </div>
                        <div class="flex flex-col items-end justify-end">
                            <p class="text-sm text-gray-500 dark:text-gray-400">Subtotal: ${{ subtotal.toFixed(2) }}</p>
                            <p class="text-xl font-bold text-gray-900 dark:text-white">Total: ${{ total.toFixed(2) }}</p>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-border">
                        <Link href="/purchase-orders" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted/50 rounded-lg transition">
                            Cancelar
                        </Link>
                        <button type="submit" :disabled="loading || form.items.length === 0" class="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg transition">
                            <Save :size="18" />
                            {{ loading ? (isEditing ? 'Actualizando...' : 'Creando...') : (isEditing ? 'Actualizar Orden' : 'Crear Orden de Compra') }}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
