<script setup lang="ts">
import { onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSuppliers } from '@/composables/useSuppliers'
import { ArrowLeft, Pencil, Package, Mail, Phone, MapPin, Clock, CreditCard, Building2 } from 'lucide-vue-next'

const props = defineProps<{ supplierId: number }>()

const { supplier, supplierProducts, loading, error, fetchSupplierById } = useSuppliers()

onMounted(async () => {
    await fetchSupplierById(props.supplierId)
})
</script>

<template>
    <Head :title="supplier?.name || 'Proveedor'" />
    <AppLayout>
        <div class="max-w-4xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <Link href="/suppliers" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                        <ArrowLeft :size="24" />
                    </Link>
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ supplier?.name }}</h1>
                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Detalle del proveedor</p>
                    </div>
                </div>
                <Link v-if="supplier" :href="`/suppliers/${supplier.id}/edit`" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition">
                    <Pencil :size="18" />
                    Editar
                </Link>
            </div>

            <div v-if="loading" class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>

            <template v-else-if="supplier">
                <!-- Info Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Contact Info -->
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Building2 :size="20" class="text-indigo-500" />
                            Información de Contacto
                        </h2>
                        <dl class="space-y-3">
                            <div v-if="supplier.contact_name" class="flex items-start gap-2">
                                <dt class="text-sm text-gray-500 dark:text-gray-400 w-24 shrink-0">Contacto:</dt>
                                <dd class="text-sm text-gray-900 dark:text-white">{{ supplier.contact_name }}</dd>
                            </div>
                            <div v-if="supplier.email" class="flex items-start gap-2">
                                <Mail :size="16" class="text-gray-400 mt-0.5 shrink-0" />
                                <dd class="text-sm text-gray-900 dark:text-white">{{ supplier.email }}</dd>
                            </div>
                            <div v-if="supplier.phone" class="flex items-start gap-2">
                                <Phone :size="16" class="text-gray-400 mt-0.5 shrink-0" />
                                <dd class="text-sm text-gray-900 dark:text-white">{{ supplier.phone }}</dd>
                            </div>
                            <div v-if="supplier.address" class="flex items-start gap-2">
                                <MapPin :size="16" class="text-gray-400 mt-0.5 shrink-0" />
                                <dd class="text-sm text-gray-900 dark:text-white">
                                    {{ supplier.address }}
                                    <span v-if="supplier.city">, {{ supplier.city }}</span>
                                    <span v-if="supplier.country"> — {{ supplier.country }}</span>
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <!-- Commercial Info -->
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <CreditCard :size="20" class="text-indigo-500" />
                            Información Comercial
                        </h2>
                        <dl class="space-y-3">
                            <div class="flex items-start gap-2">
                                <dt class="text-sm text-gray-500 dark:text-gray-400 w-32 shrink-0">Estado:</dt>
                                <dd>
                                    <span :class="['px-2 py-1 text-xs font-semibold rounded-full', supplier.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400']">
                                        {{ supplier.status === 'active' ? 'Activo' : 'Inactivo' }}
                                    </span>
                                </dd>
                            </div>
                            <div v-if="supplier.payment_terms" class="flex items-start gap-2">
                                <CreditCard :size="16" class="text-gray-400 mt-0.5 shrink-0" />
                                <dd class="text-sm text-gray-900 dark:text-white">{{ supplier.payment_terms }}</dd>
                            </div>
                            <div v-if="supplier.lead_time_days" class="flex items-start gap-2">
                                <Clock :size="16" class="text-gray-400 mt-0.5 shrink-0" />
                                <dd class="text-sm text-gray-900 dark:text-white">{{ supplier.lead_time_days }} días de entrega</dd>
                            </div>
                        </dl>
                        <div v-if="supplier.notes" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <p class="text-sm text-gray-500 dark:text-gray-400">{{ supplier.notes }}</p>
                        </div>
                    </div>
                </div>

                <!-- Products Table -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                        <Package :size="20" class="text-indigo-500" />
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Productos Suministrados ({{ supplierProducts.length }})</h2>
                    </div>
                    <div class="overflow-x-auto">
                        <table v-if="supplierProducts.length" class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Marca</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Costo</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lead Time</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Min. Order</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                <tr v-for="p in supplierProducts" :key="p.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td class="px-6 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{{ p.product_sku }}</td>
                                    <td class="px-6 py-3">
                                        <Link :href="`/products/${p.product_id}`" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                            {{ p.product_name }}
                                        </Link>
                                    </td>
                                    <td class="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{{ p.brand_name }}</td>
                                    <td class="px-6 py-3 text-sm text-right text-gray-900 dark:text-white">${{ Number(p.supplier_cost).toFixed(2) }}</td>
                                    <td class="px-6 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{{ p.lead_time_days || '—' }} días</td>
                                    <td class="px-6 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{{ p.minimum_order_quantity || '—' }}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div v-else class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            <Package class="mx-auto mb-3 text-gray-300" :size="48" />
                            <p>Este proveedor no tiene productos asociados</p>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
