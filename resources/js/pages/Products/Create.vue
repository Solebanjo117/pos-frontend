<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import { useToast } from '@/composables/useToast'
import type { CreateProductRequest, Product } from '@/types/product'
import type { Category } from '@/types/category'
import type { Brand } from '@/types/brand'
import apiClient from '@/services/api/client'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import AsyncProductCombobox from '@/components/AsyncProductCombobox.vue'
import PricingFormula from '@/components/Products/PricingFormula.vue'
import VariantManager from '@/components/Products/VariantManager.vue'
import VehicleCompatSection from '@/components/Products/VehicleCompatSection.vue'
import VehicleInlineModals from '@/components/Products/VehicleInlineModals.vue'
import ProductImagesSection from '@/components/Products/ProductImagesSection.vue'
import type { DraftCompatData } from '@/components/Products/VehicleCompatSection.vue'
import type { PendingImage } from '@/components/Products/ProductImagesSection.vue'
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
    engine_id: undefined,
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
        sale_tax_rate: 7,
        cost_tax_rate: 7,
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
    const rate = Number((p as any).sale_tax_rate ?? p.tax_rate) || 0
    return Number((base * (1 + rate / 100)).toFixed(2))
})

const onFormulaTotalChange = (newTotal: number) => {
    custom_total.value = newTotal
}

watch(() => form.value.pricing.base_price, () => { custom_total.value = null })
watch(() => form.value.pricing.tax_rate, () => { custom_total.value = null })
watch(() => (form.value.pricing as any).sale_tax_rate, () => { custom_total.value = null })
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
    const sku = form.value.sku_base?.trim()

    if (!sku) {
        duplicates.value = []
        return
    }

    checkingDuplicates.value = true
    try {
        const response = await apiClient.get('/products/check-duplicate', {
            params: { sku }
        })
        duplicates.value = response.data.data || []
    } catch (e) {
        console.error('Error checking duplicates:', e)
        duplicates.value = []
    } finally {
        checkingDuplicates.value = false
    }
}

watch(() => form.value.sku_base, () => {
    if (duplicateCheckTimeout) {
        clearTimeout(duplicateCheckTimeout)
    }
    duplicateCheckTimeout = setTimeout(() => {
        checkDuplicates()
    }, 600)
})

const nameManuallyEdited = ref(false)
const onNameInput = () => { nameManuallyEdited.value = true }

// === Vehicle compatibility (draft mode via component) ===
const vehicleCompatRef = ref<InstanceType<typeof VehicleCompatSection> | null>(null)
const vehicleModalsRef = ref<InstanceType<typeof VehicleInlineModals> | null>(null)
const vehicleModalType = ref<'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis' | null>(null)

const vehicleCompat = ref<DraftCompatData>({
    engines: [],
    chassis: [],
    allEngines: false,
    allChassis: false,
    isUniversal: false,
})

const openVehicleInline = (type: 'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis') => {
    vehicleModalType.value = type
    vehicleModalsRef.value?.open(type)
}

const closeVehicleInline = () => {
    vehicleModalType.value = null
}

const onMakeCreated = (make: { id: number; name: string }) => {
    vehicleCompatRef.value?.addMake(make)
    vehicleModalType.value = null
}

const onModelCreated = (model: any) => {
    vehicleCompatRef.value?.addModel(model)
    vehicleModalType.value = null
}

const onEngineCreated = (engine: any) => {
    vehicleCompatRef.value?.addEngine(engine)
    vehicleModalType.value = null
}

const onChassisCreated = (chassis: any) => {
    vehicleCompatRef.value?.addChassisToList(chassis)
}

// === Name preview helpers ===
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

const formatYearRange = (model?: { year_from?: number; year_to?: number; generation?: string } | null): string => {
    const from = model?.year_from
    const to = model?.year_to
    if (from && to) return from === to ? `${from}` : `${from}-${to}`
    if (from) return `${from}`
    if (to) return `${to}`
    return ''
}

const getModelChassis = (model?: { generation?: string } | null): string => {
    return String(model?.generation ?? '').trim()
}

const engineCategoryKeywords = [
    'motor', 'piston', 'pistón', 'biela', 'cigueñal', 'cigüeñal', 'culata',
    'valvula', 'válvula', 'arbol de levas', 'árbol de levas', 'empaque',
    'junta de culata', 'bomba de aceite', 'cadena', 'correa', 'timing',
    'engine', 'piston ring', 'anillo',
]

const normalizeTextKey = (value: string): string => {
    return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

const isEngineCategory = (categoryName?: string): boolean => {
    const normalizedCategory = normalizeTextKey(String(categoryName ?? ''))
    if (!normalizedCategory) return false
    return engineCategoryKeywords.some(keyword => normalizedCategory.includes(normalizeTextKey(keyword)))
}

const toTwoDigitYearRange = (yearValue?: string): string => {
    const raw = String(yearValue ?? '').trim()
    if (!raw) return ''
    const years = Array.from(raw.matchAll(/\d{4}/g)).map(match => match[0].slice(-2))
    if (years.length >= 2) return `${years[0]}-${years[1]}`
    if (years.length === 1) {
        if (raw.includes('+')) return `${years[0]}+`
        return years[0]
    }
    return raw
}

const buildChassisLevelLabel = (entry: { make?: string; model?: string; year?: string; chassis?: string }): string => {
    const make = String(entry.make ?? '').trim()
    const model = String(entry.model ?? '').trim()
    const year = toTwoDigitYearRange(entry.year)
    if (!make || !model) return ''
    return `${make} ${model}${year ? ` ${year}` : ''}`
}

const buildEngineLevelLabel = (entry: { make?: string; engine?: string; model?: string; year?: string; chassis?: string }): string => {
    const make = String(entry.make ?? '').trim()
    const model = String(entry.model ?? '').trim()
    const engine = String(entry.engine ?? '').trim()
    const year = toTwoDigitYearRange(entry.year)
    if (!make || !model) return ''
    if (engine) return `${engine} ${make} ${model}${year ? ` ${year}` : ''}`
    return `${make} ${model}${year ? ` ${year}` : ''}`
}

const namePreview = computed(() => {
    const catId = (form.value as any).category_id
    const categoryName = categories.value.find(c => c.id === catId)?.name || 'Producto sin nombre'
    const engineCategory = isEngineCategory(categoryName)

    const addedEngines = vehicleCompat.value.engines
    const addedChassis = vehicleCompat.value.chassis
    const allEnginesFlag = vehicleCompat.value.allEngines
    const allChassisFlag = vehicleCompat.value.allChassis

    const selectedMake = vehicleCompatRef.value?.vehicleMakes?.find(m => m.id === vehicleCompatRef.value?.selectedMakeId)?.name || ''
    const selectedModel = vehicleCompatRef.value?.vehicleModels?.find(m => m.id === vehicleCompatRef.value?.selectedModelId)
    const selectedModelName = selectedModel?.name || ''
    const selectedYear = formatYearRange(selectedModel)
    const selectedChassis = getModelChassis(selectedModel)

    const chassisLabels = addedChassis.map(entry => buildChassisLevelLabel(entry)).filter(Boolean)
    const engineLabels = addedEngines.map(entry => engineCategory ? buildEngineLevelLabel(entry) : buildChassisLevelLabel(entry)).filter(Boolean)

    if (allChassisFlag && selectedModelName) {
        const allChassisLabel = buildChassisLevelLabel({
            make: selectedMake, model: selectedModelName, year: selectedYear,
            chassis: selectedChassis || 'todos los chasis',
        })
        if (allChassisLabel) chassisLabels.push(allChassisLabel)
    }

    if (allEnginesFlag && selectedModelName) {
        const allEnginesLabel = engineCategory
            ? buildEngineLevelLabel({
                make: selectedMake, engine: 'todos los motores', model: selectedModelName,
                year: selectedYear, chassis: selectedChassis || 'todos los chasis',
            })
            : buildChassisLevelLabel({
                make: selectedMake, model: selectedModelName, year: selectedYear, chassis: selectedChassis,
            })
        if (allEnginesLabel) engineLabels.push(allEnginesLabel)
    }

    const compatibilityLabels = [...new Set([...chassisLabels, ...engineLabels])]
    if (compatibilityLabels.length === 0) return categoryName

    const displayed = compatibilityLabels.slice(0, 3).join(', ')
    const suffix = compatibilityLabels.length > 3 ? ' y más' : ''
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

watch(
    () => form.value.pricing.cost,
    async (newCost) => {
        if (priceManuallyEdited.value) return
        const cost = Number(newCost) || 0
        if (cost <= 0) return

        if (categoryFormula.value) {
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
            form.value.pricing.base_price = applyRounding(Number((cost * (1 + categoryMargin.value / 100)).toFixed(2)))
        }
    }
)

// === OEM refs (draft) ===
type PendingOemReference = { oem_code: string; manufacturer: string | null }
const addedRefs = ref<PendingOemReference[]>([])
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
    addedRefs.value.push({ oem_code: code, manufacturer })
    refInput.value = ''
    refManufacturerInput.value = null
}
const removeRef = (idx: number) => addedRefs.value.splice(idx, 1)

// === Upsales (draft) ===
type UpsaleRelationship = 'compatible' | 'substitute' | 'upgrade'
type PendingUpsale = { id: number; sku_base: string; name: string; relationship_type: UpsaleRelationship }

const selectedUpsaleProduct = ref<Product | null>(null)
const upsaleRelationshipType = ref<UpsaleRelationship>('compatible')
const pendingUpsales = ref<PendingUpsale[]>([])

const addUpsale = () => {
    if (!selectedUpsaleProduct.value) return
    const selected = selectedUpsaleProduct.value
    if (pendingUpsales.value.some(item => item.id === selected.id)) return
    pendingUpsales.value.push({
        id: selected.id, sku_base: selected.sku_base,
        name: selected.name, relationship_type: upsaleRelationshipType.value,
    })
    selectedUpsaleProduct.value = null
    upsaleRelationshipType.value = 'compatible'
}

const removeUpsale = (productId: number) => {
    pendingUpsales.value = pendingUpsales.value.filter(item => item.id !== productId)
}

const getUpsaleRelationshipLabel = (type: UpsaleRelationship): string => {
    const labels: Record<UpsaleRelationship, string> = {
        compatible: 'Compatible', substitute: 'Sustituto', upgrade: 'Upgrade',
    }
    return labels[type]
}

// === Images (draft via component) ===
const pendingImages = ref<PendingImage[]>([])

// === Inline modals for Category & Brand (Create-only) ===
const inlineModal = ref<'category' | 'brand' | null>(null)
const inlineForm = ref<Record<string, any>>({})
const inlineProcessing = ref(false)
const inlineError = ref<string | null>(null)

const openInline = (type: 'category' | 'brand') => {
    inlineModal.value = type
    inlineError.value = null
    inlineProcessing.value = false
    if (type === 'category') inlineForm.value = { name: '', parent_id: null }
    else if (type === 'brand') inlineForm.value = { name: '' }
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

    try {
        const response = await apiClient.get('/warehouses')
        const warehouses = response.data.data || response.data
        if (Array.isArray(warehouses) && warehouses.length > 0 && form.value.initial_inventory && form.value.initial_inventory.length > 0) {
            form.value.initial_inventory[0].warehouse_id = warehouses[0].id
        }
    } catch (e) { console.error('Error loading warehouses:', e) }
})

// Draft variants from VariantManager in draft mode
const pendingVariants = ref<any[]>([])
const onDraftVariantsChanged = (variants: any[]) => {
    pendingVariants.value = variants
}

const handleSubmit = async () => {
    validationErrors.value = {}
    successMessage.value = ''

    if (form.value.brand_id && !form.value.initial_inventory?.[0]?.warehouse_id) {
        toast.error('Debes seleccionar un almacén cuando creas una variante con marca')
        return
    }

    try {
        const normalizedSaleTaxRate = Math.max(0, Math.min(100, Math.round(Number((form.value.pricing as any).sale_tax_rate ?? form.value.pricing.tax_rate ?? 7))))
        const normalizedCostTaxRate = Math.max(0, Math.min(100, Math.round(Number((form.value.pricing as any).cost_tax_rate ?? normalizedSaleTaxRate))))

        const payload = {
            ...form.value,
            pricing: {
                ...form.value.pricing,
                tax_rate: normalizedSaleTaxRate,
                sale_tax_rate: normalizedSaleTaxRate,
                cost_tax_rate: normalizedCostTaxRate,
            },
            sku: form.value.sku || form.value.sku_base || '',
            attributes: variantAttributes.value
                .map(a => ({
                    name: a.name.trim(),
                    value: a.value.trim(),
                    unit: (a.unit ?? '').trim(),
                }))
                .filter(a => a.name && a.value),
            vehicle_compatibility: vehicleCompat.value.engines.map(e => e.engine_id),
            vehicle_chassis: vehicleCompat.value.chassis.map(c => c.chassis_id),
            all_engines: vehicleCompat.value.allEngines,
            all_chassis: vehicleCompat.value.allChassis,
            is_universal: vehicleCompat.value.isUniversal,
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

        if (productId && pendingVariants.value.length > 0) {
            const failedVariants: string[] = []
            for (const variant of pendingVariants.value) {
                try {
                    await apiClient.post(`/products/${productId}/variants`, {
                        brand_id: variant.brand_id,
                        sku: variant.sku || '',
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
                            Productos con código similar encontrados. Verifica que no estés duplicando:
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

            <!-- SECTION 1: Descripcion -->
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

            <!-- SECTION 2: Codigo + Estado -->
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

            <!-- SECTION 3: Codigos alternos -->
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

            <!-- SECTION 4: Compatibilidad Vehicular -->
            <VehicleCompatSection
                ref="vehicleCompatRef"
                mode="draft"
                v-model="vehicleCompat"
                @open-inline="openVehicleInline"
            />

            <!-- SECTION 5: Variantes -->
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

            <!-- SECTION 6: Atributos -->
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
                        <div class="sm:col-span-5">
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
                        <div class="sm:col-span-6">
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

            <!-- SECTION 7: Upsales -->
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

            <!-- SECTION 8: Notas -->
            <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-slate-400">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Notas</h2>
                <textarea v-model="form.description" rows="3"
                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white resize-none"
                    placeholder="Notas internas del producto..."></textarea>
            </div>

            <!-- SECTION 9: Imagen del Producto -->
            <ProductImagesSection
                mode="pending"
                v-model="pendingImages"
            />

        </form>
    </div>

    <!-- Inline Creation Modal (Category & Brand only — vehicle modals use VehicleInlineModals) -->
    <Dialog :open="inlineModal !== null" @update:open="v => { if (!v) closeInline() }">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>
                    {{ inlineModal === 'category' ? 'Nueva Categoría' : inlineModal === 'brand' ? 'Nueva Marca de Artículo' : '' }}
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

                <div v-if="inlineError" class="text-sm text-red-600">{{ inlineError }}</div>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" @click="closeInline">Cancelar</Button>
                    <Button type="submit" :disabled="inlineProcessing">{{ inlineProcessing ? 'Guardando...' : 'Guardar' }}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>

    <!-- Vehicle Inline Modals -->
    <VehicleInlineModals
        ref="vehicleModalsRef"
        :current-modal="vehicleModalType"
        :selected-make-id="vehicleCompatRef?.selectedMakeId ?? null"
        :selected-model-id="vehicleCompatRef?.selectedModelId ?? null"
        @close="closeVehicleInline"
        @make-created="onMakeCreated"
        @model-created="onModelCreated"
        @engine-created="onEngineCreated"
        @chassis-created="onChassisCreated"
    />

    </AppLayout>
</template>
