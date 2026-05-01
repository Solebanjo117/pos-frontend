<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
    X,
    PackageCheck,
    Building2,
    DollarSign,
    ShoppingCart,
    List,
} from 'lucide-vue-next';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { useSuppliers } from '@/composables/useSuppliers';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { supplyListService } from '@/services/supply-list';
import { useToast } from '@/composables/useToast';
import type { Supplier } from '@/types/supplier';

// Reusing global store settings if needed, or simply pass props.
import { usePosSettings } from '@/composables/usePosSettings';

const props = withDefaults(
    defineProps<{
        isOpen: boolean;
        product: any; // We pass the selected product from the modal/table
        initialVariantId?: number | null; // Pre-select variant from cart item
        // Whether to show the quick purchase (direct PO) action
        showQuickPurchaseAction?: boolean;
    }>(),
    {
        showQuickPurchaseAction: true,
    },
);

const emit = defineEmits(['close', 'success']);

const { fetchActiveSuppliers } = useSuppliers();
const { quickReceivePurchaseOrder, loading: isSubmitting } =
    usePurchaseOrders();
const toast = useToast();
const { currentWarehouseId } = usePosSettings();

const suppliers = ref<Supplier[]>([]);
const loadingSuppliers = ref(false);

// Form state
const selectedSupplierId = ref<number | ''>('');
const selectedVariantId = ref<number | ''>('');
const quantity = ref(1);
const unitCost = ref(0);

// Computed options for SearchableSelect
const supplierOptions = computed(() => {
    const opts = [
        { value: '' as number | '', label: 'Sin proveedor asignado' },
    ];
    if (suppliers.value) {
        opts.push(
            ...suppliers.value.map((s) => ({ value: s.id, label: s.name })),
        );
    }
    return opts;
});

// Load suppliers
const loadSuppliers = async () => {
    loadingSuppliers.value = true;
    suppliers.value = await fetchActiveSuppliers();
    loadingSuppliers.value = false;

    // Don't auto-select supplier - let user choose or leave empty for Supply List
    // Only pre-select if product has a single main supplier
    if (props.product?.suppliers?.length === 1) {
        selectedSupplierId.value = props.product.suppliers[0].id;
    } else {
        selectedSupplierId.value = ''; // Default: no supplier
    }
};

// Reset form
const resetForm = () => {
    quantity.value = 1;

    // Pre-select variant: from prop > single variant > default variant
    if (props.initialVariantId) {
        selectedVariantId.value = props.initialVariantId;
        // Get cost from the specific variant
        const variant = props.product?.variants?.find(
            (v: any) => v.id === props.initialVariantId,
        );
        unitCost.value =
            variant?.pricing?.cost ||
            props.product?.pricing?.cost ||
            props.product?.cost ||
            0;
    } else if (props.product?.variants?.length === 1) {
        selectedVariantId.value = props.product.variants[0].id;
        unitCost.value =
            props.product.variants[0]?.pricing?.cost ||
            props.product?.pricing?.cost ||
            props.product?.cost ||
            0;
    } else if (props.product?.default_variant_id) {
        selectedVariantId.value = props.product.default_variant_id;
        const variant = props.product?.variants?.find(
            (v: any) => v.id === props.product.default_variant_id,
        );
        unitCost.value =
            variant?.pricing?.cost ||
            props.product?.pricing?.cost ||
            props.product?.cost ||
            0;
    } else {
        selectedVariantId.value = '';
        unitCost.value =
            props.product?.pricing?.cost ||
            props.product?.cost ||
            props.product?.variants?.[0]?.pricing?.cost ||
            0;
    }
};

watch(
    () => props.isOpen,
    async (newVal) => {
        if (newVal) {
            resetForm();
            // Always reload suppliers when modal opens to ensure fresh data
            await loadSuppliers();
        }
    },
    { immediate: true },
);

// Also watch for initialVariantId changes (for when modal is already mounted)
watch(
    () => props.initialVariantId,
    (newVal) => {
        if (props.isOpen && newVal) {
            selectedVariantId.value = newVal;
            const variant = props.product?.variants?.find(
                (v: any) => v.id === newVal,
            );
            if (variant?.pricing?.cost) {
                unitCost.value = variant.pricing.cost;
            }
        }
    },
);

const handleClose = () => {
    if (isSubmitting.value) return;
    emit('close');
};

// Add to Supply List (recommended flow)
const handleAddToSupplyList = async () => {
    if (quantity.value < 1) {
        return toast.error('La cantidad debe ser mayor a 0');
    }

    if (!currentWarehouseId.value) {
        return toast.error(
            'No hay sucursal seleccionada. Verifica tu configuracion.',
        );
    }

    try {
        isSubmitting.value = true;

        const result = await supplyListService.addItem({
            product_id: props.product.id,
            variant_id: selectedVariantId.value || null,
            supplier_id: selectedSupplierId.value || null,
            warehouse_id: currentWarehouseId.value,
            quantity_needed: quantity.value,
            notes: 'Agregado desde POS',
        });

        toast.success('Producto agregado a la OC diaria y stock preaplicado');
        emit('success', {
            productId: props.product.id,
            variantId: selectedVariantId.value,
            quantityAdded: result.stock_added,
            addedToSupplyList: true,
        });
    } catch (err: any) {
        toast.error(
            err.response?.data?.message || 'Error al agregar a la OC diaria',
        );
    } finally {
        isSubmitting.value = false;
    }
};

// Quick Purchase (direct PO - advanced flow)
const handleQuickPurchase = async () => {
    if (!selectedSupplierId.value || quantity.value < 1 || unitCost.value < 0) {
        return toast.error(
            'Por favor verifica los datos ingresados (proveedor y costo requeridos)',
        );
    }

    try {
        if (!currentWarehouseId.value) {
            return toast.error(
                'No hay sucursal seleccionada. Verifica tu configuración.',
            );
        }

        await quickReceivePurchaseOrder({
            supplier_id: selectedSupplierId.value,
            warehouse_id: currentWarehouseId.value,
            items: [
                {
                    product_id: props.product.id,
                    variant_id: selectedVariantId.value || null,
                    quantity_ordered: quantity.value,
                    unit_cost: unitCost.value,
                    notes: 'Generado desde POS',
                },
            ],
        });

        toast.success('Stock abastecido exitosamente mediante compra rápida');
        emit('success', {
            productId: props.product.id,
            variantId: selectedVariantId.value,
            quantityAdded: quantity.value,
        });
    } catch (err: any) {
        toast.error(
            err.response?.data?.message ||
                'Error al procesar abastecimiento rápido',
        );
    }
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

const totalCost = computed(() => quantity.value * unitCost.value);
</script>

<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[70] overflow-y-auto">
            <!-- Backdrop -->
            <div
                class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                @click="handleClose"
            ></div>

            <div class="flex min-h-screen items-center justify-center p-4">
                <!-- Modal Content -->
                <div
                    class="z-10 w-full max-w-md animate-in overflow-hidden rounded-2xl bg-white shadow-xl duration-200 zoom-in-95 fade-in dark:bg-card"
                >
                    <!-- Header -->
                    <div
                        class="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-border dark:bg-muted/20"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
                            >
                                <PackageCheck class="h-5 w-5" />
                            </div>
                            <div>
                                <h2
                                    class="text-xl font-bold text-gray-900 dark:text-white"
                                >
                                    Abastecimiento
                                </h2>
                                <p
                                    class="text-xs text-gray-500 dark:text-gray-400"
                                >
                                    Agregar a OC diaria o compra rapida
                                </p>
                            </div>
                        </div>
                        <button
                            @click="handleClose"
                            class="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted dark:hover:text-gray-300"
                        >
                            <X class="h-5 w-5" />
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="px-6 py-5">
                        <!-- Product Info -->
                        <div
                            class="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-500/20 dark:bg-blue-500/10"
                        >
                            <ShoppingCart
                                class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
                            />
                            <div>
                                <h3
                                    class="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white"
                                >
                                    {{
                                        product?.name || 'Producto Desconocido'
                                    }}
                                </h3>
                                <p
                                    class="text-xs text-gray-500 dark:text-gray-400"
                                >
                                    SKU:
                                    {{
                                        product?.sku_base ||
                                        product?.sku ||
                                        'N/A'
                                    }}
                                    | Costo actual:
                                    {{
                                        formatCurrency(
                                            product?.pricing?.cost ||
                                                product?.cost ||
                                                0,
                                        )
                                    }}
                                </p>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <!-- Supplier (optional for supply list) -->
                            <div>
                                <label
                                    class="mb-1 block flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    <Building2 class="h-4 w-4 text-gray-400" />
                                    Proveedor
                                    <span class="text-xs text-gray-400"
                                        >(opcional)</span
                                    >
                                </label>
                                <SearchableSelect
                                    v-model="selectedSupplierId"
                                    :options="supplierOptions"
                                    :disabled="loadingSuppliers"
                                    :loading="loadingSuppliers"
                                    placeholder="Sin proveedor asignado"
                                />
                                <p class="mt-1 text-xs text-gray-400">
                                    Si no asignas proveedor, se creara una OC
                                    pendiente de clasificar al convertir el dia
                                </p>
                            </div>

                            <!-- Variant (Only show if multiple variants exist) -->
                            <div
                                v-if="
                                    product?.variants &&
                                    product.variants.length > 0
                                "
                            >
                                <label
                                    class="mb-1 block flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    <PackageCheck
                                        class="h-4 w-4 text-gray-400"
                                    />
                                    Variante a abastecer
                                </label>
                                <select
                                    v-model="selectedVariantId"
                                    class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm transition-shadow focus:ring-2 focus:ring-orange-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                                >
                                    <option value="" disabled>
                                        Seleccione una variante...
                                    </option>
                                    <option
                                        v-for="variant in product.variants"
                                        :key="variant.id"
                                        :value="variant.id"
                                    >
                                        {{ variant.sku || variant.sku_base }} -
                                        {{ variant.name || 'Variante' }}
                                    </option>
                                </select>
                            </div>

                            <!-- Quantity (Cost optional for supply list) -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label
                                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                        Cantidad
                                    </label>
                                    <input
                                        v-model.number="quantity"
                                        type="number"
                                        min="1"
                                        class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm transition-shadow focus:ring-2 focus:ring-orange-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                                        placeholder="Ej. 10"
                                    />
                                </div>
                                <div>
                                    <label
                                        class="mb-1 block flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                        Costo
                                        <span class="text-xs text-gray-400"
                                            >(opcional)</span
                                        >
                                    </label>
                                    <div class="relative">
                                        <DollarSign
                                            class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                                        />
                                        <input
                                            v-model.number="unitCost"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-3 pl-9 text-sm transition-shadow focus:ring-2 focus:ring-orange-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Total Reference (only if cost is provided) -->
                            <div
                                v-if="unitCost > 0"
                                class="mt-4 flex items-center justify-between px-1 text-sm"
                            >
                                <span class="text-gray-500 dark:text-gray-400"
                                    >Total O.C. estimado:</span
                                >
                                <span
                                    class="text-lg font-bold text-gray-900 dark:text-white"
                                    >{{ formatCurrency(totalCost) }}</span
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div
                        class="border-t border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-border dark:bg-muted/20"
                    >
                        <!-- Info text -->
                        <p
                            class="mb-3 text-center text-xs text-gray-500 dark:text-gray-400"
                        >
                            <strong>Recomendado:</strong> Agregar a OC diaria y
                            consolidar compras al final del dia
                        </p>

                        <div
                            class="flex flex-col justify-end gap-2 sm:flex-row"
                        >
                            <button
                                @click="handleClose"
                                :disabled="isSubmitting"
                                class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-muted"
                            >
                                Cancelar
                            </button>

                            <!-- Primary action: Add to Supply List -->
                            <button
                                @click="handleAddToSupplyList"
                                :disabled="
                                    isSubmitting ||
                                    quantity < 1 ||
                                    (product?.variants?.length > 0 &&
                                        !selectedVariantId)
                                "
                                class="flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:hover:bg-primary/90"
                            >
                                <svg
                                    v-if="isSubmitting"
                                    class="-ml-1 h-4 w-4 animate-spin text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        class="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        stroke-width="4"
                                    ></circle>
                                    <path
                                        class="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                <List v-else class="h-4 w-4" />
                                Agregar a OC diaria
                            </button>

                            <!-- Secondary action: Quick Purchase (requires supplier and cost) - hidden when showQuickPurchaseAction is false -->
                            <button
                                v-if="showQuickPurchaseAction"
                                @click="handleQuickPurchase"
                                :disabled="
                                    isSubmitting ||
                                    !selectedSupplierId ||
                                    quantity < 1 ||
                                    unitCost <= 0 ||
                                    (product?.variants?.length > 0 &&
                                        !selectedVariantId)
                                "
                                class="flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Requiere proveedor y costo"
                            >
                                <svg
                                    v-if="isSubmitting"
                                    class="-ml-1 h-4 w-4 animate-spin text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        class="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        stroke-width="4"
                                    ></circle>
                                    <path
                                        class="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                <PackageCheck v-else class="h-4 w-4" />
                                Compra Rápida
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
