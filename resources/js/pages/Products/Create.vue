<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import { useToast } from '@/composables/useToast'
import { useVehicleEngines } from '@/composables/useVehicleEngines'
import type { CreateProductRequest, Product } from '@/types/product'
import type { Category } from '@/types/category'
import type { Brand } from '@/types/brand'
import apiClient from '@/services/api/client'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import AsyncProductCombobox from '@/components/AsyncProductCombobox.vue'
import PricingFormula from '@/components/Products/PricingFormula.vue'
import VariantManager from '@/components/Products/VariantManager.vue'
import { useStoreSettings } from '@/composables/useStoreSettings'
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
const { settings: storeSettings, fetchSettings: fetchStoreSettings } = useStoreSettings()
const toast = useToast()

// === Rounding helper — respects LL-013: only applied on auto-calc, never on manual input ===
const applyRounding = (price: number): number => {
    const increment = Number(storeSettings.value.price_rounding_increment) || 0
    if (increment <= 0) return price
    return Math.ceil(price / increment) * increment
}

const form = ref<CreateProductRequest>({
    sku_base: '',
    name: '',
    description: '',
    product_line_id: undefined,
    category_id: undefined,
    engine_id: undefined, // R21: motor as reusable entity
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
            warehouse_id: 0,
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

type DraftProductAttribute = {
    name: string
    value: string
    unit: string
    required: boolean
    fromCategory?: boolean
}

const variantAttributes = ref<DraftProductAttribute[]>([])

const attributeNameKey = (name: string) => name.trim().toLowerCase()

const mergeCategoryDefaultAttributes = (defaults: any[]) => {
    const existingByName = new Map<string, DraftProductAttribute>()
    variantAttributes.value.forEach(attr => {
        const key = attributeNameKey(attr.name)
        if (key) existingByName.set(key, attr)
    })

    const normalizedDefaults = defaults
        .map((attr: any) => {
            const name = String(attr?.name ?? '').trim()
            if (!name) return null

            const key = attributeNameKey(name)
            const existing = existingByName.get(key)

            return {
                name,
                value: existing?.value ?? '',
                unit: String(attr?.unit ?? existing?.unit ?? '').trim(),
                required: Boolean(attr?.required),
                fromCategory: true,
            } as DraftProductAttribute
        })
        .filter(Boolean) as DraftProductAttribute[]

    const defaultKeys = new Set(normalizedDefaults.map(attr => attributeNameKey(attr.name)))
    const customAttributes = variantAttributes.value
        .filter(attr => !defaultKeys.has(attributeNameKey(attr.name)))
        .map(attr => ({ ...attr, fromCategory: false }))

    variantAttributes.value = [...normalizedDefaults, ...customAttributes]
}

const keepOnlyCustomAttributes = () => {
    variantAttributes.value = variantAttributes.value
        .filter(attr => !attr.fromCategory)
        .map(attr => ({ ...attr, fromCategory: false }))
}

const addCustomAttribute = () => {
    variantAttributes.value.push({
        name: '',
        value: '',
        unit: '',
        required: false,
        fromCategory: false,
    })
}

const removeVariantAttribute = (index: number) => {
    variantAttributes.value.splice(index, 1)
}

// Category pricing — formula takes priority over margin (LL-013 compatibility)
const categoryFormula = ref<string | null>(null)
const categoryAppliesItbm = ref<boolean>(false)
const categoryItbmPercent = ref<number | null>(null)
const categoryMargin = ref<number | null>(null)
const priceManuallyEdited = ref(false)
const onBasePriceInput = () => { priceManuallyEdited.value = true }

// R20: Duplicate checking
const duplicates = ref<{ id: number; name: string; sku_base: string }[]>([])
const checkingDuplicates = ref(false)
let duplicateCheckTimeout: ReturnType<typeof setTimeout> | null = null

const checkDuplicates = async () => {
    const name = form.value.name?.trim()
    const sku = form.value.sku_base?.trim()

    if (!name && !sku) {
        duplicates.value = []
        return
    }

    checkingDuplicates.value = true
    try {
        const response = await apiClient.get('/products/check-duplicate', {
            params: { name, sku }
        })
        duplicates.value = response.data.data || []
    } catch (e) {
        console.error('Error checking duplicates:', e)
        duplicates.value = []
    } finally {
        checkingDuplicates.value = false
    }
}

// Debounced watcher for duplicate checking (600ms)
watch([() => form.value.name, () => form.value.sku_base], () => {
    if (duplicateCheckTimeout) {
        clearTimeout(duplicateCheckTimeout)
    }
    duplicateCheckTimeout = setTimeout(() => {
        checkDuplicates()
    }, 600)
})

const nameManuallyEdited = ref(false)
const onNameInput = () => { nameManuallyEdited.value = true }

type EngineCompatibilityEntry = {
    engine_id: number
    make: string
    model: string
    engine: string
    year: string
    chassis: string
}

type ChassisCompatibilityEntry = {
    chassis_id: number
    make: string
    model: string
    year: string
    chassis: string
}

const formatYearRange = (model?: VehicleModelItem | null): string => {
    const from = model?.year_from
    const to = model?.year_to

    if (from && to) return from === to ? `${from}` : `${from}-${to}`
    if (from) return `${from}`
    if (to) return `${to}`
    return ''
}

const getModelChassis = (model?: VehicleModelItem | null): string => {
    return String(model?.generation ?? '').trim()
}

const makeAbbreviationMap: Record<string, string> = {
    chevrolet: 'Chev',
    chevy: 'Chev',
    toyota: 'Toy',
    volkswagen: 'VW',
    'mercedes benz': 'Merc',
    mercedes: 'Merc',
    mitsubishi: 'Mits',
    hyundai: 'Hyun',
    nissan: 'Niss',
    peugeot: 'Peug',
    chrysler: 'Chry',
    porsche: 'Pors',
    landrover: 'LR',
    'land rover': 'LR',
}

const normalizeMakeKey = (make: string): string => {
    return make
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const abbreviateMakeName = (make?: string): string => {
    const raw = String(make ?? '').trim()
    if (!raw) return ''

    const normalizedKey = normalizeMakeKey(raw)
    if (makeAbbreviationMap[normalizedKey]) {
        return makeAbbreviationMap[normalizedKey]
    }

    // Fallback to keep labels compact when make names are very long.
    if (raw.length > 7) {
        return raw.slice(0, 4)
    }

    return raw
}

const buildChassisLevelLabel = (entry: {
    make?: string
    model?: string
    year?: string
    chassis?: string
}): string => {
    return [abbreviateMakeName(entry.make), entry.model, entry.year, entry.chassis]
        .map(v => String(v ?? '').trim())
        .filter(Boolean)
        .join(', ')
}

const buildEngineLevelLabel = (entry: {
    make?: string
    engine?: string
    model?: string
    year?: string
    chassis?: string
}): string => {
    return [abbreviateMakeName(entry.make), entry.engine, entry.model, entry.year, entry.chassis]
        .map(v => String(v ?? '').trim())
        .filter(Boolean)
        .join(', ')
}

const addedEngines = ref<EngineCompatibilityEntry[]>([])
const vehicleChassisList = ref<any[]>([])
const selectedChassisIds = ref<number[]>([])
const addedChassis = ref<ChassisCompatibilityEntry[]>([])
const allEnginesFlag = ref(false)
const allChassisFlag = ref(false)
const compatTab = ref<'engines' | 'chassis'>('engines')

type PendingOemReference = {
    oem_code: string
    manufacturer: string | null
}

const addedRefs = ref<PendingOemReference[]>([])

type UpsaleRelationship = 'compatible' | 'substitute' | 'upgrade'

type PendingUpsale = {
    id: number
    sku_base: string
    name: string
    relationship_type: UpsaleRelationship
}

const selectedUpsaleProduct = ref<Product | null>(null)
const upsaleRelationshipType = ref<UpsaleRelationship>('compatible')
const pendingUpsales = ref<PendingUpsale[]>([])

const addUpsale = () => {
    if (!selectedUpsaleProduct.value) return

    const selected = selectedUpsaleProduct.value
    if (pendingUpsales.value.some(item => item.id === selected.id)) return

    pendingUpsales.value.push({
        id: selected.id,
        sku_base: selected.sku_base,
        name: selected.name,
        relationship_type: upsaleRelationshipType.value,
    })

    selectedUpsaleProduct.value = null
    upsaleRelationshipType.value = 'compatible'
}

const removeUpsale = (productId: number) => {
    pendingUpsales.value = pendingUpsales.value.filter(item => item.id !== productId)
}

const getUpsaleRelationshipLabel = (type: UpsaleRelationship): string => {
    const labels: Record<UpsaleRelationship, string> = {
        compatible: 'Compatible',
        substitute: 'Sustituto',
        upgrade: 'Upgrade',
    }
    return labels[type]
}

type PendingImage = {
    tempId: string
    file: File
    previewUrl: string
}

const pendingImages = ref<PendingImage[]>([])

const handlePendingImageSelection = (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) return

    for (const file of Array.from(input.files)) {
        const alreadyAdded = pendingImages.value.some(item =>
            item.file.name === file.name
            && item.file.size === file.size
            && item.file.lastModified === file.lastModified
        )

        if (alreadyAdded) continue

        pendingImages.value.push({
            tempId: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
        })
    }

    input.value = ''
}

const removePendingImage = (tempId: string) => {
    const index = pendingImages.value.findIndex(item => item.tempId === tempId)
    if (index === -1) return

    URL.revokeObjectURL(pendingImages.value[index].previewUrl)
    pendingImages.value.splice(index, 1)
}

interface VehicleMake { id: number; name: string }
interface VehicleModelItem { id: number; name: string; year_from?: number; year_to?: number; generation?: string }
interface VehicleEngineItem { id: number; engine_code: string; displacement?: string }

const vehicleMakes = ref<VehicleMake[]>([])
const vehicleModels = ref<VehicleModelItem[]>([])
const vehicleEngines = ref<VehicleEngineItem[]>([])

const selectedMakeId = ref<number | null>(null)
const selectedModelId = ref<number | null>(null)
// R39: Multi-select de motores
const selectedEngineIds = ref<number[]>([])
const isUniversal = ref(false)

const selectedModelMeta = computed(() =>
    vehicleModels.value.find(m => m.id === selectedModelId.value) || null
)

const compatibilitySummary = computed(() => {
    if (isUniversal.value) return 'Universal'

    const parts: string[] = []
    if (allEnginesFlag.value) {
        parts.push('todos los motores del modelo')
    } else if (addedEngines.value.length > 0) {
        parts.push(`${addedEngines.value.length} motor(es)`)
    }

    if (allChassisFlag.value) {
        parts.push('todos los chasis del modelo')
    } else if (addedChassis.value.length > 0) {
        parts.push(`${addedChassis.value.length} chasis`)
    }

    return parts.join(' | ')
})

const namePreview = computed(() => {
    const catId = (form.value as any).category_id
    const categoryName = categories.value.find(c => c.id === catId)?.name || 'Producto sin nombre'

    const chassisLabels = addedChassis.value
        .map(entry => buildChassisLevelLabel(entry))
        .filter(Boolean)

    const engineLabels = addedEngines.value
        .map(entry => buildEngineLevelLabel(entry))
        .filter(Boolean)

    const selectedMake = vehicleMakes.value.find(m => m.id === selectedMakeId.value)?.name || ''
    const selectedModel = vehicleModels.value.find(m => m.id === selectedModelId.value)
    const selectedModelName = selectedModel?.name || ''
    const selectedYear = formatYearRange(selectedModel)
    const selectedChassis = getModelChassis(selectedModel)

    if (allChassisFlag.value && selectedModelName) {
        const allChassisLabel = buildChassisLevelLabel({
            make: selectedMake,
            model: selectedModelName,
            year: selectedYear,
            chassis: selectedChassis || 'todos los chasis',
        })
        if (allChassisLabel) {
            chassisLabels.push(allChassisLabel)
        }
    }

    if (allEnginesFlag.value && selectedModelName) {
        const allEnginesLabel = buildEngineLevelLabel({
            make: selectedMake,
            engine: 'todos los motores',
            model: selectedModelName,
            year: selectedYear,
            chassis: selectedChassis || 'todos los chasis',
        })
        if (allEnginesLabel) {
            engineLabels.push(allEnginesLabel)
        }
    }

    const compatibilityLabels = [...new Set([...chassisLabels, ...engineLabels])]
    if (compatibilityLabels.length === 0) {
        return categoryName
    }

    const displayed = compatibilityLabels.slice(0, 3).join(' | ')
    const suffix = compatibilityLabels.length > 3 ? ' y mas' : ''
    return `${categoryName} - ${displayed}${suffix}`
})

watch(namePreview, (newVal) => {
    if (!nameManuallyEdited.value && newVal !== 'Producto sin nombre') {
        form.value.name = newVal
    }
})

watch(
    () => (form.value as any).category_id,
    async (newCategoryId: number | undefined) => {
        if (!newCategoryId) {
            keepOnlyCustomAttributes()
            categoryFormula.value = null
            categoryAppliesItbm.value = false
            categoryItbmPercent.value = null
            categoryMargin.value = null
            return
        }
        try {
            const resp = await apiClient.get(`/categories/${newCategoryId}`)
            const cat = resp.data
            if (cat.default_attributes && Array.isArray(cat.default_attributes)) {
                mergeCategoryDefaultAttributes(cat.default_attributes)
            } else {
                keepOnlyCustomAttributes()
            }
            // R23: capture formula and ITBM flag + percent (LL-013 fallback: margin)
            categoryFormula.value = cat.pricing_formula ?? null
            categoryAppliesItbm.value = cat.applies_itbm ?? false
            categoryItbmPercent.value = cat.itbm_percent ?? 7
            categoryMargin.value = cat.default_margin_percent ?? null
        } catch {
            keepOnlyCustomAttributes()
            categoryFormula.value = null
            categoryAppliesItbm.value = false
            categoryItbmPercent.value = null
            categoryMargin.value = null
        }
    }
)

// Auto-calculate base_price from category formula (priority) or margin (fallback)
watch(
    () => form.value.pricing.cost,
    async (newCost) => {
        if (priceManuallyEdited.value) return
        const cost = Number(newCost) || 0
        if (cost <= 0) return

        if (categoryFormula.value) {
            // Formula takes priority
            try {
                const { data } = await apiClient.post('/categories/preview-price', {
                    formula: categoryFormula.value,
                    costo: cost,
                    applies_itbm: categoryAppliesItbm.value,
                    itbm_percent: categoryItbmPercent.value ?? 7,
                })
                if (data.price !== null) {
                    form.value.pricing.base_price = applyRounding(data.price)
                }
            } catch { /* silencioso */ }
        } else if (categoryMargin.value != null && categoryMargin.value > 0) {
            // Fallback: simple margin (LL-013)
            form.value.pricing.base_price = applyRounding(Number((cost * (1 + categoryMargin.value / 100)).toFixed(2)))
        }
    }
)

const getChassisOptionDetail = (chassis: any): string => {
    const modelContext = (chassis?.model ?? selectedModelMeta.value) as VehicleModelItem | null
    const modelName = String(chassis?.model?.name ?? selectedModelMeta.value?.name ?? '').trim()
    const years = formatYearRange(modelContext)
    const code = String(chassis?.code ?? getModelChassis(modelContext)).trim()
    const base = [modelName, years].filter(Boolean).join(' ')

    if (!base && !code) return 'Chasis sin detalle'
    return code ? `${base || 'Modelo'} - Chasis: ${code}` : base
}

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
    vehicleEngines.value = []; selectedEngineIds.value = []
    vehicleChassisList.value = []; selectedChassisIds.value = []
    if (!modelId) return
    
    loadingEnginesV.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-models/${modelId}/engines`)
        vehicleEngines.value = data.data ?? data
    } catch { vehicleEngines.value = [] }
    finally { loadingEnginesV.value = false }

    try {
        const { data } = await apiClient.get(`/vehicle-models/${modelId}/chassis`)
        vehicleChassisList.value = data.data ?? data
    } catch { vehicleChassisList.value = [] }
})

const toggleUniversal = () => {
    isUniversal.value = !isUniversal.value
    if (isUniversal.value) {
        addedEngines.value = []
        selectedMakeId.value = null
    }
}

// R39: Agregar múltiples motores de una vez
const addEngines = () => {
    if (selectedEngineIds.value.length === 0) return
    const make = vehicleMakes.value.find(m => m.id === selectedMakeId.value)
    const model = vehicleModels.value.find(m => m.id === selectedModelId.value)
    const modelName = model?.name || ''
    const year = formatYearRange(model)
    const chassis = getModelChassis(model)
    
    selectedEngineIds.value.forEach(engineId => {
        if (addedEngines.value.some(e => e.engine_id === engineId)) return
        const engine = vehicleEngines.value.find(e => e.id === engineId)
        addedEngines.value.push({
            engine_id: engineId,
            make: make?.name || '',
            model: modelName,
            engine: engine?.engine_code || '',
            year,
            chassis,
        })
    })
    selectedEngineIds.value = []
}
const removeEngine = (idx: number) => addedEngines.value.splice(idx, 1)

const addChassis = () => {
    if (selectedChassisIds.value.length === 0) return
    const make = vehicleMakes.value.find(m => m.id === selectedMakeId.value)
    const model = vehicleModels.value.find(m => m.id === selectedModelId.value)
    const modelName = model?.name || ''
    const year = formatYearRange(model)
    const modelChassis = getModelChassis(model)
    
    selectedChassisIds.value.forEach(chId => {
        if (addedChassis.value.some(c => c.chassis_id === chId)) return
        const ch = vehicleChassisList.value.find(c => c.id === chId)
        addedChassis.value.push({
            chassis_id: chId,
            make: make?.name || '',
            model: modelName,
            year,
            chassis: String(ch?.code || '').trim() || modelChassis,
        })
    })
    selectedChassisIds.value = []
}
const removeChassis = (idx: number) => addedChassis.value.splice(idx, 1)

const refInput = ref('')
const refManufacturerInput = ref<string | null>(null)
const addRef = () => {
    const code = refInput.value.trim()
    const manufacturer = (refManufacturerInput.value || '').trim() || null
    if (!code) return

    const exists = addedRefs.value.some(ref =>
        ref.oem_code.toLowerCase() === code.toLowerCase()
        && (ref.manufacturer ?? '') === (manufacturer ?? '')
    )
    if (exists) return

    addedRefs.value.push({
        oem_code: code,
        manufacturer,
    })
    refInput.value = ''
    refManufacturerInput.value = null
}
const removeRef = (idx: number) => addedRefs.value.splice(idx, 1)

const inlineModal = ref<'category' | 'brand' | 'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis' | null>(null)
const inlineForm = ref<Record<string, any>>({})
const inlineProcessing = ref(false)
const inlineError = ref<string | null>(null)
const vehicleModelDraftBeforeChassis = ref<Record<string, any> | null>(null)

const openModelChassisQuickCreate = () => {
    vehicleModelDraftBeforeChassis.value = { ...inlineForm.value }
    inlineModal.value = 'vehicleChassis'
    inlineError.value = null
    inlineProcessing.value = false
    inlineForm.value = { code: '', name: '' }
}

const openInline = (type: typeof inlineModal.value) => {
    if (type !== 'vehicleChassis') {
        vehicleModelDraftBeforeChassis.value = null
    }

    inlineModal.value = type
    inlineError.value = null
    inlineProcessing.value = false
    if (type === 'category') inlineForm.value = { name: '', parent_id: null }
    else if (type === 'brand') inlineForm.value = { name: '' }
    else if (type === 'vehicleMake') inlineForm.value = { name: '' }
    else if (type === 'vehicleModel') {
        inlineForm.value = { name: '', year_from: new Date().getFullYear(), year_to: new Date().getFullYear() }
        selectedModelGenerationChassisId.value = null
        fetchVehicleChassisCatalog()
    }
    else if (type === 'vehicleEngine') inlineForm.value = { engine_code: '', displacement: '' }
    else if (type === 'vehicleChassis') inlineForm.value = { code: '', name: '' }
}

const closeInline = () => {
    if (inlineModal.value === 'vehicleChassis' && vehicleModelDraftBeforeChassis.value) {
        inlineModal.value = 'vehicleModel'
        inlineForm.value = { ...vehicleModelDraftBeforeChassis.value }
        vehicleModelDraftBeforeChassis.value = null
        return
    }

    inlineModal.value = null
    vehicleModelDraftBeforeChassis.value = null
}

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
            const selectedGeneration = vehicleChassisCatalog.value
                .find(chassis => chassis.id === selectedModelGenerationChassisId.value)
                ?.code?.trim() || null

            if (selectedGeneration && selectedGeneration.length > 20) {
                inlineError.value = 'El código de chasis seleccionado supera 20 caracteres y no puede guardarse como generación del modelo.'
                return
            }

            const payload = {
                ...inlineForm.value,
                make_id: selectedMakeId.value,
                generation: selectedGeneration,
            }

            const { data } = await apiClient.post('/vehicle-models', payload)
            const newModel = data.data ?? data
            vehicleModels.value.push(newModel)
            selectedModelId.value = newModel.id
        } else if (inlineModal.value === 'vehicleEngine') {
            const { data } = await apiClient.post('/vehicle-engines', { ...inlineForm.value, model_id: selectedModelId.value, fuel_type: 'N/A', aspiration: 'N/A' })
            const newEngine = data.data ?? data
            vehicleEngines.value.push(newEngine)
            // R39: Agregar el nuevo motor a la selección múltiple
            selectedEngineIds.value.push(newEngine.id)
        } else if (inlineModal.value === 'vehicleChassis') {
            const { data } = await apiClient.post('/vehicle-chassis', { ...inlineForm.value, model_id: selectedModelId.value })
            const newChassis = data.data ?? data
            vehicleChassisList.value.push(newChassis)
            selectedChassisIds.value.push(newChassis.id)

            if (!vehicleChassisCatalog.value.some(chassis => chassis.id === newChassis.id)) {
                vehicleChassisCatalog.value.push(newChassis)
            }

            if (vehicleModelDraftBeforeChassis.value) {
                const modelDraft = { ...vehicleModelDraftBeforeChassis.value }
                vehicleModelDraftBeforeChassis.value = null
                selectedModelGenerationChassisId.value = newChassis.id
                inlineModal.value = 'vehicleModel'
                inlineForm.value = modelDraft
                return
            }
        }
        closeInline()
    } catch (e: any) {
        inlineError.value = e.response?.data?.message || 'Error al crear'
    } finally { inlineProcessing.value = false }
}

const categoryOptions = computed(() => categories.value.flatMap(c => ({
    value: c.id, 
    label: c.name
})))
const oemBrandOptions = computed(() => brands.value.map(b => ({ value: b.name, label: b.name })))
const makeOptions = computed(() => vehicleMakes.value.map(m => ({ value: m.id, label: m.name })))
const modelOptions = computed(() => vehicleModels.value.map(m => {
    const years = m.year_from ? `${m.year_from}-${m.year_to || '...'}` : ''
    const gen = m.generation ? `Chasis: ${m.generation}` : ''
    const parts = [years, gen].filter(Boolean)
    return { value: m.id, label: m.name, sublabel: parts.join(' - ') }
}))
const engineOptions = computed(() => vehicleEngines.value.map(e => ({
    value: e.id, label: e.engine_code, sublabel: e.displacement || '',
})))

interface VehicleChassisCatalogItem {
    id: number
    code: string
    name?: string | null
    model?: {
        id?: number
        name?: string
        make?: {
            id?: number
            name?: string
        }
    } | null
}

const vehicleChassisCatalog = ref<VehicleChassisCatalogItem[]>([])
const loadingVehicleChassisCatalog = ref(false)
const selectedModelGenerationChassisId = ref<number | null>(null)

const vehicleChassisCatalogOptions = computed(() =>
    vehicleChassisCatalog.value.map(chassis => {
        const details = [
            chassis.name,
            chassis.model?.make?.name,
            chassis.model?.name,
        ].filter(Boolean).join(' - ')

        return {
            value: chassis.id,
            label: chassis.code,
            sublabel: details || undefined,
        }
    })
)

const fetchVehicleChassisCatalog = async () => {
    loadingVehicleChassisCatalog.value = true
    try {
        const { data } = await apiClient.get('/vehicle-chassis', {
            params: { per_page: 300 }
        })
        vehicleChassisCatalog.value = data?.data ?? []
    } catch (e) {
        console.error('Error loading vehicle chassis catalog:', e)
        vehicleChassisCatalog.value = []
    } finally {
        loadingVehicleChassisCatalog.value = false
    }
}

onMounted(async () => {
    fetchStoreSettings()
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
    fetchVehicleChassisCatalog()
})

// Draft variants from VariantManager in draft mode
const pendingVariants = ref<any[]>([])
const onDraftVariantsChanged = (variants: any[]) => {
    pendingVariants.value = variants
}

const handleSubmit = async () => {
    validationErrors.value = {}
    successMessage.value = ''

    // Validate required fields (only if creating default variant with brand)
    if (form.value.brand_id && !form.value.initial_inventory?.[0]?.warehouse_id) {
        toast.error('Debes seleccionar un almacén cuando creas una variante con marca')
        return
    }
    
    try {
        const payload = {
            ...form.value,
            sku: form.value.sku || form.value.sku_base || '',
            attributes: variantAttributes.value
                .map(a => ({
                    name: a.name.trim(),
                    value: a.value.trim(),
                    unit: (a.unit ?? '').trim(),
                }))
                .filter(a => a.name && a.value),
            vehicle_compatibility: addedEngines.value.map(e => e.engine_id),
            vehicle_chassis: addedChassis.value.map(c => c.chassis_id),
            all_engines: allEnginesFlag.value,
            all_chassis: allChassisFlag.value,
            is_universal: isUniversal.value,
        }
        const result = await createProduct(payload)
        const productId = (result as any)?.data?.id ?? (result as any)?.id

        if (productId && addedRefs.value.length > 0) {
            const failedReferences: string[] = []

            for (const ref of addedRefs.value) {
                try {
                    await apiClient.post(`/products/${productId}/oem-references`, {
                        oem_code: ref.oem_code,
                        manufacturer: ref.manufacturer,
                    })
                } catch (refError: any) {
                    console.error('Error creating OEM reference:', refError.response?.data || refError)
                    failedReferences.push(ref.oem_code)
                }
            }

            if (failedReferences.length > 0) {
                toast.error(`Producto creado, pero fallaron códigos alternos: ${failedReferences.join(', ')}`)
            }
        }

        // Create pending draft variants sequentially
        if (productId && pendingVariants.value.length > 0) {
            const failedVariants: string[] = []
            for (const variant of pendingVariants.value) {
                try {
                    await apiClient.post(`/products/${productId}/variants`, {
                        brand_id: variant.brand_id,
                        sku: variant.sku || '', // Backend auto-generates if empty
                        upc: variant.upc || null,
                        status: variant.status || 'active',
                        pricing: variant.pricing,
                        initial_inventory: variant.initial_inventory || [],
                    })
                } catch (variantError: any) {
                    console.error('Error creating variant:', variantError.response?.data || variantError)
                    failedVariants.push(variant.brand?.name || variant.sku || 'desconocida')
                }
            }
            if (failedVariants.length > 0) {
                toast.error(`Producto creado, pero fallaron variantes: ${failedVariants.join(', ')}`)
            }
        }

        if (productId && pendingUpsales.value.length > 0) {
            const failedUpsales: string[] = []
            for (const upsale of pendingUpsales.value) {
                try {
                    await apiClient.post(`/products/${productId}/alternatives`, {
                        alternative_product_id: upsale.id,
                        relationship_type: upsale.relationship_type,
                    })
                } catch (upsaleError: any) {
                    console.error('Error creating upsale relation:', upsaleError.response?.data || upsaleError)
                    failedUpsales.push(`${upsale.sku_base} - ${upsale.name}`)
                }
            }

            if (failedUpsales.length > 0) {
                toast.error(`Producto creado, pero fallaron upsales: ${failedUpsales.join(', ')}`)
            }
        }

        if (productId && pendingImages.value.length > 0) {
            const formData = new FormData()
            pendingImages.value.forEach(item => formData.append('images[]', item.file))

            try {
                await apiClient.post(`/products/${productId}/images`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            } catch (imageError: any) {
                console.error('Error uploading product images:', imageError.response?.data || imageError)
                toast.error('Producto creado, pero no se pudieron subir algunas imagenes')
            } finally {
                pendingImages.value.forEach(item => URL.revokeObjectURL(item.previewUrl))
                pendingImages.value = []
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
        <div class="space-y-6 p-4">

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

            <!-- R20: Duplicate warning banner -->
            <div v-if="duplicates.length > 0" class="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 p-4">
                <div class="flex items-start gap-3">
                    <svg class="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div class="flex-1">
                        <h3 class="text-sm font-semibold text-amber-800 dark:text-amber-300">Productos similares encontrados</h3>
                        <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">
                            Existen productos con nombre o código similar. Verifica que no estés duplicando:
                        </p>
                        <ul class="mt-2 space-y-1">
                            <li v-for="dup in duplicates" :key="dup.id" class="text-sm text-amber-700 dark:text-amber-400">
                                • <strong>{{ dup.name }}</strong> <span class="text-xs text-amber-600 dark:text-amber-500">(SKU: {{ dup.sku_base }})</span>
                            </li>
                        </ul>
                        <p class="text-xs text-amber-600 dark:text-amber-500 mt-2">
                            Puedes continuar y guardar si confirmas que es un producto diferente.
                        </p>
                    </div>
                </div>
            </div>

        <form @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-4">

            <!-- ══ SECTION 1: Descripcion ══ -->
            <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border space-y-4">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500">Descripción</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Descripción <span class="text-red-500">*</span>
                        </label>
                        <input v-model="form.name" type="text" @input="onNameInput"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Se autogenera con categoría + compatibilidad vehicular..." />
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
            </div>

            <!-- ══ SECTION 2: Codigo + Estado ══ -->
            <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Código y Estado</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Código <span class="text-gray-400 font-normal text-xs">(opcional)</span>
                        </label>
                        <input v-model="form.sku_base" type="text"
                            class="mt-0 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white font-mono"
                            placeholder="Ingresa manualmente el código" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                        <select v-model="form.status"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white">
                            <option value="active">Activo</option>
                            <option value="pending">Pendiente</option>
                            <option value="discontinued">Descontinuado</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- ══ SECTION 3: Codigos alternos ══ -->
            <div class="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-border dark:bg-card">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500">Códigos alternos</h2>
                <div class="grid gap-3 sm:grid-cols-12 items-end">
                    <div class="sm:col-span-5">
                        <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Código <span class="text-red-500">*</span></label>
                        <input v-model="refInput" type="text" @keydown.enter.prevent="addRef"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white font-mono"
                            placeholder="Ej: 123-456-ABC" />
                    </div>
                    <div class="sm:col-span-4">
                        <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Marca</label>
                        <SearchableSelect
                            :options="oemBrandOptions"
                            :model-value="refManufacturerInput"
                            @update:model-value="value => refManufacturerInput = (value as string | null)"
                            :loading="loadingBrands"
                            placeholder="Sin marca"
                            search-placeholder="Buscar marca..."
                            :clearable="true"
                        />
                    </div>
                    <div class="sm:col-span-3">
                        <button type="button" @click="addRef" :disabled="!refInput.trim()"
                            class="w-full rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-40">
                            Agregar
                        </button>
                    </div>
                </div>

                <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background">
                    <div v-if="addedRefs.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No hay códigos alternos agregados.
                    </div>
                    <table v-else class="w-full text-left text-sm">
                        <thead class="bg-gray-50 dark:bg-card">
                            <tr>
                                <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Código</th>
                                <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Marca</th>
                                <th class="w-12 px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                            <tr v-for="(ref, idx) in addedRefs" :key="`${ref.oem_code}-${ref.manufacturer || ''}-${idx}`">
                                <td class="px-4 py-2 font-mono text-gray-900 dark:text-white">{{ ref.oem_code }}</td>
                                <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ ref.manufacturer || '-' }}</td>
                                <td class="px-4 py-2 text-right">
                                    <button type="button" @click="removeRef(idx)" class="text-red-500 hover:text-red-700 text-xs font-semibold">Eliminar</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ══ Compatibilidad Vehicular (colapsable) ══ -->
            <div class="rounded-xl bg-white shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-teal-500">
                <button type="button" @click="(form as any)._showVehicle = !(form as any)._showVehicle"
                    class="w-full flex items-center justify-between px-5 py-4 text-left">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">Compatibilidad Vehicular</span>
                        <span v-if="addedEngines.length > 0 || addedChassis.length > 0 || allEnginesFlag || allChassisFlag || isUniversal" class="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                            {{ compatibilitySummary }}
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
                        <!-- Tabs -->
                        <div class="flex border-b border-gray-200 dark:border-border mb-4">
                            <button type="button" @click="compatTab = 'engines'"
                                :class="compatTab === 'engines' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                                class="w-1/2 py-2 px-1 text-center border-b-2 font-medium text-sm flex items-center justify-center gap-2">
                                🔧 Motores
                            </button>
                            <button type="button" @click="compatTab = 'chassis'"
                                :class="compatTab === 'chassis' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                                class="w-1/2 py-2 px-1 text-center border-b-2 font-medium text-sm flex items-center justify-center gap-2">
                                🚗 Chasis
                            </button>
                        </div>

                        <!-- Fila 1: Marca y Modelo -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
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
                        </div>

                        <!-- Panel Motores -->
                        <div v-show="compatTab === 'engines'">
                            <div class="mb-3 flex items-center">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" v-model="allEnginesFlag" class="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                    <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Compatible con TODOS los motores de este modelo</span>
                                </label>
                            </div>
                            <!-- Multi-select de motores -->
                            <div v-if="!allEnginesFlag" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                <div class="md:col-span-3">
                                    <div class="flex items-center justify-between mb-1">
                                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Motores
                                            <span v-if="selectedEngineIds.length > 0" class="ml-1 text-teal-600">({{ selectedEngineIds.length }} seleccionados)</span>
                                        </label>
                                        <button v-if="selectedModelId" type="button" @click="openInline('vehicleEngine')" class="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                                            <Plus class="h-3 w-3" />
                                        </button>
                                    </div>
                                    <div v-if="loadingEnginesV" class="text-center py-4 text-gray-400 text-sm">Cargando motores...</div>
                                    <div v-else-if="!selectedModelId" class="text-center py-4 text-gray-400 text-sm border rounded-md dark:border-border">Selecciona un modelo primero</div>
                                    <div v-else-if="vehicleEngines.length === 0" class="text-center py-4 text-gray-400 text-sm border rounded-md dark:border-border">No hay motores disponibles</div>
                                    <div v-else class="max-h-40 overflow-y-auto border rounded-md dark:border-border bg-white dark:bg-muted">
                                        <label v-for="engine in vehicleEngines" :key="engine.id" class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-background/50 cursor-pointer border-b last:border-b-0 dark:border-border" :class="{ 'bg-teal-50 dark:bg-teal-900/20': selectedEngineIds.includes(engine.id), 'opacity-50': addedEngines.some(e => e.engine_id === engine.id) }">
                                            <input type="checkbox" :value="engine.id" v-model="selectedEngineIds" :disabled="addedEngines.some(e => e.engine_id === engine.id)" class="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                            <span class="font-mono text-sm text-gray-900 dark:text-white">{{ engine.engine_code }}</span>
                                            <span v-if="engine.displacement" class="text-xs text-gray-500">{{ engine.displacement }}</span>
                                            <span v-if="addedEngines.some(e => e.engine_id === engine.id)" class="ml-auto text-xs text-teal-600">✓ Agregado</span>
                                        </label>
                                    </div>
                                </div>
                                <div class="flex items-end">
                                    <button type="button" @click="addEngines" :disabled="selectedEngineIds.length === 0"
                                        class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40">
                                        + Agregar {{ selectedEngineIds.length > 0 ? `(${selectedEngineIds.length})` : '' }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Panel Chasis -->
                        <div v-show="compatTab === 'chassis'">
                            <div class="mb-3 flex items-center">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" v-model="allChassisFlag" class="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                    <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Compatible con TODOS los chasis de este modelo</span>
                                </label>
                            </div>
                            <!-- Multi-select de chasis -->
                            <div v-if="!allChassisFlag" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                <div class="md:col-span-3">
                                    <div class="flex items-center justify-between mb-1">
                                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Chasis
                                            <span v-if="selectedChassisIds.length > 0" class="ml-1 text-teal-600">({{ selectedChassisIds.length }} seleccionados)</span>
                                        </label>
                                        <button v-if="selectedModelId" type="button" @click="openInline('vehicleChassis')" class="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline underline-offset-2">
                                            No aparece el VIN/chasis? Agrégalo aquí
                                        </button>
                                    </div>
                                    <div v-if="!selectedModelId" class="text-center py-4 text-gray-400 text-sm border rounded-md dark:border-border">Selecciona un modelo primero</div>
                                    <div v-else-if="vehicleChassisList.length === 0" class="text-center py-4 text-gray-400 text-sm border rounded-md dark:border-border">No hay chasis disponibles</div>
                                    <div v-else class="max-h-40 overflow-y-auto border rounded-md dark:border-border bg-white dark:bg-muted">
                                        <label v-for="chassis in vehicleChassisList" :key="chassis.id" class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-background/50 cursor-pointer border-b last:border-b-0 dark:border-border" :class="{ 'bg-teal-50 dark:bg-teal-900/20': selectedChassisIds.includes(chassis.id), 'opacity-50': addedChassis.some(c => c.chassis_id === chassis.id) }">
                                            <input type="checkbox" :value="chassis.id" v-model="selectedChassisIds" :disabled="addedChassis.some(c => c.chassis_id === chassis.id)" class="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                            <div class="min-w-0 flex-1">
                                                <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ getChassisOptionDetail(chassis) }}</p>
                                                <p v-if="chassis.name" class="text-xs text-gray-500 truncate">{{ chassis.name }}</p>
                                            </div>
                                            <span v-if="addedChassis.some(c => c.chassis_id === chassis.id)" class="ml-auto text-xs text-teal-600">✓ Agregado</span>
                                        </label>
                                    </div>
                                </div>
                                <div class="flex items-end">
                                    <button type="button" @click="addChassis" :disabled="selectedChassisIds.length === 0"
                                        class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40">
                                        + Agregar {{ selectedChassisIds.length > 0 ? `(${selectedChassisIds.length})` : '' }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Tabla Combinada -->
                        <div v-if="addedEngines.length > 0 || addedChassis.length > 0" class="overflow-hidden rounded-lg border border-gray-200 dark:border-border mt-4">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-gray-50 dark:bg-background/50">
                                    <tr>
                                        <th class="px-3 py-2 font-semibold text-gray-500 uppercase">Tipo</th>
                                        <th class="px-3 py-2 font-semibold text-gray-500 uppercase">Vehículo</th>
                                        <th class="px-3 py-2 font-semibold text-gray-500 uppercase">Especificación</th>
                                        <th class="w-10 px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                                    <!-- Listado de Motores -->
                                    <tr v-for="(eng, idx) in addedEngines" :key="'eng'+eng.engine_id" class="bg-white dark:bg-card">
                                        <td class="px-3 py-2 text-gray-500 dark:text-gray-400">🔧 Motor</td>
                                        <td class="px-3 py-2 text-gray-900 dark:text-white">{{ eng.make }} {{ eng.model }}</td>
                                        <td class="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{{ eng.engine }}</td>
                                        <td class="px-2 py-2 text-center">
                                            <button type="button" @click="removeEngine(idx)" class="text-red-400 hover:text-red-600">✕</button>
                                        </td>
                                    </tr>
                                    <!-- Listado de Chasis -->
                                    <tr v-for="(ch, idx) in addedChassis" :key="'ch'+ch.chassis_id" class="bg-white dark:bg-card">
                                        <td class="px-3 py-2 text-gray-500 dark:text-gray-400">🚗 Chasis</td>
                                        <td class="px-3 py-2 text-gray-900 dark:text-white">{{ ch.make }} {{ ch.model }}</td>
                                        <td class="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{{ ch.chassis }}</td>
                                        <td class="px-2 py-2 text-center">
                                            <button type="button" @click="removeChassis(idx)" class="text-red-400 hover:text-red-600">✕</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            <!-- ══ SECTION 5: Atributos ══ -->
            <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-indigo-500">
                <div class="mb-3 flex items-center justify-between gap-3">
                    <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                        <Wrench class="w-4 h-4" /> Atributos
                    </h2>
                    <button
                        type="button"
                        @click="addCustomAttribute"
                        class="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                        <Plus class="h-3.5 w-3.5" /> Agregar atributo
                    </button>
                </div>
                <div v-if="variantAttributes.length === 0" class="rounded-md border border-dashed border-gray-300 dark:border-border px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    Puedes agregar atributos manualmente o seleccionar una categoría con atributos por defecto.
                </div>
                <div v-else class="space-y-3">
                    <div v-for="(attr, index) in variantAttributes" :key="index" class="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                        <div class="sm:col-span-4">
                            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                Nombre del atributo
                                <span v-if="attr.required" class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="attr.name"
                                type="text"
                                :required="attr.required"
                                class="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white"
                                placeholder="Ej: Amperaje"
                            />
                        </div>
                        <div class="sm:col-span-5">
                            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                Valor
                                <span v-if="attr.required" class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="attr.value"
                                type="text"
                                :required="attr.required"
                                class="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white"
                                :placeholder="attr.name ? `${attr.name}...` : 'Valor'"
                            />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Unidad</label>
                            <input
                                v-model="attr.unit"
                                type="text"
                                class="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-border dark:bg-muted dark:text-white"
                                placeholder="Ej: A"
                            />
                        </div>
                        <div class="sm:col-span-1">
                            <button
                                type="button"
                                @click="removeVariantAttribute(index)"
                                class="w-full rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                title="Quitar atributo"
                            >
                                <X class="mx-auto h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ══ SECTION 6: Upsales ══ -->
            <div class="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-border dark:bg-card border-l-4 border-l-violet-500">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500">Upsales</h2>

                <div class="grid gap-4 sm:grid-cols-12 items-end">
                    <div class="sm:col-span-6">
                        <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Buscar producto <span class="text-red-500">*</span></label>
                        <AsyncProductCombobox :model-value="selectedUpsaleProduct?.id ?? null" @select="selectedUpsaleProduct = $event" />
                    </div>
                    <div class="sm:col-span-3">
                        <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo de relación</label>
                        <select v-model="upsaleRelationshipType"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white">
                            <option value="compatible">Compatible</option>
                            <option value="substitute">Sustituto</option>
                            <option value="upgrade">Upgrade</option>
                        </select>
                    </div>
                    <div class="sm:col-span-3">
                        <button type="button" @click="addUpsale" :disabled="!selectedUpsaleProduct"
                            class="w-full rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-40">
                            Agregar upsale
                        </button>
                    </div>
                </div>

                <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background">
                    <div v-if="pendingUpsales.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No hay upsales pendientes por vincular.
                    </div>
                    <table v-else class="w-full text-left text-sm">
                        <thead class="bg-gray-50 dark:bg-card">
                            <tr>
                                <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Producto</th>
                                <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Relacion</th>
                                <th class="w-12 px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                            <tr v-for="item in pendingUpsales" :key="item.id">
                                <td class="px-4 py-2 text-gray-900 dark:text-white">
                                    <span class="font-mono">{{ item.sku_base }}</span>
                                    <span class="text-gray-500"> - {{ item.name }}</span>
                                </td>
                                <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ getUpsaleRelationshipLabel(item.relationship_type) }}</td>
                                <td class="px-4 py-2 text-right">
                                    <button type="button" @click="removeUpsale(item.id)" class="text-red-500 hover:text-red-700" title="Quitar upsale">
                                        <X class="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ══ SECTION 7: Notas ══ -->
            <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-slate-400">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Notas</h2>
                <textarea v-model="form.description" rows="3"
                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white resize-none"
                    placeholder="Notas internas del producto..."></textarea>
            </div>

            <!-- ══ SECTION 8: Imagen del Producto ══ -->
            <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500">Imagen del Producto</h2>
                    <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90">
                        Seleccionar imágenes
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden" @change="handlePendingImageSelection" />
                    </label>
                </div>

                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Las imágenes se cargarán automáticamente al crear el producto.
                </p>

                <div v-if="pendingImages.length === 0" class="rounded-md border border-dashed border-gray-300 dark:border-border px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No hay imágenes seleccionadas.
                </div>
                <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div v-for="item in pendingImages" :key="item.tempId" class="relative rounded-lg overflow-hidden border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted">
                        <img :src="item.previewUrl" :alt="item.file.name" class="h-28 w-full object-cover" />
                        <button type="button" @click="removePendingImage(item.tempId)"
                            class="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 hover:bg-black/80" title="Quitar imagen">
                            <X class="h-3 w-3" />
                        </button>
                        <p class="px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300 truncate" :title="item.file.name">{{ item.file.name }}</p>
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
                            <p class="text-xs text-gray-500 dark:text-gray-400">Agrega variantes adicionales con su propia marca, precios e inventario. Se guardarán junto con el producto.</p>
                        </div>
                    </div>
                </div>
                <div class="px-5 pb-5">
                    <VariantManager
                        :category-id="form.category_id"
                        :sku-base="form.sku_base || undefined"
                        :product-name="form.name"
                        :category-formula="categoryFormula"
                        :category-applies-itbm="categoryAppliesItbm"
                        :category-itbm-percent="categoryItbmPercent"
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
                       inlineModal === 'vehicleEngine' ? 'Nuevo Motor' :
                              inlineModal === 'vehicleChassis' ? 'Nuevo VIN/Chasis' : '' }}
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
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <Label>Chasis (Opcional)</Label>
                            <button
                                type="button"
                                @click="openModelChassisQuickCreate"
                                class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                title="Crear nuevo chasis"
                            >
                                <Plus class="h-3 w-3" />
                                Crear
                            </button>
                        </div>
                        <SearchableSelect
                            :options="vehicleChassisCatalogOptions"
                            :model-value="selectedModelGenerationChassisId"
                            @update:model-value="v => selectedModelGenerationChassisId = v as number | null"
                            :loading="loadingVehicleChassisCatalog"
                            placeholder="-- Selecciona chasis --"
                            search-placeholder="Buscar chasis..."
                            :clearable="true"
                        />
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
                <template v-if="inlineModal === 'vehicleChassis'">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>VIN / Código de Chasis <span class="text-red-500">*</span></Label>
                            <Input v-model="inlineForm.code" required placeholder="Ej: P90 o JTDBR32E..." />
                        </div>
                        <div class="space-y-2">
                            <Label>Descripción Adicional</Label>
                            <Input v-model="inlineForm.name" placeholder="Ej: Serie P90 o generación" />
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
