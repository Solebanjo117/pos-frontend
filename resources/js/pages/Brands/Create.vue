<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { ArrowLeft, Save } from 'lucide-vue-next';
import { ref, onMounted } from 'vue';
import { useBrands } from '@/composables/useBrands';
import { useSuppliers } from '@/composables/useSuppliers';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import type { CreateBrandData } from '@/types/brand';
import type { Supplier } from '@/types/supplier';

const { loading, error, createBrand } = useBrands();
const { fetchActiveSuppliers } = useSuppliers();
const toast = useToast();
const availableSuppliers = ref<Supplier[]>([]);

const form = ref<CreateBrandData>({
    name: '',
    description: '',
    logo_url: '',
    website: '',
    supplier_ids: [],
});

onMounted(async () => {
    availableSuppliers.value = await fetchActiveSuppliers();
});

async function handleSubmit() {
    try {
        await createBrand(form.value);
        toast.success('Marca creada correctamente');
        router.visit('/brands');
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al crear la marca');
    }
}

function goBack() {
    router.visit('/brands');
}
</script>

<template>
    <Head title="Nueva Marca" />
    <AppLayout>
        <div class="mx-auto max-w-2xl space-y-6">
            <!-- Header -->
            <div class="flex items-center gap-4">
                <button
                    @click="goBack"
                    class="p-2 text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <ArrowLeft :size="24" />
                </button>
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Nueva Marca
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Agrega una nueva marca de productos
                    </p>
                </div>
            </div>

            <!-- Error -->
            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
            >
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
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
                class="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
            >
                <!-- Name -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Nombre <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="form.name"
                        type="text"
                        required
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="Ej: Bosch, Denso, NGK..."
                    />
                </div>

                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Descripción
                    </label>
                    <textarea
                        v-model="form.description"
                        rows="3"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="Descripción de la marca..."
                    ></textarea>
                </div>

                <!-- Logo URL -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        URL del Logo
                    </label>
                    <input
                        v-model="form.logo_url"
                        type="url"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="https://ejemplo.com/logo.png"
                    />
                    <p class="mt-1 text-xs text-gray-500">
                        Logo de la marca (opcional)
                    </p>
                </div>

                <!-- Website -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Sitio Web
                    </label>
                    <input
                        v-model="form.website"
                        type="url"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="https://www.ejemplo.com"
                    />
                </div>

                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Proveedores
                    </label>
                    <div
                        class="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-300 bg-white p-3 dark:border-border dark:bg-muted"
                    >
                        <label
                            v-for="supplier in availableSuppliers"
                            :key="supplier.id"
                            class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                            <input
                                v-model="form.supplier_ids"
                                type="checkbox"
                                :value="supplier.id"
                                class="rounded"
                            />
                            <span>{{ supplier.name }}</span>
                        </label>
                        <p
                            v-if="availableSuppliers.length === 0"
                            class="text-sm text-gray-500 dark:text-gray-400"
                        >
                            No hay proveedores activos disponibles.
                        </p>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ form.supplier_ids?.length || 0 }} proveedor(es)
                        seleccionado(s)
                    </p>
                </div>

                <!-- Actions -->
                <div
                    class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-border"
                >
                    <button
                        type="button"
                        @click="goBack"
                        class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        :disabled="loading"
                        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        <Save :size="18" />
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
