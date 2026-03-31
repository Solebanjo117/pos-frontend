<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
    X, Printer, Banknote, CreditCard, Receipt,
    TrendingUp, TrendingDown, Minus, User, Warehouse, Clock
} from 'lucide-vue-next'
import type { PosSessionRecord, SessionSalesOrder } from '@/services/posSessions'
import { usePaymentMethods } from '@/composables/usePaymentMethods'

const { methods, fetchMethods, getMethodName } = usePaymentMethods()

// Fetch methods on mount
onMounted(fetchMethods)

interface Props {
    session: PosSessionRecord | null
    salesOrders: SessionSalesOrder[]
    loading: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const formatCurrency = (value: string | number | null | undefined): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0)
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(num)
}

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const summary = computed(() => props.session?.closing_details?.summary || null)
const denominations = computed(() => props.session?.closing_details?.denominations || null)
const electronicPayments = computed(() => props.session?.closing_details?.electronic_payments || null)

const difference = computed(() => summary.value?.difference ?? 0)

const differenceClass = computed(() => {
    if (difference.value > 0) return 'text-emerald-600 dark:text-emerald-400'
    if (difference.value < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-500 dark:text-gray-400'
})

const differenceLabel = computed(() => {
    if (difference.value > 0.005) return 'Sobrante'
    if (difference.value < -0.005) return 'Faltante'
    return 'Cuadra'
})

const differenceIcon = computed(() => {
    if (difference.value > 0) return 'up'
    if (difference.value < 0) return 'down'
    return 'equal'
})

// Denomination table rows — must match the IDs used in CloseSessionModal / CashCountTable
// CloseSessionModal stores: { unit_100: N, pack_100: N, unit_50: N, pack_50: N, ... }
const DENOM_ROWS = [
    { id: '100',  label: '$100',  unitValue: 100,  packValue: 10000 },
    { id: '50',   label: '$50',   unitValue: 50,   packValue: 5000 },
    { id: '20',   label: '$20',   unitValue: 20,   packValue: 2000 },
    { id: '10',   label: '$10',   unitValue: 10,   packValue: 1000 },
    { id: '5',    label: '$5',    unitValue: 5,     packValue: 500 },
    { id: '1',    label: '$1',    unitValue: 1,     packValue: 100 },
    { id: '1.00', label: '$1.00 (moneda)', unitValue: 1.00, packValue: 25.00 },
    { id: '0.50', label: '$0.50', unitValue: 0.50, packValue: 10.00 },
    { id: '0.25', label: '$0.25', unitValue: 0.25, packValue: 10.00 },
    { id: '0.10', label: '$0.10', unitValue: 0.10, packValue: 5.00 },
    { id: '0.05', label: '$0.05', unitValue: 0.05, packValue: 2.00 },
    { id: '0.01', label: '$0.01', unitValue: 0.01, packValue: 0.50 },
]

const denomData = computed(() => {
    if (!denominations.value) return []
    return DENOM_ROWS.map(d => {
        const unitCount = Number(denominations.value?.[`unit_${d.id}`] || 0)
        const packCount = Number(denominations.value?.[`pack_${d.id}`] || 0)
        const subtotal = (unitCount * d.unitValue) + (packCount * d.packValue)
        return {
            ...d,
            unitCount,
            packCount,
            subtotal,
        }
    }).filter(d => d.unitCount > 0 || d.packCount > 0) // Only show denominations that were counted
})

const totalDenominations = computed(() => denomData.value.reduce((sum, d) => sum + d.subtotal, 0))

// Build rows from electronic_payments — show all methods with amounts > 0
const electronicPaymentRows = computed(() => {
    if (electronicPayments.value) {
        // Get all codes from stored data
        return Object.entries(electronicPayments.value)
            .filter(([_, amount]) => Number(amount) > 0)
            .map(([code, amount]) => ({
                key: code,
                label: getMethodName(code),
                amount: Number(amount),
            }))
    }
    // Fallback: build from summary totals when electronic_payments was not recorded
    if (!summary.value) return []
    const rows = []
    if ((summary.value.card_sales ?? 0) > 0)
        rows.push({ key: 'card', label: getMethodName('card'), amount: Number(summary.value.card_sales) })
    if ((summary.value.transfer_sales ?? 0) > 0)
        rows.push({ key: 'transfer', label: getMethodName('transfer'), amount: Number(summary.value.transfer_sales) })
    if ((summary.value.credit_sales ?? 0) > 0)
        rows.push({ key: 'credit', label: getMethodName('credit'), amount: Number(summary.value.credit_sales) })
    return rows
})

// Get method label dynamically
const paymentMethodLabel = (method: string): string => {
    return getMethodName(method)
}

const statusLabel = (status: string): string => {
    const map: Record<string, string> = {
        completed: 'Completada',
        confirmed: 'Confirmada',
        processing: 'En proceso',
        draft: 'Borrador',
        cancelled: 'Cancelada',
    }
    return map[status] || status
}

const handlePrint = () => {
    window.print()
}
</script>

<template>
    <!-- Backdrop -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="emit('close')">
        <!-- Modal Container -->
        <div class="relative mx-4 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-card print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:m-0">
            <!-- Header (hidden on print) -->
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-border dark:bg-card/95 print:hidden">
                <h2 class="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
                    <Receipt :size="24" class="text-indigo-500" />
                    Detalle del Cierre de Caja
                </h2>
                <div class="flex items-center gap-2">
                    <button
                        @click="handlePrint"
                        class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                    >
                        <Printer :size="16" />
                        Imprimir
                    </button>
                    <button @click="emit('close')" class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors">
                        <X :size="20" />
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-20">
                <div class="text-gray-500 dark:text-gray-400 animate-pulse">Cargando detalles...</div>
            </div>

            <!-- Content -->
            <div v-else-if="session" class="p-6 space-y-6 print:p-4 print:space-y-3">

                <!-- ========== PRINT HEADER ========== -->
                <div class="hidden print:block text-center mb-2">
                    <h1 class="text-xl font-black uppercase tracking-widest">CIERRE DE CAJA</h1>
                    <p class="text-sm font-semibold">{{ session.warehouse?.name || 'Sucursal General' }}</p>
                    <div class="mt-1 flex justify-center gap-6 text-xs text-gray-600">
                        <span>Sesión #{{ session.id }}</span>
                        <span>Cajero: {{ session.user?.name || '—' }}</span>
                    </div>
                    <hr class="my-2 border-gray-400" />
                </div>

                <!-- ========== SESSION INFO ========== -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2 print:text-[11px]">
                    <div class="flex items-center gap-2">
                        <User :size="16" class="text-gray-400 flex-shrink-0 print:hidden" />
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Cajero</p>
                            <p class="font-semibold text-gray-900 dark:text-white">{{ session.user?.name || '—' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Warehouse :size="16" class="text-gray-400 flex-shrink-0 print:hidden" />
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Sucursal</p>
                            <p class="font-semibold text-gray-900 dark:text-white">{{ session.warehouse?.name || 'General' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Clock :size="16" class="text-gray-400 flex-shrink-0 print:hidden" />
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Apertura</p>
                            <p class="font-semibold text-gray-900 dark:text-white">{{ formatDate(session.opened_at) }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Clock :size="16" class="text-gray-400 flex-shrink-0 print:hidden" />
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Cierre</p>
                            <p class="font-semibold text-gray-900 dark:text-white">{{ formatDate(session.closed_at) }}</p>
                        </div>
                    </div>
                </div>

                <!-- ========== TWO-COLUMN LAYOUT: Denomination Table + Reconciliation ========== -->
                <div v-if="summary" class="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2 print:gap-3">

                    <!-- LEFT: Arqueo de Denominaciones -->
                    <div class="rounded-xl bg-gray-50 dark:bg-muted/30 print:bg-white print:border print:border-gray-400 overflow-hidden">
                        <div class="bg-gray-100 dark:bg-muted/60 px-4 py-2.5 print:bg-gray-200">
                            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                <Banknote :size="14" class="print:hidden" />
                                Arqueo de Denominaciones
                            </h3>
                        </div>

                        <div v-if="denomData.length > 0" class="p-0">
                            <table class="w-full text-sm print:text-[10px]">
                                <thead>
                                    <tr class="bg-gray-100/50 dark:bg-muted/40 print:bg-gray-100">
                                        <th class="py-1.5 px-3 text-left font-semibold text-gray-500 dark:text-gray-400">Denominación</th>
                                        <th class="py-1.5 px-3 text-center font-semibold text-gray-500 dark:text-gray-400">Sueltas</th>
                                        <th class="py-1.5 px-3 text-center font-semibold text-gray-500 dark:text-gray-400">Fajos</th>
                                        <th class="py-1.5 px-3 text-right font-semibold text-gray-500 dark:text-gray-400">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="d in denomData" :key="d.id" class="border-t border-gray-100 dark:border-border/50 print:border-gray-300">
                                        <td class="py-1.5 px-3 font-medium text-gray-700 dark:text-gray-300">
                                            <span class="inline-flex items-center gap-1">
                                                <span class="w-2 h-2 rounded-full flex-shrink-0" :class="d.unitValue >= 20 ? 'bg-green-400' : 'bg-amber-400'"></span>
                                                {{ d.label }}
                                            </span>
                                        </td>
                                        <td class="py-1.5 px-3 text-center font-mono text-gray-600 dark:text-gray-400">
                                            <span v-if="d.unitCount > 0">× {{ d.unitCount }}</span>
                                            <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                                        </td>
                                        <td class="py-1.5 px-3 text-center font-mono text-gray-600 dark:text-gray-400">
                                            <span v-if="d.packCount > 0">× {{ d.packCount }}</span>
                                            <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                                        </td>
                                        <td class="py-1.5 px-3 text-right font-semibold text-gray-900 dark:text-white">{{ formatCurrency(d.subtotal) }}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr class="border-t-2 border-gray-300 dark:border-border bg-gray-100/70 dark:bg-muted/50 print:bg-gray-100">
                                        <td colspan="3" class="py-2 px-3 font-bold text-gray-700 dark:text-gray-300 text-right uppercase text-xs">Total Contado</td>
                                        <td class="py-2 px-3 text-right font-bold text-lg text-gray-900 dark:text-white print:text-sm">{{ formatCurrency(totalDenominations) }}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div v-else class="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
                            No se registró conteo de denominaciones.
                        </div>
                    </div>

                    <!-- RIGHT: Reconciliación / Arqueo -->
                    <div class="space-y-4 print:space-y-2">
                        <!-- Cash Reconciliation Table -->
                        <div class="rounded-xl bg-gray-50 dark:bg-muted/30 overflow-hidden print:bg-white print:border print:border-gray-400">
                            <div class="bg-gray-100 dark:bg-muted/60 px-4 py-2.5 print:bg-gray-200">
                                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                    <Receipt :size="14" class="print:hidden" />
                                    Reconciliación de Efectivo
                                </h3>
                            </div>

                            <div class="divide-y divide-gray-100 dark:divide-border/50 print:divide-gray-300">
                                <!-- Opening -->
                                <div class="flex justify-between items-center px-4 py-2.5 print:py-1.5 print:text-[11px]">
                                    <span class="text-gray-600 dark:text-gray-400">Fondo de Apertura</span>
                                    <span class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(summary.opening_amount) }}</span>
                                </div>
                                <!-- Cash Sales -->
                                <div class="flex justify-between items-center px-4 py-2.5 print:py-1.5 print:text-[11px]">
                                    <span class="text-green-600 dark:text-green-400">(+) Ventas en Efectivo</span>
                                    <span class="font-semibold text-green-700 dark:text-green-300">+ {{ formatCurrency(summary.cash_sales) }}</span>
                                </div>
                                <!-- Cash Movements In -->
                                <div v-if="(summary.cash_movements_in || 0) > 0" class="flex justify-between items-center px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-900/10 print:py-1.5 print:text-[11px] print:bg-white">
                                    <span class="text-emerald-600 dark:text-emerald-400">(+) Ingresos Extra</span>
                                    <span class="font-semibold text-emerald-700 dark:text-emerald-300">+ {{ formatCurrency(summary.cash_movements_in || 0) }}</span>
                                </div>
                                <!-- Cash Movements Out -->
                                <div v-if="(summary.cash_movements_out || 0) > 0" class="flex justify-between items-center px-4 py-2.5 bg-red-50/50 dark:bg-red-900/10 print:py-1.5 print:text-[11px] print:bg-white">
                                    <span class="text-red-600 dark:text-red-400">(−) Gastos / Retiros</span>
                                    <span class="font-semibold text-red-700 dark:text-red-300">− {{ formatCurrency(summary.cash_movements_out || 0) }}</span>
                                </div>
                                <!-- Expected -->
                                <div class="flex justify-between items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 print:py-2 print:text-[11px] print:bg-gray-100">
                                    <span class="font-bold text-indigo-700 dark:text-indigo-300 uppercase text-xs">(=) Efectivo Esperado</span>
                                    <span class="font-bold text-lg text-indigo-700 dark:text-indigo-300 print:text-sm">{{ formatCurrency(summary.expected_cash) }}</span>
                                </div>
                                <!-- Declared -->
                                <div class="flex justify-between items-center px-4 py-2.5 print:py-1.5 print:text-[11px]">
                                    <span class="text-blue-600 dark:text-primary dark:text-blue-400 font-medium">Efectivo Declarado</span>
                                    <span class="font-bold text-blue-700 dark:text-blue-300">{{ formatCurrency(summary.declared_cash) }}</span>
                                </div>
                                <!-- Difference -->
                                <div class="flex justify-between items-center px-4 py-3 print:py-2 print:text-[11px]"
                                    :class="difference > 0.005 ? 'bg-emerald-50 dark:bg-emerald-900/20 print:bg-white' : difference < -0.005 ? 'bg-red-50 dark:bg-red-900/20 print:bg-white' : 'bg-gray-50 dark:bg-muted/30 print:bg-white'"
                                >
                                    <span class="font-bold uppercase text-xs flex items-center gap-1.5" :class="differenceClass">
                                        <TrendingUp v-if="differenceIcon === 'up'" :size="14" class="print:hidden" />
                                        <TrendingDown v-else-if="differenceIcon === 'down'" :size="14" class="print:hidden" />
                                        <Minus v-else :size="14" class="print:hidden" />
                                        {{ differenceLabel }}
                                    </span>
                                    <span class="font-bold text-lg print:text-sm" :class="differenceClass">
                                        {{ formatCurrency(difference) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Payment Method Breakdown -->
                        <div class="rounded-xl bg-gray-50 dark:bg-muted/30 overflow-hidden print:bg-white print:border print:border-gray-400">
                            <div class="bg-gray-100 dark:bg-muted/60 px-4 py-2.5 print:bg-gray-200">
                                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                    <CreditCard :size="14" class="print:hidden" />
                                    Desglose por Método de Pago
                                </h3>
                            </div>
                            <table class="w-full text-sm print:text-[10px]">
                                <tbody>
                                    <!-- Efectivo -->
                                    <tr class="border-b border-gray-100 dark:border-border/50 print:border-gray-300">
                                        <td class="py-2 px-4 flex items-center gap-2">
                                            <Banknote :size="14" class="text-green-500 print:hidden" />
                                            <span class="text-gray-700 dark:text-gray-300">Efectivo</span>
                                        </td>
                                        <td class="py-2 px-4 text-right font-semibold text-gray-900 dark:text-white">{{ formatCurrency(summary.cash_sales) }}</td>
                                    </tr>
                                    <!-- Electronic payment methods — detailed breakdown from closing_details.electronic_payments -->
                                    <tr v-for="ep in electronicPaymentRows" :key="ep.key"
                                        class="border-b border-gray-100 dark:border-border/50 print:border-gray-300">
                                        <td class="py-2 px-4">
                                            <div class="flex items-center gap-2">
                                                <CreditCard :size="14" class="text-blue-400 print:hidden flex-shrink-0" />
                                                <span class="text-gray-700 dark:text-gray-300">{{ ep.label }}</span>
                                            </div>
                                        </td>
                                        <td class="py-2 px-4 text-right font-semibold"
                                            :class="ep.amount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
                                        >{{ formatCurrency(ep.amount) }}</td>
                                    </tr>

                                </tbody>
                                <tfoot>
                                    <tr class="border-t-2 border-gray-300 dark:border-border bg-indigo-50/70 dark:bg-indigo-900/20 print:bg-gray-100">
                                        <td class="py-2.5 px-4 font-bold text-indigo-700 dark:text-indigo-300 uppercase text-xs">Total Ventas</td>
                                        <td class="py-2.5 px-4 text-right font-bold text-indigo-700 dark:text-indigo-300">{{ formatCurrency(summary.total_sales) }}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ========== NOTES ========== -->
                <div v-if="session.notes" class="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 print:border print:border-gray-300 print:bg-white">
                    <p class="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">Notas del Cajero:</p>
                    <p class="text-sm text-yellow-800 dark:text-yellow-300">{{ session.notes }}</p>
                </div>

                <!-- ========== SALES ORDERS TABLE ========== -->
                <div>
                    <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Receipt :size="16" class="print:hidden" />
                        Ventas del Turno ({{ salesOrders.length }})
                    </h3>
                    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-border print:border print:border-gray-400">
                        <table class="w-full text-sm print:text-[10px]">
                            <thead>
                                <tr class="bg-gray-50 dark:bg-muted/50 print:bg-gray-100">
                                    <th class="py-2 px-3 text-left font-semibold text-gray-600 dark:text-gray-400">Folio</th>
                                    <th class="py-2 px-3 text-left font-semibold text-gray-600 dark:text-gray-400">Hora</th>
                                    <th class="py-2 px-3 text-left font-semibold text-gray-600 dark:text-gray-400">Cliente</th>
                                    <th class="py-2 px-3 text-left font-semibold text-gray-600 dark:text-gray-400">Pago</th>
                                    <th class="py-2 px-3 text-left font-semibold text-gray-600 dark:text-gray-400">Estado</th>
                                    <th class="py-2 px-3 text-right font-semibold text-gray-600 dark:text-gray-400">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="order in salesOrders"
                                    :key="order.id"
                                    class="border-t border-gray-100 dark:border-border/50 print:border-gray-300"
                                >
                                    <td class="py-2 px-3 font-mono text-xs font-medium text-gray-900 dark:text-white">
                                        {{ order.order_number }}
                                    </td>
                                    <td class="py-2 px-3 text-gray-600 dark:text-gray-400 text-xs">
                                        {{ formatTime(order.created_at) }}
                                    </td>
                                    <td class="py-2 px-3 text-gray-600 dark:text-gray-400">
                                        {{ order.customer?.name || 'Público General' }}
                                    </td>
                                    <td class="py-2 px-3">
                                        <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold print:px-0 print:bg-transparent"
                                            :class="{
                                                'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': order.payment_method === 'cash',
                                                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400': order.payment_method === 'card',
                                                'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400': order.payment_method === 'transfer',
                                                'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400': order.payment_method === 'credit',
                                            }"
                                        >
                                            {{ paymentMethodLabel(order.payment_method) }}
                                        </span>
                                    </td>
                                    <td class="py-2 px-3 text-gray-600 dark:text-gray-400 text-xs">
                                        {{ statusLabel(order.status) }}
                                    </td>
                                    <td class="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                                        {{ formatCurrency(order.total) }}
                                    </td>
                                </tr>
                                <tr v-if="salesOrders.length === 0">
                                    <td colspan="6" class="py-8 text-center text-gray-500 dark:text-gray-400">
                                        No se registraron ventas en esta sesión.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Print footer -->
                <div class="hidden print:block mt-6 pt-4 border-t border-gray-300">
                    <div class="flex justify-between text-[10px] text-gray-500">
                        <span>Impreso: {{ new Date().toLocaleString('es-MX') }}</span>
                        <span>Sesión #{{ session.id }} — {{ session.user?.name }}</span>
                    </div>
                    <div class="mt-8 grid grid-cols-2 gap-16">
                        <div class="text-center">
                            <div class="border-t border-gray-400 pt-1 text-[10px] text-gray-600">Firma del Cajero</div>
                        </div>
                        <div class="text-center">
                            <div class="border-t border-gray-400 pt-1 text-[10px] text-gray-600">Firma del Supervisor</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
@media print {
    body * {
        visibility: hidden;
    }
    .fixed.inset-0,
    .fixed.inset-0 * {
        visibility: visible;
    }
    .fixed.inset-0 {
        position: absolute;
        inset: 0;
        background: white;
    }
    @page {
        size: letter;
        margin: 0.5cm;
    }
}
</style>
