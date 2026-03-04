<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import { usePosSettings } from '@/composables/usePosSettings'
import { Pencil, AlertTriangle, Star } from 'lucide-vue-next'

const { isSingleWarehouseMode, fetchSettings, currentWarehouseId } = usePosSettings()

const props = defineProps<{
    productId: number
}>()

const { currentProduct, loading, error, fetchProduct } = useProducts()

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
    { title: 'Detalle', href: `/products/${props.productId}` },
]

onMounted(async () => {
    await fetchSettings()
    await fetchProduct(props.productId, currentWarehouseId.value || undefined)
})

import { watch } from 'vue'
watch(currentWarehouseId, (newId) => {
    fetchProduct(props.productId, newId || undefined)
})

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(value)
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'active':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        case 'discontinued':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        case 'pending':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
}
</script>

<template>
    <Head title="Detalle del Producto" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-6 flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Detalle del Producto</h1>
                </div>
                <div class="flex gap-2">
                    <a
                        :href="`/products/${productId}/edit`"
                        class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                        <Pencil class="w-4 h-4 mr-2" /> Editar
                    </a>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="text-center py-12">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p class="mt-2 text-gray-600">Cargando producto...</p>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="rounded-lg bg-red-50 p-4 text-red-800">
                {{ error }}
            </div>

            <!-- Product Details -->
            <div v-else-if="currentProduct" class="space-y-6">
                <!-- General Info -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Información General</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">SKU</label>
                        <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ currentProduct.sku }}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Custom SKU</label>
                        <p class="mt-1 text-lg text-gray-900 dark:text-white">{{ currentProduct.upc || 'N/A' }}</p>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Nombre</label>
                        <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ currentProduct.name }}</p>
                    </div>
                    <div class="md:col-span-2" v-if="currentProduct.description">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Notas</label>
                        <p class="mt-1 text-gray-900 dark:text-white">{{ currentProduct.description }}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Marca</label>
                        <p class="mt-1 text-lg text-gray-900 dark:text-white">{{ currentProduct.brand?.name || 'N/A' }}</p>
                    </div>
                    <div v-if="currentProduct.product_line">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Línea de Producto</label>
                        <p class="mt-1 text-lg text-gray-900 dark:text-white">{{ currentProduct.product_line.name }}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Estado</label>
                        <span :class="getStatusColor(currentProduct.status)" class="mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold">
                            {{ currentProduct.status }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Pricing -->
            <div v-if="currentProduct.pricing" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Precios</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Precio Base</label>
                        <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {{ formatCurrency(currentProduct.pricing.base_price) }}
                        </p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">MSRP</label>
                        <p class="mt-1 text-xl text-gray-900 dark:text-white">
                            {{ formatCurrency(currentProduct.pricing.msrp) }}
                        </p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Costo</label>
                        <p class="mt-1 text-xl text-gray-900 dark:text-white">
                            {{ formatCurrency(currentProduct.pricing.cost) }}
                        </p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">Margen</label>
                        <p class="mt-1 text-xl font-semibold text-green-600 dark:text-green-400">
                            {{ currentProduct.pricing.margin_percentage.toFixed(2) }}%
                        </p>
                    </div>
                </div>
            </div>

            <!-- Attributes -->
            <div v-if="currentProduct.attributes && currentProduct.attributes.length > 0" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Atributos Técnicos</h2>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div v-for="attr in currentProduct.attributes" :key="attr.name" class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ attr.name }}</label>
                        <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            <Link 
                                :href="`/products?attribute_value=${encodeURIComponent(attr.value)}`"
                                class="hover:text-blue-600 hover:underline"
                                title="Ver productos con esta característica"
                            >
                                {{ attr.value }}
                            </Link>
                            <span v-if="attr.unit" class="text-sm text-gray-700 dark:text-gray-300 ml-1">{{ attr.unit }}</span>
                        </p>
                    </div>
                </div>
            </div>

            <!-- Inventory -->
            <div v-if="currentProduct.inventory && currentProduct.inventory.length > 0" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Inventario</h2>
                
                <!-- Inventory Table -->
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Almacén</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Variante</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Disponible</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Reservado</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">En Pedido</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Pto. Reorden</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            <tr v-for="inv in currentProduct.inventory" :key="inv.id">
                                <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{{ inv.warehouse?.name || 'N/A' }}</td>
                                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{{ inv.variant_sku || '-' }}</td>
                                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{{ inv.stock_available }}</td>
                                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{{ inv.stock_reserved }}</td>
                                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">{{ inv.stock_on_order }}</td>
                                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                                    {{ inv.reorder_point }}
                                    <span v-if="inv.needs_reorder" class="ml-2 text-red-600 font-semibold flex items-center gap-1"><AlertTriangle class="w-4 h-4" /> Reordenar</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Suppliers -->
            <div v-if="currentProduct.suppliers && currentProduct.suppliers.length > 0" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Proveedores</h2>
                <div class="space-y-3">
                    <div v-for="supplier in currentProduct.suppliers" :key="supplier.id" class="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                        <div>
                            <p class="font-semibold text-gray-900 dark:text-white">{{ supplier.name }}</p>
                            <p class="text-sm text-gray-700 dark:text-gray-300">Tiempo de entrega: {{ supplier.lead_time_days }} días</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(supplier.supplier_cost) }}</p>
                            <p class="text-xs text-gray-700 dark:text-gray-300">MOQ: {{ supplier.minimum_order_quantity }}</p>
                            <span v-if="supplier.is_preferred" class="flex items-center gap-1 text-xs text-green-600 font-semibold"><Star class="w-3 h-3" /> Preferido</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Vehicle Compatibility -->
            <div v-if="currentProduct.compatibility && currentProduct.compatibility.length > 0" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Compatibilidad Vehicular</h2>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div v-for="(compat, index) in currentProduct.compatibility" :key="index" class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                        <p class="font-semibold text-gray-900 dark:text-white">{{ compat.make }} {{ compat.model }}</p>
                        <p class="text-sm text-gray-800 dark:text-gray-200">{{ compat.year_range }}</p>
                        <p class="text-sm text-gray-700 dark:text-gray-300">Motor: {{ compat.engine }}</p>
                        <p v-if="compat.notes" class="mt-2 text-xs text-gray-700 dark:text-gray-300">{{ compat.notes }}</p>
                    </div>
                </div>
            </div>

            <!-- OEM References -->
            <div v-if="currentProduct.oem_references && currentProduct.oem_references.length > 0" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Referencias OEM</h2>
                <div class="flex flex-wrap gap-3">
                    <div v-for="(ref, index) in currentProduct.oem_references" :key="index" class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                        <Link :href="`/products?oem_code=${encodeURIComponent(ref.oem_code)}`" class="block group">
                            <p class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 group-hover:underline flex items-center gap-1">
                                {{ ref.oem_code }}
                                <span class="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                            </p>
                            <p class="text-xs text-gray-700 dark:text-gray-300">{{ ref.manufacturer }}</p>
                        </Link>
                    </div>
                </div>
            <!-- Alternatives (Interchange) -->
            <div v-if="currentProduct.alternatives && currentProduct.alternatives.length > 0" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Alternativas y Sustitutos</h2>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Producto</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Relación</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Stock</th>
                                <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900 dark:text-white">Precio</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            <tr v-for="alt in currentProduct.alternatives" :key="alt.id">
                                <td class="px-6 py-4">
                                    <Link :href="`/products/${alt.id}`" class="group">
                                        <p class="font-semibold text-blue-600 group-hover:underline dark:text-blue-400">{{ alt.sku_base }}</p>
                                        <p class="text-sm text-gray-900 dark:text-white">{{ alt.name }}</p>
                                    </Link>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                    <span :class="{
                                        'bg-blue-100 text-blue-800': alt.pivot.relationship_type === 'compatible',
                                        'bg-green-100 text-green-800': alt.pivot.relationship_type === 'substitute',
                                        'bg-purple-100 text-purple-800': alt.pivot.relationship_type === 'upgrade'
                                    }" class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold">
                                        {{ alt.pivot.relationship_type }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                    {{ alt.total_stock }}
                                </td>
                                <td class="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                                    {{ alt.pricing ? formatCurrency(alt.pricing.base_price) : '-' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
            </div>
        </div>
    </AppLayout>
</template>
