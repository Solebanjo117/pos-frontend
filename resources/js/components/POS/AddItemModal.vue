<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { X, Search, Plus, Package, ChevronDown } from 'lucide-vue-next';
import apiClient from '@/services/api/client';
import { useStoreSettings } from '@/composables/useStoreSettings';
import type { User } from '@/types';

interface FoundProduct {
    id: number;
    name: string;
    sku_base: string;
    default_variant?: {
        id: number;
        sku: string;
        pricing?: {
            base_price: number;
            tax_rate?: number;
            sale_tax_rate?: number;
        };
        inventory?: {
            current_sale_price?: number;
            fifo_sale_price_current?: number;
        }[];
    };
    variants?: {
        id: number;
        sku: string;
        brand?: { name: string };
        pricing?: {
            base_price: number;
            tax_rate?: number;
            sale_tax_rate?: number;
        };
        total_stock: number;
        inventory?: {
            current_sale_price?: number;
            fifo_sale_price_current?: number;
        }[];
    }[];
    pricing?: { base_price: number; tax_rate?: number; sale_tax_rate?: number };
    image_url?: string | null;
}

interface PendingItem {
    product: FoundProduct;
    variant_id: number | null;
    quantity: number;
    unit_price: number;
    tax_percent: number;
    seller_id: number | null;
}

const props = defineProps<{
    show: boolean;
    orderId: number;
    warehouseId: number;
    users: User[];
    currentUserId?: number;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'added'): void;
}>();

const searchQuery = ref('');
const searchResults = ref<FoundProduct[]>([]);
const searching = ref(false);
const pendingItems = ref<PendingItem[]>([]);
const submitting = ref(false);
const errorMsg = ref<string | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const { defaultTaxRate: storeDefaultTaxRate } = useStoreSettings();

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const normalizeTaxPercent = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const resolveSaleTaxRate = (pricing?: {
    tax_rate?: number;
    sale_tax_rate?: number;
}): number => {
    const raw = pricing?.sale_tax_rate ?? pricing?.tax_rate;
    if (raw === null || raw === undefined) return storeDefaultTaxRate();
    return normalizeTaxPercent(raw);
};

const activeSalePriceForProduct = (product: FoundProduct): number | null => {
    const activeInventory = product.default_variant?.inventory?.find(
        (item) =>
            Number(item.current_sale_price ?? item.fifo_sale_price_current) > 0,
    );
    const price = Number(
        activeInventory?.current_sale_price ??
            activeInventory?.fifo_sale_price_current,
    );

    return Number.isFinite(price) && price > 0 ? price : null;
};

watch(
    () => props.show,
    (open) => {
        if (open) {
            searchQuery.value = '';
            searchResults.value = [];
            pendingItems.value = [];
            errorMsg.value = null;
            nextTick(() => searchInputRef.value?.focus());
        }
    },
);

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) emit('close');
};
onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

const doSearch = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const q = searchQuery.value.trim();
        if (q.length < 2) {
            searchResults.value = [];
            return;
        }
        searching.value = true;
        try {
            const { data } = await apiClient.get('/products', {
                params: { search: q, per_page: 10 },
            });
            searchResults.value = data.data ?? data;
        } catch {
            searchResults.value = [];
        } finally {
            searching.value = false;
        }
    }, 300);
};

const addProduct = (product: FoundProduct) => {
    const existsIdx = pendingItems.value.findIndex(
        (p) => p.product.id === product.id,
    );
    if (existsIdx >= 0) {
        pendingItems.value[existsIdx].quantity++;
        return;
    }
    const pricing = product.default_variant?.pricing ?? product.pricing;
    pendingItems.value.push({
        product,
        variant_id: product.default_variant?.id ?? null,
        quantity: 1,
        unit_price:
            activeSalePriceForProduct(product) ?? pricing?.base_price ?? 0,
        tax_percent: resolveSaleTaxRate(pricing),
        seller_id: props.currentUserId ?? null,
    });
    searchQuery.value = '';
    searchResults.value = [];
};

const removeItem = (idx: number) => {
    pendingItems.value.splice(idx, 1);
};

const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const totalEstimated = computed(() =>
    pendingItems.value.reduce((sum, i) => {
        const sub = i.quantity * i.unit_price;
        return sum + sub + (sub * i.tax_percent) / 100;
    }, 0),
);

const handleSubmit = async () => {
    if (pendingItems.value.length === 0) return;
    submitting.value = true;
    errorMsg.value = null;
    try {
        for (const item of pendingItems.value) {
            await apiClient.post(`/sales-orders/${props.orderId}/items`, {
                product_id: item.product.id,
                variant_id: item.variant_id,
                warehouse_id: props.warehouseId,
                quantity: item.quantity,
                unit_price: item.unit_price,
                tax_percent: normalizeTaxPercent(item.tax_percent),
                seller_id: item.seller_id,
            });
        }
        emit('added');
        emit('close');
    } catch (err: any) {
        errorMsg.value =
            err.response?.data?.message || 'Error al agregar artículos';
    } finally {
        submitting.value = false;
    }
};
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
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
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
                        class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-card dark:ring-gray-700"
                    >
                        <!-- Header -->
                        <div
                            class="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="rounded-xl bg-green-100 p-2 dark:bg-green-900/30"
                                >
                                    <Plus
                                        class="h-5 w-5 text-green-600 dark:text-green-400"
                                    />
                                </div>
                                <div>
                                    <h2
                                        class="text-lg font-bold text-gray-900 dark:text-white"
                                    >
                                        Agregar Artículos
                                    </h2>
                                    <p
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Busca productos y agrégalos a esta orden
                                    </p>
                                </div>
                            </div>
                            <button
                                @click="emit('close')"
                                class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted/50"
                            >
                                <X class="h-5 w-5" />
                            </button>
                        </div>

                        <!-- Body -->
                        <div class="flex-1 space-y-5 overflow-y-auto p-6">
                            <!-- Error -->
                            <div
                                v-if="errorMsg"
                                class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20"
                            >
                                {{ errorMsg }}
                            </div>

                            <!-- Search -->
                            <div class="relative">
                                <Search
                                    class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    ref="searchInputRef"
                                    v-model="searchQuery"
                                    @input="doSearch"
                                    type="text"
                                    placeholder="Buscar producto por nombre o SKU..."
                                    class="w-full rounded-xl border border-gray-300 bg-white py-2.5 pr-4 pl-10 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-border dark:bg-muted dark:text-white"
                                />
                                <!-- Dropdown results -->
                                <div
                                    v-if="searchResults.length > 0"
                                    class="absolute top-full right-0 left-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card"
                                >
                                    <button
                                        v-for="p in searchResults"
                                        :key="p.id"
                                        @click="addProduct(p)"
                                        class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-green-50 dark:hover:bg-green-900/15"
                                    >
                                        <Package
                                            class="h-5 w-5 shrink-0 text-gray-300"
                                        />
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="truncate text-sm font-medium text-gray-900 dark:text-white"
                                            >
                                                {{ p.name }}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                {{
                                                    p.sku_base ||
                                                    p.default_variant?.sku ||
                                                    ''
                                                }}
                                            </p>
                                        </div>
                                        <span
                                            class="text-xs font-medium text-green-600"
                                        >
                                            {{
                                                formatCurrency(
                                                    activeSalePriceForProduct(
                                                        p,
                                                    ) ??
                                                        (
                                                            p.default_variant
                                                                ?.pricing ??
                                                            p.pricing
                                                        )?.base_price ??
                                                        0,
                                                )
                                            }}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <!-- Pending items table -->
                            <div v-if="pendingItems.length > 0">
                                <label
                                    class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                    >Artículos a agregar</label
                                >
                                <div
                                    class="overflow-hidden rounded-xl border border-gray-200 dark:border-border"
                                >
                                    <table class="w-full text-left">
                                        <thead
                                            class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-background/50"
                                        >
                                            <tr>
                                                <th
                                                    class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase"
                                                >
                                                    Producto
                                                </th>
                                                <th
                                                    class="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase"
                                                >
                                                    Precio
                                                </th>
                                                <th
                                                    class="w-28 px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase"
                                                >
                                                    ITBMS
                                                </th>
                                                <th
                                                    class="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase"
                                                >
                                                    Cant.
                                                </th>
                                                <th
                                                    class="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase"
                                                >
                                                    Vendedor
                                                </th>
                                                <th
                                                    class="w-10 px-2 py-2.5"
                                                ></th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-gray-100 dark:divide-border/50"
                                        >
                                            <tr
                                                v-for="(
                                                    item, idx
                                                ) in pendingItems"
                                                :key="idx"
                                                class="bg-white dark:bg-card"
                                            >
                                                <td class="px-4 py-3">
                                                    <p
                                                        class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                                                    >
                                                        {{ item.product.name }}
                                                    </p>
                                                    <p
                                                        class="font-mono text-xs text-gray-400"
                                                    >
                                                        {{
                                                            item.product
                                                                .sku_base ||
                                                            item.product
                                                                .default_variant
                                                                ?.sku
                                                        }}
                                                    </p>
                                                </td>
                                                <td
                                                    class="px-3 py-3 text-right"
                                                >
                                                    <input
                                                        v-model.number="
                                                            item.unit_price
                                                        "
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        class="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                    />
                                                </td>
                                                <td
                                                    class="px-3 py-3 text-center"
                                                >
                                                    <div class="relative">
                                                        <select
                                                            v-model.number="
                                                                item.tax_percent
                                                            "
                                                            class="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-1 pr-6 pl-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                        >
                                                            <option :value="0">
                                                                0%
                                                            </option>
                                                            <option
                                                                :value="
                                                                    storeDefaultTaxRate()
                                                                "
                                                            >
                                                                {{
                                                                    storeDefaultTaxRate()
                                                                }}%
                                                            </option>
                                                            <option :value="10">
                                                                10%
                                                            </option>
                                                            <option :value="15">
                                                                15%
                                                            </option>
                                                        </select>
                                                        <ChevronDown
                                                            class="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-gray-400"
                                                        />
                                                    </div>
                                                </td>
                                                <td
                                                    class="px-3 py-3 text-center"
                                                >
                                                    <input
                                                        v-model.number="
                                                            item.quantity
                                                        "
                                                        type="number"
                                                        min="1"
                                                        class="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                    />
                                                </td>
                                                <td class="px-3 py-3">
                                                    <div class="relative">
                                                        <select
                                                            v-model="
                                                                item.seller_id
                                                            "
                                                            class="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-1.5 pr-8 pl-3 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                        >
                                                            <option
                                                                :value="null"
                                                            >
                                                                — Sin asignar —
                                                            </option>
                                                            <option
                                                                v-for="u in users"
                                                                :key="u.id"
                                                                :value="u.id"
                                                            >
                                                                {{ u.name }}
                                                            </option>
                                                        </select>
                                                        <ChevronDown
                                                            class="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                                                        />
                                                    </div>
                                                </td>
                                                <td
                                                    class="px-2 py-3 text-center"
                                                >
                                                    <button
                                                        @click="removeItem(idx)"
                                                        class="text-red-400 transition-colors hover:text-red-600"
                                                    >
                                                        <X class="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Empty -->
                            <div v-else class="py-8 text-center text-gray-400">
                                <Package
                                    class="mx-auto mb-2 h-10 w-10 opacity-50"
                                />
                                <p class="text-sm">
                                    Busca un producto arriba para agregarlo
                                </p>
                            </div>

                            <!-- Total -->
                            <div
                                v-if="pendingItems.length > 0"
                                class="rounded-xl bg-green-50 p-4 dark:bg-green-900/20"
                            >
                                <div class="flex items-center justify-between">
                                    <span
                                        class="text-sm font-semibold text-green-700 dark:text-green-300"
                                        >Total estimado:</span
                                    >
                                    <span
                                        class="text-xl font-bold text-green-600 dark:text-green-400"
                                        >{{
                                            formatCurrency(totalEstimated)
                                        }}</span
                                    >
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div
                            class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-border"
                        >
                            <button
                                @click="emit('close')"
                                class="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                            >
                                Cancelar
                            </button>
                            <button
                                @click="handleSubmit"
                                :disabled="
                                    pendingItems.length === 0 || submitting
                                "
                                class="rounded-xl bg-green-600 px-6 py-2.5 font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-40"
                            >
                                {{
                                    submitting
                                        ? 'Agregando...'
                                        : `Agregar ${pendingItems.length} artículo${pendingItems.length !== 1 ? 's' : ''}`
                                }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
