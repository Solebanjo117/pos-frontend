<script setup lang="ts">
import { ref, computed } from 'vue';
import apiClient from '@/services/api/client';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-vue-next';

interface VehicleChassisCatalogItem {
    id: number;
    code: string;
    name?: string | null;
    model?: {
        id?: number;
        name?: string;
        make?: { id?: number; name?: string };
    } | null;
}

const props = defineProps<{
    currentModal:
        | 'vehicleMake'
        | 'vehicleModel'
        | 'vehicleEngine'
        | 'vehicleChassis'
        | null;
    selectedMakeId: number | null;
    selectedModelId: number | null;
}>();

const emit = defineEmits<{
    close: [];
    'make-created': [make: { id: number; name: string }];
    'model-created': [
        model: {
            id: number;
            name: string;
            year_from?: number;
            year_to?: number;
            generation?: string;
        },
    ];
    'engine-created': [
        engine: { id: number; engine_code: string; displacement?: string },
    ];
    'chassis-created': [chassis: any];
}>();

const inlineForm = ref<Record<string, any>>({});
const inlineProcessing = ref(false);
const inlineError = ref<string | null>(null);
const vehicleModelDraftBeforeChassis = ref<Record<string, any> | null>(null);

const vehicleChassisCatalog = ref<VehicleChassisCatalogItem[]>([]);
const loadingVehicleChassisCatalog = ref(false);
const selectedModelGenerationChassisId = ref<number | null>(null);

const vehicleChassisCatalogOptions = computed(() =>
    vehicleChassisCatalog.value.map((chassis) => {
        const details = [
            chassis.name,
            chassis.model?.make?.name,
            chassis.model?.name,
        ]
            .filter(Boolean)
            .join(' - ');
        return {
            value: chassis.id,
            label: chassis.code,
            sublabel: details || undefined,
        };
    }),
);

const fetchVehicleChassisCatalog = async () => {
    loadingVehicleChassisCatalog.value = true;
    try {
        const { data } = await apiClient.get('/vehicle-chassis', {
            params: { per_page: 300 },
        });
        vehicleChassisCatalog.value = data?.data ?? [];
    } catch {
        vehicleChassisCatalog.value = [];
    } finally {
        loadingVehicleChassisCatalog.value = false;
    }
};

const openModelChassisQuickCreate = () => {
    vehicleModelDraftBeforeChassis.value = { ...inlineForm.value };
    initForm('vehicleChassis');
};

const initForm = (type: string) => {
    inlineError.value = null;
    inlineProcessing.value = false;
    if (type === 'vehicleMake') inlineForm.value = { name: '' };
    else if (type === 'vehicleModel') {
        inlineForm.value = {
            name: '',
            year_from: new Date().getFullYear(),
            year_to: new Date().getFullYear(),
        };
        selectedModelGenerationChassisId.value = null;
        fetchVehicleChassisCatalog();
    } else if (type === 'vehicleEngine')
        inlineForm.value = { engine_code: '', displacement: '' };
    else if (type === 'vehicleChassis')
        inlineForm.value = { code: '', name: '' };
};

const open = (
    type: 'vehicleMake' | 'vehicleModel' | 'vehicleEngine' | 'vehicleChassis',
) => {
    if (type !== 'vehicleChassis') {
        vehicleModelDraftBeforeChassis.value = null;
    }
    initForm(type);
};

const close = () => {
    if (
        props.currentModal === 'vehicleChassis' &&
        vehicleModelDraftBeforeChassis.value
    ) {
        inlineForm.value = { ...vehicleModelDraftBeforeChassis.value };
        vehicleModelDraftBeforeChassis.value = null;
        // Signal parent to switch back to vehicleModel — parent controls currentModal
        emit('close');
        return;
    }
    vehicleModelDraftBeforeChassis.value = null;
    emit('close');
};

const submit = async () => {
    inlineProcessing.value = true;
    inlineError.value = null;
    try {
        if (props.currentModal === 'vehicleMake') {
            const { data } = await apiClient.post(
                '/vehicle-makes',
                inlineForm.value,
            );
            const newMake = data.data ?? data;
            emit('make-created', newMake);
        } else if (props.currentModal === 'vehicleModel') {
            const selectedGeneration =
                vehicleChassisCatalog.value
                    .find(
                        (chassis) =>
                            chassis.id ===
                            selectedModelGenerationChassisId.value,
                    )
                    ?.code?.trim() || null;

            if (selectedGeneration && selectedGeneration.length > 20) {
                inlineError.value =
                    'El código de chasis seleccionado supera 20 caracteres y no puede guardarse como generación del modelo.';
                return;
            }

            const payload = {
                ...inlineForm.value,
                make_id: props.selectedMakeId,
                generation: selectedGeneration,
            };

            const { data } = await apiClient.post('/vehicle-models', payload);
            const newModel = data.data ?? data;
            emit('model-created', newModel);
        } else if (props.currentModal === 'vehicleEngine') {
            const { data } = await apiClient.post('/vehicle-engines', {
                ...inlineForm.value,
                make_id: props.selectedMakeId,
                model_id: props.selectedModelId,
                model_ids: props.selectedModelId ? [props.selectedModelId] : [],
                fuel_type: 'Gasoline',
            });
            const newEngine = data.data ?? data;
            emit('engine-created', newEngine);
        } else if (props.currentModal === 'vehicleChassis') {
            const { data } = await apiClient.post('/vehicle-chassis', {
                ...inlineForm.value,
                model_id: props.selectedModelId,
            });
            const newChassis = data.data ?? data;

            if (
                !vehicleChassisCatalog.value.some((c) => c.id === newChassis.id)
            ) {
                vehicleChassisCatalog.value.push(newChassis);
            }

            if (vehicleModelDraftBeforeChassis.value) {
                const modelDraft = { ...vehicleModelDraftBeforeChassis.value };
                vehicleModelDraftBeforeChassis.value = null;
                selectedModelGenerationChassisId.value = newChassis.id;
                inlineForm.value = modelDraft;
                emit('chassis-created', newChassis);
                return;
            }

            emit('chassis-created', newChassis);
        }
        close();
    } catch (e: any) {
        inlineError.value = e.response?.data?.message || 'Error al crear';
    } finally {
        inlineProcessing.value = false;
    }
};

defineExpose({
    open,
    close,
    submit,
    vehicleChassisCatalog,
    selectedModelGenerationChassisId,
    fetchVehicleChassisCatalog,
});
</script>

<template>
    <Dialog
        :open="currentModal !== null"
        @update:open="
            (v) => {
                if (!v) close();
            }
        "
    >
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>
                    <span v-if="currentModal === 'vehicleMake'"
                        >Nueva Marca de Vehículo</span
                    >
                    <span v-else-if="currentModal === 'vehicleModel'"
                        >Nuevo Modelo de Vehículo</span
                    >
                    <span v-else-if="currentModal === 'vehicleEngine'"
                        >Nuevo Motor</span
                    >
                    <span v-else-if="currentModal === 'vehicleChassis'"
                        >Nuevo Chasis</span
                    >
                </DialogTitle>
            </DialogHeader>

            <div class="space-y-4 pt-2">
                <p
                    v-if="inlineError"
                    class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                    {{ inlineError }}
                </p>

                <!-- Make form -->
                <template v-if="currentModal === 'vehicleMake'">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Nombre de la Marca
                            <span class="text-red-500">*</span></label
                        >
                        <input
                            v-model="inlineForm.name"
                            type="text"
                            @keyup.enter="submit"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: Toyota, Ford, Kia..."
                        />
                    </div>
                </template>

                <!-- Model form -->
                <template v-else-if="currentModal === 'vehicleModel'">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Nombre del Modelo
                            <span class="text-red-500">*</span></label
                        >
                        <input
                            v-model="inlineForm.name"
                            type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: Corolla, Civic, Tucson..."
                        />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Año Desde
                                <span class="text-red-500">*</span></label
                            >
                            <input
                                v-model.number="inlineForm.year_from"
                                type="number"
                                min="1900"
                                :max="new Date().getFullYear() + 2"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Año Hasta
                                <span class="text-red-500">*</span></label
                            >
                            <input
                                v-model.number="inlineForm.year_to"
                                type="number"
                                min="1900"
                                :max="new Date().getFullYear() + 2"
                                class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <div class="mb-1 flex items-center justify-between">
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Chasis
                                <span class="text-xs text-gray-400"
                                    >(opcional)</span
                                ></label
                            >
                            <button
                                type="button"
                                @click="openModelChassisQuickCreate"
                                class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                title="Crear nuevo chasis"
                            >
                                <Plus class="h-3 w-3" /> Crear
                            </button>
                        </div>
                        <SearchableSelect
                            :options="vehicleChassisCatalogOptions"
                            :model-value="selectedModelGenerationChassisId"
                            @update:model-value="
                                (v) =>
                                    (selectedModelGenerationChassisId = v as
                                        | number
                                        | null)
                            "
                            :loading="loadingVehicleChassisCatalog"
                            placeholder="-- Selecciona chasis --"
                            search-placeholder="Buscar chasis..."
                            :clearable="true"
                        />
                    </div>
                </template>

                <!-- Engine form -->
                <template v-else-if="currentModal === 'vehicleEngine'">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Código de Motor
                            <span class="text-red-500">*</span></label
                        >
                        <input
                            v-model="inlineForm.engine_code"
                            type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: 1NZ-FE, K24A, EJ257..."
                        />
                    </div>
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Cilindrada
                            <span class="text-xs text-gray-400"
                                >(opcional)</span
                            ></label
                        >
                        <input
                            v-model="inlineForm.displacement"
                            type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: 1.8L, 2.4L, 2000cc..."
                        />
                    </div>
                </template>

                <!-- Chassis form -->
                <template v-else-if="currentModal === 'vehicleChassis'">
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Código de Chasis / Generación
                            <span class="text-red-500">*</span></label
                        >
                        <input
                            v-model="inlineForm.code"
                            type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: P90 o JTDBR32E..."
                        />
                    </div>
                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Descripción Adicional
                            <span class="text-xs text-gray-400"
                                >(opcional)</span
                            ></label
                        >
                        <input
                            v-model="inlineForm.name"
                            type="text"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: Serie P90 o generación..."
                        />
                    </div>
                </template>

                <!-- Actions -->
                <div class="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        @click="close"
                        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-background"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        @click="submit"
                        :disabled="inlineProcessing"
                        class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        {{ inlineProcessing ? 'Creando...' : 'Crear' }}
                    </button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
