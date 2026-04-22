<script setup lang="ts">
import type { Product  } from '@/types/product'

interface Props {
    product: Product
    viewMode: 'grid' | 'list'
}

defineProps<Props>()
const emit = defineEmits<{ select: [product: Product] }>()

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)

const getMinPrice = (product: Product): number => {
    // Si tiene variantes, buscar el precio mínimo calculado
    if (product.variants?.length) {
        const prices = product.variants.map(v => Number(v.pricing?.calculated_price ?? v.pricing?.base_price ?? 0));
        const min = Math.min(...prices.filter(p => p > 0));
        if (min !== Infinity) return min;
    }
    return Number(product.pricing?.calculated_price ?? product.pricing?.base_price ?? 0);
}

const getTotalStock = (product: Product): number => {
    return product.total_stock ?? 0
}

const getBrandNames = (product: Product): string => {
    if (product.variants?.length) {
        return product.variants.map(v => v.brand?.name).filter(Boolean).join(', ')
    }
    return product.default_variant?.brand?.name ?? ''
}

const getAttributeBadges = (product: Product): Array<{ value: string; unit?: string | null }> => {
    if (!product.variants?.length) return [];
    const seen = new Set<string>()
    const badges: Array<{ value: string; unit?: string | null }> = []
    product.variants.forEach(v => {
        v.attributes?.forEach(attr => {
            const val = String(attr.value ?? '')
            const key = `${val}${attr.unit ?? ''}`
            if (!seen.has(key) && val) {
                seen.add(key)
                badges.push({ value: val, unit: attr.unit })
            }
        })
    })
    return badges.slice(0, 4)
}
</script>

<template>
    <!-- LIST VIEW -->
    <div v-if="viewMode === 'list'"
        class="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-200 dark:border-border dark:bg-card dark:hover:border-blue-600 dark:border-primary cursor-pointer"
        @click="emit('select', product)">
        <div class="flex gap-5">
            <!-- Product Image -->
            <div
                class="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20">
                <img v-if="product.image_url" :src="product.image_url" :alt="product.name"
                    class="h-full w-full object-cover" />
                <svg v-else class="h-10 w-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            </div>

            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <h3 class="font-semibold text-gray-900 dark:text-white">{{ product.name }}</h3>
                        <p v-if="product.product_line" class="text-sm text-gray-500 dark:text-gray-400">{{
                            product.product_line.name }}</p>
                        <div class="flex items-center gap-2 mt-1.5">
                            <span
                                class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-muted dark:text-gray-300">
                                <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                {{ product.sku_base }}
                            </span>
                            <span v-if="product.category"
                                class="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                {{ product.category.name }}
                            </span>
                            <span v-if="product.is_universal"
                                class="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/20" title="Universal">
                                🌐 Universal
                            </span>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-4">
                        <p class="text-xs text-gray-500 dark:text-gray-400">Desde</p>
                        <p class="text-xl font-bold text-blue-600 dark:text-primary dark:text-blue-400">
                            {{ getMinPrice(product) > 0 ? formatCurrency(getMinPrice(product)) : 'N/A' }}
                        </p>
                    </div>
                </div>

                <div class="flex items-center justify-between mt-3">
                    <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            <svg class="h-3 w-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Marcas: {{ getBrandNames(product) }}
                        </p>
                        <div v-if="getAttributeBadges(product).length" class="flex flex-wrap gap-1 mt-0.5">
                            <span v-for="badge in getAttributeBadges(product)" :key="badge.value"
                                class="inline-flex rounded-md bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                {{ badge.value }}<span v-if="badge.unit" class="ml-0.5 text-green-600 dark:text-green-400">{{ badge.unit }}</span>
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span v-if="getTotalStock(product) > 0"
                            class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                            {{ getTotalStock(product) }} en stock
                        </span>
                        <span v-else
                            class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                            Sin Stock
                        </span>
                        <button
                            class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-primary/90 transition-colors">
                            Ver Opciones
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- GRID VIEW -->
    <div v-else
        class="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5 dark:border-border dark:bg-card dark:hover:border-blue-600 dark:border-primary cursor-pointer"
        @click="emit('select', product)">
        <!-- Product Image -->
        <div
            class="flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
            <img v-if="product.image_url" :src="product.image_url" :alt="product.name"
                class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <svg v-else class="h-16 w-16 text-gray-300 group-hover:text-blue-400 transition-colors" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        </div>

        <div class="p-4">
            <div class="mb-2">
                <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-1">{{ product.name }}</h3>
                <p v-if="product.product_line" class="text-sm text-gray-500 dark:text-gray-400">{{
                    product.product_line.name }}</p>
            </div>

            <!-- Badges -->
            <div class="flex flex-wrap gap-1.5 mb-3">
                <span
                    class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-muted dark:text-gray-300">
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    {{ product.sku_base }}
                </span>
                <span v-if="product.category"
                    class="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {{ product.category.name }}
                </span>
                <span v-if="product.is_universal"
                    class="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/20" title="Universal">
                    🌐 Universal
                </span>
            </div>

            <!-- Brands -->
            <div class="mb-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                    <svg class="h-3 w-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {{ getBrandNames(product) }}
                </p>
                <div v-if="getAttributeBadges(product).length" class="flex flex-wrap gap-1 mt-1">
                    <span v-for="badge in getAttributeBadges(product)" :key="badge.value"
                        class="inline-flex rounded-md bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        {{ badge.value }}<span v-if="badge.unit" class="ml-0.5 text-green-600 dark:text-green-400">{{ badge.unit }}</span>
                    </span>
                </div>
            </div>

            <!-- Price + CTA -->
            <div class="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-border">
                <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Desde</p>
                    <p class="text-lg font-bold text-blue-600 dark:text-primary dark:text-blue-400">
                        {{ getMinPrice(product) > 0 ? formatCurrency(getMinPrice(product)) : 'N/A' }}
                    </p>
                </div>
                <button
                    class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-primary/90 transition-colors">
                    Ver Opciones
                </button>
            </div>
        </div>
    </div>
</template>
