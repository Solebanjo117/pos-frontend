<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import {
    X,
    RotateCcw,
    AlertCircle,
    Package,
    Search,
    Banknote,
    CreditCard,
    Landmark,
    User,
    ChevronDown,
} from 'lucide-vue-next';
import type { User as UserType } from '@/types';
import { usePaymentMethods } from '@/composables/usePaymentMethods';

const { methods, fetchMethods } = usePaymentMethods();

interface OrderItem {
    id: number;
    product_id: number;
    variant_id?: number;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    tax_percent?: number;
    total: number;
    seller_name?: string;
}

const props = defineProps<{
    show: boolean;
    orderId: number;
    orderNumber: string;
    items: OrderItem[];
    users: UserType[];
    currentUserId?: number;
    hasCustomer?: boolean;
    loading?: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    (
        e: 'submit',
        payload: {
            reason: string;
            refund_method: string;
            refund_notes: string;
            items: {
                sales_order_item_id: number;
                quantity: number;
                user_id: number | null;
            }[];
        },
    ): void;
    (e: 'close'): void;
}>();

const reason = ref('');
const refundMethod = ref<string>('cash');
const refundNotes = ref('');
const quantities = ref<Record<number, number>>({});
const returnUsers = ref<Record<number, number | null>>({});
const returnSearchQuery = ref('');
const showReturnSearchModal = ref(false);
const returnSearchInput = ref<HTMLInputElement | null>(null);

// Reset state when modal opens
watch(
    () => props.show,
    (val) => {
        if (val) {
            fetchMethods(); // Fetch fresh methods
            reason.value = '';
            refundMethod.value = 'cash';
            refundNotes.value = '';
            returnSearchQuery.value = '';
            showReturnSearchModal.value = false;
            quantities.value = {};
            returnUsers.value = {};
            props.items.forEach((item) => {
                quantities.value[item.id] = 0;
                returnUsers.value[item.id] = props.currentUserId ?? null;
            });
        }
    },
);

// Escape key
const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) {
        if (showReturnSearchModal.value) {
            showReturnSearchModal.value = false;
            return;
        }

        emit('close');
    }
};
onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

const hasSelectedItems = computed(() =>
    Object.values(quantities.value).some((q) => q > 0),
);

const selectedCount = computed(
    () => Object.values(quantities.value).filter((q) => q > 0).length,
);

const normalizedReturnSearch = computed(() =>
    returnSearchQuery.value.trim().toLowerCase(),
);

const filteredReturnItems = computed(() => {
    const query = normalizedReturnSearch.value;

    if (!query) {
        return props.items;
    }

    return props.items.filter((item) =>
        [
            item.product_name,
            item.product_sku,
            item.seller_name,
            String(item.id),
            String(item.product_id),
        ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query)),
    );
});

const openReturnSearchModal = () => {
    showReturnSearchModal.value = true;
    nextTick(() => returnSearchInput.value?.focus());
};

const handleReturnSearchKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    openReturnSearchModal();
};

const addReturnItemFromSearch = (item: OrderItem) => {
    const currentQuantity = quantities.value[item.id] ?? 0;
    const maxQuantity = Number(item.quantity || 0);

    quantities.value[item.id] = Math.min(maxQuantity, currentQuantity + 1);
    returnUsers.value[item.id] =
        returnUsers.value[item.id] ?? props.currentUserId ?? null;
};

const removeReturnItemFromSearch = (item: OrderItem) => {
    const currentQuantity = quantities.value[item.id] ?? 0;

    quantities.value[item.id] = Math.max(0, currentQuantity - 1);
};

const estimatedRefund = computed(() => {
    let total = 0;
    for (const item of props.items) {
        const qty = quantities.value[item.id] ?? 0;
        if (qty > 0) {
            const soldQty = Number(item.quantity || 0);
            const lineTotal = Number(item.total || 0);
            if (soldQty > 0 && lineTotal > 0) {
                // Refund exactly what was charged per unit (discount + tax included when applicable).
                const effectiveUnitTotal = lineTotal / soldQty;
                total += effectiveUnitTotal * qty;
            } else {
                // Fallback for old/partial payloads where total is missing.
                const unitAfterDiscount =
                    item.unit_price * (1 - item.discount_percent / 100);
                const taxPercent = Number(item.tax_percent || 0);
                total += unitAfterDiscount * qty * (1 + taxPercent / 100);
            }
        }
    }
    return total;
});

const handleSubmit = () => {
    const returnItems = props.items
        .filter((item) => (quantities.value[item.id] ?? 0) > 0)
        .map((item) => ({
            sales_order_item_id: item.id,
            quantity: quantities.value[item.id],
            user_id: returnUsers.value[item.id] ?? null,
        }));

    emit('submit', {
        reason: reason.value,
        refund_method: refundMethod.value,
        refund_notes: refundNotes.value,
        items: returnItems,
    });
};

const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// Icon mapping for refund methods
const methodIcons: Record<string, any> = {
    cash: Banknote,
    card: CreditCard,
    transfer: Landmark,
    balance: User,
    store_credit: User,
};

// Color mapping for refund methods
const methodColors: Record<string, string> = {
    cash: 'green',
    card: 'blue',
    transfer: 'purple',
    balance: 'amber',
    store_credit: 'amber',
};

// Refund methods: cash, card, transfer + balance (if customer)
const refundMethods = computed(() => {
    const standardCodes = ['cash', 'card', 'transfer'];
    const result = methods.value
        .filter((m) => standardCodes.includes(m.code))
        .map((m) => ({
            value: m.code,
            label: m.name,
            icon: methodIcons[m.code] || Banknote,
            color: methodColors[m.code] || 'gray',
        }));

    // Add balance option if customer exists
    if (props.hasCustomer) {
        result.push({
            value: 'balance',
            label: 'Saldo a Favor',
            icon: User,
            color: 'amber',
        });
    }
    return result;
});

const refundMethodColor = (method: string, color: string) => {
    if (refundMethod.value === method) {
        return `border-${color}-400 bg-${color}-50 dark:bg-${color}-900/20 dark:border-${color}-600`;
    }
    return 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50/50';
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
                v-if="show"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
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
                        class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-card dark:ring-gray-700"
                    >
                        <!-- ═══════════ HEADER ═══════════ -->
                        <div
                            class="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="rounded-xl bg-red-100 p-2 dark:bg-red-900/30"
                                >
                                    <RotateCcw
                                        class="h-5 w-5 text-red-600 dark:text-red-400"
                                    />
                                </div>
                                <div>
                                    <h2
                                        class="text-lg font-bold text-gray-900 dark:text-white"
                                    >
                                        Devolución de Artículos
                                    </h2>
                                    <p
                                        class="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Orden
                                        <span
                                            class="font-medium text-gray-700 dark:text-gray-300"
                                            >{{ orderNumber }}</span
                                        >
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

                        <!-- ═══════════ BODY ═══════════ -->
                        <div class="flex-1 space-y-5 overflow-y-auto p-6">
                            <!-- Error -->
                            <div
                                v-if="error"
                                class="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20"
                            >
                                <AlertCircle class="h-4 w-4 flex-shrink-0" />
                                {{ error }}
                            </div>

                            <!-- ── Items Table ── -->
                            <div>
                                <div class="mb-5">
                                    <label
                                        class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                    >
                                        Buscar artículos de la factura
                                    </label>
                                    <div class="flex gap-2">
                                        <div class="relative flex-1">
                                            <Search
                                                class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                                            />
                                            <input
                                                v-model="returnSearchQuery"
                                                type="text"
                                                placeholder="SKU, nombre o línea vendida... (Enter para buscar)"
                                                class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-border dark:bg-muted dark:text-white"
                                                @keydown="
                                                    handleReturnSearchKeydown
                                                "
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                                            @click="openReturnSearchModal"
                                        >
                                            <Search class="h-4 w-4" />
                                            Buscar
                                        </button>
                                    </div>
                                    <p
                                        class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        Enter abre el selector con los artículos
                                        de esta factura.
                                    </p>
                                </div>

                                <label
                                    class="mb-3 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                >
                                    Seleccione las cantidades a devolver
                                </label>
                                <div
                                    class="overflow-hidden rounded-xl border border-gray-200 dark:border-border"
                                >
                                    <table class="w-full text-left">
                                        <thead
                                            class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-background/50"
                                        >
                                            <tr>
                                                <th
                                                    class="px-4 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                                >
                                                    Producto
                                                </th>
                                                <th
                                                    class="px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                                >
                                                    SKU
                                                </th>
                                                <th
                                                    class="px-3 py-3 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                                >
                                                    Precio
                                                </th>
                                                <th
                                                    class="px-3 py-3 text-center text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                                >
                                                    Devolver
                                                </th>
                                                <th
                                                    class="px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                                >
                                                    Devuelve
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-gray-100 dark:divide-border/50"
                                        >
                                            <tr
                                                v-for="item in items"
                                                :key="item.id"
                                                class="transition-colors"
                                                :class="
                                                    (quantities[item.id] ?? 0) >
                                                    0
                                                        ? 'bg-red-50/50 dark:bg-red-900/10'
                                                        : 'bg-white dark:bg-card'
                                                "
                                            >
                                                <!-- Product name -->
                                                <td class="px-4 py-3">
                                                    <div
                                                        class="flex items-center gap-3"
                                                    >
                                                        <Package
                                                            class="h-7 w-7 shrink-0 text-gray-300 dark:text-gray-600"
                                                        />
                                                        <div class="min-w-0">
                                                            <p
                                                                class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                                                            >
                                                                {{
                                                                    item.product_name
                                                                }}
                                                            </p>
                                                            <p
                                                                class="text-xs text-gray-400"
                                                            >
                                                                Vendido:
                                                                {{
                                                                    item.quantity
                                                                }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <!-- SKU -->
                                                <td class="px-3 py-3">
                                                    <span
                                                        class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-muted dark:text-gray-400"
                                                    >
                                                        {{
                                                            item.product_sku ||
                                                            '—'
                                                        }}
                                                    </span>
                                                </td>

                                                <!-- Price -->
                                                <td
                                                    class="px-3 py-3 text-right"
                                                >
                                                    <span
                                                        class="text-sm font-medium text-gray-900 dark:text-white"
                                                        >{{
                                                            formatCurrency(
                                                                item.unit_price,
                                                            )
                                                        }}</span
                                                    >
                                                    <span
                                                        v-if="
                                                            item.discount_percent >
                                                            0
                                                        "
                                                        class="block text-xs text-red-500"
                                                        >-{{
                                                            item.discount_percent
                                                        }}%</span
                                                    >
                                                    <span
                                                        class="block text-xs"
                                                        :class="
                                                            (item.tax_percent ??
                                                                0) > 0
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-gray-400'
                                                        "
                                                    >
                                                        {{
                                                            (item.tax_percent ??
                                                                0) > 0
                                                                ? `ITBM ${item.tax_percent ?? 0}%`
                                                                : 'Sin ITBM'
                                                        }}
                                                    </span>
                                                </td>

                                                <!-- Quantity to return -->
                                                <td class="px-3 py-3">
                                                    <div
                                                        class="flex items-center justify-center gap-1.5"
                                                    >
                                                        <input
                                                            v-model.number="
                                                                quantities[
                                                                    item.id
                                                                ]
                                                            "
                                                            type="number"
                                                            min="0"
                                                            :max="item.quantity"
                                                            class="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm font-bold text-gray-900 focus:border-transparent focus:ring-2 focus:ring-red-500 dark:border-border dark:bg-muted dark:text-white"
                                                        />
                                                        <span
                                                            class="text-xs text-gray-400"
                                                            >/
                                                            {{
                                                                item.quantity
                                                            }}</span
                                                        >
                                                    </div>
                                                </td>

                                                <!-- Who is returning (per-row seller) -->
                                                <td class="px-3 py-3">
                                                    <div class="relative">
                                                        <select
                                                            v-model="
                                                                returnUsers[
                                                                    item.id
                                                                ]
                                                            "
                                                            class="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-1.5 pr-8 pl-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-red-500 dark:border-border dark:bg-muted dark:text-white"
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
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- ── Reason ── -->
                            <div>
                                <label
                                    class="mb-1 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                    >Motivo de devolución</label
                                >
                                <input
                                    v-model="reason"
                                    type="text"
                                    placeholder="Ej: Producto defectuoso, error de envío, etc."
                                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>

                            <!-- ── Refund Method ── -->
                            <div>
                                <label
                                    class="mb-2 block text-xs font-semibold tracking-wider text-gray-500 uppercase"
                                    >Método de reembolso</label
                                >
                                <div class="grid grid-cols-2 gap-2">
                                    <label
                                        v-for="m in refundMethods"
                                        :key="m.value"
                                        class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors"
                                        :class="
                                            refundMethod === m.value
                                                ? `border-${m.color}-400 bg-${m.color}-50 dark:bg-${m.color}-900/20 dark:border-${m.color}-600`
                                                : 'dark:hover:bg-muted/50/50 border-gray-200 hover:bg-gray-50 dark:border-border'
                                        "
                                    >
                                        <input
                                            type="radio"
                                            v-model="refundMethod"
                                            :value="m.value"
                                            class="sr-only"
                                        />
                                        <component
                                            :is="m.icon"
                                            class="h-5 w-5"
                                            :class="`text-${m.color}-600 dark:text-${m.color}-400`"
                                        />
                                        <span
                                            class="text-sm font-medium text-gray-700 dark:text-gray-300"
                                            >{{ m.label }}</span
                                        >
                                    </label>
                                </div>
                            </div>

                            <!-- ── Estimated Refund ── -->
                            <div
                                v-if="hasSelectedItems"
                                class="rounded-xl bg-red-50 p-4 dark:bg-red-900/20"
                            >
                                <div class="flex items-center justify-between">
                                    <div>
                                        <span
                                            class="text-sm font-semibold text-red-700 dark:text-red-300"
                                            >Monto estimado a devolver:</span
                                        >
                                        <span
                                            class="mt-0.5 block text-xs text-red-500/70"
                                        >
                                            {{ selectedCount }} artículo{{
                                                selectedCount !== 1 ? 's' : ''
                                            }}
                                            seleccionado{{
                                                selectedCount !== 1 ? 's' : ''
                                            }}
                                        </span>
                                    </div>
                                    <span
                                        class="text-xl font-bold text-red-600 dark:text-red-400"
                                        >{{
                                            formatCurrency(estimatedRefund)
                                        }}</span
                                    >
                                </div>
                            </div>
                        </div>

                        <!-- ═══════════ FOOTER ═══════════ -->
                        <div
                            v-if="showReturnSearchModal"
                            class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                            @click.self="showReturnSearchModal = false"
                        >
                            <div
                                class="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-card dark:ring-gray-700"
                            >
                                <div
                                    class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-border"
                                >
                                    <div>
                                        <h3
                                            class="text-base font-bold text-gray-900 dark:text-white"
                                        >
                                            Seleccionar artículos de la factura
                                        </h3>
                                        <p
                                            class="text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            Orden {{ orderNumber }} · solo
                                            líneas vendidas
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted/50"
                                        @click="showReturnSearchModal = false"
                                    >
                                        <X class="h-5 w-5" />
                                    </button>
                                </div>

                                <div
                                    class="border-b border-gray-200 p-4 dark:border-border"
                                >
                                    <div class="relative">
                                        <Search
                                            class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                                        />
                                        <input
                                            ref="returnSearchInput"
                                            v-model="returnSearchQuery"
                                            type="text"
                                            placeholder="Filtrar por SKU, nombre o vendedor"
                                            class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-border dark:bg-muted dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div class="min-h-0 flex-1 overflow-y-auto">
                                    <table class="w-full text-left text-sm">
                                        <thead
                                            class="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:border-border dark:bg-background dark:text-gray-400"
                                        >
                                            <tr>
                                                <th class="px-4 py-3">
                                                    Producto
                                                </th>
                                                <th class="px-3 py-3">SKU</th>
                                                <th
                                                    class="px-3 py-3 text-right"
                                                >
                                                    Precio
                                                </th>
                                                <th
                                                    class="px-3 py-3 text-center"
                                                >
                                                    Seleccionado
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-right"
                                                >
                                                    Acción
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-gray-100 dark:divide-border/50"
                                        >
                                            <tr
                                                v-for="item in filteredReturnItems"
                                                :key="`return-search-${item.id}`"
                                                class="bg-white transition hover:bg-red-50/60 dark:bg-card dark:hover:bg-red-900/10"
                                            >
                                                <td class="px-4 py-3">
                                                    <p
                                                        class="font-semibold text-gray-900 dark:text-white"
                                                    >
                                                        {{ item.product_name }}
                                                    </p>
                                                    <p
                                                        class="text-xs text-gray-500 dark:text-gray-400"
                                                    >
                                                        Vendido:
                                                        {{ item.quantity }}
                                                        <span
                                                            v-if="
                                                                item.seller_name
                                                            "
                                                        >
                                                            ·
                                                            {{
                                                                item.seller_name
                                                            }}
                                                        </span>
                                                    </p>
                                                </td>
                                                <td class="px-3 py-3">
                                                    <span
                                                        class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-muted dark:text-gray-400"
                                                    >
                                                        {{
                                                            item.product_sku ||
                                                            '—'
                                                        }}
                                                    </span>
                                                </td>
                                                <td
                                                    class="px-3 py-3 text-right font-medium text-gray-900 dark:text-white"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            item.unit_price,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-3 py-3 text-center"
                                                >
                                                    <span
                                                        class="font-mono text-sm font-bold text-red-600 dark:text-red-400"
                                                    >
                                                        {{
                                                            quantities[
                                                                item.id
                                                            ] ?? 0
                                                        }}
                                                    </span>
                                                    <span
                                                        class="text-xs text-gray-400"
                                                    >
                                                        / {{ item.quantity }}
                                                    </span>
                                                </td>
                                                <td class="px-4 py-3">
                                                    <div
                                                        class="flex justify-end gap-1.5"
                                                    >
                                                        <button
                                                            type="button"
                                                            class="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                                                            :disabled="
                                                                (quantities[
                                                                    item.id
                                                                ] ?? 0) <= 0
                                                            "
                                                            @click="
                                                                removeReturnItemFromSearch(
                                                                    item,
                                                                )
                                                            "
                                                        >
                                                            -
                                                        </button>
                                                        <button
                                                            type="button"
                                                            class="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                                                            :disabled="
                                                                (quantities[
                                                                    item.id
                                                                ] ?? 0) >=
                                                                item.quantity
                                                            "
                                                            @click="
                                                                addReturnItemFromSearch(
                                                                    item,
                                                                )
                                                            "
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr
                                                v-if="
                                                    filteredReturnItems.length ===
                                                    0
                                                "
                                            >
                                                <td
                                                    colspan="5"
                                                    class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                                                >
                                                    No hay artículos de esta
                                                    factura que coincidan.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div
                                    class="flex shrink-0 items-center justify-between border-t border-gray-200 px-5 py-4 dark:border-border"
                                >
                                    <span
                                        class="text-sm font-semibold text-gray-700 dark:text-gray-300"
                                    >
                                        {{ selectedCount }} seleccionado{{
                                            selectedCount === 1 ? '' : 's'
                                        }}
                                    </span>
                                    <button
                                        type="button"
                                        class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                                        @click="showReturnSearchModal = false"
                                    >
                                        Listo
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div
                            class="shrink-0 border-t border-gray-200 px-6 py-4 dark:border-border"
                        >
                            <button
                                @click="handleSubmit"
                                :disabled="!hasSelectedItems || loading"
                                class="w-full rounded-xl bg-red-600 py-3 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
                            >
                                {{
                                    loading
                                        ? 'Procesando...'
                                        : 'Procesar Devolución'
                                }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
