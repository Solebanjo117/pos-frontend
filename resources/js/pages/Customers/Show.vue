<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import type { BreadcrumbItem } from '@/types'
import {
  ArrowLeft,
  Edit,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-vue-next'
import { useCustomers } from '@/composables/useCustomers'
import { CustomersApiService } from '@/services/customers'
import type { CustomerTransaction } from '@/types/customer'

const props = defineProps<{
  customerId: number
}>()

const { currentCustomer, balanceSummary, adjustBalance, fetchCustomer, loading, error } = useCustomers()

const transactions = ref<CustomerTransaction[]>([])
const transactionsLoading = ref(false)
const transactionsPage = ref(1)
const transactionsLastPage = ref(1)

const breadcrumbs = ref<BreadcrumbItem[]>([
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Clientes', href: '/customers' },
])

// Adjust balance modal
const showAdjustModal = ref(false)
const adjustForm = ref({
  amount: 0,
  reason: '',
})
const adjustLoading = ref(false)

onMounted(async () => {
  await fetchCustomer(props.customerId)
  if (currentCustomer.value) {
    breadcrumbs.value.push({
      title: currentCustomer.value.name,
      href: `/customers/${props.customerId}`,
    })
  }
  await loadTransactions()
})

const loadTransactions = async (page = 1) => {
  transactionsLoading.value = true
  try {
    const response = await CustomersApiService.getTransactions(props.customerId, page)
    transactions.value = response.data.data
    transactionsPage.value = response.data.current_page
    transactionsLastPage.value = response.data.last_page
  } catch (err) {
    console.error('Error loading transactions:', err)
  } finally {
    transactionsLoading.value = false
  }
}

const handleAdjustBalance = async () => {
  adjustLoading.value = true
  try {
    await adjustBalance(props.customerId, adjustForm.value.amount, adjustForm.value.reason)
    showAdjustModal.value = false
    adjustForm.value = { amount: 0, reason: '' }
    await loadTransactions() // Refresh transactions
  } catch (err) {
    // Error handled in composable
  } finally {
    adjustLoading.value = false
  }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getTransactionTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    sale: 'Venta',
    payment: 'Pago',
    credit_note: 'Nota de Crédito',
    adjustment: 'Ajuste',
  }
  return labels[type] || type
}

const getTransactionTypeBadge = (type: string) => {
  const badges: Record<string, string> = {
    sale: 'bg-red-100 text-red-800 border-red-200',
    payment: 'bg-green-100 text-green-800 border-green-200',
    credit_note: 'bg-blue-100 text-blue-800 border-blue-200',
    adjustment: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  }
  return badges[type] || 'bg-gray-100 text-gray-800 border-gray-200'
}

const goBack = () => {
  router.visit('/customers')
}
</script>

<template>
  <Head :title="currentCustomer?.name || 'Cliente'" />

  <AppLayout :breadcrumbs="breadcrumbs">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <button
          @click="goBack"
          class="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Volver"
        >
          <ArrowLeft :size="24" />
        </button>
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ currentCustomer?.name }}</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">{{ currentCustomer?.code }}</p>
        </div>
      </div>
      <Link
        :href="`/customers/${customerId}/edit`"
        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        <Edit :size="20" />
        Editar
      </Link>
    </div>

    <!-- Loading -->
    <div v-if="loading && !currentCustomer" class="text-center py-12">
      Cargando cliente...
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
      {{ error }}
    </div>

    <!-- Content -->
    <div v-if="currentCustomer" class="grid gap-6 lg:grid-cols-3">
      <!-- Main Info (2 columns) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Basic Information -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Información General</h2>
          
          <div class="grid gap-4 md:grid-cols-2">
            <div class="flex items-start gap-3">
              <div class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <component :is="currentCustomer.type === 'business' ? Building2 : User" :size="20" class="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Tipo</p>
                <p class="font-medium text-gray-900 dark:text-gray-100">
                  {{ currentCustomer.type === 'business' ? 'Empresa' : 'Individual' }}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FileText :size="20" class="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Estado</p>
                <span
                  class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  :class="
                    currentCustomer.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
                      : currentCustomer.status === 'inactive'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                  "
                >
                  {{
                    currentCustomer.status === 'active'
                      ? 'Activo'
                      : currentCustomer.status === 'inactive'
                        ? 'Inactivo'
                        : 'Bloqueado'
                  }}
                </span>
              </div>
            </div>

            <div v-if="currentCustomer.email" class="flex items-start gap-3">
              <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail :size="20" class="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <a :href="`mailto:${currentCustomer.email}`" class="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  {{ currentCustomer.email }}
                </a>
              </div>
            </div>

            <div v-if="currentCustomer.phone" class="flex items-start gap-3">
              <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Phone :size="20" class="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Teléfono</p>
                <a :href="`tel:${currentCustomer.phone}`" class="font-medium text-purple-600 dark:text-purple-400 hover:underline">
                  {{ currentCustomer.phone }}
                </a>
              </div>
            </div>

            <div v-if="currentCustomer.address" class="md:col-span-2 flex items-start gap-3">
              <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <MapPin :size="20" class="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Dirección</p>
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ currentCustomer.address }}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ currentCustomer.city }}{{ currentCustomer.state ? `, ${currentCustomer.state}` : '' }}
                  {{ currentCustomer.postal_code }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Fiscal Info -->
        <div v-if="currentCustomer.tax_id || currentCustomer.tax_name" class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Información Fiscal</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <div v-if="currentCustomer.tax_id">
              <p class="text-sm text-gray-600">RFC / Tax ID</p>
              <p class="font-medium text-gray-900">{{ currentCustomer.tax_id }}</p>
            </div>
            <div v-if="currentCustomer.tax_name">
              <p class="text-sm text-gray-600">Razón Social</p>
              <p class="font-medium text-gray-900">{{ currentCustomer.tax_name }}</p>
            </div>
          </div>
        </div>

        <!-- Additional Contact -->
        <div v-if="currentCustomer.contact_person || currentCustomer.contact_phone" class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Contacto Adicional</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <div v-if="currentCustomer.contact_person">
              <p class="text-sm text-gray-600">Persona de Contacto</p>
              <p class="font-medium text-gray-900">{{ currentCustomer.contact_person }}</p>
            </div>
            <div v-if="currentCustomer.contact_phone">
              <p class="text-sm text-gray-600">Teléfono de Contacto</p>
              <p class="font-medium text-gray-900">{{ currentCustomer.contact_phone }}</p>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="currentCustomer.notes" class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Notas</h2>
          <p class="text-gray-700 whitespace-pre-wrap">{{ currentCustomer.notes }}</p>
        </div>

        <!-- Transactions -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Movimientos de Cuenta</h2>
          
          <div v-if="transactionsLoading" class="text-center py-8 text-gray-500">
            Cargando movimientos...
          </div>
          
          <div v-else-if="transactions.length === 0" class="text-center py-8 text-gray-500">
            No hay movimientos registrados
          </div>
          
          <div v-else class="space-y-3">
            <div
              v-for="transaction in transactions"
              :key="transaction.id"
              class="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border"
                      :class="getTransactionTypeBadge(transaction.type)"
                    >
                      {{ getTransactionTypeLabel(transaction.type) }}
                    </span>
                    <span class="text-sm text-gray-500">{{ formatDate(transaction.transaction_date) }}</span>
                  </div>
                  <p v-if="transaction.description" class="text-sm text-gray-700">{{ transaction.description }}</p>
                </div>
                <div class="text-right ml-4">
                  <p
                    class="text-lg font-semibold"
                    :class="
                      transaction.type === 'payment' || transaction.type === 'credit_note'
                        ? 'text-green-600'
                        : 'text-red-600'
                    "
                  >
                    {{ transaction.type === 'payment' || transaction.type === 'credit_note' ? '-' : '+' }}
                    {{ formatCurrency(transaction.amount) }}
                  </p>
                  <p class="text-sm text-gray-500">
                    Saldo: {{ formatCurrency(transaction.balance_after) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="transactionsLastPage > 1" class="flex justify-center gap-2 pt-4">
              <button
                @click="loadTransactions(transactionsPage - 1)"
                :disabled="transactionsPage === 1"
                class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                @click="loadTransactions(transactionsPage + 1)"
                :disabled="transactionsPage === transactionsLastPage"
                class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar (1 column) -->
      <div class="space-y-6">
        <!-- Balance Summary -->
        <div v-if="balanceSummary" class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Resumen Financiero</h2>

          <div class="space-y-4">
            <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-gray-600 dark:text-gray-300">Saldo Actual</span>
                <component
                  :is="currentCustomer.current_balance > 0 ? TrendingUp : TrendingDown"
                  :size="18"
                  :class="currentCustomer.current_balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
                />
                />
              </div>
              <p
                class="text-2xl font-bold"
                :class="currentCustomer.current_balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
              >
                {{ formatCurrency(currentCustomer.current_balance) }}
              </p>
            </div>

            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div class="flex items-center gap-2 mb-1">
                <CreditCard :size="18" class="text-blue-600 dark:text-blue-400" />
                <span class="text-sm text-gray-600 dark:text-gray-300">Límite de Crédito</span>
              </div>
              <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {{ formatCurrency(balanceSummary.credit_limit) }}
              </p>
            </div>

            <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div class="flex items-center gap-2 mb-1">
                <DollarSign :size="18" class="text-green-600 dark:text-green-400" />
                <span class="text-sm text-gray-600 dark:text-gray-300">Crédito Disponible</span>
              </div>
              <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {{ formatCurrency(balanceSummary.available_credit) }}
              </p>
            </div>

            <div class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div class="flex items-center gap-2 mb-1">
                <Calendar :size="18" class="text-purple-600 dark:text-purple-400" />
                <span class="text-sm text-gray-600 dark:text-gray-300">Días de Crédito</span>
              </div>
              <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {{ balanceSummary.credit_days }} días
              </p>
            </div>

            <!-- Over limit warning -->
            <div v-if="balanceSummary.is_over_limit" class="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="flex items-center gap-2 text-red-800">
                <AlertCircle :size="20" />
                <span class="text-sm font-medium">Límite de crédito excedido</span>
              </div>
            </div>

            <!-- Adjust Balance Button -->
            <button
              @click="showAdjustModal = true"
              class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Ajustar Saldo
            </button>
          </div>
        </div>

        <!-- Dates -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Fechas</h2>
          <div class="space-y-3">
            <div>
              <p class="text-sm text-gray-600">Creado</p>
              <p class="font-medium text-gray-900">{{ formatDate(currentCustomer.created_at) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Última Actualización</p>
              <p class="font-medium text-gray-900">{{ formatDate(currentCustomer.updated_at) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Adjust Balance Modal -->
    <div
      v-if="showAdjustModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="showAdjustModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Ajustar Saldo</h3>
        
        <form @submit.prevent="handleAdjustBalance">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto</label>
            <input
              v-model.number="adjustForm.amount"
              type="number"
              step="0.01"
              required
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="0.00"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Positivo para aumentar saldo (cargo), negativo para disminuir (abono)
            </p>
          </div>

          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razón/Motivo *</label>
            <textarea
              v-model="adjustForm.reason"
              required
              rows="3"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Describe el motivo del ajuste..."
            ></textarea>
          </div>

          <div class="flex gap-3 justify-end">
            <button
              type="button"
              @click="showAdjustModal = false"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="adjustLoading"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              :disabled="adjustLoading"
            >
              {{ adjustLoading ? 'Guardando...' : 'Ajustar Saldo' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </AppLayout>
</template>
