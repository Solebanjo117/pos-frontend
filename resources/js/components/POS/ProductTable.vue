<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import {
    Trash2,
    Plus,
    Minus,
    ChevronDown,
    ChevronUp,
    DollarSign,
    Lock,
    GripVertical,
    Truck,
} from 'lucide-vue-next';
import { ref, computed } from 'vue';
import draggable from 'vuedraggable';
import QuickPurchaseModal from '@/components/POS/QuickPurchaseModal.vue';
import PricingFormula from '@/components/Products/PricingFormula.vue';
import { formatCurrency } from '@/utils/formatters';

const props = defineProps<{
    items: any[];
    users: { id: number; name: string }[];
    products?: any[]; // Full product catalog for context menu details
    clientMode?: boolean; // Code protection: show DB IDs instead of SKUs
    warehouseId?: number | null;
    returnMode?: boolean;
    canEditSeller?: boolean;
    canEditCommercial?: boolean;
    canManagePurchases?: boolean;
}>();

const emit = defineEmits([
    'update-quantity',
    'remove',
    'update-item-tax',
    'toggle-item-tax-exempt',
    'update-item-seller',
    'update-item-notes',
    'update-item-price',
    'update-item-discount',
    'view-details',
    'reorder',
    'reorder-success',
]);

const localItems = computed({
    get: () => props.items,
    set: (val) => emit('reorder', val),
});

// Track which row is expanded (only one at a time)
const expandedItemId = ref<string | null>(null);

const toggleExpand = (itemId: string) => {
    expandedItemId.value = expandedItemId.value === itemId ? null : itemId;
};

// ====== Right-click / Long-press → open full detail modal ======
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

const openDetails = (productId?: number | null) => {
    if (!productId) return;
    emit('view-details', productId);
};

const onContextMenu = (e: MouseEvent, item: any) => {
    e.preventDefault();
    if (item.is_custom_line) return;
    openDetails(item.product_id);
};

const startLongPress = (item: any, e: TouchEvent) => {
    if (item.is_custom_line) return;
    longPressTimer = setTimeout(() => {
        openDetails(item.product_id);
    }, 500);
};

const cancelLongPress = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
};

const displaySku = (item: any) => {
    if (item.is_custom_line) return item.product_sku || 'MISC';
    if (props.clientMode) return `#${item.product_id}`;
    return (
        item.variant_sku || item.product_sku || item.variant_name || 'General'
    );
};

const getStockLimit = (item: any): number | null => {
    if (props.returnMode || item.is_custom_line) return null;
    const parsed = Number(item.available_stock);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.floor(parsed));
};

const isOutOfStock = (item: any): boolean => {
    const stock = getStockLimit(item);
    return stock !== null && stock <= 0;
};

const isAtStockLimit = (item: any): boolean => {
    const stock = getStockLimit(item);
    if (stock === null) return false;
    return item.quantity >= stock;
};

const getQtyInputMax = (item: any): number | undefined => {
    const stock = getStockLimit(item);
    if (stock === null || stock <= 0) return undefined;
    return stock;
};

// Get cost for a cart item from the products catalog
const getItemCost = (item: any): number => {
    if (!props.products) return 0;
    const product = props.products.find((p: any) => p.id === item.product_id);
    if (!product) return 0;
    if (item.variant_id && product.variants) {
        const variant = product.variants.find(
            (v: any) => v.id === item.variant_id,
        );
        const activeInventory =
            variant?.inventory?.find(
                (inventory: any) =>
                    props.warehouseId &&
                    Number(
                        inventory.warehouse?.id ?? inventory.warehouse_id,
                    ) === Number(props.warehouseId),
            ) ??
            variant?.inventory?.find(
                (inventory: any) =>
                    Number(
                        inventory.current_cost ??
                            inventory.fifo_cost_current ??
                            0,
                    ) > 0,
            );
        if (
            activeInventory?.current_cost ||
            activeInventory?.fifo_cost_current
        ) {
            return Number(
                activeInventory.current_cost ??
                    activeInventory.fifo_cost_current,
            );
        }
        if (variant?.pricing?.cost) return Number(variant.pricing.cost);
    }
    return Number(product.pricing?.cost ?? 0);
};

// ── Role-based access control ──────────────────────────────────────────────────
const page = usePage();
const canEditPrice = computed(() => {
    const role = (page.props.auth?.user as any)?.role;
    return (
        props.canEditCommercial !== false &&
        (role === 'admin' || role === 'manager')
    );
});

// ── Quick Purchase Modal state ─────────────────────────────────────────────────
const showQuickPurchase = ref(false);
const productForPurchase = ref<any>(null);
const variantIdForPurchase = ref<number | null>(null);

const openQuickPurchase = (item: any) => {
    if (!props.canManagePurchases) return;
    if (!item.product_id) return;
    const fullProduct = props.products?.find(
        (p: any) => p.id === item.product_id,
    );
    if (!fullProduct) return;
    productForPurchase.value = fullProduct;
    variantIdForPurchase.value = item.variant_id ?? null;
    showQuickPurchase.value = true;
};

const handlePurchaseSuccess = (result: {
    productId: number;
    variantId: number | null;
    quantityAdded: number;
}) => {
    emit('reorder-success', result);
    showQuickPurchase.value = false;
    productForPurchase.value = null;
    variantIdForPurchase.value = null;
};
</script>

<template>
    <div
        class="flex h-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-border dark:bg-card"
    >
        <div class="relative flex-1 overflow-auto">
            <draggable
                v-model="localItems"
                tag="table"
                item-key="id"
                handle=".drag-handle"
                :disabled="props.canEditCommercial === false"
                class="w-full min-w-[500px] border-collapse text-left"
            >
                <template #header>
                    <thead
                        class="sticky top-0 z-10 bg-gray-50 shadow-sm dark:bg-muted"
                    >
                        <tr
                            class="border-b border-gray-100 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:border-border dark:text-gray-400"
                        >
                            <th
                                class="w-10 bg-gray-50 px-2 py-3 text-center dark:bg-muted"
                            >
                                #
                            </th>
                            <th class="bg-gray-50 px-3 py-3 dark:bg-muted">
                                SKU
                            </th>
                            <th class="bg-gray-50 px-4 py-3 dark:bg-muted">
                                Producto
                            </th>
                            <th
                                class="bg-gray-50 px-4 py-3 text-right dark:bg-muted"
                            >
                                Precio
                            </th>
                            <th
                                class="w-32 bg-gray-50 px-4 py-3 text-center dark:bg-muted"
                            >
                                Cant.
                            </th>
                            <th
                                class="bg-gray-50 px-4 py-3 text-right dark:bg-muted"
                            >
                                Total
                            </th>
                            <th
                                class="w-12 bg-gray-50 px-2 py-3 text-center dark:bg-muted"
                            ></th>
                        </tr>
                    </thead>
                </template>

                <template #item="{ element: item, index }">
                    <tbody class="group divide-y divide-gray-50">
                        <!-- Main row -->
                        <tr
                            class="group cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50/50 dark:border-border/40 dark:hover:bg-muted/30"
                            :class="{
                                'bg-indigo-50/40 dark:bg-indigo-900/20':
                                    expandedItemId === item.id,
                            }"
                            @click="toggleExpand(item.id)"
                            @contextmenu="onContextMenu($event, item)"
                            @touchstart="startLongPress(item, $event)"
                            @touchend="cancelLongPress"
                            @touchmove="cancelLongPress"
                        >
                            <td
                                class="px-2 py-3 text-center font-mono text-xs text-gray-400"
                            >
                                <div
                                    class="flex items-center justify-center gap-1"
                                >
                                    <GripVertical
                                        v-if="props.canEditCommercial !== false"
                                        class="drag-handle h-4 w-4 cursor-grab transition-colors hover:text-gray-600"
                                        title="Arrastrar para reordenar"
                                    />
                                    <span>{{ index + 1 }}</span>
                                </div>
                            </td>
                            <td class="px-3 py-3">
                                <span
                                    class="font-mono text-xs text-gray-500 dark:text-gray-400"
                                >
                                    {{ displaySku(item) }}
                                </span>
                            </td>
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-2">
                                    <component
                                        :is="
                                            expandedItemId === item.id
                                                ? ChevronUp
                                                : ChevronDown
                                        "
                                        class="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform"
                                    />
                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="text-sm font-medium text-gray-900 dark:text-white"
                                                >{{ item.product_name }}</span
                                            >
                                            <span
                                                v-if="item.is_custom_line"
                                                class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                            >
                                                Miscelaneo
                                            </span>
                                        </div>
                                        <div
                                            class="mt-0.5 flex flex-wrap gap-1"
                                        >
                                            <span
                                                v-if="item.seller_id"
                                                class="inline-block w-max rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-600 dark:text-primary"
                                            >
                                                {{
                                                    users.find(
                                                        (u) =>
                                                            u.id ===
                                                            item.seller_id,
                                                    )?.name || 'Vendedor'
                                                }}
                                            </span>
                                            <span
                                                v-if="item.notes"
                                                class="inline-block w-max rounded bg-purple-100 px-1 py-0.5 text-xs text-purple-600"
                                                title="Tiene nota interna"
                                            >
                                                📋 Nota
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td
                                class="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300"
                                @click.stop
                            >
                                {{ formatCurrency(item.product_price) }}
                            </td>

                            <td class="px-4 py-3" @click.stop>
                                <div class="flex flex-col items-center gap-1">
                                    <div
                                        class="flex items-center justify-center gap-2"
                                    >
                                        <button
                                            v-if="
                                                props.canEditCommercial !==
                                                false
                                            "
                                            @click="
                                                emit(
                                                    'update-quantity',
                                                    index,
                                                    item.quantity - 1,
                                                )
                                            "
                                            class="rounded-md p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-muted/50 dark:hover:text-gray-300"
                                        >
                                            <Minus class="h-3.5 w-3.5" />
                                        </button>
                                        <input
                                            v-if="
                                                props.canEditCommercial !==
                                                false
                                            "
                                            type="number"
                                            min="1"
                                            :value="item.quantity"
                                            @change="
                                                emit(
                                                    'update-quantity',
                                                    index,
                                                    parseInt(
                                                        (
                                                            $event.target as HTMLInputElement
                                                        ).value,
                                                    ) || item.quantity,
                                                )
                                            "
                                            class="w-12 border-0 bg-transparent p-0 text-center text-sm font-semibold text-gray-900 focus:ring-0 dark:text-white"
                                        />
                                        <button
                                            v-if="
                                                props.canEditCommercial !==
                                                false
                                            "
                                            @click="
                                                emit(
                                                    'update-quantity',
                                                    index,
                                                    item.quantity + 1,
                                                )
                                            "
                                            class="rounded-md p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-muted/50 dark:hover:text-gray-300"
                                        >
                                            <Plus class="h-3.5 w-3.5" />
                                        </button>
                                        <span
                                            v-if="
                                                props.canEditCommercial ===
                                                false
                                            "
                                            class="w-12 text-center text-sm font-semibold text-gray-900 dark:text-white"
                                        >
                                            {{ item.quantity }}
                                        </span>
                                    </div>
                                    <span
                                        v-if="getStockLimit(item) !== null"
                                        class="text-[10px] font-medium"
                                        :class="
                                            isOutOfStock(item)
                                                ? 'text-red-500'
                                                : isAtStockLimit(item)
                                                  ? 'text-amber-500'
                                                  : 'text-gray-400 dark:text-gray-500'
                                        "
                                    >
                                        {{
                                            isOutOfStock(item)
                                                ? 'Sin stock'
                                                : `Stock: ${getStockLimit(item)}`
                                        }}
                                    </span>
                                    <span
                                        v-if="isOutOfStock(item)"
                                        class="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 dark:bg-red-900/20"
                                    >
                                        Se venderá sin descontar
                                    </span>
                                </div>
                            </td>

                            <td
                                class="bg-blue-50/30 px-4 py-3 text-right text-sm font-bold text-gray-900 dark:bg-blue-900/10 dark:text-white"
                            >
                                {{ formatCurrency(item.total) }}
                            </td>

                            <td class="px-2 py-3 text-center" @click.stop>
                                <button
                                    v-if="props.canEditCommercial !== false"
                                    @click="emit('remove', index)"
                                    class="rounded-lg p-1.5 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </button>
                            </td>
                        </tr>

                        <!-- Expandable options row -->
                        <tr v-if="expandedItemId === item.id">
                            <td colspan="6" class="px-0 py-0">
                                <div
                                    class="animate-slide-down border-t border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white px-6 py-4 dark:border-indigo-900/50 dark:from-indigo-900/20 dark:to-card"
                                >
                                    <div
                                        class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
                                    >
                                        <!-- Price Override con Fórmula — solo Admin/Manager -->
                                        <div class="space-y-2 lg:col-span-1">
                                            <label
                                                class="block flex items-center gap-1 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                            >
                                                <DollarSign class="h-3 w-3" />
                                                Precio Unitario
                                            </label>

                                            <!-- Editable: admin / manager -->
                                            <template v-if="canEditPrice">
                                                <PricingFormula
                                                    :cost="getItemCost(item)"
                                                    :tax-rate="0"
                                                    :model-value="''"
                                                    :price="item.product_price"
                                                    @update:price="
                                                        (p) =>
                                                            emit(
                                                                'update-item-price',
                                                                item.id,
                                                                p,
                                                            )
                                                    "
                                                    @update:model-value="
                                                        () => {}
                                                    "
                                                />
                                                <p
                                                    class="text-xs text-gray-400"
                                                >
                                                    Override de precio para esta
                                                    línea
                                                </p>
                                            </template>

                                            <!-- Read-only: otros roles -->
                                            <template v-else>
                                                <div
                                                    class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-border dark:bg-muted"
                                                >
                                                    <Lock
                                                        class="h-3.5 w-3.5 shrink-0 text-gray-400"
                                                    />
                                                    <span
                                                        class="text-sm font-semibold text-gray-700 dark:text-gray-300"
                                                    >
                                                        {{
                                                            formatCurrency(
                                                                item.product_price,
                                                            )
                                                        }}
                                                    </span>
                                                </div>
                                                <p
                                                    class="flex items-center gap-1 text-xs text-gray-400"
                                                >
                                                    <Lock class="h-3 w-3" />
                                                    Solo administradores pueden
                                                    modificar el precio
                                                </p>
                                            </template>
                                        </div>

                                        <!-- Tax exempt toggle -->
                                        <div class="space-y-2">
                                            <label
                                                class="block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                                >Impuesto</label
                                            >
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <button
                                                    @click.stop="
                                                        emit(
                                                            'toggle-item-tax-exempt',
                                                            item.id,
                                                        )
                                                    "
                                                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:outline-none"
                                                    :class="
                                                        item.tax_percent > 0
                                                            ? 'bg-indigo-500'
                                                            : 'bg-gray-300'
                                                    "
                                                >
                                                    <span
                                                        class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                                                        :class="
                                                            item.tax_percent > 0
                                                                ? 'translate-x-6'
                                                                : 'translate-x-1'
                                                        "
                                                    />
                                                </button>
                                                <span
                                                    class="text-sm text-gray-700"
                                                >
                                                    {{
                                                        item.tax_percent > 0
                                                            ? 'Con impuesto'
                                                            : 'Exento'
                                                    }}
                                                </span>
                                            </div>
                                            <!-- Editable tax percent -->
                                            <div
                                                v-if="item.tax_percent > 0"
                                                class="mt-1 flex items-center gap-2"
                                            >
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    max="100"
                                                    :value="item.tax_percent"
                                                    @change.stop="
                                                        emit(
                                                            'update-item-tax',
                                                            item.id,
                                                            parseFloat(
                                                                (
                                                                    $event.target as HTMLInputElement
                                                                ).value,
                                                            ),
                                                        )
                                                    "
                                                    class="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-card dark:text-white"
                                                />
                                                <span
                                                    class="text-xs text-gray-500"
                                                    >%</span
                                                >
                                            </div>
                                            <div
                                                class="mt-1 text-xs text-gray-400"
                                            >
                                                Monto:
                                                <span
                                                    class="font-medium text-gray-600 dark:text-gray-300"
                                                    >{{
                                                        formatCurrency(
                                                            item.tax_amount,
                                                        )
                                                    }}</span
                                                >
                                            </div>
                                        </div>

                                        <!-- Discount percent -->
                                        <div
                                            v-if="
                                                props.canEditCommercial !==
                                                false
                                            "
                                            class="space-y-2"
                                        >
                                            <label
                                                class="block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                                >Descuento (%)</label
                                            >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    max="100"
                                                    :value="
                                                        item.discount_percent
                                                    "
                                                    @change.stop="
                                                        emit(
                                                            'update-item-discount',
                                                            item.id,
                                                            parseFloat(
                                                                (
                                                                    $event.target as HTMLInputElement
                                                                ).value,
                                                            ),
                                                        )
                                                    "
                                                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:ring-2 focus:ring-green-500 dark:border-border dark:bg-card dark:text-white"
                                                />
                                            </div>
                                            <p class="text-xs text-gray-400">
                                                Porcentaje de descuento para
                                                esta fila
                                            </p>
                                        </div>

                                        <!-- Seller selector -->
                                        <div
                                            v-if="
                                                props.canEditCommercial !==
                                                false
                                            "
                                            class="space-y-2"
                                        >
                                            <label
                                                class="block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                                >Vendedor</label
                                            >
                                            <select
                                                :value="item.seller_id ?? ''"
                                                :disabled="
                                                    props.canEditSeller ===
                                                    false
                                                "
                                                @change.stop="
                                                    emit(
                                                        'update-item-seller',
                                                        item.id,
                                                        (
                                                            $event.target as HTMLSelectElement
                                                        ).value
                                                            ? Number(
                                                                  (
                                                                      $event.target as HTMLSelectElement
                                                                  ).value,
                                                              )
                                                            : undefined,
                                                    )
                                                "
                                                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-card dark:text-white"
                                            >
                                                <option value="">
                                                    Sin vendedor asignado
                                                </option>
                                                <option
                                                    v-for="user in users"
                                                    :key="user.id"
                                                    :value="user.id"
                                                >
                                                    {{ user.name }}
                                                </option>
                                            </select>
                                            <p class="text-xs text-gray-400">
                                                Asigna quién vendió este
                                                producto
                                            </p>
                                        </div>

                                        <!-- Internal Notes -->
                                        <div
                                            v-if="
                                                props.canEditCommercial !==
                                                false
                                            "
                                            class="space-y-2"
                                        >
                                            <label
                                                class="block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                                >Nota Interna</label
                                            >
                                            <textarea
                                                :value="item.notes || ''"
                                                @change.stop="
                                                    emit(
                                                        'update-item-notes',
                                                        item.id,
                                                        (
                                                            $event.target as HTMLTextAreaElement
                                                        ).value,
                                                    )
                                                "
                                                placeholder="Nota interna (no se imprime en ticket)…"
                                                rows="2"
                                                class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 dark:border-border dark:bg-card dark:text-white"
                                            />
                                            <p class="text-xs text-gray-400">
                                                Solo visible internamente
                                            </p>
                                        </div>

                                        <!-- Quick Reorder — only when stock = 0 -->
                                        <div
                                            v-if="
                                                props.canManagePurchases &&
                                                props.canEditCommercial !==
                                                    false &&
                                                !item.is_custom_line &&
                                                item.available_stock !==
                                                    undefined &&
                                                item.available_stock <= 0
                                            "
                                            class="space-y-2"
                                        >
                                            <label
                                                class="block flex items-center gap-1 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                            >
                                                <Truck class="h-3 w-3" />
                                                Reabasto rápido
                                            </label>
                                            <button
                                                @click.stop="
                                                    openQuickPurchase(item)
                                                "
                                                class="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                                            >
                                                <Truck class="h-4 w-4" />
                                                Abastecer desde aquí
                                            </button>
                                            <p class="text-xs text-gray-400">
                                                Stock actual:
                                                <span
                                                    class="font-medium text-red-500"
                                                    >0</span
                                                >
                                            </p>
                                        </div>

                                        <!-- Summary mini-card -->
                                        <div class="space-y-2">
                                            <label
                                                class="block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                                >Resumen</label
                                            >
                                            <div
                                                class="space-y-1.5 rounded-lg border border-gray-200 bg-white p-3 dark:border-border dark:bg-card"
                                            >
                                                <div
                                                    class="flex justify-between text-xs"
                                                >
                                                    <span class="text-gray-500"
                                                        >Subtotal</span
                                                    >
                                                    <span
                                                        class="font-medium text-gray-700 dark:text-gray-300"
                                                        >{{
                                                            formatCurrency(
                                                                item.subtotal,
                                                            )
                                                        }}</span
                                                    >
                                                </div>
                                                <div
                                                    class="flex justify-between text-xs"
                                                >
                                                    <span class="text-gray-500"
                                                        >Impuesto ({{
                                                            item.tax_percent
                                                        }}%)</span
                                                    >
                                                    <span
                                                        class="font-medium text-gray-700 dark:text-gray-300"
                                                        >{{
                                                            formatCurrency(
                                                                item.tax_amount,
                                                            )
                                                        }}</span
                                                    >
                                                </div>
                                                <div
                                                    class="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-bold dark:border-border"
                                                >
                                                    <span
                                                        class="text-gray-900 dark:text-white"
                                                        >Total</span
                                                    >
                                                    <span
                                                        class="text-indigo-600 dark:text-indigo-400 dark:text-primary"
                                                        >{{
                                                            formatCurrency(
                                                                item.total,
                                                            )
                                                        }}</span
                                                    >
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </template>
                <template #footer>
                    <tbody v-if="items.length === 0">
                        <tr>
                            <td
                                colspan="7"
                                class="px-4 py-12 text-center text-gray-400"
                            >
                                El carrito está vacío
                            </td>
                        </tr>
                    </tbody>
                </template>
            </draggable>
        </div>

        <div
            class="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-2 text-center text-xs tracking-widest text-gray-400 uppercase dark:border-border dark:bg-muted"
        >
            {{ items.length }}
            {{ items.length === 1 ? 'producto' : 'productos' }} en lista
        </div>

        <!-- Quick Purchase Modal -->
        <QuickPurchaseModal
            v-if="canManagePurchases && productForPurchase"
            :is-open="showQuickPurchase"
            :product="productForPurchase"
            :initial-variant-id="variantIdForPurchase"
            @close="
                showQuickPurchase = false;
                productForPurchase = null;
                variantIdForPurchase = null;
            "
            @success="handlePurchaseSuccess"
        />
    </div>
</template>

<style scoped>
.animate-slide-down {
    animation: slideDown 0.15s ease-out;
}
@keyframes slideDown {
    from {
        opacity: 0;
        max-height: 0;
    }
    to {
        opacity: 1;
        max-height: 300px;
    }
}
</style>
