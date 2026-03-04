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
    brand_id: 1,
    sku: '',
    upc: '',
    pricing: {
        base_price: 0,
        msrp: 0,
        cost: 0,
        tax_rate: 7,
        tax_type: 'standard',
        max_discount_percentage: 0,
    },
    initial_inventory: [
        {
            warehouse_id: 1,
            stock_available: 0,
            reorder_point: 5,
            reorder_quantity: 20,
        },
    ],
})

// === 3-Way Tax Calculator ===
const isCalculating = ref(false)
const computed_total = ref(0)

watch(
    () => [form.value.pricing.base_price, form.value.pricing.tax_rate],
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
    const tax = Number(form.value.pricing.tax_rate) || 0
    const total = Number(newTotal) || 0
    form.value.pricing.base_price = Math.round((total / (1 + tax / 100)) * 100) / 100
    computed_total.value = total
    isCalculating.value = false
}

const onTaxTypeChange = (type: 'standard' | 'exempt' | 'custom') => {
    form.value.pricing.tax_type = type
    if (type === 'standard') form.value.pricing.tax_rate = 7
    else if (type === 'exempt') form.value.pricing.tax_rate = 0
}

const validationErrors = ref<Record<string, string[]>>({})
const successMessage = ref('')
const categories = ref<Category[]>([])
const brands = ref<Brand[]>([])
const loadingCategories = ref(false)
const loadingBrands = ref(false)

// Variant-level attributes (from category defaults)
const variantAttributes = ref<{ name: string; value: string; unit: string; required: boolean }[]>([])

// === Auto-SKU Preview ===
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

// === Auto Variant SKU ===
const autoVariantSku = computed(() => {
    const base = form.value.sku_base || skuPreview.value
    if (!base) return ''
    const brand = brands.value.find(b => b.id === form.value.brand_id)
    if (!brand) return base
    const brandCode = brand.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
    return `${base}-${brandCode}`
})

// === Live Name Preview (Category + Vehicles ONLY, no brand/attributes) ===
const namePreview = computed(() => {
    const parts: string[] = []
    const catId = (form.value as any).category_id
    if (catId) {
        const cat = categories.value.find(c => c.id === catId)
        if (cat) parts.push(cat.name)
    }
    let name = parts.join(' ') || 'Producto sin nombre'
    // Vehicle labels from added engines
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

// Watch category to fetch preview + attribute definitions
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
                    name: attr.name,
                    value: '',
                    unit: attr.unit || '',
                    required: attr.required || false,
                }))
            } else { variantAttributes.value = [] }
        } catch { variantAttributes.value = [] }
    }
)

// When brand changes, auto-fill variant SKU
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

// === Vehicle Compatibility ===
interface VehicleMake { id: number; name: string }
interface VehicleModelItem { id: number; name: string; year_from?: number; year_to?: number }
interface VehicleEngineItem { id: number; engine_code: string; displacement?: string }

const vehicleMakes = ref<VehicleMake[]>([])
const vehicleModels = ref<VehicleModelItem[]>([])
const vehicleEngines = ref<VehicleEngineItem[]>([])

const selectedMakeId = ref<number | null>(null)
const selectedModelId = ref<number | null>(null)
const selectedEngineId = ref<number | null>(null)

const addedEngines = ref<{ engine_id: number; make: string; model: string; engine: string }[]>([])

const loadingMakes = ref(false)
const loadingModels = ref(false)
const loadingEngines = ref(false)

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
    loadingModels.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-makes/${makeId}/models`)
        vehicleModels.value = data.data ?? data
    } catch { vehicleModels.value = [] }
    finally { loadingModels.value = false }
})

watch(selectedModelId, async (modelId) => {
    vehicleEngines.value = []; selectedEngineId.value = null
    if (!modelId) return
    loadingEngines.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-models/${modelId}/engines`)
        vehicleEngines.value = data.data ?? data
    } catch { vehicleEngines.value = [] }
    finally { loadingEngines.value = false }
})

const addEngine = () => {
    if (!selectedEngineId.value) return
    if (addedEngines.value.some(e => e.engine_id === selectedEngineId.value)) return
    const make = vehicleMakes.value.find(m => m.id === selectedMakeId.value)
    const model = vehicleModels.value.find(m => m.id === selectedModelId.value)
    const engine = vehicleEngines.value.find(e => e.id === selectedEngineId.value)
    addedEngines.value.push({
        engine_id: selectedEngineId.value,
        make: make?.name || '', model: model?.name || '', engine: engine?.engine_code || '',
    })
    selectedEngineId.value = null
}
const removeEngine = (idx: number) => addedEngines.value.splice(idx, 1)

// === VINs ===
const vinInput = ref('')
const addedVins = ref<string[]>([])
const addVin = () => {
    const v = vinInput.value.trim().toUpperCase()
    if (!v || addedVins.value.includes(v)) return
    addedVins.value.push(v); vinInput.value = ''
}
const removeVin = (idx: number) => addedVins.value.splice(idx, 1)

// === onMounted ===
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
        if (brands.value.length > 0 && !form.value.brand_id) {
            form.value.brand_id = brands.value[0].id
        }
    } catch (e) { console.error('Error loading brands:', e) }
    finally { loadingBrands.value = false }

    fetchMakes()
})

// === Submit ===
const handleSubmit = async () => {
    validationErrors.value = {}
    successMessage.value = ''
    try {
        const payload = {
            ...form.value,
            // Attributes go to the variant, not the product
            attributes: variantAttributes.value
                .filter(a => a.value.trim())
                .map(a => ({ name: a.name, value: a.value, unit: a.unit })),
            vehicle_compatibility: addedEngines.value.map(e => e.engine_id),
            vins: addedVins.value,
        }
        await createProduct(payload)
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
</script>

<template>
    <Head title="Crear Producto" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-4xl space-y-6 p-6">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Crear Nuevo Producto</h1>

            <div v-if="successMessage" class="rounded-lg bg-green-50 p-4 text-green-800">{{ successMessage }}</div>
            <div v-if="error" class="rounded-lg bg-red-50 p-4 text-red-800">{{ error }}</div>

        <form @submit.prevent="handleSubmit" class="space-y-6">

            <!-- ══════════ SECTION 1: Producto Base ══════════ -->
            <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Producto Base</h2>
                <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Información compartida por todas las variantes. El nombre se genera con: <strong>Categoría + Vehículos</strong></p>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Nombre del Producto</label>
                        <input v-model="form.name" type="text"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            placeholder="Déjalo en blanco para autogenerar"
                        />
                        <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">Se autogenera si lo dejas vacío</p>
                        <div v-if="!form.name && namePreview" class="mt-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50">
                            <p class="text-xs text-amber-500 dark:text-amber-400 font-medium mb-0.5">Preview del nombre base:</p>
                            <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">{{ namePreview }}</p>
                        </div>
                        <p v-if="validationErrors.name" class="mt-1 text-sm text-red-600">{{ validationErrors.name[0] }}</p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">SKU Base</label>
                        <input v-model="form.sku_base" type="text"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            :placeholder="skuPreview || 'Autogenerar al guardar'"
                        />
                        <div class="mt-1">
                            <p v-if="skuPreview && !form.sku_base" class="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Se generará: <span class="font-mono font-bold">{{ skuPreview }}</span>
                            </p>
                            <p v-else-if="loadingSkuPreview" class="text-xs text-gray-400">Calculando SKU...</p>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Categoría</label>
                        <select v-model="form.category_id"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                            <option :value="undefined">-- Selecciona una categoría --</option>
                            <optgroup v-for="category in categories.filter(c => !c.parent_id)" :key="category.id" :label="category.name">
                                <option :value="category.id">{{ category.name }}</option>
                                <option v-for="child in categories.filter(c => c.parent_id === category.id)" :key="child.id" :value="child.id">
                                    &nbsp;&nbsp;↳ {{ child.name }}
                                </option>
                            </optgroup>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Estado</label>
                        <select v-model="form.status"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                            <option value="active">Activo</option>
                            <option value="discontinued">Discontinuado</option>
                            <option value="pending">Pendiente</option>
                        </select>
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Notas</label>
                        <textarea v-model="form.description" rows="2"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            placeholder="Notas internas del producto..."></textarea>
                    </div>
                </div>
            </div>

            <!-- ══════════ SECTION 2: Compatibilidad Vehicular + VIN ══════════ -->
            <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800 border-l-4 border-teal-500">
                <h2 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Compatibilidad Vehicular</h2>
                <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Vehículos y VINs afectan el nombre del producto base.</p>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-4 mb-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Marca del Vehículo</label>
                        <select v-model="selectedMakeId" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                            <option :value="null">-- Marca --</option>
                            <option v-for="m in vehicleMakes" :key="m.id" :value="m.id">{{ m.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo</label>
                        <select v-model="selectedModelId" :disabled="!selectedMakeId || loadingModels"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50">
                            <option :value="null">{{ loadingModels ? 'Cargando...' : '-- Modelo --' }}</option>
                            <option v-for="m in vehicleModels" :key="m.id" :value="m.id">
                                {{ m.name }} {{ m.year_from ? `(${m.year_from}-${m.year_to || '...'})` : '' }}
                            </option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Motor</label>
                        <select v-model="selectedEngineId" :disabled="!selectedModelId || loadingEngines"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50">
                            <option :value="null">{{ loadingEngines ? 'Cargando...' : '-- Motor --' }}</option>
                            <option v-for="e in vehicleEngines" :key="e.id" :value="e.id">
                                {{ e.engine_code }} {{ e.displacement ? `(${e.displacement})` : '' }}
                            </option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button type="button" @click="addEngine" :disabled="!selectedEngineId"
                            class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40 transition-colors">
                            + Agregar
                        </button>
                    </div>
                </div>

                <div v-if="addedEngines.length > 0" class="mb-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Marca</th>
                                <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Modelo</th>
                                <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Motor</th>
                                <th class="w-10 px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
                            <tr v-for="(eng, idx) in addedEngines" :key="eng.engine_id" class="bg-white dark:bg-gray-800">
                                <td class="px-4 py-2 text-gray-900 dark:text-white">{{ eng.make }}</td>
                                <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ eng.model }}</td>
                                <td class="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{{ eng.engine }}</td>
                                <td class="px-2 py-2 text-center">
                                    <button type="button" @click="removeEngine(idx)" class="text-red-400 hover:text-red-600 text-xs">✕</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div>
                    <label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">VINs del producto</label>
                    <div class="flex gap-2 mb-3">
                        <input v-model="vinInput" type="text" @keydown.enter.prevent="addVin"
                            class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white font-mono uppercase"
                            placeholder="Ingresa un VIN y presiona Enter..." />
                        <button type="button" @click="addVin" :disabled="!vinInput.trim()"
                            class="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40 transition-colors">
                            + Agregar
                        </button>
                    </div>
                    <div v-if="addedVins.length > 0" class="flex flex-wrap gap-2">
                        <span v-for="(vin, idx) in addedVins" :key="vin"
                            class="inline-flex items-center gap-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 px-3 py-1 text-xs font-mono">
                            {{ vin }}
                            <button type="button" @click="removeVin(idx)" class="text-teal-600 hover:text-red-500 text-sm leading-none">&times;</button>
                        </span>
                    </div>
                </div>
            </div>

            <!-- ══════════ SECTION 3: Variante Inicial ══════════ -->
            <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800 border-l-4 border-indigo-500">
                <h2 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Variante Inicial (Default)</h2>
                <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Marca, atributos técnicos, SKU y precio de la primera variante. Podrás agregar más marcas después.</p>

                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Marca <span class="text-red-500">*</span></label>
                        <select v-model="form.brand_id" required :disabled="loadingBrands"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                            <option v-if="loadingBrands" :value="undefined">Cargando marcas...</option>
                            <option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">SKU de la Variante</label>
                        <input v-model="form.sku" type="text"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            :placeholder="autoVariantSku || 'Ej: ALT-0012-BOS'" />
                        <p v-if="autoVariantSku" class="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                            Auto: <span class="font-mono font-bold">{{ autoVariantSku }}</span>
                        </p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Custom SKU / UPC</label>
                        <input v-model="form.upc" type="text"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            placeholder="123456789012" />
                    </div>
                </div>

                <!-- Variant Attributes (from category) -->
                <div v-if="variantAttributes.length > 0" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        🔧 Especificaciones Técnicas de esta Variante
                    </h3>
                    <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">Estos atributos pertenecen a la variante, no al producto base. Cada marca puede tener especificaciones distintas.</p>
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div v-for="(attr, index) in variantAttributes" :key="index">
                            <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                {{ attr.name }} <span v-if="attr.unit" class="text-gray-400">({{ attr.unit }})</span>
                                <span v-if="attr.required" class="text-red-500">*</span>
                            </label>
                            <input v-model="attr.value" type="text" :required="attr.required"
                                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                :placeholder="`Ingresa ${attr.name.toLowerCase()}...`" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- ══════════ SECTION 4: Precios ══════════ -->
            <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Precios e Impuestos</h2>

                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Tipo de Impuesto (ITBM)</label>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 transition-colors"
                            :class="form.pricing.tax_type === 'standard' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600'">
                            <input type="radio" name="tax_type" value="standard" :checked="form.pricing.tax_type === 'standard'" @change="onTaxTypeChange('standard')" class="sr-only" />
                            <span class="text-sm font-medium">Con ITBM (7%)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 transition-colors"
                            :class="form.pricing.tax_type === 'exempt' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'border-gray-300 dark:border-gray-600'">
                            <input type="radio" name="tax_type" value="exempt" :checked="form.pricing.tax_type === 'exempt'" @change="onTaxTypeChange('exempt')" class="sr-only" />
                            <span class="text-sm font-medium">Sin ITBM (0%)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 transition-colors"
                            :class="form.pricing.tax_type === 'custom' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'border-gray-300 dark:border-gray-600'">
                            <input type="radio" name="tax_type" value="custom" :checked="form.pricing.tax_type === 'custom'" @change="onTaxTypeChange('custom')" class="sr-only" />
                            <span class="text-sm font-medium">Tasa personalizada</span>
                        </label>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-6 md:grid-cols-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-dashed border-gray-300 dark:border-gray-600">
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Precio Base (USD) <span class="text-red-500">*</span></label>
                        <input v-model.number="form.pricing.base_price" type="number" step="0.01" min="0" required
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="100.00" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">ITBM (%) <span class="text-red-500">*</span></label>
                        <input v-model.number="form.pricing.tax_rate" type="number" step="0.01" min="0" max="15" required
                            :disabled="form.pricing.tax_type !== 'custom'"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Precio Total (con ITBM)</label>
                        <input :value="computed_total" @input="onTotalChange(Number(($event.target as HTMLInputElement).value))"
                            type="number" step="0.01" min="0"
                            class="mt-1 w-full rounded-md border border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 px-3 py-2 dark:text-white font-semibold" />
                        <p class="mt-1 text-xs text-blue-600 dark:text-blue-400">Se recalcula automáticamente</p>
                    </div>
                </div>
            </div>

            <!-- ══════════ SECTION 5: Inventario ══════════ -->
            <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Inventario Inicial (Opcional)</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Stock Disponible</label>
                        <input v-model.number="form.initial_inventory![0].stock_available" type="number" min="0"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="100" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Punto de Reorden</label>
                        <input v-model.number="form.initial_inventory![0].reorder_point" type="number" min="0"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="5" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100">Cantidad de Reorden</label>
                        <input v-model.number="form.initial_inventory![0].reorder_quantity" type="number" min="0"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="20" />
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
                    class="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
                    {{ loading ? 'Creando...' : 'Crear Producto' }}
                </button>
            </div>
        </form>
    </div>
    </AppLayout>
</template>
