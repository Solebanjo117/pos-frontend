<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AsyncProductCombobox from '@/components/AsyncProductCombobox.vue'
import apiClient from '@/services/api/client'
import { usePosSettings } from '@/composables/usePosSettings'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'

// ── Form state ──────────────────────────────────────────────────────────────
interface Variant {
    id: number
    sku: string
    name: string
    quantity_available?: number
}

interface WasteEntry {
    id: number
    product_name: string
    sku: string
    brand: string
    warehouse: string
    quantity: number
    reason: string
    notes: string | null
    user: string | null
    date: string
}

const selectedProductId = ref<number | null>(null)
const selectedProduct = ref<any>(null)
const selectedVariant = ref<Variant | null>(null)
const variants = ref<Variant[]>([])
const warehouses = ref<{ id: number; name: string }[]>([])
const warehouseId = ref<number | null>(null)
const quantity = ref(1)
const reason = ref('')
const notes = ref('')
const submitting = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
const availableStock = ref<number | null>(null)

const REASONS = [
    'Dañado',
    'Caducado',
    'Robo / Pérdida',
    'Uso Interno',
    'Error de Inventario',
    'Otro',
]

const warehouseOptions = computed<SelectOption[]>(() => [
    ...warehouses.value.map((w) => ({ value: w.id, label: w.name })),
])

// ── History ──────────────────────────────────────────────────────────────────
const history = ref<WasteEntry[]>([])
const historyLoading = ref(false)

const fetchHistory = async () => {
    historyLoading.value = true
    try {
        const params: any = {}
        if (warehouseId.value) params.warehouse_id = warehouseId.value
        const res = await apiClient.get('/inventory/waste', { params })
        history.value = res.data.data ?? []
    } catch {
        // silent
    } finally {
        historyLoading.value = false
    }
}

const { currentWarehouseId, initWarehouse } = usePosSettings()

const fetchWarehouses = async () => {
    const res = await apiClient.get('/warehouses')
    warehouses.value = res.data.data ?? []
}

// ── Product selection ─────────────────────────────────────────────────────────
const onProductSelected = async (product: any) => {
    selectedProduct.value = product
    selectedVariant.value = null
    availableStock.value = null
    variants.value = []
    if (!product) return
    try {
        const res = await apiClient.get(`/products/${product.id}/variants`)
        variants.value = res.data.data ?? []
        if (variants.value.length === 1) {
            selectedVariant.value = variants.value[0]
            await fetchStock()
        }
    } catch {
        // silent
    }
}

const fetchStock = async () => {
    if (!selectedVariant.value || !warehouseId.value) return
    try {
        const res = await apiClient.get('/inventory', {
            params: { variant_id: selectedVariant.value.id, warehouse_id: warehouseId.value, per_page: 1 },
        })
        // Try to find the matching row
        const row = (res.data.data ?? []).find((r: any) => r.warehouse_id === warehouseId.value)
        availableStock.value = row?.stock_available ?? null
    } catch {
        availableStock.value = null
    }
}

// ── Submit ────────────────────────────────────────────────────────────────────
const handleSubmit = async () => {
    successMsg.value = ''
    errorMsg.value = ''
    if (!selectedVariant.value || !warehouseId.value || !reason.value) {
        errorMsg.value = 'Completa todos los campos requeridos'
        return
    }
    submitting.value = true
    try {
        const res = await apiClient.post('/inventory/waste', {
            variant_id: selectedVariant.value.id,
            warehouse_id: warehouseId.value,
            quantity: quantity.value,
            reason: reason.value,
            notes: notes.value || null,
        })
        successMsg.value = `✅ Merma registrada. Stock restante: ${res.data.remaining}`
        // Reset form

        selectedProductId.value = null
        selectedProduct.value = null
        selectedVariant.value = null
        variants.value = []
        quantity.value = 1
        reason.value = ''
        notes.value = ''
        availableStock.value = null
        await fetchHistory()
    } catch (e: any) {
        errorMsg.value = e.response?.data?.message || 'Error al registrar la merma'
    } finally {
        submitting.value = false
    }
}

onMounted(async () => {
    // 1. Fetch Warehouses and Init Context
    await Promise.all([
        fetchWarehouses(),
        initWarehouse()
    ])

    // 2. Set default warehouse from global context
    if (currentWarehouseId.value) {
        // Ensure it exists in the list
        if (warehouses.value.find(w => w.id === currentWarehouseId.value)) {
            warehouseId.value = currentWarehouseId.value
        }
    } else {
        // Fallback to first if no context
        if (warehouses.value.length > 0) {
            warehouseId.value = warehouses.value[0].id
        }
    }

    // 3. Fetch History
    await fetchHistory()
})
</script>

<template>
    <AppLayout>
        <div class="mx-auto max-w-5xl px-4 py-8 space-y-8">

            <!-- Header -->
            <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">🗑️ Registro de Mermas</h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Registra pérdidas de inventario (dañado, caducado, robo, etc.)
                </p>
            </div>

            <!-- Form Card -->
            <div class="rounded-xl bg-white shadow dark:bg-card p-6 space-y-5">
                <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Nueva Merma</h2>

                <!-- Alerts -->
                <div v-if="successMsg" class="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    {{ successMsg }}
                </div>
                <div v-if="errorMsg" class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {{ errorMsg }}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <!-- Product Search -->
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Producto <span class="text-red-500">*</span>
                        </label>



                        <AsyncProductCombobox
                            v-model="selectedProductId"
                            @select="onProductSelected"
                            placeholder="Buscar producto por nombre o SKU..."
                        />
                    </div>

                    <!-- Variant selector (if multiple) -->
                    <div v-if="variants.length > 1">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Variante <span class="text-red-500">*</span>
                        </label>
                        <select
                            v-model="selectedVariant"
                            @change="fetchStock"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="null" disabled>Selecciona variante</option>
                            <option v-for="v in variants" :key="v.id" :value="v">
                                {{ v.sku }} — {{ v.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Warehouse -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Almacén <span class="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                            v-model="warehouseId"
                            :options="warehouseOptions"
                            @update:model-value="fetchStock"
                        />
                    </div>

                    <!-- Quantity -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Cantidad <span class="text-red-500">*</span>
                            <span v-if="availableStock !== null" class="ml-2 text-xs text-gray-400">
                                (disponible: {{ availableStock }})
                            </span>
                        </label>
                        <input
                            v-model.number="quantity"
                            type="number"
                            min="1"
                            :max="availableStock ?? undefined"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Reason -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Motivo <span class="text-red-500">*</span>
                        </label>
                        <select
                            v-model="reason"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option value="" disabled>Selecciona motivo</option>
                            <option v-for="r in REASONS" :key="r" :value="r">{{ r }}</option>
                        </select>
                    </div>

                    <!-- Notes -->
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notas adicionales
                        </label>
                        <textarea
                            v-model="notes"
                            rows="2"
                            placeholder="Descripción opcional..."
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>
                </div>

                <div class="flex justify-end">
                    <button
                        type="button"
                        @click="handleSubmit"
                        :disabled="submitting || !selectedVariant || !warehouseId || !reason"
                        class="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                    >
                        {{ submitting ? 'Registrando...' : '🗑️ Registrar Merma' }}
                    </button>
                </div>
            </div>

            <!-- History Table -->
            <div class="rounded-xl bg-white shadow dark:bg-card p-6">
                <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Historial Reciente</h2>

                <div v-if="historyLoading" class="text-center py-8 text-gray-400">Cargando...</div>
                <div v-else-if="!history.length" class="text-center py-8 text-gray-400">
                    <p class="text-3xl mb-2">📋</p>
                    <p class="text-sm">No hay mermas registradas aún</p>
                </div>
                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-200 dark:border-border text-left text-xs text-gray-500 uppercase tracking-wider">
                                <th class="pb-3 pr-4">Producto</th>
                                <th class="pb-3 pr-4">SKU</th>
                                <th class="pb-3 pr-4">Almacén</th>
                                <th class="pb-3 pr-4 text-center">Cant.</th>
                                <th class="pb-3 pr-4">Motivo</th>
                                <th class="pb-3 pr-4">Usuario</th>
                                <th class="pb-3">Fecha</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-border">
                            <tr v-for="entry in history" :key="entry.id" class="hover:bg-gray-50 dark:hover:bg-muted/50/30">
                                <td class="py-3 pr-4 font-medium text-gray-900 dark:text-white">{{ entry.product_name }}</td>
                                <td class="py-3 pr-4 font-mono text-gray-500">{{ entry.sku }}</td>
                                <td class="py-3 pr-4 text-gray-600 dark:text-gray-300">{{ entry.warehouse }}</td>
                                <td class="py-3 pr-4 text-center">
                                    <span class="inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        -{{ entry.quantity }}
                                    </span>
                                </td>
                                <td class="py-3 pr-4 text-gray-600 dark:text-gray-300">{{ entry.reason }}</td>
                                <td class="py-3 pr-4 text-gray-500">{{ entry.user ?? '—' }}</td>
                                <td class="py-3 text-gray-400 text-xs">{{ entry.date }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    </AppLayout>
</template>
