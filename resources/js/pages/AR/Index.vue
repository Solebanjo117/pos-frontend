<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { AccountsReceivableApiService } from '@/services/payments'
import { Banknote, ChevronRight, Clock, FileText, Search, X } from 'lucide-vue-next'

defineOptions({ layout: AppLayout })

interface Debtor {
    id: number
    code?: string | null
    name: string
    email?: string | null
    phone?: string | null
    current_balance: number
    open_documents_count?: number
}

interface StatementDocument {
    id: number
    document_number: string
    date?: string | null
    total: number
    amount_paid: number
    amount_due: number
    payment_status: string
}

interface Statement {
    account: Debtor
    documents: StatementDocument[]
    entries: Array<Record<string, any>>
}

const debtors = ref<Debtor[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const selectedCustomer = ref<Debtor | null>(null)
const statement = ref<Statement | null>(null)
const loadingDetails = ref(false)

const showPaymentModal = ref(false)
const paymentLoading = ref(false)
const paymentError = ref<string | null>(null)
const paymentForm = reactive({
    amount: 0,
    method: 'cash',
    reference_number: '',
    notes: '',
    paid_at: '',
})
const manualApplications = ref<Record<number, number>>({})

const documents = computed(() => statement.value?.documents ?? [])
const entries = computed(() => statement.value?.entries ?? [])
const selectedBalance = computed(() => Number(statement.value?.account?.current_balance ?? selectedCustomer.value?.current_balance ?? 0))
const manualApplicationTotal = computed(() =>
    money(Object.values(manualApplications.value).reduce((total, amount) => total + Number(amount || 0), 0)),
)

const money = (value: number): number => Math.round((Number(value) || 0) * 100) / 100

const formatCurrency = (value: unknown): string =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)

const formatDate = (date?: string | null): string => {
    if (!date) return '-'

    return new Date(date).toLocaleDateString()
}

const extractDebtors = (response: any): Debtor[] => {
    const data = response?.data ?? response

    return Array.isArray(data) ? data : []
}

const fetchDebtors = async (): Promise<void> => {
    loading.value = true
    error.value = null

    try {
        const response = await AccountsReceivableApiService.getDebtors({
            search: searchQuery.value || undefined,
            per_page: 50,
        })
        debtors.value = extractDebtors(response)
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al cargar clientes con deuda.'
    } finally {
        loading.value = false
    }
}

const loadStatement = async (customer: Debtor): Promise<void> => {
    selectedCustomer.value = customer
    loadingDetails.value = true
    paymentError.value = null

    try {
        const response = await AccountsReceivableApiService.getCustomerStatement(customer.id)
        statement.value = response.data ?? response
    } catch (e: any) {
        statement.value = null
        paymentError.value = e.response?.data?.message || 'No se pudo cargar el estado de cuenta.'
    } finally {
        loadingDetails.value = false
    }
}

const openPayment = (): void => {
    if (!selectedCustomer.value) return

    paymentForm.amount = selectedBalance.value
    paymentForm.method = 'cash'
    paymentForm.reference_number = ''
    paymentForm.notes = ''
    paymentForm.paid_at = new Date().toISOString().slice(0, 10)
    manualApplications.value = {}
    paymentError.value = null
    showPaymentModal.value = true
}

const closePayment = (): void => {
    showPaymentModal.value = false
    paymentError.value = null
}

const setApplicationAmount = (documentId: number, value: string): void => {
    const parsed = money(Number(value))
    manualApplications.value = {
        ...manualApplications.value,
        [documentId]: parsed > 0 ? parsed : 0,
    }
}

const buildApplications = (): Array<{ document_id: number; amount: number }> | undefined => {
    const applications = Object.entries(manualApplications.value)
        .map(([documentId, amount]) => ({
            document_id: Number(documentId),
            amount: money(Number(amount)),
        }))
        .filter((application) => application.amount > 0)

    return applications.length > 0 ? applications : undefined
}

const handlePaymentSubmit = async (): Promise<void> => {
    if (!selectedCustomer.value) return

    paymentError.value = null
    const amount = money(paymentForm.amount)

    if (amount <= 0) {
        paymentError.value = 'El monto debe ser mayor a cero.'
        return
    }

    if (manualApplicationTotal.value > amount + 0.01) {
        paymentError.value = 'El monto aplicado excede el monto del recibo.'
        return
    }

    paymentLoading.value = true

    try {
        const response = await AccountsReceivableApiService.recordReceipt(selectedCustomer.value.id, {
            amount,
            method: paymentForm.method,
            reference_number: paymentForm.reference_number || undefined,
            notes: paymentForm.notes || undefined,
            paid_at: paymentForm.paid_at || undefined,
            applications: buildApplications(),
        })

        statement.value = response.data?.statement ?? response.statement ?? statement.value
        showPaymentModal.value = false
        await fetchDebtors()

        if (selectedCustomer.value) {
            const refreshed = debtors.value.find((customer) => customer.id === selectedCustomer.value?.id)
            if (refreshed) {
                selectedCustomer.value = refreshed
                await loadStatement(refreshed)
            } else {
                selectedCustomer.value = null
                statement.value = null
            }
        }
    } catch (e: any) {
        paymentError.value = e.response?.data?.message || 'Error al registrar el cobro.'
    } finally {
        paymentLoading.value = false
    }
}

let searchTimeout: ReturnType<typeof setTimeout> | undefined
const onSearch = (): void => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchDebtors(), 300)
}

onMounted(fetchDebtors)
</script>

<template>
    <Head title="Cuentas por Cobrar" />

    <div class="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-100 dark:bg-background">
        <aside class="flex w-80 flex-col border-r border-gray-200 bg-white dark:border-border dark:bg-card">
            <div class="border-b border-gray-200 p-4 dark:border-border">
                <h2 class="mb-4 text-lg font-bold text-gray-900 dark:text-white">Cuentas por Cobrar</h2>
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Buscar cliente..."
                        class="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        @input="onSearch"
                    />
                </div>
            </div>

            <div class="flex-1 space-y-1 overflow-y-auto p-2">
                <div v-if="loading" class="py-4 text-center text-gray-500">Cargando...</div>
                <div v-else-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
                <div v-else-if="debtors.length === 0" class="py-4 text-center text-gray-500">
                    No hay clientes con saldos pendientes.
                </div>
                <template v-else>
                    <button
                        v-for="customer in debtors"
                        :key="customer.id"
                        type="button"
                        :class="[
                            'flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors',
                            selectedCustomer?.id === customer.id
                                ? 'bg-indigo-50 text-indigo-950 dark:bg-indigo-900/40 dark:text-indigo-100'
                                : 'hover:bg-gray-50 dark:hover:bg-muted/50',
                        ]"
                        @click="loadStatement(customer)"
                    >
                        <div class="min-w-0">
                            <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ customer.name }}</p>
                            <p class="text-xs text-gray-500">{{ customer.code || `${customer.open_documents_count ?? 0} documento(s)` }}</p>
                        </div>
                        <div class="ml-3 text-right">
                            <p class="text-sm font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(customer.current_balance) }}</p>
                            <ChevronRight class="ml-auto h-4 w-4 text-gray-300" />
                        </div>
                    </button>
                </template>
            </div>
        </aside>

        <main class="flex min-w-0 flex-1 flex-col bg-gray-50 dark:bg-background">
            <div v-if="!selectedCustomer" class="flex flex-1 flex-col items-center justify-center text-gray-400">
                <FileText class="mb-4 h-16 w-16 opacity-20" />
                <p>Selecciona un cliente para ver sus deudas.</p>
            </div>

            <template v-else>
                <header class="border-b border-gray-200 bg-white p-5 shadow-sm dark:border-border dark:bg-card">
                    <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                            <h1 class="truncate text-2xl font-bold text-gray-900 dark:text-white">{{ selectedCustomer.name }}</h1>
                            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {{ [selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(' · ') || 'Sin contacto registrado' }}
                            </p>
                        </div>

                        <div class="flex items-center gap-4">
                            <div class="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-right dark:border-orange-800/50 dark:bg-orange-900/20">
                                <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-orange-800 dark:text-orange-200">Deuda total</p>
                                <p class="text-2xl font-black text-orange-600 dark:text-orange-400">{{ formatCurrency(selectedBalance) }}</p>
                            </div>
                            <button
                                type="button"
                                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                                :disabled="selectedBalance <= 0"
                                @click="openPayment"
                            >
                                <Banknote class="h-4 w-4" />
                                Pagar deuda
                            </button>
                        </div>
                    </div>
                </header>

                <section class="min-h-0 flex-1 overflow-y-auto p-5">
                    <div v-if="loadingDetails" class="text-gray-500">Cargando estado de cuenta...</div>
                    <div v-else class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div class="space-y-4">
                            <h2 class="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Documentos pendientes</h2>
                            <div v-if="documents.length === 0" class="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500 dark:border-border dark:bg-card">
                                No hay documentos pendientes para este cliente.
                            </div>
                            <div
                                v-for="document in documents"
                                :key="document.id"
                                class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                            >
                                <div class="flex min-w-0 items-center gap-4">
                                    <div class="rounded-lg bg-indigo-100 p-3 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                        <FileText class="h-5 w-5" />
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="font-bold text-gray-900 dark:text-white">{{ document.document_number }}</p>
                                            <span class="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                                {{ document.payment_status === 'partial' ? 'Pago parcial' : 'Pendiente' }}
                                            </span>
                                        </div>
                                        <div class="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                            <span class="flex items-center gap-1"><Clock class="h-3.5 w-3.5" /> {{ formatDate(document.date) }}</span>
                                            <span>Total: {{ formatCurrency(document.total) }}</span>
                                            <span>Pagado: {{ formatCurrency(document.amount_paid) }}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="ml-4 text-right">
                                    <p class="text-xs font-medium lowercase text-gray-500">Resta por pagar</p>
                                    <p class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(document.amount_due) }}</p>
                                </div>
                            </div>
                        </div>

                        <aside class="space-y-3">
                            <h2 class="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Últimos movimientos</h2>
                            <div class="rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card">
                                <div v-if="entries.length === 0" class="p-4 text-sm text-gray-500">Sin movimientos registrados.</div>
                                <div
                                    v-for="entry in entries.slice(0, 8)"
                                    :key="entry.id"
                                    class="border-b border-gray-100 p-3 text-sm last:border-b-0 dark:border-border"
                                >
                                    <div class="flex justify-between gap-3">
                                        <span class="font-medium text-gray-900 dark:text-white">{{ entry.batch_number || entry.reference_number || 'Movimiento' }}</span>
                                        <span class="font-bold text-green-600">{{ formatCurrency(entry.credit || entry.debit || 0) }}</span>
                                    </div>
                                    <p class="mt-1 text-xs text-gray-500">{{ formatDate(entry.occurred_at) }}</p>
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>
            </template>
        </main>

        <div v-if="showPaymentModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <form class="w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-card" @submit.prevent="handlePaymentSubmit">
                <header class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-border">
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Registrar cobro</h2>
                        <p class="text-sm text-gray-500">{{ selectedCustomer?.name }}</p>
                    </div>
                    <button type="button" class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" @click="closePayment">
                        <X class="h-5 w-5" />
                    </button>
                </header>

                <div class="space-y-4 p-5">
                    <div v-if="paymentError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ paymentError }}</div>

                    <div class="grid gap-4 md:grid-cols-2">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Monto
                            <input v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" required class="mt-1 block w-full rounded-md border-gray-300 text-right shadow-sm dark:border-border dark:bg-muted dark:text-white" />
                        </label>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Método
                            <select v-model="paymentForm.method" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:border-border dark:bg-muted dark:text-white">
                                <option value="cash">Efectivo</option>
                                <option value="card">Tarjeta</option>
                                <option value="transfer">Transferencia</option>
                                <option value="credit">Crédito</option>
                            </select>
                        </label>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Referencia
                            <input v-model="paymentForm.reference_number" type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:border-border dark:bg-muted dark:text-white" />
                        </label>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Fecha
                            <input v-model="paymentForm.paid_at" type="date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:border-border dark:bg-muted dark:text-white" />
                        </label>
                    </div>

                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Notas
                        <textarea v-model="paymentForm.notes" rows="2" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:border-border dark:bg-muted dark:text-white" />
                    </label>

                    <div v-if="documents.length > 0" class="rounded-lg border border-gray-200 dark:border-border">
                        <div class="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase text-gray-500 dark:border-border">
                            Aplicación manual opcional
                        </div>
                        <div
                            v-for="document in documents"
                            :key="`application-${document.id}`"
                            class="grid grid-cols-[1fr_130px] items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 dark:border-border"
                        >
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ document.document_number }}</p>
                                <p class="text-xs text-gray-500">Pendiente: {{ formatCurrency(document.amount_due) }}</p>
                            </div>
                            <input
                                type="number"
                                min="0"
                                :max="document.amount_due"
                                step="0.01"
                                class="rounded-md border-gray-300 text-right text-sm shadow-sm dark:border-border dark:bg-muted dark:text-white"
                                :value="manualApplications[document.id] || ''"
                                @input="setApplicationAmount(document.id, ($event.target as HTMLInputElement).value)"
                            />
                        </div>
                    </div>
                </div>

                <footer class="flex items-center justify-between border-t border-gray-200 px-5 py-4 dark:border-border">
                    <p class="text-xs text-gray-500">
                        Si no asignas documentos, el sistema aplicará el cobro automáticamente.
                    </p>
                    <div class="flex gap-2">
                        <button type="button" class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted" @click="closePayment">
                            Cancelar
                        </button>
                        <button type="submit" :disabled="paymentLoading" class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                            {{ paymentLoading ? 'Guardando...' : 'Registrar cobro' }}
                        </button>
                    </div>
                </footer>
            </form>
        </div>
    </div>
</template>
