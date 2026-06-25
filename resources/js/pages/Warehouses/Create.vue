<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { ref } from 'vue';
import { useWarehouses } from '@/composables/useWarehouses';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import type { CreateWarehouseRequest } from '@/types/warehouse';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Almacenes', href: '/warehouses' },
    { title: 'Crear Almacén', href: '/warehouses/create' },
];

const { createWarehouse, loading, error } = useWarehouses();

// Form data
const form = ref<CreateWarehouseRequest>({
    name: '',
    code: '',
    location: '',
    capacity: undefined,
    status: 'active',
    notes: '',
});

// Form errors
const formErrors = ref<Record<string, string>>({});

// Submit form
const handleSubmit = async () => {
    formErrors.value = {};

    try {
        await createWarehouse(form.value);
        // Redirect to warehouses list
        router.visit('/warehouses');
    } catch (err: any) {
        if (err.response?.data?.errors) {
            formErrors.value = err.response.data.errors;
        }
    }
};

// Cancel and go back
const handleCancel = () => {
    router.visit('/warehouses');
};
</script>

<template>
    <Head title="Crear Almacén" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                    Crear Almacén
                </h1>
                <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    Registra un nuevo almacén en el sistema
                </p>
            </div>

            <!-- Error Alert -->
            <div
                v-if="error"
                class="mb-6 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200"
            >
                <p>{{ error }}</p>
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
                class="rounded-lg bg-white p-6 shadow dark:bg-card"
            >
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <!-- Name -->
                    <div>
                        <label
                            for="name"
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                        >
                            Nombre <span class="text-red-500">*</span>
                        </label>
                        <input
                            id="name"
                            v-model="form.name"
                            type="text"
                            required
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                            :class="{ 'border-red-500': formErrors.name }"
                        />
                        <p
                            v-if="formErrors.name"
                            class="mt-1 text-sm text-red-600 dark:text-red-400"
                        >
                            {{ formErrors.name[0] }}
                        </p>
                    </div>

                    <!-- Code -->
                    <div>
                        <label
                            for="code"
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                        >
                            Código <span class="text-red-500">*</span>
                        </label>
                        <input
                            id="code"
                            v-model="form.code"
                            type="text"
                            required
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                            :class="{ 'border-red-500': formErrors.code }"
                        />
                        <p
                            v-if="formErrors.code"
                            class="mt-1 text-sm text-red-600 dark:text-red-400"
                        >
                            {{ formErrors.code[0] }}
                        </p>
                    </div>

                    <!-- Location -->
                    <div>
                        <label
                            for="location"
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                        >
                            Ubicación / Dirección
                        </label>
                        <input
                            id="location"
                            v-model="form.location"
                            type="text"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Capacity -->
                    <div>
                        <label
                            for="capacity"
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                        >
                            Capacidad Estimada
                        </label>
                        <input
                            id="capacity"
                            v-model.number="form.capacity"
                            type="number"
                            min="0"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Status -->
                    <div>
                        <label
                            for="status"
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                        >
                            Estado <span class="text-red-500">*</span>
                        </label>
                        <select
                            id="status"
                            v-model="form.status"
                            required
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                        </select>
                    </div>

                    <!-- Notes -->
                    <div class="md:col-span-2">
                        <label
                            for="notes"
                            class="block text-sm font-medium text-gray-900 dark:text-white"
                        >
                            Notas / Descripción
                        </label>
                        <textarea
                            id="notes"
                            v-model="form.notes"
                            rows="4"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        ></textarea>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        @click="handleCancel"
                        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        :disabled="loading"
                        class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        {{ loading ? 'Guardando...' : 'Crear Almacén' }}
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
