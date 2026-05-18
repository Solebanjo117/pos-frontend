<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';
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
} from 'lucide-vue-next';
import Pagination from '@/components/Pagination.vue';
import { useCustomers } from '@/composables/useCustomers';
import type { Customer } from '@/types/customer';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Clientes', href: '/customers' },
];

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
} = useCustomers();

// Confirmation dialog
const showDeleteDialog = ref(false);
const customerToDelete = ref<Customer | null>(null);

onMounted(() => {
    fetchCustomers();
});

const confirmDelete = (customer: Customer) => {
    customerToDelete.value = customer;
    showDeleteDialog.value = true;
};

const handleDelete = async () => {
    if (customerToDelete.value) {
        try {
            await deleteCustomer(customerToDelete.value.id);
            showDeleteDialog.value = false;
            customerToDelete.value = null;
        } catch (err) {
            // Error is handled in composable
        }
    }
};

const getStatusBadgeClass = (status: string) => {
    return (
        {
            active: 'bg-green-100 text-green-800 border-green-200',
            inactive: 'bg-gray-100 text-gray-800 border-gray-200',
            blocked: 'bg-red-100 text-red-800 border-red-200',
        }[status] || 'bg-gray-100 text-gray-800'
    );
};

const getTypeBadgeClass = (type: string) => {
    return type === 'business'
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : 'bg-purple-100 text-purple-800 border-purple-200';
};

const filterByType = (type: string) => {
    filters.value.type = type as any;
    applyFilters();
};

const filterByStatus = (status: string) => {
    filters.value.status = status as any;
    applyFilters();
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(value);
};
</script>

<template>
    <Head title="Clientes" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Clientes
                </h1>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                    Gestiona tu cartera de clientes
                </p>
            </div>
            <Link
                href="/customers/create"
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
                <Plus :size="20" />
                Nuevo Cliente
            </Link>
        </div>

        <!-- Filters -->
        <div class="mb-6 rounded-lg bg-white p-4 shadow-sm dark:bg-card">
            <div class="grid gap-4 md:grid-cols-5">
                <!-- Search -->
                <div class="md:col-span-2">
                    <label
                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >Buscar</label
                    >
                    <div class="relative">
                        <Search
                            class="absolute top-2.5 left-3 text-gray-400"
                            :size="20"
                        />
                        <input
                            v-model="filters.search"
                            type="text"
                            placeholder="Código, nombre, email, teléfono..."
                            class="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-gray-100"
                            @keyup.enter="applyFilters"
                        />
                    </div>
                </div>

                <!-- Type -->
                <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700"
                        >Tipo</label
                    >
                    <select
                        v-model="filters.type"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-gray-100"
                    >
                        <option :value="undefined">Todos</option>
                        <option value="individual">Individual</option>
                        <option value="business">Empresa</option>
                    </select>
                </div>

                <!-- Status -->
                <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700"
                        >Estado</label
                    >
                    <select
                        v-model="filters.status"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-gray-100"
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
                        class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        :disabled="loading"
                    >
                        Filtrar
                    </button>
                    <button
                        @click="clearFilters"
                        class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition hover:bg-gray-300"
                        title="Limpiar filtros"
                    >
                        <FilterX :size="20" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="mb-6 grid gap-4 md:grid-cols-4">
            <div class="rounded-lg bg-white p-4 shadow-sm dark:bg-card">
                <div class="flex items-center gap-3">
                    <div
                        class="rounded-lg bg-indigo-100 p-3 dark:bg-indigo-900/30"
                    >
                        <User
                            :size="24"
                            class="text-indigo-600 dark:text-indigo-400 dark:text-primary"
                        />
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Total Clientes
                        </p>
                        <p
                            class="text-2xl font-bold text-gray-900 dark:text-gray-100"
                        >
                            {{ total }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="rounded-lg bg-white p-4 shadow-sm dark:bg-card">
                <div class="flex items-center gap-3">
                    <div
                        class="rounded-lg bg-green-100 p-3 dark:bg-green-900/30"
                    >
                        <User
                            :size="24"
                            class="text-green-600 dark:text-green-400"
                        />
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Activos
                        </p>
                        <p
                            class="text-2xl font-bold text-gray-900 dark:text-gray-100"
                        >
                            {{
                                customers.filter((c) => c.status === 'active')
                                    .length
                            }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="rounded-lg bg-white p-4 shadow-sm dark:bg-card">
                <div class="flex items-center gap-3">
                    <div class="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                        <Building2
                            :size="24"
                            class="text-blue-600 dark:text-blue-400 dark:text-primary"
                        />
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Empresas
                        </p>
                        <p
                            class="text-2xl font-bold text-gray-900 dark:text-gray-100"
                        >
                            {{
                                customers.filter((c) => c.type === 'business')
                                    .length
                            }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="rounded-lg bg-white p-4 shadow-sm dark:bg-card">
                <div class="flex items-center gap-3">
                    <div
                        class="rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900/30"
                    >
                        <DollarSign
                            :size="24"
                            class="text-yellow-600 dark:text-yellow-400"
                        />
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Con Crédito
                        </p>
                        <p
                            class="text-2xl font-bold text-gray-900 dark:text-gray-100"
                        >
                            {{
                                customers.filter((c) => c.credit_limit > 0)
                                    .length
                            }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error message -->
        <div
            v-if="error"
            class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-200"
        >
            {{ error }}
        </div>

        <!-- Table -->
        <div class="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-card">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead
                        class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-muted"
                    >
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                            >
                                Código
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >
                                Cliente
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >
                                Tipo
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >
                                Contacto
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >
                                Saldo
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >
                                L. Crédito
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >
                                Estado
                            </th>
                            <th
                                class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody
                        class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                    >
                        <tr v-if="loading">
                            <td
                                colspan="8"
                                class="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                            >
                                Cargando clientes...
                            </td>
                        </tr>
                        <tr v-else-if="customers.length === 0">
                            <td
                                colspan="8"
                                class="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                            >
                                No se encontraron clientes
                            </td>
                        </tr>
                        <tr
                            v-else
                            v-for="customer in customers"
                            :key="customer.id"
                            class="hover:bg-gray-50 dark:hover:bg-muted/50"
                        >
                            <td class="px-6 py-4 whitespace-nowrap">
                                <Link
                                    :href="`/customers/${customer.id}`"
                                    class="text-sm font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-primary"
                                    title="Ver cliente"
                                >
                                    {{ customer.code }}
                                </Link>
                            </td>
                            <td class="px-6 py-4">
                                <div>
                                    <Link
                                        :href="`/customers/${customer.id}`"
                                        class="text-sm font-medium text-gray-900 underline-offset-2 hover:text-indigo-600 hover:underline dark:text-gray-100 dark:hover:text-primary"
                                        title="Ver cliente"
                                    >
                                        {{ customer.name }}
                                    </Link>
                                    <div
                                        v-if="customer.tax_id"
                                        class="text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        {{ customer.tax_id }}
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                                    :class="getTypeBadgeClass(customer.type)"
                                    title="Filtrar por tipo"
                                    @click="filterByType(customer.type)"
                                >
                                    <Building2
                                        v-if="customer.type === 'business'"
                                        :size="14"
                                    />
                                    <User v-else :size="14" />
                                    {{
                                        customer.type === 'business'
                                            ? 'Empresa'
                                            : 'Individual'
                                    }}
                                </button>
                            </td>
                            <td class="px-6 py-4">
                                <div
                                    class="text-sm text-gray-900 dark:text-gray-100"
                                >
                                    {{ customer.email || '-' }}
                                </div>
                                <div
                                    class="text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {{ customer.phone || '-' }}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <Link
                                    v-if="customer.current_balance > 0"
                                    :href="`/ar?customer_id=${customer.id}`"
                                    class="text-sm font-medium"
                                    :class="'text-red-600 underline-offset-2 hover:underline'"
                                    title="Ver cuenta por cobrar"
                                >
                                    {{
                                        formatCurrency(customer.current_balance)
                                    }}
                                </Link>
                                <span
                                    v-else
                                    class="text-sm font-medium text-gray-900"
                                >
                                    {{
                                        formatCurrency(customer.current_balance)
                                    }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span
                                    class="text-sm text-gray-900 dark:text-gray-100"
                                >
                                    {{ formatCurrency(customer.credit_limit) }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <button
                                    type="button"
                                    class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium"
                                    :class="
                                        getStatusBadgeClass(customer.status)
                                    "
                                    title="Filtrar por estado"
                                    @click="filterByStatus(customer.status)"
                                >
                                    {{
                                        customer.status === 'active'
                                            ? 'Activo'
                                            : customer.status === 'inactive'
                                              ? 'Inactivo'
                                              : 'Bloqueado'
                                    }}
                                </button>
                            </td>
                            <td
                                class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap"
                            >
                                <div
                                    class="flex items-center justify-end gap-2"
                                >
                                    <Link
                                        :href="`/customers/${customer.id}`"
                                        class="text-blue-600 hover:text-blue-900 dark:text-primary"
                                        title="Ver detalles"
                                    >
                                        <Eye :size="18" />
                                    </Link>
                                    <Link
                                        :href="`/customers/${customer.id}/edit`"
                                        class="text-indigo-600 hover:text-indigo-900 dark:text-primary"
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
                    total: total,
                }"
                :loading="loading"
                @page-change="fetchCustomers"
            />
        </div>

        <!-- Delete Confirmation Dialog -->
        <div
            v-if="showDeleteDialog"
            class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
            @click.self="showDeleteDialog = false"
        >
            <div
                class="w-full max-w-md rounded-lg border bg-white p-6 shadow-xl dark:border-border dark:bg-card"
            >
                <h3
                    class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                    Confirmar eliminación
                </h3>
                <p class="mb-6 text-gray-600 dark:text-gray-400">
                    ¿Estás seguro de que deseas eliminar al cliente
                    <span class="font-semibold">{{
                        customerToDelete?.name
                    }}</span
                    >? Esta acción no se puede deshacer.
                </p>
                <div class="flex justify-end gap-3">
                    <button
                        @click="showDeleteDialog = false"
                        class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                    >
                        Cancelar
                    </button>
                    <button
                        @click="handleDelete"
                        class="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
