<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { X, RotateCcw, AlertCircle, Package, Banknote, CreditCard, Landmark, User, ChevronDown } from 'lucide-vue-next'
import type { User as UserType } from '@/types'
import { usePaymentMethods } from '@/composables/usePaymentMethods'

const { methods, fetchMethods } = usePaymentMethods()

interface OrderItem {
    id: number
    product_id: number
    variant_id?: number
    product_name: string
    product_sku: string
    quantity: number
    unit_price: number
    discount_percent: number
    tax_percent?: number
    total: number
    seller_name?: string
}

const props = defineProps<{
    show: boolean
    orderId: number
    orderNumber: string
    items: OrderItem[]
    users: UserType[]
    currentUserId?: number
    hasCustomer?: boolean
    loading?: boolean
    error?: string | null
}>()

const emit = defineEmits<{
    (e: 'submit', payload: {
        reason: string
        refund_method: string
        refund_notes: string
        items: { sales_order_item_id: number; quantity: number; user_id: number | null }[]
    }): void
    (e: 'close'): void
}>()

const reason = ref('')
const refundMethod = ref<string>('cash')
const refundNotes = ref('')
const quantities = ref<Record<number, number>>({})
const returnUsers = ref<Record<number, number | null>>({})

// Reset state when modal opens
watch(() => props.show, (val) => {
    if (val) {
        fetchMethods() // Fetch fresh methods
        reason.value = ''
        refundMethod.value = 'cash'
        refundNotes.value = ''
        quantities.value = {}
        returnUsers.value = {}
        props.items.forEach(item => {
            quantities.value[item.id] = 0
            returnUsers.value[item.id] = props.currentUserId ?? null
        })
    }
})

// Escape key
const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) emit('close')
}
onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

const hasSelectedItems = computed(() =>
    Object.values(quantities.value).some(q => q > 0)
)

const selectedCount = computed(() =>
    Object.values(quantities.value).filter(q => q > 0).length
)

const estimatedRefund = computed(() => {
    let total = 0
    for (const item of props.items) {
        const qty = quantities.value[item.id] ?? 0
        if (qty > 0) {
            const soldQty = Number(item.quantity || 0)
            const lineTotal = Number(item.total || 0)
            if (soldQty > 0 && lineTotal > 0) {
                // Refund exactly what was charged per unit (discount + tax included when applicable).
                const effectiveUnitTotal = lineTotal / soldQty
                total += effectiveUnitTotal * qty
            } else {
                // Fallback for old/partial payloads where total is missing.
                const unitAfterDiscount = item.unit_price * (1 - (item.discount_percent / 100))
                const taxPercent = Number(item.tax_percent || 0)
                total += unitAfterDiscount * qty * (1 + taxPercent / 100)
            }
        }
    }
    return total
})

const handleSubmit = () => {
    const returnItems = props.items
        .filter(item => (quantities.value[item.id] ?? 0) > 0)
        .map(item => ({
            sales_order_item_id: item.id,
            quantity: quantities.value[item.id],
            user_id: returnUsers.value[item.id] ?? null,
        }))

    emit('submit', {
        reason: reason.value,
        refund_method: refundMethod.value,
        refund_notes: refundNotes.value,
        items: returnItems,
    })
}

const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// Icon mapping for refund methods
const methodIcons: Record<string, any> = {
    cash: Banknote,
    card: CreditCard,
    transfer: Landmark,
    balance: User,
    store_credit: User,
}

// Color mapping for refund methods
const methodColors: Record<string, string> = {
    cash: 'green',
    card: 'blue',
    transfer: 'purple',
    balance: 'amber',
    store_credit: 'amber',
}

// Refund methods: cash, card, transfer + balance (if customer)
const refundMethods = computed(() => {
    const standardCodes = ['cash', 'card', 'transfer']
    const result = methods.value
        .filter(m => standardCodes.includes(m.code))
        .map(m => ({
            value: m.code,
            label: m.name,
            icon: methodIcons[m.code] || Banknote,
            color: methodColors[m.code] || 'gray',
        }))

    // Add balance option if customer exists
    if (props.hasCustomer) {
        result.push({
            value: 'balance',
            label: 'Saldo a Favor',
            icon: User,
            color: 'amber',
        })
    }
    return result
})

const refundMethodColor = (method: string, color: string) => {
    if (refundMethod.value === method) {
        return `border-${color}-400 bg-${color}-50 dark:bg-${color}-900/20 dark:border-${color}-600`
    }
    return 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50/50'
}
</script>

<template>
    <Teleport to="body">
        <!-- Backdrop -->
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
                <!-- Panel -->
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
                        class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col ring-1 ring-gray-200 dark:ring-gray-700"
                    >
                        <!-- ═══════════ HEADER ═══════════ -->
                        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border shrink-0">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                    <RotateCcw class="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Devolución de Artículos</h2>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">
                                        Orden <span class="font-medium text-gray-700 dark:text-gray-300">{{ orderNumber }}</span>
                                    </p>
                                </div>
                            </div>
                            <button @click="emit('close')" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors">
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- ═══════════ BODY ═══════════ -->
                        <div class="p-6 space-y-5 overflow-y-auto flex-1">
                            <!-- Error -->
                            <div v-if="error" class="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                                <AlertCircle class="w-4 h-4 flex-shrink-0" />
                                {{ error }}
                            </div>

                            <!-- ── Items Table ── -->
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                    Seleccione las cantidades a devolver
                                </label>
                                <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-border">
                                    <table class="w-full text-left">
                                        <thead class="bg-gray-50 dark:bg-background/50 border-b border-gray-200 dark:border-border">
                                            <tr>
                                                <th class="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                                                <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                                                <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Precio</th>
                                                <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Devolver</th>
                                                <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Devuelve</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                                            <tr
                                                v-for="item in items"
                                                :key="item.id"
                                                class="transition-colors"
                                                :class="(quantities[item.id] ?? 0) > 0
                                                    ? 'bg-red-50/50 dark:bg-red-900/10'
                                                    : 'bg-white dark:bg-card'"
                                            >
                                                <!-- Product name -->
                                                <td class="px-4 py-3">
                                                    <div class="flex items-center gap-3">
                                                        <Package class="w-7 h-7 text-gray-300 dark:text-gray-600 shrink-0" />
                                                        <div class="min-w-0">
                                                            <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ item.product_name }}</p>
                                                            <p class="text-xs text-gray-400">Vendido: {{ item.quantity }}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <!-- SKU -->
                                                <td class="px-3 py-3">
                                                    <span class="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-muted px-1.5 py-0.5 rounded">
                                                        {{ item.product_sku || '—' }}
                                                    </span>
                                                </td>

                                                <!-- Price -->
                                                <td class="px-3 py-3 text-right">
                                                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatCurrency(item.unit_price) }}</span>
                                                    <span v-if="item.discount_percent > 0" class="block text-xs text-red-500">-{{ item.discount_percent }}%</span>
                                                    <span class="block text-xs" :class="(item.tax_percent ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'">
                                                        {{ (item.tax_percent ?? 0) > 0 ? `ITBM ${(item.tax_percent ?? 0)}%` : 'Sin ITBM' }}
                                                    </span>
                                                </td>

                                                <!-- Quantity to return -->
                                                <td class="px-3 py-3">
                                                    <div class="flex items-center justify-center gap-1.5">
                                                        <input
                                                            v-model.number="quantities[item.id]"
                                                            type="number"
                                                            min="0"
                                                            :max="item.quantity"
                                                            class="w-16 px-2 py-1.5 text-center text-sm font-bold rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                                        />
                                                        <span class="text-xs text-gray-400">/ {{ item.quantity }}</span>
                                                    </div>
                                                </td>

                                                <!-- Who is returning (per-row seller) -->
                                                <td class="px-3 py-3">
                                                    <div class="relative">
                                                        <select
                                                            v-model="returnUsers[item.id]"
                                                            class="w-full appearance-none text-sm pl-3 pr-8 py-1.5 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer"
                                                        >
                                                            <option :value="null">— Sin asignar —</option>
                                                            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
                                                        </select>
                                                        <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- ── Reason ── -->
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Motivo de devolución</label>
                                <input
                                    v-model="reason"
                                    type="text"
                                    placeholder="Ej: Producto defectuoso, error de envío, etc."
                                    class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white"
                                />
                            </div>

                            <!-- ── Refund Method ── -->
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Método de reembolso</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <label
                                        v-for="m in refundMethods"
                                        :key="m.value"
                                        class="flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
                                        :class="refundMethod === m.value
                                            ? `border-${m.color}-400 bg-${m.color}-50 dark:bg-${m.color}-900/20 dark:border-${m.color}-600`
                                            : 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50/50'"
                                    >
                                        <input type="radio" v-model="refundMethod" :value="m.value" class="sr-only" />
                                        <component :is="m.icon" class="w-5 h-5" :class="`text-${m.color}-600 dark:text-${m.color}-400`" />
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ m.label }}</span>
                                    </label>
                                </div>
                            </div>

                            <!-- ── Estimated Refund ── -->
                            <div v-if="hasSelectedItems" class="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <span class="text-sm font-semibold text-red-700 dark:text-red-300">Monto estimado a devolver:</span>
                                        <span class="block text-xs text-red-500/70 mt-0.5">
                                            {{ selectedCount }} artículo{{ selectedCount !== 1 ? 's' : '' }} seleccionado{{ selectedCount !== 1 ? 's' : '' }}
                                        </span>
                                    </div>
                                    <span class="text-xl font-bold text-red-600 dark:text-red-400">{{ formatCurrency(estimatedRefund) }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- ═══════════ FOOTER ═══════════ -->
                        <div class="px-6 py-4 border-t border-gray-200 dark:border-border shrink-0">
                            <button
                                @click="handleSubmit"
                                :disabled="!hasSelectedItems || loading"
                                class="w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors"
                            >
                                {{ loading ? 'Procesando...' : 'Procesar Devolución' }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
