<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { AlertCircle, Building2, DollarSign, ExternalLink, TrendingDown } from 'lucide-vue-next'
import apiClient from '@/services/api/client'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Cuentas por Pagar', href: '/accounts-payable' },
]

const suppliers = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const totalDebt = computed(() =>
    suppliers.value.reduce((sum: number, s: any) => sum + (s.total_debt || 0), 0)
)

const suppliersWithDebt = computed(() =>
    suppliers.value.filter((s: any) => s.total_debt > 0)
)

async function loadAccountsPayable() {
    loading.value = true
    error.value = null
    try {
        const res = await apiClient.get('/accounts-payable')
        suppliers.value = res.data.data || res.data
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al cargar las cuentas por pagar.'
    } finally {
        loading.value = false
    }
}

const formatCurrency = (v: any) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0)

onMounted(loadAccountsPayable)
</script>

<template>
    <Head title="Cuentas por Pagar" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
                        <TrendingDown :size="32" class="text-red-500" />
                        Cuentas por Pagar
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Balance de deuda con proveedores basado en órdenes de compra pendientes de pago
                    </p>
                </div>
                <Link href="/purchase-orders" class="inline-flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition">
                    <ExternalLink :size="16" />
                    Ver Órdenes de Compra
                </Link>
            </div>

            <!-- Summary Card -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
                    <p class="text-sm font-medium text-red-700 dark:text-red-300">Total Adeudado</p>
                    <p class="mt-2 text-3xl font-bold text-red-900 dark:text-red-200">{{ formatCurrency(totalDebt) }}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Proveedores con Deuda</p>
                    <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ suppliersWithDebt.length }}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Órdenes Pendientes</p>
                    <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                        {{ suppliers.reduce((sum: number, s: any) => sum + (s.pending_orders_count || 0), 0) }}
                    </p>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
                <AlertCircle :size="20" />{{ error }}
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>

            <!-- Table -->
            <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Building2 :size="20" class="text-indigo-500" />
                        Proveedores con Saldo Pendiente
                    </h2>
                </div>
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Proveedor</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Órdenes Pendientes</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total OCs</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pagado</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase font-bold text-red-600 dark:text-red-400">Saldo Pendiente</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr v-if="suppliers.length === 0">
                            <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                <DollarSign class="mx-auto mb-3 text-gray-300" :size="48" />
                                <p class="text-lg font-medium">¡Sin deudas pendientes!</p>
                                <p class="text-sm">Todas las órdenes de compra están liquidadas.</p>
                            </td>
                        </tr>
                        <tr v-for="s in suppliers" :key="s.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                            <td class="px-6 py-4">
                                <Link :href="`/suppliers/${s.id}`" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{{ s.name }}</Link>
                                <p class="text-xs text-gray-500 mt-0.5">{{ s.email }}</p>
                            </td>
                            <td class="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                                {{ s.pending_orders_count || 0 }}
                            </td>
                            <td class="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                                {{ formatCurrency(s.total_orders_amount) }}
                            </td>
                            <td class="px-6 py-4 text-right text-sm text-green-600 dark:text-green-400">
                                {{ formatCurrency(s.total_paid) }}
                            </td>
                            <td class="px-6 py-4 text-right">
                                <span :class="['text-sm font-bold', s.total_debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400']">
                                    {{ formatCurrency(s.total_debt) }}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <Link :href="`/purchase-orders?supplier_id=${s.id}`" class="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                    <ExternalLink :size="12" /> Ver OCs
                                </Link>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </AppLayout>
</template>
