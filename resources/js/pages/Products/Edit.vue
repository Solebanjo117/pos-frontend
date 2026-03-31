<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import type { UpdateProductRequest } from '@/types/product'
import apiClient from '@/services/api/client'
import VariantManager from '@/components/Products/VariantManager.vue'
import OemReferenceManager from '@/components/Products/OemReferenceManager.vue'
import AlternativeManager from '@/components/Products/AlternativeManager.vue'
import PricingFormula from '@/components/Products/PricingFormula.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import { Plus, Key, Car, Globe } from 'lucide-vue-next'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
    sku_base: '',
    upc: '',
    alternate_code: '',
    product_line_id: undefined,
    name: '',
    description: '',
    status: 'active',
    is_universal: false,
})

const validationErrors = ref<Record<string, string[]>>({})
const successMessage = ref('')
const activeTab = ref('general')

// Category pricing info for variants
const categoryFormula = ref<string | null>(null)
const categoryAppliesItbm = ref<boolean>(false)
const categoryItbmPercent = ref<number | null>(null)
const categoryMargin = ref<number | null>(null)
const categoryDefaultCost = ref<number | null>(null)

// Read ?variant= query param (e.g. /products/1/edit?variant=11)
const variantId = computed(() => {
    const param = new URLSearchParams(window.location.search).get('variant')
    return param ? Number(param) : null
})

onMounted(async () => {
    await fetchProduct(props.productId)

    if (currentProduct.value) {
        // Populate form with existing data
            form.value = {
                sku_base: currentProduct.value.sku_base || '',
                upc: currentProduct.value.default_variant?.upc || '',
                alternate_code: (currentProduct.value as any).alternate_code || '',
                name: currentProduct.value.name,
                description: currentProduct.value.description || '',
                status: currentProduct.value.status,
                is_universal: currentProduct.value.is_universal ?? false,
                batch_tracking: currentProduct.value.batch_tracking,
            }
        
        // Load category pricing info for new variants
        const categoryId = currentProduct.value.category_id ?? (currentProduct.value.category as any)?.id
        if (categoryId) {
            try {
                const resp = await apiClient.get(`/categories/${categoryId}`)
                const cat = resp.data
                categoryFormula.value = cat.pricing_formula ?? null
                categoryAppliesItbm.value = cat.applies_itbm ?? false
                categoryItbmPercent.value = cat.itbm_percent ?? 7
                categoryMargin.value = cat.default_margin_percent ?? null
                categoryDefaultCost.value = cat.default_cost ?? null
            } catch {
                // Silently fail - variants will work without auto-pricing
            }
        }
    }
})


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

// ===== Vehicle Compatibility Management =====
interface CompatibleEngine {
    id: number
    compat_id: number  // ID of the compatibility record (for deletion)
    engine_code: string
    displacement?: string
    model?: { id: number; name: string; year_from?: number; year_to?: number; make?: { id: number; name: string }; generation?: string }
}

interface VehicleMake { id: number; name: string }
interface VehicleModelItem { id: number; name: string; year_from?: number; year_to?: number; generation?: string }
interface VehicleEngineItem { id: number; engine_code: string; displacement?: string }

const compatibleEngines = ref<CompatibleEngine[]>([])
const loadingCompat = ref(false)
const addingCompat = ref(false)

const vehicleMakes = ref<VehicleMake[]>([])
const vehicleModels = ref<VehicleModelItem[]>([])
const vehicleEnginesList = ref<VehicleEngineItem[]>([])

const selectedMakeId = ref<number | null>(null)
const selectedModelId = ref<number | null>(null)
// R39: Multi-select de motores
const selectedEngineIds = ref<number[]>([])

const loadingMakes = ref(false)
const loadingModelsV = ref(false)
const loadingEnginesV = ref(false)

const fetchCompatibleEngines = async () => {
    loadingCompat.value = true
    try {
        const res = await apiClient.get(`/products/${props.productId}/compatibility`)
        const compat = res.data.data ?? []
        compatibleEngines.value = compat.map((c: any) => ({
            id: c.engine?.id ?? c.engine_id,
            compat_id: c.id,  // the compatibility record ID
            engine_code: c.engine?.engine_code ?? 'N/A',
            displacement: c.engine?.displacement,
            model: c.engine?.model ? {
                id: c.engine.model.id,
                name: c.engine.model.name,
                year_from: c.engine.model.year_from,
                year_to: c.engine.model.year_to,
                generation: c.engine.model.generation,
                make: c.engine.model.make,
            } : undefined,
        }))
    } catch (e) {
        compatibleEngines.value = []
    } finally {
        loadingCompat.value = false
    }
}

const fetchVehicleMakes = async () => {
    loadingMakes.value = true
    try {
        const { data } = await apiClient.get('/vehicle-makes')
        vehicleMakes.value = data.data ?? data
    } catch { vehicleMakes.value = [] }
    finally { loadingMakes.value = false }
}

watch(selectedMakeId, async (makeId) => {
    vehicleModels.value = []; vehicleEnginesList.value = []
    selectedModelId.value = null; selectedEngineIds.value = []
    if (!makeId) return
    loadingModelsV.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-makes/${makeId}/models`)
        vehicleModels.value = data.data ?? data
    } catch { vehicleModels.value = [] }
    finally { loadingModelsV.value = false }
})

watch(selectedModelId, async (modelId) => {
    vehicleEnginesList.value = []; selectedEngineIds.value = []
    if (!modelId) return
    loadingEnginesV.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-models/${modelId}/engines`)
        vehicleEnginesList.value = data.data ?? data
    } catch { vehicleEnginesList.value = [] }
    finally { loadingEnginesV.value = false }
})

const makeSelectOptions = computed(() => vehicleMakes.value.map(m => ({ value: m.id, label: m.name })))
const modelSelectOptions = computed(() => vehicleModels.value.map(m => {
    const years = m.year_from ? `${m.year_from}-${m.year_to || '...'}` : ''
    const gen = m.generation ? `${m.generation}` : ''
    const parts = [years, gen].filter(Boolean)
    return { value: m.id, label: m.name, sublabel: parts.join(' - ') }
}))
const engineSelectOptions = computed(() => vehicleEnginesList.value.map(e => ({
    value: e.id, label: e.engine_code, sublabel: e.displacement || '',
})))

// R39: Agregar múltiples compatibilidades de una vez
const handleAddCompatibilities = async () => {
    if (selectedEngineIds.value.length === 0) return
    addingCompat.value = true
    try {
        // Agregar cada motor seleccionado que no esté ya en compatibilidad
        for (const engineId of selectedEngineIds.value) {
            if (compatibleEngines.value.some(e => e.id === engineId)) continue
            await apiClient.post('/products/compatibility', {
                product_id: props.productId,
                engine_id: engineId,
            })
        }
        await fetchCompatibleEngines()
        selectedEngineIds.value = []
    } catch (e: any) {
        console.error('Error adding compatibility', e)
    } finally {
        addingCompat.value = false
    }
}

const handleRemoveCompatibility = async (compatId: number) => {
    if (!confirm('¿Eliminar esta compatibilidad?')) return
    try {
        await apiClient.delete(`/products/compatibility/${compatId}`)
        compatibleEngines.value = compatibleEngines.value.filter(e => e.compat_id !== compatId)
    } catch (e) {
        console.error('Error removing compatibility', e)
    }
}

const toggleUniversalStatus = async () => {
    try {
        await apiClient.put(`/products/${props.productId}`, {
            is_universal: form.value.is_universal
        })
        // success is silent
    } catch (e: any) {
        console.error('Error updating universal status', e)
        // Reset if failed
        form.value.is_universal = !form.value.is_universal
    }
}

// === Inline Creation Modals (Vehicles) ===
const inlineModal = ref<'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | null>(null)
const inlineForm = ref<Record<string, any>>({})
const inlineProcessing = ref(false)
const inlineError = ref<string | null>(null)

const openInline = (type: typeof inlineModal.value) => {
    inlineModal.value = type
    inlineError.value = null
    inlineProcessing.value = false
    if (type === 'vehicleMake') inlineForm.value = { name: '' }
    else if (type === 'vehicleModel') inlineForm.value = { name: '', year_from: new Date().getFullYear(), year_to: new Date().getFullYear(), generation: '' }
    else if (type === 'vehicleEngine') inlineForm.value = { engine_code: '', displacement: '' }
}
const closeInline = () => { inlineModal.value = null }

const submitInline = async () => {
    inlineProcessing.value = true
    inlineError.value = null
    try {
        if (inlineModal.value === 'vehicleMake') {
            const { data } = await apiClient.post('/vehicle-makes', inlineForm.value)
            const newMake = data.data ?? data
            vehicleMakes.value.push(newMake)
            selectedMakeId.value = newMake.id
        } else if (inlineModal.value === 'vehicleModel') {
            const { data } = await apiClient.post('/vehicle-models', { ...inlineForm.value, make_id: selectedMakeId.value })
            const newModel = data.data ?? data
            vehicleModels.value.push(newModel)
            selectedModelId.value = newModel.id
        } else if (inlineModal.value === 'vehicleEngine') {
            const { data } = await apiClient.post('/vehicle-engines', { ...inlineForm.value, model_id: selectedModelId.value, fuel_type: 'N/A', aspiration: 'N/A' })
            const newEngine = data.data ?? data
            vehicleEnginesList.value.push(newEngine)
            // R39: Agregar el nuevo motor a la selección múltiple
            selectedEngineIds.value.push(newEngine.id)
        }
        closeInline()
    } catch (e: any) {
        inlineError.value = e.response?.data?.message || 'Error al crear'
    } finally { inlineProcessing.value = false }
}

onMounted(() => {
    fetchCompatibleEngines()
    fetchVehicleMakes()
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
                <!--  SECTION 1: Información General (always visible)           -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <form @submit.prevent="handleSubmit" class="space-y-6">

                <!-- Producto Base -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                    <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Producto Base</h2>
                    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                SKU Base <span class="text-gray-400 font-normal text-xs">(opcional)</span>
                            </label>
                            <input v-model="form.sku_base" type="text"
                                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                                placeholder="Ej: ALT-0012" />
                            <p v-if="validationErrors.sku_base" class="mt-1 text-sm text-red-600">{{ validationErrors.sku_base[0] }}</p>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Custom SKU</label>
                            <input v-model="form.upc" type="text"
                                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white" />
                        </div>

                        <!-- Código Alterno -->
                        <div>
                            <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Código Alterno</label>
                            <input v-model="(form as any).alternate_code" type="text"
                                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                                placeholder="Código alternativo de referencia" />
                            <p class="mt-1 text-xs text-gray-400">Código alterno para búsquedas o refs cruzadas</p>
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

                        <div class="col-span-1 md:col-span-2">
                            <label class="flex items-start gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-muted transition-colors">
                                <div class="flex items-center h-5 mt-0.5">
                                    <input v-model="form.is_universal" type="checkbox" class="h-5 w-5 rounded border-gray-300 text-blue-600" />
                                </div>
                                <div class="flex-1">
                                    <span class="block text-sm font-semibold text-gray-900 dark:text-white">Producto Universal (No requiere compatibilidad)</span>
                                    <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">Marca esta opción si el producto aplica para cualquier vehículo.</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Actions (Guardar) -->
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

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  SECTION 3: VINs (always visible)                         -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card border-l-4 border-teal-500">
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <Key class="w-5 h-5 text-teal-600" /> VINs Vinculados
                    </h2>
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
                        <Key class="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p class="text-sm">No hay VINs vinculados a este producto</p>
                        <p class="text-xs mt-1">Agrega VINs para habilitar la búsqueda por VIN en el POS</p>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  SECTION 4: Compatibilidad Vehicular (always visible)     -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card border-l-4 border-teal-500">
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <Car class="w-5 h-5 text-teal-600" /> Compatibilidad Vehicular
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Agrega los vehículos compatibles con este producto.</p>

                    <!-- Universal Toggle -->
                    <div class="mb-6 rounded-lg border-2 border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <div class="relative flex items-center">
                                <input type="checkbox" v-model="form.is_universal" @change="toggleUniversalStatus" class="sr-only peer">
                                <div class="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:bg-gray-700"></div>
                            </div>
                            <div>
                                <p class="font-medium text-indigo-900 dark:text-indigo-200 flex items-center gap-2"><Globe class="w-4 h-4" /> Compatibilidad Universal</p>
                                <p class="text-sm text-indigo-700/70 dark:text-indigo-400/70">Marcar si el producto es genérico y aplica a cualquier vehículo o marca.</p>
                            </div>
                        </label>
                    </div>

                    <!-- Specific Vehicle Assignment -->
                    <div v-show="!form.is_universal" class="space-y-6">
                        <!-- Fila 1: Marca y Modelo -->
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 bg-gray-50 dark:bg-muted/30 p-4 rounded-lg border border-gray-100 dark:border-border/50">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Marca Vehículo</label>
                                <div class="flex gap-1">
                                    <SearchableSelect
                                        :options="makeSelectOptions"
                                        :model-value="selectedMakeId"
                                        @update:model-value="v => selectedMakeId = v as number | null"
                                        placeholder="-- Marca --"
                                        :loading="loadingMakes"
                                    />
                                    <button type="button" @click="openInline('vehicleMake')"
                                        class="flex-shrink-0 rounded-md border border-gray-300 dark:border-border bg-white dark:bg-muted p-2 text-gray-500 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 transition"
                                        title="Crear nueva marca">
                                        <Plus class="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo</label>
                                <div class="flex gap-1">
                                    <SearchableSelect
                                        :options="modelSelectOptions"
                                        :model-value="selectedModelId"
                                        @update:model-value="v => selectedModelId = v as number | null"
                                        placeholder="-- Modelo --"
                                        :disabled="!selectedMakeId"
                                        :loading="loadingModelsV"
                                    />
                                    <button type="button" @click="openInline('vehicleModel')"
                                        :disabled="!selectedMakeId"
                                        class="flex-shrink-0 rounded-md border border-gray-300 dark:border-border bg-white dark:bg-muted p-2 text-gray-500 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Crear nuevo modelo">
                                        <Plus class="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <!-- R39: Fila 2: Multi-select de motores con checkboxes -->
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-4 items-end bg-gray-50 dark:bg-muted/30 p-4 rounded-lg border border-gray-100 dark:border-border/50">
                            <div class="md:col-span-3">
                                <div class="flex items-center justify-between mb-1">
                                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                        Motores
                                        <span v-if="selectedEngineIds.length > 0" class="ml-1 text-teal-600">({{ selectedEngineIds.length }} seleccionados)</span>
                                    </label>
                                    <button type="button" @click="openInline('vehicleEngine')"
                                        :disabled="!selectedModelId"
                                        class="text-xs text-blue-500 hover:underline flex items-center gap-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Crear nuevo motor">
                                        <Plus class="h-3 w-3" />
                                    </button>
                                </div>
                                <div v-if="loadingEnginesV" class="text-center py-4 text-gray-400 text-sm">
                                    Cargando motores...
                                </div>
                                <div v-else-if="!selectedModelId" class="text-center py-4 text-gray-400 text-sm border rounded-md dark:border-border">
                                    Selecciona un modelo primero
                                </div>
                                <div v-else-if="vehicleEnginesList.length === 0" class="text-center py-4 text-gray-400 text-sm border rounded-md dark:border-border">
                                    No hay motores disponibles
                                </div>
                                <div v-else class="max-h-40 overflow-y-auto border rounded-md dark:border-border bg-white dark:bg-muted">
                                    <label
                                        v-for="engine in vehicleEnginesList"
                                        :key="engine.id"
                                        class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-background/50 cursor-pointer border-b last:border-b-0 dark:border-border"
                                        :class="{ 'bg-teal-50 dark:bg-teal-900/20': selectedEngineIds.includes(engine.id), 'opacity-50': compatibleEngines.some(e => e.id === engine.id) }"
                                    >
                                        <input
                                            type="checkbox"
                                            :value="engine.id"
                                            v-model="selectedEngineIds"
                                            :disabled="compatibleEngines.some(e => e.id === engine.id)"
                                            class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span class="font-mono text-sm text-gray-900 dark:text-white">{{ engine.engine_code }}</span>
                                        <span v-if="engine.displacement" class="text-xs text-gray-500">{{ engine.displacement }}</span>
                                        <span v-if="compatibleEngines.some(e => e.id === engine.id)" class="ml-auto text-xs text-teal-600">✓ Agregado</span>
                                    </label>
                                </div>
                            </div>
                            <div class="flex items-end">
                                <button type="button" @click="handleAddCompatibilities" :disabled="selectedEngineIds.length === 0 || addingCompat"
                                    class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40 transition-colors">
                                    {{ addingCompat ? 'Agregando...' : `+ Agregar ${selectedEngineIds.length > 0 ? `(${selectedEngineIds.length})` : ''}` }}
                                </button>
                            </div>
                        </div>

                        <div v-if="loadingCompat" class="text-center py-8">
                            <div class="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent"></div>
                        </div>
                        <div v-else-if="compatibleEngines.length > 0" class="overflow-hidden rounded-lg border border-gray-200 dark:border-border">
                            <table class="w-full text-left text-sm">
                                <thead class="bg-gray-50 dark:bg-background/50">
                                    <tr>
                                        <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Marca</th>
                                        <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Modelo</th>
                                        <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Años</th>
                                        <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Motor</th>
                                        <th class="w-10 px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                                    <tr v-for="eng in compatibleEngines" :key="eng.id" class="bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-muted/30 transition-colors">
                                        <td class="px-4 py-2 text-gray-900 dark:text-white font-medium">{{ eng.model?.make?.name ?? 'N/A' }}</td>
                                        <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ eng.model?.name ?? 'N/A' }}{{ eng.model?.generation ? ` - ${eng.model.generation}` : '' }}</td>
                                        <td class="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{{ eng.model?.year_from ?? '' }}{{ eng.model?.year_to ? '–' + eng.model.year_to : '' }}</td>
                                        <td class="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{{ eng.engine_code }}<span v-if="eng.displacement" class="ml-1 text-xs text-gray-400">({{ eng.displacement }})</span></td>
                                        <td class="px-2 py-2 text-center">
                                            <button type="button" @click="handleRemoveCompatibility(eng.compat_id)" class="text-red-400 hover:text-red-600 transition" title="Eliminar">
                                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="text-center py-10 text-gray-400">
                            <Car class="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p class="text-sm">No hay vehículos compatibles asignados</p>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  SECTION 5: Variantes (always visible)                    -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div>
                    <VariantManager 
                        :product-id="props.productId" 
                        :category-id="currentProduct?.category_id ?? currentProduct?.category?.id" 
                        :sku-base="currentProduct?.sku_base || ''" 
                        :product-name="currentProduct?.name || ''"
                        :category-formula="categoryFormula"
                        :category-applies-itbm="categoryAppliesItbm"
                        :category-itbm-percent="categoryItbmPercent"
                        :category-margin="categoryMargin"
                        :category-default-cost="categoryDefaultCost"
                    />
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  SECTION 6: Referencias OEM + Alternativas (always visible)-->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div>
                    <OemReferenceManager :product-id="props.productId" />
                </div>
                <div>
                    <AlternativeManager :product-id="props.productId" />
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!--  SECTION 7: Fotos del Producto (always visible)           -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
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
        </div>
    </AppLayout>

    <!-- ═══════ Inline Creation Modals ═══════ -->
    <Dialog :open="inlineModal !== null" @update:open="v => { if (!v) closeInline() }">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>
                    <span v-if="inlineModal === 'vehicleMake'">Nueva Marca de Vehículo</span>
                    <span v-else-if="inlineModal === 'vehicleModel'">Nuevo Modelo de Vehículo</span>
                    <span v-else-if="inlineModal === 'vehicleEngine'">Nuevo Motor</span>
                </DialogTitle>
            </DialogHeader>

            <div class="space-y-4 pt-2">

                <!-- Error -->
                <p v-if="inlineError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ inlineError }}</p>

                <!-- Make form -->
                <template v-if="inlineModal === 'vehicleMake'">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la Marca <span class="text-red-500">*</span></label>
                        <input v-model="inlineForm.name" type="text" @keyup.enter="submitInline"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: Toyota, Ford, Kia..." />
                    </div>
                </template>

                <!-- Model form -->
                <template v-else-if="inlineModal === 'vehicleModel'">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Modelo <span class="text-red-500">*</span></label>
                        <input v-model="inlineForm.name" type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: Corolla, Civic, Tucson..." />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Año Desde <span class="text-red-500">*</span></label>
                            <input v-model.number="inlineForm.year_from" type="number" min="1900" :max="new Date().getFullYear() + 2"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Año Hasta <span class="text-red-500">*</span></label>
                            <input v-model.number="inlineForm.year_to" type="number" min="1900" :max="new Date().getFullYear() + 2"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Generación <span class="text-xs text-gray-400">(opcional)</span></label>
                        <input v-model="inlineForm.generation" type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: E170, W204, MK4..." />
                    </div>
                </template>

                <!-- Engine form -->
                <template v-else-if="inlineModal === 'vehicleEngine'">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código de Motor <span class="text-red-500">*</span></label>
                        <input v-model="inlineForm.engine_code" type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: 1NZ-FE, K24A, EJ257..." />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cilindrada <span class="text-xs text-gray-400">(opcional)</span></label>
                        <input v-model="inlineForm.displacement" type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: 1.8L, 2.4L, 2000cc..." />
                    </div>
                </template>

                <!-- Actions -->
                <div class="flex justify-end gap-3 pt-2">
                    <button type="button" @click="closeInline"
                        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-background">
                        Cancelar
                    </button>
                    <button type="button" @click="submitInline" :disabled="inlineProcessing"
                        class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50">
                        {{ inlineProcessing ? 'Creando...' : 'Crear' }}
                    </button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
