<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import type { Product } from '@/types/product'
import apiClient from '@/services/api/client'
import { displayFormat } from '@/utils/formatters'
import { usePOS } from '@/composables/usePOS'
import { usePosSettings } from '@/composables/usePosSettings'

interface Props { product: Product }
const props = defineProps<Props>()
const emit = defineEmits<{ close: []; 'view-alternative': [product: Product] }>()

// ── Blind Mode (for customer screenshots) ─────────────────────────────────────
const blindMode = ref(localStorage.getItem('product_blind_mode') === 'true')
const toggleBlindMode = () => {
    blindMode.value = !blindMode.value
    localStorage.setItem('product_blind_mode', String(blindMode.value))
}
// Whether to apply ITBM on top of base_price in client view
const includeITBM = ref(localStorage.getItem('product_include_itbm') !== 'false') // default true
const toggleIncludeITBM = () => {
    includeITBM.value = !includeITBM.value
    localStorage.setItem('product_include_itbm', String(includeITBM.value))
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProductImage   { id: number; url: string; original_filename: string; display_order: number }
interface ProductAttribute { id: number; name: string; value: string; unit?: string | null; variant_id?: number | null }
interface OemReference   { id?: number; oem_code: string; manufacturer: string }
interface AlternativeRecord { id: number; sku: string; name: string; relationship_type: string; pivot?: { relationship_type?: string; source?: string; shared_codes?: string } }
interface VehicleRow     { id: number; make: string; model: string; year_from?: number; year_to?: number; engine: string; displacement?: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
const deepLink = (param: string, value: string | number) =>
    `/products?${param}=${encodeURIComponent(String(value))}`

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

const priceWithTax = (basePrice: number, taxRate?: number) => {
    const rate = (taxRate != null && !isNaN(taxRate)) ? taxRate : 7
    const safeBase = isNaN(basePrice) ? 0 : basePrice
    return safeBase * (1 + rate / 100)
}

// Returns the best pricing object for a variant (variant-level first, then product-level fallback)
const getVariantPricing = (variant: any) => {
    const vp = variant?.pricing
    if (vp && (Number(vp.base_price) > 0 || Number(vp.cost) > 0)) return vp
    return props.product.pricing ?? null
}

const relationshipLabel = (type: string): string => ({
    compatible: 'Compatible', substitute: 'Sustituto', upgrade: 'Mejora', cross_reference: 'Referencia Cruzada', same_category: 'Misma Categoría',
}[type] ?? type)

const relationshipClass = (type: string): string => ({
    compatible:       'bg-blue-100  text-blue-700  dark:bg-blue-900/40  dark:text-blue-300',
    substitute:       'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    upgrade:          'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    cross_reference:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    same_category:    'bg-teal-100  text-teal-700  dark:bg-teal-900/40  dark:text-teal-300',
}[type] ?? 'bg-gray-100 text-gray-700')

// ── Variants ──────────────────────────────────────────────────────────────────
const variants = computed(() => {
    if (props.product.variants?.length) return props.product.variants
    if (props.product.default_variant)  return [props.product.default_variant]
    return []
})

const activeVariantId = ref<number | null>(
    props.product.default_variant?.id ?? (variants.value[0]?.id ?? null)
)

const minPrice = computed(() => {
    return props.product.pricing?.base_price ?? 0
})
const totalStock = computed(() => variants.value.reduce((s, v) => s + (v.total_stock ?? 0), 0))

const quantities = ref<Record<number, number>>(Object.fromEntries(variants.value.map(v => [v.id, 1])))
const changeQty = (variantId: number, delta: number) => {
    quantities.value[variantId] = Math.max(1, (quantities.value[variantId] ?? 1) + delta)
}

const { addToCart } = usePOS()
const { currentWarehouseId } = usePosSettings()
const handleAddToCart = (variant: any) => {
    const qty = quantities.value[variant.id] ?? 1
    addToCart(props.product, variant, qty, currentWarehouseId.value || undefined)
    quantities.value[variant.id] = 1
    alert(`✅ ${qty} x ${props.product.name} (${variant.brand?.name ?? variant.sku}) agregado al carrito POS`)
}

// ── Images ────────────────────────────────────────────────────────────────────
const productImages   = ref<ProductImage[]>([])
const currentImageIdx = ref(0)
const uploadingImage  = ref(false)
const currentImage    = computed(() => productImages.value[currentImageIdx.value] ?? null)
const hasMultImg      = computed(() => productImages.value.length > 1)

const prevImage = () => {
    if (!hasMultImg.value) return
    currentImageIdx.value = currentImageIdx.value === 0 ? productImages.value.length - 1 : currentImageIdx.value - 1
}
const nextImage = () => {
    if (!hasMultImg.value) return
    currentImageIdx.value = currentImageIdx.value === productImages.value.length - 1 ? 0 : currentImageIdx.value + 1
}

const fetchImages = async () => {
    try {
        const res = await apiClient.get(`/products/${props.product.id}/images`)
        productImages.value = res.data.data ?? []
    } catch {
        if (props.product.image_url)
            productImages.value = [{ id: 0, url: props.product.image_url, original_filename: '', display_order: 0 }]
    }
}

const handleImageUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) return
    uploadingImage.value = true
    const fd = new FormData()
    for (let i = 0; i < input.files.length; i++) fd.append('images[]', input.files[i])
    try {
        const res = await apiClient.post(`/products/${props.product.id}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        const newImgs: ProductImage[] = res.data.data ?? []
        const jumpTo = productImages.value.length
        productImages.value.push(...newImgs)
        if (newImgs.length) currentImageIdx.value = jumpTo
    } catch (e) { console.error(e) }
    finally { uploadingImage.value = false; if (input) input.value = '' }
}

const handleDeleteImage = async (imageId: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return
    try {
        await apiClient.delete(`/products/${props.product.id}/images/${imageId}`)
        const idx = productImages.value.findIndex(img => img.id === imageId)
        if (idx !== -1) {
            productImages.value.splice(idx, 1)
            if (currentImageIdx.value >= productImages.value.length)
                currentImageIdx.value = Math.max(0, productImages.value.length - 1)
        }
    } catch (e) { console.error(e) }
}

// ── Specs (variant-aware) ─────────────────────────────────────────────────────
const attributesData      = ref<ProductAttribute[]>([])
const loadingAttrs        = ref(false)
const variantAttrsCache   = ref<Map<number, ProductAttribute[]>>(new Map())
const loadingVariantAttrs = ref(false)

const fetchVariantAttrs = async (variantId: number) => {
    if (variantAttrsCache.value.has(variantId)) return
    loadingVariantAttrs.value = true
    try {
        const res = await apiClient.get(`/products/${props.product.id}/attributes`, { params: { variant_id: variantId } })
        variantAttrsCache.value.set(variantId, res.data.data ?? [])
        variantAttrsCache.value = new Map(variantAttrsCache.value)
    } catch (e) { console.error(e) }
    finally { loadingVariantAttrs.value = false }
}

watch(activeVariantId, (id) => { if (id !== null) fetchVariantAttrs(id) }, { immediate: true })

const mergedSpecs = computed(() => {
    const productLevel = attributesData.value.filter((a: any) => !a.variant_id)
    if (!activeVariantId.value) return productLevel.map((a: any) => ({ ...a, isInherited: true }))
    const variantLevel: ProductAttribute[] = variantAttrsCache.value.get(activeVariantId.value) ?? []
    const map = new Map<string, any>()
    productLevel.forEach(a => map.set(a.name, { ...a, isInherited: true }))
    variantLevel.forEach(a => map.set(a.name, { ...a, isInherited: false }))

    // Fallback: if neither productLevel nor this variant's own attrs exist,
    // inherit from any other variant that has attributes (Henry: specs are "product-level")
    if (map.size === 0) {
        const fallbackVariant = variants.value.find(
            (v: any) => v.id !== activeVariantId.value && v.attributes && v.attributes.length > 0
        )
        if (fallbackVariant) {
            fallbackVariant.attributes?.forEach((a: any) => map.set(a.name, { ...a, isInherited: true }))
        }
    }

    return Array.from(map.values())
})

// ── Vehicle Compatibility (via VINs) ──────────────────────────────────────────
const vehicleRows    = ref<VehicleRow[]>([])
const loadingVehicle = ref(false)

const fetchVehicleCompatibility = async () => {
    loadingVehicle.value = true
    try {
        const res = await apiClient.get(`/products/${props.product.id}/compatibility`)
        const compat = res.data.data ?? []
        vehicleRows.value = compat.map((c: any) => ({
            id: c.id,
            make: c.engine?.model?.make?.name ?? '—',
            model: c.engine?.model?.name ?? '—',
            year_from: c.engine?.model?.year_from,
            year_to: c.engine?.model?.year_to,
            engine: c.engine?.engine_code ?? 'Varios',
            displacement: c.engine?.displacement
        }))
    } catch (e) {
        console.error(e)
        vehicleRows.value = []
    } finally {
        loadingVehicle.value = false
    }
}

// ── OEM + Alternatives ────────────────────────────────────────────────────────
const oemData          = ref<OemReference[]>([])
const alternativesData = ref<AlternativeRecord[]>([])
const loadingRefs      = ref(false)
const showAlternatives = ref(false)

// Tabs removed from layout
// ── Mount ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
    loadingAttrs.value = true
    loadingRefs.value  = true

    await Promise.all([
        fetchImages(),
        fetchVehicleCompatibility(),
        (async () => {
            try {
                const res = await apiClient.get(`/products/${props.product.id}/attributes`)
                attributesData.value = res.data.data ?? []
            } catch (e) { console.error(e) }
            finally { loadingAttrs.value = false }
        })(),
        (async () => {
            try {
                const [oemRes, altRes] = await Promise.all([
                    apiClient.get(`/products/${props.product.id}/oem-references`),
                    apiClient.get(`/products/${props.product.id}/alternatives`),
                ])
                oemData.value          = oemRes.data.data ?? []
                alternativesData.value = altRes.data.data ?? []
            } catch (e) { console.error(e) }
            finally { loadingRefs.value = false }
        })(),
    ])
})

// ── Navigate to alternative product ──────────────────────────────────────────
const loadingAltId = ref<number | null>(null)
const handleViewAlternative = async (altId: number) => {
    loadingAltId.value = altId
    try {
        const res = await apiClient.get(`/products/${altId}`)
        const altProduct = res.data.data ?? res.data
        emit('view-alternative', altProduct)
    } catch (e) {
        console.error('Error loading alternative product:', e)
    } finally {
        loadingAltId.value = null
    }
}
</script>

<template>
    <!-- Backdrop -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        @click.self="emit('close')">
        <div class="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-card">

            <!-- Header -->
            <div class="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-4 dark:border-border dark:bg-card/95">
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ product.name }}</h2>
                        <span v-if="product.is_universal" class="flex-shrink-0 inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/20" title="Universal">🌐 Universal</span>
                    </div>
                    <p v-if="product.sku_base && !blindMode" class="text-xs text-gray-400 font-mono mt-0.5">{{ displayFormat(product.sku_base) }}</p>
                    <p v-else-if="blindMode" class="text-xs text-gray-400 font-mono mt-0.5">#{{ String(product.id).padStart(8, '0') }}</p>
                </div>
                <div class="flex items-center gap-3">
                    <!-- Blind Mode Toggle -->
                    <button @click="toggleBlindMode"
                        :class="[
                            'relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shrink-0',
                            blindMode
                                ? 'bg-amber-500 focus:ring-amber-400'
                                : 'bg-gray-300 dark:bg-gray-600 focus:ring-gray-400'
                        ]"
                        :title="blindMode ? 'Modo Cliente activo — oculta SKU y muestra precio con ITBM' : 'Modo Normal — muestra toda la información'"
                    >
                        <span
                            :class="[
                                'inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transform transition-transform duration-200',
                                blindMode ? 'translate-x-8' : 'translate-x-1'
                            ]"
                        >
                            <svg v-if="blindMode" class="h-3 w-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                            <svg v-else class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </span>
                    </button>
                    <span class="text-[10px] font-medium uppercase tracking-wider" :class="blindMode ? 'text-amber-500' : 'text-gray-400'">{{ blindMode ? 'Cliente' : 'Normal' }}</span>

                    <!-- ITBM toggle (only in client mode) -->
                    <template v-if="blindMode">
                        <div class="flex items-center gap-1.5 ml-1">
                            <button
                                @click="toggleIncludeITBM"
                                :class="[
                                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none shrink-0',
                                    includeITBM ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                ]"
                                :title="includeITBM ? 'ITBM incluido en precio — clic para excluirlo' : 'ITBM NO incluido — clic para incluirlo'"
                            >
                                <span :class="['inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200', includeITBM ? 'translate-x-4' : 'translate-x-0.5']" />
                            </button>
                            <span class="text-[10px] font-medium" :class="includeITBM ? 'text-green-500' : 'text-gray-400'">ITBM</span>
                        </div>
                    </template>

                    <!-- Close -->
                    <button @click="emit('close')"
                        class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition dark:hover:bg-muted/50 dark:hover:text-gray-300">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="p-6 space-y-6">

                <!-- ══════════════════════════════════════════════════════ -->
                <!--  TOP PANEL: Photo (left) + Variants (right)          -->
                <!-- ══════════════════════════════════════════════════════ -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                    <!-- 🔹 IZQUIERDA: Info Producto + Specs (col-md-5) -->
                    <div class="lg:col-span-5 flex flex-col gap-4">
                        <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-5">
                            <!-- Image Carousel (Reuse existing) -->
                            <div class="relative h-64 mb-6 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 dark:bg-background dark:border-border group/img flex-shrink-0 flex items-center justify-center">
                                <img v-if="currentImage" :src="currentImage.url" :alt="product.name" :key="currentImage.id"
                                    class="max-h-full max-w-full object-contain transition-opacity duration-300" />
                                <div v-else class="flex h-full w-full flex-col items-center justify-center gap-2">
                                    <svg class="h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <!-- Nav Arrows -->
                                <button v-if="hasMultImg" @click.stop="prevImage" class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-all hover:bg-black/70 group-hover/img:opacity-100 backdrop-blur-sm"><svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg></button>
                                <button v-if="hasMultImg" @click.stop="nextImage" class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-all hover:bg-black/70 group-hover/img:opacity-100 backdrop-blur-sm"><svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg></button>
                                <div v-if="productImages.length > 0" class="absolute top-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">{{ currentImageIdx + 1 }} / {{ productImages.length }}</div>
                                <button v-if="currentImage && currentImage.id !== 0" @click.stop="handleDeleteImage(currentImage.id)" class="absolute top-2 right-2 rounded-lg bg-red-500/80 p-1 text-white opacity-0 transition-all hover:bg-red-600 group-hover/img:opacity-100 backdrop-blur-sm"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                <label class="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-white opacity-0 transition-all hover:bg-black/80 group-hover/img:opacity-100 backdrop-blur-sm"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg><span class="text-xs font-medium">{{ uploadingImage ? 'Subiendo...' : 'Agregar fotos' }}</span><input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" multiple @change="handleImageUpload" :disabled="uploadingImage" /></label>
                            </div>

                            <!-- Título y Código -->
                            <div class="text-center mb-6">
                                <template v-if="!blindMode">
                                    <small class="text-gray-500 uppercase tracking-wide text-xs">Código Base / SKU</small>
                                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ displayFormat(product.sku_base || product.default_variant?.sku) || 'N/A' }}</h1>
                                </template>
                                <template v-else>
                                    <small class="text-gray-500 uppercase tracking-wide text-xs">Código</small>
                                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">#{{ String(product.id).padStart(8, '0') }}</h1>
                                </template>
                                <p v-if="blindMode && product.category?.name" class="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium">{{ product.category.name }}</p>
                                <p v-if="product.description && !blindMode" class="text-gray-600 dark:text-gray-400 mt-2">{{ product.description }}</p>
                            </div>

                            <!-- Especificaciones Técnicas -->
                            <div v-if="!blindMode">
                                <h6 class="font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-border pb-2 mb-3">
                                    Especificaciones Técnicas
                                    <span v-if="loadingVariantAttrs" class="text-xs font-normal text-gray-400 animate-pulse ml-2">cargando...</span>
                                </h6>
                                <div v-if="loadingAttrs" class="text-sm text-gray-400 animate-pulse py-2">Cargando especificaciones...</div>
                                <div v-else-if="mergedSpecs.length === 0" class="text-sm text-gray-400 italic py-2">Sin especificaciones registradas.</div>
                                <div v-else class="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <div v-for="spec in mergedSpecs" :key="spec.name" class="flex justify-between items-center text-sm py-1 border-b border-gray-50 dark:border-border last:border-0 relative group">
                                        <span class="text-gray-500 capitalize">{{ spec.name }}</span>
                                        <span class="font-medium text-gray-900 dark:text-gray-200 text-right">
                                            {{ spec.value }}<span v-if="spec.unit" class="text-xs text-gray-500 ml-1">{{ spec.unit }}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 🔹 DERECHA: Marcas Disponibles -->
                    <div class="lg:col-span-7">
                        <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border flex flex-col h-full max-h-[600px] lg:max-h-[800px]">
                            
                            <div class="p-4 border-b border-gray-100 dark:border-border flex justify-between items-center bg-gray-50 dark:bg-background rounded-t-lg shrink-0">
                                <h2 class="font-bold text-gray-900 dark:text-white text-lg">Marcas Disponibles</h2>
                                <span class="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                    {{ variants.length }} opciones
                                </span>
                            </div>

                            <div class="overflow-y-auto p-4 custom-scrollbar flex-1">
                                <div v-if="variants.length > 0" class="space-y-3">
                                    <div v-for="variant in variants" :key="variant.id" 
                                        class="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-gray-200 dark:border-border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all gap-4 cursor-pointer"
                                        :class="activeVariantId === variant.id ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : ''"
                                        @click="activeVariantId = variant.id">
                                        
                                        <!-- Info Marca -->
                                        <div class="flex flex-col flex-1">
                                            <div class="flex items-center gap-2">
                                                <span v-if="!blindMode" class="font-bold text-gray-900 dark:text-white font-mono text-base">{{ displayFormat(variant.sku) }}</span>
                                                <span v-else class="font-bold text-gray-900 dark:text-white text-base">{{ variant.brand?.name ?? 'Sin marca' }}</span>
                                            </div>
                                            <span v-if="!blindMode" class="text-xs text-gray-500 mt-1">
                                                <span class="font-semibold text-gray-700 dark:text-gray-300">Marca:</span> {{ variant.brand?.name ?? 'Sin marca' }}
                                                <span v-if="variant.attributes?.length" class="ml-2">
                                                    | <span class="font-semibold text-gray-700 dark:text-gray-300">Atributos:</span> {{ variant.attributes.map(a => `${a.name}: ${a.value}${a.unit ? ' ' + a.unit : ''}`).join(', ') }}
                                                </span>
                                            </span>
                                        </div>

                                        <!-- Precio y Action -->
                                        <div class="flex items-center gap-6 self-end sm:self-auto">
                                            <!-- Quantities -->
                                            <div v-if="!blindMode" class="flex items-center gap-2 bg-gray-50 dark:bg-background rounded-md p-1 border border-gray-200 dark:border-border shrink-0">
                                                 <button @click.stop="changeQty(variant.id, -1)" :disabled="(variant.total_stock ?? 0) === 0" class="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-muted/50">-</button>
                                                 <span class="text-sm font-medium w-6 text-center text-gray-900 dark:text-white">{{ quantities[variant.id] ?? 1 }}</span>
                                                 <button @click.stop="changeQty(variant.id, 1)" :disabled="(variant.total_stock ?? 0) === 0 || (quantities[variant.id] ?? 1) >= (variant.total_stock ?? 0)" class="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-muted/50">+</button>
                                            </div>

                                            <div class="text-right min-w-[90px] shrink-0">
                                                <div class="text-lg font-bold text-green-600 dark:text-green-400">
                                                    <template v-if="getVariantPricing(variant)">
                                                        <template v-if="blindMode">
                                                            {{ formatCurrency((includeITBM ? priceWithTax(Number(getVariantPricing(variant).calculated_price ?? getVariantPricing(variant).base_price), Number(getVariantPricing(variant).tax_rate)) : Number(getVariantPricing(variant).calculated_price ?? getVariantPricing(variant).base_price)) * (quantities[variant.id] ?? 1)) }}
                                                        </template>
                                                        <template v-else>
                                                            {{ formatCurrency(Number(getVariantPricing(variant).base_price) * (quantities[variant.id] ?? 1)) }}
                                                        </template>
                                                    </template>
                                                    <template v-else>N/A</template>
                                                </div>
                                                <div v-if="blindMode" class="text-[10px] text-gray-400">
                                                    <template v-if="includeITBM">
                                                         Base {{ formatCurrency(Number(getVariantPricing(variant).calculated_price ?? getVariantPricing(variant).base_price) * (quantities[variant.id] ?? 1)) }} + ITBMS {{ formatCurrency((priceWithTax(Number(getVariantPricing(variant).calculated_price ?? getVariantPricing(variant).base_price), Number(getVariantPricing(variant).tax_rate)) - Number(getVariantPricing(variant).calculated_price ?? getVariantPricing(variant).base_price)) * (quantities[variant.id] ?? 1)) }}
                                                    </template>
                                                    <template v-else>
                                                        Sin ITBM
                                                    </template>
                                                </div>
                                            <div v-if="!blindMode && getVariantPricing(variant)?.cost > 0" class="text-[10px] text-gray-400">
                                                    Costo: {{ formatCurrency(Number(getVariantPricing(variant).cost)) }}
                                                </div>
                                                <div v-if="!blindMode" :class="[
                                                    'text-xs font-medium',
                                                    (variant.total_stock ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'
                                                ]">
                                                    {{ variant.total_stock ?? 0 }} disponibles
                                                </div>
                                            </div>

                                            <button
                                                v-if="!blindMode"
                                                @click.stop="handleAddToCart(variant)"
                                                :disabled="(variant.total_stock ?? 0) === 0"
                                                class="bg-blue-600 dark:bg-primary dark:text-primary-foreground text-white hover:bg-blue-700 dark:hover:bg-primary/90 w-12 h-12 rounded-lg flex items-center justify-center shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                                title="Agregar al carrito"
                                            >
                                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="text-center py-12">
                                    <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    <p class="text-gray-500">No hay marcas disponibles.</p>
                                </div>
                            </div>

                            <div class="p-3 bg-gray-50 dark:bg-background border-t border-gray-100 dark:border-border rounded-b-lg text-center text-xs text-gray-500 shrink-0">
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
                    <div class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border flex flex-col max-h-[350px]">
                        <div class="p-4 border-b border-gray-100 dark:border-border font-bold text-gray-900 dark:text-white flex items-center gap-2 bg-gray-50 dark:bg-background rounded-t-lg shrink-0">
                            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                            Vehículos Compatibles
                            <span v-if="!loadingVehicle && vehicleRows.length > 0 && !product.is_universal" class="text-xs font-normal text-gray-500 bg-gray-200 dark:bg-muted px-2 py-0.5 rounded-full">
                                {{ vehicleRows.length }} modelos
                            </span>
                        </div>

                        <div class="overflow-y-auto flex-1 custom-scrollbar">
                            <div v-if="loadingVehicle" class="text-sm text-gray-400 animate-pulse p-4">Cargando compatibilidad...</div>
                            <div v-else-if="product.is_universal" class="text-sm text-blue-600 dark:text-blue-400 italic p-6 text-center bg-blue-50/50 dark:bg-blue-900/10">
                                <svg class="w-12 h-12 text-blue-300 dark:text-blue-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p class="font-medium text-blue-700 dark:text-blue-300 text-base not-italic">Este es un Producto Universal</p>
                                <p class="mt-1">Es compatible con cualquier vehículo o su uso es general.</p>
                            </div>
                            <div v-else-if="vehicleRows.length === 0" class="text-sm text-gray-400 italic p-6 text-center">
                                <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                                Sin vehículos vinculados. Agrega compatibilidad vehicular editando el producto.
                            </div>
                            <table v-else class="w-full text-sm text-left">
                                <thead class="bg-gray-50 dark:bg-background text-gray-700 dark:text-gray-300 font-semibold sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th class="px-4 py-3 border-b border-gray-200 dark:border-border">Marca</th>
                                        <th class="px-4 py-3 border-b border-gray-200 dark:border-border">Modelo</th>
                                        <th class="px-4 py-3 border-b border-gray-200 dark:border-border">Años</th>
                                        <th class="px-4 py-3 border-b border-gray-200 dark:border-border">Motor / Disp.</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-border bg-white dark:bg-card">
                                    <tr v-for="row in vehicleRows" :key="row.id" class="hover:bg-blue-50 dark:hover:bg-muted/50/50 transition-colors">
                                        <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.make }}</td>
                                        <td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ row.model }}</td>
                                        <td class="px-4 py-3 text-gray-600 dark:text-gray-400">
                                            <span v-if="row.year_from">{{ row.year_from }}{{ row.year_to ? '–' + row.year_to : '+' }}</span>
                                            <span v-else>—</span>
                                        </td>
                                        <td class="px-4 py-3 font-mono text-gray-600 dark:text-gray-400">
                                            {{ row.engine }}<span v-if="row.displacement" class="ml-1 text-[10px] text-gray-500"> ({{ row.displacement }}L)</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- OEM Referencias (Full Width) -->
                    <div v-if="!loadingRefs && oemData.length > 0" class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border">
                        <div class="p-4 border-b border-gray-100 dark:border-border font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-background rounded-t-lg flex items-center gap-2">
                            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" /></svg>
                            Referencias OEM
                            <span class="text-xs font-normal text-gray-500 bg-gray-200 dark:bg-muted px-2 py-0.5 rounded-full">
                                {{ oemData.length }}
                            </span>
                        </div>
                        <div class="overflow-x-auto rounded-b-lg">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-border text-sm">
                                <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                                    <tr v-for="oem in oemData" :key="oem.oem_code" class="hover:bg-gray-50 dark:hover:bg-muted/50">
                                        <td class="px-4 py-3 font-mono font-semibold text-amber-700 dark:text-amber-400">
                                            <a :href="deepLink('oem_code', oem.oem_code)" target="_blank" class="hover:underline">{{ oem.oem_code }}</a>
                                        </td>
                                        <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ oem.manufacturer || '—' }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Alternativas (Collapsible) -->
                    <div v-if="!loadingRefs && alternativesData.length > 0" class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border">
                        <button
                            @click="showAlternatives = !showAlternatives"
                            class="w-full p-4 border-b border-gray-100 dark:border-border font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-background rounded-t-lg flex items-center justify-between hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors"
                        >
                            <div class="flex items-center gap-2">
                                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01" /></svg>
                                Alternativas y Ref. Cruzadas
                                <span class="text-xs font-normal text-gray-500 bg-gray-200 dark:bg-muted px-2 py-0.5 rounded-full">
                                    {{ alternativesData.length }}
                                </span>
                            </div>
                            <svg
                                :class="['h-5 w-5 text-gray-400 transition-transform duration-200', showAlternatives ? 'rotate-180' : '']"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <div v-show="showAlternatives" class="overflow-x-auto rounded-b-lg">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-border text-sm">
                                <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-card">
                                    <tr v-for="alt in alternativesData" :key="alt.id"
                                        class="hover:bg-gray-50 dark:hover:bg-muted/50 cursor-pointer transition-colors group"
                                        @click="handleViewAlternative(alt.id)"
                                        :title="'Ver detalle de ' + alt.name">
                                        <td class="whitespace-nowrap px-4 py-3">
                                            <code class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-muted dark:text-gray-300">{{ alt.sku }}</code>
                                        </td>
                                        <td class="px-4 py-3 text-gray-900 dark:text-white">
                                            <div class="flex items-center gap-2">
                                                <span>{{ alt.name }}</span>
                                                <svg v-if="loadingAltId === alt.id" class="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                <svg v-else class="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </div>
                                        </td>
                                        <td class="whitespace-nowrap px-4 py-3 text-right">
                                            <span :class="relationshipClass(alt.pivot?.relationship_type ?? alt.relationship_type)" class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold">
                                                {{ relationshipLabel(alt.pivot?.relationship_type ?? alt.relationship_type) }}
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
