<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useProducts } from '@/composables/useProducts'
import { useStoreSettings } from '@/composables/useStoreSettings'
import apiClient from '@/services/api/client'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import PricingFormula from '@/components/Products/PricingFormula.vue'
import { CircleDollarSign, Package } from 'lucide-vue-next'


const props = defineProps<{
    productId?: number
    categoryId?: number
    categoryMargin?: number | null
    categoryFormula?: string | null
    categoryAppliesItbm?: boolean
    categoryItbmPercent?: number | null
    skuBase?: string
    productName?: string
}>()

const emit = defineEmits<{
    'draft-variants-changed': [variants: any[]]
}>()

const { fetchVariants, createVariant, updateVariant, deleteVariant, loading, error } = useProducts()
const { settings: storeSettings, fetchSettings } = useStoreSettings()

// === Rounding helper — respects LL-013: only applied on auto-calc, never on manual input ===
const applyRounding = (price: number): number => {
    const increment = Number(storeSettings.value.price_rounding_increment) || 0
    if (increment <= 0) return price
    return Math.ceil(price / increment) * increment
}

// Draft mode (when no productId)
const draftVariants = ref<any[]>([])
const isDraftMode = computed(() => !props.productId)

const variants = ref<any[]>([])
const showModal = ref(false)
const editingVariant = ref<any>(null)
const processing = ref(false)

const modalInitialSnapshot = ref('')

// Form Data
const form = ref({
    brand_id: 1,
    sku: '',
    upc: '',
    status: 'active',
    pricing_formula: '' as string,
    pricing: {
        base_price: 0,
        msrp: 0,
        cost: 0,
        tax_rate: 7,
        tax_type: 'custom' as 'standard' | 'exempt' | 'custom',
        pricing_formula: '' as string,
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

const toSafeNumber = (value: any, fallback = 0): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

const buildModalStateSnapshot = (): string => {
    return JSON.stringify({
        form: {
            brand_id: form.value.brand_id ?? null,
            sku: form.value.sku ?? '',
            upc: form.value.upc ?? '',
            status: form.value.status ?? 'active',
            pricing_formula: form.value.pricing_formula ?? '',
            pricing: {
                base_price: toSafeNumber(form.value.pricing.base_price),
                msrp: toSafeNumber(form.value.pricing.msrp),
                cost: toSafeNumber(form.value.pricing.cost),
                tax_rate: toSafeNumber(form.value.pricing.tax_rate),
                tax_type: form.value.pricing.tax_type ?? 'custom',
            },
            initial_inventory: (form.value.initial_inventory ?? []).map((row: any) => ({
                warehouse_id: row.warehouse_id ?? null,
                stock_available: toSafeNumber(row.stock_available),
                reorder_point: toSafeNumber(row.reorder_point),
                reorder_quantity: toSafeNumber(row.reorder_quantity),
            })),
        },
    })
}

const captureModalInitialState = () => {
    modalInitialSnapshot.value = buildModalStateSnapshot()
}

const hasUnsavedModalChanges = (): boolean => {
    if (!showModal.value) return false
    return buildModalStateSnapshot() !== modalInitialSnapshot.value
}

const requestCloseModal = (force = false) => {
    if (!showModal.value) return

    if (!force && hasUnsavedModalChanges()) {
        const shouldClose = confirm('Tienes cambios sin guardar en la variante. ¿Quieres salir sin guardar?')
        if (!shouldClose) return
    }

    showModal.value = false
    modalInitialSnapshot.value = ''
}

const handleVariantModalOpenChange = (isOpen: boolean) => {
    if (isOpen) {
        showModal.value = true
        if (!modalInitialSnapshot.value) {
            captureModalInitialState()
        }
        return
    }

    requestCloseModal()
}

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

const brandOptions = computed(() => brands.value.map(b => ({ value: b.id, label: b.name })))

// Warehouses options — fetched from API
const warehouses = ref<{ id: number; name: string }[]>([])
const fetchWarehouses = async () => {
    try {
        const { data } = await apiClient.get('/warehouses/all')
        warehouses.value = data.data ?? data
    } catch { warehouses.value = [] }
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

const showCostWithItbm = ref(localStorage.getItem('variants_show_cost_with_itbm') === 'true')
const showPriceWithItbm = ref(localStorage.getItem('variants_show_price_with_itbm') === 'true')

const toggleCostItbmView = () => {
    showCostWithItbm.value = !showCostWithItbm.value
    localStorage.setItem('variants_show_cost_with_itbm', String(showCostWithItbm.value))
}

const togglePriceItbmView = () => {
    showPriceWithItbm.value = !showPriceWithItbm.value
    localStorage.setItem('variants_show_price_with_itbm', String(showPriceWithItbm.value))
}

const toSafeTaxRate = (value: any): number => {
    const parsed = toSafeNumber(value, 0)
    return Math.max(0, Math.min(100, parsed))
}

const withItbm = (amount: number, taxRate: number): number => {
    return Number((amount * (1 + taxRate / 100)).toFixed(2))
}

const getVariantCostAmount = (variant: any): number | null => {
    if (!variant?.pricing) return null

    const cost = toSafeNumber(variant.pricing.cost)
    if (!showCostWithItbm.value) return cost

    return withItbm(cost, toSafeTaxRate(variant.pricing.tax_rate))
}

const getVariantSaleAmount = (variant: any): number | null => {
    if (!variant?.pricing) return null

    const basePrice = toSafeNumber(variant.pricing.base_price)
    if (!showPriceWithItbm.value) return basePrice

    return withItbm(basePrice, toSafeTaxRate(variant.pricing.tax_rate))
}

const formatVariantCost = (variant: any): string => {
    const amount = getVariantCostAmount(variant)
    return amount === null ? '—' : formatCurrency(amount)
}

const formatVariantPrice = (variant: any): string => {
    const amount = getVariantSaleAmount(variant)
    return amount === null ? '—' : formatCurrency(amount)
}

// === Precio Final: PricingFormula es la única fuente de verdad ===
// Al recibir un nuevo precio calculado (sea fórmula o numero directo),
// lo almacenamos directamente en base_price para que el payload sea correcto.
const onFormulaTotalChange = (newTotal: number) => {
    form.value.pricing.base_price = newTotal
}

// SKU is now fully manual - no auto-generation

// === Auto Price Calculation from Category Margin ===
// Tracks whether the user manually typed a price in this modal session.
// Only reset when a new modal session opens (not when price reaches 0).
const priceManuallyEdited = ref(false)
const onBasePriceInput = () => { priceManuallyEdited.value = true }

const recalculatePriceFromCategory = async () => {
    const cost = Number(form.value.pricing.cost) || 0
    if (cost <= 0) { priceManuallyEdited.value = false; return }

    if (props.categoryFormula) {
        // Formula takes priority over margin
        try {
            const { data } = await apiClient.post('/categories/preview-price', {
                formula: props.categoryFormula,
                costo: cost,
                applies_itbm: props.categoryAppliesItbm ?? false,
                itbm_percent: props.categoryItbmPercent ?? 7,
            })
            if (data.price !== null) {
                form.value.pricing.base_price = applyRounding(data.price)
            }
        } catch { /* silencioso */ }
    } else {
        // Fallback: simple margin (LL-013)
        const margin = props.categoryMargin
        if (margin != null && margin > 0) {
            const raw = cost * (1 + margin / 100)
            form.value.pricing.base_price = applyRounding(Number(raw.toFixed(2)))
        }
    }
    priceManuallyEdited.value = false
}

// Auto-recalculate when cost changes (only if user hasn't manually overridden price)
watch(
    () => form.value.pricing.cost,
    async (newCost) => {
        if (priceManuallyEdited.value) return
        const cost = Number(newCost) || 0
        if (cost <= 0) return

        if (props.categoryFormula) {
            // Formula takes priority
            try {
                const { data } = await apiClient.post('/categories/preview-price', {
                    formula: props.categoryFormula,
                    costo: cost,
                    applies_itbm: props.categoryAppliesItbm ?? false,
                    itbm_percent: props.categoryItbmPercent ?? 7,
                })
                if (data.price !== null) {
                    form.value.pricing.base_price = applyRounding(data.price)
                }
            } catch { /* silencioso */ }
        } else {
            // Fallback: simple margin (LL-013)
            const margin = props.categoryMargin
            if (margin != null && margin > 0) {
                const raw = cost * (1 + margin / 100)
                form.value.pricing.base_price = applyRounding(Number(raw.toFixed(2)))
            }
        }
    }
)


const loadVariants = async () => {
    if (isDraftMode.value) return // draft mode: no API call
    try {
        const data = await fetchVariants(props.productId!)
        variants.value = data
    } catch (e) {
        console.error('Error loading variants', e)
    }
}

// In draft mode, variants displayed are draftVariants; in normal mode, fetched from API
const displayVariants = computed(() => isDraftMode.value ? draftVariants.value : variants.value)

const openCreateModal = () => {
    editingVariant.value = null

    form.value = {
        brand_id: brands.value[0]?.id ?? 1,
        sku: props.skuBase || '',
        upc: '',
        status: 'active',
        pricing_formula: props.categoryFormula || '',
        pricing: {
            base_price: 0,
            msrp: 0,
            cost: 0,
            tax_rate: (props.categoryAppliesItbm === false) ? 0 : (props.categoryItbmPercent ?? 7),
            tax_type: 'custom',
            pricing_formula: props.categoryFormula || '',
        },
        initial_inventory: warehouses.value.length > 0 ? [
            {
                warehouse_id: warehouses.value[0].id,
                stock_available: 0,
                reorder_point: 5,
                reorder_quantity: 10,
            }
        ] : []
    }
    priceManuallyEdited.value = false
    showModal.value = true
    captureModalInitialState()
}

const openEditModal = (variant: any) => {
    editingVariant.value = variant

    const p = variant.pricing
    form.value = {
        brand_id: variant.brand_id,
        sku: variant.sku,
        upc: variant.upc || '',
        status: variant.status,
        pricing_formula: p?.pricing_formula || '',
        pricing: {
            base_price: p?.base_price ?? 0,
            msrp: p?.msrp ?? 0,
            cost: p?.cost ?? 0,
            tax_rate: p?.tax_rate ?? 7,
            tax_type: (p as any)?.tax_type || 'standard',
            pricing_formula: p?.pricing_formula || '',
        },
        initial_inventory: []
    }

    // base_price ya se carga directo en form.pricing.base_price desde el backend

    showModal.value = true
    captureModalInitialState()
}

const handleSubmit = async () => {
    processing.value = true
    try {
        const pricingPayload = {
            ...form.value.pricing,
            pricing_formula: form.value.pricing_formula || null,
        }

        const payload = {
            ...form.value,
            pricing: pricingPayload,
            sku: form.value.sku || '',
        }

        if (isDraftMode.value) {
            // Draft mode: store locally, do not call API
            if (editingVariant.value !== null) {
                const idx = draftVariants.value.findIndex(v => v._draftId === editingVariant.value._draftId)
                if (idx >= 0) {
                    const brand = brands.value.find(b => b.id === payload.brand_id)
                    draftVariants.value[idx] = { ...payload, _draftId: editingVariant.value._draftId, brand }
                }
            } else {
                const brand = brands.value.find(b => b.id === payload.brand_id)
                draftVariants.value.push({ ...payload, _draftId: Date.now(), brand })
            }
            emit('draft-variants-changed', draftVariants.value)
            requestCloseModal(true)
        } else {
            if (editingVariant.value) {
                await updateVariant(props.productId!, editingVariant.value.id, payload)
            } else {
                await createVariant(props.productId!, payload)
            }
            await loadVariants()
            requestCloseModal(true)
        }
    } catch (e) {
        console.error(e)
    } finally {
        processing.value = false
    }
}

const handleDelete = async (variant: any) => {
    if (isDraftMode.value) {
        const idx = draftVariants.value.findIndex(v => v._draftId === variant._draftId)
        if (idx >= 0) draftVariants.value.splice(idx, 1)
        emit('draft-variants-changed', draftVariants.value)
        return
    }
    if (!confirm(`¿Estás seguro de eliminar la variante ${variant.brand?.name}?`)) return
    try {
        await deleteVariant(props.productId!, variant.id)
        await loadVariants()
    } catch (e) {
        console.error(e)
        alert('No se pudo eliminar la variante.')
    }
}

// === Inline Brand Creation ===
const showBrandModal = ref(false)
const newBrandName = ref('')
const creatingBrand = ref(false)
const brandError = ref<string | null>(null)

const openBrandModal = () => {
    newBrandName.value = ''
    brandError.value = null
    showBrandModal.value = true
}

const submitNewBrand = async () => {
    if (!newBrandName.value.trim()) { brandError.value = 'El nombre es requerido'; return }
    creatingBrand.value = true
    brandError.value = null
    try {
        const { data } = await apiClient.post('/brands', { name: newBrandName.value.trim() })
        const newBrand = data.data ?? data
        brands.value.push(newBrand)
        form.value.brand_id = newBrand.id
        showBrandModal.value = false
    } catch (e: any) {
        brandError.value = e.response?.data?.message || 'Error al crear la marca'
    } finally { creatingBrand.value = false }
}

onMounted(async () => {
    await Promise.all([
        loadVariants(),
        fetchBrands(),
        fetchWarehouses(),
        fetchSettings(),
    ])
})
</script>

<template>
    <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Variantes (Marcas)</h2>
            <div class="flex flex-wrap items-center gap-2">
                <div class="flex items-center gap-2 rounded-md border border-gray-200 dark:border-border bg-white dark:bg-muted/40 px-2.5 py-1.5">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Costo</span>
                    <button
                        type="button"
                        @click="toggleCostItbmView"
                        :class="[
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                            showCostWithItbm ? 'bg-emerald-500 focus:ring-emerald-400' : 'bg-gray-300 dark:bg-gray-600 focus:ring-gray-400'
                        ]"
                        :title="showCostWithItbm ? 'Mostrando costo con ITBM' : 'Mostrando costo base sin ITBM'"
                    >
                        <span
                            :class="[
                                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
                                showCostWithItbm ? 'translate-x-5' : 'translate-x-0.5'
                            ]"
                        />
                    </button>
                    <span class="text-[10px] font-medium" :class="showCostWithItbm ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'">
                        {{ showCostWithItbm ? '+ITBM' : 'Base' }}
                    </span>
                </div>

                <div class="flex items-center gap-2 rounded-md border border-gray-200 dark:border-border bg-white dark:bg-muted/40 px-2.5 py-1.5">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Precio</span>
                    <button
                        type="button"
                        @click="togglePriceItbmView"
                        :class="[
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                            showPriceWithItbm ? 'bg-emerald-500 focus:ring-emerald-400' : 'bg-gray-300 dark:bg-gray-600 focus:ring-gray-400'
                        ]"
                        :title="showPriceWithItbm ? 'Mostrando precio con ITBM' : 'Mostrando precio base sin ITBM'"
                    >
                        <span
                            :class="[
                                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
                                showPriceWithItbm ? 'translate-x-5' : 'translate-x-0.5'
                            ]"
                        />
                    </button>
                    <span class="text-[10px] font-medium" :class="showPriceWithItbm ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'">
                        {{ showPriceWithItbm ? '+ITBM' : 'Base' }}
                    </span>
                </div>

                <Button type="button" @click="openCreateModal">
                    Agregar Variante
                </Button>
            </div>
        </div>

        <div v-if="loading && !displayVariants.length" class="flex justify-center py-8">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent"></div>
        </div>

        <div v-else-if="displayVariants.length === 0" class="text-center py-8 text-gray-500">
            {{ isDraftMode ? 'Agrega variantes con el botón de arriba. Se crearán al guardar el producto.' : 'No hay variantes registradas.' }}
        </div>

        <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                <thead class="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-muted dark:text-gray-400">
                    <tr>
                        <!-- SKU oculto (R38: cliente usa SKU del producto padre) -->
                        <th class="px-6 py-3">Nombre</th>
                        <th class="px-6 py-3">Marca</th>
                        <th class="px-6 py-3">{{ showCostWithItbm ? 'Costo + ITBM' : 'Costo Base' }}</th>
                        <th class="px-6 py-3">{{ showPriceWithItbm ? 'Precio + ITBM' : 'Precio Base' }}</th>
                        <th class="px-6 py-3">Stock Total</th>
                        <th class="px-6 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="variant in displayVariants" :key="variant.id ?? variant._draftId" class="border-b bg-white hover:bg-gray-50 dark:border-border dark:bg-card dark:hover:bg-muted">
                        <!-- SKU cell oculto -->
                        <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {{ productName || 'Producto Base' }}
                        </td>
                        <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {{ variant.brand?.name }}
                            <span v-if="isDraftMode" class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Pendiente</span>
                        </td>
                        <td class="px-6 py-4 text-gray-600 dark:text-gray-400">
                            {{ formatVariantCost(variant) }}
                            <div v-if="showCostWithItbm && variant.pricing" class="text-[10px] text-gray-400 mt-0.5">
                                ITBM {{ toSafeTaxRate(variant.pricing.tax_rate).toFixed(2) }}%
                            </div>
                        </td>
                        <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {{ formatVariantPrice(variant) }}
                            <div v-if="showPriceWithItbm && variant.pricing" class="text-[10px] text-gray-400 mt-0.5 font-normal">
                                ITBM {{ toSafeTaxRate(variant.pricing.tax_rate).toFixed(2) }}%
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            {{ variant.inventory?.reduce((sum: number, i: any) => sum + i.quantity_available, 0) || 0 }}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <button type="button" @click="openEditModal(variant)" class="font-medium text-blue-600 dark:text-primary hover:underline dark:text-blue-500 mr-3">Editar</button>
                            <button
                                type="button"
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
        <Dialog :open="showModal" @update:open="handleVariantModalOpenChange">
            <DialogContent class="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{{ editingVariant ? 'Editar Variante' : 'Nueva Variante' }}</DialogTitle>
                    <DialogDescription>
                        Marca, precios e inventario de esta variante.
                    </DialogDescription>
                </DialogHeader>
                <!-- Formulario Modal con .stop para evitar burbujeo al padre Create.vue -->
                <form @submit.prevent.stop="handleSubmit" class="space-y-4 py-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- SKU Variante -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                SKU Variante
                            </label>
                            <input
                                v-model="form.sku"
                                type="text"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-muted dark:border-border dark:text-white font-mono"
                                placeholder="Ej: ALT-12V-90A-BOSCH"
                            />
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Si se deja vacío, se usará el SKU base del producto.
                            </p>
                        </div>

                        <!-- Brand -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Marca</label>
                            <div class="flex gap-1">
                                <SearchableSelect
                                    :options="brandOptions"
                                    :model-value="form.brand_id"
                                    @update:model-value="v => form.brand_id = v as number"
                                    placeholder="-- Selecciona marca --"
                                    :loading="loadingBrands"
                                />
                                <button type="button" @click="openBrandModal"
                                    class="flex-shrink-0 rounded-md border border-gray-300 dark:border-border bg-white dark:bg-muted p-2 text-gray-500 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 transition"
                                    title="Crear nueva marca">
                                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                                </button>
                            </div>
                        </div>

                        <!-- Status -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                            <select
                                v-model="form.status"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-muted dark:border-border dark:text-white"
                            >
                                <option value="active">Activo</option>
                                <option value="discontinued">Discontinuado</option>
                                <option value="pending">Pendiente</option>
                            </select>
                        </div>
                    </div>

                    <!-- ═══ Pricing Section ═══ -->
                    <div class="border-t border-gray-200 dark:border-border pt-4">
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <CircleDollarSign class="w-4 h-4 text-gray-500" /> Precios de esta Variante
                        </h4>

                        <!-- Tax type toggle fue removido: ahora ITBM siempre es numérico y modificable con 7% default -->

                        <!-- 3 columnas: Costo | % ITBM | Precio de Venta / Fórmula -->
                        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 p-3 rounded-lg bg-gray-50 dark:bg-muted/50 border border-dashed border-gray-200 dark:border-border items-start">
                            <!-- Campo Costo -->
                            <div class="md:col-span-3">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Costo <span class="text-xs text-gray-400">(compra)</span>
                                </label>
                                <div class="relative mt-1">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <input v-model.number="form.pricing.cost" type="number" step="0.01" min="0"
                                        :title="props.categoryFormula ? `Al ingresar costo, se calculará precio automáticamente usando: ${props.categoryFormula}` : 'Costo de adquisición del producto'"
                                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-muted dark:border-border dark:text-white pl-7" />
                                </div>
                            </div>
                            <!-- Campo % ITBM -->
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">% ITBM</label>
                                <input v-model.number="form.pricing.tax_rate" type="number" step="0.01" min="0" max="100"
                                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-muted dark:border-border dark:text-white" />
                            </div>
                            <!-- Campo Precio de Venta / Fórmula (única fuente de verdad) -->
                            <div class="md:col-span-7">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Precio de Venta
                                    <span v-if="props.categoryFormula" class="ml-1 text-xs text-blue-500 font-semibold">
                                        · Fórmula: <code class="font-mono bg-blue-50 dark:bg-blue-900/20 px-1 rounded">{{ props.categoryFormula }}</code>
                                    </span>
                                </label>
                                <PricingFormula
                                    :cost="Number(form.pricing.cost) || 0"
                                    :tax-rate="Number(form.pricing.tax_rate) || 7"
                                    :model-value="form.pricing_formula"
                                    :price="Number(form.pricing.base_price) || 0"
                                    @update:model-value="v => form.pricing_formula = v"
                                    @update:price="onFormulaTotalChange"
                                />
                                <!-- Botón recalcular por categoría si el usuario editó manualmente -->
                                <button
                                    v-if="priceManuallyEdited && (props.categoryFormula || (props.categoryMargin != null && props.categoryMargin > 0))"
                                    type="button"
                                    @click="recalculatePriceFromCategory"
                                    class="mt-1 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-1"
                                    :title="props.categoryFormula ? `Fórmula: ${props.categoryFormula}` : `Margen de categoría: ${props.categoryMargin}%`"
                                >
                                    &#8635; Recalcular por categor&iacute;a
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Initial Inventory (Only for create) -->
                    <div v-if="!editingVariant" class="border-t border-gray-200 dark:border-border pt-4">
                        <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <Package class="w-4 h-4 text-gray-500" /> Inventario Inicial
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock Disponible</label>
                                <input
                                    v-model.number="form.initial_inventory[0].stock_available"
                                    type="number" step="1" min="0"
                                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-muted dark:border-border dark:text-white"
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
                            @click="requestCloseModal()"
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

        <!-- Brand Creation Mini-Modal -->
        <Dialog :open="showBrandModal" @update:open="v => { if (!v) showBrandModal = false }">
            <DialogContent class="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Nueva Marca</DialogTitle>
                </DialogHeader>
                <div class="space-y-4 pt-2">
                    <p v-if="brandError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ brandError }}</p>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la Marca <span class="text-red-500">*</span></label>
                        <input v-model="newBrandName" type="text" @keyup.enter="submitNewBrand"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: Bosch, NGK, BERU..." />
                    </div>
                    <div class="flex justify-end gap-3">
                        <Button type="button" variant="outline" @click="showBrandModal = false">Cancelar</Button>
                        <Button type="button" @click="submitNewBrand" :disabled="creatingBrand">
                            {{ creatingBrand ? 'Creando...' : 'Crear Marca' }}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </div>
</template>
