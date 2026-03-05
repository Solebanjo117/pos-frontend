<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import apiClient from '@/services/api/client'
import {
    FileText, ArrowLeft, Edit, ArrowRightLeft, Download,
    Clock, CheckCircle, XCircle, Send, FileCheck, EyeOff,
    User, MapPin, Calendar, Package, Hash
} from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

const props = defineProps<{ id: number }>()

interface QuoteItem {
    id: number
    product_id: number
    product_name: string
    product_sku: string
    variant_id?: number
    variant?: { id: number; sku: string; brand?: { name: string } } | null
    warehouse_id: number
    warehouse?: { name: string } | null
    quantity: number
    unit_price: number
    discount_percent: number
    discount_amount: number
    tax_percent: number
    tax_amount: number
    subtotal: number
    total: number
}

interface SalesQuote {
    id: number
    quote_number: string
    customer: { id: number; name: string; code?: string; phone?: string; email?: string } | null
    user: { id: number; name: string } | null
    warehouse: { id: number; name: string } | null
    date: string
    valid_until: string | null
    status: string
    status_label: string
    subtotal: number
    tax_amount: number
    discount_amount: number
    total: number
    formatted_total: string
    notes: string | null
    converted_order_id: number | null
    converted_order?: { id: number; order_number: string } | null
    items: QuoteItem[]
}

const quote = ref<SalesQuote | null>(null)
const loading = ref(true)
const error = ref('')

const statusColors: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-800 dark:bg-card dark:text-gray-300',
    sent:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    accepted:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    expired:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    converted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
}

const statusIcons: Record<string, any> = {
    draft: Clock, sent: Send, accepted: CheckCircle,
    rejected: XCircle, expired: Clock, converted: FileCheck,
}

const fetchQuote = async () => {
    loading.value = true
    try {
        const res = await apiClient.get(`/sales-quotes/${props.id}`)
        quote.value = res.data
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al cargar la cotización'
    } finally {
        loading.value = false
    }
}

const formatDate = (d: string) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

import PrintTicketModal from '@/components/POS/PrintTicketModal.vue'

const formatCurrency = (v: number) => {
    return '$' + Number(v || 0).toFixed(2)
}

const openPdf = (format: 'ticket' | 'proforma', mode: 'standard' | 'blind' = 'standard') => {
    // Legacy fallback, kept just in case but we use the modal now.
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
    window.open(`${baseUrl}/sales-quotes/${props.id}/${format}?mode=${mode}`, '_blank')
}

const showPrintModal = ref(false)
const canEdit = () => quote.value && ['draft', 'sent'].includes(quote.value.status)
const canConvert = () => quote.value && ['draft', 'sent', 'accepted'].includes(quote.value.status) && !quote.value.converted_order_id

const handleConvert = async () => {
    if (!confirm('¿Convertir esta cotización a una Orden de Venta? Esto descontará el inventario.')) return
    try {
        const res = await apiClient.post(`/sales-quotes/${props.id}/convert`, {
            payment_method: 'cash',
            payment_status: 'pending',
        })
        alert(res.data.message || 'Cotización convertida exitosamente')
        await fetchQuote()
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al convertir')
    }
}

onMounted(fetchQuote)
</script>

<template>
    <Head :title="`Cotización ${quote?.quote_number || ''}`" />

    <div class="max-w-5xl mx-auto space-y-6">
        <!-- Loading -->
        <div v-if="loading" class="text-center py-20 text-gray-500">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-3"></div>
            Cargando cotización...
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <p class="text-red-600 dark:text-red-400 font-medium">{{ error }}</p>
            <Link href="/sales-quotes" class="text-sm text-indigo-600 dark:text-primary hover:underline mt-2 inline-block">← Volver al listado</Link>
        </div>

        <!-- Content -->
        <template v-else-if="quote">
            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <Link href="/sales-quotes" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-muted/50 transition">
                        <ArrowLeft :size="20" class="text-gray-500" />
                    </Link>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <FileText class="w-7 h-7 text-indigo-600 dark:text-primary" />
                            {{ quote.quote_number }}
                        </h1>
                        <div class="flex items-center gap-2 mt-1">
                            <span :class="['px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full', statusColors[quote.status] || statusColors.draft]">
                                <component :is="statusIcons[quote.status] || Clock" :size="12" />
                                {{ quote.status_label }}
                            </span>
                            <span class="text-xs text-gray-500">por {{ quote.user?.name || 'Sistema' }}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                    <!-- Print Modal Trigger -->
                    <button 
                        @click="showPrintModal = true"
                        class="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-muted/50 transition text-gray-700 dark:text-gray-300"
                    >
                        <Download :size="16" /> Imprimir Documento
                    </button>
                    <Link v-if="canEdit()" :href="`/sales-quotes/${quote.id}/edit`" class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition font-medium">
                        <Edit :size="16" /> Editar
                    </Link>
                    <button v-if="canConvert()" @click="handleConvert" class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium">
                        <ArrowRightLeft :size="16" /> Convertir a OV
                    </button>
                </div>
            </div>

            <!-- Info cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Customer -->
                <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-5">
                    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <User :size="14" /> Cliente
                    </h3>
                    <p class="font-medium text-gray-900 dark:text-white">{{ quote.customer?.name || 'Público General' }}</p>
                    <p v-if="quote.customer?.code" class="text-xs text-gray-500 mt-1">Código: {{ quote.customer.code }}</p>
                    <p v-if="quote.customer?.phone" class="text-xs text-gray-500">{{ quote.customer.phone }}</p>
                    <p v-if="quote.customer?.email" class="text-xs text-gray-500">{{ quote.customer.email }}</p>
                </div>

                <!-- Dates -->
                <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-5">
                    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Calendar :size="14" /> Fechas
                    </h3>
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Creada</span>
                            <span class="text-gray-900 dark:text-white">{{ formatDate(quote.date) }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Válida hasta</span>
                            <span class="text-gray-900 dark:text-white">{{ formatDate(quote.valid_until ?? '') }}</span>
                        </div>
                    </div>
                </div>

                <!-- Warehouse / OV link -->
                <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-5">
                    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <MapPin :size="14" /> Almacén
                    </h3>
                    <p class="font-medium text-gray-900 dark:text-white">{{ quote.warehouse?.name || '—' }}</p>
                    <div v-if="quote.converted_order_id" class="mt-3 pt-3 border-t border-gray-200 dark:border-border">
                        <p class="text-xs text-gray-500 mb-1">Convertida a:</p>
                        <Link :href="`/sales-orders/${quote.converted_order_id}`" class="text-sm font-semibold text-indigo-600 dark:text-primary hover:text-indigo-800 transition">
                            OV #{{ quote.converted_order?.order_number || quote.converted_order_id }}
                        </Link>
                    </div>
                </div>
            </div>

            <!-- Items table -->
            <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-border">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package :size="18" /> Productos ({{ quote.items.length }})
                    </h2>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cant.</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Precio U.</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Desc.</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Impuesto</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-border">
                            <tr v-for="(item, idx) in quote.items" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-muted/50/30">
                                <td class="px-6 py-4 text-sm text-gray-400 font-mono">{{ idx + 1 }}</td>
                                <td class="px-6 py-4">
                                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ item.product_name }}</div>
                                    <div class="text-xs text-gray-500">
                                        {{ item.variant?.sku || item.product_sku || '' }}
                                        <span v-if="item.variant?.brand?.name" class="ml-1 text-indigo-500">• {{ item.variant.brand.name }}</span>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">{{ item.quantity }}</td>
                                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">{{ formatCurrency(item.unit_price) }}</td>
                                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                    <div>{{ formatCurrency(item.discount_amount) }}</div>
                                    <div v-if="item.discount_percent > 0" class="text-xs text-green-600">({{ item.discount_percent }}%)</div>
                                </td>
                                <td class="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                    <div>{{ formatCurrency(item.tax_amount) }}</div>
                                    <div class="text-xs text-gray-400">({{ item.tax_percent }}%)</div>
                                </td>
                                <td class="px-6 py-4 text-sm text-right font-bold text-gray-900 dark:text-white">{{ formatCurrency(item.total) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Totals -->
                <div class="border-t border-gray-200 dark:border-border px-6 py-5">
                    <div class="flex justify-end">
                        <div class="w-72 space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-500">Subtotal</span>
                                <span class="text-gray-900 dark:text-white">{{ formatCurrency(quote.subtotal) }}</span>
                            </div>
                            <div v-if="quote.discount_amount > 0" class="flex justify-between text-sm">
                                <span class="text-gray-500">Descuento</span>
                                <span class="text-green-600">-{{ formatCurrency(quote.discount_amount) }}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-500">Impuestos</span>
                                <span class="text-gray-900 dark:text-white">{{ formatCurrency(quote.tax_amount) }}</span>
                            </div>
                            <div class="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-border pt-2 mt-2">
                                <span class="text-gray-900 dark:text-white">Total</span>
                                <span class="text-indigo-600 dark:text-primary">{{ quote.formatted_total }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Notes -->
            <div v-if="quote.notes" class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-5">
                <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notas</h3>
                <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ quote.notes }}</p>
            </div>
            
            <PrintTicketModal
                :show="showPrintModal"
                :order-id="quote.id ?? null"
                :order-number="quote.quote_number"
                sourceRoute="sales-quotes"
                @close="showPrintModal = false"
            />
        </template>
    </div>
</template>
