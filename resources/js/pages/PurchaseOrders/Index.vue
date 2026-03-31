<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { useSuppliers } from '@/composables/useSuppliers'
import { Search, Plus, Eye, Send, XCircle, Trash2, DollarSign, Package, Clock, CheckCircle2, TrendingDown, AlertCircle } from 'lucide-vue-next'
import type { PurchaseOrderFilters, PurchaseOrderStatus } from '@/types/purchase-order'
import { useAuth } from '@/composables/useAuth'

const { hasRole } = useAuth()
const { purchaseOrders, statistics, loading, error, pagination, fetchPurchaseOrders, fetchStatistics, sendPurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder } = usePurchaseOrders()
const { fetchActiveSuppliers } = useSuppliers()

const suppliers = ref<any[]>([])
const filters = ref<PurchaseOrderFilters & { payment_status?: string }>({
    search: '',
    status: undefined,
    supplier_id: undefined,
    payment_status: undefined,
    date_from: '',
    date_to: '',
    per_page: 15,
})

function getPaymentStatusColor(ps: string) {
    if (ps === 'paid')    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    if (ps === 'partial') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

function getPaymentStatusLabel(ps: string) {
    if (ps === 'paid')    return 'Pagado'
    if (ps === 'partial') return 'Parcial'
    return 'Pendiente'
}

function formatAmount(val: number | string | null | undefined): string {
    return '$' + Number(val ?? 0).toLocaleString('es', { minimumFractionDigits: 2 })
}

const statusOptions: { value: string; label: string; color: string }[] = [
    { value: '', label: 'Todos', color: '' },
    { value: 'draft', label: 'Borrador', color: 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-300' },
    { value: 'open', label: 'Abierta (Diaria)', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    { value: 'sent', label: 'Enviado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'partial', label: 'Parcial', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { value: 'received', label: 'Recibido', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
]

function getStatusColor(status: string) {
    return statusOptions.find(s => s.value === status)?.color || ''
}

function getStatusLabel(status: string) {
    return statusOptions.find(s => s.value === status)?.label || status
}

function getDisplayName(po: any): string {
    // Daily global PO: no supplier in header
    if (!po.supplier) {
        const date = new Date(po.order_date)
        return `OC del ${date.toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return po.supplier.name
}

function isDailyPO(po: any): boolean {
    return !po.supplier
}

async function loadOrders() {
    const cleanFilters: any = { ...filters.value }
    Object.keys(cleanFilters).forEach(k => { if (!cleanFilters[k]) delete cleanFilters[k] })
    await fetchPurchaseOrders(cleanFilters)
}

async function handleSend(id: number) {
    if (!confirm('¿Enviar esta orden al proveedor?')) return
    try {
        await sendPurchaseOrder(id)
        await loadOrders()
        await fetchStatistics()
    } catch (e) {}
}

async function handleCancel(id: number) {
    if (!confirm('¿Cancelar esta orden de compra?')) return
    try {
        await cancelPurchaseOrder(id)
        await loadOrders()
        await fetchStatistics()
    } catch (e) {}
}

async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta orden de compra?')) return
    try {
        await deletePurchaseOrder(id)
        await loadOrders()
        await fetchStatistics()
    } catch (e) {}
}

onMounted(async () => {
    suppliers.value = await fetchActiveSuppliers()
    await fetchStatistics()
    await loadOrders()
})
</script>

<template>
    <Head title="Órdenes de Compra" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Órdenes de Compra</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestiona pedidos a proveedores y recepción de mercancía</p>
                </div>
            <div class="flex items-center gap-3">
                <Link v-if="hasRole(['admin', 'manager', 'buyer', 'assistant'])" href="/supply-list" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition">
                    <Plus :size="20" />
                    Nueva O/C
                </Link>
            </div>

        </div>

            <!-- Stats -->
            <div v-if="statistics" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-gray-100 dark:bg-muted rounded-lg"><Package :size="20" class="text-gray-600 dark:text-gray-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.total_orders }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Total Órdenes</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><DollarSign :size="20" class="text-green-600 dark:text-green-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">${{ Number(statistics.total_spent).toLocaleString('es', {minimumFractionDigits: 2}) }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Total Invertido</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Clock :size="20" class="text-blue-600 dark:text-primary dark:text-blue-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.sent_orders + statistics.partial_orders }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Pendientes</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><CheckCircle2 :size="20" class="text-emerald-600 dark:text-emerald-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.received_orders }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Recibidas</p>
                        </div>
                    </div>
                </div>
                <!-- Por Pagar KPI -->
                <div class="bg-white dark:bg-card rounded-lg border border-red-200 dark:border-red-900/40 p-4 col-span-2 md:col-span-1" @click="filters.payment_status = filters.payment_status ? undefined : 'pending'; loadOrders()" role="button">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><AlertCircle :size="20" class="text-red-600 dark:text-red-400" /></div>
                        <div>
                            <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ formatAmount(statistics.total_unpaid) }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Por Pagar ({{ statistics.pending_payment_orders ?? 0 }} órdenes)</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buscar</label>
                        <div class="relative">
                            <Search class="absolute left-3 top-2.5 text-gray-400" :size="18" />
                            <input v-model="filters.search" type="text" placeholder="Nº de orden, proveedor..." class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" @input="loadOrders" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estado</label>
                        <select v-model="filters.status" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" @change="loadOrders">
                            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value || undefined">{{ opt.label }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proveedor</label>
                        <select v-model="filters.supplier_id" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" @change="loadOrders">
                            <option :value="undefined">Todos</option>
                            <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Desde</label>
                        <input v-model="filters.date_from" type="date" class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white" @change="loadOrders" />
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Table -->
            <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nº Orden</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Proveedor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Items</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pago</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-border">
                            <tr v-if="loading">
                                <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                                    <div class="flex items-center justify-center gap-2">
                                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 dark:border-primary"></div>
                                        Cargando...
                                    </div>
                                </td>
                            </tr>
                            <tr v-else-if="purchaseOrders.length === 0">
                                <td colspan="8" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <Package class="mx-auto mb-3 text-gray-300" :size="48" />
                                    <p>No se encontraron órdenes de compra</p>
                                </td>
                            </tr>
                            <tr v-for="po in purchaseOrders" :key="po.id" class="hover:bg-gray-50 dark:hover:bg-muted/50/50 transition">
                                <td class="px-6 py-4">
                                    <Link :href="`/purchase-orders/${po.id}`" class="text-indigo-600 dark:text-primary dark:text-indigo-400 hover:underline font-mono font-medium">
                                        {{ po.po_number }}
                                    </Link>
                                </td>
                                <td class="px-6 py-4">
                                    <template v-if="isDailyPO(po)">
                                        <span class="text-sm text-purple-600 dark:text-purple-400 font-medium">
                                            {{ getDisplayName(po) }}
                                        </span>
                                        <span class="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                                            Global
                                        </span>
                                    </template>
                                    <Link v-else-if="po.supplier" :href="`/suppliers/${po.supplier.id}`" class="text-sm text-indigo-600 dark:text-primary dark:text-indigo-400 hover:underline">
                                        {{ po.supplier.name }}
                                    </Link>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                    {{ new Date(po.order_date).toLocaleDateString('es-PA') }}
                                </td>
                                <td class="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                                    {{ po.items_count || po.items?.length || 0 }}
                                </td>
                                <td class="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                    {{ po.formatted_total }}
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span :class="['px-2 py-1 text-xs font-semibold rounded-full', getStatusColor(po.status)]">
                                        {{ getStatusLabel(po.status) }}
                                    </span>
                                </td>
                                <!-- Payment Status Cell -->
                                <td class="px-6 py-4 text-center">
                                    <div class="flex flex-col items-center gap-1">
                                        <span :class="['px-2 py-0.5 text-xs font-semibold rounded-full', getPaymentStatusColor(po.payment_status ?? 'pending')]">
                                            {{ getPaymentStatusLabel(po.payment_status ?? 'pending') }}
                                        </span>
                                        <!-- Show pending amount if not fully paid -->
                                        <span v-if="po.payment_status !== 'paid' && po.status !== 'cancelled'" class="text-xs font-medium text-red-500 dark:text-red-400">
                                            {{ formatAmount(po.amount_due) }} por pagar
                                        </span>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div class="flex items-center justify-end gap-1">
                                        <Link :href="`/purchase-orders/${po.id}`" class="p-2 text-gray-400 hover:text-indigo-600 dark:text-primary transition" title="Ver detalle">
                                            <Eye :size="16" />
                                        </Link>
                                        <template v-if="hasRole(['admin', 'manager', 'buyer', 'assistant'])">
                                            <button v-if="po.status === 'draft'" @click="handleSend(po.id)" class="p-2 text-gray-400 hover:text-blue-600 dark:text-primary transition" title="Enviar al proveedor">
                                                <Send :size="16" />
                                            </button>
                                            <button v-if="!['received', 'cancelled'].includes(po.status)" @click="handleCancel(po.id)" class="p-2 text-gray-400 hover:text-orange-600 transition" title="Cancelar">
                                                <XCircle :size="16" />
                                            </button>
                                            <button v-if="po.status === 'draft'" @click="handleDelete(po.id)" class="p-2 text-gray-400 hover:text-red-600 transition" title="Eliminar">
                                                <Trash2 :size="16" />
                                            </button>
                                        </template>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-if="pagination && pagination.last_page > 1" class="px-6 py-3 border-t border-gray-200 dark:border-border flex items-center justify-between">
                    <p class="text-sm text-gray-500 dark:text-gray-400">Mostrando {{ purchaseOrders.length }} de {{ pagination.total }} órdenes</p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
