<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { ArrowLeftRight, Plus, Trash2, Search, Building2 } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import apiClient from '@/services/api/client'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Transferencias', href: '/inventory-transfers' },
    { title: 'Nueva Transferencia', href: '/inventory-transfers/create' },
]

interface Warehouse { id: number; name: string }
interface ProductResult { id: number; name: string; sku: string; variants?: any[] }
interface TransferItem { product_id: number; variant_id: number | null; product_name: string; variant_sku: string; quantity: number }

const warehouses = ref<Warehouse[]>([])
const fromWarehouseId = ref<number | null>(null)
const toWarehouseId = ref<number | null>(null)
const notes = ref('')
const items = ref<TransferItem[]>([])
const searchQuery = ref('')
const searchResults = ref<ProductResult[]>([])
const searching = ref(false)
const submitting = ref(false)
const errorMsg = ref('')

onMounted(async () => {
    try {
        const ctx = await apiClient.get('/user/warehouse-context')
        warehouses.value = ctx.data.allowed_warehouses || []
        if (ctx.data.current_warehouse_id) {
            fromWarehouseId.value = ctx.data.current_warehouse_id
        }
    } catch (e) { console.error(e) }
})

const availableDestinations = computed(() =>
    warehouses.value.filter(w => w.id !== fromWarehouseId.value)
)

let searchTimeout: any
const searchProducts = () => {
    clearTimeout(searchTimeout)
    if (searchQuery.value.length < 2) { searchResults.value = []; return }
    searchTimeout = setTimeout(async () => {
        searching.value = true
        try {
            const res = await apiClient.get('/products', { params: { search: searchQuery.value, per_page: 10 } })
            searchResults.value = res.data.data || res.data || []
        } catch (e) { console.error(e) }
        finally { searching.value = false }
    }, 300)
}

const addItem = (product: ProductResult, variant?: any) => {
    const existing = items.value.find(i => i.product_id === product.id && i.variant_id === (variant?.id || null))
    if (existing) {
        existing.quantity++
    } else {
        items.value.push({
            product_id: product.id,
            variant_id: variant?.id || null,
            product_name: product.name,
            variant_sku: variant?.sku || product.sku || '',
            quantity: 1,
        })
    }
    searchQuery.value = ''
    searchResults.value = []
}

const removeItem = (index: number) => items.value.splice(index, 1)

const submit = async () => {
    errorMsg.value = ''
    if (!fromWarehouseId.value || !toWarehouseId.value) {
        errorMsg.value = 'Selecciona almacén origen y destino.'
        return
    }
    if (items.value.length === 0) {
        errorMsg.value = 'Agrega al menos un producto.'
        return
    }

    submitting.value = true
    try {
        const payload = {
            from_warehouse_id: fromWarehouseId.value,
            to_warehouse_id: toWarehouseId.value,
            notes: notes.value || null,
            items: items.value.map(i => ({
                product_id: i.product_id,
                variant_id: i.variant_id,
                quantity: i.quantity,
            })),
        }
        const res = await apiClient.post('/inventory-transfers', payload)
        router.visit(`/inventory-transfers/${res.data.transfer.id}`)
    } catch (e: any) {
        errorMsg.value = e.response?.data?.message || 'Error al crear transferencia'
    } finally {
        submitting.value = false
    }
}
</script>

<template>
    <Head title="Nueva Transferencia" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4 space-y-6 max-w-4xl mx-auto">
            <!-- Header -->
            <div>
                <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
                    <ArrowLeftRight :size="32" class="text-indigo-500" />
                    Nueva Transferencia
                </h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Enviar mercancía de una sucursal a otra
                </p>
            </div>

            <!-- Warehouses Selection -->
            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Building2 :size="20" class="text-indigo-500" />
                    Almacenes
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Almacén Origen</label>
                        <select v-model="fromWarehouseId" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
                            <option :value="null" disabled>Seleccionar...</option>
                            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Almacén Destino</label>
                        <select v-model="toWarehouseId" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
                            <option :value="null" disabled>Seleccionar...</option>
                            <option v-for="w in availableDestinations" :key="w.id" :value="w.id">{{ w.name }}</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas (opcional)</label>
                    <input v-model="notes" type="text" placeholder="Ej: Reabastecimiento semanal Monterrey"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" />
                </div>
            </div>

            <!-- Product Search -->
            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agregar Productos</h3>
                <div class="relative">
                    <Search :size="16" class="absolute left-3 top-2.5 text-gray-400" />
                    <input
                        v-model="searchQuery"
                        @input="searchProducts"
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        class="w-full pl-9 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    />
                    <!-- Results -->
                    <div v-if="searchResults.length > 0" class="absolute z-10 mt-1 w-full rounded-lg bg-white border border-gray-200 shadow-lg dark:bg-gray-800 dark:border-gray-600 max-h-60 overflow-y-auto">
                        <div v-for="p in searchResults" :key="p.id">
                            <template v-if="p.variants && p.variants.length > 0">
                                <button v-for="v in p.variants" :key="v.id"
                                    @click="addItem(p, v)"
                                    class="w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-gray-700 text-sm border-b border-gray-100 dark:border-gray-700">
                                    <span class="font-medium">{{ p.name }}</span>
                                    <span class="text-gray-500 ml-2">{{ v.sku }}</span>
                                </button>
                            </template>
                            <button v-else @click="addItem(p)"
                                class="w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-gray-700 text-sm border-b border-gray-100 dark:border-gray-700">
                                <span class="font-medium">{{ p.name }}</span>
                                <span class="text-gray-500 ml-2">{{ p.sku }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Items Table -->
                <div v-if="items.length > 0" class="mt-4">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Producto</th>
                                <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">SKU</th>
                                <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Cantidad</th>
                                <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                            <tr v-for="(item, idx) in items" :key="idx">
                                <td class="px-3 py-2">{{ item.product_name }}</td>
                                <td class="px-3 py-2 font-mono text-xs text-gray-500">{{ item.variant_sku }}</td>
                                <td class="px-3 py-2 text-center">
                                    <input v-model.number="item.quantity" type="number" min="1"
                                        class="w-20 text-center rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" />
                                </td>
                                <td class="px-3 py-2 text-center">
                                    <button @click="removeItem(idx)" class="text-red-500 hover:text-red-700">
                                        <Trash2 :size="16" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Error -->
            <div v-if="errorMsg" class="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {{ errorMsg }}
            </div>

            <!-- Submit -->
            <div class="flex justify-end gap-3">
                <a href="/inventory-transfers" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">
                    Cancelar
                </a>
                <button @click="submit" :disabled="submitting"
                    class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors">
                    <Plus :size="16" />
                    {{ submitting ? 'Creando...' : 'Crear Transferencia (Borrador)' }}
                </button>
            </div>
        </div>
    </AppLayout>
</template>
