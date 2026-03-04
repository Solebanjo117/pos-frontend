<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Package, Layers } from 'lucide-vue-next'
import PriceDisplay from '@/components/ui/PriceDisplay.vue'
import type { Product, ProductVariant } from '@/types/product'

const props = defineProps<{
    show: boolean
    product: Product | null
}>()

const emit = defineEmits<{
    select: [variant: ProductVariant]
    close: []
}>()

const modalRef = ref<HTMLDivElement | null>(null)

const variants = computed(() => props.product?.variants ?? [])

// Focus modal when opened
watch(() => props.show, (isOpen) => {
    if (isOpen) nextTick(() => modalRef.value?.focus())
})

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
                        class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden outline-none ring-1 ring-gray-200 dark:ring-gray-700"
                    >
                        <!-- ═══════════ HEADER ═══════════ -->
                        <div class="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                            <div>
                                <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Layers class="w-5 h-5 text-indigo-500" />
                                    Seleccionar Variante
                                </h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    <span class="font-medium text-gray-700 dark:text-gray-300">{{ product.name }}</span>
                                    &mdash; {{ variants.length }} variante{{ variants.length !== 1 ? 's' : '' }} disponible{{ variants.length !== 1 ? 's' : '' }}
                                </p>
                            </div>
                            <button
                                @click="emit('close')"
                                class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                                <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th class="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Marca</th>
                                        <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                                        <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Stock</th>
                                        <th class="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Precio</th>
                                        <th class="w-14 px-3 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
                                    <tr
                                        v-for="variant in variants"
                                        :key="variant.id"
                                        @click="emit('select', variant)"
                                        class="group cursor-pointer transition-colors hover:bg-indigo-50/70 dark:hover:bg-indigo-900/15"
                                    >
                                        <!-- Brand -->
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-3">
                                                <div
                                                    class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                                                    :class="brandColor(variant.brand?.name ?? '?')"
                                                >
                                                    <span class="text-[11px] font-bold uppercase">
                                                        {{ (variant.brand?.name ?? '?').slice(0, 2) }}
                                                    </span>
                                                </div>
                                                <span class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {{ variant.brand?.name ?? 'Sin marca' }}
                                                </span>
                                            </div>
                                        </td>

                                        <!-- SKU -->
                                        <td class="px-3 py-4">
                                            <span class="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                {{ variant.sku ?? '—' }}
                                            </span>
                                        </td>

                                        <!-- Stock -->
                                        <td class="px-3 py-4 text-center">
                                            <span
                                                class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
                                                :class="stockClass(getStock(variant))"
                                            >
                                                {{ getStock(variant) }}
                                            </span>
                                        </td>

                                        <!-- Price -->
                                        <td class="px-3 py-4 text-right">
                                            <PriceDisplay
                                                :base-price="variant.pricing?.base_price ?? 0"
                                                :tax-rate="variant.pricing?.tax_rate ?? 0"
                                                size="sm"
                                            />
                                        </td>

                                        <!-- Action arrow -->
                                        <td class="px-3 py-4 text-center">
                                            <svg class="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- ═══════════ FOOTER ═══════════ -->
                        <div class="shrink-0 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                            <p class="text-xs text-gray-400">Haz clic en una variante para agregarla al carrito</p>
                            <button
                                @click="emit('close')"
                                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
