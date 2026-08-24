<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import {
    FileText,
    Search,
    Plus,
    Minus,
    Trash2,
    Save,
    User,
    Calendar,
    Package,
    Hash,
    AlertTriangle,
} from 'lucide-vue-next';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { createIdempotencyKey } from '@/utils/idempotency';

defineOptions({ layout: AppLayout });

interface Product {
    id: number;
    name: string;
    sku_base: string;
    pricing?: {
        base_price: number;
        tax_rate?: number;
        sale_tax_rate?: number;
    };
    default_variant?: {
        sku: string;
    };
    variants?: {
        id: number;
        sku: string;
        name?: string;
        pricing?: {
            base_price: number;
            tax_rate?: number;
            sale_tax_rate?: number;
        };
    }[];
}

const getPrice = (product: Product, variant?: any) => {
    if (variant?.pricing?.base_price) return Number(variant.pricing.base_price);
    if (product.pricing?.base_price) return Number(product.pricing.base_price);
    return 0;
};

const normalizeTaxPercent = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const getSaleTaxRate = (product: Product, variant?: any): number => {
    return normalizeTaxPercent(
        variant?.pricing?.sale_tax_rate ??
            variant?.pricing?.tax_rate ??
            product.pricing?.sale_tax_rate ??
            product.pricing?.tax_rate ??
            0,
    );
};

interface Customer {
    id: number;
    name: string;
    email: string;
}

interface CartItem {
    product_id: number;
    variant_id: number | null;
    warehouse_id: number;
    product_name: string;
    variant_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    tax_percent: number;
    total: number;
}

const customers = ref<Customer[]>([]);
const products = ref<Product[]>([]);
const cart = ref<CartItem[]>([]);
const saving = ref(false);

// Form fields
const selectedCustomerId = ref<number | null>(null);
const validUntil = ref('');
const notes = ref('');
const internalNotes = ref('');
const productSearch = ref('');
const searchResults = ref<Product[]>([]);
const searchTimeout = ref<any>(null);

// Warehouse
const warehouseId = ref<number>(1);

// R41: Quote number display (shown after first save or preview)
const savedQuoteNumber = ref<string | null>(null);

// UX-001: Track unsaved changes
const isDirty = ref(false);
const showExitModal = ref(false);
const pendingNavigation = ref<string | null>(null);

// Watch for changes to mark as dirty
watch(
    [cart, selectedCustomerId, notes, internalNotes, validUntil],
    () => {
        if (
            cart.value.length > 0 ||
            selectedCustomerId.value ||
            notes.value ||
            internalNotes.value
        ) {
            isDirty.value = true;
        }
    },
    { deep: true },
);

// Intercept browser close/refresh
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty.value && cart.value.length > 0) {
        e.preventDefault();
        e.returnValue =
            '¿Está seguro de salir? Los cambios no guardados se perderán.';
        return e.returnValue;
    }
};

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
});

// Navigation guard helper
const navigateWithCheck = (url: string) => {
    if (isDirty.value && cart.value.length > 0) {
        pendingNavigation.value = url;
        showExitModal.value = true;
    } else {
        router.visit(url);
    }
};

const handleConfirmExit = () => {
    showExitModal.value = false;
    isDirty.value = false;
    if (pendingNavigation.value) {
        router.visit(pendingNavigation.value);
    }
};

const handleSaveAndExit = async () => {
    await handleSave();
};

const handleCancelExit = () => {
    showExitModal.value = false;
    pendingNavigation.value = null;
};

const cartTotal = computed(() =>
    cart.value.reduce((sum, item) => sum + item.total, 0),
);
const cartSubtotal = computed(() =>
    cart.value.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
);

const customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Público General' },
    ...customers.value.map((c) => ({ value: c.id, label: c.name })),
]);

const recalcItem = (item: CartItem) => {
    const sub = item.quantity * item.unit_price;
    const disc = sub * (item.discount_percent / 100);
    const afterDisc = sub - disc;
    item.tax_percent = normalizeTaxPercent(item.tax_percent);
    const tax = afterDisc * (item.tax_percent / 100);
    item.total = afterDisc + tax;
};

const searchProducts = async () => {
    if (productSearch.value.length < 2) {
        searchResults.value = [];
        return;
    }
    clearTimeout(searchTimeout.value);
    searchTimeout.value = setTimeout(async () => {
        try {
            const res = await apiClient.get('/products', {
                params: { search: productSearch.value, per_page: 10 },
            });
            searchResults.value = res.data.data ?? res.data ?? [];
        } catch (e) {
            searchResults.value = [];
        }
    }, 300);
};

const addProduct = (product: Product, variant?: any) => {
    const existingIdx = cart.value.findIndex(
        (i) =>
            i.product_id === product.id &&
            i.variant_id === (variant?.id ?? null),
    );

    if (existingIdx >= 0) {
        cart.value[existingIdx].quantity++;
        recalcItem(cart.value[existingIdx]);
    } else {
        const price = getPrice(product, variant);
        const item: CartItem = {
            product_id: product.id,
            variant_id: variant?.id ?? null,
            warehouse_id: warehouseId.value,
            product_name: product.name,
            variant_name: variant?.sku || variant?.name || '',
            sku: variant?.sku || product.sku_base,
            quantity: 1,
            unit_price: price,
            discount_percent: 0,
            tax_percent: getSaleTaxRate(product, variant),
            total: price,
        };
        cart.value.push(item);
    }

    productSearch.value = '';
    searchResults.value = [];
};

const removeItem = (idx: number) => {
    cart.value.splice(idx, 1);
};

const changeQty = (idx: number, delta: number) => {
    const item = cart.value[idx];
    item.quantity = Math.max(1, item.quantity + delta);
    recalcItem(item);
};

const fetchCustomers = async () => {
    try {
        const res = await apiClient.get('/customers', {
            params: { per_page: 100 },
        });
        customers.value = res.data.data ?? res.data ?? [];
    } catch (e) {
        console.error('Error loading customers:', e);
    }
};

const fetchWarehouse = async () => {
    try {
        const res = await apiClient.get('/user/warehouse-context');
        warehouseId.value = res.data.warehouse_id || 1;
    } catch (e) {
        // fallback
    }
};

const handleSave = async () => {
    if (saving.value) return;
    if (cart.value.length === 0) {
        alert('Agrega al menos un producto a la cotización.');
        return;
    }

    saving.value = true;
    try {
        const payload = {
            idempotency_key: createIdempotencyKey(),
            customer_id: selectedCustomerId.value || null,
            warehouse_id: warehouseId.value,
            valid_until: validUntil.value || null,
            notes: notes.value || null,
            internal_notes: internalNotes.value || null,
            items: cart.value.map((item) => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                warehouse_id: item.warehouse_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_percent: item.discount_percent,
                tax_percent: normalizeTaxPercent(item.tax_percent),
            })),
        };

        const response = await apiClient.post('/sales-quotes', payload);
        // R41: Store the quote number after saving
        if (response.data?.quote_number) {
            savedQuoteNumber.value = response.data.quote_number;
        }
        isDirty.value = false; // Clear dirty flag before navigation
        router.visit('/sales-quotes');
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al guardar la cotización');
    } finally {
        saving.value = false;
    }
};

onMounted(async () => {
    await Promise.all([fetchCustomers(), fetchWarehouse()]);
    // Default valid_until = 15 days from now
    const d = new Date();
    d.setDate(d.getDate() + 15);
    validUntil.value = d.toISOString().slice(0, 10);
});
</script>

<template>
    <Head title="Nueva Cotización" />

    <div class="mx-auto max-w-7xl">
        <!-- R41: Enhanced Header with Quote Number -->
        <div
            class="mb-6 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-blue-950/30"
        >
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div
                        class="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/50"
                    >
                        <FileText
                            class="h-6 w-6 text-indigo-600 dark:text-indigo-400"
                        />
                    </div>
                    <div>
                        <h1
                            class="text-xl font-bold text-gray-900 dark:text-white"
                        >
                            Nueva Cotización
                        </h1>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Crea un presupuesto sin afectar el inventario
                        </p>
                    </div>
                </div>

                <!-- Quote Number Badge -->
                <div
                    class="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-3 shadow-sm dark:border-indigo-800 dark:bg-card"
                >
                    <Hash class="h-5 w-5 text-indigo-500" />
                    <div class="text-right">
                        <p
                            class="text-xs tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                            Cotización
                        </p>
                        <p
                            class="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400"
                        >
                            {{ savedQuoteNumber || 'NUEVA' }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <!-- Left: product search + cart -->
            <div class="space-y-4 lg:col-span-2">
                <!-- Product Search -->
                <div
                    class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <label
                        class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                        >Buscar productos</label
                    >
                    <div class="relative">
                        <Search
                            class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
                            :size="18"
                        />
                        <input
                            v-model="productSearch"
                            @input="searchProducts"
                            type="text"
                            placeholder="Escribe SKU o nombre del producto..."
                            class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-4 pl-10 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Search Results -->
                    <div
                        v-if="searchResults.length > 0"
                        class="mt-2 max-h-64 overflow-hidden overflow-y-auto rounded-lg border border-gray-200 dark:border-border"
                    >
                        <template
                            v-for="product in searchResults"
                            :key="product.id"
                        >
                            <div
                                v-if="
                                    product.variants &&
                                    product.variants.length > 0
                                "
                            >
                                <div
                                    v-for="variant in product.variants"
                                    :key="variant.id"
                                    @click="addProduct(product, variant)"
                                    class="flex cursor-pointer items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-indigo-50 dark:border-border dark:hover:bg-indigo-900/20"
                                >
                                    <div>
                                        <p
                                            class="text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            {{ product.name }}
                                        </p>
                                        <p class="text-xs text-gray-500">
                                            {{ variant.sku || variant.name }}
                                        </p>
                                    </div>
                                    <span
                                        class="text-sm font-bold text-indigo-600 dark:text-primary"
                                        >${{
                                            getPrice(product, variant).toFixed(
                                                2,
                                            )
                                        }}</span
                                    >
                                </div>
                            </div>
                            <div
                                v-else
                                @click="addProduct(product)"
                                class="flex cursor-pointer items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-indigo-50 dark:border-border dark:hover:bg-indigo-900/20"
                            >
                                <div>
                                    <p
                                        class="text-sm font-medium text-gray-900 dark:text-white"
                                    >
                                        {{ product.name }}
                                    </p>
                                    <p class="text-xs text-gray-500">
                                        {{ product.sku_base }}
                                    </p>
                                </div>
                                <span
                                    class="text-sm font-bold text-indigo-600 dark:text-primary"
                                    >${{ getPrice(product).toFixed(2) }}</span
                                >
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Cart Items -->
                <div
                    class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-border dark:bg-background"
                    >
                        <h3
                            class="flex items-center gap-2 text-sm font-bold tracking-wider text-gray-700 uppercase dark:text-gray-300"
                        >
                            <Package :size="16" />
                            Artículos ({{ cart.length }})
                        </h3>
                    </div>

                    <div
                        v-if="cart.length === 0"
                        class="p-8 text-center text-gray-400"
                    >
                        <Package class="mx-auto mb-3 h-12 w-12 opacity-30" />
                        <p>Agrega productos usando la barra de búsqueda</p>
                    </div>

                    <div v-else>
                        <div
                            v-for="(item, idx) in cart"
                            :key="idx"
                            class="flex items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-border"
                        >
                            <!-- Product Info -->
                            <div class="min-w-0 flex-1">
                                <p
                                    class="truncate text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{ item.product_name }}
                                </p>
                                <p
                                    v-if="item.variant_name"
                                    class="text-xs text-gray-500"
                                >
                                    {{ item.variant_name }}
                                </p>
                            </div>

                            <!-- Price -->
                            <div class="w-24">
                                <input
                                    v-model.number="item.unit_price"
                                    @input="recalcItem(item)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>

                            <!-- Quantity -->
                            <div class="flex items-center gap-1">
                                <button
                                    @click="changeQty(idx, -1)"
                                    class="rounded bg-gray-100 p-1 hover:bg-gray-200 dark:bg-muted dark:hover:bg-muted"
                                >
                                    <Minus :size="14" />
                                </button>
                                <span
                                    class="w-8 text-center text-sm font-bold text-gray-900 dark:text-white"
                                    >{{ item.quantity }}</span
                                >
                                <button
                                    @click="changeQty(idx, 1)"
                                    class="rounded bg-gray-100 p-1 hover:bg-gray-200 dark:bg-muted dark:hover:bg-muted"
                                >
                                    <Plus :size="14" />
                                </button>
                            </div>

                            <!-- Line Total -->
                            <div class="w-24 text-right">
                                <span
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                    >${{ item.total.toFixed(2) }}</span
                                >
                            </div>

                            <!-- Remove -->
                            <button
                                @click="removeItem(idx)"
                                class="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            >
                                <Trash2 :size="16" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: form + totals -->
            <div class="space-y-4">
                <!-- Customer & Dates -->
                <div
                    class="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                        >
                            <User :size="12" class="mr-1 inline" />
                            Cliente
                        </label>
                        <SearchableSelect
                            v-model="selectedCustomerId"
                            :options="customerOptions"
                            placeholder="Público General"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                        >
                            <Calendar :size="12" class="mr-1 inline" />
                            Válida hasta
                        </label>
                        <input
                            v-model="validUntil"
                            type="date"
                            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                            >Notas</label
                        >
                        <textarea
                            v-model="notes"
                            rows="3"
                            placeholder="Comentarios para el cliente..."
                            class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        ></textarea>
                    </div>

                    <div>
                        <label
                            class="mb-1.5 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                            >Nota Interna</label
                        >
                        <textarea
                            v-model="internalNotes"
                            rows="2"
                            placeholder="Nota interna — solo visible para el equipo"
                            class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        ></textarea>
                        <p class="mt-1 text-xs text-muted-foreground">
                            Esta nota no aparece en documentos impresos ni en el
                            ticket del cliente.
                        </p>
                    </div>
                </div>

                <!-- Totals -->
                <div
                    class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <div class="space-y-2">
                        <div
                            class="flex justify-between text-sm text-gray-600 dark:text-gray-400"
                        >
                            <span>Subtotal</span>
                            <span>${{ cartSubtotal.toFixed(2) }}</span>
                        </div>
                        <div
                            class="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900 dark:border-border dark:text-white"
                        >
                            <span>TOTAL</span>
                            <span class="text-indigo-600 dark:text-primary"
                                >${{ cartTotal.toFixed(2) }}</span
                            >
                        </div>
                    </div>
                </div>

                <!-- Save Button -->
                <button
                    @click="handleSave"
                    :disabled="saving || cart.length === 0"
                    class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:bg-gray-400 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Save :size="20" />
                    {{ saving ? 'Guardando...' : 'Guardar Cotización' }}
                </button>
            </div>
        </div>
    </div>

    <!-- UX-001: Exit Confirmation Modal -->
    <Teleport to="body">
        <div
            v-if="showExitModal"
            class="fixed inset-0 z-50 flex items-center justify-center"
        >
            <!-- Backdrop -->
            <div
                class="absolute inset-0 bg-black/50"
                @click="handleCancelExit"
            ></div>

            <!-- Modal -->
            <div
                class="relative z-10 mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-card"
            >
                <div class="flex items-start gap-4">
                    <div
                        class="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30"
                    >
                        <AlertTriangle
                            class="h-6 w-6 text-amber-600 dark:text-amber-400"
                        />
                    </div>
                    <div class="flex-1">
                        <h3
                            class="text-lg font-bold text-gray-900 dark:text-white"
                        >
                            ¿Salir sin guardar?
                        </h3>
                        <p
                            class="mt-2 text-sm text-gray-600 dark:text-gray-400"
                        >
                            Tiene cambios sin guardar en esta cotización. ¿Qué
                            desea hacer?
                        </p>
                    </div>
                </div>

                <div class="mt-6 space-y-3">
                    <button
                        @click="handleSaveAndExit"
                        :disabled="saving"
                        class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700"
                    >
                        <Save :size="18" />
                        {{ saving ? 'Guardando...' : 'Guardar y salir' }}
                    </button>

                    <button
                        @click="handleConfirmExit"
                        class="w-full rounded-lg bg-gray-100 px-4 py-2.5 font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-muted dark:text-gray-300 dark:hover:bg-muted/80"
                    >
                        Salir sin guardar
                    </button>

                    <button
                        @click="handleCancelExit"
                        class="w-full px-4 py-2.5 font-medium text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
