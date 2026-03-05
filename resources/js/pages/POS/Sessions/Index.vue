<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import {
    Receipt, RefreshCw, Search, Eye, Printer, Calendar,
    Banknote, CreditCard, ArrowUpDown, ChevronLeft, ChevronRight,
    TrendingUp, TrendingDown, Minus, AlertCircle
} from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { PosSessionsApiService, type PosSessionRecord, type SessionSalesOrder } from '@/services/posSessions'
import { useWarehouses } from '@/composables/useWarehouses'
import { useUsers } from '@/composables/useUsers'
import { usePosSettings } from '@/composables/usePosSettings'
import SessionDetailModal from '@/components/POS/SessionDetailModal.vue'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Cierres de Caja', href: '/pos-sessions' },
]

const { warehouses, fetchWarehouses } = useWarehouses()
const { users, fetchUsers } = useUsers()
const { currentWarehouseId, initWarehouse } = usePosSettings()

// State
const sessions = ref<PosSessionRecord[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const pagination = ref({ current_page: 1, last_page: 1, total: 0, per_page: 15 })

// Filters
const filterStatus = ref<string>('closed')
const filterWarehouseId = ref<number | undefined>(undefined)
const filterUserId = ref<number | undefined>(undefined)
const filterDateFrom = ref<string>('')
const filterDateTo = ref<string>('')

// Detail modal
const selectedSession = ref<PosSessionRecord | null>(null)
const selectedSalesOrders = ref<SessionSalesOrder[]>([])
const showDetailModal = ref(false)
const loadingDetail = ref(false)

const fetchSessions = async (page: number = 1) => {
    loading.value = true
    error.value = null
    try {
        const response = await PosSessionsApiService.list({
            status: filterStatus.value || undefined,
            warehouse_id: filterWarehouseId.value,
            user_id: filterUserId.value,
            date_from: filterDateFrom.value || undefined,
            date_to: filterDateTo.value || undefined,
            page,
            per_page: pagination.value.per_page,
        })
        const paginatedData = response.data
        sessions.value = paginatedData.data || []
        pagination.value = {
            current_page: paginatedData.current_page,
            last_page: paginatedData.last_page,
            total: paginatedData.total,
            per_page: paginatedData.per_page,
        }
    } catch (err: any) {
        error.value = err.response?.data?.message || 'Error al cargar los cierres de caja.'
        console.error('Error fetching sessions:', err)
    } finally {
        loading.value = false
    }
}

const openDetail = async (session: PosSessionRecord) => {
    loadingDetail.value = true
    showDetailModal.value = true
    try {
        const response = await PosSessionsApiService.show(session.id)
        selectedSession.value = response.data
        selectedSalesOrders.value = response.sales_orders
    } catch (err: any) {
        console.error('Error fetching session detail:', err)
    } finally {
        loadingDetail.value = false
    }
}

const closeDetail = () => {
    showDetailModal.value = false
    selectedSession.value = null
    selectedSalesOrders.value = []
}

onMounted(async () => {
    await Promise.all([initWarehouse(), fetchWarehouses(), fetchUsers()])
    filterWarehouseId.value = currentWarehouseId.value || undefined
    await fetchSessions()
})

const applyFilters = () => fetchSessions(1)

const formatCurrency = (value: string | number | null | undefined): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0)
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(num)
}

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const getDifference = (session: PosSessionRecord): number => {
    return session.closing_details?.summary?.difference ?? 0
}

const getDifferenceClass = (session: PosSessionRecord): string => {
    const diff = getDifference(session)
    if (diff > 0) return 'text-emerald-600 dark:text-emerald-400'
    if (diff < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-500 dark:text-gray-400'
}

const getDifferenceLabel = (session: PosSessionRecord): string => {
    const diff = getDifference(session)
    if (diff > 0) return 'Sobrante'
    if (diff < 0) return 'Faltante'
    return 'Cuadra'
}
</script>

<template>
    <Head title="Cierres de Caja" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4 space-y-6">
            <!-- Header -->
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
                        <Receipt :size="32" class="text-indigo-500" />
                        Cierres de Caja
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Historial de sesiones de punto de venta cerradas
                    </p>
                </div>
            </div>

            <!-- Filters -->
            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700">
                <div class="flex flex-wrap items-end gap-4">
                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            <Calendar :size="12" class="inline mr-1" /> Desde
                        </label>
                        <input
                            v-model="filterDateFrom"
                            type="date"
                            class="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Hasta
                        </label>
                        <input
                            v-model="filterDateTo"
                            type="date"
                            class="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Sucursal
                        </label>
                        <select
                            v-model="filterWarehouseId"
                            class="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option :value="undefined">Todas</option>
                            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Cajero
                        </label>
                        <select
                            v-model="filterUserId"
                            class="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option :value="undefined">Todos</option>
                            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
                        </select>
                    </div>
                    <button
                        @click="applyFilters"
                        class="flex items-center gap-2 rounded-lg bg-indigo-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Search :size="16" />
                        Buscar
                    </button>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-800">
                <AlertCircle :size="20" />
                {{ error }}
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-16">
                <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <RefreshCw :size="20" class="animate-spin" />
                    Cargando cierres de caja...
                </div>
            </div>

            <!-- Table -->
            <div v-else class="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-card dark:ring-gray-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/50">
                                <th class="py-3 px-4 text-left font-semibold text-gray-600 dark:text-gray-400">Cajero</th>
                                <th class="py-3 px-4 text-left font-semibold text-gray-600 dark:text-gray-400">Sucursal</th>
                                <th class="py-3 px-4 text-left font-semibold text-gray-600 dark:text-gray-400">Apertura</th>
                                <th class="py-3 px-4 text-left font-semibold text-gray-600 dark:text-gray-400">Cierre</th>
                                <th class="py-3 px-4 text-right font-semibold text-gray-600 dark:text-gray-400">Fondo Inicial</th>
                                <th class="py-3 px-4 text-right font-semibold text-gray-600 dark:text-gray-400">Esperado</th>
                                <th class="py-3 px-4 text-right font-semibold text-gray-600 dark:text-gray-400">Declarado</th>
                                <th class="py-3 px-4 text-right font-semibold text-gray-600 dark:text-gray-400">Diferencia</th>
                                <th class="py-3 px-4 text-center font-semibold text-gray-600 dark:text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="session in sessions"
                                :key="session.id"
                                class="border-b border-gray-100 dark:border-border/50 hover:bg-gray-50 dark:hover:bg-muted/50/30 transition-colors"
                            >
                                <td class="py-3 px-4 font-medium text-gray-900 dark:text-white">
                                    {{ session.user?.name || '—' }}
                                </td>
                                <td class="py-3 px-4 text-gray-600 dark:text-gray-400">
                                    {{ session.warehouse?.name || 'General' }}
                                </td>
                                <td class="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                                    {{ formatDate(session.opened_at) }}
                                </td>
                                <td class="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                                    {{ formatDate(session.closed_at) }}
                                </td>
                                <td class="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                                    {{ formatCurrency(session.opening_amount) }}
                                </td>
                                <td class="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                                    {{ formatCurrency(session.expected_amount) }}
                                </td>
                                <td class="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                                    {{ formatCurrency(session.closing_amount) }}
                                </td>
                                <td class="py-3 px-4 text-right font-semibold" :class="getDifferenceClass(session)">
                                    <span class="inline-flex items-center gap-1">
                                        <TrendingUp v-if="getDifference(session) > 0" :size="14" />
                                        <TrendingDown v-else-if="getDifference(session) < 0" :size="14" />
                                        <Minus v-else :size="14" />
                                        {{ formatCurrency(getDifference(session)) }}
                                    </span>
                                    <span class="block text-[10px] font-normal opacity-70">{{ getDifferenceLabel(session) }}</span>
                                </td>
                                <td class="py-3 px-4 text-center">
                                    <button
                                        @click="openDetail(session)"
                                        class="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors"
                                    >
                                        <Eye :size="14" />
                                        Ver
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="sessions.length === 0">
                                <td colspan="9" class="py-12 text-center text-gray-500 dark:text-gray-400">
                                    No se encontraron cierres de caja con los filtros seleccionados.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div v-if="pagination.last_page > 1" class="flex items-center justify-between border-t border-gray-200 dark:border-border px-4 py-3">
                    <span class="text-sm text-gray-500 dark:text-gray-400">
                        {{ pagination.total }} cierre(s) en total
                    </span>
                    <div class="flex items-center gap-2">
                        <button
                            :disabled="pagination.current_page <= 1"
                            @click="fetchSessions(pagination.current_page - 1)"
                            class="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            <ChevronLeft :size="16" />
                        </button>
                        <span class="text-sm text-gray-700 dark:text-gray-300">
                            {{ pagination.current_page }} / {{ pagination.last_page }}
                        </span>
                        <button
                            :disabled="pagination.current_page >= pagination.last_page"
                            @click="fetchSessions(pagination.current_page + 1)"
                            class="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            <ChevronRight :size="16" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detail Modal -->
        <SessionDetailModal
            v-if="showDetailModal"
            :session="selectedSession"
            :salesOrders="selectedSalesOrders"
            :loading="loadingDetail"
            @close="closeDetail"
        />
    </AppLayout>
</template>
