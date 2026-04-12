<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { type BreadcrumbItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Hash, X, Car, Search } from 'lucide-vue-next'
import { useVehicleMakes, type VehicleMake } from '@/composables/useVehicleMakes'
import { useVehicleModels, type VehicleModel } from '@/composables/useVehicleModels'
import { useVehicleEngines, type VehicleEngine } from '@/composables/useVehicleEngines'
import { useVehicleVins, type VehicleVin } from '@/composables/useVehicleVins'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles' },
]

// ── Composables ──────────────────────────────────────────────────────────────
const { makes, fetchMakes, createMake, updateMake, deleteMake } = useVehicleMakes()
const { models, fetchModels, createModel, updateModel, deleteModel } = useVehicleModels()
const { engines, fetchEngines, createEngine, updateEngine, deleteEngine } = useVehicleEngines()

// ── UI state ─────────────────────────────────────────────────────────────────
const search = ref('')
const expandedMakes  = ref<Set<number>>(new Set())
const expandedModels = ref<Set<number>>(new Set())
const loadingModels  = ref<Record<number, boolean>>({})
const loadingEngines = ref<Record<number, boolean>>({})

// Store models/engines per make/model locally for the tree
const modelsByMake   = ref<Record<number, VehicleModel[]>>({})
const enginesByModel = ref<Record<number, VehicleEngine[]>>({})

// ── Search filter ─────────────────────────────────────────────────────────────
const filteredMakes = computed(() => {
    if (!search.value.trim()) return makes.value
    const q = search.value.toLowerCase()
    return makes.value.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (modelsByMake.value[m.id] ?? []).some(mod =>
            mod.name.toLowerCase().includes(q)
        )
    )
})

onMounted(async () => { await fetchMakes({ per_page: 200 }) })

// ── Tree toggle ───────────────────────────────────────────────────────────────
const toggleMake = async (makeId: number) => {
    if (expandedMakes.value.has(makeId)) {
        expandedMakes.value.delete(makeId)
    } else {
        expandedMakes.value.add(makeId)
        if (!modelsByMake.value[makeId]) {
            loadingModels.value[makeId] = true
            const res = await fetchModels({ make_id: makeId, per_page: 200 })
            modelsByMake.value[makeId] = res?.data ?? models.value.filter(m => m.make_id === makeId)
            loadingModels.value[makeId] = false
        }
    }
    expandedMakes.value = new Set(expandedMakes.value) // trigger reactivity
}

const toggleModel = async (modelId: number) => {
    if (expandedModels.value.has(modelId)) {
        expandedModels.value.delete(modelId)
    } else {
        expandedModels.value.add(modelId)
        if (!enginesByModel.value[modelId]) {
            loadingEngines.value[modelId] = true
            const res = await fetchEngines({ model_id: modelId, per_page: 200 })
            enginesByModel.value[modelId] = res?.data ?? engines.value.filter(e => e.model_id === modelId)
            loadingEngines.value[modelId] = false
        }
    }
    expandedModels.value = new Set(expandedModels.value)
}

// ── Modals ────────────────────────────────────────────────────────────────────
type ModalType = 'make' | 'model' | 'engine' | 'quickEngine' | null
const modalType    = ref<ModalType>(null)
const processing   = ref(false)
const modalError   = ref<string | null>(null)

// Context
const activeMakeId   = ref<number | null>(null)
const activeModelId  = ref<number | null>(null)
const activeEngineId = ref<number | null>(null)
const editingId      = ref<number | null>(null)

// Forms
const makeForm   = ref({ name: '' })
const modelForm  = ref({ name: '', year_from: new Date().getFullYear(), year_to: new Date().getFullYear(), generation: '' })
const engineForm = ref({ engine_code: '', displacement: '', fuel_type: '' })

// ── All engines for SearchableSelect ──────────────────────────────────────────
const allEngines = ref<VehicleEngine[]>([])
const allEnginesLoading = ref(false)
const selectedEngineId = ref<number | null>(null)

const loadAllEngines = async () => {
    allEnginesLoading.value = true
    try {
        const res = await fetchEngines({ per_page: 500 })
        allEngines.value = res?.data ?? engines.value
    } finally {
        allEnginesLoading.value = false
    }
}

// Options for SearchableSelect (excluding already assigned to this model)
const engineSelectOptions = computed<SelectOption[]>(() => {
    const assignedIds = new Set((enginesByModel.value[activeModelId.value ?? 0] ?? []).map(e => e.id))
    return allEngines.value
        .filter(e => !assignedIds.has(e.id))
        .map(e => ({
            value: e.id,
            label: e.engine_code,
            sublabel: [e.displacement, e.fuel_type].filter(Boolean).join(' • ') || undefined
        }))
})

const openMakeCreate = () => { editingId.value = null; makeForm.value = { name: '' }; modalType.value = 'make'; modalError.value = null }
const openMakeEdit   = (m: VehicleMake) => { editingId.value = m.id; makeForm.value = { name: m.name }; modalType.value = 'make'; modalError.value = null }

const openModelCreate = (makeId: number) => {
    activeMakeId.value = makeId; editingId.value = null
    modelForm.value = { name: '', year_from: new Date().getFullYear(), year_to: new Date().getFullYear(), generation: '' }
    modalType.value = 'model'; modalError.value = null
}
const openModelEdit = (model: VehicleModel) => {
    activeMakeId.value = model.make_id; editingId.value = model.id
    modelForm.value = { name: model.name, year_from: model.year_from ?? new Date().getFullYear(), year_to: model.year_to ?? new Date().getFullYear(), generation: (model as any).generation ?? '' }
    modalType.value = 'model'; modalError.value = null
}

const openEngineCreate = async (modelId: number) => {
    activeModelId.value = modelId
    editingId.value = null
    selectedEngineId.value = null
    modalType.value = 'engine'
    modalError.value = null
    // Reset VIN panel
    _vinEngineId.value = null
    engineVins.value = []
    // Load all available engines
    await loadAllEngines()
}
const openEngineEdit = async (engine: VehicleEngine) => {
    activeModelId.value = engine.model_id; editingId.value = engine.id
    engineForm.value = { engine_code: engine.engine_code, displacement: engine.displacement, fuel_type: engine.fuel_type || '' }
    modalType.value = 'engine'; modalError.value = null
    // Load VINs
    await loadVins(engine.id)
}

// Quick Add Engine Modal
const openQuickEngineCreate = () => {
    engineForm.value = { engine_code: '', displacement: '', fuel_type: '' }
    modalType.value = 'quickEngine'
    modalError.value = null
}

const closeModal = () => { modalType.value = null; _vinEngineId.value = null; engineVins.value = []; selectedEngineId.value = null }

// R20: Check for duplicates helper
const duplicateConfirmed = ref(false)

const checkMakeDuplicate = (name: string): boolean => {
    return makes.value.some(m => 
        m.name.toLowerCase().trim() === name.toLowerCase().trim() && 
        m.id !== editingId.value
    )
}

const checkModelDuplicate = (name: string, makeId: number): boolean => {
    const modelsInMake = modelsByMake.value[makeId] ?? []
    return modelsInMake.some(m => 
        m.name.toLowerCase().trim() === name.toLowerCase().trim() && 
        m.id !== editingId.value
    )
}

const checkEngineDuplicate = (code: string): boolean => {
    return allEngines.value.some(e => 
        e.engine_code.toLowerCase().trim() === code.toLowerCase().trim() && 
        e.id !== editingId.value
    )
}

// Make submit
const submitMake = async () => {
    // R20: Check for duplicate
    if (!editingId.value && !duplicateConfirmed.value && checkMakeDuplicate(makeForm.value.name)) {
        const confirm = window.confirm(
            `⚠️ Ya existe una marca con el nombre "${makeForm.value.name}".\n\n¿Desea crear una marca duplicada?`
        )
        if (!confirm) return
        duplicateConfirmed.value = true
    }

    processing.value = true; modalError.value = null
    try {
        if (editingId.value) {
            const updated = await updateMake(editingId.value, makeForm.value)
            const idx = makes.value.findIndex(m => m.id === editingId.value)
            if (idx !== -1) makes.value[idx] = updated
        } else {
            await createMake(makeForm.value)
            // makes array is automatically updated by the composable
        }
        closeModal()
        duplicateConfirmed.value = false
    } catch (e: any) { modalError.value = e.response?.data?.message || 'Error' }
    finally { processing.value = false }
}

// Model submit
const submitModel = async () => {
    // R20: Check for duplicate
    if (!editingId.value && !duplicateConfirmed.value && checkModelDuplicate(modelForm.value.name, activeMakeId.value!)) {
        const makeName = makes.value.find(m => m.id === activeMakeId.value)?.name || ''
        const confirm = window.confirm(
            `⚠️ Ya existe un modelo "${modelForm.value.name}" en la marca ${makeName}.\n\n¿Desea crear un modelo duplicado?`
        )
        if (!confirm) return
        duplicateConfirmed.value = true
    }

    processing.value = true; modalError.value = null
    try {
        const payload = { ...modelForm.value, make_id: activeMakeId.value! }
        if (editingId.value) {
            const updated = await updateModel(editingId.value, payload)
            const list = modelsByMake.value[activeMakeId.value!] ?? []
            const idx = list.findIndex(m => m.id === editingId.value)
            if (idx !== -1) list[idx] = updated
        } else {
            const created = await createModel(payload)
            if (!modelsByMake.value[activeMakeId.value!]) modelsByMake.value[activeMakeId.value!] = []
            // Prevent duplicate pushes if composable is also tracking it
            if (!modelsByMake.value[activeMakeId.value!].find(m => m.id === created.id)) {
                modelsByMake.value[activeMakeId.value!].push(created)
            }
        }
        closeModal()
        duplicateConfirmed.value = false
    } catch (e: any) { modalError.value = e.response?.data?.message || 'Error' }
    finally { processing.value = false }
}

// Assign existing engine to model (update engine's model_id)
const assignEngineToModel = async () => {
    if (!selectedEngineId.value || !activeModelId.value) return
    processing.value = true; modalError.value = null
    try {
        const updated = await updateEngine(selectedEngineId.value, { model_id: activeModelId.value })
        // Add to local tree
        if (!enginesByModel.value[activeModelId.value]) enginesByModel.value[activeModelId.value] = []
        if (!enginesByModel.value[activeModelId.value].find(e => e.id === updated.id)) {
            enginesByModel.value[activeModelId.value].push(updated)
        }
        // Open VIN panel for this engine
        editingId.value = updated.id
        await loadVins(updated.id)
    } catch (e: any) { modalError.value = e.response?.data?.message || 'Error' }
    finally { processing.value = false }
}

// Engine submit (edit mode only, or quick-create)
const submitEngine = async () => {
    // R20: Check for duplicate engine code
    if (!editingId.value && !duplicateConfirmed.value && checkEngineDuplicate(engineForm.value.engine_code)) {
        const confirm = window.confirm(
            `⚠️ Ya existe un motor con el código "${engineForm.value.engine_code}".\n\n¿Desea crear un motor duplicado?`
        )
        if (!confirm) return
        duplicateConfirmed.value = true
    }

    processing.value = true; modalError.value = null
    try {
        const payload = { 
            model_id: activeModelId.value, 
            engine_code: engineForm.value.engine_code, 
            displacement: engineForm.value.displacement, 
            fuel_type: engineForm.value.fuel_type || 'N/A', 
            aspiration: 'N/A' 
        }
        if (editingId.value) {
            // Editing existing engine
            const updated = await updateEngine(editingId.value, payload)
            const list = enginesByModel.value[activeModelId.value!] ?? []
            const idx = list.findIndex(e => e.id === editingId.value)
            if (idx !== -1) list[idx] = updated
        } else {
            // Quick create new engine
            const created = await createEngine(payload)
            
            // Add to allEngines so it appears in future searches
            if (!allEngines.value.find(e => e.id === created.id)) {
                allEngines.value.push(created)
            }
            
            if (activeModelId.value) {
                // Add to model's engine list
                if (!enginesByModel.value[activeModelId.value]) enginesByModel.value[activeModelId.value] = []
                if (!enginesByModel.value[activeModelId.value].find(e => e.id === created.id)) {
                    enginesByModel.value[activeModelId.value].push(created)
                }
                
                // If in quickEngine mode, motor already has model_id assigned
                // Open VIN panel directly
                if (modalType.value === 'quickEngine') {
                    editingId.value = created.id
                    await loadVins(created.id)
                    modalType.value = 'engine' // Switch to edit mode with VINs
                    duplicateConfirmed.value = false
                    return
                }
            }
            
            // Immediately open VIN panel for new engine (normal flow)
            editingId.value = created.id
            await loadVins(created.id)
        }
        duplicateConfirmed.value = false
    } catch (e: any) { modalError.value = e.response?.data?.message || 'Error' }
    finally { processing.value = false }
}

// Delete helpers
const handleDeleteMake = async (make: VehicleMake) => {
    if (!confirm(`¿Eliminar marca "${make.name}"? Se eliminarán sus modelos y motores.`)) return
    try { await deleteMake(make.id); makes.value = makes.value.filter(m => m.id !== make.id) }
    catch { alert('No se pudo eliminar.') }
}
const handleDeleteModel = async (model: VehicleModel) => {
    if (!confirm(`¿Eliminar modelo "${model.name}"?`)) return
    try {
        await deleteModel(model.id)
        if (modelsByMake.value[model.make_id]) {
            modelsByMake.value[model.make_id] = modelsByMake.value[model.make_id].filter(m => m.id !== model.id)
        }
    } catch { alert('No se pudo eliminar.') }
}
const handleDeleteEngine = async (engine: VehicleEngine) => {
    if (!confirm(`¿Eliminar motor "${engine.engine_code}"?`)) return
    try {
        await deleteEngine(engine.id)
        if (enginesByModel.value[engine.model_id]) {
            enginesByModel.value[engine.model_id] = enginesByModel.value[engine.model_id].filter(e => e.id !== engine.id)
        }
    } catch { alert('No se pudo eliminar.') }
}

// ── VIN management ────────────────────────────────────────────────────────────
const engineVins  = ref<VehicleVin[]>([])
const vinsLoading = ref(false)
const _vinEngineId = ref<number | null>(null)
let _vinApi: ReturnType<typeof useVehicleVins> | null = null

const newVin    = ref('')
const addingVin = ref(false)
const vinError  = ref<string | null>(null)

const loadVins = async (engineId: number) => {
    _vinEngineId.value = engineId
    _vinApi = useVehicleVins(engineId)
    vinsLoading.value = true
    await _vinApi.fetchVins()
    engineVins.value = _vinApi.vins.value
    vinsLoading.value = false
    newVin.value = ''
    vinError.value = null
}

const handleAddVin = async () => {
    if (!_vinApi || newVin.value.trim().length < 1) return
    addingVin.value = true; vinError.value = null
    try {
        await _vinApi.addVin(newVin.value.toUpperCase())
        engineVins.value = _vinApi.vins.value
        newVin.value = ''
    } catch (e: any) {
        vinError.value = e.response?.data?.message || 'VIN inválido o duplicado'
    } finally { addingVin.value = false }
}

const handleRemoveVin = async (vinId: number) => {
    if (!_vinApi) return
    await _vinApi.removeVin(vinId)
    engineVins.value = _vinApi.vins.value
}
</script>

<template>
    <Head title="Gestión de Vehículos" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-5xl space-y-6 p-6">

            <!-- Page Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Gestión de Vehículos</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Marcas → Modelos → Motores → VINs</p>
                </div>
                <Button @click="openMakeCreate">
                    <Plus class="mr-2 h-4 w-4" /> Nueva Marca
                </Button>
            </div>

            <!-- Search -->
            <div class="relative max-w-sm">
                <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input v-model="search" placeholder="Buscar marca o modelo..." class="pl-9" />
            </div>

            <!-- Vehicle Tree -->
            <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-background">

                <!-- Empty state -->
                <div v-if="filteredMakes.length === 0" class="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                    <Car class="mb-3 h-10 w-10" />
                    <p class="text-sm">No hay marcas de vehículos registradas.</p>
                    <Button class="mt-4" @click="openMakeCreate"><Plus class="mr-2 h-4 w-4" />Agregar Marca</Button>
                </div>

                <!-- Makes list -->
                <div v-for="(make, makeIdx) in filteredMakes" :key="make.id"
                    :class="makeIdx > 0 ? 'border-t border-gray-200 dark:border-border' : ''">

                    <!-- Make row -->
                    <div class="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-card/50 cursor-pointer"
                        @click="toggleMake(make.id)">
                        <button class="text-gray-400">
                            <ChevronDown v-if="expandedMakes.has(make.id)" class="h-4 w-4" />
                            <ChevronRight v-else class="h-4 w-4" />
                        </button>
                        <span class="flex-1 font-semibold text-gray-900 dark:text-white">{{ make.name }}</span>
                        <div class="flex items-center gap-1" @click.stop>
                            <Button variant="ghost" size="icon" class="h-7 w-7" @click="openModelCreate(make.id)" title="Nuevo Modelo">
                                <Plus class="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" class="h-7 w-7" @click="openMakeEdit(make)">
                                <Pencil class="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" class="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" @click="handleDeleteMake(make)">
                                <Trash2 class="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    <!-- Models -->
                    <div v-if="expandedMakes.has(make.id)">
                        <div v-if="loadingModels[make.id]" class="py-3 pl-12 text-sm text-gray-400">Cargando modelos...</div>

                        <div v-else-if="(modelsByMake[make.id] ?? []).length === 0" class="py-3 pl-12 text-sm text-gray-400">
                            Sin modelos. <button class="underline text-blue-500" @click="openModelCreate(make.id)">Agregar</button>
                        </div>

                        <div v-for="(model, modelIdx) in (modelsByMake[make.id] ?? [])" :key="model.id"
                            :class="['border-t border-gray-100 dark:border-border']">

                            <!-- Model row -->
                            <div class="flex items-center gap-2 py-2.5 pl-10 pr-4 hover:bg-gray-50 dark:hover:bg-card/50 cursor-pointer"
                                @click="toggleModel(model.id)">
                                <button class="text-gray-400">
                                    <ChevronDown v-if="expandedModels.has(model.id)" class="h-4 w-4" />
                                    <ChevronRight v-else class="h-4 w-4" />
                                </button>
                                <span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                                    {{ model.name }}
                                    <span v-if="model.year_from" class="ml-2 text-xs text-gray-400">({{ model.year_from }}–{{ model.year_to ?? 'Pres.' }})</span>
                                    <span v-if="(model as any).generation" class="ml-1 text-xs font-mono text-indigo-500 dark:text-indigo-400">{{ (model as any).generation }}</span>
                                </span>
                                <div class="flex items-center gap-1" @click.stop>
                                    <Button variant="ghost" size="icon" class="h-7 w-7" @click="openEngineCreate(model.id)" title="Nuevo Motor">
                                        <Plus class="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7" @click="openModelEdit(model)">
                                        <Pencil class="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" @click="handleDeleteModel(model)">
                                        <Trash2 class="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <!-- Engines -->
                            <div v-if="expandedModels.has(model.id)">
                                <div v-if="loadingEngines[model.id]" class="py-2 pl-20 text-xs text-gray-400">Cargando motores...</div>

                                <div v-else-if="(enginesByModel[model.id] ?? []).length === 0" class="py-2 pl-20 text-xs text-gray-400">
                                    Sin motores. <button class="underline text-blue-500" @click="openEngineCreate(model.id)">Agregar</button>
                                </div>

                                <div v-for="engine in (enginesByModel[model.id] ?? [])" :key="engine.id"
                                    class="border-t border-gray-100 dark:border-border flex items-center gap-3 py-2 pl-20 pr-4 hover:bg-gray-50/50 dark:hover:bg-card/30">
                                    <div class="flex-1">
                                        <span class="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">{{ engine.engine_code }}</span>
                                        <span v-if="engine.displacement" class="ml-2 text-xs text-gray-500">{{ engine.displacement }}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" class="h-7 w-7" @click="openEngineEdit(engine)" title="Editar motor y VINs">
                                            <Pencil class="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" class="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" @click="handleDeleteEngine(engine)">
                                            <Trash2 class="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ── Modal: Make ── -->
        <Dialog :open="modalType === 'make'" @update:open="v => { if (!v) closeModal() }">
            <DialogContent class="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{{ editingId ? 'Editar Marca' : 'Nueva Marca' }}</DialogTitle>
                </DialogHeader>
                <form @submit.prevent="submitMake" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label>Nombre</Label>
                        <Input v-model="makeForm.name" required placeholder="Ej: Toyota, Honda" />
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">{{ modalError }}</div>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="closeModal">Cancelar</Button>
                        <Button type="submit" :disabled="processing">{{ processing ? 'Guardando...' : 'Guardar' }}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

        <!-- ── Modal: Model ── -->
        <Dialog :open="modalType === 'model'" @update:open="v => { if (!v) closeModal() }">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{{ editingId ? 'Editar Modelo' : 'Nuevo Modelo' }}</DialogTitle>
                </DialogHeader>
                <form @submit.prevent="submitModel" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label>Nombre del Modelo</Label>
                        <Input v-model="modelForm.name" required placeholder="Ej: Corolla, Civic, Hilux" />
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div class="space-y-2">
                            <Label>Año Desde</Label>
                            <Input v-model.number="modelForm.year_from" type="number" placeholder="2005" />
                        </div>
                        <div class="space-y-2">
                            <Label>Año Hasta</Label>
                            <Input v-model.number="modelForm.year_to" type="number" placeholder="2024" />
                        </div>
                        <div class="space-y-2">
                            <Label>Generación</Label>
                            <Input v-model="modelForm.generation" placeholder="Ej: E170, W204" />
                        </div>
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">{{ modalError }}</div>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="closeModal">Cancelar</Button>
                        <Button type="submit" :disabled="processing">{{ processing ? 'Guardando...' : 'Guardar' }}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

        <!-- ── Modal: Engine (Select existing + Quick Add) ── -->
        <Dialog :open="modalType === 'engine'" @update:open="v => { if (!v) closeModal() }">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{{ editingId ? 'Editar Motor' : 'Asignar Motor' }}</DialogTitle>
                    <DialogDescription>{{ editingId ? 'Editar motor y VINs asociados' : 'Selecciona un motor existente o crea uno nuevo' }}</DialogDescription>
                </DialogHeader>

                <!-- Mode: Assign existing engine (when not editing) -->
                <div v-if="!editingId" class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label>Motor</Label>
                        <div class="flex gap-2">
                            <div class="flex-1">
                                <SearchableSelect
                                    v-model="selectedEngineId"
                                    :options="engineSelectOptions"
                                    :loading="allEnginesLoading"
                                    placeholder="Buscar motor..."
                                    loadingText="Cargando motores..."
                                />
                            </div>
                            <Button type="button" variant="outline" size="icon" @click="openQuickEngineCreate" title="Crear motor nuevo">
                                <Plus class="h-4 w-4" />
                            </Button>
                        </div>
                        <p v-if="engineSelectOptions.length === 0 && !allEnginesLoading" class="text-xs text-gray-500">
                            No hay motores disponibles. <button type="button" class="underline text-blue-500" @click="openQuickEngineCreate">Crear uno nuevo</button>
                        </p>
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">{{ modalError }}</div>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="closeModal">Cancelar</Button>
                        <Button type="button" :disabled="!selectedEngineId || processing" @click="assignEngineToModel">
                            {{ processing ? 'Asignando...' : 'Asignar Motor' }}
                        </Button>
                    </div>
                </div>

                <!-- Mode: Edit existing engine -->
                <form v-else @submit.prevent="submitEngine" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-4 py-2">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Motor</Label>
                            <Input v-model="engineForm.engine_code" required placeholder="Ej: 2AZ-FE, K20A" />
                        </div>
                        <div class="space-y-2">
                            <Label>Desplazamiento</Label>
                            <Input v-model="engineForm.displacement" placeholder="Ej: 2.4L" />
                        </div>
                    </div>
                    <div class="space-y-2">
                        <Label>Combustible</Label>
                        <Input v-model="engineForm.fuel_type" placeholder="Ej: Gasolina, Diesel" />
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">{{ modalError }}</div>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="closeModal">Cancelar</Button>
                        <Button type="submit" :disabled="processing">{{ processing ? 'Guardando...' : 'Actualizar' }}</Button>
                    </div>
                </form>

                <!-- VINs panel (shown after engine is assigned/editing) -->
                <div v-if="editingId" class="border-t pt-4 space-y-3">
                    <div class="flex items-center gap-2">
                        <Hash class="h-4 w-4 text-gray-400" />
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">VINs del Vehículo</h4>
                        <span class="ml-auto text-xs text-gray-400">Alfanumérico</span>
                    </div>

                    <div class="flex gap-2">
                        <Input v-model="newVin" maxlength="40" placeholder="VIN (ej: 1HGBH41JXMN109186)"
                            class="font-mono text-sm"
                            @keyup.enter="handleAddVin" />
                        <Button type="button" :disabled="newVin.trim().length < 1 || addingVin" @click="handleAddVin" size="sm">
                            <Plus class="h-4 w-4" />
                        </Button>
                    </div>

                    <p v-if="vinError" class="text-xs text-red-600">{{ vinError }}</p>

                    <div v-if="vinsLoading" class="py-2 text-center text-xs text-gray-400">Cargando VINs...</div>
                    <div v-else-if="engineVins.length === 0" class="py-2 text-center text-xs text-gray-400">Sin VINs registrados.</div>
                    <ul v-else class="max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-border rounded-md border border-gray-200 dark:border-border">
                        <li v-for="v in engineVins" :key="v.id"
                            class="flex items-center justify-between px-3 py-1.5 text-sm bg-white dark:bg-background">
                            <span class="font-mono text-xs tracking-wide text-gray-800 dark:text-gray-200">{{ v.vin }}</span>
                            <button type="button" @click="handleRemoveVin(v.id)" class="ml-2 text-red-500 hover:text-red-700">
                                <X class="h-3.5 w-3.5" />
                            </button>
                        </li>
                    </ul>
                </div>
            </DialogContent>
        </Dialog>

        <!-- ── Modal: Quick Add Engine ── -->
        <Dialog :open="modalType === 'quickEngine'" @update:open="v => { if (!v) { modalType = 'engine' } }">
            <DialogContent class="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Crear Motor Rápido</DialogTitle>
                    <DialogDescription>El motor se creará y asignará al modelo</DialogDescription>
                </DialogHeader>
                <form @submit.prevent="submitEngine" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label>Código Motor <span class="text-red-500">*</span></Label>
                        <Input v-model="engineForm.engine_code" required placeholder="Ej: 2AZ-FE, K20A" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Desplazamiento</Label>
                            <Input v-model="engineForm.displacement" placeholder="Ej: 2.4L" />
                        </div>
                        <div class="space-y-2">
                            <Label>Combustible</Label>
                            <Input v-model="engineForm.fuel_type" placeholder="Ej: Gasolina" />
                        </div>
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">{{ modalError }}</div>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="modalType = 'engine'">Cancelar</Button>
                        <Button type="submit" :disabled="processing || !engineForm.engine_code.trim()">
                            {{ processing ? 'Creando...' : 'Crear Motor' }}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

    </AppLayout>
</template>
