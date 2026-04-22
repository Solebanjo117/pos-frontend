<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import UniversalImporter from '@/components/Import/UniversalImporter.vue'
import VariantManager from '@/components/Products/VariantManager.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import type { ImporterConfig } from '@/services/import'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import apiClient from '@/services/api/client'

const toast = useToast()

// ─── Importer config ──────────────────────────────────────────────────────────
const importConfig: ImporterConfig = {
    entity: 'products',
    title: 'Importación de Productos',
    description: 'Descarga la plantilla, sube tu archivo Excel, edita los datos y enriquece cada producto con atributos, variantes y compatibilidad vehicular.',
    templateFilename: 'plantilla_productos.xlsx',
    columns: [
        { key: 'nombre',     label: 'Nombre',      type: 'text',       required: true },
        { key: 'sku',        label: 'SKU',          type: 'text' },
        { key: 'descripcion',label: 'Descripción',  type: 'text' },
        { key: 'categoria',  label: 'Categoría',    type: 'searchable', required: true, searchableEndpoint: '/categories/all', creatable: true },
        { key: '__attributes',   label: 'Atributos',   actionType: 'attributes' },
        { key: '__variants',     label: 'Variantes',   actionType: 'variants' },
        { key: '__compatibility',label: 'Compatibilidad', actionType: 'compatibility' },
    ],
}

const importerRef = ref<any>(null)

// ─── Shared: categories ───────────────────────────────────────────────────────
const categories = ref<any[]>([])
const loadingCategories = ref(false)
const categoryOptions = computed(() => categories.value.map(c => ({ value: c.id, label: c.name })))

const loadCategories = async () => {
    loadingCategories.value = true
    try {
        const { data } = await apiClient.get('/categories/all')
        categories.value = data.data ?? data
    } catch { categories.value = [] }
    finally { loadingCategories.value = false }
}
loadCategories()

// Helper: get category_id for a row (categoria may be ID or name string)
const getRowCategoryId = (rowIdx: number): number | undefined => {
    const rows = importerRef.value?.editedRows
    if (!rows) return undefined
    const val = rows[rowIdx]?.categoria
    if (typeof val === 'number') return val
    const found = categories.value.find(c => c.name?.toLowerCase() === String(val).toLowerCase())
    return found?.id
}

// ─── Current editing row ──────────────────────────────────────────────────────
const editingRowIdx = ref<number | null>(null)

const getEditingRow = () => {
    const rows = importerRef.value?.editedRows
    if (editingRowIdx.value === null || !rows) return null
    return rows[editingRowIdx.value]
}

// ─── Modal 1: Nueva Categoría ─────────────────────────────────────────────────
const categoryModal = ref(false)
const categoryForm = ref({ name: '', parent_id: null as number | null, default_attributes: [] as { name: string, required: boolean }[] })
const categoryProcessing = ref(false)
const categoryError = ref('')

const openCategoryModal = () => {
    categoryForm.value = { name: '', parent_id: null, default_attributes: [] }
    categoryError.value = ''
    categoryModal.value = true
}

const addDefaultAttr = () => categoryForm.value.default_attributes.push({ name: '', required: false })
const removeDefaultAttr = (i: number) => categoryForm.value.default_attributes.splice(i, 1)

const submitCategory = async () => {
    categoryProcessing.value = true
    categoryError.value = ''
    try {
        const payload: any = { name: categoryForm.value.name, status: 'active' }
        if (categoryForm.value.parent_id) payload.parent_id = categoryForm.value.parent_id
        const attrs = categoryForm.value.default_attributes.filter(a => a.name.trim())
        if (attrs.length) payload.default_attributes = attrs
        const { data } = await apiClient.post('/categories', payload)
        const created = data.data ?? data
        categories.value.push(created)
        toast.success('Categoría creada correctamente')
        categoryModal.value = false
        if (importerRef.value?.reloadSearchableOptions) await importerRef.value.reloadSearchableOptions()
    } catch (e: any) {
        categoryError.value = e.response?.data?.message || 'Error al crear la categoría'
    } finally { categoryProcessing.value = false }
}

// ─── Modal 2: Atributos de fila ───────────────────────────────────────────────
const attributesModal = ref(false)
const currentAttributes = ref<{ name: string, value: string, unit: string }[]>([])

const openAttributesModal = (rowIdx: number) => {
    editingRowIdx.value = rowIdx
    const row = getEditingRow()
    currentAttributes.value = (row?.__attributes ?? []).map((a: any) => ({
        name: a.name ?? '', value: a.value ?? '', unit: a.unit ?? '',
    }))
    attributesModal.value = true
}

const addAttr = () => currentAttributes.value.push({ name: '', value: '', unit: '' })
const removeAttr = (i: number) => currentAttributes.value.splice(i, 1)

const saveAttributes = () => {
    const row = getEditingRow()
    if (row) row.__attributes = currentAttributes.value.filter(a => a.name.trim())
    attributesModal.value = false
    toast.success('Atributos guardados')
}

// ─── Modal 3: Variantes de fila ───────────────────────────────────────────────
const variantsModal = ref(false)

const openVariantsModal = (rowIdx: number) => {
    editingRowIdx.value = rowIdx
    variantsModal.value = true
}

const onDraftVariantsChanged = (variants: any[]) => {
    const row = getEditingRow()
    if (row) row.__variants = variants
}

// ─── Modal 4: Compatibilidad vehicular de fila ────────────────────────────────
const compatModal = ref(false)
const vehicleMakes = ref<any[]>([])
const vehicleModels = ref<any[]>([])
const vehicleEngines = ref<any[]>([])
const selectedMakeId = ref<number | null>(null)
const selectedModelId = ref<number | null>(null)
const selectedEngineIds = ref<number[]>([])
const loadingMakes = ref(false)
const loadingModels = ref(false)
const loadingEngines = ref(false)
const addedEngines = ref<any[]>([])

const makeOptions = computed(() => vehicleMakes.value.map(m => ({ value: m.id, label: m.name })))
const modelOptions = computed(() => vehicleModels.value.map(m => ({ value: m.id, label: m.name })))

const fetchMakes = async () => {
    if (vehicleMakes.value.length) return
    loadingMakes.value = true
    try {
        const { data } = await apiClient.get('/vehicle-makes/all')
        vehicleMakes.value = data.data ?? data
    } catch { vehicleMakes.value = [] }
    finally { loadingMakes.value = false }
}

watch(selectedMakeId, async (makeId) => {
    vehicleModels.value = []; vehicleEngines.value = []
    selectedModelId.value = null; selectedEngineIds.value = []
    if (!makeId) return
    loadingModels.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-makes/${makeId}/models`)
        vehicleModels.value = data.data ?? data
    } catch { vehicleModels.value = [] }
    finally { loadingModels.value = false }
})

watch(selectedModelId, async (modelId) => {
    vehicleEngines.value = []; selectedEngineIds.value = []
    if (!modelId) return
    loadingEngines.value = true
    try {
        const { data } = await apiClient.get(`/vehicle-models/${modelId}/engines`)
        vehicleEngines.value = data.data ?? data
    } catch { vehicleEngines.value = [] }
    finally { loadingEngines.value = false }
})

const openCompatModal = (rowIdx: number) => {
    editingRowIdx.value = rowIdx
    const row = getEditingRow()
    addedEngines.value = [...(row?.__compatibility ?? [])]
    selectedMakeId.value = null; selectedModelId.value = null; selectedEngineIds.value = []
    vehicleModels.value = []; vehicleEngines.value = []
    fetchMakes()
    compatModal.value = true
}

const addEngines = () => {
    const make = vehicleMakes.value.find(m => m.id === selectedMakeId.value)
    const model = vehicleModels.value.find(m => m.id === selectedModelId.value)
    selectedEngineIds.value.forEach(engineId => {
        if (addedEngines.value.some(e => e.engine_id === engineId)) return
        const engine = vehicleEngines.value.find(e => e.id === engineId)
        addedEngines.value.push({
            engine_id: engineId,
            make: make?.name || '',
            model: model?.name || '',
            engine: engine?.engine_code || '',
        })
    })
    selectedEngineIds.value = []
}

const saveCompat = () => {
    const row = getEditingRow()
    if (row) row.__compatibility = [...addedEngines.value]
    compatModal.value = false
    toast.success('Compatibilidad guardada')
}

// ─── Event handlers from UniversalImporter ───────────────────────────────────
const handleCreate = (columnKey: string) => {
    if (columnKey === 'categoria') openCategoryModal()
}

const handleRowAction = (actionType: 'attributes' | 'variants' | 'compatibility', rowIdx: number) => {
    if (actionType === 'attributes') openAttributesModal(rowIdx)
    else if (actionType === 'variants') openVariantsModal(rowIdx)
    else if (actionType === 'compatibility') openCompatModal(rowIdx)
}
</script>

<template>
    <Head title="Importar Productos" />
    <AppLayout>
        <div class="p-4 space-y-4">
            <UniversalImporter
                ref="importerRef"
                :config="importConfig"
                @create="handleCreate"
                @row-action="handleRowAction"
            />
        </div>

        <!-- ══ Modal 1: Nueva Categoría ══ -->
        <Dialog :open="categoryModal" @update:open="v => { if (!v) categoryModal = false }">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader><DialogTitle>Nueva Categoría</DialogTitle></DialogHeader>
                <form @submit.prevent="submitCategory" class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label>Nombre <span class="text-red-500">*</span></Label>
                        <Input v-model="categoryForm.name" required placeholder="Ej: Filtros, Frenos" />
                    </div>
                    <div class="space-y-2">
                        <Label>Categoría Padre (Opcional)</Label>
                        <SearchableSelect :options="categoryOptions" :model-value="categoryForm.parent_id"
                            @update:model-value="v => categoryForm.parent_id = v as number | null"
                            placeholder="Sin categoría padre" :loading="loadingCategories" />
                    </div>

                    <!-- Atributos por defecto -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <Label>Atributos por defecto</Label>
                            <button type="button" @click="addDefaultAttr"
                                class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                <Plus class="h-3 w-3" /> Agregar
                            </button>
                        </div>
                        <div class="space-y-2">
                            <div v-for="(attr, i) in categoryForm.default_attributes" :key="i"
                                class="flex items-center gap-2">
                                <Input v-model="attr.name" placeholder="Nombre del atributo" class="flex-1" />
                                <label class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    <input type="checkbox" v-model="attr.required" class="rounded" />
                                    Requerido
                                </label>
                                <button type="button" @click="removeDefaultAttr(i)"
                                    class="text-red-400 hover:text-red-600"><X class="h-4 w-4" /></button>
                            </div>
                        </div>
                        <p v-if="!categoryForm.default_attributes.length"
                            class="text-xs text-gray-400 italic">Sin atributos por defecto</p>
                    </div>

                    <div v-if="categoryError" class="text-sm text-red-600">{{ categoryError }}</div>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="categoryModal = false">Cancelar</Button>
                        <Button type="submit" :disabled="categoryProcessing">
                            {{ categoryProcessing ? 'Guardando...' : 'Guardar' }}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

        <!-- ══ Modal 2: Atributos por fila ══ -->
        <Dialog :open="attributesModal" @update:open="v => { if (!v) attributesModal = false }">
            <DialogContent class="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Atributos — Fila {{ editingRowIdx !== null ? editingRowIdx + 1 : '' }}</DialogTitle>
                </DialogHeader>
                <div class="py-2 space-y-3">
                    <div class="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
                        <span>Nombre</span><span>Valor</span><span>Unidad</span>
                    </div>
                    <div v-for="(attr, i) in currentAttributes" :key="i" class="flex items-center gap-2">
                        <div class="grid grid-cols-3 gap-2 flex-1">
                            <Input v-model="attr.name" placeholder="Ej: Amperaje" />
                            <Input v-model="attr.value" placeholder="Ej: 90" />
                            <Input v-model="attr.unit" placeholder="Ej: A" />
                        </div>
                        <button type="button" @click="removeAttr(i)" class="text-red-400 hover:text-red-600">
                            <X class="h-4 w-4" />
                        </button>
                    </div>
                    <p v-if="!currentAttributes.length" class="text-sm text-gray-400 italic text-center py-4">
                        Sin atributos. Agrega uno con el botón de abajo.
                    </p>
                    <button type="button" @click="addAttr"
                        class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                        <Plus class="h-4 w-4" /> Agregar atributo
                    </button>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t dark:border-border">
                    <Button variant="outline" @click="attributesModal = false">Cancelar</Button>
                    <Button @click="saveAttributes">Guardar</Button>
                </div>
            </DialogContent>
        </Dialog>

        <!-- ══ Modal 3: Variantes por fila ══ -->
        <Dialog :open="variantsModal" @update:open="v => { if (!v) variantsModal = false }">
            <DialogContent class="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Variantes — Fila {{ editingRowIdx !== null ? editingRowIdx + 1 : '' }}</DialogTitle>
                </DialogHeader>
                <div class="py-2">
                    <VariantManager
                        v-if="variantsModal && editingRowIdx !== null"
                        :category-id="getRowCategoryId(editingRowIdx)"
                        :sku-base="importerRef?.editedRows?.[editingRowIdx]?.sku || undefined"
                        :product-name="importerRef?.editedRows?.[editingRowIdx]?.nombre || undefined"
                        @draft-variants-changed="onDraftVariantsChanged"
                    />
                </div>
                <div class="flex justify-end pt-2 border-t dark:border-border">
                    <Button @click="variantsModal = false">Listo</Button>
                </div>
            </DialogContent>
        </Dialog>

        <!-- ══ Modal 4: Compatibilidad vehicular por fila ══ -->
        <Dialog :open="compatModal" @update:open="v => { if (!v) compatModal = false }">
            <DialogContent class="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Compatibilidad Vehicular — Fila {{ editingRowIdx !== null ? editingRowIdx + 1 : '' }}</DialogTitle>
                </DialogHeader>
                <div class="py-2 space-y-4">
                    <!-- Selectors -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <Label class="mb-1 block text-sm">Marca Vehicular</Label>
                            <SearchableSelect :options="makeOptions" :model-value="selectedMakeId"
                                @update:model-value="v => selectedMakeId = v as number | null"
                                placeholder="Seleccionar marca" :loading="loadingMakes" />
                        </div>
                        <div>
                            <Label class="mb-1 block text-sm">Modelo</Label>
                            <SearchableSelect :options="modelOptions" :model-value="selectedModelId"
                                @update:model-value="v => selectedModelId = v as number | null"
                                placeholder="Seleccionar modelo" :disabled="!selectedMakeId" :loading="loadingModels" />
                        </div>
                    </div>

                    <!-- Engine selector -->
                    <div v-if="selectedModelId">
                        <Label class="mb-1 block text-sm">Motores</Label>
                        <div v-if="loadingEngines" class="text-sm text-gray-400 py-3 text-center">Cargando...</div>
                        <div v-else-if="!vehicleEngines.length" class="text-sm text-gray-400 italic text-center py-3">
                            No hay motores disponibles para este modelo
                        </div>
                        <div v-else class="max-h-40 overflow-y-auto border rounded-md dark:border-border bg-white dark:bg-muted">
                            <label v-for="engine in vehicleEngines" :key="engine.id"
                                class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-background/50 cursor-pointer border-b last:border-b-0 dark:border-border"
                                :class="{ 'opacity-50': addedEngines.some(e => e.engine_id === engine.id) }">
                                <input type="checkbox" :value="engine.id" v-model="selectedEngineIds"
                                    :disabled="addedEngines.some(e => e.engine_id === engine.id)" class="rounded" />
                                <span class="font-mono text-sm">{{ engine.engine_code }}</span>
                                <span v-if="engine.displacement" class="text-xs text-gray-500">{{ engine.displacement }}</span>
                                <span v-if="addedEngines.some(e => e.engine_id === engine.id)"
                                    class="ml-auto text-xs text-emerald-600">✓ Agregado</span>
                            </label>
                        </div>
                        <button type="button" @click="addEngines" :disabled="!selectedEngineIds.length"
                            class="mt-2 px-4 py-1.5 text-sm rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40">
                            + Agregar ({{ selectedEngineIds.length }})
                        </button>
                    </div>

                    <!-- Added engines table -->
                    <div v-if="addedEngines.length">
                        <Label class="mb-1 block text-sm">Compatibilidades agregadas</Label>
                        <table class="w-full text-xs border rounded dark:border-border">
                            <thead class="bg-gray-50 dark:bg-background">
                                <tr>
                                    <th class="px-3 py-2 text-left text-gray-500">Marca</th>
                                    <th class="px-3 py-2 text-left text-gray-500">Modelo</th>
                                    <th class="px-3 py-2 text-left text-gray-500">Motor</th>
                                    <th class="w-8"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y dark:divide-border">
                                <tr v-for="(eng, i) in addedEngines" :key="i">
                                    <td class="px-3 py-2">{{ eng.make }}</td>
                                    <td class="px-3 py-2">{{ eng.model }}</td>
                                    <td class="px-3 py-2 font-mono">{{ eng.engine }}</td>
                                    <td class="px-2 text-center">
                                        <button type="button" @click="addedEngines.splice(i, 1)" class="text-red-400 hover:text-red-600">✕</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t dark:border-border">
                    <Button variant="outline" @click="compatModal = false">Cancelar</Button>
                    <Button @click="saveCompat">Guardar</Button>
                </div>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>