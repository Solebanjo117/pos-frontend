<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Search, Plus, Package, ChevronDown } from 'lucide-vue-next'
import apiClient from '@/services/api/client'
import type { User } from '@/types'

interface FoundProduct {
    id: number
    name: string
    sku_base: string
    default_variant?: { id: number; sku: string; pricing?: { base_price: number; tax_rate: number } }
    variants?: { id: number; sku: string; brand?: { name: string }; pricing?: { base_price: number; tax_rate: number }; total_stock: number }[]
    pricing?: { base_price: number; tax_rate: number }
    image_url?: string | null
}

interface PendingItem {
    product: FoundProduct
    variant_id: number | null
    quantity: number
    unit_price: number
    tax_percent: number
    seller_id: number | null
}

const props = defineProps<{
    show: boolean
    orderId: number
    warehouseId: number
    users: User[]
    currentUserId?: number
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'added'): void
}>()

const searchQuery = ref('')
const searchResults = ref<FoundProduct[]>([])
const searching = ref(false)
const pendingItems = ref<PendingItem[]>([])
const submitting = ref(false)
const errorMsg = ref<string | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => props.show, (open) => {
    if (open) {
        searchQuery.value = ''
        searchResults.value = []
        pendingItems.value = []
        errorMsg.value = null
        nextTick(() => searchInputRef.value?.focus())
    }
})

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) emit('close')
}
onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

const doSearch = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(async () => {
        const q = searchQuery.value.trim()
        if (q.length < 2) { searchResults.value = []; return }
        searching.value = true
        try {
            const { data } = await apiClient.get('/products', { params: { search: q, per_page: 10 } })
            searchResults.value = data.data ?? data
        } catch { searchResults.value = [] }
        finally { searching.value = false }
    }, 300)
}

const addProduct = (product: FoundProduct) => {
    const existsIdx = pendingItems.value.findIndex(p => p.product.id === product.id)
    if (existsIdx >= 0) {
        pendingItems.value[existsIdx].quantity++
        return
    }
    const pricing = product.default_variant?.pricing ?? product.pricing
    pendingItems.value.push({
        product,
        variant_id: product.default_variant?.id ?? null,
        quantity: 1,
        unit_price: pricing?.base_price ?? 0,
        tax_percent: pricing?.tax_rate ?? 0,
        seller_id: props.currentUserId ?? null,
    })
    searchQuery.value = ''
    searchResults.value = []
}

const removeItem = (idx: number) => {
    pendingItems.value.splice(idx, 1)
}

const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const totalEstimated = computed(() =>
    pendingItems.value.reduce((sum, i) => {
        const sub = i.quantity * i.unit_price
        return sum + sub + (sub * i.tax_percent / 100)
    }, 0)
)

const handleSubmit = async () => {
    if (pendingItems.value.length === 0) return
    submitting.value = true
    errorMsg.value = null
    try {
        for (const item of pendingItems.value) {
            await apiClient.post(`/sales-orders/${props.orderId}/items`, {
                product_id: item.product.id,
                variant_id: item.variant_id,
                warehouse_id: props.warehouseId,
                quantity: item.quantity,
                unit_price: item.unit_price,
                tax_percent: item.tax_percent,
                seller_id: item.seller_id,
            })
        }
        emit('added')
        emit('close')
    } catch (err: any) {
        errorMsg.value = err.response?.data?.message || 'Error al agregar artículos'
    } finally {
        submitting.value = false
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="show"
                class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                @click.self="emit('close')"
            >
                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 scale-95"
                    enter-to-class="opacity-100 scale-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="opacity-100 scale-100"
                    leave-to-class="opacity-0 scale-95"
                >
                    <div
                        v-if="show"
                        class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col ring-1 ring-gray-200 dark:ring-gray-700"
                    >
                        <!-- Header -->
                        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border shrink-0">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                    <Plus class="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Agregar Artículos</h2>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">Busca productos y agrégalos a esta orden</p>
                                </div>
                            </div>
                            <button @click="emit('close')" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors">
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- Body -->
                        <div class="p-6 space-y-5 overflow-y-auto flex-1">
                            <!-- Error -->
                            <div v-if="errorMsg" class="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                                {{ errorMsg }}
                            </div>

                            <!-- Search -->
                            <div class="relative">
                                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    ref="searchInputRef"
                                    v-model="searchQuery"
                                    @input="doSearch"
                                    type="text"
                                    placeholder="Buscar producto por nombre o SKU..."
                                    class="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                                <!-- Dropdown results -->
                                <div
                                    v-if="searchResults.length > 0"
                                    class="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto"
                                >
                                    <button
                                        v-for="p in searchResults"
                                        :key="p.id"
                                        @click="addProduct(p)"
                                        class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-green-50 dark:hover:bg-green-900/15 transition-colors"
                                    >
                                        <Package class="w-5 h-5 text-gray-300 shrink-0" />
                                        <div class="min-w-0 flex-1">
                                            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ p.name }}</p>
                                            <p class="text-xs text-gray-500">{{ p.sku_base || p.default_variant?.sku || '' }}</p>
                                        </div>
                                        <span class="text-xs font-medium text-green-600">
                                            {{ formatCurrency((p.default_variant?.pricing ?? p.pricing)?.base_price ?? 0) }}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <!-- Pending items table -->
                            <div v-if="pendingItems.length > 0">
                                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Artículos a agregar</label>
                                <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-border">
                                    <table class="w-full text-left">
                                        <thead class="bg-gray-50 dark:bg-background/50 border-b border-gray-200 dark:border-border">
                                            <tr>
                                                <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                                                <th class="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Precio</th>
                                                <th class="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-center">Cant.</th>
                                                <th class="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                                                <th class="w-10 px-2 py-2.5"></th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                                            <tr v-for="(item, idx) in pendingItems" :key="idx" class="bg-white dark:bg-card">
                                                <td class="px-4 py-3">
                                                    <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ item.product.name }}</p>
                                                    <p class="text-xs text-gray-400 font-mono">{{ item.product.sku_base || item.product.default_variant?.sku }}</p>
                                                </td>
                                                <td class="px-3 py-3 text-right">
                                                    <input
                                                        v-model.number="item.unit_price"
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        class="w-24 px-2 py-1 text-sm text-right rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white"
                                                    />
                                                </td>
                                                <td class="px-3 py-3 text-center">
                                                    <input
                                                        v-model.number="item.quantity"
                                                        type="number"
                                                        min="1"
                                                        class="w-16 px-2 py-1 text-sm text-center rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white"
                                                    />
                                                </td>
                                                <td class="px-3 py-3">
                                                    <div class="relative">
                                                        <select
                                                            v-model="item.seller_id"
                                                            class="w-full appearance-none text-sm pl-3 pr-8 py-1.5 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white cursor-pointer"
                                                        >
                                                            <option :value="null">— Sin asignar —</option>
                                                            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
                                                        </select>
                                                        <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </td>
                                                <td class="px-2 py-3 text-center">
                                                    <button @click="removeItem(idx)" class="text-red-400 hover:text-red-600 transition-colors">
                                                        <X class="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Empty -->
                            <div v-else class="text-center py-8 text-gray-400">
                                <Package class="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p class="text-sm">Busca un producto arriba para agregarlo</p>
                            </div>

                            <!-- Total -->
                            <div v-if="pendingItems.length > 0" class="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm font-semibold text-green-700 dark:text-green-300">Total estimado:</span>
                                    <span class="text-xl font-bold text-green-600 dark:text-green-400">{{ formatCurrency(totalEstimated) }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="px-6 py-4 border-t border-gray-200 dark:border-border shrink-0 flex items-center justify-between gap-3">
                            <button
                                @click="emit('close')"
                                class="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-border rounded-xl hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                @click="handleSubmit"
                                :disabled="pendingItems.length === 0 || submitting"
                                class="px-6 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 transition-colors"
                            >
                                {{ submitting ? 'Agregando...' : `Agregar ${pendingItems.length} artículo${pendingItems.length !== 1 ? 's' : ''}` }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
