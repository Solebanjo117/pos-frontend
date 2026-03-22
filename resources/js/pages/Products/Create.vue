<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import { useToast } from '@/composables/useToast'
import type { CreateProductRequest } from '@/types/product'
import type { Category } from '@/types/category'
import type { Brand } from '@/types/brand'
import apiClient from '@/services/api/client'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import PricingFormula from '@/components/Products/PricingFormula.vue'
import VariantManager from '@/components/Products/VariantManager.vue'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, X, Globe, Wrench } from 'lucide-vue-next'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventario', href: '/inventory' },
    { title: 'Productos', href: '/products' },
    { title: 'Crear Producto', href: '/products/create' },
]

const { createProduct, loading, error } = useProducts()
const toast = useToast()

const form = ref<CreateProductRequest>({
    sku_base: '',
    name: '',
    description: '',
    product_line_id: undefined,
    status: 'active',
    alternate_code: '',
    pricing_formula: '',
    brand_id: undefined,
    sku: '',
    upc: '',
    pricing: {
        base_price: 0,
        msrp: 0,
        cost: 0,
        tax_rate: 7,
        tax_type: 'custom',
        max_discount_percentage: 0,
    },
    initial_inventory: [
        {
            warehouse_id: undefined,
            stock_available: 0,
            reorder_point: 5,
            reorder_quantity: 20,
        },
    ],
})

const custom_total = ref<number | null>(null)

const computed_total = computed(() => {
    if (custom_total.value !== null && custom_total.value !== undefined) {
        return custom_total.value
    }
    const p = form.value.pricing
    const base = Number(p.base_price) || 0
    const rate = Number(p.tax_rate) || 0
    return Number((base * (1 + rate / 100)).toFixed(2))
})

const onFormulaTotalChange = (newTotal: number) => {
    custom_total.value = newTotal
}

watch(() => form.value.pricing.base_price, () => { custom_total.value = null })
watch(() => form.value.pricing.tax_rate, () => { custom_total.value = null })
watch(() => form.value.pricing_formula, (v) => { if(!v) custom_total.value = null })

const validationErrors = ref<Record<string, string[]>>({})
const successMessage = ref('')
const categories = ref<Category[]>([])
const brands = ref<Brand[]>([])
const loadingCategories = ref(false)
const loadingBrands = ref(false)

const variantAttributes = ref<{ name: string; value: string; unit: string; required: boolean }[]>([])

const skuPreview = ref('')
const loadingSkuPreview = ref(false)

const fetchSkuPreview = async (categoryId: number | undefined) => {
    if (!categoryId) { skuPreview.value = ''; return }
    loadingSkuPreview.value = true
    try {
        const { data } = await apiClient.get('/products/next-sku', { params: { category_id: categoryId } })
        skuPreview.value = data.sku || ''
    } catch { skuPreview.value = '' }
    finally { loadingSkuPreview.value = false }
}

const autoVariantSku = computed(() => {
    const base = form.value.sku_base || skuPreview.value
    if (!base) return ''
    const brand = brands.value.find(b => b.id === form.value.brand_id)
    if (!brand) return base
    const brandCode = brand.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
    return `${base}-${brandCode}`
})

const customSkuManuallyEdited = ref(false)
watch(
    [() => form.value.sku_base, skuPreview],
    () => {
        if (!customSkuManuallyEdited.value) {
            form.value.upc = form.value.sku_base || skuPreview.value || ''
        }
    }
)
const onCustomSkuInput = () => {
    customSkuManuallyEdited.value = true
}

const nameManuallyEdited = ref(false)
const onNameInput = () => { nameManuallyEdited.value = true }

const addedEngines = ref<{ engine_id: number; make: string; model: string; engine: string }[]>([])
const addedVins = ref<string[]>([])
const addedRefs = ref<string[]>([])

const namePreview = computed(() => {
    const parts: string[] = []
    const catId = (form.value as any).category_id
    if (catId) {
        const cat = categories.value.find(c => c.id === catId)
        if (cat) parts.push(cat.name)
    }
    let name = parts.join(' ') || 'Producto sin nombre'
    const vehicleLabels = [...new Set(addedEngines.value.map(e => `${e.make} ${e.model}`))]
    if (vehicleLabels.length > 0) {
        const displayed = vehicleLabels.slice(0, 3).join(', ')
        const suffix = vehicleLabels.length > 3 ? ' y más' : ''
        name += ' - ' + displayed + suffix
    }
    if (addedVins.value.length > 0 && vehicleLabels.length === 0) {
        name += ` - ${addedVins.value.length} VIN${addedVins.value.length > 1 ? 's' : ''}`
    }
    return name
})

watch(namePreview, (newVal) => {
    if (!nameManuallyEdited.value && newVal !== 'Producto sin nombre') {
        form.value.name = newVal
    }
})

const skuBaseManuallyEdited = ref(false)
const onSkuBaseInput = () => { skuBaseManuallyEdited.value = true }

watch(skuPreview, (newVal) => {
    if (!skuBaseManuallyEdited.value && newVal) {
        form.value.sku_base = newVal
    }
})

watch(
    () => (form.value as any).category_id,
    async (newCategoryId: number | undefined) => {
        fetchSkuPreview(newCategoryId)
        if (!newCategoryId) { variantAttributes.value = []; return }
        try {
            const resp = await apiClient.get(`/categories/${newCategoryId}`)
            const cat = resp.data
            if (cat.default_attributes && Array.isArray(cat.default_attributes)) {
                variantAttributes.value = cat.default_attributes.map((attr: any) => ({
                    name: attr.name, value: '', unit: attr.unit || '', required: attr.required || false,
                }))
            } else { variantAttributes.value = [] }
        } catch { variantAttributes.value = [] }
    }
)

watch(
    [() => form.value.brand_id, () => form.value.sku_base, skuPreview],
    () => {
        if (!form.value.sku || form.value.sku === previousAutoSku.value) {
            form.value.sku = autoVariantSku.value
            previousAutoSku.value = autoVariantSku.value
        }
    }
)
const previousAutoSku = ref('')

interface VehicleMake { id: number; name: string }
interface VehicleModelItem { id: number; name: string; year_from?: number; year_to?: number; generation?: string }
interface VehicleEngineItem { id: number; engine_code: string; displacement?: string }

const vehicleMakes = ref<VehicleMake[]>([])
const vehicleModels = ref<VehicleModelItem[]>([])
const vehicleEngines = ref<VehicleEngineItem[]>([])

const selectedMakeId = ref<number | null>(null)
const selectedModelId = ref<number | null>(null)
const selectedEngineId = ref<number | null>(null)
const isUniversal = ref(false)

const loadingMakes = ref(false)
const loadingModelsV = ref(false)
const loadingEnginesV = ref(false)

const fetchMakes = async () => {
    loadingMakes.value = true
    try {
        const { data } = await apiClient.get('/vehicle-makes')
        vehicleMakes.value = data.data ?? data
    } catch { vehicleMakes.value = [] }
    finally { loadingMakes.value = false }
}

watch(selectedMakeId, async (makeId) => {
    vehicleModels.value = []; vehicleEngines.value = []
    selectedModelId.value = null; selectedEngineId.value = null
    if (!makeId) return
    loadingModelsV.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-makes/${makeId}/models`)
        vehicleModels.value = data.data ?? data
    } catch { vehicleModels.value = [] }
    finally { loadingModelsV.value = false }
})

watch(selectedModelId, async (modelId) => {
    vehicleEngines.value = []; selectedEngineId.value = null
    if (!modelId) return
    loadingEnginesV.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-models/${modelId}/engines`)
        vehicleEngines.value = data.data ?? data
    } catch { vehicleEngines.value = [] }
    finally { loadingEnginesV.value = false }
})

const toggleUniversal = () => {
    isUniversal.value = !isUniversal.value
    if (isUniversal.value) {
        addedEngines.value = []
        selectedMakeId.value = null
    }
}

const addEngine = () => {
    if (!selectedEngineId.value) return
    if (addedEngines.value.some(e => e.engine_id === selectedEngineId.value)) return
    const make = vehicleMakes.value.find(m => m.id === selectedMakeId.value)
    const model = vehicleModels.value.find(m => m.id === selectedModelId.value)
    const engine = vehicleEngines.value.find(e => e.id === selectedEngineId.value)
    const modelNameFull = model ? `${model.name}${model.generation ? ` - ${model.generation}` : ''}` : ''
    addedEngines.value.push({
        engine_id: selectedEngineId.value,
        make: make?.name || '', model: modelNameFull, engine: engine?.engine_code || '',
    })
    selectedEngineId.value = null
}
const removeEngine = (idx: number) => addedEngines.value.splice(idx, 1)

const vinInput = ref('')
const addVin = () => {
    const v = vinInput.value.trim().toUpperCase()
    if (!v || addedVins.value.includes(v)) return
    addedVins.value.push(v); vinInput.value = ''
}
const removeVin = (idx: number) => addedVins.value.splice(idx, 1)

const refInput = ref('')
const addRef = () => {
    const r = refInput.value.trim()
    if (!r || addedRefs.value.includes(r)) return
    addedRefs.value.push(r); refInput.value = ''
}
const removeRef = (idx: number) => addedRefs.value.splice(idx, 1)

const inlineModal = ref<'category' | 'brand' | 'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | null>(null)
const inlineForm = ref<Record<string, any>>({})
const inlineProcessing = ref(false)
const inlineError = ref<string | null>(null)

const openInline = (type: typeof inlineModal.value) => {
    inlineModal.value = type
    inlineError.value = null
    inlineProcessing.value = false
    if (type === 'category') inlineForm.value = { name: '', parent_id: null }
    else if (type === 'brand') inlineForm.value = { name: '' }
    else if (type === 'vehicleMake') inlineForm.value = { name: '' }
    else if (type === 'vehicleModel') inlineForm.value = { name: '', year_from: new Date().getFullYear(), year_to: new Date().getFullYear() }
    else if (type === 'vehicleEngine') inlineForm.value = { engine_code: '', displacement: '' }
}
const closeInline = () => { inlineModal.value = null }

const submitInline = async () => {
    inlineProcessing.value = true
    inlineError.value = null
    try {
        if (inlineModal.value === 'category') {
            const { data } = await apiClient.post('/categories', inlineForm.value)
            categories.value.push(data.data ?? data)
            ;(form.value as any).category_id = (data.data ?? data).id
        } else if (inlineModal.value === 'brand') {
            const { data } = await apiClient.post('/brands', inlineForm.value)
            const newBrand = data.data ?? data
            brands.value.push(newBrand)
            form.value.brand_id = newBrand.id
        } else if (inlineModal.value === 'vehicleMake') {
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
            vehicleEngines.value.push(newEngine)
            selectedEngineId.value = newEngine.id
        }
        closeInline()
    } catch (e: any) {
        inlineError.value = e.response?.data?.message || 'Error al crear'
    } finally { inlineProcessing.value = false }
}

const categoryOptions = computed(() => categories.value.filter(c => !c.parent_id).flatMap(parent => [
    { value: parent.id, label: parent.name, sublabel: '' },
    ...categories.value.filter(c => c.parent_id === parent.id).map(child => ({
        value: child.id, label: `↳ ${child.name}`, sublabel: parent.name,
    })),
]))
const brandOptions = computed(() => brands.value.map(b => ({ value: b.id, label: b.name })))
const makeOptions = computed(() => vehicleMakes.value.map(m => ({ value: m.id, label: m.name })))
const modelOptions = computed(() => vehicleModels.value.map(m => {
    const years = m.year_from ? `${m.year_from}-${m.year_to || '...'}` : ''
    const gen = m.generation ? `${m.generation}` : ''
    const parts = [years, gen].filter(Boolean)
    return { value: m.id, label: m.name, sublabel: parts.join(' - ') }
}))
const engineOptions = computed(() => vehicleEngines.value.map(e => ({
    value: e.id, label: e.engine_code, sublabel: e.displacement || '',
})))

onMounted(async () => {
    loadingCategories.value = true
    try {
        const response = await apiClient.get('/categories')
        categories.value = response.data
    } catch (e) { console.error('Error loading categories:', e) }
    finally { loadingCategories.value = false }

    loadingBrands.value = true
    try {
        const response = await apiClient.get('/brands/all')
        brands.value = response.data.data
        if (brands.value.length > 0) {
            form.value.brand_id = brands.value[0].id
        }
    } catch (e) { console.error('Error loading brands:', e) }
    finally { loadingBrands.value = false }

    // Load warehouses and set first one as default
    try {
        const response = await apiClient.get('/warehouses')
        const warehouses = response.data.data || response.data
        if (Array.isArray(warehouses) && warehouses.length > 0 && form.value.initial_inventory && form.value.initial_inventory.length > 0) {
            form.value.initial_inventory[0].warehouse_id = warehouses[0].id
        }
    } catch (e) { console.error('Error loading warehouses:', e) }

    fetchMakes()
})

// Draft variants from VariantManager in draft mode
const pendingVariants = ref<any[]>([])
const onDraftVariantsChanged = (variants: any[]) => {
    pendingVariants.value = variants
}

const handleSubmit = async () => {
    validationErrors.value = {}
    successMessage.value = ''
    
    // Validate required fields
    if (!form.value.brand_id) {
        toast.error('Debes seleccionar una marca')
        return
    }
    if (!form.value.initial_inventory?.[0]?.warehouse_id) {
        toast.error('Debes seleccionar un almacén')
        return
    }
    
    try {
        const payload = {
            ...form.value,
            sku: form.value.sku || autoVariantSku.value,
            attributes: variantAttributes.value
                .filter(a => a.value.trim())
                .map(a => ({ name: a.name, value: a.value, unit: a.unit })),
            vehicle_compatibility: addedEngines.value.map(e => e.engine_id),
            is_universal: isUniversal.value,
            vins: addedVins.value,
            oem_references: addedRefs.value,
        }
        const result = await createProduct(payload)
        const productId = (result as any)?.data?.id ?? (result as any)?.id

        // Create pending draft variants sequentially
        if (productId && pendingVariants.value.length > 0) {
            const failedVariants: string[] = []
            for (const variant of pendingVariants.value) {
                try {
                    await apiClient.post(`/products/${productId}/variants`, {
                        brand_id: variant.brand_id,
                        sku: variant.sku,
                        upc: variant.upc || null,
                        status: variant.status || 'active',
                        pricing: variant.pricing,
                        initial_inventory: variant.initial_inventory,
                        attributes: variant.attributes || [],
                    })
                } catch {
                    failedVariants.push(variant.brand?.name || variant.sku || 'desconocida')
                }
            }
            if (failedVariants.length > 0) {
                toast.error(`Producto creado, pero fallaron variantes: ${failedVariants.join(', ')}`)
            }
        }

        successMessage.value = 'Producto creado exitosamente'
        toast.success('Producto creado exitosamente')
        setTimeout(() => { window.location.href = '/products' }, 1000)
    } catch (err: any) {
        if (err.response?.data?.errors) {
            validationErrors.value = err.response.data.errors
            toast.error('Corrige los errores en el formulario')
        } else {
            toast.error(err.response?.data?.message || 'Error al crear el producto')
        }
    }
}

const cancel = () => { window.location.href = '/products' }
const getError = (field: string) => validationErrors.value[field]?.[0] || ''
</script>

<template>
    <Head title="Crear Producto" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-5xl space-y-4 p-6">

            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Crear Nuevo Producto</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Completa los datos del producto base y agrega variantes</p>
                </div>
                <div class="flex gap-3">
                    <button type="button" @click="cancel"
                        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-white">
                        Cancelar
                    </button>
                    <button type="button" @click="handleSubmit" :disabled="loading"
                        class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50">
                        {{ loading ? 'Creando...' : 'Crear Producto' }}
                    </button>
                </div>
            </div>

            <div v-if="error" class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{{ error }}</div>

        <form @submit.prevent="handleSubmit" class="space-y-4">

            <!-- ══ Datos del Producto ══ -->
            <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border space-y-4">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500">Datos del Producto</h2>

                <!-- Nombre + Categoría en 2 cols -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Producto</label>
                        <input v-model="form.name" type="text" @input="onNameInput"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Se autogenera con Categoría + Vehículos..." />
                        <div v-if="!form.name && namePreview" class="mt-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
                            <p class="text-xs text-amber-600 dark:text-amber-400">Preview: <span class="font-semibold">{{ namePreview }}</span></p>
                        </div>
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
                            <button type="button" @click="openInline('category')" class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                                <Plus class="h-3 w-3" /> Crear
                            </button>
                        </div>
                        <SearchableSelect
                            :options="categoryOptions"
                            :model-value="(form as any).category_id ?? null"
                            @update:model-value="v => (form as any).category_id = v"
                            placeholder="-- Selecciona categoría --"
                            :loading="loadingCategories"
                        />
                    </div>
                </div>

                <!-- SKU Base + Código Alterno en 2 cols -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">SKU Base <span class="text-gray-400 font-normal text-xs">(opcional)</span></label>
                        <input v-model="form.sku_base" type="text" @input="onSkuBaseInput"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Autogenerar al guardar" />
                        <p v-if="skuPreview && !form.sku_base" class="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                            Se generará: <span class="font-mono font-bold">{{ skuPreview }}</span>
                        </p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Código Alterno</label>
                        <input v-model="form.alternate_code" type="text"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Referencia cruzada opcional" />
                    </div>
                </div>

                <!-- Notas -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas internas</label>
                    <textarea v-model="form.description" rows="2"
                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white resize-none"
                        placeholder="Notas internas del producto..."></textarea>
                </div>

                <!-- Especificaciones técnicas de categoría (si aplica) -->
                <div v-if="variantAttributes.length > 0" class="pt-3 border-t border-gray-100 dark:border-border">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                        <Wrench class="w-3 h-3" /> Especificaciones Técnicas
                    </label>
                    <div class="grid grid-cols-2 gap-3">
                        <div v-for="(attr, index) in variantAttributes" :key="index">
                            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                {{ attr.name }} <span v-if="attr.unit" class="text-gray-400">({{ attr.unit }})</span>
                                <span v-if="attr.required" class="text-red-500">*</span>
                            </label>
                            <input v-model="attr.value" type="text" :required="attr.required"
                                class="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white"
                                :placeholder="`${attr.name}...`" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- ══ Compatibilidad Vehicular (colapsable) ══ -->
            <div class="rounded-xl bg-white shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-teal-500">
                <button type="button" @click="(form as any)._showVehicle = !(form as any)._showVehicle"
                    class="w-full flex items-center justify-between px-5 py-4 text-left">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">Compatibilidad Vehicular</span>
                        <span v-if="addedEngines.length > 0 || isUniversal" class="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                            {{ isUniversal ? 'Universal' : `${addedEngines.length} motor(es)` }}
                        </span>
                    </div>
                    <span class="text-xs text-gray-400">{{ (form as any)._showVehicle ? '▲ Ocultar' : '▼ Expandir' }}</span>
                </button>

                <div v-show="(form as any)._showVehicle" class="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-border pt-4">

                    <button type="button" @click="toggleUniversal"
                        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
                        :class="isUniversal ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' : 'border-gray-300 dark:border-border text-gray-600 dark:text-gray-400 hover:border-teal-400'">
                        <Globe class="h-4 w-4" />
                        {{ isUniversal ? '✓ Compatible con TODOS los vehículos' : 'Marcar como Universal (TODOS)' }}
                    </button>

                    <div v-if="!isUniversal">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Marca Vehículo</label>
                                    <button type="button" @click="openInline('vehicleMake')" class="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                                        <Plus class="h-3 w-3" />
                                    </button>
                                </div>
                                <SearchableSelect :options="makeOptions" :model-value="selectedMakeId"
                                    @update:model-value="v => selectedMakeId = v as number | null"
                                    placeholder="Marca" :loading="loadingMakes" />
                            </div>
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Modelo</label>
                                    <button v-if="selectedMakeId" type="button" @click="openInline('vehicleModel')" class="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                                        <Plus class="h-3 w-3" />
                                    </button>
                                </div>
                                <SearchableSelect :options="modelOptions" :model-value="selectedModelId"
                                    @update:model-value="v => selectedModelId = v as number | null"
                                    placeholder="Modelo" :disabled="!selectedMakeId" :loading="loadingModelsV" />
                            </div>
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Motor</label>
                                    <button v-if="selectedModelId" type="button" @click="openInline('vehicleEngine')" class="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                                        <Plus class="h-3 w-3" />
                                    </button>
                                </div>
                                <SearchableSelect :options="engineOptions" :model-value="selectedEngineId"
                                    @update:model-value="v => selectedEngineId = v as number | null"
                                    placeholder="Motor" :disabled="!selectedModelId" :loading="loadingEnginesV" />
                            </div>
                            <div class="flex items-end">
                                <button type="button" @click="addEngine" :disabled="!selectedEngineId"
                                    class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40">
                                    + Agregar
                                </button>
                            </div>
                        </div>

                        <div v-if="addedEngines.length > 0" class="overflow-hidden rounded-lg border border-gray-200 dark:border-border">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-gray-50 dark:bg-background/50">
                                    <tr>
                                        <th class="px-3 py-2 font-semibold text-gray-500 uppercase">Marca</th>
                                        <th class="px-3 py-2 font-semibold text-gray-500 uppercase">Modelo</th>
                                        <th class="px-3 py-2 font-semibold text-gray-500 uppercase">Motor</th>
                                        <th class="w-8 px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                                    <tr v-for="(eng, idx) in addedEngines" :key="eng.engine_id" class="bg-white dark:bg-card">
                                        <td class="px-3 py-2 text-gray-900 dark:text-white">{{ eng.make }}</td>
                                        <td class="px-3 py-2 text-gray-700 dark:text-gray-300">{{ eng.model }}</td>
                                        <td class="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{{ eng.engine }}</td>
                                        <td class="px-2 py-2 text-center">
                                            <button type="button" @click="removeEngine(idx)" class="text-red-400 hover:text-red-600">✕</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- VINs + Referencias en 2 cols -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-white mb-1">VINs del producto</label>
                            <div class="flex gap-2 mb-2">
                                <input v-model="vinInput" type="text" @keydown.enter.prevent="addVin"
                                    class="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white font-mono uppercase"
                                    placeholder="VIN y Enter..." />
                                <button type="button" @click="addVin" :disabled="!vinInput.trim()"
                                    class="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40">
                                    +
                                </button>
                            </div>
                            <div v-if="addedVins.length > 0" class="flex flex-wrap gap-1.5">
                                <span v-for="(vin, idx) in addedVins" :key="vin"
                                    class="inline-flex items-center gap-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 px-2 py-0.5 text-xs font-mono">
                                    {{ vin }}
                                    <button type="button" @click="removeVin(idx)" class="text-teal-600 hover:text-red-500">&times;</button>
                                </span>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-white mb-1">Referencias Cruzadas (OEM)</label>
                            <div class="flex gap-2 mb-2">
                                <input v-model="refInput" type="text" @keydown.enter.prevent="addRef"
                                    class="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white font-mono"
                                    placeholder="Bosch B123, OEM... y Enter" />
                                <button type="button" @click="addRef" :disabled="!refInput.trim()"
                                    class="rounded-md bg-indigo-600 dark:bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
                                    +
                                </button>
                            </div>
                            <div v-if="addedRefs.length > 0" class="flex flex-wrap gap-1.5">
                                <span v-for="(ref, idx) in addedRefs" :key="ref"
                                    class="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 text-xs font-mono">
                                    {{ ref }}
                                    <button type="button" @click="removeRef(idx)" class="text-indigo-600 hover:text-red-500">&times;</button>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ══ Variantes del Producto (Opcional) ══ -->
            <div class="rounded-xl bg-white shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-indigo-500">
                <div class="px-5 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
                                Variantes del Producto
                                <span class="text-gray-400 font-normal text-xs">(opcional)</span>
                                <span v-if="pendingVariants.length > 0" class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    {{ pendingVariants.length }} pendiente{{ pendingVariants.length > 1 ? 's' : '' }}
                                </span>
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Agrega variantes adicionales con su propio precio, marca y SKU. Se guardarán junto con el producto.</p>
                        </div>
                    </div>
                </div>
                <div class="px-5 pb-5">
                    <VariantManager
                        :category-id="form.category_id"
                        :sku-base="form.sku_base || undefined"
                        :product-name="form.name"
                        :default-variant-attributes="variantAttributes"
                        @draft-variants-changed="onDraftVariantsChanged"
                    />
                </div>
            </div>

        </form>
    </div>

    <!-- Inline Creation Modal -->
    <Dialog :open="inlineModal !== null" @update:open="v => { if (!v) closeInline() }">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>
                    {{ inlineModal === 'category' ? 'Nueva Categoría' :
                       inlineModal === 'brand' ? 'Nueva Marca de Artículo' :
                       inlineModal === 'vehicleMake' ? 'Nueva Marca Vehicular' :
                       inlineModal === 'vehicleModel' ? 'Nuevo Modelo' :
                       inlineModal === 'vehicleEngine' ? 'Nuevo Motor' : '' }}
                </DialogTitle>
            </DialogHeader>
            <form @submit.prevent="submitInline" class="space-y-4 py-2">
                <template v-if="inlineModal === 'category'">
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <Label>Nombre de la Categoría <span class="text-red-500">*</span></Label>
                            <Input v-model="inlineForm.name" required placeholder="Ej: Filtros, Frenos" />
                        </div>
                        <div class="space-y-2">
                            <Label>Categoría Padre (Opcional)</Label>
                            <SearchableSelect
                                :options="categoryOptions"
                                :model-value="inlineForm.parent_id"
                                @update:model-value="v => inlineForm.parent_id = v as number | null"
                                placeholder="-- Selecciona categoría padre --"
                            />
                        </div>
                    </div>
                </template>
                <template v-if="inlineModal === 'brand'">
                    <div class="space-y-2">
                        <Label>Nombre de la Marca <span class="text-red-500">*</span></Label>
                        <Input v-model="inlineForm.name" required placeholder="Ej: KYB, Bosch, Monroe" />
                    </div>
                </template>
                <template v-if="inlineModal === 'vehicleMake'">
                    <div class="space-y-2">
                        <Label>Nombre de la Marca <span class="text-red-500">*</span></Label>
                        <Input v-model="inlineForm.name" required placeholder="Ej: Toyota, Honda, Ford" />
                    </div>
                </template>
                <template v-if="inlineModal === 'vehicleModel'">
                    <div class="space-y-2">
                        <Label>Nombre del Modelo <span class="text-red-500">*</span></Label>
                        <Input v-model="inlineForm.name" required placeholder="Ej: Corolla, Civic" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Año Desde</Label>
                            <Input v-model.number="inlineForm.year_from" type="number" placeholder="2005" />
                        </div>
                        <div class="space-y-2">
                            <Label>Año Hasta</Label>
                            <Input v-model.number="inlineForm.year_to" type="number" placeholder="2024" />
                        </div>
                    </div>
                </template>
                <template v-if="inlineModal === 'vehicleEngine'">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Motor <span class="text-red-500">*</span></Label>
                            <Input v-model="inlineForm.engine_code" required placeholder="Ej: 2AZ-FE" />
                        </div>
                        <div class="space-y-2">
                            <Label>Desplazamiento</Label>
                            <Input v-model="inlineForm.displacement" placeholder="Ej: 2.4L" />
                        </div>
                    </div>
                </template>

                <div v-if="inlineError" class="text-sm text-red-600">{{ inlineError }}</div>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" @click="closeInline">Cancelar</Button>
                    <Button type="submit" :disabled="inlineProcessing">{{ inlineProcessing ? 'Guardando...' : 'Guardar' }}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>

    </AppLayout>
</template>
