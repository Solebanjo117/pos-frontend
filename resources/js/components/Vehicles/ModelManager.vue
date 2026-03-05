<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useVehicleModels, type VehicleModel } from '@/composables/useVehicleModels'
import { useVehicleMakes } from '@/composables/useVehicleMakes'
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
import { Pencil, Trash2, Plus, Search, Filter } from 'lucide-vue-next'

// Composables
const { models, fetchModels, createModel, updateModel, deleteModel, loading, error } = useVehicleModels()
const { makes, fetchMakes } = useVehicleMakes()

// State
const showModal = ref(false)
const editingModel = ref<VehicleModel | null>(null)
const processing = ref(false)
const search = ref('')
const selectedMakeId = ref<number | undefined>(undefined)

// Form Data
const form = ref({
    make_id: '' as string | number,
    name: '',
    year_from: new Date().getFullYear(),
    year_to: new Date().getFullYear(),
})

// Load Data
const loadData = async () => {
    await fetchModels({ 
        per_page: 50, 
        search: search.value,
        make_id: selectedMakeId.value
    })
}

// Load Makes for dropdowns
const loadMakes = async () => {
    await fetchMakes({ per_page: 100 })
}

const openCreateModal = () => {
    editingModel.value = null
    form.value = {
        make_id: '',
        name: '',
        year_from: new Date().getFullYear(),
        year_to: new Date().getFullYear(),
    }
    showModal.value = true
}

const openEditModal = (model: VehicleModel) => {
    editingModel.value = model
    form.value = {
        make_id: model.make_id,
        name: model.name,
        year_from: model.year_from || new Date().getFullYear(),
        year_to: model.year_to || new Date().getFullYear(),
    }
    showModal.value = true
}

const handleSubmit = async () => {
    processing.value = true
    try {
        const payload = {
            ...form.value,
            make_id: Number(form.value.make_id)
        }
        
        if (editingModel.value) {
            await updateModel(editingModel.value.id, payload)
        } else {
            await createModel(payload)
        }
        showModal.value = false
        // Refresh list to update counts or sort
        await loadData()
    } catch (e) {
        console.error(e)
    } finally {
        processing.value = false
    }
}

const handleDelete = async (model: VehicleModel) => {
    if (!confirm(`¿Estás seguro de eliminar el modelo ${model.name}?`)) return
    
    try {
        await deleteModel(model.id)
    } catch (e) {
        console.error(e)
        alert('No se pudo eliminar el modelo. Es probable que tenga motores asociados.')
    }
}

// Watchers for search and filter
let timeout: ReturnType<typeof setTimeout>
const handleSearch = () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
        loadData()
    }, 300)
}

watch(selectedMakeId, () => {
    loadData()
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
                    <Input 
                        v-model="search"
                        @input="handleSearch"
                        placeholder="Buscar modelos..." 
                        class="pl-9"
                    />
                </div>
                 <!-- Make Filter -->
                <div class="relative w-full sm:w-64">
                    <Filter class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <select
                        v-model="selectedMakeId"
                        class="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option :value="undefined">Todas las Marcas</option>
                        <option v-for="make in makes" :key="make.id" :value="make.id">
                            {{ make.name }}
                        </option>
                    </select>
                </div>
            </div>
           
            <Button @click="openCreateModal">
                <Plus class="mr-2 h-4 w-4" />
                Nuevo Modelo
            </Button>
        </div>

        <!-- Table -->
        <div class="rounded-md border border-gray-200 dark:border-border">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-card dark:text-gray-400">
                        <tr>
                            <th class="px-6 py-3 font-medium">Marca</th>
                            <th class="px-6 py-3 font-medium">Modelo</th>
                            <th class="px-6 py-3 font-medium">Motores</th>
                            <th class="px-6 py-3 text-right font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-if="loading && !models.length">
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">Cargando...</td>
                        </tr>
                        <tr v-else-if="models.length === 0">
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">No hay modelos registrados.</td>
                        </tr>
                        <tr 
                            v-for="model in models" 
                            :key="model.id"
                            class="bg-white hover:bg-gray-50 dark:bg-background dark:hover:bg-card"
                        >
                            <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                {{ model.make?.name }}
                            </td>
                            <td class="px-6 py-4 text-gray-700 dark:text-gray-300">
                                {{ model.name }}
                                <span v-if="model.year_from || model.year_to" class="ml-2 text-xs text-gray-500">
                                    ({{ model.year_from }}-{{ model.year_to }})
                                </span>
                            </td>
                            <td class="px-6 py-4 text-gray-500 dark:text-gray-400">
                                <span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/40 dark:text-blue-400">
                                    {{ model.engines_count || 0 }} motores
                                </span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" @click="openEditModal(model)">
                                        <Pencil class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" @click="handleDelete(model)">
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
        <Dialog :open="showModal" @update:open="showModal = $event">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{{ editingModel ? 'Editar Modelo' : 'Nuevo Modelo' }}</DialogTitle>
                    <DialogDescription>
                        Complete los detalles del modelo de vehículo.
                    </DialogDescription>
                </DialogHeader>
                
                <form @submit.prevent="handleSubmit" class="space-y-4 py-4">
                    <!-- Make Select -->
                    <div class="space-y-2">
                        <Label>Marca</Label>
                        <select
                            v-model="form.make_id"
                            required
                            :disabled="!!editingModel" 
                            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="" disabled>Selecciona una marca</option>
                            <option v-for="make in makes" :key="make.id" :value="make.id">
                                {{ make.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Name -->
                    <div class="space-y-2">
                        <Label>Nombre del Modelo</Label>
                        <Input v-model="form.name" required placeholder="Ej: Corolla" />
                    </div>

                    <!-- Years -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Año Desde</Label>
                            <Input v-model="form.year_from" type="number" placeholder="Ej: 2010" />
                        </div>
                        <div class="space-y-2">
                            <Label>Año Hasta</Label>
                            <Input v-model="form.year_to" type="number" placeholder="Ej: 2025" />
                        </div>
                    </div>

                    <div v-if="error" class="text-sm text-red-600">
                        {{ error }}
                    </div>

                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" @click="showModal = false">
                            Cancelar
                        </Button>
                        <Button type="submit" :disabled="processing">
                            {{ processing ? 'Guardando...' : 'Guardar' }}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    </div>
</template>
