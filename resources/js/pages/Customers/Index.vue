<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import type { BreadcrumbItem } from '@/types'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  Building2,
  User,
  FilterX,
} from 'lucide-vue-next'
import Pagination from '@/components/Pagination.vue'
import { useCustomers } from '@/composables/useCustomers'
import type { Customer } from '@/types/customer'

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Clientes', href: '/customers' },
]

const {
  customers,
  loading,
  error,
  filters,
  currentPage,
  lastPage,
  total,
  perPage,
  fetchCustomers,
  deleteCustomer,
  applyFilters,
  clearFilters,
} = useCustomers()

// Confirmation dialog
const showDeleteDialog = ref(false)
const customerToDelete = ref<Customer | null>(null)

onMounted(() => {
  fetchCustomers()
})

const confirmDelete = (customer: Customer) => {
  customerToDelete.value = customer
  showDeleteDialog.value = true
}

const handleDelete = async () => {
  if (customerToDelete.value) {
    try {
      await deleteCustomer(customerToDelete.value.id)
      showDeleteDialog.value = false
      customerToDelete.value = null
    } catch (err) {
      // Error is handled in composable
    }
  }
}

const getStatusBadgeClass = (status: string) => {
  return {
    active: 'bg-green-100 text-green-800 border-green-200',
    inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    blocked: 'bg-red-100 text-red-800 border-red-200',
  }[status] || 'bg-gray-100 text-gray-800'
}

const getTypeBadgeClass = (type: string) => {
  return type === 'business'
    ? 'bg-blue-100 text-blue-800 border-blue-200'
    : 'bg-purple-100 text-purple-800 border-purple-200'
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}
</script>

<template>
  <Head title="Clientes" />

  <AppLayout :breadcrumbs="breadcrumbs">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Clientes</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Gestiona tu cartera de clientes</p>
      </div>
      <Link
        href="/customers/create"
        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        <Plus :size="20" />
        Nuevo Cliente
      </Link>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
      <div class="grid gap-4 md:grid-cols-5">
        <!-- Search -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
          <div class="relative">
            <Search class="absolute left-3 top-2.5 text-gray-400" :size="20" />
            <input
              v-model="filters.search"
              type="text"
              placeholder="Código, nombre, email, teléfono..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              @keyup.enter="applyFilters"
            />
          </div>
        </div>

        <!-- Type -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select
            v-model="filters.type"
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option :value="undefined">Todos</option>
            <option value="individual">Individual</option>
            <option value="business">Empresa</option>
          </select>
        </div>

        <!-- Status -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            v-model="filters.status"
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option :value="undefined">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>

        <!-- Actions -->
        <div class="flex items-end gap-2">
          <button
            @click="applyFilters"
            class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            :disabled="loading"
          >
            Filtrar
          </button>
          <button
            @click="clearFilters"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            title="Limpiar filtros"
          >
            <FilterX :size="20" />
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid gap-4 md:grid-cols-4 mb-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <User :size="24" class="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Total Clientes</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ total }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <User :size="24" class="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Activos</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ customers.filter((c) => c.status === 'active').length }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Building2 :size="24" class="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Empresas</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ customers.filter((c) => c.type === 'business').length }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <DollarSign :size="24" class="text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Con Crédito</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ customers.filter((c) => c.credit_limit > 0).length }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="error" class="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
      {{ error }}
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Código
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contacto
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Saldo
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                L. Crédito
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="loading">
              <td colspan="8" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                Cargando clientes...
              </td>
            </tr>
            <tr v-else-if="customers.length === 0">
              <td colspan="8" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                No se encontraron clientes
              </td>
            </tr>
            <tr v-else v-for="customer in customers" :key="customer.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ customer.code }}</span>
              </td>
              <td class="px-6 py-4">
                <div>
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ customer.name }}</div>
                  <div v-if="customer.tax_id" class="text-sm text-gray-500 dark:text-gray-400">{{ customer.tax_id }}</div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  :class="getTypeBadgeClass(customer.type)"
                >
                  <Building2 v-if="customer.type === 'business'" :size="14" />
                  <User v-else :size="14" />
                  {{ customer.type === 'business' ? 'Empresa' : 'Individual' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm text-gray-900 dark:text-gray-100">{{ customer.email || '-' }}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">{{ customer.phone || '-' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="text-sm font-medium"
                  :class="customer.current_balance > 0 ? 'text-red-600' : 'text-gray-900'"
                >
                  {{ formatCurrency(customer.current_balance) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900 dark:text-gray-100">
                  {{ formatCurrency(customer.credit_limit) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  :class="getStatusBadgeClass(customer.status)"
                >
                  {{
                    customer.status === 'active'
                      ? 'Activo'
                      : customer.status === 'inactive'
                        ? 'Inactivo'
                        : 'Bloqueado'
                  }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <Link
                    :href="`/customers/${customer.id}`"
                    class="text-blue-600 hover:text-blue-900"
                    title="Ver detalles"
                  >
                    <Eye :size="18" />
                  </Link>
                  <Link
                    :href="`/customers/${customer.id}/edit`"
                    class="text-indigo-600 hover:text-indigo-900"
                    title="Editar"
                  >
                    <Edit :size="18" />
                  </Link>
                  <button
                    @click="confirmDelete(customer)"
                    class="text-red-600 hover:text-red-900"
                    title="Eliminar"
                  >
                    <Trash2 :size="18" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <Pagination
        v-if="lastPage > 1"
        :pagination="{
          current_page: currentPage,
          last_page: lastPage,
          per_page: perPage,
          total: total
        }"
        :loading="loading"
        @page-change="fetchCustomers"
      />
    </div>

    <!-- Delete Confirmation Dialog -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="showDeleteDialog = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Confirmar eliminación</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          ¿Estás seguro de que deseas eliminar al cliente
          <span class="font-semibold">{{ customerToDelete?.name }}</span>? Esta acción no se puede
          deshacer.
        </p>
        <div class="flex gap-3 justify-end">
          <button
            @click="showDeleteDialog = false"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            @click="handleDelete"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
