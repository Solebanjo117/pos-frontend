<script setup lang="ts">
import type { Product, ProductVariant } from '@/types/product';

interface Props {
    product: Product;
    viewMode: 'grid' | 'list';
}

type CatalogVariant = ProductVariant & {
    attributes?: Array<{
        name?: string;
        value?: string | number;
        unit?: string | null;
    }>;
};

const props = defineProps<Props>();
const emit = defineEmits<{ select: [product: Product] }>();

const selectProduct = () => {
    emit('select', props.product);
};

const getVariants = (product: Product): CatalogVariant[] => {
    if (product.variants?.length) return product.variants as CatalogVariant[];
    if (product.default_variant)
        return [product.default_variant as CatalogVariant];
    return [];
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(value);

const getTotalStock = (product: Product): number => {
    return product.total_stock ?? 0;
};

const getVariantCount = (product: Product): number => {
    return getVariants(product).length;
};

const getBrandNames = (product: Product): string => {
    const brands = new Set<string>();

    getVariants(product).forEach((variant) => {
        if (variant.brand?.name) {
            brands.add(variant.brand.name);
        }
    });

    return Array.from(brands).join(', ');
};

const getAttributeBadges = (
    product: Product,
): Array<{ name: string; value: string; unit?: string | null }> => {
    const seen = new Set<string>();
    const badges: Array<{ name: string; value: string; unit?: string | null }> =
        [];

    getVariants(product).forEach((variant) => {
        variant.attributes?.forEach((attr) => {
            const name = String(attr.name ?? '').trim();
            const value = String(attr.value ?? '').trim();
            const key = `${name}:${value}${attr.unit ?? ''}`;

            if (!seen.has(key) && name && value) {
                seen.add(key);
                badges.push({ name, value, unit: attr.unit });
            }
        });
    });

    return badges.slice(0, 4);
};

const getMinPrice = (product: Product): number | null => {
    const prices = [
        product.pricing?.base_price,
        product.pricing?.calculated_price,
        product.default_variant?.pricing?.base_price,
        product.default_variant?.pricing?.calculated_price,
        ...getVariants(product).flatMap((variant) => [
            variant.pricing?.base_price,
            variant.pricing?.calculated_price,
        ]),
    ]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

    return prices.length > 0 ? Math.min(...prices) : null;
};
</script>

<template>
    <!-- LIST VIEW -->
    <div
        v-if="viewMode === 'list'"
        class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md dark:border-border dark:border-primary dark:bg-card dark:hover:border-blue-600"
        @click="selectProduct"
    >
        <div class="flex flex-col gap-4 md:flex-row md:gap-5">
            <!-- Product Image -->
            <div
                class="flex h-28 w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 md:w-28 dark:from-blue-900/30 dark:to-blue-800/20"
            >
                <img
                    v-if="product.image_url"
                    :src="product.image_url"
                    :alt="product.name"
                    class="h-full w-full object-cover"
                />
                <svg
                    v-else
                    class="h-10 w-10 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                </svg>
            </div>

            <div class="min-w-0 flex-1">
                <div
                    class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                >
                    <div class="min-w-0">
                        <h3
                            class="font-semibold break-words text-gray-900 dark:text-white"
                        >
                            {{ product.name }}
                        </h3>
                        <p
                            v-if="product.product_line"
                            class="text-sm text-gray-500 dark:text-gray-400"
                        >
                            {{ product.product_line.name }}
                        </p>
                        <div class="mt-1.5 flex flex-wrap items-center gap-2">
                            <span
                                class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-muted dark:text-gray-300"
                            >
                                <svg
                                    class="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                    />
                                </svg>
                                {{ product.sku_base }}
                            </span>
                            <span
                                v-if="product.category"
                                class="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            >
                                {{ product.category.name }}
                            </span>
                            <span
                                v-if="product.is_universal"
                                class="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/20"
                                title="Universal"
                            >
                                Universal
                            </span>
                        </div>
                    </div>

                    <div
                        class="flex flex-wrap items-center gap-2 lg:justify-end"
                    >
                        <button
                            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                            @click.stop="selectProduct"
                        >
                            Ver opciones
                        </button>
                    </div>
                </div>

                <div class="mt-3">
                    <p
                        v-if="getBrandNames(product)"
                        class="text-xs text-gray-500 dark:text-gray-400"
                    >
                        Marcas: {{ getBrandNames(product) }}
                    </p>
                    <div
                        v-if="getAttributeBadges(product).length"
                        class="mt-1 flex flex-wrap gap-1"
                    >
                        <span
                            v-for="badge in getAttributeBadges(product)"
                            :key="`${badge.name}-${badge.value}`"
                            :title="badge.name"
                            class="inline-flex rounded-md bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        >
                            {{ badge.value
                            }}<span
                                v-if="badge.unit"
                                class="ml-0.5 text-green-600 dark:text-green-400"
                                >{{ badge.unit }}</span
                            >
                        </span>
                    </div>
                </div>

                <div
                    class="mt-4 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3 dark:border-border dark:bg-muted"
                >
                    <div>
                        <p
                            class="text-[11px] font-medium text-gray-500 uppercase dark:text-gray-400"
                        >
                            Variantes
                        </p>
                        <p
                            class="text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            <template v-if="getVariantCount(product) > 0">
                                {{ getVariantCount(product) }}
                                {{
                                    getVariantCount(product) === 1
                                        ? 'variante disponible'
                                        : 'variantes disponibles'
                                }}
                            </template>
                            <template v-else
                                >Sin variantes disponibles</template
                            >
                        </p>
                    </div>
                    <div>
                        <p
                            class="text-[11px] font-medium text-gray-500 uppercase dark:text-gray-400"
                        >
                            Stock total
                        </p>
                        <p
                            class="text-sm font-semibold"
                            :class="
                                getTotalStock(product) > 0
                                    ? 'text-green-700 dark:text-green-400'
                                    : 'text-red-700 dark:text-red-400'
                            "
                        >
                            <template v-if="getTotalStock(product) > 0">
                                {{ getTotalStock(product) }} en stock total
                            </template>
                            <template v-else>Sin stock</template>
                        </p>
                    </div>
                    <div>
                        <p
                            class="text-[11px] font-medium text-gray-500 uppercase dark:text-gray-400"
                        >
                            Precio
                        </p>
                        <p
                            class="text-sm font-semibold text-blue-700 dark:text-blue-300"
                        >
                            <template v-if="getMinPrice(product) !== null">
                                Desde
                                {{ formatCurrency(getMinPrice(product) ?? 0) }}
                            </template>
                            <template v-else>Sin precio</template>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- GRID VIEW -->
    <div
        v-else
        class="group cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-border dark:border-primary dark:bg-card dark:hover:border-blue-600"
        @click="selectProduct"
    >
        <!-- Product Image -->
        <div
            class="flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800"
        >
            <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <svg
                v-else
                class="h-16 w-16 text-gray-300 transition-colors group-hover:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
            </svg>
        </div>

        <div class="p-4">
            <div class="mb-2">
                <h3
                    class="line-clamp-2 font-semibold text-gray-900 dark:text-white"
                >
                    {{ product.name }}
                </h3>
                <p
                    v-if="product.product_line"
                    class="truncate text-sm text-gray-500 dark:text-gray-400"
                >
                    {{ product.product_line.name }}
                </p>
            </div>

            <!-- Badges -->
            <div class="mb-3 flex flex-wrap gap-1.5">
                <span
                    class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-muted dark:text-gray-300"
                >
                    <svg
                        class="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                    </svg>
                    {{ product.sku_base }}
                </span>
                <span
                    v-if="product.category"
                    class="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                >
                    {{ product.category.name }}
                </span>
                <span
                    v-if="product.is_universal"
                    class="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/20"
                    title="Universal"
                >
                    Universal
                </span>
            </div>

            <!-- Brands -->
            <div class="mb-3">
                <p
                    v-if="getBrandNames(product)"
                    class="truncate text-xs text-gray-500 dark:text-gray-400"
                >
                    Marcas: {{ getBrandNames(product) }}
                </p>
                <div
                    v-if="getAttributeBadges(product).length"
                    class="mt-1 flex flex-wrap gap-1"
                >
                    <span
                        v-for="badge in getAttributeBadges(product)"
                        :key="`${badge.name}-${badge.value}`"
                        :title="badge.name"
                        class="inline-flex rounded-md bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    >
                        {{ badge.value
                        }}<span
                            v-if="badge.unit"
                            class="ml-0.5 text-green-600 dark:text-green-400"
                            >{{ badge.unit }}</span
                        >
                    </span>
                </div>
            </div>

            <!-- Variant summary + CTA -->
            <div class="border-t border-gray-100 pt-3 dark:border-border">
                <div class="mb-3 rounded-md bg-gray-50 p-3 dark:bg-muted">
                    <div class="grid gap-2">
                        <div class="flex items-center justify-between gap-2">
                            <span
                                class="text-xs text-gray-500 dark:text-gray-400"
                            >
                                Variantes
                            </span>
                            <span
                                class="text-sm font-semibold text-gray-900 dark:text-white"
                            >
                                <template v-if="getVariantCount(product) > 0">
                                    {{ getVariantCount(product) }}
                                    {{
                                        getVariantCount(product) === 1
                                            ? 'variante disponible'
                                            : 'variantes disponibles'
                                    }}
                                </template>
                                <template v-else
                                    >Sin variantes disponibles</template
                                >
                            </span>
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <span
                                class="text-xs text-gray-500 dark:text-gray-400"
                            >
                                Stock total
                            </span>
                            <span
                                class="text-sm font-semibold"
                                :class="
                                    getTotalStock(product) > 0
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-red-700 dark:text-red-400'
                                "
                            >
                                <template v-if="getTotalStock(product) > 0">
                                    {{ getTotalStock(product) }} en stock total
                                </template>
                                <template v-else>Sin stock</template>
                            </span>
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <span
                                class="text-xs text-gray-500 dark:text-gray-400"
                            >
                                Precio
                            </span>
                            <span
                                class="text-sm font-semibold text-blue-700 dark:text-blue-300"
                            >
                                <template v-if="getMinPrice(product) !== null">
                                    Desde
                                    {{
                                        formatCurrency(
                                            getMinPrice(product) ?? 0,
                                        )
                                    }}
                                </template>
                                <template v-else>Sin precio</template>
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    class="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    @click.stop="selectProduct"
                >
                    Ver opciones
                </button>
            </div>
        </div>
    </div>
</template>
