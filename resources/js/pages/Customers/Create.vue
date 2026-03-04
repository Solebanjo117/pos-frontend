<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import type { BreadcrumbItem } from '@/types'
import { ArrowLeft, Save, Building2, User } from 'lucide-vue-next'
import { useCustomers } from '@/composables/useCustomers'
import type { CustomerFormData } from '@/types/customer'

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Clientes', href: '/customers' },
  { title: 'Nuevo Cliente', href: '/customers/create' },
]

const { createCustomer, loading, error } = useCustomers()

const form = ref<CustomerFormData>({
  type: 'individual',
  name: '',
  email: '',
  phone: '',
  tax_id: '',
  tax_name: '',
  address: '',
  city: '',
  state: '',
  country: 'México',
  postal_code: '',
  credit_limit: 0,
  credit_days: 0,
  contact_person: '',
  contact_phone: '',
  notes: '',
  status: 'active',
  initial_balance: 0,
})

const handleSubmit = async () => {
  try {
    await createCustomer(form.value)
    router.visit('/customers')
  } catch (err) {
    // Error is handled in composable
  }
}

const goBack = () => {
  router.visit('/customers')
}
</script>

<template>
  <Head title="Nuevo Cliente" />

  <AppLayout :breadcrumbs="breadcrumbs">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <button
        @click="goBack"
        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        title="Volver"
      >
        <ArrowLeft :size="24" />
      </button>
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Nuevo Cliente</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Registra un nuevo cliente en el sistema</p>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="error" class="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
      {{ error }}
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <!-- Type Selection -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Tipo de Cliente *</label>
        <div class="grid grid-cols-2 gap-4">
          <label
            class="relative flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition"
            :class="
              form.type === 'individual'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            "
          >
            <input
              v-model="form.type"
              type="radio"
              value="individual"
              class="sr-only"
            />
            <User :size="24" :class="form.type === 'individual' ? 'text-indigo-600' : 'text-gray-400'" />
            <div>
              <div class="font-medium text-gray-900 dark:text-gray-100">Individual</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">Persona física</div>
            </div>
          </label>

          <label
            class="relative flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition"
            :class="
              form.type === 'business'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-gray-400'
            "
          >
            <input
              v-model="form.type"
              type="radio"
              value="business"
              class="sr-only"
            />
            <Building2 :size="24" :class="form.type === 'business' ? 'text-indigo-600' : 'text-gray-400'" />
            <div>
              <div class="font-medium text-gray-900 dark:text-gray-100">Empresa</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">Persona moral</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Basic Information -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Información Básica</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo *</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Nombre del cliente"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              v-model="form.email"
              type="email"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              v-model="form.phone"
              type="tel"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              v-model="form.status"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Fiscal Information -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Información Fiscal</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">RFC / Tax ID</label>
            <input
              v-model="form.tax_id"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="XAXX010101000"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
            <input
              v-model="form.tax_name"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nombre fiscal de la empresa"
            />
          </div>
        </div>
      </div>

      <!-- Address -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Dirección</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <textarea
              v-model="form.address"
              rows="2"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Calle, número, colonia..."
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input
              v-model="form.city"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Estado/Provincia</label>
            <input
              v-model="form.state"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">País</label>
            <input
              v-model="form.country"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
            <input
              v-model="form.postal_code"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <!-- Credit Settings -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Configuración de Crédito</h3>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Límite de Crédito</label>
            <input
              v-model.number="form.credit_limit"
              type="number"
              min="0"
              step="0.01"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Días de Crédito</label>
            <input
              v-model.number="form.credit_days"
              type="number"
              min="0"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
            <input
              v-model.number="form.initial_balance"
              type="number"
              step="0.01"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Puede ser negativo (a favor del cliente)</p>
          </div>
        </div>
      </div>

      <!-- Additional Contact -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Contacto Adicional</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del Contacto</label>
            <input
              v-model="form.contact_person"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono del Contacto</label>
            <input
              v-model="form.contact_phone"
              type="tel"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea
          v-model="form.notes"
          rows="3"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Notas adicionales sobre el cliente..."
        ></textarea>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          @click="goBack"
          class="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          :disabled="loading"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          :disabled="loading"
        >
          <Save :size="20" />
          {{ loading ? 'Guardando...' : 'Guardar Cliente' }}
        </button>
      </div>
    </form>
  </AppLayout>
</template>
