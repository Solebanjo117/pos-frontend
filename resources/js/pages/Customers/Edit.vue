<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { ArrowLeft, Save, Building2, User } from 'lucide-vue-next';
import { ref, onMounted } from 'vue';
import { useCustomers } from '@/composables/useCustomers';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';
import type { CustomerFormData } from '@/types/customer';

const props = defineProps<{
    customerId: number;
}>();

const { currentCustomer, updateCustomer, fetchCustomer, loading, error } =
    useCustomers();

const form = ref<Partial<CustomerFormData>>({});

const breadcrumbs = ref<BreadcrumbItem[]>([
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Clientes', href: '/customers' },
]);

onMounted(async () => {
    await fetchCustomer(props.customerId);
    if (currentCustomer.value) {
        breadcrumbs.value.push({
            title: currentCustomer.value.name,
            href: `/customers/${props.customerId}/edit`,
        });
        form.value = {
            type: currentCustomer.value.type,
            name: currentCustomer.value.name,
            email: currentCustomer.value.email ?? undefined,
            phone: currentCustomer.value.phone ?? undefined,
            tax_id: currentCustomer.value.tax_id ?? undefined,
            tax_name: currentCustomer.value.tax_name ?? undefined,
            address: currentCustomer.value.address ?? undefined,
            city: currentCustomer.value.city ?? undefined,
            state: currentCustomer.value.state ?? undefined,
            country: currentCustomer.value.country,
            postal_code: currentCustomer.value.postal_code ?? undefined,
            credit_limit: currentCustomer.value.credit_limit,
            credit_days: currentCustomer.value.credit_days,
            contact_person: currentCustomer.value.contact_person ?? undefined,
            contact_phone: currentCustomer.value.contact_phone ?? undefined,
            notes: currentCustomer.value.notes ?? undefined,
            status: currentCustomer.value.status,
        };
    }
});

const handleSubmit = async () => {
    try {
        await updateCustomer(props.customerId, form.value);
        router.visit(`/customers/${props.customerId}`);
    } catch (err) {
        // Error handled in composable
    }
};

const goBack = () => {
    router.visit(`/customers/${props.customerId}`);
};
</script>

<template>
    <Head :title="`Editar ${currentCustomer?.name || 'Cliente'}`" />

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
                    Editar Cliente
                </h1>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                    {{ currentCustomer?.name }}
                </p>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading && !currentCustomer" class="py-12 text-center">
            Cargando cliente...
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
            v-if="currentCustomer"
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
                            <p
                                class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                            >
                                Puede ser negativo (a favor del cliente)
                            </p>
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
                <div class="grid gap-4 md:grid-cols-2">
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
                    {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
                </button>
            </div>
        </form>
    </AppLayout>
</template>
