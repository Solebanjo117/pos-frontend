<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useProducts } from '@/composables/useProducts'
import apiClient from '@/services/api/client'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const props = defineProps<{
    productId: number
    categoryId?: number
    skuBase?: string
}>()

const { fetchVariants, createVariant, updateVariant, deleteVariant, loading, error } = useProducts()

const variants = ref<any[]>([])
const showModal = ref(false)
const editingVariant = ref<any>(null)
const processing = ref(false)

// Attributes for the variant being created/edited
const variantAttributes = ref<{ name: string; value: string; unit: string; required?: boolean }[]>([])
const newAttrName = ref('')
const newAttrValue = ref('')
const newAttrUnit = ref('')

// Form Data
const form = ref({
    brand_id: 1,
    sku: '',
    upc: '',
    status: 'active',
    pricing: {
        base_price: 0,
        tax_rate: 7,
        tax_type: 'standard' as 'standard' | 'exempt' | 'custom',
    },
    initial_inventory: [
        {
            warehouse_id: 1,
            stock_available: 0,
            reorder_point: 5,
            reorder_quantity: 10,
        }
    ]
})

// Brand options — fetched from API
const brands = ref<{ id: number; name: string }[]>([])
const loadingBrands = ref(false)

const fetchBrands = async () => {
    loadingBrands.value = true
    try {
        const { data } = await apiClient.get('/brands/all')
        brands.value = data.data ?? data
    } catch { brands.value = [] }
    finally { loadingBrands.value = false }
}

// Category default attributes
const categoryDefaults = ref<{ name: string; unit: string; required: boolean }[]>([])
const loadingCategoryDefaults = ref(false)

const fetchCategoryDefaults = async (categoryId: number | undefined) => {
    if (!categoryId) { categoryDefaults.value = []; return }
    loadingCategoryDefaults.value = true
    try {
        const resp = await apiClient.get(`/categories/${categoryId}`)
        const cat = resp.data
        if (cat.default_attributes && Array.isArray(cat.default_attributes)) {
            categoryDefaults.value = cat.default_attributes.map((attr: any) => ({
                name: attr.name,
                unit: attr.unit || '',
                required: attr.required || false,
            }))
        } else { categoryDefaults.value = [] }
    } catch { categoryDefaults.value = [] }
    finally { loadingCategoryDefaults.value = false }
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

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

// === Auto Variant SKU ===
const autoVariantSku = computed(() => {
    const base = props.skuBase || ''
    if (!base) return ''
    const brand = brands.value.find(b => b.id === form.value.brand_id)
    if (!brand) return base
    const brandCode = brand.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
    const attrParts = variantAttributes.value
        .filter(a => a.value.trim())
        .map(a => a.value.trim().substring(0, 8))
        .join('-')
    return `${base}-${brandCode}${attrParts ? '-' + attrParts : ''}`
})

const previousAutoSku = ref('')

const loadVariants = async () => {
    try {
        const data = await fetchVariants(props.productId)
        variants.value = data
    } catch (e) {
        console.error('Error loading variants', e)
    }
}

const addAttribute = () => {
    if (!newAttrName.value.trim() || !newAttrValue.value.trim()) return
    variantAttributes.value.push({
        name: newAttrName.value.trim(),
        value: newAttrValue.value.trim(),
        unit: newAttrUnit.value.trim(),
    })
    newAttrName.value = ''; newAttrValue.value = ''; newAttrUnit.value = ''
}

const removeAttribute = (idx: number) => variantAttributes.value.splice(idx, 1)

const openCreateModal = () => {
    editingVariant.value = null
    // Pre-populate attributes from category defaults
    variantAttributes.value = categoryDefaults.value.map(d => ({
        name: d.name,
        value: '',
        unit: d.unit,
        required: d.required,
    }))
    form.value = {
        brand_id: brands.value[0]?.id ?? 1,
        sku: '',
        upc: '',
        status: 'active',
        pricing: {
            base_price: 0,
            tax_rate: 7,
            tax_type: 'standard',
        },
        initial_inventory: [
            {
                warehouse_id: 1,
                stock_available: 0,
                reorder_point: 5,
                reorder_quantity: 10,
            }
        ]
    }
    // Auto-fill SKU after brand is set
    previousAutoSku.value = autoVariantSku.value
    form.value.sku = autoVariantSku.value
    showModal.value = true
}

const openEditModal = (variant: any) => {
    editingVariant.value = variant
    // Load existing attributes + merge category defaults as guides for missing ones
    const existingAttrs = (variant.attributes || []).map((a: any) => ({
        name: a.name,
        value: a.value,
        unit: a.unit || '',
    }))
    const existingNames = new Set(existingAttrs.map((a: any) => a.name.toLowerCase()))
    const missingDefaults = categoryDefaults.value
        .filter(d => !existingNames.has(d.name.toLowerCase()))
        .map(d => ({ name: d.name, value: '', unit: d.unit, required: d.required }))
    variantAttributes.value = [...existingAttrs, ...missingDefaults]

    const p = variant.pricing
    form.value = {
        brand_id: variant.brand_id,
        sku: variant.sku,
        upc: variant.upc || '',
        status: variant.status,
        pricing: {
            base_price: p?.base_price ?? 0,
            tax_rate: p?.tax_rate ?? 7,
            tax_type: (p as any)?.tax_type || 'standard',
        },
        initial_inventory: []
    }

    // Trigger tax calc
    computed_total.value = Math.round(((p?.base_price ?? 0) * (1 + (p?.tax_rate ?? 7) / 100)) * 100) / 100

    previousAutoSku.value = variant.sku
    showModal.value = true
}

// Watch brand changes to auto-update SKU (only for new variants or if SKU hasn't been manually changed)
watch(
    [() => form.value.brand_id, () => variantAttributes.value],
    () => {
        if (!editingVariant.value && (!form.value.sku || form.value.sku === previousAutoSku.value)) {
            form.value.sku = autoVariantSku.value
            previousAutoSku.value = autoVariantSku.value
        }
    },
    { deep: true }
)

const handleSubmit = async () => {
    processing.value = true
    try {
        const payload = {
            ...form.value,
            attributes: variantAttributes.value.filter(a => a.name.trim() && a.value.trim()),
        }
        if (editingVariant.value) {
            await updateVariant(props.productId, editingVariant.value.id, payload)
        } else {
            await createVariant(props.productId, payload)
        }
        await loadVariants()
        showModal.value = false
    } catch (e) {
        console.error(e)
    } finally {
        processing.value = false
    }
}

const handleDelete = async (variant: any) => {
    if (!confirm(`¿Estás seguro de eliminar la variante ${variant.brand?.name}?`)) return

    try {
        await deleteVariant(props.productId, variant.id)
        await loadVariants()
    } catch (e) {
        console.error(e)
        alert('No se pudo eliminar la variante. Puede que sea la variante por defecto o tenga historial.')
    }
}


onMounted(async () => {
    await Promise.all([
        loadVariants(),
        fetchBrands(),
        fetchCategoryDefaults(props.categoryId),
    ])
})
</script>

<template>
    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div class="mb-6 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Variantes (Marcas)</h2>
            <Button @click="openCreateModal">
                Agregar Variante
            </Button>
        </div>

        <div v-if="loading && !variants.length" class="flex justify-center py-8">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        </div>

        <div v-else-if="variants.length === 0" class="text-center py-8 text-gray-500">
            No hay variantes registradas.
        </div>

        <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                <thead class="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th class="px-6 py-3">Marca</th>
                        <th class="px-6 py-3">SKU</th>
                        <th class="px-6 py-3">Atributos</th>
                        <th class="px-6 py-3">Precio</th>
                        <th class="px-6 py-3">Stock Total</th>
                        <th class="px-6 py-3">Estado</th>
                        <th class="px-6 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="variant in variants" :key="variant.id" class="border-b bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-600">
                        <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {{ variant.brand?.name }}
                            <span v-if="variant.is_default" class="ml-2 rounded bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">Default</span>
                        </td>
                        <td class="px-6 py-4 font-mono text-xs">{{ variant.sku }}</td>
                        <td class="px-6 py-4">
                            <div v-if="variant.attributes?.length" class="flex flex-wrap gap-1">
                                <span v-for="attr in variant.attributes" :key="attr.id"
                                    class="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                                    {{ attr.name }}: {{ attr.value }}{{ attr.unit ? ` ${attr.unit}` : '' }}
                                </span>
                            </div>
                            <span v-else class="text-gray-400 text-xs">—</span>
                        </td>
                        <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {{ variant.pricing ? formatCurrency(variant.pricing.base_price) : '—' }}
                        </td>
                        <td class="px-6 py-4">
                            {{ variant.inventory?.reduce((sum: number, i: any) => sum + i.quantity_available, 0) || 0 }}
                        </td>
                        <td class="px-6 py-4">
                             <span
                                :class="{
                                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': variant.status === 'active',
                                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': variant.status === 'discontinued',
                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': variant.status === 'pending',
                                }"
                                class="rounded px-2.5 py-0.5 text-xs font-medium"
                            >
                                {{ variant.status }}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                            <button @click="openEditModal(variant)" class="font-medium text-blue-600 hover:underline dark:text-blue-500 mr-3">Editar</button>
                            <button
                                v-if="!variant.is_default"
                                @click="handleDelete(variant)"
                                class="font-medium text-red-600 hover:underline dark:text-red-500"
                            >
                                Eliminar
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Create/Edit Modal -->
        <Dialog :open="showModal" @update:open="showModal = $event">
            <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{{ editingVariant ? 'Editar Variante' : 'Nueva Variante' }}</DialogTitle>
                    <DialogDescription>
                        Marca, atributos técnicos, SKU y precios de esta variante.
                    </DialogDescription>
                </DialogHeader>

                <form @submit.prevent="handleSubmit" class="space-y-4 py-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Brand -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Marca</label>
                            <select
                                v-model="form.brand_id"
                                :disabled="!!editingVariant"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                required
                            >
                                <option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
                            </select>
                        </div>

                        <!-- SKU (Auto-generated) -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                SKU Variante
                                <span v-if="!editingVariant && autoVariantSku" class="text-xs text-green-600 dark:text-green-400 ml-1">(auto-generado)</span>
                            </label>
                            <input
                                v-model="form.sku"
                                type="text"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
                                :placeholder="autoVariantSku || 'Se genera automáticamente'"
                                required
                            />
                            <p v-if="skuBase" class="mt-1 text-xs text-gray-400">Base: {{ skuBase }}</p>
                        </div>

                        <!-- Custom SKU (was UPC) -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Custom SKU</label>
                            <input
                                v-model="form.upc"
                                type="text"
                                placeholder="SKU personalizado del proveedor (opcional)"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                         <!-- Status -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                            <select
                                v-model="form.status"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="active">Activo</option>
                                <option value="discontinued">Discontinuado</option>
                                <option value="pending">Pendiente</option>
                            </select>
                        </div>
                    </div>

                    <!-- ═══ Attributes Section ═══ -->
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                            🔧 Especificaciones Técnicas
                            <span v-if="loadingCategoryDefaults" class="text-xs text-gray-400 animate-pulse">cargando guías...</span>
                        </h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            {{ categoryDefaults.length > 0
                                ? 'Los campos marcados con * son sugeridos por la categoría. Completa los valores.'
                                : 'Atributos propios de esta marca/variante (ej: Amperaje, Voltaje, Diámetro)' }}
                        </p>

                        <!-- Category-guided attribute fields (pre-filled from defaults) -->
                        <div v-if="variantAttributes.length > 0" class="space-y-2 mb-3">
                            <div v-for="(attr, idx) in variantAttributes" :key="idx"
                                class="grid grid-cols-12 gap-2 items-center">
                                <div class="col-span-4">
                                    <input v-model="attr.name" type="text" placeholder="Nombre"
                                        class="w-full rounded-md border-gray-300 text-sm px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        :class="attr.required ? 'border-amber-300 dark:border-amber-600' : ''" />
                                </div>
                                <div class="col-span-4">
                                    <input v-model="attr.value" type="text" :placeholder="attr.required ? 'Requerido *' : 'Valor'"
                                        class="w-full rounded-md border-gray-300 text-sm px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        :class="attr.required && !attr.value ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10' : ''" />
                                </div>
                                <div class="col-span-2">
                                    <input v-model="attr.unit" type="text" placeholder="Unidad"
                                        class="w-full rounded-md border-gray-300 text-sm px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div class="col-span-2 flex justify-end">
                                    <button type="button" @click="removeAttribute(idx)"
                                        class="rounded-md bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 px-2 py-1.5 text-xs transition">✕</button>
                                </div>
                            </div>
                        </div>

                        <!-- Add custom attribute row -->
                        <div class="grid grid-cols-12 gap-2">
                            <div class="col-span-4">
                                <input v-model="newAttrName" type="text" placeholder="Nombre (ej: Amperaje)"
                                    class="w-full rounded-md border-gray-300 text-sm px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    @keyup.enter="addAttribute" />
                            </div>
                            <div class="col-span-4">
                                <input v-model="newAttrValue" type="text" placeholder="Valor (ej: 90)"
                                    class="w-full rounded-md border-gray-300 text-sm px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    @keyup.enter="addAttribute" />
                            </div>
                            <div class="col-span-2">
                                <input v-model="newAttrUnit" type="text" placeholder="Unidad"
                                    class="w-full rounded-md border-gray-300 text-sm px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    @keyup.enter="addAttribute" />
                            </div>
                            <div class="col-span-2">
                                <button type="button" @click="addAttribute" :disabled="!newAttrName.trim() || !newAttrValue.trim()"
                                    class="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition">
                                    + Agregar
                                </button>
                            </div>
                        </div>

                        <p v-if="variantAttributes.length === 0" class="text-xs text-gray-400 italic mt-2">Sin atributos. Agrega especificaciones si aplica.</p>
                    </div>

                    <!-- ═══ Pricing Section (3-way calculator) ═══ -->
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">💰 Precios de esta Variante</h4>

                        <!-- Tax type toggle -->
                        <div class="flex gap-2 mb-4">
                            <button type="button" @click="onTaxTypeChange('standard')"
                                :class="form.pricing.tax_type === 'standard' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'"
                                class="rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
                                ITBM 7%
                            </button>
                            <button type="button" @click="onTaxTypeChange('exempt')"
                                :class="form.pricing.tax_type === 'exempt' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-1 ring-green-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'"
                                class="rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
                                Exento
                            </button>
                            <button type="button" @click="onTaxTypeChange('custom')"
                                :class="form.pricing.tax_type === 'custom' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'"
                                class="rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
                                Custom
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Precio Base <span class="text-xs text-gray-400">(sin ITBM)</span></label>
                                <div class="relative mt-1">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <input v-model.number="form.pricing.base_price" type="number" step="0.01" min="0"
                                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white pl-7" />
                                </div>
                            </div>

                            <!-- Precio Total (con ITBM) -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Precio Total <span class="text-xs text-green-500 font-semibold">(con ITBM)</span></label>
                                <div class="relative mt-1">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 text-sm font-semibold">$</span>
                                    <input :value="computed_total" @input="onTotalChange(Number(($event.target as HTMLInputElement).value))"
                                        type="number" step="0.01" min="0"
                                        class="block w-full rounded-md border-green-300 dark:border-green-700 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-green-300 pl-7 font-semibold" />
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <!-- Tax Rate -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">% ITBM</label>
                                <input v-model.number="form.pricing.tax_rate" type="number" step="0.01" min="0" max="100"
                                    :disabled="form.pricing.tax_type !== 'custom'"
                                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50" />
                            </div>
                        </div>
                    </div>

                    <!-- Initial Inventory (Only for create) -->
                    <div v-if="!editingVariant" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">📦 Inventario Inicial</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock Disponible</label>
                                <input
                                    v-model.number="form.initial_inventory[0].stock_available"
                                    type="number" step="1" min="0"
                                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Error display -->
                    <div v-if="error" class="text-red-500 text-sm mt-2">{{ error }}</div>

                    <div class="mt-6 flex justify-end space-x-3">
                        <Button
                            type="button"
                            variant="outline"
                            @click="showModal = false"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            :disabled="processing"
                        >
                            {{ processing ? 'Guardando...' : 'Guardar' }}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    </div>
</template>
