<script setup lang="ts">
import { Pencil, Trash2, Plus, Search } from 'lucide-vue-next';
import { ref, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useVehicleMakes,
    type VehicleMake,
} from '@/composables/useVehicleMakes';

const {
    makes,
    fetchMakes,
    createMake,
    updateMake,
    deleteMake,
    loading,
    error,
} = useVehicleMakes();

const showModal = ref(false);
const editingMake = ref<VehicleMake | null>(null);
const processing = ref(false);
const search = ref('');

// Form Data
const form = ref({
    name: '',
});

const loadData = async () => {
    await fetchMakes({ per_page: 50, search: search.value });
};

const openCreateModal = () => {
    editingMake.value = null;
    form.value = { name: '' };
    showModal.value = true;
};

const openEditModal = (make: VehicleMake) => {
    editingMake.value = make;
    form.value = { name: make.name };
    showModal.value = true;
};

const handleSubmit = async () => {
    processing.value = true;
    try {
        if (editingMake.value) {
            await updateMake(editingMake.value.id, form.value);
        } else {
            await createMake(form.value);
        }
        showModal.value = false;
        // Refresh list if needed, though composable usually updates state
    } catch (e) {
        console.error(e);
    } finally {
        processing.value = false;
    }
};

const handleDelete = async (make: VehicleMake) => {
    if (!confirm(`¿Estás seguro de eliminar la marca ${make.name}?`)) return;

    try {
        await deleteMake(make.id);
    } catch (e) {
        console.error(e);
        alert(
            'No se pudo eliminar la marca. Es probable que tenga modelos asociados.',
        );
    }
};

// Simple debounce for search
let timeout: ReturnType<typeof setTimeout>;
const handleSearch = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        loadData();
    }, 300);
};

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="space-y-4">
        <!-- Header & Toolbar -->
        <div
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="relative max-w-sm flex-1">
                <Search
                    class="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500"
                />
                <Input
                    v-model="search"
                    @input="handleSearch"
                    placeholder="Buscar marcas..."
                    class="pl-9"
                />
            </div>
            <Button @click="openCreateModal">
                <Plus class="mr-2 h-4 w-4" />
                Nueva Marca
            </Button>
        </div>

        <!-- Table -->
        <div class="rounded-md border border-gray-200 dark:border-border">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead
                        class="bg-gray-50 text-xs text-gray-700 uppercase dark:bg-card dark:text-gray-400"
                    >
                        <tr>
                            <th class="px-6 py-3 font-medium">Nombre</th>
                            <th class="px-6 py-3 font-medium">Modelos</th>
                            <th class="px-6 py-3 text-right font-medium">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-if="loading && !makes.length">
                            <td
                                colspan="3"
                                class="px-6 py-4 text-center text-gray-500"
                            >
                                Cargando...
                            </td>
                        </tr>
                        <tr v-else-if="makes.length === 0">
                            <td
                                colspan="3"
                                class="px-6 py-4 text-center text-gray-500"
                            >
                                No hay marcas registradas.
                            </td>
                        </tr>
                        <tr
                            v-for="make in makes"
                            :key="make.id"
                            class="bg-white hover:bg-gray-50 dark:bg-background dark:hover:bg-card"
                        >
                            <td
                                class="px-6 py-4 font-medium text-gray-900 dark:text-white"
                            >
                                {{ make.name }}
                            </td>
                            <td
                                class="px-6 py-4 text-gray-500 dark:text-gray-400"
                            >
                                <span
                                    class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-900/40 dark:text-blue-400"
                                >
                                    {{ make.models_count || 0 }} modelos
                                </span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        @click="openEditModal(make)"
                                    >
                                        <Pencil class="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                                        @click="handleDelete(make)"
                                    >
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
                    <DialogTitle>{{
                        editingMake ? 'Editar Marca' : 'Nueva Marca'
                    }}</DialogTitle>
                    <DialogDescription>
                        Ingrese el nombre de la marca de vehículos.
                    </DialogDescription>
                </DialogHeader>

                <form @submit.prevent="handleSubmit" class="space-y-4 py-4">
                    <div class="space-y-2">
                        <Label>Nombre</Label>
                        <Input
                            v-model="form.name"
                            required
                            placeholder="Ej: Toyota"
                        />
                    </div>

                    <div v-if="error" class="text-sm text-red-600">
                        {{ error }}
                    </div>

                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="showModal = false"
                        >
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
