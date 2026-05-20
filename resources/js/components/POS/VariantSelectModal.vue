<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { X, Package, Layers, ShoppingCart, Truck } from 'lucide-vue-next';
import PriceDisplay from '@/components/ui/PriceDisplay.vue';
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue';
import type { Product, ProductVariant } from '@/types/product';

const props = defineProps<{
    show: boolean;
    product: Product | null;
}>();

const emit = defineEmits<{
    'select-multiple': [
        selections: Array<{ variant: ProductVariant; quantity: number }>,
    ];
    close: [];
}>();

const modalRef = ref<HTMLDivElement | null>(null);
const variants = computed(() => props.product?.variants ?? []);

// Helpers
const getStock = (v: ProductVariant): number => v.total_stock ?? 0;

const currentSalePriceForVariant = (variant: ProductVariant): number =>
    Number(
        variant.inventory?.find(
            (item) =>
                Number(
                    item.current_sale_price ?? item.fifo_sale_price_current,
                ) > 0,
        )?.current_sale_price ??
            variant.inventory?.find(
                (item) =>
                    Number(
                        item.current_sale_price ?? item.fifo_sale_price_current,
                    ) > 0,
            )?.fifo_sale_price_current ??
            variant.pricing?.base_price ??
            0,
    );

const hasLowStock = (v: ProductVariant): boolean => {
    const stock = getStock(v);
    return stock > 0 && stock <= 5;
};

// Multi-select state: variantId -> quantity chosen (0 = not selected)
const selected = ref<Record<number, number>>({});

// Reset selections whenever the modal opens with a new product
watch(
    () => props.show,
    (isOpen) => {
        if (isOpen) {
            selected.value = {};
            nextTick(() => modalRef.value?.focus());
        }
    },
);

// Computed: array of selected variant ids that have qty > 0
const selectedCount = computed(
    () => variants.value.filter((v) => (selected.value[v.id] ?? 0) > 0).length,
);

// Toggle checkbox (sets qty to 1 if unchecked, or removes selection)
const toggleVariant = (variantId: number) => {
    if (selected.value[variantId] > 0) {
        delete selected.value[variantId];
    } else {
        selected.value[variantId] = 1;
    }
};

const isSelected = (variantId: number) => (selected.value[variantId] ?? 0) > 0;
const getQty = (variantId: number) => selected.value[variantId] ?? 1;

const setQty = (variantId: number, qty: number) => {
    const variant = variants.value.find((v) => v.id === variantId);
    if (!variant) return;

    if (qty < 1) qty = 1;

    if (isSelected(variantId)) {
        selected.value[variantId] = qty;
    }
};

// Confirm and emit all selected variants
const confirmSelection = () => {
    const selections = variants.value
        .filter((v) => isSelected(v.id))
        .map((v) => {
            const stock = getStock(v);
            const requested = selected.value[v.id] ?? 1;
            return {
                variant: v,
                quantity: Math.max(1, requested),
            };
        });

    if (selections.length === 0) return;
    emit('select-multiple', selections);
};

// Escape key
const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) emit('close');
};
onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

const stockClass = (stock: number) => {
    if (stock > 5)
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (stock > 0)
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
};

const brandColor = (name: string): string => {
    const colors = [
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
        'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
        'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
        'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

// ── Quick Purchase Modal state ─────────────────────────────────────────────────
const showQuickPurchase = ref(false);
const variantForPurchase = ref<ProductVariant | null>(null);

const openQuickPurchase = (variant: ProductVariant, e: Event) => {
    e.stopPropagation();
    if (!props.product) return;
    variantForPurchase.value = variant;
    showQuickPurchase.value = true;
};

const handlePurchaseSuccess = (result: {
    productId: number;
    variantId: number | null;
    quantityAdded: number;
}) => {
    // Update the variant's stock in place
    if (result.variantId && props.product) {
        const variant = props.product.variants?.find(
            (v) => v.id === result.variantId,
        );
        if (variant && variant.total_stock !== undefined) {
            variant.total_stock += result.quantityAdded;
        }
    }
    showQuickPurchase.value = false;
    variantForPurchase.value = null;
};
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
                class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
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
                        class="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 outline-none dark:bg-card dark:ring-gray-700"
                    >
                        <!-- ═══════════ HEADER ═══════════ -->
                        <div
                            class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-border dark:bg-card"
                        >
                            <div>
                                <h2
                                    class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"
                                >
                                    <Layers class="h-5 w-5 text-indigo-500" />
                                    Seleccionar Variante(s)
                                </h2>
                                <p
                                    class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                                >
                                    <span
                                        class="font-medium text-gray-700 dark:text-gray-300"
                                        >{{ product.name }}</span
                                    >
                                    &mdash; {{ variants.length }} variante{{
                                        variants.length !== 1 ? 's' : ''
                                    }}
                                    disponible{{
                                        variants.length !== 1 ? 's' : ''
                                    }}
                                    <span
                                        v-if="selectedCount > 0"
                                        class="ml-2 font-semibold text-indigo-600 dark:text-indigo-400"
                                    >
                                        · {{ selectedCount }} seleccionada{{
                                            selectedCount !== 1 ? 's' : ''
                                        }}
                                    </span>
                                </p>
                            </div>
                            <button
                                @click="emit('close')"
                                class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted/50"
                            >
                                <X class="h-5 w-5" />
                            </button>
                        </div>

                        <!-- ═══════════ TABLE BODY ═══════════ -->
                        <div class="min-h-0 flex-1 overflow-y-auto">
                            <!-- Empty state -->
                            <div
                                v-if="variants.length === 0"
                                class="flex flex-col items-center justify-center px-6 py-16 text-center"
                            >
                                <Package class="mb-3 h-12 w-12 text-gray-300" />
                                <p class="text-sm font-medium text-gray-500">
                                    No hay variantes disponibles
                                </p>
                            </div>

                            <table v-else class="w-full text-left">
                                <thead
                                    class="dark:bg-gray-750 sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-border"
                                >
                                    <tr>
                                        <th class="w-8 py-3 pr-2 pl-4"></th>
                                        <th
                                            class="px-4 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Marca
                                        </th>
                                        <th
                                            class="px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            SKU
                                        </th>
                                        <th
                                            class="px-3 py-3 text-center text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Stock
                                        </th>
                                        <th
                                            class="px-3 py-3 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Precio
                                        </th>
                                        <th
                                            class="w-24 px-3 py-3 text-center text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                        >
                                            Cantidad
                                        </th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-gray-100 dark:divide-border/50"
                                >
                                    <tr
                                        v-for="variant in variants"
                                        :key="variant.id"
                                        @click="toggleVariant(variant.id)"
                                        class="group transition-colors"
                                        :class="
                                            getStock(variant) <= 0 &&
                                            !isSelected(variant.id)
                                                ? 'cursor-default bg-gray-50/40 opacity-40 dark:bg-muted/20'
                                                : isSelected(variant.id)
                                                  ? 'cursor-pointer bg-indigo-50 hover:bg-indigo-100/70 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30'
                                                  : 'cursor-pointer hover:bg-gray-50/70 dark:hover:bg-muted/30'
                                        "
                                    >
                                        <!-- Checkbox -->
                                        <td
                                            class="py-4 pr-2 pl-4"
                                            @click.stop="
                                                toggleVariant(variant.id)
                                            "
                                        >
                                            <div
                                                class="flex items-center justify-center"
                                            >
                                                <div
                                                    class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors"
                                                    :class="
                                                        getStock(variant) <=
                                                            0 &&
                                                        !isSelected(variant.id)
                                                            ? 'border-gray-200 bg-gray-100 dark:border-border/60 dark:bg-muted/50'
                                                            : isSelected(
                                                                    variant.id,
                                                                )
                                                              ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                                                              : 'border-gray-300 bg-white dark:border-border dark:bg-muted'
                                                    "
                                                >
                                                    <svg
                                                        v-if="
                                                            isSelected(
                                                                variant.id,
                                                            )
                                                        "
                                                        class="h-3 w-3 text-white"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        stroke-width="3"
                                                    >
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                </div>
                                            </div>
                                        </td>

                                        <!-- Brand -->
                                        <td class="px-4 py-4">
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <div
                                                    class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                                                    :class="
                                                        brandColor(
                                                            variant.brand
                                                                ?.name ?? '?',
                                                        )
                                                    "
                                                >
                                                    <span
                                                        class="text-[11px] font-bold uppercase"
                                                    >
                                                        {{
                                                            (
                                                                variant.brand
                                                                    ?.name ??
                                                                '?'
                                                            ).slice(0, 2)
                                                        }}
                                                    </span>
                                                </div>
                                                <span
                                                    class="text-sm font-semibold text-gray-900 transition-colors dark:text-white"
                                                    :class="
                                                        isSelected(variant.id)
                                                            ? 'text-indigo-700 dark:text-indigo-300'
                                                            : getStock(
                                                                    variant,
                                                                ) > 0
                                                              ? 'group-hover:text-indigo-600'
                                                              : ''
                                                    "
                                                >
                                                    {{
                                                        variant.brand?.name ??
                                                        'Sin marca'
                                                    }}
                                                </span>
                                            </div>
                                        </td>

                                        <!-- SKU -->
                                        <td class="px-3 py-4">
                                            <span
                                                class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-muted dark:text-gray-400"
                                            >
                                                {{ variant.sku ?? '—' }}
                                            </span>
                                        </td>

                                        <!-- Stock -->
                                        <td class="px-3 py-4 text-center">
                                            <div
                                                class="flex items-center justify-center gap-2"
                                            >
                                                <span
                                                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                                                    :class="
                                                        stockClass(
                                                            getStock(variant),
                                                        )
                                                    "
                                                >
                                                    {{ getStock(variant) }}
                                                </span>
                                                <button
                                                    v-if="
                                                        getStock(variant) <= 0
                                                    "
                                                    @click="
                                                        openQuickPurchase(
                                                            variant,
                                                            $event,
                                                        )
                                                    "
                                                    class="rounded-lg p-1.5 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30 dark:hover:text-amber-300"
                                                    title="Reabastecer variante"
                                                >
                                                    <Truck class="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>

                                        <!-- Price -->
                                        <td class="px-3 py-4 text-right">
                                            <PriceDisplay
                                                :base-price="
                                                    currentSalePriceForVariant(
                                                        variant,
                                                    )
                                                "
                                                :tax-rate="
                                                    variant.pricing
                                                        ?.sale_tax_rate ??
                                                    variant.pricing?.tax_rate ??
                                                    0
                                                "
                                                size="sm"
                                            />
                                        </td>

                                        <!-- Quantity input (only active when selected) -->
                                        <td
                                            class="px-3 py-4 text-center"
                                            @click.stop
                                        >
                                            <input
                                                v-if="isSelected(variant.id)"
                                                :value="getQty(variant.id)"
                                                @input="
                                                    setQty(
                                                        variant.id,
                                                        Number(
                                                            (
                                                                $event.target as HTMLInputElement
                                                            ).value,
                                                        ),
                                                    )
                                                "
                                                type="number"
                                                min="1"
                                                class="w-20 rounded-lg border border-indigo-300 bg-white px-2 py-1.5 text-center text-sm font-semibold text-indigo-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none dark:border-indigo-600 dark:bg-muted dark:text-indigo-300"
                                                @click.stop
                                            />
                                            <span
                                                v-else
                                                class="text-xs"
                                                :class="
                                                    getStock(variant) > 0
                                                        ? 'text-gray-300 dark:text-gray-600'
                                                        : 'font-semibold text-amber-500 dark:text-amber-400'
                                                "
                                            >
                                                {{
                                                    getStock(variant) > 0
                                                        ? '—'
                                                        : 'Sin stock'
                                                }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- ═══════════ FOOTER ═══════════ -->
                        <div
                            class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-6 py-3 dark:border-border dark:bg-card"
                        >
                            <p class="flex-1 text-xs text-gray-400">
                                <span v-if="selectedCount === 0"
                                    >Haz clic en una fila para seleccionar
                                    variantes</span
                                >
                                <span
                                    v-else
                                    class="font-medium text-indigo-600 dark:text-indigo-400"
                                    >{{ selectedCount }} variante{{
                                        selectedCount !== 1 ? 's' : ''
                                    }}
                                    seleccionada{{
                                        selectedCount !== 1 ? 's' : ''
                                    }}</span
                                >
                            </p>
                            <button
                                @click="emit('close')"
                                class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                            >
                                Cancelar
                            </button>
                            <button
                                @click="confirmSelection"
                                :disabled="selectedCount === 0"
                                class="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                :class="
                                    selectedCount > 0
                                        ? 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500'
                                        : 'bg-gray-400'
                                "
                            >
                                <ShoppingCart class="h-4 w-4" />
                                Añadir
                                {{ selectedCount > 0 ? selectedCount : '' }} al
                                Carrito
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
            @close="
                showQuickPurchase = false;
                variantForPurchase = null;
            "
            @success="handlePurchaseSuccess"
        />
    </Teleport>
</template>
