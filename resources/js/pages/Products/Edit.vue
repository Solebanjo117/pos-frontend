<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import type { UpdateProductRequest } from '@/types/product'
import apiClient from '@/services/api/client'
import AttributeManager from '@/components/Products/AttributeManager.vue'
import VariantManager from '@/components/Products/VariantManager.vue'
import OemReferenceManager from '@/components/Products/OemReferenceManager.vue'
import AlternativeManager from '@/components/Products/AlternativeManager.vue'

const props = defineProps<{
    productId: number
}>()

const { currentProduct, updateProduct, fetchProduct, loading, error } = useProducts()

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
    { title: 'Editar', href: `/products/${props.productId}/edit` },
]

const form = ref<UpdateProductRequest>({
    sku: '',
    upc: '',
    product_line_id: undefined,
    name: '',
    description: '',
    status: 'active',
    pricing: {
        base_price: 0,
        msrp: 0,
        cost: 0,
        tax_rate: 7,
        tax_type: 'standard',
    },
})

const validationErrors = ref<Record<string, string[]>>({})
const successMessage = ref('')
const activeTab = ref('general')

// Read ?variant= query param (e.g. /products/1/edit?variant=11)
const variantId = computed(() => {
    const param = new URLSearchParams(window.location.search).get('variant')
    return param ? Number(param) : null
})

onMounted(async () => {
    await fetchProduct(props.productId, undefined, ['pricing'])

    if (currentProduct.value) {
        // Populate form with existing data
            const variantPricing = currentProduct.value.pricing
            form.value = {
                sku: currentProduct.value.sku_base || '',
                upc: currentProduct.value.default_variant?.upc || '',
                name: currentProduct.value.name,
                description: currentProduct.value.description || '',
                status: currentProduct.value.status,
                batch_tracking: currentProduct.value.batch_tracking,
                pricing: variantPricing ? {
                    base_price: variantPricing.base_price,
                    msrp: variantPricing.msrp,
                    cost: variantPricing.cost,
                    tax_rate: variantPricing.tax_rate,
                    tax_type: (variantPricing as any).tax_type || 'standard',
                    max_discount_percentage: variantPricing.max_discount_percentage,
                } : {
                    base_price: 0,
                    msrp: 0,
                    cost: 0,
                    tax_rate: 7,
                    tax_type: 'standard',
                    max_discount_percentage: 0,
                },
            }
    }
})

// === 3-Way Tax Calculator Logic ===
const isCalculating = ref(false)
const computed_total = ref(0)

watch(
    () => [form.value.pricing?.base_price, form.value.pricing?.tax_rate],
    ([newPrice, newTax]) => {
        if (isCalculating.value) return
        isCalculating.value = true
        const price = Number(newPrice) || 0
        const tax = Number(newTax) || 0
        computed_total.value = Math.round((price * (1 + tax / 100)) * 100) / 100
        isCalculating.value = false
    },
    { immediate: true }
)

const onTotalChange = (newTotal: number) => {
    if (isCalculating.value) return
    isCalculating.value = true
    const tax = Number(form.value.pricing?.tax_rate) || 0
    const total = Number(newTotal) || 0
    if (form.value.pricing) {
        form.value.pricing.base_price = Math.round((total / (1 + tax / 100)) * 100) / 100
    }
    computed_total.value = total
    isCalculating.value = false
}

const onTaxTypeChange = (type: string) => {
    if (!form.value.pricing) return
    ;(form.value.pricing as any).tax_type = type
    if (type === 'standard') {
        form.value.pricing.tax_rate = 7
    } else if (type === 'exempt') {
        form.value.pricing.tax_rate = 0
    }
}

const handleSubmit = async () => {
    validationErrors.value = {}
    successMessage.value = ''

    try {
        await updateProduct(props.productId, form.value)
        successMessage.value = 'Producto actualizado exitosamente'

        // Redirect to products list after 1 second
        setTimeout(() => {
            window.location.href = '/products'
        }, 1000)
    } catch (err: any) {
        if (err.response?.data?.errors) {
            validationErrors.value = err.response.data.errors
        }
    }
}

const cancel = () => {
    window.location.href = '/products'
}

// ===== Multi-Photo Management =====
interface ProductImage {
    id: number
    url: string
    original_filename: string
    display_order: number
}

const productImages = ref<ProductImage[]>([])
const currentImageIndex = ref(0)
const uploadingImage = ref(false)

const currentImage = computed(() => productImages.value[currentImageIndex.value] ?? null)
const hasMultipleImages = computed(() => productImages.value.length > 1)

const prevImage = () => {
    if (productImages.value.length <= 1) return
    currentImageIndex.value = currentImageIndex.value === 0
        ? productImages.value.length - 1
        : currentImageIndex.value - 1
}

const nextImage = () => {
    if (productImages.value.length <= 1) return
    currentImageIndex.value = currentImageIndex.value === productImages.value.length - 1
        ? 0
        : currentImageIndex.value + 1
}

const goToImage = (index: number) => {
    currentImageIndex.value = index
}

const fetchImages = async () => {
    try {
        const res = await apiClient.get(`/products/${props.productId}/images`)
        productImages.value = res.data.data ?? []
    } catch (e) {
        productImages.value = []
    }
}

const handleImageUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) return

    uploadingImage.value = true
    const formData = new FormData()
    for (let i = 0; i < input.files.length; i++) {
        formData.append('images[]', input.files[i])
    }

    try {
        const res = await apiClient.post(`/products/${props.productId}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        const newImages: ProductImage[] = res.data.data ?? []
        const jumpTo = productImages.value.length
        productImages.value.push(...newImages)
        if (newImages.length > 0) currentImageIndex.value = jumpTo
    } catch (e) {
        console.error('Error uploading image', e)
    } finally {
        uploadingImage.value = false
        input.value = ''
    }
}

const handleDeleteImage = async (imageId: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return
    try {
        await apiClient.delete(`/products/${props.productId}/images/${imageId}`)
        const idx = productImages.value.findIndex(img => img.id === imageId)
        if (idx !== -1) {
            productImages.value.splice(idx, 1)
            if (currentImageIndex.value >= productImages.value.length) {
                currentImageIndex.value = Math.max(0, productImages.value.length - 1)
            }
        }
    } catch (e) {
        console.error('Error deleting image', e)
    }
}

// Load images on mount
onMounted(() => {
    fetchImages()
})

// ===== VIN Management =====
interface ProductVin {
    id: number
    vin: string
}

const vins = ref<ProductVin[]>([])
const newVin = ref('')
const vinError = ref('')
const addingVin = ref(false)

const fetchVins = async () => {
    try {
        const res = await apiClient.get(`/products/${props.productId}/vins`)
        vins.value = res.data.data ?? []
    } catch (e) {
        vins.value = []
    }
}

const handleAddVin = async () => {
    if (newVin.value.trim().length < 1) {
        vinError.value = 'El VIN no puede estar vacío'
        return
    }
    vinError.value = ''
    addingVin.value = true
    try {
        const res = await apiClient.post(`/products/${props.productId}/vins`, { vin: newVin.value.toUpperCase() })
        vins.value.push(res.data.data)
        newVin.value = ''
    } catch (e: any) {
        vinError.value = e.response?.data?.message ?? 'Error al agregar VIN'
    } finally {
        addingVin.value = false
    }
}

const handleRemoveVin = async (vinId: number) => {
    if (!confirm('¿Eliminar este VIN?')) return
    try {
        await apiClient.delete(`/products/${props.productId}/vins/${vinId}`)
        vins.value = vins.value.filter(v => v.id !== vinId)
    } catch (e) {
        console.error('Error removing VIN', e)
    }
}

onMounted(() => {
    fetchVins()
})
</script>

<template>
    <Head title="Editar Producto" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="p-4">
            <!-- Header -->
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Editar Producto</h1>
            </div>

            <!-- Loading -->
            <div v-if="loading && !currentProduct" class="text-center py-12">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent"></div>
                <p class="mt-2 text-gray-600">Cargando producto...</p>
            </div>

            <div v-else>
                <!-- Success Message -->
                <div v-if="successMessage" class="mb-6 rounded-lg bg-green-50 p-4 text-green-800">
                    {{ successMessage }}
                </div>

                <!-- Error Message -->
                <div v-if="error" class="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
                    {{ error }}
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  TOP-LEVEL GROUP TABS (3 Pills)                           -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="mb-6">
                    <nav class="flex gap-2 rounded-xl bg-gray-100 p-1 dark:bg-background">
                        <button
                            @click="activeTab = 'general'"
                            :class="[
                                ['general','pricing','photos'].includes(activeTab)
                                    ? 'bg-white shadow text-blue-700 dark:bg-muted dark:text-blue-400'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                                'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all'
                            ]"
                        >
                            📋 Información Principal
                        </button>
                        <button
                            @click="activeTab = 'specs'"
                            :class="[
                                ['specs','vins'].includes(activeTab)
                                    ? 'bg-white shadow text-blue-700 dark:bg-muted dark:text-blue-400'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                                'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all'
                            ]"
                        >
                            🔧 Datos Técnicos
                        </button>
                        <button
                            @click="activeTab = 'variants'"
                            :class="[
                                ['variants','references','alternatives'].includes(activeTab)
                                    ? 'bg-white shadow text-blue-700 dark:bg-muted dark:text-blue-400'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                                'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all'
                            ]"
                        >
                            🔗 Variantes y Referencias
                        </button>
                    </nav>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  GROUP 1: Información Principal                           -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div v-if="['general','pricing','photos'].includes(activeTab)" class="space-y-6">
                    <!-- Sub-tabs -->
                    <div class="flex gap-1 border-b border-gray-200 dark:border-border">
                        <button @click="activeTab = 'general'"
                            :class="[activeTab === 'general' ? 'border-blue-500 text-blue-600 dark:text-primary dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400']"
                            class="border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
                            Información General
                        </button>
                        <button @click="activeTab = 'pricing'"
                            :class="[activeTab === 'pricing' ? 'border-blue-500 text-blue-600 dark:text-primary dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400']"
                            class="border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
                            Precios e Inventario
                        </button>
                        <button @click="activeTab = 'photos'"
                            :class="[activeTab === 'photos' ? 'border-blue-500 text-blue-600 dark:text-primary dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400']"
                            class="border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2">
                            Fotos
                            <span v-if="productImages.length" class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{{ productImages.length }}</span>
                        </button>
                    </div>

                    <!-- Form: General + Pricing only -->
                    <form v-if="activeTab === 'general' || activeTab === 'pricing'" @submit.prevent="handleSubmit" class="space-y-6">

                        <!-- General Information -->
                        <div v-show="activeTab === 'general'" class="rounded-lg bg-white p-6 shadow dark:bg-card">
                            <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Información General</h2>
                            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                        SKU <span class="text-red-500">*</span>
                                    </label>
                                    <input v-model="form.sku" type="text" required
                                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white" />
                                    <p v-if="validationErrors.sku" class="mt-1 text-sm text-red-600">{{ validationErrors.sku[0] }}</p>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Custom SKU</label>
                                    <input v-model="form.upc" type="text"
                                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white" />
                                </div>

                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                        Nombre <span class="text-red-500">*</span>
                                    </label>
                                    <input v-model="form.name" type="text" required
                                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white" />
                                    <p v-if="validationErrors.name" class="mt-1 text-sm text-red-600">{{ validationErrors.name[0] }}</p>
                                </div>

                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Notas</label>
                                    <textarea v-model="form.description" rows="3"
                                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                                        placeholder="Notas internas del producto..."></textarea>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Estado</label>
                                    <select v-model="form.status"
                                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white">
                                        <option value="active">Activo</option>
                                        <option value="discontinued">Discontinuado</option>
                                        <option value="pending">Pendiente</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Pricing -->
                        <div v-show="activeTab === 'pricing'" v-if="form.pricing" class="rounded-lg bg-white p-6 shadow dark:bg-card">
                            <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Precios e Impuestos</h2>

                            <!-- Tax Type Selector -->
                            <div class="mb-6">
                                <label class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Tipo de Impuesto (ITBM)</label>
                                <div class="flex gap-4">
                                    <label class="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 transition-colors"
                                        :class="(form.pricing as any).tax_type === 'standard' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-border'">
                                        <input type="radio" name="tax_type" value="standard" :checked="(form.pricing as any).tax_type === 'standard'" @change="onTaxTypeChange('standard')" class="sr-only" />
                                        <span class="text-sm font-medium">Con ITBM (7%)</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 transition-colors"
                                        :class="(form.pricing as any).tax_type === 'exempt' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'border-gray-300 dark:border-border'">
                                        <input type="radio" name="tax_type" value="exempt" :checked="(form.pricing as any).tax_type === 'exempt'" @change="onTaxTypeChange('exempt')" class="sr-only" />
                                        <span class="text-sm font-medium">Sin ITBM (0%)</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 transition-colors"
                                        :class="(form.pricing as any).tax_type === 'custom' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'border-gray-300 dark:border-border'">
                                        <input type="radio" name="tax_type" value="custom" :checked="(form.pricing as any).tax_type === 'custom'" @change="onTaxTypeChange('custom')" class="sr-only" />
                                        <span class="text-sm font-medium">Tasa personalizada</span>
                                    </label>
                                </div>
                            </div>

                            <!-- 3-Way Calculator -->
                            <div class="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6 p-4 rounded-lg bg-gray-50 dark:bg-muted/50 border border-dashed border-gray-300 dark:border-border">
                                <div>
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Precio Base (USD)</label>
                                    <input v-model.number="form.pricing.base_price" type="number" step="0.01" min="0"
                                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white" />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">ITBM (%)</label>
                                    <input v-model.number="form.pricing.tax_rate" type="number" step="0.01" min="0" max="15"
                                        :disabled="(form.pricing as any).tax_type !== 'custom'"
                                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                                    <p v-if="(form.pricing as any).tax_type !== 'custom'" class="mt-1 text-xs text-gray-500">Selecciona "Tasa personalizada" para editar</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Precio Total (con ITBM)</label>
                                    <input :value="computed_total" @input="onTotalChange(Number(($event.target as HTMLInputElement).value))"
                                        type="number" step="0.01" min="0"
                                        class="mt-1 w-full rounded-md border border-blue-400 bg-blue-50 dark:border-blue-600 dark:border-primary dark:bg-blue-900/20 px-3 py-2 dark:text-white font-semibold" />
                                    <p class="mt-1 text-xs text-blue-600 dark:text-primary dark:text-blue-400">Se recalcula automáticamente</p>
                                </div>
                            </div>


                        </div>

                        <!-- Actions -->
                        <div class="flex justify-end gap-4">
                            <button type="button" @click="cancel"
                                class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-gray-700 hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button type="submit" :disabled="loading"
                                class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-6 py-2 text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50">
                                {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
                            </button>
                        </div>
                    </form>

                    <!-- Photos (outside form) -->
                    <div v-if="activeTab === 'photos'" class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Fotos del Producto</h2>
                            <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 transition">
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                {{ uploadingImage ? 'Subiendo...' : 'Agregar Fotos' }}
                                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" multiple
                                    @change="handleImageUpload" :disabled="uploadingImage" />
                            </label>
                        </div>

                        <div v-if="productImages.length > 0" class="relative mx-auto max-w-2xl">
                            <div class="relative h-80 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 group/img">
                                <img v-if="currentImage" :src="currentImage.url" :alt="currentProduct?.name || 'Producto'"
                                    class="h-full w-full object-contain" :key="currentImage.id" />
                                <button v-if="hasMultipleImages" @click="prevImage" type="button"
                                    class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-all hover:bg-black/70 group-hover/img:opacity-100 backdrop-blur-sm">
                                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button v-if="hasMultipleImages" @click="nextImage" type="button"
                                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-all hover:bg-black/70 group-hover/img:opacity-100 backdrop-blur-sm">
                                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
                                </button>
                                <div class="absolute top-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                    {{ currentImageIndex + 1 }} / {{ productImages.length }}
                                </div>
                                <button v-if="currentImage" @click="handleDeleteImage(currentImage.id)" type="button"
                                    class="absolute top-3 right-3 rounded-lg bg-red-500/80 p-1.5 text-white opacity-0 transition-all hover:bg-red-600 group-hover/img:opacity-100 backdrop-blur-sm" title="Eliminar imagen">
                                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                <div v-if="hasMultipleImages" class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    <button v-for="(_, idx) in productImages" :key="idx" @click="goToImage(idx)" type="button"
                                        class="h-2.5 w-2.5 rounded-full transition-all"
                                        :class="idx === currentImageIndex ? 'bg-white scale-125 shadow-md' : 'bg-white/50 hover:bg-white/80'" />
                                </div>
                            </div>
                        </div>

                        <div v-else class="flex flex-col items-center justify-center py-12 text-gray-400">
                            <svg class="h-16 w-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p class="text-sm">Este producto no tiene fotos</p>
                            <p class="text-xs mt-1">Usa el botón "Agregar Fotos" para subir imágenes</p>
                        </div>

                        <div v-if="productImages.length > 1" class="mt-4 grid grid-cols-6 gap-2 max-w-2xl mx-auto">
                            <button v-for="(img, idx) in productImages" :key="img.id" @click="goToImage(idx)" type="button"
                                class="relative h-16 rounded-lg overflow-hidden border-2 transition-all"
                                :class="idx === currentImageIndex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-400 dark:border-border'">
                                <img :src="img.url" class="h-full w-full object-cover" />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  GROUP 2: Datos Técnicos y Aplicación                    -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div v-if="['specs','vins'].includes(activeTab)" class="space-y-6">
                    <!-- Sub-tabs -->
                    <div class="flex gap-1 border-b border-gray-200 dark:border-border">
                        <button @click="activeTab = 'vins'"
                            :class="[activeTab === 'vins' ? 'border-blue-500 text-blue-600 dark:text-primary dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400']"
                            class="border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2">
                            🔑 VINs
                            <span v-if="vins.length" class="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{{ vins.length }}</span>
                        </button>
                    </div>

                    <div class="rounded-lg bg-white/60 dark:bg-card/60 p-4 border border-amber-200 dark:border-amber-800/50 mb-4">
                        <p class="text-sm text-amber-700 dark:text-amber-300">💡 Las <strong>especificaciones técnicas</strong> (atributos) ahora pertenecen a cada <strong>variante</strong>, no al producto base. Edítalas desde la pestaña <em>Variantes y Referencias</em>.</p>
                    </div>


                    <div v-if="activeTab === 'vins'" class="rounded-lg bg-white p-6 shadow dark:bg-card">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">VINs Vinculados</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Asocia VINs específicos a este producto. Al escanear un VIN en el POS, se mostrarán los productos compatibles.</p>

                        <div class="flex gap-3 mb-6">
                            <div class="flex-1">
                                <input v-model="newVin" type="text" maxlength="40"
                                    placeholder="Ingresa o escanea un VIN"
                                    class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono uppercase dark:border-border dark:bg-muted dark:text-white"
                                    @keyup.enter="handleAddVin" />
                                <p v-if="vinError" class="mt-1 text-sm text-red-600">{{ vinError }}</p>
                            </div>
                            <button type="button" @click="handleAddVin" :disabled="addingVin || newVin.trim().length < 1"
                                class="px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg transition text-sm font-medium">
                                {{ addingVin ? 'Agregando...' : '+ Agregar VIN' }}
                            </button>
                        </div>

                        <div v-if="vins.length" class="space-y-2">
                            <div v-for="vin in vins" :key="vin.id"
                                class="flex items-center justify-between rounded-lg border border-gray-200 dark:border-border px-4 py-3 bg-gray-50 dark:bg-background">
                                <span class="font-mono text-sm font-semibold tracking-widest text-gray-800 dark:text-gray-200">{{ vin.vin }}</span>
                                <button type="button" @click="handleRemoveVin(vin.id)"
                                    class="p-1 text-gray-400 hover:text-red-600 transition" title="Eliminar VIN">
                                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div v-else class="text-center py-10 text-gray-400">
                            <p class="text-4xl mb-2">🔑</p>
                            <p class="text-sm">No hay VINs vinculados a este producto</p>
                            <p class="text-xs mt-1">Agrega VINs para habilitar la búsqueda por VIN en el POS</p>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  GROUP 3: Relaciones y Referencias                        -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div v-if="['variants','references','alternatives'].includes(activeTab)" class="space-y-6">
                    <!-- Sub-tabs -->
                    <div class="flex gap-1 border-b border-gray-200 dark:border-border">
                        <button @click="activeTab = 'variants'"
                            :class="[activeTab === 'variants' ? 'border-blue-500 text-blue-600 dark:text-primary dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400']"
                            class="border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
                            Variantes
                        </button>
                        <button @click="activeTab = 'references'"
                            :class="[activeTab === 'references' ? 'border-blue-500 text-blue-600 dark:text-primary dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400']"
                            class="border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
                            Referencias OEM
                        </button>
                        <button @click="activeTab = 'alternatives'"
                            :class="[activeTab === 'alternatives' ? 'border-blue-500 text-blue-600 dark:text-primary dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400']"
                            class="border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
                            Alternativas
                        </button>
                    </div>

                    <div v-if="activeTab === 'variants'">
                        <VariantManager :product-id="props.productId" :category-id="currentProduct?.category_id ?? currentProduct?.category?.id" :sku-base="currentProduct?.sku_base || ''" />
                    </div>
                    <div v-if="activeTab === 'references'">
                        <OemReferenceManager :product-id="props.productId" />
                    </div>
                    <div v-if="activeTab === 'alternatives'">
                        <AlternativeManager :product-id="props.productId" />
                    </div>
                </div>

            </div>
        </div>
    </AppLayout>
</template>
