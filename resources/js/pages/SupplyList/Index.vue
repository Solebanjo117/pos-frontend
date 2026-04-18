<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import ProductSearchModal from '@/components/POS/ProductSearchModal.vue'
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue'
import ProductDetailModal from '@/components/Products/ProductDetailModal.vue'
import { supplyListService, type SupplyListItem } from '@/services/supply-list'
import { useProducts } from '@/composables/useProducts'
import { useSuppliers } from '@/composables/useSuppliers'
import { useToast } from '@/composables/useToast'
import { Trash2, ArrowRight, AlertTriangle, CheckCircle2, Save, Filter, X as XIcon, Download, TrendingDown, Search } from 'lucide-vue-next'
import { smartReorderService, type LowStockStats } from '@/services/smart-reorder'

// LL-001: AppLayout for all page-level components
defineOptions({ layout: AppLayout })

const toast = useToast()
const { fetchActiveSuppliers } = useSuppliers()
const { products: productList, fetchProducts, total: totalProducts, hasNextPage, loading: productsLoading, fetchMoreProducts } = useProducts()

const items = ref<SupplyListItem[]>([])
const suppliers = ref<any[]>([])
const loading = ref(false)
const converting = ref(false)
const importing = ref(false)
const error = ref<string | null>(null)
const conversionResult = ref<{ message: string; orders_created: any[] } | null>(null)
const savingItemId = ref<number | null>(null)
const lowStockStats = ref<LowStockStats | null>(null)

// Filters
const selectedSupplierFilter = ref<number | null>(null)

// POS-style search state
const searchQuery = ref('')
const showSearchModal = ref(false)
const showQuickPurchaseModal = ref(false)
const selectedProductForPurchase = ref<any>(null)
const selectedProductForDetail = ref<any>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const handleSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(async () => {
        if (searchQuery.value.length >= 2) {
            await fetchProducts({ search: searchQuery.value, per_page: 30 })
            showSearchModal.value = true
        }
    }, 300)
}

const handleSearchFocus = async () => {
    if (searchQuery.value.length >= 2) {
        await fetchProducts({ search: searchQuery.value, per_page: 30 })
        showSearchModal.value = true
    }
}

const handleProductSelected = (product: any) => {
    selectedProductForPurchase.value = product
    showSearchModal.value = false
    showQuickPurchaseModal.value = true
}

const handleQuickPurchaseSuccess = async () => {
    showQuickPurchaseModal.value = false
    selectedProductForPurchase.value = null
    searchQuery.value = ''
    await loadItems()
    toast.success('Producto agregado a la lista')
}

// Filtered items based on supplier filter
const filteredItems = computed(() => {
    if (selectedSupplierFilter.value === null) {
        return items.value
    }
    // null supplier filter shows items without supplier
    if (selectedSupplierFilter.value === 0) {
        return items.value.filter(i => !i.supplier_id)
    }
    return items.value.filter(i => i.supplier_id === selectedSupplierFilter.value)
})

const hasItemsWithoutSupplier = computed(() =>
    items.value.some(i => !i.supplier_id)
)

// Compute totals for footer (based on filtered items)
const totals = computed(() => {
    return {
        subtotal: filteredItems.value.reduce((sum, i) => sum + (i.subtotal || 0), 0),
        tax: filteredItems.value.reduce((sum, i) => sum + (i.tax_amount || 0), 0),
        total: filteredItems.value.reduce((sum, i) => sum + (i.total || 0), 0),
    }
})

// Supplier stats for filter display
const supplierStats = computed(() => {
    const stats = new Map<number | null, { name: string; count: number }>()
    
    items.value.forEach(item => {
        const supplierId = item.supplier_id || null
        const existing = stats.get(supplierId)
        
        if (existing) {
            existing.count++
        } else {
            stats.set(supplierId, {
                name: item.supplier?.name || 'Sin proveedor',
                count: 1
            })
        }
    })
    
    return Array.from(stats.entries()).map(([id, data]) => ({
        id: id === null ? 0 : id, // Use 0 for "no supplier"
        name: data.name,
        count: data.count
    }))
})

// Supplier options for SearchableSelect in table
const supplierOptions = computed(() => {
    const opts = [{ value: null as number | null, label: 'Sin proveedor' }]
    if (suppliers.value) {
        opts.push(...suppliers.value.map(s => ({ value: s.id, label: s.name })))
    }
    return opts
})

function normalizeTaxRate(value: unknown): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(100, Math.round(parsed)))
}

async function loadItems() {
    loading.value = true
    error.value = null
    try {
        const loadedItems = await supplyListService.getItems()
        items.value = loadedItems.map(item => ({
            ...item,
            tax_rate: normalizeTaxRate(item.tax_rate),
        }))
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al cargar la lista'
    } finally {
        loading.value = false
    }
}

async function handleUpdateItem(item: SupplyListItem) {
    savingItemId.value = item.id
    try {
        const normalizedTaxRate = normalizeTaxRate(item.tax_rate)
        item.tax_rate = normalizedTaxRate

        const updated = await supplyListService.updateItem(item.id, {
            supplier_id: item.supplier_id,
            quantity_needed: item.quantity_needed,
            unit_cost: item.unit_cost,
            tax_rate: normalizedTaxRate,
            sale_price: item.sale_price,
            notes: item.notes ?? undefined,
        })
        // Update local item with computed fields
        const idx = items.value.findIndex(i => i.id === item.id)
        if (idx !== -1) {
            items.value[idx] = { ...items.value[idx], ...updated }
        }
        toast.success('Guardado')
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al guardar')
    } finally {
        savingItemId.value = null
    }
}

async function handleRemove(id: number) {
    if (!confirm('¿Eliminar este ítem de la lista?')) return
    try {
        await supplyListService.removeItem(id)
        await loadItems()
        toast.success('Ítem eliminado')
    } catch (e) {
        toast.error('Error al eliminar')
    }
}

async function handleConvert() {
    const itemsToConvert = selectedSupplierFilter.value !== null ? filteredItems.value : items.value
    const supplierName = selectedSupplierFilter.value !== null 
        ? (supplierStats.value.find(s => s.id === selectedSupplierFilter.value)?.name || 'seleccionado')
        : 'todos los proveedores'
    
    if (itemsToConvert.length === 0) {
        return toast.error('No hay ítems para convertir')
    }
    
    if (!confirm(`¿Convertir ${itemsToConvert.length} ítems de ${supplierName} en órdenes de compra?`)) return
    
    converting.value = true
    conversionResult.value = null
    error.value = null
    try {
        // If filtering by supplier, send only those item IDs
        const result = selectedSupplierFilter.value !== null
            ? await supplyListService.convertFiltered(itemsToConvert.map(i => i.id))
            : await supplyListService.convert()
            
        conversionResult.value = result
        selectedSupplierFilter.value = null // Reset filter
        await loadItems()
        toast.success('Conversión completada')
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al convertir la lista'
    } finally {
        converting.value = false
    }
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(amount)
}

// Debounced auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedSave(item: SupplyListItem) {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => handleUpdateItem(item), 800)
}

// Import low stock products
async function handleImportLowStock() {
    if (importing.value) return
    
    importing.value = true
    error.value = null
    try {
        const result = await supplyListService.importLowStock()
        
        if (result.imported_count > 0) {
            toast.success(`${result.imported_count} producto(s) importado(s)`)
            await loadItems()
        } else if (result.skipped_count > 0) {
            toast.info(`Todos los productos ya están en la lista (${result.skipped_count} omitidos)`)
        } else {
            toast.info('No hay productos con stock bajo para importar')
        }
        
        // Refresh stats
        await loadLowStockStats()
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al importar productos'
        toast.error('Error al importar productos con stock bajo')
    } finally {
        importing.value = false
    }
}

// Load low stock stats
async function loadLowStockStats() {
    try {
        lowStockStats.value = await smartReorderService.getStats()
    } catch (e) {
        // Silently fail - stats are optional
    }
}

onMounted(async () => {
    suppliers.value = await fetchActiveSuppliers()
    // No longer loading all products upfront - search is now on-demand
    
    await Promise.all([
        loadItems(),
        loadLowStockStats()
    ])
})
</script>

<template>
    <Head title="Lista de Abastecimiento" />

    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between flex-wrap gap-4">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Lista de Abastecimiento</h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Busca productos para agregar, edita inline y convierte en Órdenes de Compra.
                </p>
            </div>
            <div class="flex items-center gap-3">
                <Link
                    href="/purchase-orders"
                    class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted/50 rounded-lg transition text-sm"
                >
                    Órdenes de Compra
                </Link>
                <button
                    @click="handleImportLowStock"
                    :disabled="importing"
                    class="inline-flex items-center gap-2 px-4 py-2 border border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                    :class="{ 'opacity-50 cursor-wait': importing }"
                >
                    <Download :size="18" :class="{ 'animate-bounce': importing }" />
                    {{ importing ? 'Importando...' : 'Importar Stock Bajo' }}
                    <span v-if="lowStockStats?.total_items" class="px-1.5 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                        {{ lowStockStats.total_items }}
                    </span>
                </button>
                <button
                    @click="handleConvert"
                    :disabled="filteredItems.length === 0 || converting"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition disabled:opacity-50"
                >
                    <ArrowRight :size="18" />
                    <span v-if="selectedSupplierFilter !== null">
                        {{ converting ? 'Convirtiendo...' : `Convertir ${filteredItems.length} ítem${filteredItems.length !== 1 ? 's' : ''}` }}
                    </span>
                    <span v-else>
                        {{ converting ? 'Convirtiendo...' : 'Convertir Todo' }}
                    </span>
                </button>
            </div>
        </div>

        <!-- Search Bar for adding products -->
        <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-4">
            <div class="flex items-center gap-4">
                <div class="relative flex-1 max-w-xl">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="20" />
                    <input
                        ref="searchInputRef"
                        v-model="searchQuery"
                        type="text"
                        placeholder="Buscar producto para agregar a la lista... (mínimo 2 caracteres)"
                        class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-primary transition-shadow"
                        @input="handleSearchInput"
                        @focus="handleSearchFocus"
                        @keydown.escape="searchQuery = ''"
                    />
                </div>
                <p class="text-xs text-gray-400">
                    💡 Escribe para buscar, haz clic en un producto para agregarlo
                </p>
            </div>
        </div>

        <!-- Low Stock Stats Card -->
        <div v-if="lowStockStats && lowStockStats.total_items > 0 && items.length === 0" class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div class="flex items-start gap-3">
                <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <TrendingDown :size="20" class="text-orange-600 dark:text-orange-400" />
                </div>
                <div class="flex-1">
                    <p class="text-sm font-semibold text-orange-700 dark:text-orange-400">
                        {{ lowStockStats.total_items }} producto(s) con stock bajo detectados
                    </p>
                    <p class="text-xs text-orange-600 dark:text-orange-500 mt-1">
                        <span v-if="lowStockStats.critical_stock > 0" class="font-bold">{{ lowStockStats.critical_stock }} críticos (stock 0)</span>
                        <span v-if="lowStockStats.critical_stock > 0 && lowStockStats.low_stock > 0"> · </span>
                        <span v-if="lowStockStats.low_stock > 0">{{ lowStockStats.low_stock }} bajo mínimo</span>
                        <span v-if="lowStockStats.without_supplier > 0"> · {{ lowStockStats.without_supplier }} sin proveedor</span>
                    </p>
                </div>
                <button
                    @click="handleImportLowStock"
                    :disabled="importing"
                    class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition text-sm font-medium"
                >
                    {{ importing ? 'Importando...' : 'Importar ahora' }}
                </button>
            </div>
        </div>

        <!-- Supplier Filter Badges -->
        <div v-if="items.length > 0" class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Filter :size="16" />
                <span class="font-medium">Filtrar por proveedor:</span>
            </div>
            <button
                @click="selectedSupplierFilter = null"
                :class="[
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition',
                    selectedSupplierFilter === null
                        ? 'bg-indigo-600 dark:bg-primary text-white'
                        : 'bg-gray-100 dark:bg-muted text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted/70'
                ]"
            >
                Todos ({{ items.length }})
            </button>
            <button
                v-for="stat in supplierStats"
                :key="stat.id"
                @click="selectedSupplierFilter = stat.id"
                :class="[
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2',
                    selectedSupplierFilter === stat.id
                        ? 'bg-indigo-600 dark:bg-primary text-white'
                        : 'bg-gray-100 dark:bg-muted text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted/70'
                ]"
            >
                <span>{{ stat.name }}</span>
                <span class="px-1.5 py-0.5 text-xs rounded bg-black/10 dark:bg-white/10">{{ stat.count }}</span>
            </button>
        </div>

        <!-- Warning: items without supplier -->
        <div v-if="hasItemsWithoutSupplier && items.length > 0" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle :size="18" class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p class="text-sm text-amber-700 dark:text-amber-400">
                Hay ítems <strong>sin proveedor asignado</strong>. Al convertir, se creará una OC adicional sin proveedor que deberás editar manualmente.
            </p>
        </div>

        <!-- Conversion result -->
        <div v-if="conversionResult" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-3">
                <CheckCircle2 :size="18" class="text-green-600 dark:text-green-400" />
                <p class="text-sm font-semibold text-green-700 dark:text-green-400">{{ conversionResult.message }}</p>
            </div>
            <div class="space-y-1">
                <Link
                    v-for="po in conversionResult.orders_created"
                    :key="po.id"
                    :href="`/purchase-orders/${po.id}`"
                    class="flex items-center gap-2 text-sm text-indigo-600 dark:text-primary hover:underline"
                >
                    <ArrowRight :size="14" />
                    {{ po.po_number }} — {{ po.supplier }} ({{ po.items_count }} ítems)
                </Link>
            </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>

        <!-- Table -->
        <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
            <div v-if="loading" class="p-12 text-center text-gray-500">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-primary mx-auto mb-3"></div>
                Cargando...
            </div>
            <div v-else-if="filteredItems.length === 0" class="p-12 text-center text-gray-400">
                <Filter :size="48" class="mx-auto mb-3 opacity-40" />
                <p>No hay ítems que coincidan con el filtro seleccionado.</p>
                <button 
                    @click="selectedSupplierFilter = null"
                    class="mt-3 text-sm text-indigo-600 dark:text-primary hover:underline"
                >
                    Ver todos los ítems
                </button>
            </div>
            <div v-else class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                    <thead class="bg-gray-50 dark:bg-background">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-64">Proveedor</th>
                            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Cantidad</th>
                            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Costo Unit.</th>
                            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-20">ITBM %</th>
                            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Subtotal</th>
                            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Total</th>
                            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">P. Venta</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">Notas</th>
                            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-muted/30 transition">
                            <!-- Producto (read-only) -->
                            <td class="px-4 py-2">
                                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ item.product?.name ?? '—' }}</p>
                                <p class="text-xs text-gray-400 font-mono">{{ item.product?.sku_base ?? '' }}</p>
                                <p v-if="item.variant" class="text-xs text-indigo-500">{{ item.variant.sku }}</p>
                            </td>
                            <!-- Proveedor (editable select) -->
                            <td class="px-4 py-2 w-64">
                                <SearchableSelect
                                    :model-value="item.supplier_id"
                                    :options="supplierOptions"
                                    @update:model-value="(val) => { item.supplier_id = val as number | null; debouncedSave(item) }"
                                />
                            </td>
                            <!-- Cantidad (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.quantity_needed"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    class="w-full px-2 py-1.5 text-sm text-right border border-gray-200 dark:border-border rounded bg-white dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- Costo Unitario (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.unit_cost"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full px-2 py-1.5 text-sm text-right border border-gray-200 dark:border-border rounded bg-white dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- ITBM % (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.tax_rate"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    class="w-full px-2 py-1.5 text-sm text-right border border-gray-200 dark:border-border rounded bg-white dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- Subtotal (computed, read-only) -->
                            <td class="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-300 font-mono">
                                {{ formatCurrency(item.quantity_needed * item.unit_cost) }}
                            </td>
                            <!-- Total con ITBM (computed, read-only) -->
                            <td class="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-white font-mono">
                                {{ formatCurrency((item.quantity_needed * item.unit_cost) * (1 + item.tax_rate / 100)) }}
                            </td>
                            <!-- Precio Venta (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model.number="item.sale_price"
                                    @input="debouncedSave(item)"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full px-2 py-1.5 text-sm text-right border border-gray-200 dark:border-border rounded bg-white dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- Notas (editable) -->
                            <td class="px-4 py-2">
                                <input
                                    v-model="item.notes"
                                    @input="debouncedSave(item)"
                                    type="text"
                                    placeholder="..."
                                    class="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-border rounded bg-white dark:bg-muted dark:text-white"
                                />
                            </td>
                            <!-- Acciones -->
                            <td class="px-4 py-2 text-center">
                                <div class="flex items-center justify-center gap-1">
                                    <span v-if="savingItemId === item.id" class="text-xs text-indigo-500">
                                        <Save :size="14" class="animate-pulse" />
                                    </span>
                                    <button @click="handleRemove(item.id)" class="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                                        <Trash2 :size="15" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <!-- Footer with totals -->
                    <tfoot class="bg-gray-100 dark:bg-muted">
                        <tr class="font-semibold">
                            <td colspan="5" class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300 uppercase">Totales:</td>
                            <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white font-mono">{{ formatCurrency(totals.subtotal) }}</td>
                            <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white font-mono">{{ formatCurrency(totals.total) }}</td>
                            <td colspan="3"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div v-if="filteredItems.length > 0" class="bg-gray-50 dark:bg-muted px-6 py-2 border-t border-gray-100 dark:border-border text-xs text-gray-400 flex justify-between items-center">
                <span class="uppercase tracking-widest">
                    {{ filteredItems.length }} de {{ items.length }} {{ items.length === 1 ? 'ítem' : 'ítems' }}
                    <span v-if="selectedSupplierFilter !== null" class="text-indigo-600 dark:text-primary font-medium">
                        (Filtrado)
                    </span>
                </span>
                <button 
                    v-if="selectedSupplierFilter !== null"
                    @click="selectedSupplierFilter = null"
                    class="text-indigo-600 dark:text-primary hover:underline flex items-center gap-1"
                >
                    <XIcon :size="12" />
                    Limpiar filtro
                </button>
            </div>
        </div>
    </div>

    <!-- Product Search Modal (POS-style) -->
    <ProductSearchModal
        :show="showSearchModal"
        :products="productList"
        :search-query="searchQuery"
        :total-count="totalProducts"
        :has-more="hasNextPage"
        :loading-more="productsLoading"
        context="supply-list"
        :show-quick-purchase-action="false"
        @close="showSearchModal = false"
        @product-selected="handleProductSelected"
        @load-more="fetchMoreProducts"
    />

    <!-- Quick Purchase Modal (for adding to supply list) -->
    <QuickPurchaseModal
        v-if="selectedProductForPurchase"
        :is-open="showQuickPurchaseModal"
        :product="selectedProductForPurchase"
        :show-quick-purchase-action="false"
        @close="showQuickPurchaseModal = false; selectedProductForPurchase = null"
        @success="handleQuickPurchaseSuccess"
    />

    <!-- Product Detail Modal -->
    <ProductDetailModal
        v-if="selectedProductForDetail"
        :product="selectedProductForDetail"
        @close="selectedProductForDetail = null"
    />
</template>
