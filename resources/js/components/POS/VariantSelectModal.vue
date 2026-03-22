<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Package, Layers, ShoppingCart, Truck } from 'lucide-vue-next'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue'
import type { Product, ProductVariant } from '@/types/product'

const props = defineProps<{
    show: boolean
    product: Product | null
}>()

const emit = defineEmits<{
    'select-multiple': [selections: Array<{ variant: ProductVariant; quantity: number }>]
    close: []
}>()

const modalRef = ref<HTMLDivElement | null>(null)

const variants = computed(() => props.product?.variants ?? [])

// Multi-select state: variantId -> quantity chosen (0 = not selected)
const selected = ref<Record<number, number>>({})

// Reset selections whenever the modal opens with a new product
watch(() => props.show, (isOpen) => {
    if (isOpen) {
        selected.value = {}
        nextTick(() => modalRef.value?.focus())
    }
})

// Computed: array of selected variant ids that have qty > 0
const selectedCount = computed(() =>
    Object.values(selected.value).filter(q => q > 0).length
)

// Toggle checkbox (sets qty to 1 if unchecked, or removes selection)
const toggleVariant = (variantId: number) => {
    if (selected.value[variantId] > 0) {
        delete selected.value[variantId]
    } else {
        selected.value[variantId] = 1
    }
}

const isSelected = (variantId: number) => (selected.value[variantId] ?? 0) > 0
const getQty = (variantId: number) => selected.value[variantId] ?? 1

const setQty = (variantId: number, qty: number) => {
    if (qty < 1) qty = 1
    if (isSelected(variantId)) {
        selected.value[variantId] = qty
    }
}

// Confirm and emit all selected variants
const confirmSelection = () => {
    const selections = variants.value
        .filter(v => isSelected(v.id))
        .map(v => ({ variant: v, quantity: selected.value[v.id] ?? 1 }))
    if (selections.length === 0) return
    emit('select-multiple', selections)
}

// Escape key
const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) emit('close')
}
onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// Helpers
const getStock = (v: ProductVariant): number => v.total_stock ?? 0

const stockClass = (stock: number) => {
    if (stock > 5) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (stock > 0) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

const brandColor = (name: string): string => {
    const colors = [
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
        'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
        'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
        'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
}

// ── Quick Purchase Modal state ─────────────────────────────────────────────────
const showQuickPurchase = ref(false)
const variantForPurchase = ref<ProductVariant | null>(null)

const openQuickPurchase = (variant: ProductVariant, e: Event) => {
    e.stopPropagation()
    if (!props.product) return
    variantForPurchase.value = variant
    showQuickPurchase.value = true
}

const handlePurchaseSuccess = (result: { productId: number; variantId: number | null; quantityAdded: number }) => {
    // Update the variant's stock in place
    if (result.variantId && props.product) {
        const variant = props.product.variants?.find(v => v.id === result.variantId)
        if (variant && variant.total_stock !== undefined) {
            variant.total_stock += result.quantityAdded
        }
    }
    showQuickPurchase.value = false
    variantForPurchase.value = null
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
                v-if="show && product"
                class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
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
                        v-if="show && product"
                        ref="modalRef"
                        tabindex="-1"
                        class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden outline-none ring-1 ring-gray-200 dark:ring-gray-700"
                    >
                        <!-- ═══════════ HEADER ═══════════ -->
                        <div class="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-border flex items-center justify-between bg-white dark:bg-card">
                            <div>
                                <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Layers class="w-5 h-5 text-indigo-500" />
                                    Seleccionar Variante(s)
                                </h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    <span class="font-medium text-gray-700 dark:text-gray-300">{{ product.name }}</span>
                                    &mdash; {{ variants.length }} variante{{ variants.length !== 1 ? 's' : '' }} disponible{{ variants.length !== 1 ? 's' : '' }}
                                    <span v-if="selectedCount > 0" class="ml-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                                        · {{ selectedCount }} seleccionada{{ selectedCount !== 1 ? 's' : '' }}
                                    </span>
                                </p>
                            </div>
                            <button
                                @click="emit('close')"
                                class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors"
                            >
                                <X class="h-5 w-5" />
                            </button>
                        </div>

                        <!-- ═══════════ TABLE BODY ═══════════ -->
                        <div class="flex-1 overflow-y-auto min-h-0">
                            <!-- Empty state -->
                            <div v-if="variants.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
                                <Package class="w-12 h-12 text-gray-300 mb-3" />
                                <p class="text-sm font-medium text-gray-500">No hay variantes disponibles</p>
                            </div>

                            <table v-else class="w-full text-left">
                                <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-border">
                                    <tr>
                                        <th class="pl-4 pr-2 py-3 w-8"></th>
                                        <th class="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Marca</th>
                                        <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                                        <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Stock</th>
                                        <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Precio</th>
                                        <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-24">Cantidad</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                                    <tr
                                        v-for="variant in variants"
                                        :key="variant.id"
                                        @click="toggleVariant(variant.id)"
                                        class="group cursor-pointer transition-colors"
                                        :class="isSelected(variant.id)
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/30'
                                            : 'hover:bg-gray-50/70 dark:hover:bg-muted/30'"
                                    >
                                        <!-- Checkbox -->
                                        <td class="pl-4 pr-2 py-4" @click.stop="toggleVariant(variant.id)">
                                            <div class="flex items-center justify-center">
                                                <div
                                                    class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0"
                                                    :class="isSelected(variant.id)
                                                        ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
                                                        : 'border-gray-300 dark:border-border bg-white dark:bg-muted'"
                                                >
                                                    <svg v-if="isSelected(variant.id)" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </td>

                                        <!-- Brand -->
                                        <td class="px-4 py-4">
                                            <div class="flex items-center gap-3">
                                                <div
                                                    class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                                                    :class="brandColor(variant.brand?.name ?? '?')"
                                                >
                                                    <span class="text-[11px] font-bold uppercase">
                                                        {{ (variant.brand?.name ?? '?').slice(0, 2) }}
                                                    </span>
                                                </div>
                                                <span class="text-sm font-semibold text-gray-900 dark:text-white transition-colors"
                                                    :class="isSelected(variant.id) ? 'text-indigo-700 dark:text-indigo-300' : 'group-hover:text-indigo-600'">
                                                    {{ variant.brand?.name ?? 'Sin marca' }}
                                                </span>
                                            </div>
                                        </td>

                                        <!-- SKU -->
                                        <td class="px-3 py-4">
                                            <span class="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-muted px-1.5 py-0.5 rounded">
                                                {{ variant.sku ?? '—' }}
                                            </span>
                                        </td>

                                        <!-- Stock -->
                                        <td class="px-3 py-4 text-center">
                                            <div class="flex items-center justify-center gap-2">
                                                <span
                                                    class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
                                                    :class="stockClass(getStock(variant))"
                                                >
                                                    {{ getStock(variant) }}
                                                </span>
                                                <button
                                                    v-if="getStock(variant) <= 0"
                                                    @click="openQuickPurchase(variant, $event)"
                                                    class="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/30 transition-colors"
                                                    title="Reabastecer variante"
                                                >
                                                    <Truck class="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>

                                        <!-- Price -->
                                        <td class="px-3 py-4 text-right">
                                            <PriceDisplay
                                                :base-price="variant.pricing?.base_price ?? 0"
                                                :tax-rate="variant.pricing?.tax_rate ?? 0"
                                                size="sm"
                                            />
                                        </td>

                                        <!-- Quantity input (only active when selected) -->
                                        <td class="px-3 py-4 text-center" @click.stop>
                                            <input
                                                v-if="isSelected(variant.id)"
                                                :value="getQty(variant.id)"
                                                @input="setQty(variant.id, Number(($event.target as HTMLInputElement).value))"
                                                type="number"
                                                min="1"
                                                class="w-20 text-center rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-muted px-2 py-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                                @click.stop
                                            />
                                            <span v-else class="text-xs text-gray-300 dark:text-gray-600">—</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- ═══════════ FOOTER ═══════════ -->
                        <div class="shrink-0 px-6 py-3 border-t border-gray-200 dark:border-border flex items-center justify-between bg-white dark:bg-card gap-3">
                            <p class="text-xs text-gray-400 flex-1">
                                <span v-if="selectedCount === 0">Haz clic en una fila para seleccionar variantes</span>
                                <span v-else class="text-indigo-600 dark:text-indigo-400 font-medium">{{ selectedCount }} variante{{ selectedCount !== 1 ? 's' : '' }} seleccionada{{ selectedCount !== 1 ? 's' : '' }}</span>
                            </p>
                            <button
                                @click="emit('close')"
                                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-border rounded-xl hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                @click="confirmSelection"
                                :disabled="selectedCount === 0"
                                class="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                :class="selectedCount > 0
                                    ? 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500'
                                    : 'bg-gray-400'"
                            >
                                <ShoppingCart class="w-4 h-4" />
                                Añadir {{ selectedCount > 0 ? selectedCount : '' }} al Carrito
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>

        <!-- Quick Purchase Modal -->
        <QuickPurchaseModal
            v-if="variantForPurchase && product"
            :is-open="showQuickPurchase"
            :product="product"
            :initial-variant-id="variantForPurchase.id"
            @close="showQuickPurchase = false; variantForPurchase = null"
            @success="handlePurchaseSuccess"
        />
    </Teleport>
</template>
