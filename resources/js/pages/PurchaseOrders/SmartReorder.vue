<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { smartReorderService, type SupplierLowStock, type LowStockStats, type CreatedPurchaseOrder } from '@/services/smart-reorder'
import { PackageX, AlertTriangle, TrendingDown, ShoppingCart, Check, Minus, Plus, CheckCircle2 } from 'lucide-vue-next'
import apiClient from '@/services/api/client'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const lowStockData = ref<SupplierLowStock[]>([])
const stats = ref<LowStockStats | null>(null)
const warehouses = ref<any[]>([])
const selectedWarehouse = ref<number | undefined>(undefined)
const loading = ref(false)
const error = ref<string | null>(null)
const createdOrders = ref<CreatedPurchaseOrder[]>([])
const showSuccess = ref(false)

// Track selected items per supplier
const selectedItems = ref<Record<number, Record<number, boolean>>>({})
const quantities = ref<Record<number, Record<number, number>>>({})

async function loadData() {
    loading.value = true
    error.value = null
    try {
        const [lowStock, statsData] = await Promise.all([
            smartReorderService.getLowStock(selectedWarehouse.value),
            smartReorderService.getStats(selectedWarehouse.value),
        ])
        lowStockData.value = lowStock
        stats.value = statsData

        // Initialize selection states
        lowStock.forEach(group => {
            const supplierId = group.supplier.id
            if (!selectedItems.value[supplierId]) {
                selectedItems.value[supplierId] = {}
                quantities.value[supplierId] = {}
            }
            group.items.forEach(item => {
                selectedItems.value[supplierId][item.product_id] = true // Select all by default
                quantities.value[supplierId][item.product_id] = item.suggested_quantity
            })
        })
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error loading data'
    } finally {
        loading.value = false
    }
}

function toggleItem(supplierId: number, productId: number) {
    selectedItems.value[supplierId][productId] = !selectedItems.value[supplierId][productId]
}

function toggleAllForSupplier(supplierId: number) {
    const group = lowStockData.value.find(g => g.supplier.id === supplierId)
    if (!group) return
    
    const allSelected = group.items.every(item => selectedItems.value[supplierId]?.[item.product_id])
    group.items.forEach(item => {
        selectedItems.value[supplierId][item.product_id] = !allSelected
    })
}

function adjustQuantity(supplierId: number, productId: number, delta: number) {
    const current = quantities.value[supplierId][productId] || 0
    quantities.value[supplierId][productId] = Math.max(1, current + delta)
}

const selectedCount = computed(() => {
    let count = 0
    Object.values(selectedItems.value).forEach(items => {
        count += Object.values(items).filter(Boolean).length
    })
    return count
})

const ordersToCreate = computed(() => {
    const orders: any[] = []
    lowStockData.value.forEach(group => {
        const selectedGroupItems = group.items.filter(item => selectedItems.value[group.supplier.id]?.[item.product_id])
        
        if (selectedGroupItems.length === 0) return

        const items = selectedGroupItems.map(item => ({
            product_id: item.product_id,
            quantity: quantities.value[group.supplier.id][item.product_id],
            unit_cost: item.unit_cost,
        }))
        
        orders.push({
            supplier_id: group.supplier.id,
            warehouse_id: selectedGroupItems[0].warehouse_id,
            notes: `Generado por Smart Reorder - ${items.length} productos`,
            items,
        })
    })
    return orders
})

async function handleGenerate() {
    if (ordersToCreate.value.length === 0) {
        toast.error('Selecciona al menos un producto')
        return
    }

    if (!confirm(`¿Generar ${ordersToCreate.value.length} órdenes de compra en borrador?`)) return

    loading.value = true
    error.value = null
    try {
        const result = await smartReorderService.batchCreate(ordersToCreate.value)
        createdOrders.value = result
        showSuccess.value = true
        toast.success(`${result.length} orden(es) de compra creada(s) exitosamente`)
        
        // Clear selection after success
        selectedItems.value = {}
        quantities.value = {}
        await loadData()
    } catch (e: any) {
        const errorMsg = e.response?.data?.message || e.response?.data?.errors || 'Error al generar órdenes'
        error.value = typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg
        toast.error('Error al generar órdenes de compra')
    } finally {
        loading.value = false
    }
}

onMounted(async () => {
    try {
        const { data } = await apiClient.get('/warehouses')
        warehouses.value = data.data || data || []
    } catch (e) {}
    await loadData()
})
</script>

<template>
    <Head title="Smart Reorder - Reabastecimiento Inteligente" />
    <AppLayout>
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Reabastecimiento Inteligente</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Genera órdenes de compra basadas en puntos de reorden</p>
                </div>
                <Link href="/purchase-orders" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted/50 rounded-lg transition">
                    Volver
                </Link>
            </div>

            <!-- Stats -->
            <div v-if="stats" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg"><TrendingDown :size="20" class="text-orange-600 dark:text-orange-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total_items }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Total Bajo Stock</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><PackageX :size="20" class="text-red-600 dark:text-red-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.critical_stock }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Stock Crítico (0)</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Check :size="20" class="text-blue-600 dark:text-blue-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedCount }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Seleccionados</p>
                        </div>
                    </div>
                </div>
                <div v-if="stats.without_supplier > 0" class="bg-white dark:bg-card rounded-lg border border-amber-200 dark:border-amber-800 p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><AlertTriangle :size="20" class="text-amber-600 dark:text-amber-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ stats.without_supplier }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Sin Proveedor</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Warning: products without supplier -->
            <div v-if="stats?.without_supplier > 0" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle :size="18" class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p class="text-sm text-amber-700 dark:text-amber-400">
                        <strong>{{ stats.without_supplier }} producto(s)</strong> con bajo stock no tienen proveedor asignado.
                    </p>
                    <p class="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        Estos productos no aparecen en Smart Reorder. Asígnales un proveedor en el módulo de Productos para incluirlos.
                    </p>
                </div>
            </div>

            <!-- Filter -->
            <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-4">
                <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Almacén:</label>
                    <select v-model="selectedWarehouse" @change="loadData" class="px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white">
                        <option :value="undefined">Todos</option>
                        <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                    </select>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Success Panel -->
            <div v-if="showSuccess && createdOrders.length > 0" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-3">
                    <CheckCircle2 :size="20" class="text-green-600 dark:text-green-400" />
                    <p class="text-sm font-semibold text-green-700 dark:text-green-400">
                        {{ createdOrders.length }} orden(es) de compra creada(s) exitosamente
                    </p>
                    <button @click="showSuccess = false" class="ml-auto text-green-600 hover:text-green-800 text-sm">
                        Cerrar
                    </button>
                </div>
                <div class="space-y-2">
                    <Link
                        v-for="po in createdOrders"
                        :key="po.id"
                        :href="`/purchase-orders/${po.id}`"
                        class="flex items-center justify-between p-2 bg-white dark:bg-card rounded border border-green-100 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30 transition"
                    >
                        <div class="flex items-center gap-3">
                            <ShoppingCart :size="16" class="text-green-600" />
                            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ po.po_number }}</span>
                            <span class="text-xs text-gray-500">{{ po.supplier?.name }}</span>
                        </div>
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">${{ po.total?.toFixed(2) || '0.00' }}</span>
                    </Link>
                </div>
                <div class="mt-3 flex gap-2">
                    <Link href="/purchase-orders" class="text-sm text-indigo-600 dark:text-primary hover:underline">
                        Ver todas las órdenes →
                    </Link>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-primary"></div>
            </div>

            <!-- Grouped by Supplier -->
            <div v-else-if="lowStockData.length" class="space-y-6">
                <div v-for="group in lowStockData" :key="group.supplier.id" class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
                    <div class="px-6 py-4 bg-gray-50 dark:bg-background border-b border-gray-200 dark:border-border flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ group.supplier.name }}</h3>
                            <p class="text-sm text-gray-500">{{ group.items.length }} productos</p>
                        </div>
                        <button @click="toggleAllForSupplier(group.supplier.id)" class="px-3 py-1 text-sm text-indigo-600 dark:text-primary hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition">
                            {{ group.items.every(i => selectedItems[group.supplier.id]?.[i.product_id]) ? 'Deseleccionar' : 'Seleccionar' }} Todo
                        </button>
                    </div>
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th class="px-4 py-2 w-10"></th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Mín</th>
                                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Almacén</th>
                                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Costo</th>
                                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-border">
                            <tr v-for="item in group.items" :key="item.product_id" :class="selectedItems[group.supplier.id]?.[item.product_id] ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''">
                                <td class="px-4 py-3 text-center">
                                    <input type="checkbox" :checked="selectedItems[group.supplier.id]?.[item.product_id]" @change="toggleItem(group.supplier.id, item.product_id)" class="rounded" />
                                </td>
                                <td class="px-4 py-3">
                                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ item.product.name }}</p>
                                    <p class="text-xs text-gray-500 font-mono">{{ item.product.sku }}</p>
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <span :class="item.current_stock === 0 ? 'text-red-600 font-bold' : 'text-gray-900 dark:text-white'">{{ item.current_stock }}</span>
                                </td>
                                <td class="px-4 py-3 text-center text-sm text-gray-500">{{ item.reorder_point }}</td>
                                <td class="px-4 py-3 text-center text-xs text-gray-500">{{ item.warehouse_name }}</td>
                                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">${{ (item.unit_cost || 0).toFixed(2) }}</td>
                                <td class="px-4 py-3">
                                    <div class="flex items-center justify-center gap-2">
                                        <button @click="adjustQuantity(group.supplier.id, item.product_id, -1)" class="p-1 text-gray-400 hover:text-gray-600 transition"><Minus :size="16" /></button>
                                        <input v-model.number="quantities[group.supplier.id][item.product_id]" type="number" min="1" class="w-16 text-center px-2 py-1 border border-gray-300 dark:border-border rounded bg-white dark:bg-muted text-gray-900 dark:text-white" />
                                        <button @click="adjustQuantity(group.supplier.id, item.product_id, 1)" class="p-1 text-gray-400 hover:text-gray-600 transition"><Plus :size="16" /></button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div v-else class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-12 text-center">
                <AlertTriangle class="mx-auto mb-3 text-green-500" :size="48" />
                <p class="text-gray-600 dark:text-gray-400">¡Todos los productos tienen stock suficiente!</p>
            </div>

            <!-- Floating Action Button -->
            <div v-if="selectedCount > 0" class="fixed bottom-8 right-8 z-50">
                <button @click="handleGenerate" :disabled="loading" class="inline-flex items-center gap-3 px-6 py-4 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 disabled:opacity-50 text-white rounded-full shadow-lg transition">
                    <ShoppingCart :size="20" />
                    <span class="font-semibold">Generar {{ ordersToCreate.length }} {{ ordersToCreate.length === 1 ? 'Orden' : 'Órdenes' }}</span>
                </button>
            </div>
        </div>
    </AppLayout>
</template>
