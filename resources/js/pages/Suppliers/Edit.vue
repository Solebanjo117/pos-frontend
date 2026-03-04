<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSuppliers } from '@/composables/useSuppliers'
import { ArrowLeft, Save } from 'lucide-vue-next'
import type { UpdateSupplierData } from '@/types/supplier'

const props = defineProps<{ supplierId: number }>()

const { supplier, loading, error, fetchSupplierById, updateSupplier } = useSuppliers()

const form = ref<UpdateSupplierData>({})

onMounted(async () => {
    await fetchSupplierById(props.supplierId)
    if (supplier.value) {
        form.value = {
            name: supplier.value.name,
            contact_name: supplier.value.contact_name || '',
            email: supplier.value.email || '',
            phone: supplier.value.phone || '',
            address: supplier.value.address || '',
            city: supplier.value.city || '',
            country: supplier.value.country || 'Panamá',
            payment_terms: supplier.value.payment_terms || '',
            lead_time_days: supplier.value.lead_time_days,
            notes: supplier.value.notes || '',
            status: supplier.value.status,
        }
    }
})

async function handleSubmit() {
    try {
        await updateSupplier(props.supplierId, form.value)
        router.visit(`/suppliers/${props.supplierId}`)
    } catch (e) {
        // Error handled in composable
    }
}
</script>

<template>
    <Head title="Editar Proveedor" />
    <AppLayout>
        <div class="max-w-3xl mx-auto space-y-6">
            <div class="flex items-center gap-4">
                <Link :href="`/suppliers/${supplierId}`" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                    <ArrowLeft :size="24" />
                </Link>
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Editar Proveedor</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ supplier?.name }}</p>
                </div>
            </div>

            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <form v-if="supplier" @submit.prevent="handleSubmit" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información General</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la Empresa *</label>
                            <input v-model="form.name" type="text" required class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Persona de Contacto</label>
                            <input v-model="form.contact_name" type="text" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                            <input v-model="form.email" type="email" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                            <input v-model="form.phone" type="text" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                            <select v-model="form.status" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                <option value="active">Activo</option>
                                <option value="inactive">Inactivo</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dirección</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
                            <input v-model="form.address" type="text" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ciudad</label>
                            <input v-model="form.city" type="text" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">País</label>
                            <input v-model="form.country" type="text" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                    </div>
                </div>

                <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información Comercial</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Términos de Pago</label>
                            <input v-model="form.payment_terms" type="text" placeholder="Ej: Net 30" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiempo de Entrega (días)</label>
                            <input v-model="form.lead_time_days" type="number" min="0" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                            <textarea v-model="form.notes" rows="3" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link :href="`/suppliers/${supplierId}`" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                        Cancelar
                    </Link>
                    <button type="submit" :disabled="loading" class="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition">
                        <Save :size="18" />
                        {{ loading ? 'Guardando...' : 'Actualizar Proveedor' }}
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
