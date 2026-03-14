<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import apiClient from '@/services/api/client'
import { usePOS } from '@/composables/usePOS'
import {
  FileText, Plus, Search, Eye, Trash2, ArrowRightLeft, Download,
  Clock, CheckCircle, XCircle, Send, FileCheck, EyeOff, ShoppingCart
} from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

interface SalesQuote {
    id: number
    quote_number: string
    customer: { id: number; name: string } | null
    user: { id: number; name: string } | null
    date: string
    valid_until: string | null
    status: string
    status_label: string
    formatted_total: string
    total: number
    items: any[]
    converted_order_id: number | null
}

const quotes = ref<SalesQuote[]>([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const lastPage = ref(1)
const total = ref(0)

const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'draft', label: 'Borrador' },
    { value: 'sent', label: 'Enviada' },
    { value: 'sent_to_deposit', label: 'En Depósito' },
    { value: 'sent_to_cashier', label: 'En Caja' },
    { value: 'accepted', label: 'Aceptada' },
    { value: 'collected', label: 'Cobrada' },
    { value: 'rejected', label: 'Rechazada' },
    { value: 'expired', label: 'Expirada' },
    { value: 'converted', label: 'Convertida' },
]

const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
        draft:            'bg-gray-100 text-gray-800 dark:bg-card dark:text-gray-300',
        sent:             'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        sent_to_deposit:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        sent_to_cashier:  'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
        accepted:         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        collected:        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        rejected:         'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        expired:          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        converted:        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    }
    return colors[status] || colors.draft
}

import { Banknote } from 'lucide-vue-next'

const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
        draft:           Clock,
        sent:            Send,
        sent_to_deposit: Banknote,
        sent_to_cashier: ArrowRightLeft,
        accepted:        CheckCircle,
        collected:       CheckCircle,
        rejected:        XCircle,
        expired:         Clock,
        converted:       FileCheck,
    }
    return icons[status] || Clock
}

const fetchQuotes = async (page = 1) => {
    loading.value = true
    try {
        const params: Record<string, any> = { page, per_page: 20 }
        if (search.value) params.search = search.value
        if (statusFilter.value) params.status = statusFilter.value

        const res = await apiClient.get('/sales-quotes', { params })
        const data = res.data

        quotes.value = data.data ?? []
        currentPage.value = data.current_page ?? 1
        lastPage.value = data.last_page ?? 1
        total.value = data.total ?? 0
    } catch (e: any) {
        console.error('Error fetching quotes:', e)
    } finally {
        loading.value = false
    }
}

const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.')) return
    try {
        await apiClient.delete(`/sales-quotes/${id}`)
        await fetchQuotes(currentPage.value)
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al eliminar')
    }
}

const { loadQuoteAsSession } = usePOS()
const openingPOS = ref<number | null>(null)

const openQuoteInPOS = async (id: number) => {
    openingPOS.value = id
    try {
        const res = await apiClient.get(`/sales-quotes/${id}`)
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
        router.visit('/pos')
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al cargar la cotización en POS')
    } finally {
        openingPOS.value = null
    }
}

const handleTransition = async (id: number, action: 'send-to-deposit' | 'send-to-cashier' | 'mark-collected') => {
    const labels: Record<string, string> = {
        'send-to-deposit': 'enviar a Depósito',
        'send-to-cashier': 'enviar a Caja',
        'mark-collected':  'marcar como Cobrada',
    }
    if (!confirm(`¿Deseas ${labels[action]} esta cotización?`)) return
    try {
        await apiClient.post(`/sales-quotes/${id}/${action}`)
        
        if (action === 'send-to-cashier') {
            await openQuoteInPOS(id)
        } else {
            await fetchQuotes(currentPage.value)
        }
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al cambiar el estado')
    }
}

const handleConvert = async (id: number) => {
    if (!confirm('¿Convertir esta cotización a una Orden de Venta? Esto descontará el inventario.')) return
    try {
        const res = await apiClient.post(`/sales-quotes/${id}/convert`, {
            payment_method: 'cash',
            payment_status: 'pending',
        })
        alert(res.data.message || 'Cotización convertida exitosamente')
        await fetchQuotes(currentPage.value)
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al convertir')
    }
}

import PrintTicketModal from '@/components/POS/PrintTicketModal.vue'

const openPdf = (id: number, format: 'ticket' | 'proforma', mode: 'standard' | 'blind' = 'standard') => {
    // Legacy fallback, kept just in case but we use the modal now.
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
    window.open(`${baseUrl}/sales-quotes/${id}/${format}?mode=${mode}`, '_blank')
}

const showPrintModal = ref(false)
const selectedQuote = ref<SalesQuote | null>(null)

const openPrintModal = (quote: SalesQuote) => {
    selectedQuote.value = quote
    showPrintModal.value = true
}

const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => fetchQuotes())
</script>

<template>
    <Head title="Cotizaciones" />

    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <FileText class="w-8 h-8 text-indigo-600 dark:text-primary" />
                    Cotizaciones
                </h1>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Presupuestos y estimaciones para clientes
                </p>
            </div>
            <Link
                href="/pos"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition font-medium shadow-sm"
            >
                <Plus :size="20" />
                Nueva Cotización
            </Link>
        </div>

        <!-- Filters -->
        <div class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-4">
            <div class="flex flex-wrap gap-4 items-end">
                <div class="flex-1 min-w-[200px]">
                    <label class="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
                    <div class="relative">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
                        <input
                            v-model="search"
                            type="text"
                            placeholder="Número o cliente..."
                            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white text-sm"
                            @input="fetchQuotes(1)"
                        />
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                    <select
                        v-model="statusFilter"
                        @change="fetchQuotes(1)"
                        class="px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white text-sm"
                    >
                        <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400 ml-auto self-end pb-2">
                    {{ total }} cotizaciones
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="text-center py-12 text-gray-500">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-3"></div>
            Cargando cotizaciones...
        </div>

        <!-- Empty State -->
        <div v-else-if="quotes.length === 0" class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-12 text-center">
            <FileText class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p class="text-gray-500 dark:text-gray-400">No hay cotizaciones para mostrar.</p>
            <Link href="/sales-quotes/create" class="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition text-sm">
                <Plus :size="16" />
                Crear primera cotización
            </Link>
        </div>

        <!-- Table -->
        <div v-else class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                    <thead class="bg-gray-50 dark:bg-background">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">N° Cotización</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Válida hasta</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-for="q in quotes" :key="q.id" class="hover:bg-gray-50 dark:hover:bg-muted/50/50 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="relative group inline-block">
                                    <button class="text-sm font-semibold text-indigo-600 dark:text-primary dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 uppercase transition flex items-center gap-1">
                                        {{ q.quote_number }}
                                        <svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    <div class="absolute left-0 mt-1 w-44 bg-white dark:bg-card rounded-md shadow-lg border border-gray-200 dark:border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                        <div class="py-1">
                                            <button @click="openPdf(q.id, 'ticket', 'standard')" class="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted/50 flex items-center gap-2">
                                                <FileText class="w-4 h-4 text-gray-400" />
                                                Ticket Interno (80mm)
                                            </button>
                                            <button @click="openPdf(q.id, 'ticket', 'blind')" class="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted/50 flex items-center gap-2">
                                                <EyeOff class="w-4 h-4 text-gray-400" />
                                                Ticket Cliente (80mm)
                                            </button>
                                            <button @click="openPdf(q.id, 'proforma', 'standard')" class="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted/50 flex items-center gap-2">
                                                <FileText class="w-4 h-4 text-gray-400" />
                                                Proforma Interna (A4)
                                            </button>
                                            <button @click="openPdf(q.id, 'proforma', 'blind')" class="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted/50 flex items-center gap-2">
                                                <EyeOff class="w-4 h-4 text-gray-400" />
                                                Proforma Cliente (A4)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="text-sm text-gray-900 dark:text-white">{{ q.customer?.name || 'Público General' }}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {{ formatDate(q.date) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {{ formatDate(q.valid_until ?? '') }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <span class="text-sm font-bold text-gray-900 dark:text-white">{{ q.formatted_total }}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-center">
                                <span :class="[
                                    'px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full',
                                    getStatusColor(q.status)
                                ]">
                                    <component :is="getStatusIcon(q.status)" :size="12" />
                                    {{ q.status_label }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <div class="flex items-center justify-end gap-1">
                                    <!-- Workflow quick actions -->
                                    <button
                                        v-if="['draft','sent'].includes(q.status)"
                                        @click="handleTransition(q.id, 'send-to-deposit')"
                                        class="px-2 py-1 text-xs font-medium rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition border border-amber-200 dark:border-amber-500/30"
                                        title="Enviar a Depósito"
                                    >→ Depósito</button>
                                    <button
                                        v-if="['draft','sent','sent_to_deposit'].includes(q.status)"
                                        @click="handleTransition(q.id, 'send-to-cashier')"
                                        class="px-2 py-1 text-xs font-medium rounded-md bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 hover:bg-sky-100 transition border border-sky-200 dark:border-sky-500/30"
                                        title="Enviar a Caja"
                                    >→ Caja</button>
                                    <button
                                        v-if="['sent_to_cashier','accepted'].includes(q.status)"
                                        @click="handleTransition(q.id, 'mark-collected')"
                                        class="px-2 py-1 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition border border-emerald-200 dark:border-emerald-500/30"
                                        title="Marcar como Cobrada"
                                    >✓ Cobrar</button>

                                    <!-- Standard actions -->
                                    <Link
                                        :href="`/sales-quotes/${q.id}`"
                                        class="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 dark:text-primary hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                                        title="Ver detalle"
                                    >
                                        <Eye :size="16" />
                                    </Link>
                                    <!-- Abrir/Editar en POS -->
                                    <button
                                        v-if="q.status !== 'converted' && q.status !== 'rejected' && q.status !== 'expired' && q.status !== 'collected'"
                                        @click="openQuoteInPOS(q.id)"
                                        :disabled="openingPOS === q.id"
                                        class="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition disabled:opacity-40"
                                        title="Editar en POS"
                                    >
                                        <ShoppingCart :size="16" />
                                    </button>
                                    <button 
                                        @click="openPrintModal(q)"
                                        class="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 dark:text-primary hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition" 
                                        title="Imprimir Ticket / Documento"
                                    >
                                        <Download :size="16" />
                                    </button>
                                    <button
                                        v-if="q.status !== 'converted'"
                                        @click="handleDelete(q.id)"
                                        class="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                        title="Eliminar"
                                    >
                                        <Trash2 :size="16" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div v-if="lastPage > 1" class="px-6 py-4 border-t border-gray-200 dark:border-border flex justify-center gap-2">
                <button
                    v-for="page in lastPage"
                    :key="page"
                    @click="fetchQuotes(page)"
                    :class="[
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        page === currentPage
                            ? 'bg-indigo-600 dark:bg-primary dark:text-primary-foreground text-white'
                            : 'bg-white dark:bg-card text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50'
                    ]"
                >
                    {{ page }}
                </button>
            </div>
        </div>
        
        <PrintTicketModal
            :show="showPrintModal"
            :order-id="selectedQuote?.id ?? null"
            :order-number="selectedQuote?.quote_number"
            sourceRoute="sales-quotes"
            @close="showPrintModal = false"
        />
    </div>
</template>
