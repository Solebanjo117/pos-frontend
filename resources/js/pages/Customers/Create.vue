<script setup lang="ts">
import { ref } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';
import { ArrowLeft, Save, Building2, User } from 'lucide-vue-next';
import { useCustomers } from '@/composables/useCustomers';
import type { CustomerFormData } from '@/types/customer';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Clientes', href: '/customers' },
    { title: 'Nuevo Cliente', href: '/customers/create' },
];

const { createCustomer, loading, error } = useCustomers();

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
});

const handleSubmit = async () => {
    try {
        await createCustomer(form.value);
        router.visit('/customers');
    } catch (err) {
        // Error is handled in composable
    }
};

const goBack = () => {
    router.visit('/customers');
};
</script>

<template>
    <Head title="Nuevo Cliente" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <!-- Header -->
        <div class="mb-6 flex items-center gap-4">
            <button
                @click="goBack"
                class="rounded-lg p-2 transition hover:bg-gray-100 dark:hover:bg-muted/50"
                title="Volver"
            >
                <ArrowLeft :size="24" />
            </button>
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Nuevo Cliente
                </h1>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                    Registra un nuevo cliente en el sistema
                </p>
            </div>
        </div>

        <!-- Error message -->
        <div
            v-if="error"
            class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-200"
        >
            {{ error }}
        </div>

        <!-- Form -->
        <form
            @submit.prevent="handleSubmit"
            @keydown.enter="
                (e: KeyboardEvent) => {
                    if ((e.target as HTMLElement)?.tagName === 'INPUT')
                        e.preventDefault();
                }
            "
            class="rounded-lg bg-white p-6 shadow-sm dark:bg-card"
        >
            <!-- Type Selection -->
            <div class="mb-6">
                <label
                    class="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >Tipo de Cliente *</label
                >
                <div class="grid grid-cols-2 gap-4">
                    <label
                        class="relative flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition"
                        :class="
                            form.type === 'individual'
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                : 'border-gray-300 hover:border-gray-400 dark:border-border dark:hover:border-gray-500'
                        "
                    >
                        <input
                            v-model="form.type"
                            type="radio"
                            value="individual"
                            class="sr-only"
                        />
                        <User
                            :size="24"
                            :class="
                                form.type === 'individual'
                                    ? 'text-indigo-600 dark:text-primary'
                                    : 'text-gray-400'
                            "
                        />
                        <div>
                            <div
                                class="font-medium text-gray-900 dark:text-gray-100"
                            >
                                Individual
                            </div>
                            <div
                                class="text-sm text-gray-500 dark:text-gray-400"
                            >
                                Persona física
                            </div>
                        </div>
                    </label>

                    <label
                        class="relative flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition"
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
                        <Building2
                            :size="24"
                            :class="
                                form.type === 'business'
                                    ? 'text-indigo-600 dark:text-primary'
                                    : 'text-gray-400'
                            "
                        />
                        <div>
                            <div
                                class="font-medium text-gray-900 dark:text-gray-100"
                            >
                                Empresa
                            </div>
                            <div
                                class="text-sm text-gray-500 dark:text-gray-400"
                            >
                                Persona moral
                            </div>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Basic Information -->
            <div class="mb-6">
                <h3
                    class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                    Información Básica
                </h3>
                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Nombre Completo *</label
                        >
                        <input
                            v-model="form.name"
                            type="text"
                            required
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-gray-100"
                            placeholder="Nombre del cliente"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Email</label
                        >
                        <input
                            v-model="form.email"
                            type="email"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            placeholder="correo@ejemplo.com"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Teléfono</label
                        >
                        <input
                            v-model="form.phone"
                            type="tel"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            placeholder="(555) 123-4567"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Estado</label
                        >
                        <select
                            v-model="form.status"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
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
                <h3 class="mb-4 text-lg font-semibold text-gray-900">
                    Información Fiscal
                </h3>
                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >RFC / Tax ID</label
                        >
                        <input
                            v-model="form.tax_id"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            placeholder="XAXX010101000"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Razón Social</label
                        >
                        <input
                            v-model="form.tax_name"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            placeholder="Nombre fiscal de la empresa"
                        />
                    </div>
                </div>
            </div>

            <!-- Address -->
            <div class="mb-6">
                <h3 class="mb-4 text-lg font-semibold text-gray-900">
                    Dirección
                </h3>
                <div class="grid gap-4 md:grid-cols-2">
                    <div class="md:col-span-2">
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Dirección</label
                        >
                        <textarea
                            v-model="form.address"
                            rows="2"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            placeholder="Calle, número, colonia..."
                        ></textarea>
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Ciudad</label
                        >
                        <input
                            v-model="form.city"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Estado/Provincia</label
                        >
                        <input
                            v-model="form.state"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >País</label
                        >
                        <input
                            v-model="form.country"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Código Postal</label
                        >
                        <input
                            v-model="form.postal_code"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            <!-- Credit Settings -->
            <div class="mb-6">
                <h3 class="mb-4 text-lg font-semibold text-gray-900">
                    Configuración de Crédito
                </h3>
                <div class="grid gap-4 md:grid-cols-3">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Límite de Crédito</label
                        >
                        <input
                            v-model.number="form.credit_limit"
                            type="number"
                            min="0"
                            step="0.01"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Días de Crédito</label
                        >
                        <input
                            v-model.number="form.credit_days"
                            type="number"
                            min="0"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Saldo Inicial</label
                        >
                        <input
                            v-model.number="form.initial_balance"
                            type="number"
                            step="0.01"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                        <p
                            class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                        >
                            Puede ser negativo (a favor del cliente)
                        </p>
                    </div>
                </div>
            </div>

            <!-- Additional Contact -->
            <div class="mb-6">
                <h3 class="mb-4 text-lg font-semibold text-gray-900">
                    Contacto Adicional
                </h3>
                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Nombre del Contacto</label
                        >
                        <input
                            v-model="form.contact_person"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700"
                            >Teléfono del Contacto</label
                        >
                        <input
                            v-model="form.contact_phone"
                            type="tel"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            <!-- Notes -->
            <div class="mb-6">
                <label class="mb-1 block text-sm font-medium text-gray-700"
                    >Notas</label
                >
                <textarea
                    v-model="form.notes"
                    rows="3"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Notas adicionales sobre el cliente..."
                ></textarea>
            </div>

            <!-- Actions -->
            <div
                class="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-border"
            >
                <button
                    type="button"
                    @click="goBack"
                    class="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    :disabled="loading"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    :disabled="loading"
                >
                    <Save :size="20" />
                    {{ loading ? 'Guardando...' : 'Guardar Cliente' }}
                </button>
            </div>
        </form>
    </AppLayout>
</template>
