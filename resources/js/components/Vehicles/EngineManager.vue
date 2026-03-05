<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useVehicleEngines, type VehicleEngine } from '@/composables/useVehicleEngines'
import { useVehicleModels } from '@/composables/useVehicleModels'
import { useVehicleMakes } from '@/composables/useVehicleMakes'
import { useVehicleVins, type VehicleVin as VehicleVinType } from '@/composables/useVehicleVins'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus, Search, Filter, Hash, X } from 'lucide-vue-next'

// Composables
const { engines, fetchEngines, createEngine, updateEngine, deleteEngine, loading, error } = useVehicleEngines()
const { makes, fetchMakes } = useVehicleMakes()
const { models, fetchModels } = useVehicleModels()

// State
const showModal = ref(false)
const editingEngine = ref<VehicleEngine | null>(null)
const processing = ref(false)
const search = ref('')
const selectedMakeId = ref<number | undefined>(undefined)
const selectedModelId = ref<number | undefined>(undefined)

// VIN state (only active when editing an existing engine)
const engineVins = ref<VehicleVinType[]>([])
const vinsLoading = ref(false)
let _vinApi: ReturnType<typeof useVehicleVins> | null = null
const newVin = ref('')
const addingVin = ref(false)
const vinError = ref<string | null>(null)

// Form Data (simplified: removed fuel_type & aspiration)
const form = ref({
    make_id:     '' as string | number,
    model_id:    '' as string | number,
    engine_code: '',
    displacement: '',
})

// Load Data
const loadData = async () => {
    await fetchEngines({
        per_page: 50,
        search: search.value,
        model_id: selectedModelId.value
    })
}

const loadMakes = async () => { await fetchMakes({ per_page: 100 }) }

const loadModels = async (makeId: number) => {
    if (!makeId) { models.value = []; return }
    await fetchModels({ make_id: makeId, per_page: 100 })
}

// Modal open/close
const openCreateModal = () => {
    editingEngine.value = null
    _vinApi = null
    engineVins.value = []
    newVin.value = ''
    vinError.value = null
    form.value = { make_id: '', model_id: '', engine_code: '', displacement: '' }
    showModal.value = true
}

const openEditModal = async (engine: VehicleEngine) => {
    editingEngine.value = engine
    const makeId = engine.model?.make?.id
    if (makeId) await loadModels(makeId)

    form.value = {
        make_id:      makeId || '',
        model_id:     engine.model_id,
        engine_code:  engine.engine_code,
        displacement: engine.displacement,
    }

    // Load VINs on demand
    _vinApi = useVehicleVins(engine.id)
    vinsLoading.value = true
    await _vinApi.fetchVins()
    engineVins.value = _vinApi.vins.value
    vinsLoading.value = false
    newVin.value = ''
    vinError.value = null
    showModal.value = true
}

const closeModal = () => {
    showModal.value = false
    _vinApi = null
    engineVins.value = []
}

const handleSubmit = async () => {
    processing.value = true
    try {
        const payload = {
            model_id:     Number(form.value.model_id),
            engine_code:  form.value.engine_code,
            displacement: form.value.displacement,
            fuel_type:    'N/A',
            aspiration:   'N/A',
        }
        if (editingEngine.value) {
            await updateEngine(editingEngine.value.id, payload)
        } else {
            const created = await createEngine(payload)
            // Stay open so user can add VINs
            editingEngine.value = created
            _vinApi = useVehicleVins(created.id)
            await _vinApi.fetchVins()
            engineVins.value = _vinApi.vins.value
        }
        await loadData()
    } catch (e) {
        console.error(e)
    } finally {
        processing.value = false
    }
}

const handleDelete = async (engine: VehicleEngine) => {
    if (!confirm(`¿Eliminar el motor ${engine.engine_code}?`)) return
    try {
        await deleteEngine(engine.id)
    } catch (e) {
        alert('No se pudo eliminar el motor.')
    }
}

// VIN actions
const handleAddVin = async () => {
    if (!_vinApi || newVin.value.length !== 17) return
    addingVin.value = true
    vinError.value = null
    try {
        await _vinApi.addVin(newVin.value.toUpperCase())
        engineVins.value = _vinApi.vins.value
        newVin.value = ''
    } catch (e: any) {
        vinError.value = e.response?.data?.message || 'VIN inválido o duplicado'
    } finally {
        addingVin.value = false
    }
}

const handleRemoveVin = async (vinId: number) => {
    if (!_vinApi) return
    await _vinApi.removeVin(vinId)
    engineVins.value = _vinApi.vins.value
}

// Debounced search
let timeout: ReturnType<typeof setTimeout>
const handleSearch = () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => loadData(), 300)
}

watch(selectedMakeId, async (val) => {
    selectedModelId.value = undefined
    if (val) await loadModels(val)
    else models.value = []
})

watch(selectedModelId, () => loadData())

watch(() => form.value.make_id, async (val) => {
    if (val && showModal.value) {
        form.value.model_id = ''
        await loadModels(Number(val))
    }
})

onMounted(() => {
    loadData()
    loadMakes()
})
</script>

<template>
    <div class="space-y-4">
        <!-- Header & Toolbar -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-1 flex-col gap-4 sm:flex-row">
                <!-- Search -->
                <div class="relative max-w-sm flex-1">
                    <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input v-model="search" @input="handleSearch" placeholder="Buscar por código..." class="pl-9" />
                </div>

                <!-- Make Filter -->
                <div class="relative w-full sm:w-48">
                    <select v-model="selectedMakeId"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <option :value="undefined">Todas las Marcas</option>
                        <option v-for="make in makes" :key="make.id" :value="make.id">{{ make.name }}</option>
                    </select>
                </div>

                <!-- Model Filter -->
                <div class="relative w-full sm:w-48">
                    <select v-model="selectedModelId" :disabled="!selectedMakeId"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <option :value="undefined">Todos los Modelos</option>
                        <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>
            </div>

            <Button @click="openCreateModal">
                <Plus class="mr-2 h-4 w-4" />
                Nuevo Motor
            </Button>
        </div>

        <!-- Table -->
        <div class="rounded-md border border-gray-200 dark:border-border">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-card dark:text-gray-400">
                        <tr>
                            <th class="px-6 py-3 font-medium">Vehículo</th>
                            <th class="px-6 py-3 font-medium">Motor</th>
                            <th class="px-6 py-3 font-medium">Desplazamiento</th>
                            <th class="px-6 py-3 text-right font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-if="loading && !engines.length">
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">Cargando...</td>
                        </tr>
                        <tr v-else-if="!engines.length">
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">No hay motores registrados.</td>
                        </tr>
                        <tr v-for="engine in engines" :key="engine.id"
                            class="bg-white hover:bg-gray-50 dark:bg-background dark:hover:bg-card">
                            <td class="px-6 py-4 text-gray-900 dark:text-white">
                                <div class="font-medium">{{ engine.model?.make?.name }}</div>
                                <div class="text-xs text-gray-500">{{ engine.model?.name }}</div>
                            </td>
                            <td class="px-6 py-4 font-mono text-gray-700 dark:text-gray-300">{{ engine.engine_code }}</td>
                            <td class="px-6 py-4 text-gray-500 dark:text-gray-400">{{ engine.displacement }}</td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" @click="openEditModal(engine)" title="Editar y gestionar VINs">
                                        <Pencil class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon"
                                        class="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        @click="handleDelete(engine)">
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal -->
        <Dialog :open="showModal" @update:open="v => { if (!v) closeModal() }">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{{ editingEngine ? 'Editar Motor' : 'Nuevo Motor' }}</DialogTitle>
                    <DialogDescription>Marca, Modelo, Motor y VINs asociados.</DialogDescription>
                </DialogHeader>

                <!-- FORM -->
                <form @submit.prevent="handleSubmit" class="space-y-4 py-2">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Marca -->
                        <div class="space-y-2">
                            <Label>Marca</Label>
                            <select v-model="form.make_id" required
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                <option value="" disabled>Selecciona marca</option>
                                <option v-for="make in makes" :key="make.id" :value="make.id">{{ make.name }}</option>
                            </select>
                        </div>

                        <!-- Modelo -->
                        <div class="space-y-2">
                            <Label>Modelo</Label>
                            <select v-model="form.model_id" required :disabled="!form.make_id"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                <option value="" disabled>Selecciona modelo</option>
                                <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <!-- Motor (engine_code) -->
                        <div class="space-y-2">
                            <Label>Motor</Label>
                            <Input v-model="form.engine_code" required placeholder="Ej: 2AZ-FE, K20A" />
                        </div>

                        <!-- Desplazamiento -->
                        <div class="space-y-2">
                            <Label>Desplazamiento</Label>
                            <Input v-model="form.displacement" placeholder="Ej: 2.4L, 1800cc" />
                        </div>
                    </div>

                    <div v-if="error" class="text-sm text-red-600">{{ error }}</div>

                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="closeModal">Cancelar</Button>
                        <Button type="submit" :disabled="processing">
                            {{ processing ? 'Guardando...' : (editingEngine ? 'Actualizar' : 'Crear Motor') }}
                        </Button>
                    </div>
                </form>

                <!-- VINs SECTION (visible once engine exists) -->
                <div v-if="editingEngine" class="border-t pt-4 space-y-3">
                    <div class="flex items-center gap-2">
                        <Hash class="h-4 w-4 text-gray-400" />
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">VINs Asociados</h4>
                        <span class="ml-auto text-xs text-gray-400">17 caracteres</span>
                    </div>

                    <!-- Add VIN input -->
                    <div class="flex gap-2">
                        <Input
                            v-model="newVin"
                            maxlength="17"
                            placeholder="Ingresa VIN (17 caracteres)"
                            class="font-mono text-sm uppercase"
                            @keyup.enter="handleAddVin"
                            :class="newVin.length > 0 && newVin.length !== 17 ? 'border-red-400' : ''"
                        />
                        <Button type="button" :disabled="newVin.length !== 17 || addingVin" @click="handleAddVin" size="sm">
                            <Plus class="h-4 w-4" />
                        </Button>
                    </div>

                    <p v-if="newVin.length > 0 && newVin.length !== 17" class="text-xs text-red-500">
                        {{ newVin.length }} / 17 caracteres
                    </p>
                    <p v-if="vinError" class="text-xs text-red-600">{{ vinError }}</p>

                    <!-- VIN list -->
                    <div v-if="vinsLoading" class="py-2 text-center text-sm text-gray-400">Cargando VINs...</div>
                    <div v-else-if="engineVins.length === 0" class="py-2 text-center text-sm text-gray-400">No hay VINs registrados.</div>
                    <ul v-else class="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-border rounded-md border border-gray-200 dark:border-border">
                        <li v-for="v in engineVins" :key="v.id"
                            class="flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-background">
                            <span class="font-mono text-gray-800 dark:text-gray-200 tracking-wide">{{ v.vin }}</span>
                            <button type="button" @click="handleRemoveVin(v.id)" class="ml-2 text-red-500 hover:text-red-700">
                                <X class="h-4 w-4" />
                            </button>
                        </li>
                    </ul>
                </div>

                <p v-else class="text-xs text-gray-400 text-center pt-1">
                    Guarda el motor primero para poder agregar VINs.
                </p>
            </DialogContent>
        </Dialog>
    </div>
</template>
