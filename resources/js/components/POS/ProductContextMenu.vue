<script setup lang="ts">
import { Info, X, ExternalLink } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
    show: boolean;
    x: number;
    y: number;
    item: any; // CartItem
    productDetails: any | null; // Full Product object with inventory, batches, vehicles
    warehouseId: number | null;
}>();

const emit = defineEmits<{
    close: [];
    'view-details': [];
}>();

const menuRef = ref<HTMLElement | null>(null);

// Computed data from product details
const cost = computed(() => {
    if (!props.productDetails) return null;
    // Try variant pricing first, then product pricing
    if (props.item?.variant_id && props.productDetails.variants) {
        const variant = props.productDetails.variants.find(
            (v: any) => v.id === props.item.variant_id,
        );
        const activeInventory = variant?.inventory?.find(
            (inventory: any) =>
                props.warehouseId &&
                Number(inventory.warehouse?.id ?? inventory.warehouse_id) ===
                    Number(props.warehouseId),
        );
        if (
            activeInventory?.current_cost ||
            activeInventory?.fifo_cost_current
        ) {
            return (
                activeInventory.current_cost ??
                activeInventory.fifo_cost_current
            );
        }
        if (variant?.pricing?.cost) return variant.pricing.cost;
    }
    return props.productDetails.pricing?.cost ?? null;
});

const stock = computed(() => {
    if (!props.productDetails?.inventory || !props.warehouseId) return null;
    const inv = props.productDetails.inventory.find(
        (i: any) =>
            i.warehouse_id === props.warehouseId &&
            i.variant_id === (props.item?.variant_id ?? null),
    );
    return inv?.quantity_available ?? 0;
});

const batches = computed(() => {
    if (!props.productDetails?.batches) return [];
    return props.productDetails.batches.slice(0, 5);
});

const vehicles = computed(() => {
    if (!props.productDetails?.vehicles) return [];
    return props.productDetails.vehicles.slice(0, 3);
});

const notes = computed(() => {
    return props.productDetails?.description || null;
});

// Specs: get attributes for the active variant, fallback to product attributes
const variantSpecs = computed(() => {
    if (!props.productDetails) return [];
    if (props.item?.variant_id && props.productDetails.variants) {
        const v = props.productDetails.variants.find(
            (v: any) => v.id === props.item.variant_id,
        );
        if (v?.attributes?.length) return v.attributes.slice(0, 4);
    }
    if (props.productDetails.attributes?.length)
        return props.productDetails.attributes.slice(0, 4);
    return [];
});

// Position adjustment to keep menu in viewport
const adjustedPosition = computed(() => {
    const menuWidth = 280;
    const menuHeight = 320;
    let x = props.x;
    let y = props.y;
    if (typeof window !== 'undefined') {
        if (x + menuWidth > window.innerWidth)
            x = window.innerWidth - menuWidth - 12;
        if (y + menuHeight > window.innerHeight)
            y = window.innerHeight - menuHeight - 12;
        if (x < 8) x = 8;
        if (y < 8) y = 8;
    }
    return { x, y };
});

// Close on outside click
const handleClickOutside = (e: MouseEvent) => {
    if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
        emit('close');
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside, true);
});
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside, true);
});
</script>

<template>
    <Teleport to="body">
        <transition name="ctx-fade">
            <div
                v-if="show"
                ref="menuRef"
                class="fixed z-[100] w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card"
                :style="{
                    left: adjustedPosition.x + 'px',
                    top: adjustedPosition.y + 'px',
                }"
            >
                <!-- Header -->
                <div
                    class="flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3 text-white"
                >
                    <div class="flex min-w-0 items-center gap-2">
                        <Info class="h-4 w-4 shrink-0" />
                        <span class="truncate text-sm font-semibold">{{
                            item?.product_name
                        }}</span>
                    </div>
                    <button
                        @click="emit('close')"
                        class="rounded p-0.5 transition-colors hover:bg-white/20"
                    >
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>

                <!-- Content -->
                <div class="max-h-64 space-y-3 overflow-y-auto p-3 text-sm">
                    <!-- Cost -->
                    <div class="flex items-center justify-between">
                        <span
                            class="text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >Costo Compra</span
                        >
                        <span class="font-bold text-gray-900 dark:text-white">
                            {{
                                cost !== null
                                    ? `$${Number(cost).toFixed(2)}`
                                    : '—'
                            }}
                        </span>
                    </div>

                    <!-- Stock -->
                    <div class="flex items-center justify-between">
                        <span
                            class="text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >Stock Actual</span
                        >
                        <span
                            class="rounded-full px-2 py-0.5 text-xs font-bold"
                            :class="
                                stock !== null && stock > 5
                                    ? 'bg-green-100 text-green-700'
                                    : stock !== null && stock > 0
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                            "
                        >
                            {{ stock ?? '—' }}
                        </span>
                    </div>

                    <!-- Batches -->
                    <div v-if="batches.length > 0">
                        <span
                            class="mb-1 block text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >Lotes</span
                        >
                        <div class="space-y-1">
                            <div
                                v-for="b in batches"
                                :key="b.id"
                                class="flex justify-between rounded bg-gray-50 px-2 py-1 text-xs dark:bg-muted"
                            >
                                <span
                                    class="text-gray-600 dark:text-gray-300"
                                    >{{ b.batch_number }}</span
                                >
                                <span
                                    class="font-medium text-gray-800 dark:text-gray-200"
                                    >{{ b.quantity }} uds</span
                                >
                            </div>
                        </div>
                    </div>

                    <!-- VINs -->
                    <div v-if="vehicles.length > 0">
                        <span
                            class="mb-1 block text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >VINs Compatibles</span
                        >
                        <div class="space-y-1">
                            <div
                                v-for="v in vehicles"
                                :key="v.id"
                                class="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 dark:bg-muted dark:text-gray-300"
                            >
                                {{ v.vin || v.vehicle?.vin || '—' }}
                            </div>
                        </div>
                        <p
                            v-if="productDetails?.vehicles?.length > 3"
                            class="mt-1 text-[10px] text-gray-400"
                        >
                            +{{ productDetails.vehicles.length - 3 }} más...
                        </p>
                    </div>

                    <!-- Notes -->
                    <div v-if="notes">
                        <span
                            class="mb-1 block text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >Notas</span
                        >
                        <p
                            class="line-clamp-3 rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-600 dark:bg-muted dark:text-gray-300"
                        >
                            {{ notes }}
                        </p>
                    </div>

                    <!-- Specs -->
                    <div v-if="variantSpecs.length > 0">
                        <span
                            class="mb-1 block text-xs font-medium tracking-wider text-gray-500 uppercase"
                            >Especificaciones</span
                        >
                        <div class="grid grid-cols-2 gap-1">
                            <div
                                v-for="spec in variantSpecs"
                                :key="spec.name"
                                class="rounded bg-gray-50 px-2 py-1 text-xs dark:bg-muted"
                            >
                                <span class="text-gray-400"
                                    >{{ spec.name }}:</span
                                >
                                <span
                                    class="ml-1 font-medium text-gray-800 dark:text-gray-200"
                                    >{{ spec.value
                                    }}{{
                                        spec.unit ? ' ' + spec.unit : ''
                                    }}</span
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Empty state -->
                    <div
                        v-if="!productDetails"
                        class="py-4 text-center text-xs text-gray-400"
                    >
                        Cargando información...
                    </div>
                </div>

                <!-- Footer action button -->
                <div class="border-t border-gray-100 p-2 dark:border-border">
                    <button
                        @click="
                            emit('view-details');
                            emit('close');
                        "
                        class="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-primary dark:hover:bg-muted"
                    >
                        <ExternalLink class="h-3.5 w-3.5" />
                        Ver Detalles Completos
                    </button>
                </div>
            </div>
        </transition>
    </Teleport>
</template>

<style scoped>
.ctx-fade-enter-active {
    animation: ctxIn 0.12s ease-out;
}
.ctx-fade-leave-active {
    animation: ctxIn 0.08s ease-in reverse;
}
@keyframes ctxIn {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
