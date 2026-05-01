<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { Product } from '@/types/product';
import apiClient from '@/services/api/client';
import { usePOS } from '@/composables/usePOS';
import { usePosSettings } from '@/composables/usePosSettings';

interface Props {
    product: Product;
}
const props = defineProps<Props>();
const emit = defineEmits<{
    close: [];
    'view-alternative': [product: Product];
}>();

// ── Blind Mode (for customer screenshots) ─────────────────────────────────────
const blindMode = ref(localStorage.getItem('product_blind_mode') === 'true');
const toggleBlindMode = () => {
    blindMode.value = !blindMode.value;
    localStorage.setItem('product_blind_mode', String(blindMode.value));
};
// Whether to apply ITBM on top of the active view amount
const includeITBM = ref(
    localStorage.getItem('product_include_itbm') !== 'false',
); // default true
const toggleIncludeITBM = () => {
    includeITBM.value = !includeITBM.value;
    localStorage.setItem('product_include_itbm', String(includeITBM.value));
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProductImage {
    id: number | null;
    url: string;
    original_filename: string;
    display_order: number;
    source?: 'product' | 'media' | 'category';
    category_name?: string | null;
}
interface ProductAttribute {
    id: number;
    name: string;
    value: string;
    unit?: string | null;
}
interface OemReference {
    id?: number;
    oem_code: string;
    manufacturer: string;
}
interface AlternativeRecord {
    id: number;
    sku: string;
    name: string;
    relationship_type: string;
    pivot?: {
        relationship_type?: string;
        source?: string;
        shared_codes?: string;
    };
}
interface VehicleRow {
    id: number;
    make: string;
    model: string;
    year_from?: number;
    year_to?: number;
    engine: string;
    displacement?: string;
    chassis?: {
        id: number;
        code: string;
        name: string;
        full_description: string;
    } | null;
    all_engines?: boolean;
    all_chassis?: boolean;
    notes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const deepLink = (param: string, value: string | number) =>
    `/products?${param}=${encodeURIComponent(String(value))}`;

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);

const priceWithTax = (basePrice: number, taxRate?: number) => {
    const rate = taxRate != null && !isNaN(taxRate) ? taxRate : 7;
    const safeBase = isNaN(basePrice) ? 0 : basePrice;
    return safeBase * (1 + rate / 100);
};

const resolveSaleTaxRate = (pricing: any): number => {
    const raw = pricing?.sale_tax_rate ?? pricing?.tax_rate;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const resolveCostTaxRate = (pricing: any): number => {
    const raw = pricing?.cost_tax_rate;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 7;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

// Returns the best pricing object for a variant (variant-level first, then product-level fallback)
const getVariantPricing = (variant: any) => {
    const vp = variant?.pricing;
    if (vp && (Number(vp.base_price) > 0 || Number(vp.cost) > 0)) return vp;
    return props.product.pricing ?? null;
};

const getQuantity = (variant: any): number => quantities[variant.id] ?? 1;

const saleBasePrice = (pricing: any): number =>
    Number(pricing?.calculated_price ?? pricing?.base_price) || 0;

const saleDisplayPrice = (variant: any): number => {
    const p = getVariantPricing(variant);
    if (!p) return 0;
    const base = saleBasePrice(p);
    return includeITBM.value ? priceWithTax(base, resolveSaleTaxRate(p)) : base;
};

const costBaseAmount = (pricing: any): number =>
    Number(pricing?.cost_base ?? pricing?.cost) || 0;

const costMiscAmount = (pricing: any): number =>
    Number(pricing?.cost_miscellaneous) || 0;

const costSubtotal = (pricing: any): number =>
    costBaseAmount(pricing) + costMiscAmount(pricing);

const costDisplayPrice = (variant: any): number => {
    const p = getVariantPricing(variant);
    if (!p) return 0;
    if (!includeITBM.value) return costSubtotal(p);

    const costTotal = Number(p.cost_total ?? p.cost);
    if (Number.isFinite(costTotal) && costTotal > 0) return costTotal;

    const costBase = Number(p.cost_base ?? p.cost) || 0;
    const costMisc = Number(p.cost_miscellaneous) || 0;
    return costBase * (1 + resolveCostTaxRate(p) / 100) + costMisc;
};

const variantDisplayPrice = (variant: any): number =>
    blindMode.value ? saleDisplayPrice(variant) : costDisplayPrice(variant);

const saleTaxAmount = (variant: any): number => {
    const p = getVariantPricing(variant);
    if (!p) return 0;
    return Math.max(0, saleDisplayPrice(variant) - saleBasePrice(p));
};

const costTaxAmount = (variant: any): number => {
    const p = getVariantPricing(variant);
    if (!p) return 0;
    return Math.max(0, costDisplayPrice(variant) - costSubtotal(p));
};

const relationshipLabel = (type: string): string =>
    ({
        compatible: 'Compatible',
        substitute: 'Sustituto',
        upgrade: 'Mejora',
    })[type] ?? type;

const relationshipClass = (type: string): string =>
    ({
        compatible:
            'bg-blue-100  text-blue-700  dark:bg-blue-900/40  dark:text-blue-300',
        substitute:
            'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        upgrade:
            'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    })[type] ?? 'bg-gray-100 text-gray-700';

// ── Variants ──────────────────────────────────────────────────────────────────
const variants = computed(() => {
    if (props.product.variants?.length) return props.product.variants;
    if (props.product.default_variant) return [props.product.default_variant];
    return [];
});

const activeVariantId = ref<number | null>(
    props.product.default_variant?.id ?? variants.value[0]?.id ?? null,
);

const minPrice = computed(() => {
    return props.product.pricing?.base_price ?? 0;
});
const totalStock = computed(() =>
    variants.value.reduce((s, v) => s + (v.total_stock ?? 0), 0),
);

const quantities = ref<Record<number, number>>(
    Object.fromEntries(variants.value.map((v) => [v.id, 1])),
);
const changeQty = (variantId: number, delta: number) => {
    quantities.value[variantId] = Math.max(
        1,
        (quantities.value[variantId] ?? 1) + delta,
    );
};

const { addToCart } = usePOS();
const { currentWarehouseId } = usePosSettings();
const handleAddToCart = (variant: any) => {
    const qty = quantities.value[variant.id] ?? 1;
    addToCart(
        props.product,
        variant,
        qty,
        currentWarehouseId.value || undefined,
    );
    quantities.value[variant.id] = 1;
    alert(
        `✅ ${qty} x ${props.product.name} (${variant.brand?.name ?? variant.sku}) agregado al carrito POS`,
    );
};

// ── Images ────────────────────────────────────────────────────────────────────
const productImages = ref<ProductImage[]>([]);
const currentImageIdx = ref(0);
const uploadingImage = ref(false);
const currentImage = computed(
    () => productImages.value[currentImageIdx.value] ?? null,
);
const hasMultImg = computed(() => productImages.value.length > 1);
const canDeleteCurrentImage = computed(() =>
    Boolean(
        currentImage.value?.id && currentImage.value?.source !== 'category',
    ),
);

const prevImage = () => {
    if (!hasMultImg.value) return;
    currentImageIdx.value =
        currentImageIdx.value === 0
            ? productImages.value.length - 1
            : currentImageIdx.value - 1;
};
const nextImage = () => {
    if (!hasMultImg.value) return;
    currentImageIdx.value =
        currentImageIdx.value === productImages.value.length - 1
            ? 0
            : currentImageIdx.value + 1;
};

const fetchImages = async (productId: number = props.product.id) => {
    try {
        const res = await apiClient.get(`/products/${productId}/images`);
        if (productId !== props.product.id) return;
        productImages.value = res.data.data ?? [];
        if (productImages.value.length === 0 && props.product.image_url) {
            productImages.value = [
                {
                    id: null,
                    url: props.product.image_url,
                    original_filename: '',
                    display_order: 0,
                    source: 'product',
                },
            ];
        }
        currentImageIdx.value = 0;
    } catch {
        if (productId !== props.product.id) return;
        productImages.value = [];
        if (props.product.image_url)
            productImages.value = [
                {
                    id: 0,
                    url: props.product.image_url,
                    original_filename: '',
                    display_order: 0,
                },
            ];
        currentImageIdx.value = 0;
    }
};

const handleImageUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    uploadingImage.value = true;
    const fd = new FormData();
    for (let i = 0; i < input.files.length; i++)
        fd.append('images[]', input.files[i]);
    try {
        const res = await apiClient.post(
            `/products/${props.product.id}/images`,
            fd,
            { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        const newImgs: ProductImage[] = res.data.data ?? [];
        const jumpTo = productImages.value.length;
        productImages.value.push(...newImgs);
        if (newImgs.length) currentImageIdx.value = jumpTo;
    } catch (e) {
        console.error(e);
    } finally {
        uploadingImage.value = false;
        if (input) input.value = '';
    }
};

const handleDeleteImage = async (imageId: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return;
    try {
        await apiClient.delete(
            `/products/${props.product.id}/images/${imageId}`,
        );
        const idx = productImages.value.findIndex((img) => img.id === imageId);
        if (idx !== -1) {
            productImages.value.splice(idx, 1);
            if (currentImageIdx.value >= productImages.value.length)
                currentImageIdx.value = Math.max(
                    0,
                    productImages.value.length - 1,
                );
        }
    } catch (e) {
        console.error(e);
    }
};

// ── Specs (product-level) ────────────────────────────────────────────────────
const attributesData = ref<ProductAttribute[]>([]);
const loadingAttrs = ref(false);

const mergedSpecs = computed(() => {
    return attributesData.value;
});

// ── Vehicle Compatibility (via VINs) ──────────────────────────────────────────
const vehicleRows = ref<VehicleRow[]>([]);
const loadingVehicle = ref(false);

const fetchVehicleCompatibility = async (
    productId: number = props.product.id,
) => {
    loadingVehicle.value = true;
    try {
        const res = await apiClient.get(`/products/${productId}/compatibility`);
        if (productId !== props.product.id) return;
        const compat = res.data.data ?? [];
        vehicleRows.value = compat.map((c: any) => {
            const modelData =
                c.model ?? c.engine?.model ?? c.chassis?.model ?? {};
            const makeData = modelData.make ?? {};
            const engineData = c.engine ?? {};
            const chassisData =
                c.chassis ??
                (modelData.generation
                    ? {
                          id: 0,
                          code: modelData.generation,
                          name: modelData.generation,
                          full_description: modelData.generation,
                      }
                    : null);
            return {
                id: c.id,
                make: makeData.name ?? '—',
                model: modelData.name ?? '—',
                year_from: modelData.year_from ?? undefined,
                year_to: modelData.year_to ?? undefined,
                engine:
                    engineData.engine_code ??
                    c.engine_code ??
                    (c.all_engines ? 'Todos' : '—'),
                displacement: engineData.displacement ?? c.displacement,
                chassis: chassisData,
                all_engines: c.all_engines ?? false,
                all_chassis: c.all_chassis ?? false,
                notes: c.notes,
            };
        });
    } catch (e) {
        console.error(e);
        vehicleRows.value = [];
    } finally {
        if (productId !== props.product.id) return;
        loadingVehicle.value = false;
    }
};

// Group vehicles by Make + Model + Year range for prominent display
const groupedVehicles = computed(() => {
    const groups = new Map<
        string,
        {
            make: string;
            model: string;
            year_from?: number;
            year_to?: number;
            engines: Array<{ code: string; displacement?: string }>;
            chassis: Array<{
                code: string;
                name: string;
                full_description: string;
            }>;
        }
    >();
    for (const row of vehicleRows.value) {
        const key = `${row.make}|${row.model}|${row.year_from ?? ''}-${row.year_to ?? ''}`;
        if (!groups.has(key)) {
            groups.set(key, {
                make: row.make,
                model: row.model,
                year_from: row.year_from,
                year_to: row.year_to,
                engines: [],
                chassis: [],
            });
        }
        const group = groups.get(key)!;
        if (row.engine && row.engine !== 'Todos' && row.engine !== '—') {
            group.engines.push({
                code: row.engine,
                displacement: row.displacement,
            });
        }
        if (row.chassis) {
            group.chassis.push({
                code: row.chassis.code,
                name: row.chassis.name,
                full_description: row.chassis.full_description,
            });
        }
    }
    return Array.from(groups.values());
});

// ── OEM + Alternatives ────────────────────────────────────────────────────────
const oemData = ref<OemReference[]>([]);
const alternativesData = ref<AlternativeRecord[]>([]);
const loadingRefs = ref(false);
const showAlternatives = ref(false);

const resetModalStateForProduct = () => {
    productImages.value = [];
    currentImageIdx.value = 0;
    attributesData.value = [];
    vehicleRows.value = [];
    oemData.value = [];
    alternativesData.value = [];
    showAlternatives.value = false;
    activeVariantId.value =
        props.product.default_variant?.id ?? variants.value[0]?.id ?? null;
    quantities.value = Object.fromEntries(variants.value.map((v) => [v.id, 1]));
};

const loadProductDetails = async () => {
    const productId = props.product.id;
    resetModalStateForProduct();
    loadingAttrs.value = true;
    loadingRefs.value = true;

    await Promise.all([
        fetchImages(productId),
        fetchVehicleCompatibility(productId),
        (async () => {
            try {
                const res = await apiClient.get(
                    `/products/${productId}/attributes`,
                );
                if (productId !== props.product.id) return;
                attributesData.value = res.data.data ?? [];
            } catch (e) {
                console.error(e);
            } finally {
                if (productId !== props.product.id) return;
                loadingAttrs.value = false;
            }
        })(),
        (async () => {
            try {
                const [oemRes, altRes] = await Promise.all([
                    apiClient.get(`/products/${productId}/oem-references`),
                    apiClient.get(`/products/${productId}/alternatives`),
                ]);
                if (productId !== props.product.id) return;
                oemData.value = oemRes.data.data ?? [];
                alternativesData.value = altRes.data.data ?? [];
            } catch (e) {
                console.error(e);
            } finally {
                if (productId !== props.product.id) return;
                loadingRefs.value = false;
            }
        })(),
    ]);
};

// Tabs removed from layout
// ── Mount ─────────────────────────────────────────────────────────────────────
onMounted(loadProductDetails);

watch(
    () => props.product.id,
    (newProductId, previousProductId) => {
        if (newProductId === previousProductId) return;
        loadProductDetails();
    },
);

// ── Navigate to alternative product ──────────────────────────────────────────
const loadingAltId = ref<number | null>(null);
const handleViewAlternative = async (altId: number) => {
    loadingAltId.value = altId;
    try {
        const res = await apiClient.get(`/products/${altId}`);
        const altProduct = res.data.data ?? res.data;
        emit('view-alternative', altProduct);
    } catch (e) {
        console.error('Error loading alternative product:', e);
    } finally {
        loadingAltId.value = null;
    }
};
</script>

<template>
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
    >
        <div
            class="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-card"
        >
            <!-- Header -->
            <div
                class="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-border dark:bg-card/95"
            >
                <div>
                    <div class="flex items-center gap-2">
                        <h2
                            class="text-xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ product.name }}
                        </h2>
                        <span
                            v-if="product.is_universal"
                            class="inline-flex flex-shrink-0 items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/20"
                            title="Universal"
                            >🌐 Universal</span
                        >
                    </div>
                    <p
                        v-if="product.sku_base && !blindMode"
                        class="mt-0.5 font-mono text-xs text-gray-400"
                    >
                        {{ product.sku_base }}
                    </p>
                    <p
                        v-else-if="blindMode"
                        class="mt-0.5 font-mono text-xs text-gray-400"
                    >
                        {{
                            (product as any).system_id ||
                            '#' + String(product.id).padStart(8, '0')
                        }}
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <!-- Blind Mode Toggle -->
                    <button
                        @click="toggleBlindMode"
                        :class="[
                            'relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none',
                            blindMode
                                ? 'bg-amber-500 focus:ring-amber-400'
                                : 'bg-gray-300 focus:ring-gray-400 dark:bg-gray-600',
                        ]"
                        :title="
                            blindMode
                                ? 'Modo Cliente activo — muestra precio de venta'
                                : 'Modo Normal — muestra toda la información'
                        "
                    >
                        <span
                            :class="[
                                'inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200',
                                blindMode ? 'translate-x-8' : 'translate-x-1',
                            ]"
                        >
                            <svg
                                v-if="blindMode"
                                class="h-3 w-3 text-amber-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18"
                                />
                            </svg>
                            <svg
                                v-else
                                class="h-3 w-3 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                            </svg>
                        </span>
                    </button>
                    <span
                        class="text-[10px] font-medium tracking-wider uppercase"
                        :class="blindMode ? 'text-amber-500' : 'text-gray-400'"
                        >{{ blindMode ? 'Cliente' : 'Normal' }}</span
                    >

                    <!-- ITBM toggle (available in both normal and client mode) -->
                    <div class="ml-1 flex items-center gap-1.5">
                        <button
                            @click="toggleIncludeITBM"
                            :class="[
                                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none',
                                includeITBM
                                    ? 'bg-green-500'
                                    : 'bg-gray-300 dark:bg-gray-600',
                            ]"
                            :title="
                                includeITBM
                                    ? 'ITBM incluido en precio — clic para excluirlo'
                                    : 'ITBM NO incluido — clic para incluirlo'
                            "
                        >
                            <span
                                :class="[
                                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
                                    includeITBM
                                        ? 'translate-x-4'
                                        : 'translate-x-0.5',
                                ]"
                            />
                        </button>
                        <span
                            class="text-[10px] font-medium"
                            :class="
                                includeITBM ? 'text-green-500' : 'text-gray-400'
                            "
                            >ITBM</span
                        >
                    </div>

                    <!-- Close -->
                    <button
                        @click="emit('close')"
                        class="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted/50 dark:hover:text-gray-300"
                    >
                        <svg
                            class="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="space-y-6 p-6">
                <!-- ══════════════════════════════════════════════════════ -->
                <!--  TOP PANEL: Photo (left) + Variants (right)          -->
                <!-- ══════════════════════════════════════════════════════ -->
                <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <!-- 🔹 IZQUIERDA: Info Producto + Specs (col-md-5) -->
                    <div class="flex flex-col gap-4 lg:col-span-5">
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
                        >
                            <!-- Image Carousel (Reuse existing) -->
                            <div
                                class="group/img relative mb-6 flex h-64 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-border dark:bg-background"
                            >
                                <img
                                    v-if="currentImage"
                                    :src="currentImage.url"
                                    :alt="product.name"
                                    :key="currentImage.id ?? currentImage.url"
                                    class="max-h-full max-w-full object-contain transition-opacity duration-300"
                                />
                                <div
                                    v-else
                                    class="flex h-full w-full flex-col items-center justify-center gap-2"
                                >
                                    <svg
                                        class="h-16 w-16 text-gray-300"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="1"
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        />
                                    </svg>
                                </div>
                                <!-- Nav Arrows -->
                                <button
                                    v-if="hasMultImg"
                                    @click.stop="prevImage"
                                    class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all group-hover/img:opacity-100 hover:bg-black/70"
                                >
                                    <svg
                                        class="h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2.5"
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                </button>
                                <button
                                    v-if="hasMultImg"
                                    @click.stop="nextImage"
                                    class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all group-hover/img:opacity-100 hover:bg-black/70"
                                >
                                    <svg
                                        class="h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2.5"
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </button>
                                <div
                                    v-if="productImages.length > 0"
                                    class="absolute top-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
                                >
                                    {{ currentImageIdx + 1 }} /
                                    {{ productImages.length }}
                                </div>
                                <button
                                    v-if="
                                        canDeleteCurrentImage &&
                                        currentImage?.id
                                    "
                                    @click.stop="
                                        handleDeleteImage(currentImage.id)
                                    "
                                    class="absolute top-2 right-2 rounded-lg bg-red-500/80 p-1 text-white opacity-0 backdrop-blur-sm transition-all group-hover/img:opacity-100 hover:bg-red-600"
                                >
                                    <svg
                                        class="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                </button>
                                <label
                                    class="absolute right-2 bottom-2 flex cursor-pointer items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-white opacity-0 backdrop-blur-sm transition-all group-hover/img:opacity-100 hover:bg-black/80"
                                    ><svg
                                        class="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M12 4v16m8-8H4"
                                        /></svg
                                    ><span class="text-xs font-medium">{{
                                        uploadingImage
                                            ? 'Subiendo...'
                                            : 'Agregar fotos'
                                    }}</span
                                    ><input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        class="hidden"
                                        multiple
                                        @change="handleImageUpload"
                                        :disabled="uploadingImage"
                                /></label>
                            </div>

                            <!-- Título y Código -->
                            <div class="mb-6 text-center">
                                <template v-if="!blindMode">
                                    <small
                                        class="text-xs tracking-wide text-gray-500 uppercase"
                                        >Código Base / SKU</small
                                    >
                                    <h1
                                        class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
                                    >
                                        {{
                                            product.sku_base ||
                                            product.default_variant?.sku ||
                                            'N/A'
                                        }}
                                    </h1>
                                </template>
                                <template v-else>
                                    <small
                                        class="text-xs tracking-wide text-gray-500 uppercase"
                                        >Código</small
                                    >
                                    <h1
                                        class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
                                    >
                                        {{
                                            (product as any).system_id ||
                                            '#' +
                                                String(product.id).padStart(
                                                    8,
                                                    '0',
                                                )
                                        }}
                                    </h1>
                                </template>
                                <p
                                    v-if="blindMode && product.category?.name"
                                    class="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    {{ product.category.name }}
                                </p>
                                <p
                                    v-if="product.description && !blindMode"
                                    class="mt-2 break-words whitespace-normal text-gray-600 dark:text-gray-400"
                                >
                                    {{ product.description }}
                                </p>
                            </div>

                            <!-- Especificaciones Técnicas -->
                            <div v-if="!blindMode">
                                <h6
                                    class="mb-3 border-b border-gray-200 pb-2 font-bold text-gray-800 dark:border-border dark:text-gray-100"
                                >
                                    Especificaciones Técnicas
                                </h6>
                                <div
                                    v-if="loadingAttrs"
                                    class="animate-pulse py-2 text-sm text-gray-400"
                                >
                                    Cargando especificaciones...
                                </div>
                                <div
                                    v-else-if="mergedSpecs.length === 0"
                                    class="py-2 text-sm text-gray-400 italic"
                                >
                                    Sin especificaciones registradas.
                                </div>
                                <div
                                    v-else
                                    class="grid grid-cols-2 gap-x-4 gap-y-2"
                                >
                                    <div
                                        v-for="spec in mergedSpecs"
                                        :key="spec.name"
                                        class="group relative flex items-center justify-between border-b border-gray-50 py-1 text-sm last:border-0 dark:border-border"
                                    >
                                        <span
                                            class="text-gray-500 capitalize"
                                            >{{ spec.name }}</span
                                        >
                                        <span
                                            class="text-right font-medium text-gray-900 dark:text-gray-200"
                                        >
                                            {{ spec.value
                                            }}<span
                                                v-if="spec.unit"
                                                class="ml-1 text-xs text-gray-500"
                                                >{{ spec.unit }}</span
                                            >
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 🔹 DERECHA: Marcas Disponibles -->
                    <div class="lg:col-span-7">
                        <div
                            class="flex h-full max-h-[600px] flex-col rounded-lg border border-gray-200 bg-white shadow-sm lg:max-h-[800px] dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex shrink-0 items-center justify-between rounded-t-lg border-b border-gray-100 bg-gray-50 p-4 dark:border-border dark:bg-background"
                            >
                                <h2
                                    class="text-lg font-bold text-gray-900 dark:text-white"
                                >
                                    Marcas Disponibles
                                </h2>
                                <span
                                    class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                >
                                    {{ variants.length }} opciones
                                </span>
                            </div>

                            <div
                                class="custom-scrollbar flex-1 overflow-y-auto p-4"
                            >
                                <div
                                    v-if="variants.length > 0"
                                    class="space-y-3"
                                >
                                    <div
                                        v-for="variant in variants"
                                        :key="variant.id"
                                        class="group flex cursor-pointer flex-col items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50 sm:flex-row sm:items-center dark:border-border dark:hover:bg-blue-900/20"
                                        :class="
                                            activeVariantId === variant.id
                                                ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20'
                                                : ''
                                        "
                                        @click="activeVariantId = variant.id"
                                    >
                                        <!-- Info Marca -->
                                        <div class="flex flex-1 flex-col">
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span
                                                    class="font-bold text-gray-900 dark:text-white"
                                                    >{{
                                                        variant.brand?.name ??
                                                        'Sin marca'
                                                    }}</span
                                                >
                                                <span
                                                    v-if="
                                                        blindMode &&
                                                        (variant as any)
                                                            .system_id
                                                    "
                                                    class="ml-1 font-mono text-xs text-gray-400"
                                                    >({{
                                                        (variant as any)
                                                            .system_id
                                                    }})</span
                                                >
                                            </div>
                                        </div>

                                        <!-- Precio y Action -->
                                        <div
                                            class="flex items-center gap-6 self-end sm:self-auto"
                                        >
                                            <!-- Quantities -->
                                            <div
                                                v-if="!blindMode"
                                                class="flex shrink-0 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-1 dark:border-border dark:bg-background"
                                            >
                                                <button
                                                    @click.stop="
                                                        changeQty(
                                                            variant.id,
                                                            -1,
                                                        )
                                                    "
                                                    :disabled="
                                                        (variant.total_stock ??
                                                            0) === 0
                                                    "
                                                    class="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-muted/50"
                                                >
                                                    -
                                                </button>
                                                <span
                                                    class="w-6 text-center text-sm font-medium text-gray-900 dark:text-white"
                                                    >{{
                                                        quantities[
                                                            variant.id
                                                        ] ?? 1
                                                    }}</span
                                                >
                                                <button
                                                    @click.stop="
                                                        changeQty(variant.id, 1)
                                                    "
                                                    :disabled="
                                                        (variant.total_stock ??
                                                            0) === 0 ||
                                                        (quantities[
                                                            variant.id
                                                        ] ?? 1) >=
                                                            (variant.total_stock ??
                                                                0)
                                                    "
                                                    class="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-muted/50"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <div
                                                class="min-w-[90px] shrink-0 text-right"
                                            >
                                                <div
                                                    class="text-lg font-bold text-green-600 dark:text-green-400"
                                                >
                                                    <template
                                                        v-if="
                                                            getVariantPricing(
                                                                variant,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            formatCurrency(
                                                                variantDisplayPrice(
                                                                    variant,
                                                                ) *
                                                                    getQuantity(
                                                                        variant,
                                                                    ),
                                                            )
                                                        }}
                                                    </template>
                                                    <template v-else
                                                        >N/A</template
                                                    >
                                                </div>
                                                <div
                                                    v-if="
                                                        includeITBM || blindMode
                                                    "
                                                    class="text-[10px] text-gray-400"
                                                >
                                                    <template
                                                        v-if="includeITBM"
                                                    >
                                                        <template
                                                            v-if="blindMode"
                                                        >
                                                            Venta
                                                            {{
                                                                formatCurrency(
                                                                    saleBasePrice(
                                                                        getVariantPricing(
                                                                            variant,
                                                                        ),
                                                                    ) *
                                                                        getQuantity(
                                                                            variant,
                                                                        ),
                                                                )
                                                            }}
                                                            + ITBM
                                                            {{
                                                                formatCurrency(
                                                                    saleTaxAmount(
                                                                        variant,
                                                                    ) *
                                                                        getQuantity(
                                                                            variant,
                                                                        ),
                                                                )
                                                            }}
                                                        </template>
                                                        <template v-else>
                                                            Costo Base
                                                            {{
                                                                formatCurrency(
                                                                    costBaseAmount(
                                                                        getVariantPricing(
                                                                            variant,
                                                                        ),
                                                                    ) *
                                                                        getQuantity(
                                                                            variant,
                                                                        ),
                                                                )
                                                            }}
                                                            + Misc
                                                            {{
                                                                formatCurrency(
                                                                    costMiscAmount(
                                                                        getVariantPricing(
                                                                            variant,
                                                                        ),
                                                                    ) *
                                                                        getQuantity(
                                                                            variant,
                                                                        ),
                                                                )
                                                            }}
                                                            + ITBM
                                                            {{
                                                                formatCurrency(
                                                                    costTaxAmount(
                                                                        variant,
                                                                    ) *
                                                                        getQuantity(
                                                                            variant,
                                                                        ),
                                                                )
                                                            }}
                                                        </template>
                                                    </template>
                                                    <template v-else>
                                                        Sin ITBM
                                                    </template>
                                                </div>
                                                <div
                                                    v-if="!blindMode"
                                                    :class="[
                                                        'text-xs font-medium',
                                                        (variant.total_stock ??
                                                            0) > 0
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-orange-500 dark:text-orange-400',
                                                    ]"
                                                >
                                                    {{
                                                        variant.total_stock ?? 0
                                                    }}
                                                    disponibles
                                                </div>
                                            </div>

                                            <button
                                                v-if="!blindMode"
                                                @click.stop="
                                                    handleAddToCart(variant)
                                                "
                                                :disabled="
                                                    (variant.total_stock ??
                                                        0) === 0
                                                "
                                                class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition-transform hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                                                title="Agregar al carrito"
                                            >
                                                <svg
                                                    class="h-6 w-6"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="py-12 text-center">
                                    <svg
                                        class="mx-auto mb-3 h-12 w-12 text-gray-300"
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
                                    <p class="text-gray-500">
                                        No hay marcas disponibles.
                                    </p>
                                </div>
                            </div>

                            <div
                                class="shrink-0 rounded-b-lg border-t border-gray-100 bg-gray-50 p-3 text-center text-xs text-gray-500 dark:border-border dark:bg-background"
                            >
                                Precios y stock sincronizados en tiempo real.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ══════════════════════════════════════════════════════ -->
                <!-- ══════════════════════════════════════════════════════ -->
                <!--  BOTTOM: Vehículos Compatibles & OEM                 -->
                <!-- ══════════════════════════════════════════════════════ -->
                <div v-if="!blindMode" class="mt-auto space-y-6">
                    <!-- Vehículos Compatibles (Full Width Table) -->
                    <div
                        class="flex max-h-[350px] flex-col rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex shrink-0 items-center gap-2 rounded-t-lg border-b border-gray-100 bg-gray-50 p-4 font-bold text-gray-900 dark:border-border dark:bg-background dark:text-white"
                        >
                            <svg
                                class="h-5 w-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                                />
                            </svg>
                            Vehículos Compatibles
                            <span
                                v-if="
                                    !loadingVehicle &&
                                    vehicleRows.length > 0 &&
                                    !product.is_universal
                                "
                                class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-normal text-gray-500 dark:bg-muted"
                            >
                                {{ vehicleRows.length }} modelos
                            </span>
                        </div>

                        <div class="custom-scrollbar flex-1 overflow-y-auto">
                            <div
                                v-if="loadingVehicle"
                                class="animate-pulse p-4 text-sm text-gray-400"
                            >
                                Cargando compatibilidad...
                            </div>
                            <div
                                v-else-if="product.is_universal"
                                class="bg-blue-50/50 p-6 text-center text-sm text-blue-600 italic dark:bg-blue-900/10 dark:text-blue-400"
                            >
                                <svg
                                    class="mx-auto mb-3 h-12 w-12 text-blue-300 dark:text-blue-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <p
                                    class="text-base font-medium text-blue-700 not-italic dark:text-blue-300"
                                >
                                    Este es un Producto Universal
                                </p>
                                <p class="mt-1">
                                    Es compatible con cualquier vehículo o su
                                    uso es general.
                                </p>
                            </div>
                            <div
                                v-else-if="vehicleRows.length === 0"
                                class="p-6 text-center text-sm text-gray-400 italic"
                            >
                                <svg
                                    class="mx-auto mb-3 h-12 w-12 text-gray-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                                    />
                                </svg>
                                Sin vehículos vinculados. Agrega compatibilidad
                                vehicular editando el producto.
                            </div>
                            <div v-else class="space-y-2 p-4">
                                <div
                                    v-for="(group, idx) in groupedVehicles"
                                    :key="idx"
                                    class="flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-blue-50/50 dark:border-border dark:hover:bg-blue-900/10"
                                >
                                    <div
                                        class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40"
                                    >
                                        <svg
                                            class="h-5 w-5 text-blue-600 dark:text-blue-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                                            />
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                                            />
                                        </svg>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div
                                            class="flex flex-wrap items-center gap-2"
                                        >
                                            <span
                                                class="text-base font-bold text-gray-900 dark:text-white"
                                                >{{ group.make }}
                                                {{ group.model }}</span
                                            >
                                            <span
                                                v-if="group.year_from"
                                                class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-muted dark:text-gray-400"
                                            >
                                                {{ group.year_from
                                                }}{{
                                                    group.year_to
                                                        ? '–' + group.year_to
                                                        : '+'
                                                }}
                                            </span>
                                        </div>
                                        <p
                                            class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            <span
                                                v-for="(
                                                    eng, eIdx
                                                ) in group.engines"
                                                :key="eIdx"
                                            >
                                                <span class="font-mono">{{
                                                    eng.code
                                                }}</span
                                                ><span
                                                    v-if="eng.displacement"
                                                    class="text-[10px] text-gray-400"
                                                >
                                                    ({{
                                                        eng.displacement
                                                    }}L)</span
                                                ><span
                                                    v-if="
                                                        eIdx <
                                                        group.engines.length - 1
                                                    "
                                                    >,
                                                </span>
                                            </span>
                                            <template
                                                v-if="group.chassis.length > 0"
                                            >
                                                <span
                                                    v-for="(
                                                        ch, cIdx
                                                    ) in group.chassis"
                                                    :key="cIdx"
                                                    class="ml-2 inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                                                >
                                                    Chasis:
                                                    {{ ch.name || ch.code }}
                                                </span>
                                            </template>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- OEM Referencias (Full Width) -->
                    <div
                        v-if="!loadingRefs && oemData.length > 0"
                        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex items-center gap-2 rounded-t-lg border-b border-gray-100 bg-gray-50 p-4 font-bold text-gray-900 dark:border-border dark:bg-background dark:text-white"
                        >
                            <svg
                                class="h-5 w-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z"
                                />
                            </svg>
                            Referencias OEM
                            <span
                                class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-normal text-gray-500 dark:bg-muted"
                            >
                                {{ oemData.length }}
                            </span>
                        </div>
                        <div class="overflow-x-auto rounded-b-lg">
                            <table
                                class="min-w-full divide-y divide-gray-200 text-sm dark:divide-border"
                            >
                                <tbody
                                    class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                                >
                                    <tr
                                        v-for="oem in oemData"
                                        :key="oem.oem_code"
                                        class="hover:bg-gray-50 dark:hover:bg-muted/50"
                                    >
                                        <td
                                            class="px-4 py-3 font-mono font-semibold text-amber-700 dark:text-amber-400"
                                        >
                                            <a
                                                :href="
                                                    deepLink(
                                                        'oem_code',
                                                        oem.oem_code,
                                                    )
                                                "
                                                target="_blank"
                                                class="hover:underline"
                                                >{{ oem.oem_code }}</a
                                            >
                                        </td>
                                        <td
                                            class="px-4 py-3 text-gray-600 dark:text-gray-400"
                                        >
                                            {{ oem.manufacturer || '—' }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Alternativas (Collapsible) -->
                    <div
                        v-if="!loadingRefs && alternativesData.length > 0"
                        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
                    >
                        <button
                            @click="showAlternatives = !showAlternatives"
                            class="flex w-full items-center justify-between rounded-t-lg border-b border-gray-100 bg-gray-50 p-4 font-bold text-gray-900 transition-colors hover:bg-gray-100 dark:border-border dark:bg-background dark:text-white dark:hover:bg-muted/50"
                        >
                            <div class="flex items-center gap-2">
                                <svg
                                    class="h-5 w-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01"
                                    />
                                </svg>
                                Upsales
                                <span
                                    class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-normal text-gray-500 dark:bg-muted"
                                >
                                    {{ alternativesData.length }}
                                </span>
                            </div>
                            <svg
                                :class="[
                                    'h-5 w-5 text-gray-400 transition-transform duration-200',
                                    showAlternatives ? 'rotate-180' : '',
                                ]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                        <div
                            v-show="showAlternatives"
                            class="overflow-x-auto rounded-b-lg"
                        >
                            <table
                                class="min-w-full divide-y divide-gray-200 text-sm dark:divide-border"
                            >
                                <tbody
                                    class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card"
                                >
                                    <tr
                                        v-for="alt in alternativesData"
                                        :key="alt.id"
                                        class="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-muted/50"
                                        @click="handleViewAlternative(alt.id)"
                                        :title="'Ver detalle de ' + alt.name"
                                    >
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <code
                                                class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-muted dark:text-gray-300"
                                                >{{ alt.sku }}</code
                                            >
                                        </td>
                                        <td
                                            class="px-4 py-3 text-gray-900 dark:text-white"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span>{{ alt.name }}</span>
                                                <svg
                                                    v-if="
                                                        loadingAltId === alt.id
                                                    "
                                                    class="h-4 w-4 animate-spin text-blue-500"
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
                                                    />
                                                    <path
                                                        class="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                    />
                                                </svg>
                                                <svg
                                                    v-else
                                                    class="h-4 w-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                                    />
                                                </svg>
                                            </div>
                                        </td>
                                        <td
                                            class="px-4 py-3 text-right whitespace-nowrap"
                                        >
                                            <span
                                                :class="
                                                    relationshipClass(
                                                        alt.pivot
                                                            ?.relationship_type ??
                                                            alt.relationship_type,
                                                    )
                                                "
                                                class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                                            >
                                                {{
                                                    relationshipLabel(
                                                        alt.pivot
                                                            ?.relationship_type ??
                                                            alt.relationship_type,
                                                    )
                                                }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
