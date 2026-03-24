<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { AccountsReceivableApiService, SalesOrderPaymentApiService } from '@/services/payments'
import { Search, User, FileText, Clock, ChevronRight } from 'lucide-vue-next'
import AddPaymentModal from '@/components/POS/AddPaymentModal.vue'

defineOptions({ layout: AppLayout })

const debtors = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

// Details panel
const selectedCustomer = ref<any | null>(null)
const customerOrders = ref<any[]>([])
const loadingDetails = ref(false)

// Payment modal
const showPaymentModal = ref(false)
const selectedOrder = ref<any | null>(null)
const paymentLoading = ref(false)
const paymentError = ref<string | null>(null)

const fetchDebtors = async () => {
    loading.value = true
    try {
        const res = await AccountsReceivableApiService.getDebtors({ search: searchQuery.value || undefined })
        // API returns paginated data: { data: [...], current_page, ... }
        debtors.value = res.data?.data ?? res.data ?? []
    } catch (e: any) {
        error.value = 'Error al cargar clientes con deuda'
        console.error(e)
    } finally {
        loading.value = false
    }
}

const selectCustomer = async (customer: any) => {
    selectedCustomer.value = customer
    loadingDetails.value = true
    try {
        const res = await AccountsReceivableApiService.getCustomerOrders(customer.id)
        // Laravel paginator returns { data: [...], current_page, etc }
        customerOrders.value = res.data?.data ?? res.data ?? []
    } catch (e: any) {
        console.error('Error loading customer orders:', e)
        customerOrders.value = []
    } finally {
        loadingDetails.value = false
    }
}

const openPayment = (order: any) => {
    selectedOrder.value = order
    showPaymentModal.value = true
}

const handlePaymentSubmit = async (payload: { amount: number; method: string; notes?: string }) => {
    if (!selectedOrder.value) return

    paymentLoading.value = true
    paymentError.value = null

    try {
        await SalesOrderPaymentApiService.addPayment(selectedOrder.value.id, {
            amount: payload.amount,
            method: payload.method as any,
            notes: payload.notes
        })
        
        showPaymentModal.value = false
        // Refresh data
        await selectCustomer(selectedCustomer.value)
        await fetchDebtors()
    } catch (e: any) {
        paymentError.value = e.response?.data?.message || 'Error al registrar el pago'
    } finally {
        paymentLoading.value = false
    }
}

const formatCurrency = (v: any) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0)
const formatDate = (d: string) => new Date(d).toLocaleDateString()

onMounted(() => fetchDebtors())

let searchTimeout: any
const onSearch = () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchDebtors(), 300)
}
</script>

<template>
    <Head title="Cuentas por Cobrar" />

    <div class="h-[calc(100vh-4rem)] flex overflow-hidden bg-gray-100 dark:bg-background">
        
        <!-- Left Panel: Debtors list -->
        <div class="w-1/3 border-r border-gray-200 dark:border-border bg-white dark:bg-card flex flex-col">
            <div class="p-4 border-b border-gray-200 dark:border-border">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Cuentas por Cobrar</h2>
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        v-model="searchQuery"
                        @input="onSearch"
                        type="text"
                        placeholder="Buscar cliente..."
                        class="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg text-sm bg-gray-50 dark:bg-muted text-gray-900 dark:text-white"
                    />
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1">
                <div v-if="loading" class="text-center py-4 text-gray-500">Cargando...</div>
                <div v-else-if="debtors.length === 0" class="text-center py-4 text-gray-500">
                    No hay clientes con saldos pendientes.
                </div>
                <template v-else>
                    <button
                        v-for="customer in debtors"
                        :key="customer.id"
                        @click="selectCustomer(customer)"
                        :class="[
                            'w-full text-left p-3 rounded-lg flex justify-between items-center transition-colors',
                            selectedCustomer?.id === customer.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800'
                                : 'hover:bg-gray-50 dark:hover:bg-muted/50/50'
                        ]"
                    >
                        <div>
                            <p class="font-medium text-gray-900 dark:text-white text-sm">{{ customer.name }}</p>
                            <p class="text-xs text-gray-500">{{ customer.code }}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-orange-600 dark:text-orange-400 text-sm">
                                {{ formatCurrency(customer.current_balance) }}
                            </p>
                        </div>
                    </button>
                </template>
            </div>
        </div>

        <!-- Right Panel: Customer Details & Open Orders -->
        <div class="flex-1 flex flex-col bg-gray-50 dark:bg-background">
            <div v-if="!selectedCustomer" class="flex-1 flex flex-col items-center justify-center text-gray-400">
                <FileText class="w-16 h-16 mb-4 opacity-20" />
                <p>Selecciona un cliente para ver sus deudas</p>
            </div>

            <template v-else>
                <!-- Customer Header -->
                <div class="bg-white dark:bg-card p-6 border-b border-gray-200 dark:border-border shadow-sm">
                    <div class="flex justify-between items-start">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedCustomer.name }}</h2>
                            <p class="text-gray-500 dark:text-gray-400">{{ selectedCustomer.email }} • {{ selectedCustomer.phone }}</p>
                        </div>
                        <div class="text-right bg-orange-50 dark:bg-orange-900/20 px-4 py-3 rounded-xl border border-orange-100 dark:border-orange-800/50">
                            <p class="text-xs font-semibold text-orange-800 dark:text-orange-200 uppercase tracking-wider mb-1">Deuda Total</p>
                            <p class="text-3xl font-black text-orange-600 dark:text-orange-400">
                                {{ formatCurrency(selectedCustomer.current_balance) }}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Orders List -->
                <div class="flex-1 overflow-y-auto p-6">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Órdenes Pendientes de Pago</h3>
                    
                    <div v-if="loadingDetails" class="text-gray-500">Cargando...</div>
                    <div v-else-if="customerOrders.length === 0" class="bg-white dark:bg-card p-6 text-center rounded-xl border border-gray-200 dark:border-border">
                        <p class="text-gray-500">No hay órdenes pendientes para este cliente.</p>
                    </div>
                    <div v-else class="space-y-4">
                        <div
                            v-for="order in customerOrders"
                            :key="order.id"
                            class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-5 flex items-center justify-between"
                        >
                            <div class="flex gap-4 items-center">
                                <div class="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-lg text-indigo-600 dark:text-primary dark:text-indigo-400">
                                    <FileText class="w-6 h-6" />
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <p class="font-bold text-gray-900 dark:text-white">{{ order.order_number }}</p>
                                        <span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                            {{ order.payment_status === 'partial' ? 'Pago Parcial' : 'Pendiente' }}
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                        <span class="flex items-center gap-1"><Clock class="w-3.5 h-3.5" /> {{ formatDate(order.date) }}</span>
                                        <span>Total: {{ formatCurrency(order.total) }}</span>
                                        <span v-if="order.amount_paid > 0">Pagado: {{ formatCurrency(order.amount_paid) }}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-6">
                                <div class="text-right">
                                    <p class="text-xs text-gray-500 font-medium lowercase">Resta por pagar</p>
                                    <p class="font-bold text-gray-900 dark:text-white text-lg">{{ formatCurrency(order.amount_due) }}</p>
                                </div>
                                <button
                                    @click="openPayment(order)"
                                    class="px-5 py-2.5 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white font-medium rounded-lg transition-colors shadow-sm"
                                >
                                    Abonar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- Payment Modal -->
        <AddPaymentModal
            v-if="selectedOrder"
            :show="showPaymentModal"
            :order-id="selectedOrder.id"
            :order-total="Number(selectedOrder.total)"
            :amount-paid="Number(selectedOrder.amount_paid)"
            :customer-name="selectedCustomer.name"
            :credit-available="undefined" 
            :loading="paymentLoading"
            :error="paymentError"
            @submit="handlePaymentSubmit"
            @close="showPaymentModal = false"
        />

    </div>
</template>
