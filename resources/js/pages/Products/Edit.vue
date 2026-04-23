<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { useProducts } from '@/composables/useProducts'
import { useToast } from '@/composables/useToast'
import type { UpdateProductRequest } from '@/types/product'
import type { Category } from '@/types/category'
import apiClient from '@/services/api/client'
import { productsApi } from '@/services/api/products'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import VariantManager from '@/components/Products/VariantManager.vue'
import OemReferenceManager from '@/components/Products/OemReferenceManager.vue'
import AlternativeManager from '@/components/Products/AlternativeManager.vue'
import AttributeManager from '@/components/Products/AttributeManager.vue'
import VehicleCompatSection from '@/components/Products/VehicleCompatSection.vue'
import VehicleInlineModals from '@/components/Products/VehicleInlineModals.vue'
import ProductImagesSection from '@/components/Products/ProductImagesSection.vue'
import { Wrench, Copy, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
    productId: number
}>()

const { currentProduct, updateProduct, fetchProduct, loading, error } = useProducts()
const toast = useToast()
const duplicating = ref(false)

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

const categories = ref<Category[]>([])
const loadingCategories = ref(false)
const categoryFormula = ref<string | null>(null)
const categoryAppliesItbm = ref<boolean>(false)
const categoryItbmPercent = ref<number | null>(null)
const categoryMargin = ref<number | null>(null)
const regenerating = ref(false)
const selectedCategoryId = ref<number | null>(null)
const attributeManagerRef = ref<InstanceType<typeof AttributeManager> | null>(null)

const categoryOptions = computed(() => categories.value.map(c => ({
    value: c.id,
    label: c.name,
})))

onMounted(async () => {
    loadingCategories.value = true
    try {
        const response = await apiClient.get('/categories')
        categories.value = response.data
    } catch { /* ignore */ }
    finally { loadingCategories.value = false }

    await fetchProduct(props.productId)

    if (currentProduct.value) {
        const categoryId = currentProduct.value.category_id ?? (currentProduct.value.category as any)?.id ?? null
        selectedCategoryId.value = categoryId

        form.value = {
            sku_base: currentProduct.value.sku_base || '',
            upc: currentProduct.value.default_variant?.upc || '',
            alternate_code: (currentProduct.value as any).alternate_code || '',
            category_id: categoryId ?? undefined,
            name: currentProduct.value.name,
            description: currentProduct.value.description || '',
            status: currentProduct.value.status,
            is_universal: currentProduct.value.is_universal ?? false,
            batch_tracking: currentProduct.value.batch_tracking,
        }

        if (categoryId) {
            try {
                const resp = await apiClient.get(`/categories/${categoryId}`)
                const cat = resp.data
                categoryFormula.value = cat.pricing_formula ?? null
                categoryAppliesItbm.value = cat.applies_itbm ?? false
                categoryItbmPercent.value = cat.itbm_percent ?? 7
                categoryMargin.value = cat.default_margin_percent ?? null
            } catch {
                // Silently fail - variants will work without auto-pricing
            }
        }
    }
})

const initialCategoryLoaded = ref(false)

watch(selectedCategoryId, async (newCategoryId) => {
    form.value.category_id = newCategoryId ?? undefined

    if (newCategoryId) {
        try {
            const resp = await apiClient.get(`/categories/${newCategoryId}`)
            const cat = resp.data
            categoryFormula.value = cat.pricing_formula ?? null
            categoryAppliesItbm.value = cat.applies_itbm ?? false
            categoryItbmPercent.value = cat.itbm_percent ?? 7
            categoryMargin.value = cat.default_margin_percent ?? null
        } catch {
            categoryFormula.value = null
            categoryAppliesItbm.value = false
            categoryItbmPercent.value = null
            categoryMargin.value = null
        }
    } else {
        categoryFormula.value = null
        categoryAppliesItbm.value = false
        categoryItbmPercent.value = null
        categoryMargin.value = null
    }

    // Save category change to backend so attributes get replaced, then refresh the UI
    if (initialCategoryLoaded.value) {
        try {
            await updateProduct(props.productId, { category_id: newCategoryId ?? null })
            attributeManagerRef.value?.refresh()
            toast.success('Categoría actualizada — atributos por defecto aplicados')
        } catch {
            toast.error('Error al actualizar la categoría')
        }
    } else {
        initialCategoryLoaded.value = true
    }
})

const handleSubmit = async () => {
    validationErrors.value = {}
    successMessage.value = ''

    try {
        await updateProduct(props.productId, form.value)
        successMessage.value = 'Producto actualizado exitosamente'
        toast.success('Producto actualizado exitosamente')
    } catch (err: any) {
        if (err.response?.data?.errors) {
            validationErrors.value = err.response.data.errors
        }
    }
}

const cancel = () => {
    window.location.href = '/products'
}

const handleDuplicate = async () => {
    if (duplicating.value) return

    duplicating.value = true
    try {
        const response = await productsApi.duplicateProduct(props.productId)
        const duplicatedProductId = response?.data?.id

        if (!duplicatedProductId) {
            throw new Error('No se recibio el ID del producto duplicado')
        }

        toast.success('Producto duplicado. Ajusta los campos necesarios.')
        window.location.href = `/products/${duplicatedProductId}/edit`
    } catch (err: any) {
        toast.error(err.response?.data?.message || 'Error al duplicar producto')
    } finally {
        duplicating.value = false
    }
}

const handleRegenerateName = async () => {
    if (regenerating.value) return
    regenerating.value = true
    try {
        const response = await productsApi.regenerateName(props.productId)
        const newName = response.data?.name
        if (newName) {
            form.value.name = newName
            toast.success('Descripción regenerada correctamente')
        }
    } catch (err: any) {
        toast.error(err.response?.data?.message || 'Error al regenerar la descripción')
    } finally {
        regenerating.value = false
    }
}

// === Vehicle Inline Modals ===
const vehicleCompatRef = ref<InstanceType<typeof VehicleCompatSection> | null>(null)
const vehicleModalsRef = ref<InstanceType<typeof VehicleInlineModals> | null>(null)
const vehicleModalType = ref<'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis' | null>(null)

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
</script>

<template>
    <Head title="Editar Producto" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-6 p-4">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Editar Producto</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Modifica los datos del producto y sus secciones</p>
                </div>
                <div class="flex gap-3">
                    <button
                        type="button"
                        :disabled="duplicating"
                        @click="handleDuplicate"
                        class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-card dark:text-white dark:hover:bg-muted"
                    >
                        <Copy class="h-4 w-4" />
                        {{ duplicating ? 'Duplicando...' : 'Duplicar' }}
                    </button>
                    <button type="button" @click="cancel"
                        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-white">
                        Cancelar
                    </button>
                    <button type="button" @click="handleSubmit" :disabled="loading"
                        class="rounded-lg bg-blue-600 dark:bg-primary dark:text-primary-foreground px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-50">
                        {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading && !currentProduct" class="text-center py-12">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 dark:border-primary border-r-transparent"></div>
                <p class="mt-2 text-gray-600">Cargando producto...</p>
            </div>

            <div v-else class="space-y-4">
                <!-- Success Message -->
                <div v-if="successMessage" class="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                    {{ successMessage }}
                </div>

                <!-- Error Message -->
                <div v-if="error" class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {{ error }}
                </div>

                <!-- SECTION 1: Descripcion -->
                <form @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-4">

                <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border space-y-4">
                    <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500">Descripción</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Descripción <span class="text-red-500">*</span>
                            </label>
                            <div class="mt-1 flex gap-2">
                                <input v-model="form.name" type="text" required
                                    class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white" />
                                <button
                                    type="button"
                                    :disabled="regenerating"
                                    @click="handleRegenerateName"
                                    class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-card dark:text-gray-300 dark:hover:bg-muted"
                                    title="Regenerar descripción automática desde categoría + compatibilidad vehicular"
                                >
                                    <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': regenerating }" />
                                    Auto
                                </button>
                            </div>
                            <p v-if="validationErrors.name" class="mt-1 text-sm text-red-600">{{ validationErrors.name[0] }}</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                            <SearchableSelect
                                :options="categoryOptions"
                                :model-value="selectedCategoryId"
                                @update:model-value="v => selectedCategoryId = (v as number | null)"
                                placeholder="-- Selecciona categoría --"
                                :loading="loadingCategories"
                            />
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: Código y Estado -->
                <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border">
                    <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Código y Estado</h2>
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Código <span class="text-gray-400 font-normal text-xs">(opcional)</span>
                            </label>
                            <input v-model="form.sku_base" type="text"
                                class="mt-0 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white font-mono"
                                placeholder="Ej: ALT-0012" />
                            <p v-if="validationErrors.sku_base" class="mt-1 text-sm text-red-600">{{ validationErrors.sku_base[0] }}</p>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                            <select v-model="form.status"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white">
                                <option value="active">Activo</option>
                                <option value="discontinued">Discontinuado</option>
                                <option value="pending">Pendiente</option>
                            </select>
                        </div>
                    </div>
                </div>
                </form>

                <!-- SECTION 3: Códigos Alternos -->
                <OemReferenceManager :product-id="props.productId" />

                <!-- SECTION 4: Compatibilidad Vehicular -->
                <VehicleCompatSection
                    ref="vehicleCompatRef"
                    mode="live"
                    :product-id="props.productId"
                    @open-inline="openVehicleInline"
                />

                <!-- SECTION 5: Variantes -->
                <VariantManager
                    :product-id="props.productId"
                    :category-id="selectedCategoryId ?? currentProduct?.category_id ?? currentProduct?.category?.id"
                    :sku-base="currentProduct?.sku_base || ''"
                    :product-name="currentProduct?.name || ''"
                    :category-formula="categoryFormula"
                    :category-applies-itbm="categoryAppliesItbm"
                    :category-itbm-percent="categoryItbmPercent"
                    :category-margin="categoryMargin"
                />

                <!-- SECTION 6: Atributos -->
                <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-indigo-500">
                    <div class="mb-3 flex items-center justify-between gap-3">
                        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                            <Wrench class="w-4 h-4" /> Atributos
                        </h2>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Agrega o edita atributos del producto a nivel base.
                    </p>
                    <AttributeManager ref="attributeManagerRef" :product-id="props.productId" />
                </div>

                <!-- SECTION 7: Upsales -->
                <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-violet-500">
                    <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Upsales</h2>
                    <AlternativeManager :product-id="props.productId" />
                </div>

                <!-- SECTION 8: Notas -->
                <div class="rounded-xl bg-white p-5 shadow-sm dark:bg-card border border-gray-100 dark:border-border border-l-4 border-l-slate-400">
                    <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Notas</h2>
                    <textarea
                        v-model="form.description"
                        rows="3"
                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white resize-none"
                        placeholder="Notas internas del producto..."
                    ></textarea>
                </div>

                <!-- SECTION 9: Imagen del Producto -->
                <ProductImagesSection
                    mode="gallery"
                    :product-id="props.productId"
                    :product-name="currentProduct?.name"
                />

            </div>
        </div>
    </AppLayout>

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
</template>
